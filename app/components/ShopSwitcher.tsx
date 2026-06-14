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

  const userMenuRef = useRef<HTMLDivElement>(null)
  const shopMenuRef = useRef<HTMLDivElement>(null)

  const isEditingPage = /\/(edit|new)(\/|$)/.test(pathname ?? '')

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

  if (!user) return null

  return (
    <div className="flex items-center gap-3 z-50">
      {/* 店舗切り替えメニュー（店舗数が2つ以上の場合のみ表示） */}
      {shops.length > 1 && selectedShop && (
        <div ref={shopMenuRef} className="relative inline-block text-left z-50">
          <button
            onClick={() => setIsShopMenuOpen(!isShopMenuOpen)}
            className={`inline-flex items-center gap-2 px-3 py-1.5 border rounded-xl text-sm font-bold transition-all focus:outline-none ${
              isShopMenuOpen
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm'
            }`}
            title="店舗切り替え"
          >
            <svg className="w-4 h-4 text-indigo-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
            </svg>
            <span className="truncate max-w-[100px] sm:max-w-[160px]">
              {selectedShop.short_name || selectedShop.name}
            </span>
            <svg
              className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${isShopMenuOpen ? '-rotate-180 text-indigo-600' : ''}`}
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>

          {isShopMenuOpen && (
            <div className={`absolute right-0 mt-2 rounded-2xl shadow-xl bg-white border border-slate-100 focus:outline-none z-50 transform origin-top-right transition-all animate-in fade-in slide-in-from-top-2 overflow-hidden py-1.5 ${
              shops.length > 5 ? 'w-64 sm:w-[400px]' : 'w-56'
            }`}>
              <div className="px-4 py-2 border-b border-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                店舗の切り替え
              </div>
              <div className={`max-h-[400px] overflow-y-auto py-1 ${
                shops.length > 5 ? 'grid grid-cols-1 sm:grid-cols-2 gap-1 px-2' : ''
              }`}>
                {shops.map((shop) => {
                  const isActive = shop.id === selectedShop.id
                  return (
                    <button
                      key={shop.id}
                      onClick={() => handleShopSelect(shop)}
                      className={`w-full text-left px-3 py-2 text-sm font-semibold transition-colors flex items-center justify-between rounded-xl ${
                        isActive
                          ? 'bg-indigo-50 text-indigo-700'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-indigo-600'
                      }`}
                    >
                      <span className="truncate">{shop.name}</span>
                      {isActive && (
                        <svg className="w-4 h-4 text-indigo-600 flex-shrink-0 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ユーザーメニュー */}
      <div ref={userMenuRef} className="relative inline-block text-left z-50">
        <button
          onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
          className={`inline-flex items-center justify-center p-1 md:px-3 md:py-1.5 border rounded-full md:rounded-xl text-sm font-medium transition-all focus:outline-none ${isUserMenuOpen ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm'}`}
          title="アカウントメニュー"
        >
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shadow-inner ${isUserMenuOpen ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 border border-slate-200'} transition-colors`}>
            {(user.name || user.loginId || '').charAt(0).toUpperCase()}
          </div>
          <span className="text-sm font-bold truncate max-w-[120px] hidden md:block ml-2">{user.name || user.loginId}</span>
          <svg
            className={`ml-1 mr-1 h-4 w-4 hidden md:block transition-transform duration-200 ${isUserMenuOpen ? '-rotate-180 text-indigo-600' : 'text-slate-400'}`}
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
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
