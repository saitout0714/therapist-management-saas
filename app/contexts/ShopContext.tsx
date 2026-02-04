'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase } from '@/lib/supabase'

type Shop = {
  id: string
  name: string
  description: string | null
  is_active: boolean
  created_at: string
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

  // 店舗一覧を取得
  const fetchShops = async () => {
    try {
      const { data, error } = await supabase
        .from('shops')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true })

      if (error) throw error
      setShops(data || [])

      // ローカルストレージから選択店舗を復元
      const savedShopId = localStorage.getItem('selectedShopId')
      const shopToSelect = data?.find((s) => s.id === savedShopId) || data?.[0] || null
      if (shopToSelect) {
        setSelectedShopState(shopToSelect)
        localStorage.setItem('selectedShopId', shopToSelect.id)
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
  }, [])

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
