'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

type Shop = {
  id: string
  name: string
  description: string | null
  is_active: boolean
  created_at: string
}

export default function AdminPage() {
  const [shops, setShops] = useState<Shop[]>([])
  const [shopsLoading, setShopsLoading] = useState(true)
  const [showShopForm, setShowShopForm] = useState(false)
  const [editingShop, setEditingShop] = useState<Shop | null>(null)
  const [shopFormData, setShopFormData] = useState({
    name: '',
    description: '',
    is_active: true,
  })

  useEffect(() => {
    fetchShops()
  }, [])

  const fetchShops = async () => {
    try {
      const { data, error } = await supabase
        .from('shops')
        .select('*')
        .order('name', { ascending: true })

      if (error) throw error
      setShops(data || [])
    } catch (error) {
      console.error('店舗の取得に失敗:', error)
      alert('店舗の取得に失敗しました')
    } finally {
      setShopsLoading(false)
    }
  }

  const handleShopSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      if (editingShop) {
        const { error } = await supabase
          .from('shops')
          .update({
            ...shopFormData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingShop.id)

        if (error) throw error
        alert('店舗を更新しました')
      } else {
        const { error } = await supabase
          .from('shops')
          .insert([
            {
              ...shopFormData,
            },
          ])

        if (error) throw error
        alert('店舗を登録しました')
      }

      resetShopForm()
      fetchShops()
    } catch (error) {
      console.error('保存に失敗:', error)
      alert('保存に失敗しました')
    }
  }

  const handleShopEdit = (shop: Shop) => {
    setEditingShop(shop)
    setShopFormData({
      name: shop.name,
      description: shop.description || '',
      is_active: shop.is_active,
    })
    setShowShopForm(true)
  }

  const handleShopDelete = async (id: string) => {
    if (!confirm('本当に削除しますか？')) return

    try {
      const { error } = await supabase
        .from('shops')
        .delete()
        .eq('id', id)

      if (error) throw error
      alert('店舗を削除しました')
      fetchShops()
    } catch (error) {
      console.error('削除に失敗:', error)
      alert('削除に失敗しました')
    }
  }

  const resetShopForm = () => {
    setShopFormData({
      name: '',
      description: '',
      is_active: true,
    })
    setEditingShop(null)
    setShowShopForm(false)
  }

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 md:p-8">
      <div className="mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">管理者ページ</h1>
          <p className="text-sm text-slate-500 mt-1">システムに登録されている全店舗の管理・追加を行います。</p>
        </div>

        <div className="space-y-8">
          {/* 店舗管理セクション */}
          <div className="animate-in fade-in duration-300">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-800">店舗一覧</h2>
              <button
                onClick={() => setShowShopForm(!showShopForm)}
                className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl shadow-sm hover:bg-indigo-700 hover:shadow transition-all active:scale-95"
              >
                {showShopForm ? (
                  <span className="flex items-center gap-1.5"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>キャンセル</span>
                ) : (
                  <span className="flex items-center gap-1.5"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>新しい店舗を登録</span>
                )}
              </button>
            </div>

            {/* 店舗登録・編集フォーム */}
            {showShopForm && (
              <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-100 mb-8 border-t-4 border-t-indigo-500">
                <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1v1H9V7zm5 0h1v1h-1V7zm-5 4h1v1H9v-1zm5 0h1v1h-1v-1zm-3 4H2v1h11v-1zm0-4h-1v1h1v-1z" />
                    </svg>
                  </span>
                  {editingShop ? '店舗情報の編集' : '新しい店舗を登録'}
                </h3>
                <form onSubmit={handleShopSubmit} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">店舗名</label>
                    <input
                      type="text"
                      value={shopFormData.name}
                      onChange={(e) => setShopFormData({ ...shopFormData, name: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all text-slate-800 font-medium"
                      placeholder="例: 新宿本店"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">説明</label>
                    <textarea
                      value={shopFormData.description}
                      onChange={(e) => setShopFormData({ ...shopFormData, description: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all text-slate-800"
                      rows={3}
                      placeholder="店舗の詳細情報やメモ（任意）"
                    />
                  </div>

                  <div className="pt-2">
                    <label className="flex items-center space-x-3 cursor-pointer group w-fit">
                      <div className="relative flex items-center">
                        <input
                          type="checkbox"
                          checked={shopFormData.is_active}
                          onChange={(e) => setShopFormData({ ...shopFormData, is_active: e.target.checked })}
                          className="peer sr-only"
                        />
                        <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600 transition-colors"></div>
                      </div>
                      <span className="text-sm font-bold text-slate-700 select-none group-hover:text-indigo-600 transition-colors">{shopFormData.is_active ? '営業中（有効）' : '休業中（無効）'}</span>
                    </label>
                  </div>

                  <div className="flex gap-3 pt-5 mt-2 border-t border-slate-100 justify-end">
                    <button
                      type="button"
                      onClick={resetShopForm}
                      className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 font-medium rounded-xl hover:bg-slate-50 transition-colors"
                    >
                      キャンセル
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-xl shadow-sm hover:bg-indigo-700 hover:shadow transition-all active:scale-95 flex items-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      {editingShop ? '更新する' : '登録する'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* 店舗一覧 */}
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
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">店舗名</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider hidden sm:table-cell">説明</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">状態</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {shops.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                            店舗が登録されていません。上のボタンから追加してください。
                          </td>
                        </tr>
                      ) : (
                        shops.map((shop) => (
                          <tr key={shop.id} className={`hover:bg-slate-50/50 hover:-translate-y-[1px] hover:shadow-sm transition-all ${!shop.is_active ? 'opacity-60 bg-slate-50/30' : ''}`}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${shop.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                                {shop.name}
                              </div>
                              {/* モバイルのみ説明文を表示 */}
                              {shop.description && (
                                <div className="text-xs text-slate-500 mt-1 line-clamp-1 sm:hidden ml-4">{shop.description}</div>
                              )}
                            </td>
                            <td className="px-6 py-4 hidden sm:table-cell">
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
                                  onClick={() => handleShopEdit(shop)}
                                  className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-1"
                                  title="編集"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                                  <span className="hidden md:inline font-medium">編集</span>
                                </button>
                                <button
                                  onClick={() => handleShopDelete(shop.id)}
                                  className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors flex items-center gap-1"
                                  title="削除"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
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
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <div>
                <h3 className="font-bold text-indigo-900 mb-1.5">システムの構成について</h3>
                <ul className="text-sm text-indigo-800/80 space-y-1.5 font-medium">
                  <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div>新しい店舗を登録すると、右上のセレクターから切り替え可能になります。</li>
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
