'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/app/contexts/AuthContext'

type Shop = {
  id: string
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

  // 店舗一覧を取得
  const fetchShops = async () => {
    if (!user) {
      setShops([])
      setSelectedShopState(null)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      // 認証セッションの復旧・確立を明示的に待つ
      await supabase.auth.getSession()

      const { data, error } = await supabase
        .from('shops')
        .select(`
          *,
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
          is_dispatch_enabled: !!shop.is_dispatch_enabled
        }
      })

      setShops(mappedShops)

      // ローカルストレージから選択店舗を復元
      const savedShopId = localStorage.getItem('selectedShopId')
      const shopToSelect = mappedShops.find((s) => s.id === savedShopId) || mappedShops[0] || null
      if (shopToSelect) {
        setSelectedShopState(shopToSelect)
        localStorage.setItem('selectedShopId', shopToSelect.id)
      } else {
        setSelectedShopState(null)
      }
    } catch (error) {
      console.error('店舗の取得に失敗:', error)
    } finally {
      setLoading(false)
    }
  }

  const setSelectedShop = (shop: Shop) => {
    setSelectedShopState(shop)
    localStorage.setItem('selectedShopId', shop.id)
  }

  const refreshShops = async () => {
    setLoading(true)
    await fetchShops()
  }

  useEffect(() => {
    fetchShops()
  }, [user])

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
