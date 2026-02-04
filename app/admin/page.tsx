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
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">管理者ページ</h1>

      <div className="space-y-8">
        {/* 店舗管理セクション */}
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">店舗管理</h2>
            <button
              onClick={() => setShowShopForm(!showShopForm)}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              {showShopForm ? 'キャンセル' : '新規登録'}
            </button>
          </div>

          {/* 店舗登録・編集フォーム */}
          {showShopForm && (
            <div className="bg-white p-6 rounded-lg shadow-md mb-6">
              <h3 className="text-lg font-semibold mb-4">
                {editingShop ? '店舗編集' : '店舗新規登録'}
              </h3>
              <form onSubmit={handleShopSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">店舗名</label>
                  <input
                    type="text"
                    value={shopFormData.name}
                    onChange={(e) => setShopFormData({ ...shopFormData, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">説明</label>
                  <textarea
                    value={shopFormData.description}
                    onChange={(e) => setShopFormData({ ...shopFormData, description: e.target.value })}
                    className="w-full px-3 py-2 border rounded"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={shopFormData.is_active}
                      onChange={(e) => setShopFormData({ ...shopFormData, is_active: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <span className="text-sm font-medium">営業中（有効）</span>
                  </label>
                </div>

                <div className="flex space-x-2">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                  >
                    {editingShop ? '更新' : '登録'}
                  </button>
                  <button
                    type="button"
                    onClick={resetShopForm}
                    className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
                  >
                    キャンセル
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* 店舗一覧 */}
          {shopsLoading ? (
            <div className="text-center text-gray-500">読み込み中...</div>
          ) : (
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">店舗名</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">説明</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">状態</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {shops.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                        店舗が登録されていません
                      </td>
                    </tr>
                  ) : (
                    shops.map((shop) => (
                      <tr key={shop.id} className={!shop.is_active ? 'bg-gray-100' : ''}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{shop.name}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-500">{shop.description || '-'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            shop.is_active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {shop.is_active ? '営業中' : '休止中'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                          <button
                            onClick={() => handleShopEdit(shop)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            編集
                          </button>
                          <button
                            onClick={() => handleShopDelete(shop.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            削除
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded">
            <h3 className="font-semibold text-blue-900 mb-2">💡 情報</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• 新しい店舗を登録すると、ShopSwitcherに表示されます</li>
              <li>• 各店舗のセラピスト、顧客、コース、オプション、指名料はすべて独立しています</li>
              <li>• 営業中に設定すると、その店舗を管理画面から切り替えられます</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
