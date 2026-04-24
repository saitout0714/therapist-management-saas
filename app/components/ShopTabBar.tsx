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
  const [isDragging, setIsDragging] = useState(false)
  const dragRef = useRef({ startX: 0, scrollLeft: 0, moved: false })

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
    if (!shop || shop.id === selectedShop?.id || dragRef.current.moved) return
    if (isEditingPage) {
      const ok = window.confirm(
        `編集中のページを離れて「${shop.name}」のダッシュボードへ移動しますか？\n\n保存されていない変更は失われます。`
      )
      if (!ok) return
    }
    setSelectedShop(shop)
    router.push('/shifts')
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = scrollRef.current
    if (!el) return
    dragRef.current = { startX: e.pageX - el.offsetLeft, scrollLeft: el.scrollLeft, moved: false }
    setIsDragging(true)
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return
    const el = scrollRef.current
    if (!el) return
    e.preventDefault()
    const x = e.pageX - el.offsetLeft
    const delta = x - dragRef.current.startX
    if (Math.abs(delta) > 4) dragRef.current.moved = true
    el.scrollLeft = dragRef.current.scrollLeft - delta
  }

  const handleMouseUp = () => setIsDragging(false)

  const scrollBy = (direction: 'left' | 'right') => {
    const el = scrollRef.current
    if (!el) return
    el.scrollBy({ left: direction === 'left' ? -160 : 160, behavior: 'smooth' })
  }

  return (
    <div
      className="flex-shrink-0 relative bg-white border-t-2 border-slate-200"
      style={{ height: '44px', boxShadow: '0 -4px 24px rgba(0,0,0,0.07)' }}
    >
      {/* 左スクロールボタン */}
      {showLeftFade && (
        <>
          <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-14 z-10 bg-gradient-to-r from-white to-transparent" />
          <button
            onClick={() => scrollBy('left')}
            className="absolute left-1 top-1/2 -translate-y-1/2 z-20 w-8 h-8 flex items-center justify-center rounded-full bg-white border border-slate-200 shadow-sm text-slate-500 hover:text-indigo-600 hover:border-indigo-300 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </>
      )}
      {/* 右スクロールボタン */}
      {showRightFade && (
        <>
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-14 z-10 bg-gradient-to-l from-white to-transparent" />
          <button
            onClick={() => scrollBy('right')}
            className="absolute right-1 top-1/2 -translate-y-1/2 z-20 w-8 h-8 flex items-center justify-center rounded-full bg-white border border-slate-200 shadow-sm text-slate-500 hover:text-indigo-600 hover:border-indigo-300 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}

      <div
        ref={scrollRef}
        className={`h-full flex items-center gap-1.5 px-3 overflow-x-auto ${isDragging ? 'cursor-grabbing select-none' : 'cursor-grab'}`}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {shops.map((shop) => {
          const isActive = shop.id === selectedShop?.id
          return (
            <button
              key={shop.id}
              ref={isActive ? activeTabRef : undefined}
              onClick={() => handleShopSelect(shop)}
              title={shop.name}
              className={`
                relative flex-shrink-0 flex items-center gap-1.5 px-3 h-7 rounded-md text-xs
                transition-all duration-150 focus:outline-none whitespace-nowrap
                ${isActive
                  ? 'bg-indigo-600 text-white font-semibold shadow-sm shadow-indigo-200'
                  : 'bg-slate-100 text-slate-500 font-medium hover:bg-indigo-50 hover:text-indigo-600'
                }
              `}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-all duration-150 ${isActive ? 'bg-white/70' : 'bg-slate-400'}`}
              />
              {shop.short_name || shop.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}
