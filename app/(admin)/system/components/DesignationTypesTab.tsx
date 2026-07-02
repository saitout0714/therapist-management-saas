'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useShop } from '@/app/contexts/ShopContext'

type DesignationType = {
  id: string
  slug: string
  display_name: string
  display_order: number
  is_active: boolean
  default_fee: number
  default_back_amount: number
}

const SYSTEM_SLUGS = ['free', 'first_nomination', 'confirmed']

const DEFAULT_DESIGNATION_TYPES = [
  { slug: 'free', display_name: 'フリー', display_order: 0, default_fee: 0, default_back_amount: 0, is_active: true },
  { slug: 'first_nomination', display_name: '初回指名', display_order: 1, default_fee: 0, default_back_amount: 0, is_active: true },
  { slug: 'confirmed', display_name: '本指名', display_order: 2, default_fee: 0, default_back_amount: 0, is_active: true },
]

export function DesignationTypesTab() {
  const { selectedShop } = useShop()
  const [items, setItems] = useState<DesignationType[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  const [form, setForm] = useState({
    slug: '',
    display_name: '',
    display_order: 0,
    is_active: true,
    default_fee: 0,
    default_back_amount: 0,
  })

  // スラッグ生成ヘルパー（重複回避機能付き）
  const generateSlug = (name: string, existingItems: DesignationType[]): string => {
    const mapping: Record<string, string> = {
      'フリー': 'free',
      '指名': 'nomination',
      '本指名': 'confirmed',
      '初回指名': 'first_nomination',
      '初回': 'first',
      '姫予約': 'princess',
      '姫': 'princess',
      '延長': 'extension',
    }

    let baseSlug = ''

    // 完全一致マッピングがあれば優先
    if (mapping[name]) {
      baseSlug = mapping[name]
    } else {
      // 英数字を抽出
      const alphaNum = name.toLowerCase().replace(/[^a-z0-9]/g, '')
      if (alphaNum.length >= 3) {
        baseSlug = alphaNum
      } else {
        // 日本語メインの場合は、意味を持たせないランダムID
        baseSlug = 'type_' + Math.random().toString(36).substring(2, 7)
      }
    }

    // 重複チェックと末尾番号の付与
    let slug = baseSlug
    let counter = 1
    const existingSlugs = existingItems.map(item => item.slug)

    while (existingSlugs.includes(slug)) {
      counter++
      slug = `${baseSlug}_${counter}`
    }

    return slug
  }

  const fetchItems = async () => {
    if (!selectedShop) { setItems([]); setLoading(false); return }
    setLoading(true)
    const { data, error } = await supabase
      .from('designation_types')
      .select('*')
      .eq('shop_id', selectedShop.id)
      .order('display_order')
    if (error) { alert('読み込みに失敗しました'); setLoading(false); return }

    // システムデフォルト3種（フリー・初回指名・本指名）が未登録なら自動追加
    const existingSlugs = (data || []).map((d: DesignationType) => d.slug)
    const missing = DEFAULT_DESIGNATION_TYPES.filter(d => !existingSlugs.includes(d.slug))
    if (missing.length > 0) {
      await supabase.from('designation_types').upsert(
        missing.map(d => ({ ...d, shop_id: selectedShop.id })),
        { onConflict: 'shop_id, slug' }
      )
      // 再取得
      const { data: refetched } = await supabase
        .from('designation_types')
        .select('*')
        .eq('shop_id', selectedShop.id)
        .order('display_order')
      setItems((refetched || []) as DesignationType[])
    } else {
      setItems((data || []) as DesignationType[])
    }
    setLoading(false)
  }

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return

    const newItems = [...items]
    const draggedItem = newItems[draggedIndex]
    newItems.splice(draggedIndex, 1)
    newItems.splice(index, 0, draggedItem)

    setDraggedIndex(index)
    setItems(newItems)
  }

  const handleDragEnd = async () => {
    setDraggedIndex(null)
    if (!selectedShop) return

    // Optimistically update display_order in local state
    const updated = items.map((item, idx) => ({ ...item, display_order: idx }))
    setItems(updated)

    const promises = items.map((item, idx) =>
      supabase.from('designation_types').update({ display_order: idx, updated_at: new Date().toISOString() }).eq('id', item.id)
    )
    const results = await Promise.all(promises)
    const hasError = results.some(r => r.error)
    if (hasError) {
      alert('並び替え順の保存に失敗しました')
      void fetchItems()
    }
  }

  useEffect(() => { void fetchItems() }, [selectedShop])

  const resetForm = () => {
    setEditingId(null)
    setForm({
      slug: '',
      display_name: '',
      display_order: items.length,
      is_active: true,
      default_fee: 0,
      default_back_amount: 0,
    })
    setShowForm(false)
  }

  const handleEdit = (item: DesignationType) => {
    setEditingId(item.id)
    setForm({
      slug: item.slug,
      display_name: item.display_name,
      display_order: item.display_order,
      is_active: item.is_active,
      default_fee: item.default_fee || 0,
      default_back_amount: item.default_back_amount || 0,
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!selectedShop) return
    if (!form.slug || !form.display_name) { alert('種別名は必須です'); return }

    if (editingId) {
      const { error } = await supabase.from('designation_types').update({
        ...form,
        updated_at: new Date().toISOString(),
      }).eq('id', editingId)
      if (error) { alert('更新に失敗しました: ' + error.message); return }
    } else {
      const { error } = await supabase.from('designation_types').insert([{
        ...form,
        shop_id: selectedShop.id,
      }])
      if (error) { alert('追加に失敗しました: ' + error.message); return }
    }

    resetForm()
    void fetchItems()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('この指名種別を削除しますか？')) return
    const { error } = await supabase.from('designation_types').delete().eq('id', id)
    if (error) { alert('削除に失敗しました'); return }
    void fetchItems()
  }

  if (loading) return <div className="text-center py-10 text-slate-500">読み込み中...</div>

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 md:p-5">
      {showForm ? (
        <form onSubmit={(e) => { e.preventDefault(); void handleSave() }} className="space-y-6">
          {/* Header Bar */}
          <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
            <button
              type="button"
              onClick={resetForm}
              className="p-2 -ml-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              title="一覧に戻る"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div>
              <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-bold ${
                editingId ? 'bg-indigo-100 text-indigo-800' : 'bg-emerald-100 text-emerald-800'
              }`}>
                {editingId ? '編集選択中' : '新規登録'}
              </span>
              <h3 className="text-lg font-bold text-slate-800 mt-1">
                {editingId ? `「${form.display_name}」の編集` : '新規指名種別登録'}
              </h3>
            </div>
          </div>

          {/* Form Body */}
          <div className="space-y-6 max-w-2xl">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-600">種別名</label>
              <input
                type="text"
                value={form.display_name}
                onChange={e => {
                  const name = e.target.value
                  const newForm = { ...form, display_name: name }
                  if (!editingId) {
                    newForm.slug = generateSlug(name, items)
                  }
                  setForm(newForm)
                }}
                placeholder="例: 本指名"
                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500/50 outline-none"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600">デフォルト料金</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">¥</span>
                  <input
                    type="number"
                    value={form.default_fee}
                    onChange={e => setForm({ ...form, default_fee: Number(e.target.value) })}
                    className="w-full border border-slate-200 rounded-lg pl-8 pr-4 py-2.5 bg-white text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none font-bold"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-indigo-700">デフォルトバック額</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400 text-sm font-bold">¥</span>
                  <input
                    type="number"
                    value={form.default_back_amount}
                    onChange={e => setForm({ ...form, default_back_amount: Number(e.target.value) })}
                    className="w-full border border-indigo-200 rounded-lg pl-8 pr-4 py-2.5 bg-indigo-50/50 focus:ring-2 focus:ring-indigo-500/50 outline-none text-sm font-bold text-indigo-800"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center">
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={e => setForm({ ...form, is_active: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                  有効にする
                </label>
              </div>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="pt-6 border-t border-slate-100 flex gap-3 max-w-2xl">
            <button
              type="button"
              onClick={resetForm}
              className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors text-sm"
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors text-sm"
            >
              {editingId ? '更新する' : '登録する'}
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h2 className="text-lg font-bold text-slate-800">指名種別管理</h2>
              <p className="text-sm text-slate-500 mt-1">指名種別（フリー、本指名、初回指名など）と、それぞれのデフォルト料金・バック額を設定します。</p>
            </div>
            <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors">
              新規登録
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[650px]">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200 text-sm font-semibold text-slate-600">
                    <th className="p-4 w-10"></th>
                    <th className="p-4">種別名</th>
                    <th className="p-4 w-32">デフォルト料金</th>
                    <th className="p-4 w-32 text-indigo-600">デフォルトバック</th>
                    <th className="p-4 w-20">状態</th>
                    <th className="p-4 w-32 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item, index) => (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50/50 transition-colors ${draggedIndex === index ? 'opacity-40 bg-slate-100' : ''}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragEnd={handleDragEnd}
                    >
                      <td className="p-4 text-sm text-slate-600 font-medium whitespace-nowrap">
                        <span className="cursor-grab select-none text-slate-400 font-bold hover:text-indigo-600">⋮⋮</span>
                      </td>
                      <td className="p-4 text-sm font-bold text-slate-800">{item.display_name}</td>
                      <td className="p-4 text-sm font-bold text-slate-700">¥{(item.default_fee || 0).toLocaleString()}</td>
                      <td className="p-4 text-sm font-bold text-indigo-600">¥{(item.default_back_amount || 0).toLocaleString()}</td>
                      <td className="p-4">
                        <span className={`inline-flex px-2 py-1 rounded-md text-xs font-semibold ${item.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                          {item.is_active ? '有効' : '無効'}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-right space-x-3 whitespace-nowrap">
                        <button onClick={() => handleEdit(item)} className="font-medium text-indigo-600 hover:text-indigo-800 transition-colors align-middle">編集</button>
                        {!SYSTEM_SLUGS.includes(item.slug) ? (
                          <button onClick={() => handleDelete(item.id)} className="font-medium text-rose-600 hover:text-rose-800 transition-colors align-middle">削除</button>
                        ) : (
                          <span className="text-xs text-slate-400 ml-1 align-middle">デフォルト</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500">指名種別が登録されていません</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
