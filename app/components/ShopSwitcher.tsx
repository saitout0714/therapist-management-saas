'use client'

import { useShop } from '@/app/contexts/ShopContext'
import { useAuth } from '@/app/contexts/AuthContext'
import { useRouter, usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'

export default function ShopSwitcher() {
  const { shops, selectedShop, setSelectedShop } = useShop()
  const { user, logout } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)

  // 作業中ページかどうか（編集・新規作成）
  const isEditingPage = /\/(edit|new)(\/|$)/.test(pathname ?? '')

  // ドロップダウンが開いている間、背後のページスクロールをロック
  useEffect(() => {
    const anyOpen = isOpen || isUserMenuOpen
    if (anyOpen) {
      document.body.style.overflow = 'hidden'
      document.body.style.touchAction = 'none'
    } else {
      document.body.style.overflow = ''
      document.body.style.touchAction = ''
    }
    return () => {
      document.body.style.overflow = ''
      document.body.style.touchAction = ''
    }
  }, [isOpen, isUserMenuOpen])

  const handleShopSelect = (shop: typeof selectedShop) => {
    if (!shop || shop.id === selectedShop?.id) {
      setIsOpen(false)
      return
    }

    if (isEditingPage) {
      const ok = window.confirm(
        `編集中のページを離れて「${shop!.name}」のダッシュボードへ移動しますか？\n\n保存されていない変更は失われます。`
      )
      if (!ok) return
    }

    setSelectedShop(shop)
    setIsOpen(false)
    router.push('/shifts')
  }

  const handleLogout = async () => {
    await logout()
    router.push('/login')
  }

  return (
    <div className="flex items-center gap-3 md:gap-4 z-50">
      {/* 店舗切り替え */}
      {selectedShop && shops.length > 1 && (
        <div className="relative inline-block text-left">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className={`inline-flex items-center justify-center px-3 py-2 md:px-4 md:py-2 border rounded-xl text-sm font-bold transition-all focus:outline-none ${isOpen ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-sm'}`}
          >
            <svg className="w-4 h-4 mr-2 text-indigo-500 hidden md:block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1v1H9V7zm5 0h1v1h-1V7zm-5 4h1v1H9v-1zm5 0h1v1h-1v-1zm-3 4H2v1h11v-1zm0-4h-1v1h1v-1z" />
            </svg>
            <span className="truncate max-w-[100px] md:max-w-[150px]">{selectedShop.name}</span>
            <svg
              className={`ml-2 -mr-1 h-4 w-4 transition-transform duration-200 ${isOpen ? '-rotate-180 text-indigo-600' : 'text-slate-400'}`}
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

          {isOpen && (
            <div className="absolute right-0 mt-2.5 w-64 rounded-2xl shadow-xl bg-white/95 backdrop-blur-md border border-slate-100 focus:outline-none z-50 transform origin-top-right transition-all animate-in fade-in slide-in-from-top-2 p-1">
              <div className="px-3 py-2.5 mb-1 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 flex items-center justify-between">
                店舗を切り替え
                <span className="bg-slate-100 text-slate-500 py-0.5 px-2 rounded-full text-[10px]">{shops.length} 店舗</span>
              </div>
              <div className="py-1 space-y-0.5 max-h-60 overflow-y-auto overscroll-contain custom-scrollbar" style={{ touchAction: 'pan-y' }}>
                {shops.map((shop) => (
                  <button
                    key={shop.id}
                    onClick={() => handleShopSelect(shop)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-colors border border-transparent ${selectedShop.id === shop.id
                      ? 'bg-indigo-50 border-indigo-100 text-indigo-700 shadow-sm'
                      : 'text-slate-700 hover:bg-slate-50 hover:border-slate-100'
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${selectedShop.id === shop.id ? 'bg-indigo-500' : 'bg-slate-300'}`}></div>
                        <span className="truncate">{shop.name}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {isOpen && <div className="fixed inset-0 z-40 cursor-pointer" onClick={() => setIsOpen(false)} />}
        </div>
      )}

      {/* ユーザーメニュー */}
      {user && (
        <div className="relative inline-block text-left z-50">
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className={`inline-flex items-center justify-center p-1 md:px-3 md:py-1.5 border rounded-full md:rounded-xl text-sm font-medium transition-all focus:outline-none ${isUserMenuOpen ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm'}`}
            title="アカウントメニュー"
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shadow-inner ${isUserMenuOpen ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 border border-slate-200'} transition-colors`}>
              {user.loginId?.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm font-bold truncate max-w-[120px] hidden md:block ml-2">{user.loginId}</span>
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
                  {user.loginId?.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-800 text-sm truncate">{user.loginId}</p>
                  <p className="text-xs font-medium text-indigo-600 mt-0.5">
                    {user.role === 'admin' ? 'システム管理者' : '店舗オーナー'}
                  </p>
                </div>
              </div>
              <div className="p-2 space-y-1">
                <button
                  onClick={() => {
                    setIsUserMenuOpen(false)
                    router.push('/settings')
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition-colors flex items-center gap-2 group"
                >
                  <div className="p-1.5 rounded-lg bg-slate-100 text-slate-500 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  </div>
                  アカウント設定
                </button>
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

          {isUserMenuOpen && <div className="fixed inset-0 z-40 cursor-pointer" onClick={() => setIsUserMenuOpen(false)} />}
        </div>
      )}
    </div>
  )
}
