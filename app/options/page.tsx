'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useShop } from '@/app/contexts/ShopContext'

type Option = {
  id: string
  name: string
  duration: number
  price: number
  description: string | null
  is_active: boolean
  display_order: number
  created_at: string
}

export default function OptionsPage() {
  const { selectedShop } = useShop()
  const [options, setOptions] = useState<Option[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingOption, setEditingOption] = useState<Option | null>(null)

  // フォームの状態
  const [formData, setFormData] = useState({
    name: '',
    duration: 0,
    price: 0,
    description: '',
    is_active: true,
    display_order: 0,
  })

  useEffect(() => {
    fetchOptions()
  }, [selectedShop])

  const fetchOptions = async () => {
    try {
      if (!selectedShop) return
      const { data, error } = await supabase
        .from('options')
        .select('*')
        .eq('shop_id', selectedShop.id)
        .order('display_order', { ascending: true })

      if (error) throw error
      setOptions(data || [])
    } catch (error) {
      console.error('オプションの取得に失敗:', error)
      alert('オプションの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      if (editingOption) {
        // 更新
        const { error } = await supabase
          .from('options')
          .update({
            ...formData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingOption.id)

        if (error) throw error
        alert('オプションを更新しました')
      } else {
        if (!selectedShop) {
          alert('店舗を選択してください')
          return
        }
        // 新規作成
        const { error } = await supabase
          .from('options')
          .insert([
            {
              ...formData,
              shop_id: selectedShop.id,
            },
          ])

        if (error) throw error
        alert('オプションを登録しました')
      }

      resetForm()
      fetchOptions()
    } catch (error) {
      console.error('保存に失敗:', error)
      alert('保存に失敗しました')
    }
  }

  const handleEdit = (option: Option) => {
    setEditingOption(option)
    setFormData({
      name: option.name,
      duration: option.duration,
      price: option.price,
      description: option.description || '',
      is_active: option.is_active,
      display_order: option.display_order,
    })
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('本当に削除しますか？')) return

    try {
      const { error } = await supabase
        .from('options')
        .delete()
        .eq('id', id)

      if (error) throw error
      alert('オプションを削除しました')
      fetchOptions()
    } catch (error) {
      console.error('削除に失敗:', error)
      alert('削除に失敗しました')
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      duration: 0,
      price: 0,
      description: '',
      is_active: true,
      display_order: 0,
    })
    setEditingOption(null)
    setShowForm(false)
  }

  if (loading) {
    return <div className="p-4 md:p-8">読み込み中...</div>
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">オプション管理</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-5 py-2.5 bg-indigo-600 text-white font-medium rounded-xl shadow-sm hover:bg-indigo-700 hover:shadow transition-all active:scale-95"
        >
          {showForm ? 'キャンセル' : '新規登録'}
        </button>
      </div>

      {/* 登録・編集フォーム */}
      {showForm && (
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-100 mb-8 border-t-4 border-t-indigo-500">
          <h2 className="text-xl font-bold text-slate-800 mb-6">
            {editingOption ? 'オプション編集' : 'オプション新規登録'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">オプション名</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border rounded"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">追加時間（分）</label>
                <input
                  type="number"
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border rounded"
                  min="0"
                  step="5"
                />
                <p className="text-xs text-gray-500 mt-1">0分の場合は時間追加なし</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">料金（円）</label>
                <input
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border rounded"
                  min="0"
                  step="100"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">説明</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border rounded"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">表示順</label>
                <input
                  type="number"
                  value={formData.display_order}
                  onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border rounded"
                  min="0"
                />
              </div>

              <div>
                <label className="flex items-center space-x-2 mt-7">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium">有効</span>
                </label>
              </div>
            </div>

            <div className="flex space-x-3 pt-4 border-t border-slate-100">
              <button
                type="submit"
                className="px-5 py-2.5 bg-emerald-500 text-white font-medium rounded-xl shadow-sm hover:bg-emerald-600 hover:shadow transition-all active:scale-95"
              >
                {editingOption ? '更新' : '登録'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-5 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-xl hover:bg-slate-200 transition-all active:scale-95"
              >
                キャンセル
              </button>
            </div>
          </form>
        </div>
      )}

      {/* オプション一覧 */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-max text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">順序</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">オプション名</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">追加時間</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">料金</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">状態</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider w-32">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {options.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    オプションが登録されていません
                  </td>
                </tr>
              ) : (
                options.map((option) => (
                  <tr key={option.id} className={`border-b border-slate-50 hover:bg-slate-50/80 transition-colors ${!option.is_active ? 'opacity-60' : ''}`}>
                    <td className="px-6 py-5 whitespace-nowrap text-sm text-slate-500">{option.display_order}</td>
                    <td className="px-6 py-5">
                      <div className="text-sm font-bold text-slate-800">{option.name}</div>
                      {option.description && (
                        <div className="text-sm text-slate-500 mt-1">{option.description}</div>
                      )}
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap text-sm text-slate-700 font-medium">
                      {option.duration > 0 ? `+${option.duration}分` : '-'}
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap text-sm text-slate-700 font-medium">¥{option.price.toLocaleString()}</td>
                    <td className="px-6 py-5 whitespace-nowrap">
                      <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${option.is_active
                        ? 'bg-emerald-100 text-emerald-700 border border-emerald-200/50'
                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}>
                        {option.is_active ? '有効' : '無効'}
                      </span>
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap text-sm space-x-3">
                      <button
                        onClick={() => handleEdit(option)}
                        className="text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
                      >
                        編集
                      </button>
                      <button
                        onClick={() => handleDelete(option.id)}
                        className="text-rose-500 hover:text-rose-700 font-medium transition-colors"
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
      </div>
    </div>
  )
}
