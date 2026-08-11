'use client'

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/app/contexts/AuthContext'
import { resolvePricingSourceShopId, resolveBackSourceShopId } from '@/lib/shopUtils'

/** 電話代行を含むプラン。has_agency が未設定の店舗はこの一覧で判定する */
const AGENCY_PLANS = ['agency_only_plan', 'web_agency_plan', 'hp_web_agency_plan', 'agency_plan']

type Shop = {
  id: string
  owner_id?: string | null
  owner_name?: string | null
  name: string
  short_name: string | null
  description: string | null
  special_rules: string | null
  is_active: boolean
  created_at: string
  order: number | null
  closing_date: number
  is_web_reserve_plan?: boolean
  is_dispatch_enabled?: boolean
  pricing_source_shop_id?: string | null
  back_source_shop_id?: string | null
  // 契約プランと機能モジュール（未設定の店舗は null。プラン名からの推測にフォールバックする）
  plan?: string | null
  has_hp?: boolean | null
  has_reserve?: boolean | null
  has_agency?: boolean | null
  hp_url?: string | null
}

type ShopContextType = {
  shops: Shop[]
  selectedShop: Shop | null
  setSelectedShop: (shop: Shop) => void
  loading: boolean
  refreshShops: () => Promise<void>
}

const ShopContext = createContext<ShopContextType | undefined>(undefined)

export function ShopProvider({ children }: { children: ReactNode }) {
  const [shops, setShops] = useState<Shop[]>([])
  const [selectedShop, setSelectedShopState] = useState<Shop | null>(null)
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()

  // トークン更新などで fetchShops が多重に走ったとき、古い実行の結果が
  // 新しい実行の結果を上書きしないようにするための世代カウンタ。
  const fetchGenerationRef = useRef(0)
  // 選択中の店舗IDを ref でも保持する。fetchShops のクロージャが古い
  // selectedShop を掴んでユーザーの選択を巻き戻すのを防ぐため。
  const selectedShopIdRef = useRef<string | null>(null)

  useEffect(() => {
    selectedShopIdRef.current = selectedShop?.id ?? null
  }, [selectedShop])

  // 前回選択していた店舗を localStorage から即座に復元する。
  // これが無いと、どの画面も「店舗一覧の取得（ネットワーク1往復）」が終わるまで
  // 自分のデータ取得を開始できない。認証・店舗一覧・画面データで3回直列に待つことになり、
  // 表示までの体感の大半がこの待ち時間だった。
  // 内容が古い可能性はあるが、直後に走る fetchShops が同じ id で必ず上書きする。
  // （この effect は fetchShops の effect より前に置くこと。順番に依存している）
  useEffect(() => {
    if (selectedShopIdRef.current) return
    try {
      const cached = localStorage.getItem('selectedShop')
      if (!cached) return
      const shop = JSON.parse(cached) as Shop
      if (shop?.id) {
        selectedShopIdRef.current = shop.id
        setSelectedShopState(shop)
      }
    } catch {
      // 壊れていたら無視して通常の取得に任せる
      localStorage.removeItem('selectedShop')
    }
  }, [])

  // 店舗一覧を取得
  const fetchShops = async () => {
    if (!user) {
      fetchGenerationRef.current++
      setShops([])
      setSelectedShopState(null)
      setLoading(false)
      return
    }

    const generation = ++fetchGenerationRef.current

    try {
      setLoading(true)
      // 認証セッションの復旧・確立を明示的に待つ
      await supabase.auth.getSession()

      const { data, error } = await supabase
        .from('shops')
        .select(`
          *,
          owners (
            id,
            name,
            pricing_mode,
            pricing_base_shop_id,
            back_mode,
            back_base_shop_id
          )
        `)
        .eq('is_active', true)
        .order('order', { ascending: true, nullsFirst: false })

      if (error) throw error

      const mappedShops: Shop[] = (data || []).map((shop: any) => {
        // 「Web予約プランの店舗」＝電話代行を契約していない店舗。
        // 以前はオーナーアカウントの役割から推測していたが、
        // 契約プランが正であり、判断材料はそちらに一本化する。
        const isAgency = shop.has_agency ?? AGENCY_PLANS.includes(shop.plan || '')
        return {
          id: shop.id,
          owner_id: shop.owner_id || null,
          owner_name: shop.owners?.name || null,
          name: shop.name,
          short_name: shop.short_name,
          description: shop.description,
          special_rules: shop.special_rules,
          is_active: shop.is_active,
          created_at: shop.created_at,
          order: shop.order,
          closing_date: shop.closing_date,
          is_web_reserve_plan: !isAgency,
          is_dispatch_enabled: !!shop.is_dispatch_enabled,
          // 共有するかどうかはオーナー設定が正。ここで「その店舗にとっての参照先」に
          // 翻訳して従来のフィールドに詰めるので、getPricingShopId 以降は変更不要。
          pricing_source_shop_id: resolvePricingSourceShopId(shop.owners, shop.pricing_source_shop_id),
          back_source_shop_id: resolveBackSourceShopId(shop.owners, shop.back_source_shop_id),
          plan: shop.plan ?? null,
          has_hp: shop.has_hp ?? null,
          has_reserve: shop.has_reserve ?? null,
          has_agency: shop.has_agency ?? null,
          hp_url: shop.hp_url || null
        }
      })

      // この実行より後に開始された取得があれば、その結果を尊重して何も書き込まない
      if (generation !== fetchGenerationRef.current) return

      // すでに店舗を選択済みなのに空が返ってきた場合は、RLS やセッションの
      // 一時的な不整合とみなして現状を維持する（選択が消えるのを防ぐ）。
      if (mappedShops.length === 0 && selectedShopIdRef.current) {
        console.warn('店舗一覧が空で返ったため、現在の選択を維持します')
        return
      }

      setShops(mappedShops)

      // 選択店舗の解決順:
      //   1. すでに選択中の店舗（ユーザーの操作を最優先。再取得で勝手に切り替えない）
      //   2. ローカルストレージに保存された店舗（初回ロード時の復元）
      //   3. 先頭の店舗（上記が実在しない場合のみ）
      const savedShopId = localStorage.getItem('selectedShopId')
      const currentShopId = selectedShopIdRef.current
      const shopToSelect =
        (currentShopId ? mappedShops.find((s) => s.id === currentShopId) : undefined) ||
        (savedShopId ? mappedShops.find((s) => s.id === savedShopId) : undefined) ||
        mappedShops[0] ||
        null

      if (shopToSelect) {
        // 同じ内容なら参照を維持する。毎回新しいオブジェクトを渡すと
        // selectedShop を依存に持つ画面が一斉に再取得を始めてしまうため。
        setSelectedShopState((prev) =>
          prev && JSON.stringify(prev) === JSON.stringify(shopToSelect) ? prev : shopToSelect
        )
        selectedShopIdRef.current = shopToSelect.id
        if (shopToSelect.id !== savedShopId) {
          localStorage.setItem('selectedShopId', shopToSelect.id)
        }
        // 次回の起動で即座に復元できるよう、id だけでなく店舗そのものを保存する
        localStorage.setItem('selectedShop', JSON.stringify(shopToSelect))
      } else {
        setSelectedShopState(null)
        selectedShopIdRef.current = null
        localStorage.removeItem('selectedShop')
      }
    } catch (error) {
      console.error('店舗の取得に失敗:', error)
    } finally {
      if (generation === fetchGenerationRef.current) setLoading(false)
    }
  }

  const setSelectedShop = (shop: Shop) => {
    // ref を同期的に更新しておく。直後に進行中の fetchShops が完了しても
    // ユーザーが選んだ店舗が巻き戻らないようにするため。
    selectedShopIdRef.current = shop.id
    setSelectedShopState(shop)
    localStorage.setItem('selectedShopId', shop.id)
    localStorage.setItem('selectedShop', JSON.stringify(shop))
  }

  const refreshShops = async () => {
    await fetchShops()
  }

  // user オブジェクトはトークン更新のたびに作り直されるため、
  // id を依存にして不要な再取得を避ける。
  useEffect(() => {
    fetchShops()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  return (
    <ShopContext.Provider
      value={{
        shops,
        selectedShop,
        setSelectedShop,
        loading,
        refreshShops,
      }}
    >
      {children}
    </ShopContext.Provider>
  )
}

export function useShop() {
  const context = useContext(ShopContext)
  if (!context) {
    throw new Error('useShop must be used within ShopProvider')
  }
  return context
}
