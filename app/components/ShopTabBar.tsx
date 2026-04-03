'use client'

import { useShop } from '@/app/contexts/ShopContext'
import { useAuth } from '@/app/contexts/AuthContext'
import { useRouter, usePathname } from 'next/navigation'
import { useRef, useEffect, useState } from 'react'

export default function ShopTabBar() {
  const { shops, selectedShop, setSelectedShop } = useShop()
  const { user } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const scrollRef = useRef<HTMLDivElement>(null)
  const activeTabRef = useRef<HTMLButtonElement>(null)
  const [showLeftFade, setShowLeftFade] = useState(false)
  const [showRightFade, setShowRightFade] = useState(false)

  const isEditingPage = /\/(edit|new)(\/|$)/.test(pathname ?? '')

  // アクティブタブが見えるようにスクロール
  useEffect(() => {
    if (activeTabRef.current && scrollRef.current) {
      const container = scrollRef.current
      const tab = activeTabRef.current
      const tabLeft = tab.offsetLeft
      const tabRight = tabLeft + tab.offsetWidth
      const visibleLeft = container.scrollLeft
      const visibleRight = visibleLeft + container.clientWidth
      if (tabLeft < visibleLeft + 16) {
        container.scrollTo({ left: tabLeft - 16, behavior: 'smooth' })
      } else if (tabRight > visibleRight - 16) {
        container.scrollTo({ left: tabRight - container.clientWidth + 16, behavior: 'smooth' })
      }
    }
  }, [selectedShop])

  const updateFades = () => {
    const el = scrollRef.current
    if (!el) return
    setShowLeftFade(el.scrollLeft > 4)
    setShowRightFade(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    updateFades()
    el.addEventListener('scroll', updateFades)
    const ro = new ResizeObserver(updateFades)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', updateFades)
      ro.disconnect()
    }
  }, [shops])

  if (!user || !selectedShop || shops.length <= 1) return null

  const handleShopSelect = (shop: typeof selectedShop) => {
    if (!shop || shop.id === selectedShop?.id) return
    if (isEditingPage) {
      const ok = window.confirm(
        `編集中のページを離れて「${shop.name}」のダッシュボードへ移動しますか？\n\n保存されていない変更は失われます。`
      )
      if (!ok) return
    }
    setSelectedShop(shop)
    router.push('/shifts')
  }

  return (
    <div
      className="flex-shrink-0 relative bg-white border-t-2 border-slate-200"
      style={{ height: '52px', boxShadow: '0 -4px 24px rgba(0,0,0,0.07)' }}
    >
      {/* 左フェード */}
      {showLeftFade && (
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-10 z-10 bg-gradient-to-r from-white to-transparent" />
      )}
      {/* 右フェード */}
      {showRightFade && (
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-10 z-10 bg-gradient-to-l from-white to-transparent" />
      )}

      <div
        ref={scrollRef}
        className="h-full flex items-center gap-1.5 px-3 overflow-x-auto"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {shops.map((shop) => {
          const isActive = shop.id === selectedShop?.id
          return (
            <button
              key={shop.id}
              ref={isActive ? activeTabRef : undefined}
              onClick={() => handleShopSelect(shop)}
              className={`
                relative flex-shrink-0 flex items-center gap-2 px-4 h-9 rounded-lg text-sm
                transition-all duration-150 focus:outline-none whitespace-nowrap
                ${isActive
                  ? 'bg-indigo-600 text-white font-semibold shadow-md shadow-indigo-200'
                  : 'bg-slate-50 text-slate-500 font-medium hover:bg-indigo-50 hover:text-indigo-600'
                }
              `}
            >
              {/* アクティブインジケータードット */}
              <span
                className={`
                  w-1.5 h-1.5 rounded-full flex-shrink-0 transition-all duration-150
                  ${isActive ? 'bg-white/70' : 'bg-slate-400'}
                `}
              />
              {shop.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}
