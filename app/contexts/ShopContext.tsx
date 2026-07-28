'use client'

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/app/contexts/AuthContext'

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
  therapist_line_mode: 'official_line' | 'line'
  is_web_reserve_plan?: boolean
  is_dispatch_enabled?: boolean
  pricing_source_shop_id?: string | null
  back_source_shop_id?: string | null
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
            name
          ),
          shop_owners (
            users (
              role
            )
          )
        `)
        .eq('is_active', true)
        .order('order', { ascending: true, nullsFirst: false })

      if (error) throw error

      const mappedShops: Shop[] = (data || []).map((shop: any) => {
        const hasSimpleOwner = shop.shop_owners?.some((so: any) => {
          const u = Array.isArray(so.users) ? so.users[0] : so.users
          return u?.role === 'simple_client_owner'
        })
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
          therapist_line_mode: shop.therapist_line_mode,
          is_web_reserve_plan: !!hasSimpleOwner,
          is_dispatch_enabled: !!shop.is_dispatch_enabled,
          pricing_source_shop_id: shop.pricing_source_shop_id || null,
          back_source_shop_id: shop.back_source_shop_id || null
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
      } else {
        setSelectedShopState(null)
        selectedShopIdRef.current = null
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
