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
      await supabase.from('designation_types').insert(
        missing.map(d => ({ ...d, shop_id: selectedShop.id }))
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
  }

  const handleSave = async () => {
    if (!selectedShop) return
    if (!form.slug || !form.display_name) { alert('表示名は必須です'); return }

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
    <div className="space-y-6">
      {/* 追加/編集フォーム */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <h3 className="text-base font-bold text-slate-800 mb-4">
          {editingId ? '指名種別を編集' : '新しい指名種別を追加'}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
          <div className="md:col-span-1">
            <label className="block text-xs font-semibold text-slate-600 mb-1">表示名</label>
            <input
              type="text"
              value={form.display_name}
              onChange={e => {
                const name = e.target.value
                const newForm = { ...form, display_name: name }
                // 新規追加時のみスラッグを自動生成（編集時は既存のスラッグを維持）
                if (!editingId) {
                  newForm.slug = generateSlug(name, items)
                }
                setForm(newForm)
              }}
              placeholder="例: 本指名"
              className="w-full border border-slate-200 rounded-xl bg-slate-50 px-3 py-2.5 text-sm"
            />
          </div>
          <div className="md:col-span-1">
            <label className="block text-xs font-semibold text-slate-600 mb-1">デフォルト料金</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs text-sm">¥</span>
              <input
                type="number"
                value={form.default_fee}
                onChange={e => setForm({ ...form, default_fee: Number(e.target.value) })}
                className="w-full border border-slate-200 rounded-xl bg-indigo-50/50 pl-7 pr-3 py-2.5 text-sm font-bold text-slate-800"
              />
            </div>
          </div>
          <div className="md:col-span-1">
            <label className="block text-xs font-semibold text-slate-400 mb-1">デフォルトバック</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400 text-xs font-bold text-sm">B</span>
              <input
                type="number"
                value={form.default_back_amount}
                onChange={e => setForm({ ...form, default_back_amount: Number(e.target.value) })}
                className="w-full border border-slate-200 rounded-xl bg-indigo-50/50 pl-7 pr-3 py-2.5 text-sm font-bold text-indigo-600"
              />
            </div>
          </div>
          <div className="md:col-span-1">
            <label className="block text-xs font-semibold text-slate-600 mb-1">順序</label>
            <input
              type="number"
              value={form.display_order}
              onChange={e => setForm({ ...form, display_order: Number(e.target.value) })}
              className="w-full border border-slate-200 rounded-xl bg-slate-50 px-3 py-2.5 text-sm"
            />
          </div>
          <div className="md:col-span-1 border-l border-slate-100 flex flex-col justify-end px-4">
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer mb-2">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={e => setForm({ ...form, is_active: e.target.checked })}
                className="w-4 h-4 text-indigo-600 rounded"
              />
              有効
            </label>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors text-sm"
          >
            {editingId ? '更新する' : '追加する'}
          </button>
          {editingId && (
            <button
              onClick={resetForm}
              className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors text-sm"
            >
              キャンセル
            </button>
          )}
        </div>
      </div>

      {/* 一覧テーブル */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50">
          <h3 className="font-bold text-slate-700">指名種別一覧（{items.length}件）</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500">順序</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500">表示名</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500">デフォルト料金</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500">デフォルトバック</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500">状態</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map(item => (
                <tr key={item.id} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3 text-sm text-slate-600">{item.display_order}</td>
                  <td className="px-4 py-3 text-sm font-bold text-slate-800">{item.display_name}</td>
                  <td className="px-4 py-3 text-sm font-bold text-slate-700">¥{(item.default_fee || 0).toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm font-bold text-indigo-600">¥{(item.default_back_amount || 0).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${item.is_active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                      {item.is_active ? '有効' : '無効'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button onClick={() => handleEdit(item)} className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">編集</button>
                    {!SYSTEM_SLUGS.includes(item.slug) && (
                      <button onClick={() => handleDelete(item.id)} className="text-rose-600 hover:text-rose-700 text-sm font-medium">削除</button>
                    )}
                    {SYSTEM_SLUGS.includes(item.slug) && (
                      <span className="text-xs text-slate-400 ml-1">デフォルト</span>
                    )}
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500">指名種別が登録されていません</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
