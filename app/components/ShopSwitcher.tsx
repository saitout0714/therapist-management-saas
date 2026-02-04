'use client'

import { useShop } from '@/app/contexts/ShopContext'
import { useAuth } from '@/app/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function ShopSwitcher() {
  const { shops, selectedShop, setSelectedShop } = useShop()
  const { user, logout } = useAuth()
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
    router.push('/login')
  }

  return (
    <div className="flex items-center space-x-4">
      {/* 店舗切り替え */}
      {selectedShop && shops.length > 1 && (
        <div className="relative inline-block text-left">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="inline-flex items-center justify-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
          >
            <span className="truncate max-w-[150px]">{selectedShop.name}</span>
            <svg
              className={`ml-2 -mr-1 h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
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
            <div className="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 divide-y divide-gray-100 focus:outline-none z-50">
              <div className="px-4 py-3 text-sm text-gray-700 font-semibold">店舗を選択</div>
              <div className="py-1">
                {shops.map((shop) => (
                  <button
                    key={shop.id}
                    onClick={() => {
                      setSelectedShop(shop)
                      setIsOpen(false)
                    }}
                    className={`w-full text-left px-4 py-2 text-sm ${
                      selectedShop.id === shop.id
                        ? 'bg-blue-100 text-blue-900 font-semibold'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{shop.name}</span>
                      {selectedShop.id === shop.id && (
                        <svg className="h-4 w-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {isOpen && <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />}
        </div>
      )}

      {/* ユーザーメニュー */}
      {user && (
        <div className="relative inline-block text-left">
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="inline-flex items-center justify-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
          >
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold mr-2">
              {user.email.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm truncate max-w-[120px]">{user.email}</span>
            <svg
              className={`ml-2 -mr-1 h-4 w-4 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`}
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
            <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
              <div className="px-4 py-3 text-sm text-gray-700">
                <p className="font-semibold">{user.email}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {user.role === 'admin' ? '管理者' : 'オーナー'}
                </p>
              </div>
              <div className="border-t border-gray-100 py-1">
                <button
                  onClick={() => {
                    setIsUserMenuOpen(false)
                    router.push('/settings')
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  設定
                </button>
              </div>
              <div className="border-t border-gray-100 py-1">
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  ログアウト
                </button>
              </div>
            </div>
          )}

          {isUserMenuOpen && <div className="fixed inset-0 z-40" onClick={() => setIsUserMenuOpen(false)} />}
        </div>
      )}
    </div>
  )
}
