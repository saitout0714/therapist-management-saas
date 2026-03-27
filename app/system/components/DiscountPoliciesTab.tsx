'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useShop } from '@/app/contexts/ShopContext'

type DiscountPolicy = {
  id: string
  name: string
  discount_value: number
  therapist_burden_amount: number
  is_combinable: boolean
  max_per_reservation: number
  is_active: boolean
}

export function DiscountPoliciesTab() {
  const { selectedShop } = useShop()
  const [policies, setPolicies] = useState<DiscountPolicy[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<DiscountPolicy | null>(null)
  const [form, setForm] = useState({
    name: '',
    discount_value: 1000,
    therapist_burden_amount: 0,
    is_combinable: false,
    max_per_reservation: 1,
    is_active: true,
  })

  async function fetchPolicies() {
    if (!selectedShop) { setPolicies([]); setLoading(false); return }
    setLoading(true)
    const { data, error } = await supabase
      .from('discount_policies')
      .select('*')
      .eq('shop_id', selectedShop.id)
      .order('created_at', { ascending: true })
    if (!error) setPolicies((data as DiscountPolicy[]) || [])
    setLoading(false)
  }

  const resetForm = () => {
    setForm({ name: '', discount_value: 1000, therapist_burden_amount: 0, is_combinable: false, max_per_reservation: 1, is_active: true })
    setEditing(null)
    setShowForm(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedShop) { alert('店舗を選択してください'); return }
    const payload = {
      ...form,
      discount_type: 'fixed',
      burden_type: form.therapist_burden_amount > 0 ? 'therapist_only' : 'shop_only',
      shop_id: selectedShop.id,
      updated_at: new Date().toISOString(),
    }
    const result = editing
      ? await supabase.from('discount_policies').update(payload).eq('id', editing.id)
      : await supabase.from('discount_policies').insert([payload])
    if (result.error) { alert('保存に失敗しました: ' + result.error.message); return }
    resetForm()
    void fetchPolicies()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('本当に削除しますか？')) return
    await supabase.from('discount_policies').delete().eq('id', id)
    void fetchPolicies()
  }

  useEffect(() => { void fetchPolicies() }, [selectedShop])

  if (loading) return <div className="p-6">読み込み中...</div>

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-bold text-slate-800">割引ルール管理</h2>
          <p className="text-sm text-slate-500 mt-1">割引額とセラピスト負担額を設定します。</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(v => !v) }} className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors">
          {showForm ? 'キャンセル' : '新規登録'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-slate-50 p-6 rounded-xl border border-slate-200 mb-6 space-y-4">
          <div>
            <label className="block mb-1 text-xs font-semibold text-slate-600">割引名</label>
            <input
              className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500/50 outline-none"
              placeholder="例: 新規割引、メルマガ割引"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block mb-1 text-xs font-semibold text-slate-600">割引額（円）</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">¥</span>
                <input
                  type="number"
                  min={0}
                  value={form.discount_value}
                  onChange={(e) => setForm({ ...form, discount_value: Number(e.target.value) })}
                  className="w-full border border-slate-200 rounded-lg pl-8 pr-4 py-2.5 bg-white text-sm outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block mb-1 text-xs font-semibold text-indigo-700">セラピスト負担額（円）</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400 font-bold text-sm">¥</span>
                <input
                  type="number"
                  min={0}
                  value={form.therapist_burden_amount}
                  onChange={(e) => setForm({ ...form, therapist_burden_amount: Number(e.target.value) })}
                  className="w-full border border-indigo-200 rounded-lg pl-8 pr-4 py-2.5 bg-indigo-50/50 focus:ring-2 focus:ring-indigo-500/50 outline-none text-sm font-semibold"
                />
              </div>
              <p className="text-xs text-slate-400 mt-1">0円の場合は店舗全額負担。</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" className="rounded text-indigo-600 w-4 h-4" checked={form.is_combinable} onChange={(e) => setForm({ ...form, is_combinable: e.target.checked })} />
              他の割引と併用可能
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" className="rounded text-indigo-600 w-4 h-4" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
              有効
            </label>
          </div>
          <button type="submit" className="px-5 py-2.5 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 transition-colors">
            {editing ? '更新する' : '登録する'}
          </button>
        </form>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[500px]">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200 text-sm font-semibold text-slate-600">
                <th className="p-4">割引名</th>
                <th className="p-4 w-28">割引額</th>
                <th className="p-4 w-32 text-indigo-600">セラピスト負担</th>
                <th className="p-4 w-16">併用</th>
                <th className="p-4 w-16">状態</th>
                <th className="p-4 w-24 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {policies.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-4 text-sm font-bold text-slate-800">{p.name}</td>
                  <td className="p-4 text-sm font-bold text-slate-800">¥{p.discount_value.toLocaleString()}</td>
                  <td className="p-4 text-sm font-bold text-indigo-700">
                    {(p.therapist_burden_amount ?? 0) > 0
                      ? `¥${p.therapist_burden_amount.toLocaleString()}`
                      : <span className="text-slate-300 font-normal">—</span>}
                  </td>
                  <td className="p-4 text-sm text-slate-600">{p.is_combinable ? '可' : '不可'}</td>
                  <td className="p-4 text-sm">
                    <span className={`inline-flex px-2 py-1 rounded-md text-xs font-semibold ${p.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                      {p.is_active ? '有効' : '無効'}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-right space-x-3 whitespace-nowrap">
                    <button
                      className="font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
                      onClick={() => {
                        setEditing(p)
                        setForm({ name: p.name, discount_value: p.discount_value, therapist_burden_amount: p.therapist_burden_amount ?? 0, is_combinable: p.is_combinable, max_per_reservation: p.max_per_reservation, is_active: p.is_active })
                        setShowForm(true)
                      }}
                    >編集</button>
                    <button className="font-medium text-rose-600 hover:text-rose-800 transition-colors" onClick={() => void handleDelete(p.id)}>削除</button>
                  </td>
                </tr>
              ))}
              {policies.length === 0 && (
                <tr><td className="p-8 text-center text-slate-500" colSpan={6}>割引ルールがありません</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
