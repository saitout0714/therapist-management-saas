'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useShop } from '@/app/contexts/ShopContext'

type DeductionRule = {
  id: string
  name: string
  category: 'deduction' | 'allowance' | 'penalty'
  calc_timing: 'per_reservation' | 'per_shift' | 'monthly'
  amount: number
  min_duration: number
  is_active: boolean
  display_order: number
}

const CATEGORY_LABELS: Record<string, string> = {
  deduction: '控除（天引き）',
  allowance: '手当（加算）',
  penalty: 'ペナルティ',
}

const CATEGORY_COLORS: Record<string, string> = {
  deduction: 'bg-rose-50 text-rose-700',
  allowance: 'bg-emerald-50 text-emerald-700',
  penalty: 'bg-amber-50 text-amber-700',
}

const TIMING_LABELS: Record<string, string> = {
  per_reservation: '予約ごと',
  per_shift: '出勤ごと',
  monthly: '月次',
  manual: '手動',
}

export function DeductionRulesTab() {
  const { selectedShop } = useShop()
  const [rules, setRules] = useState<DeductionRule[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<DeductionRule | null>(null)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [form, setForm] = useState({
    name: '',
    category: 'deduction' as 'deduction' | 'allowance' | 'penalty',
    calc_timing: 'per_reservation' as 'per_reservation' | 'per_shift' | 'monthly' | 'manual',
    amount: 800,
    min_duration: 0,
    is_active: true,
    display_order: 0,
  })

  async function fetchRules() {
    if (!selectedShop) { setRules([]); setLoading(false); return }
    setLoading(true)
    const { data, error } = await supabase
      .from('deduction_rules')
      .select('*')
      .eq('shop_id', selectedShop.id)
      .order('display_order', { ascending: true })

    if (!error) setRules((data as DeductionRule[]) || [])
    setLoading(false)
  }

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return

    const newRules = [...rules]
    const draggedItem = newRules[draggedIndex]
    newRules.splice(draggedIndex, 1)
    newRules.splice(index, 0, draggedItem)

    setDraggedIndex(index)
    setRules(newRules)
  }

  const handleDragEnd = async () => {
    setDraggedIndex(null)
    if (!selectedShop) return

    // Optimistically update display_order in local state
    const updated = rules.map((rule, idx) => ({ ...rule, display_order: idx }))
    setRules(updated)

    const promises = rules.map((rule, idx) =>
      supabase.from('deduction_rules').update({ display_order: idx, updated_at: new Date().toISOString() }).eq('id', rule.id)
    )
    const results = await Promise.all(promises)
    const hasError = results.some(r => r.error)
    if (hasError) {
      alert('並び替え順の保存に失敗しました')
      void fetchRules()
    }
  }

  const resetForm = () => {
    setForm({ name: '', category: 'deduction', calc_timing: 'per_reservation', amount: 800, min_duration: 0, is_active: true, display_order: rules.length })
    setEditing(null)
    setShowForm(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedShop) { alert('店舗を選択してください'); return }

    const payload = { ...form, shop_id: selectedShop.id, updated_at: new Date().toISOString() }
    const result = editing
      ? await supabase.from('deduction_rules').update(payload).eq('id', editing.id)
      : await supabase.from('deduction_rules').insert([payload])

    if (result.error) { alert('保存に失敗しました: ' + result.error.message); return }
    resetForm()
    void fetchRules()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('本当に削除しますか？')) return
    await supabase.from('deduction_rules').delete().eq('id', id)
    void fetchRules()
  }

  useEffect(() => { void fetchRules() }, [selectedShop])

  if (loading) return <div className="p-6">読み込み中...</div>

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 md:p-5">
      {showForm ? (
        <form onSubmit={handleSubmit} className="space-y-6">
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
                editing ? 'bg-indigo-100 text-indigo-800' : 'bg-emerald-100 text-emerald-800'
              }`}>
                {editing ? '編集選択中' : '新規登録'}
              </span>
              <h3 className="text-lg font-bold text-slate-800 mt-1">
                {editing ? `「${editing.name}」の編集` : '新規控除・手当登録'}
              </h3>
            </div>
          </div>

          {/* Form Body */}
          <div className="space-y-6 max-w-2xl">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-600">項目名</label>
              <input className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500/50 outline-none" placeholder="項目名（例: 厚生費）" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600">区分</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as 'deduction' | 'allowance' | 'penalty' })} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 bg-white text-sm outline-none focus:ring-2 focus:ring-indigo-500/50">
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600">計算タイミング</label>
                <select value={form.calc_timing} onChange={(e) => setForm({ ...form, calc_timing: e.target.value as 'per_reservation' | 'per_shift' | 'monthly' | 'manual' })} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 bg-white text-sm outline-none focus:ring-2 focus:ring-indigo-500/50">
                  {Object.entries(TIMING_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-600">金額</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">¥</span>
                <input type="number" min={0} value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} className="w-full border border-slate-200 rounded-lg pl-8 pr-3 py-2.5 bg-white text-sm outline-none focus:ring-2 focus:ring-indigo-500/50" />
              </div>
            </div>

            {form.calc_timing === 'per_reservation' && (
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600">最低コース時間（分）— この時間以上のコースに適用</label>
                <input type="number" min={0} value={form.min_duration} onChange={(e) => setForm({ ...form, min_duration: Number(e.target.value) })} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 bg-white text-sm outline-none focus:ring-2 focus:ring-indigo-500/50" />
                <p className="text-xs text-slate-400 mt-1">※0 = 全コースに適用</p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-600">表示順</label>
                <input
                  type="number"
                  value={form.display_order}
                  onChange={e => setForm({ ...form, display_order: Number(e.target.value) })}
                  className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500/50 outline-none text-sm"
                />
              </div>
              <div className="flex items-center gap-4 pt-6">
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input type="checkbox" className="rounded text-indigo-600 w-4 h-4" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
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
              {editing ? '更新する' : '登録する'}
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h2 className="text-lg font-bold text-slate-800">控除・手当管理</h2>
              <p className="text-sm text-slate-500 mt-1">厚生費、交通費、待機手当、罰金などのルールを設定します。</p>
            </div>
            <button onClick={() => { resetForm(); setShowForm(true) }} className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors">
              新規登録
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[650px]">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200 text-sm font-semibold text-slate-600">
                    <th className="p-4 w-16">順序</th>
                    <th className="p-4">項目名</th>
                    <th className="p-4 w-32">区分</th>
                    <th className="p-4 w-28">タイミング</th>
                    <th className="p-4 w-24">金額</th>
                    <th className="p-4 w-24">最低時間</th>
                    <th className="p-4 w-20">状態</th>
                    <th className="p-4 w-28 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rules.map((r, index) => (
                    <tr
                      key={r.id}
                      className={`hover:bg-slate-50/50 transition-colors ${draggedIndex === index ? 'opacity-40 bg-slate-100' : ''}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragEnd={handleDragEnd}
                    >
                      <td className="p-4 text-sm text-slate-600 font-medium whitespace-nowrap">
                        <span className="inline-block mr-2 cursor-grab select-none text-slate-400 font-bold hover:text-indigo-600">⋮⋮</span>
                        {r.display_order}
                      </td>
                      <td className="p-4 text-sm font-bold text-slate-800">{r.name}</td>
                      <td className="p-4 text-sm">
                        <span className={`inline-flex px-2 py-1 rounded-md text-xs font-semibold ${CATEGORY_COLORS[r.category]}`}>
                          {CATEGORY_LABELS[r.category]}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-slate-600">{TIMING_LABELS[r.calc_timing]}</td>
                      <td className="p-4 text-sm font-bold text-slate-800">¥{r.amount.toLocaleString()}</td>
                      <td className="p-4 text-sm text-slate-600">{r.min_duration > 0 ? `${r.min_duration}分〜` : '全て'}</td>
                      <td className="p-4 text-sm">
                        <span className={`inline-flex px-2 py-1 rounded-md text-xs font-semibold ${r.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                          {r.is_active ? '有効' : '無効'}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-right space-x-3 whitespace-nowrap">
                        <button
                          className="font-medium text-indigo-600 hover:text-indigo-800 transition-colors align-middle"
                          onClick={() => {
                            setEditing(r)
                            setForm({ name: r.name, category: r.category, calc_timing: r.calc_timing, amount: r.amount, min_duration: r.min_duration, is_active: r.is_active, display_order: r.display_order })
                            setShowForm(true)
                          }}
                        >編集</button>
                        <button className="font-medium text-rose-600 hover:text-rose-800 transition-colors align-middle" onClick={() => void handleDelete(r.id)}>削除</button>
                      </td>
                    </tr>
                  ))}
                  {rules.length === 0 && (
                    <tr><td className="p-8 text-center text-slate-500" colSpan={7}>控除・手当ルールがありません</td></tr>
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
