'use client'

import { useAuth } from '@/app/contexts/AuthContext'
import { useShop } from '@/app/contexts/ShopContext'
import { useRouter, usePathname } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'

export default function ShopSwitcher() {
  const { user, logout } = useAuth()
  const { shops, selectedShop, setSelectedShop } = useShop()
  const router = useRouter()
  const pathname = usePathname()

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [isShopMenuOpen, setIsShopMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [pinnedShopIds, setPinnedShopIds] = useState<string[]>([])

  const userMenuRef = useRef<HTMLDivElement>(null)
  const shopMenuRef = useRef<HTMLDivElement>(null)

  const isEditingPage = /\/(edit|new)(\/|$)/.test(pathname ?? '')

  // Load pinned shops from localStorage after mount to avoid SSR hydration mismatch
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('pinnedShopIds')
      if (saved) {
        try {
          setPinnedShopIds(JSON.parse(saved))
        } catch (e) {
          console.error('Failed to parse pinnedShopIds:', e)
        }
      }
    }
  }, [])

  // Reset search query when popup closes
  useEffect(() => {
    if (!isShopMenuOpen) {
      setSearchQuery('')
    }
  }, [isShopMenuOpen])

  const togglePin = (shopId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setPinnedShopIds((prev) => {
      const next = prev.includes(shopId)
        ? prev.filter((id) => id !== shopId)
        : [...prev, shopId]
      localStorage.setItem('pinnedShopIds', JSON.stringify(next))
      return next
    })
  }

  const getAvatarGradient = (id: string) => {
    const gradients = [
      'from-indigo-500 to-purple-500 text-white',
      'from-violet-500 to-fuchsia-500 text-white',
      'from-pink-500 to-rose-500 text-white',
      'from-emerald-500 to-teal-500 text-white',
      'from-cyan-500 to-blue-500 text-white',
      'from-amber-500 to-orange-500 text-white',
    ]
    let hash = 0
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash)
    }
    const index = Math.abs(hash) % gradients.length
    return gradients[index]
  }

  const getInitials = (name: string) => {
    return name.slice(0, 2)
  }

  // 外側クリック・タップでメニューを閉じる
  useEffect(() => {
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      if (isUserMenuOpen && userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false)
      }
      if (isShopMenuOpen && shopMenuRef.current && !shopMenuRef.current.contains(e.target as Node)) {
        setIsShopMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('touchstart', handleOutside)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('touchstart', handleOutside)
    }
  }, [isUserMenuOpen, isShopMenuOpen])

  const handleLogout = async () => {
    await logout()
    router.push('/login')
  }

  const handleShopSelect = (shop: typeof selectedShop) => {
    if (!shop || shop.id === selectedShop?.id) return
    if (isEditingPage) {
      const ok = window.confirm(
        `編集中のページを離れて「${shop.name}」のホームへ移動しますか？\n\n保存されていない変更は失われます。`
      )
      if (!ok) return
    }
    setSelectedShop(shop)
    setIsShopMenuOpen(false)
    router.push('/shifts')
  }

  const renderShopButton = (shop: typeof selectedShop) => {
    if (!shop || !selectedShop) return null
    const isActive = shop.id === selectedShop.id
    const isPinned = pinnedShopIds.includes(shop.id)
    const gradient = getAvatarGradient(shop.id)
    const initials = getInitials(shop.name)

    return (
      <div
        key={shop.id}
        onClick={() => handleShopSelect(shop)}
        className={`group w-full px-2 py-0.5 sm:px-3 sm:py-1 text-[10px] sm:text-sm font-semibold transition-all flex items-center justify-between rounded-xl cursor-pointer select-none border border-transparent ${
          isActive
            ? 'bg-indigo-50/80 text-indigo-700 shadow-sm border-indigo-100/50'
            : 'text-slate-600 hover:bg-slate-50 hover:text-indigo-600'
        }`}
      >
        <div className="flex items-center min-w-0 flex-1 mr-1.5 sm:mr-2">
          {/* Avatar */}
          <div className={`w-5 h-5 sm:w-7 sm:h-7 flex-shrink-0 flex items-center justify-center rounded bg-gradient-to-br ${gradient} text-[7.5px] sm:text-[10px] font-bold mr-1.5 sm:mr-2 shadow-sm`}>
            {initials}
          </div>
          
          {/* Name & Active Status Indicator */}
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1 sm:gap-1.5">
              <span className="truncate text-slate-800 group-hover:text-indigo-600 font-bold transition-colors text-[9.5px] sm:text-sm">
                {shop.name}
              </span>
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons: Checkmark and Pin Star */}
        <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
          <button
            onClick={(e) => togglePin(shop.id, e)}
            className={`p-1 rounded-lg transition-all focus:outline-none ${
              isPinned
                ? 'text-amber-400 hover:text-amber-500 hover:bg-amber-50'
                : 'text-slate-300 hover:text-amber-400 hover:bg-slate-50 opacity-40 group-hover:opacity-100'
            }`}
            title={isPinned ? 'ピン留め解除' : 'ピン留めする'}
          >
            <svg
              className="w-4 h-4"
              fill={isPinned ? 'currentColor' : 'none'}
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.907c.961 0 1.36 1.253.588 1.81l-3.97 2.883a1 1 0 00-.364 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.971-2.883a1 1 0 00-1.175 0l-3.97 2.883c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.364-1.118L2.98 10.117c-.773-.558-.375-1.81.588-1.81h4.907a1 1 0 00.95-.69l1.519-4.674z"
              />
            </svg>
          </button>

          {isActive && (
            <svg className="w-4 h-4 text-indigo-600 flex-shrink-0 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
      </div>
    )
  }

  if (!user) return null

  // Filter and sort shops
  const filteredShops = shops.filter((shop) => {
    const query = searchQuery.toLowerCase().trim()
    if (!query) return true
    return shop.name.toLowerCase().includes(query)
  })

  const sortedShops = [...filteredShops].sort((a, b) => {
    const aPinned = pinnedShopIds.includes(a.id)
    const bPinned = pinnedShopIds.includes(b.id)
    if (aPinned && !bPinned) return -1
    if (!aPinned && bPinned) return 1
    return 0
  })

  return (
    <div className="flex items-center gap-2 z-50 relative">
      {/* 店舗切り替えメニュー（店舗数が2つ以上の場合のみ表示） */}
      {shops.length > 1 && selectedShop && (
        <div ref={shopMenuRef} className="inline-block text-left z-50">
          <button
            onClick={() => setIsShopMenuOpen(!isShopMenuOpen)}
            className={`inline-flex items-center gap-1 sm:gap-2 px-1.5 py-1 sm:px-3 sm:py-1.5 border rounded-xl text-[10px] sm:text-sm font-bold transition-all focus:outline-none ${
              isShopMenuOpen
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm'
            }`}
            title="店舗切り替え"
          >
            <div className={`w-4 h-4 sm:w-6 sm:h-6 flex-shrink-0 flex items-center justify-center rounded bg-gradient-to-br ${getAvatarGradient(selectedShop.id)} text-[7px] sm:text-[9px] font-bold shadow-sm`}>
              {getInitials(selectedShop.name)}
            </div>
            <span className="truncate max-w-[100px] sm:max-w-[160px]">
              {selectedShop.name}
            </span>
            <svg
              className={`h-3 w-3 sm:h-4 sm:w-4 text-slate-400 transition-transform duration-200 ${isShopMenuOpen ? '-rotate-180 text-indigo-600' : ''}`}
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>

          {isShopMenuOpen && (
            <div className="absolute right-0 top-full mt-2 rounded-2xl shadow-2xl bg-white/95 backdrop-blur-md border border-slate-100/80 focus:outline-none z-50 transform origin-top-right transition-all animate-in fade-in slide-in-from-top-2 overflow-hidden py-1.5 w-64 sm:w-72">
              <div className="px-4 py-2 border-b border-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>店舗の切り替え</span>
                {pinnedShopIds.length > 0 && (
                  <span className="text-[9px] text-amber-500 font-bold bg-amber-50 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                    ★ ピン留め優先
                  </span>
                )}
              </div>

              {/* 検索バー */}
              <div className="px-3 py-2 border-b border-slate-50">
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none">
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="店舗名で検索..."
                    className="w-full pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-150 rounded-xl text-xs font-semibold text-slate-700 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 hover:text-slate-600"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* 店舗リスト */}
              <div className="max-h-[calc(100vh-180px)] sm:max-h-[600px] overflow-y-auto overscroll-behavior-contain py-1.5 px-1.5 flex flex-col gap-0.5">
                {sortedShops.length === 0 ? (
                  <div className="py-8 text-center text-xs font-semibold text-slate-400">
                    一致する店舗が見つかりません
                  </div>
                ) : (
                  sortedShops.map((shop) => renderShopButton(shop))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ユーザーメニュー */}
      <div ref={userMenuRef} className="relative inline-block text-left z-50">
        <button
          onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
          className={`inline-flex items-center gap-2 px-3 py-1.5 border rounded-xl text-sm font-bold transition-all focus:outline-none ${
            isUserMenuOpen
              ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm'
              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm'
          }`}
          title="アカウントメニュー"
        >
          <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold shadow-inner transition-colors flex-shrink-0 ${
            isUserMenuOpen
              ? 'bg-gradient-to-br from-indigo-500 to-violet-500 text-white'
              : 'bg-slate-100 text-slate-600 border border-slate-200'
          }`}>
            {(user.name || user.loginId || '').charAt(0).toUpperCase()}
          </div>
          <span className="truncate max-w-[120px] hidden md:block">{user.name || user.loginId}</span>
          <svg
            className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${isUserMenuOpen ? '-rotate-180 text-indigo-600' : ''} hidden md:block flex-shrink-0`}
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>

        {isUserMenuOpen && (
          <div className="absolute right-0 mt-2.5 w-60 rounded-2xl shadow-xl bg-white/95 backdrop-blur-md border border-slate-100 focus:outline-none z-50 transform origin-top-right transition-all animate-in fade-in slide-in-from-top-2 overflow-hidden flex flex-col">
            <div className="px-4 py-4 bg-slate-50/80 border-b border-slate-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-white flex items-center justify-center text-lg font-bold shadow-inner shrink-0">
                {(user.name || user.loginId || '').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-800 text-sm truncate">{user.name || user.loginId}</p>
                <p className="text-xs font-medium text-indigo-600 mt-0.5">
                  {user.role === 'system_admin' ? 'システム管理者' : 
                   user.role === 'agency_client_owner' ? '代行プラン' : 
                   user.role === 'simple_client_owner' ? 'web予約プラン' : 
                   '代行スタッフ'}
                </p>
              </div>
            </div>

            <div className="p-2 border-t border-slate-100 bg-slate-50/50">
              <button
                onClick={handleLogout}
                className="w-full text-left px-3 py-2 rounded-xl text-sm font-medium text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-colors flex items-center gap-2 group"
              >
                <div className="p-1.5 rounded-lg bg-rose-100/50 text-rose-500 group-hover:bg-rose-200 group-hover:text-rose-600 transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                </div>
                ログアウト
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
