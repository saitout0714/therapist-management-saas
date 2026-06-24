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
  const containerRef = useRef<HTMLDivElement>(null)
  const activeTabRef = useRef<HTMLButtonElement>(null)
  
  const [showLeftFade, setShowLeftFade] = useState(false)
  const [showRightFade, setShowRightFade] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const dragRef = useRef({ startX: 0, scrollLeft: 0, moved: false })

  const [position, setPosition] = useState<{ x: number; y: number } | null>(null)
  const [isMounted, setIsMounted] = useState(false)
  
  const dragPositionRef = useRef({
    isDragging: false,
    grabOffsetX: 0,
    grabOffsetY: 0
  })

  const [isScrollHidden, setIsScrollHidden] = useState(false)
  const isEditingPage = /\/(edit|new)(\/|$)/.test(pathname ?? '')

  // Scroll to dodge logic
  useEffect(() => {
    if (!isMounted) return

    const mainEl = document.querySelector('main')
    if (!mainEl) return

    let lastScrollTop = mainEl.scrollTop
    let ticking = false

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (dragPositionRef.current.isDragging) {
            setIsScrollHidden(false)
            ticking = false
            return
          }

          const currentScrollTop = mainEl.scrollTop
          
          if (currentScrollTop <= 10) {
            setIsScrollHidden(false)
          } else if (currentScrollTop > lastScrollTop + 15) {
            // Scrolling down -> hide
            setIsScrollHidden(true)
          } else if (currentScrollTop < lastScrollTop - 15) {
            // Scrolling up -> show
            setIsScrollHidden(false)
          }
          
          lastScrollTop = currentScrollTop
          ticking = false
        })
        ticking = true
      }
    }

    mainEl.addEventListener('scroll', handleScroll)
    return () => {
      mainEl.removeEventListener('scroll', handleScroll)
    }
  }, [isMounted])

  useEffect(() => {
    setIsMounted(true)
    const savedX = localStorage.getItem('shop_tab_bar_pos_x')
    const savedY = localStorage.getItem('shop_tab_bar_pos_y')
    if (savedX && savedY) {
      const x = parseFloat(savedX)
      const y = parseFloat(savedY)
      if (x >= 0 && x < window.innerWidth && y >= 0 && y < window.innerHeight) {
        setPosition({ x, y })
      }
    }
  }, [])

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
      if (el) {
        el.removeEventListener('scroll', updateFades)
      }
      ro.disconnect()
    }
  }, [shops, isMounted])

  // Boundary check on resize
  useEffect(() => {
    const handleResize = () => {
      if (!position || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const x = Math.max(8, Math.min(position.x, window.innerWidth - rect.width - 8))
      const y = Math.max(8, Math.min(position.y, window.innerHeight - rect.height - 8))
      setPosition({ x, y })
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [position])

  const handleDragStart = (clientX: number, clientY: number) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    dragPositionRef.current = {
      isDragging: true,
      grabOffsetX: clientX - rect.left,
      grabOffsetY: clientY - rect.top
    }
  }

  const handleDragMove = (clientX: number, clientY: number) => {
    if (!dragPositionRef.current.isDragging || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const newX = clientX - dragPositionRef.current.grabOffsetX
    const newY = clientY - dragPositionRef.current.grabOffsetY

    const x = Math.max(8, Math.min(newX, window.innerWidth - rect.width - 8))
    const y = Math.max(8, Math.min(newY, window.innerHeight - rect.height - 8))

    setPosition({ x, y })
  }

  const handleDragEnd = () => {
    if (dragPositionRef.current.isDragging) {
      dragPositionRef.current.isDragging = false
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        localStorage.setItem('shop_tab_bar_pos_x', String(rect.left))
        localStorage.setItem('shop_tab_bar_pos_y', String(rect.top))
      }
    }
  }

  const handleResetPosition = () => {
    setPosition(null)
    localStorage.removeItem('shop_tab_bar_pos_x')
    localStorage.removeItem('shop_tab_bar_pos_y')
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      handleDragMove(e.clientX, e.clientY)
    }
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        handleDragMove(e.touches[0].clientX, e.touches[0].clientY)
      }
    }
    const handleMouseUp = () => {
      handleDragEnd()
    }
    const handleTouchEnd = () => {
      handleDragEnd()
    }

    if (isMounted) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('touchmove', handleTouchMove, { passive: false })
      window.addEventListener('mouseup', handleMouseUp)
      window.addEventListener('touchend', handleTouchEnd)
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('touchend', handleTouchEnd)
    }
  }, [isMounted, position])

  if (!isMounted || !user || !selectedShop || shops.length <= 1) return null

  const handleShopSelect = (shop: typeof selectedShop) => {
    if (!shop || shop.id === selectedShop?.id || dragRef.current.moved) return
    if (isEditingPage) {
      const ok = window.confirm(
        `編集中のページを離れて「${shop.name}」のホームへ移動しますか？\n\n保存されていない変更は失われます。`
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
      ref={containerRef}
      className={`fixed z-40 flex items-center gap-1.5 w-fit max-w-[calc(100%-2rem)] transition-all duration-300 ${
        position ? '' : 'bottom-4 left-1/2'
      } ${isScrollHidden ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
      style={
        position
          ? {
              left: `${position.x}px`,
              top: `${position.y}px`,
              transform: isScrollHidden ? 'translateY(80px) scale(0.95)' : 'none',
            }
          : {
              transform: isScrollHidden ? 'translate(-50%, 80px) scale(0.95)' : 'translateX(-50%)',
            }
      }
    >
      {/* ドラッグハンドル */}
      <div
        onMouseDown={(e) => {
          if (e.button !== 0) return // Left click only
          handleDragStart(e.clientX, e.clientY)
        }}
        onTouchStart={(e) => {
          if (e.touches.length > 0) {
            handleDragStart(e.touches[0].clientX, e.touches[0].clientY)
          }
        }}
        onDoubleClick={handleResetPosition}
        title="ドラッグで移動 / ダブルクリックで中央下に戻す"
        className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-full bg-white/95 border border-slate-200 text-slate-400 cursor-grab active:cursor-grabbing hover:bg-slate-50 hover:text-indigo-600 transition-colors shadow-sm"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M7 2a2 2 0 10-2 2h2V2zM7 8a2 2 0 10-2 2h2V8zM7 14a2 2 0 10-2 2h2v-2zM11 2a2 2 0 112 2h-2V2zM11 8a2 2 0 112 2h-2V8zM11 14a2 2 0 112 2h-2v-2z" />
        </svg>
      </div>

      <div className="bg-white/95 text-slate-800 border border-slate-200 rounded-full p-1 flex relative shadow-[0_12px_32px_rgba(15,23,42,0.12)] backdrop-blur-xl flex-1 overflow-hidden">
        {/* 左スクロールボタン */}
        {showLeftFade && (
          <div className="absolute left-1 top-1/2 -translate-y-1/2 z-20">
            <button
              onClick={() => scrollBy('left')}
              className="w-6 h-6 flex items-center justify-center rounded-full bg-white/95 border border-slate-200 shadow-sm text-slate-500 hover:text-indigo-600 hover:bg-slate-50 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          </div>
        )}
        
        {/* 右スクロールボタン */}
        {showRightFade && (
          <div className="absolute right-1 top-1/2 -translate-y-1/2 z-20">
            <button
              onClick={() => scrollBy('right')}
              className="w-6 h-6 flex items-center justify-center rounded-full bg-white/95 border border-slate-200 shadow-sm text-slate-500 hover:text-indigo-600 hover:bg-slate-50 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}

        <div
          ref={scrollRef}
          className={`h-7 flex items-center gap-1 px-1 overflow-x-auto rounded-full w-full ${isDragging ? 'cursor-grabbing select-none' : 'cursor-grab'}`}
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
                  relative flex-shrink-0 flex items-center gap-1.5 px-3 h-full rounded-full text-xs
                  transition-all duration-200 focus:outline-none whitespace-nowrap
                  ${isActive
                    ? 'bg-indigo-600 text-white font-bold shadow-md shadow-indigo-600/20 scale-102'
                    : 'bg-transparent text-slate-600 font-semibold hover:bg-slate-50 hover:text-indigo-600'
                  }
                `}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-all duration-300 ${isActive ? 'bg-white shadow-[0_0_6px_rgba(255,255,255,0.9)]' : 'bg-slate-300'}`}
                />
                {shop.name}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
