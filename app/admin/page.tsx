'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Shop = {
  id: string
  name: string
  short_name: string | null
  description: string | null
  is_active: boolean
  created_at: string
  order: number | null
}

export default function AdminPage() {
  const router = useRouter()
  const [shops, setShops] = useState<Shop[]>([])
  const [shopsLoading, setShopsLoading] = useState(true)
  const [draggedId, setDraggedId] = useState<string | null>(null)

  useEffect(() => {
    fetchShops()
  }, [])

  const fetchShops = async () => {
    try {
      const { data, error } = await supabase
        .from('shops')
        .select('*')
        .order('order', { ascending: true, nullsFirst: false })

      if (error) throw error
      setShops(data || [])
    } catch (error) {
      console.error('店舗の取得に失敗:', error)
      alert('店舗の取得に失敗しました')
    } finally {
      setShopsLoading(false)
    }
  }

  const handleDragStart = (e: React.DragEvent<HTMLTableRowElement>, shopId: string) => {
    setDraggedId(shopId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragEnd = () => {
    setDraggedId(null)
  }

  const handleDragOver = (e: React.DragEvent<HTMLTableRowElement>) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = async (e: React.DragEvent<HTMLTableRowElement>, targetShop: Shop) => {
    e.preventDefault()
    if (!draggedId || draggedId === targetShop.id) {
      setDraggedId(null)
      return
    }

    const draggedIndex = shops.findIndex((s) => s.id === draggedId)
    const targetIndex = shops.findIndex((s) => s.id === targetShop.id)
    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedId(null)
      return
    }

    const newShops = [...shops]
    const [draggedItem] = newShops.splice(draggedIndex, 1)
    newShops.splice(targetIndex, 0, draggedItem)
    setShops(newShops)

    for (let i = 0; i < newShops.length; i++) {
      await supabase.from('shops').update({ order: i }).eq('id', newShops[i].id)
    }

    setDraggedId(null)
  }

  const handleShopDelete = async (id: string) => {
    if (!confirm('本当に削除しますか？')) return

    try {
      const { error } = await supabase.from('shops').delete().eq('id', id)
      if (error) throw error
      fetchShops()
    } catch (error) {
      console.error('削除に失敗:', error)
      alert('削除に失敗しました')
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6 md:p-8">
      <div className="mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">管理者ページ</h1>
          <p className="text-sm text-slate-500 mt-1">システムに登録されている全店舗の管理・追加を行います。</p>
        </div>

        <div className="space-y-8">
          <div className="animate-in fade-in duration-300">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-800">店舗一覧</h2>
              <button
                onClick={() => router.push('/admin/shops/new')}
                className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl shadow-sm hover:bg-indigo-700 hover:shadow transition-all active:scale-95 flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                新しい店舗を登録
              </button>
            </div>

            {shopsLoading ? (
              <div className="flex justify-center items-center py-20 text-indigo-600">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                <span className="ml-3 font-medium">読み込み中...</span>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="w-10 px-3 py-4"></th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">店舗名</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider hidden sm:table-cell">略称</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider hidden md:table-cell">説明</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">状態</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {shops.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                            店舗が登録されていません。上のボタンから追加してください。
                          </td>
                        </tr>
                      ) : (
                        shops.map((shop) => (
                          <tr
                            key={shop.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, shop.id)}
                            onDragEnd={handleDragEnd}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, shop)}
                            className={`transition-all group ${
                              draggedId === shop.id
                                ? 'opacity-40 bg-indigo-50/60 border-dashed'
                                : 'hover:bg-slate-50/50'
                            } ${!shop.is_active ? 'opacity-60' : ''}`}
                          >
                            <td className="px-3 py-4 w-10">
                              <div className="flex items-center justify-center text-slate-300 group-hover:text-indigo-400 transition-colors cursor-grab active:cursor-grabbing">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                                </svg>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${shop.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                                {shop.name}
                              </div>
                            </td>
                            <td className="px-6 py-4 hidden sm:table-cell whitespace-nowrap">
                              {shop.short_name
                                ? <span className="text-sm font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg">{shop.short_name}</span>
                                : <span className="text-slate-400 italic text-sm">未設定</span>
                              }
                            </td>
                            <td className="px-6 py-4 hidden md:table-cell">
                              <div className="text-sm text-slate-600 line-clamp-2">{shop.description || <span className="text-slate-400 italic">説明なし</span>}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${shop.is_active
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                : 'bg-slate-100 border-slate-200 text-slate-600'
                              }`}>
                                {shop.is_active ? '営業中' : '休止中'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => router.push(`/admin/shops/${shop.id}/edit`)}
                                  className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-1"
                                  title="編集"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                  <span className="hidden md:inline font-medium">編集</span>
                                </button>
                                <button
                                  onClick={() => handleShopDelete(shop.id)}
                                  className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                                  title="削除"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="mt-8 p-5 bg-indigo-50/80 border border-indigo-100 rounded-2xl flex gap-4 items-start">
              <div className="bg-white p-2 rounded-xl text-indigo-600 shadow-sm shrink-0">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-indigo-900 mb-1.5">システムの構成について</h3>
                <ul className="text-sm text-indigo-800/80 space-y-1.5 font-medium">
                  <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div>新しい店舗を登録すると、画面下部のタブから切り替え可能になります。</li>
                  <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div>各店舗のデータ（セラピスト、顧客、コース、オプション、指名料）は完全に独立して管理されます。</li>
                  <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div>「営業中」に設定されている店舗のみが操作可能です。</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
