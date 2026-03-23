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
}

export function DeductionRulesTab() {
  const { selectedShop } = useShop()
  const [rules, setRules] = useState<DeductionRule[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<DeductionRule | null>(null)
  const [form, setForm] = useState({
    name: '',
    category: 'deduction' as 'deduction' | 'allowance' | 'penalty',
    calc_timing: 'per_reservation' as 'per_reservation' | 'per_shift' | 'monthly',
    amount: 800,
    min_duration: 0,
    is_active: true,
  })

  async function fetchRules() {
    if (!selectedShop) { setRules([]); setLoading(false); return }
    setLoading(true)
    const { data, error } = await supabase
      .from('deduction_rules')
      .select('*')
      .eq('shop_id', selectedShop.id)
      .order('category', { ascending: true })

    if (!error) setRules((data as DeductionRule[]) || [])
    setLoading(false)
  }

  const resetForm = () => {
    setForm({ name: '', category: 'deduction', calc_timing: 'per_reservation', amount: 800, min_duration: 0, is_active: true })
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
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-bold text-slate-800">控除・手当管理</h2>
          <p className="text-sm text-slate-500 mt-1">厚生費、交通費、待機手当、罰金などのルールを設定します。</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(v => !v) }} className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors">
          {showForm ? 'キャンセル' : '新規登録'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-slate-50 p-6 rounded-xl border border-slate-200 mb-6 space-y-4">
          <input className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500/50 outline-none" placeholder="項目名（例: 厚生費）" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block mb-1 text-xs font-medium text-slate-600">区分</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as 'deduction' | 'allowance' | 'penalty' })} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 bg-white text-sm outline-none">
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block mb-1 text-xs font-medium text-slate-600">計算タイミング</label>
              <select value={form.calc_timing} onChange={(e) => setForm({ ...form, calc_timing: e.target.value as 'per_reservation' | 'per_shift' | 'monthly' })} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 bg-white text-sm outline-none">
                {Object.entries(TIMING_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block mb-1 text-xs font-medium text-slate-600">金額</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">¥</span>
                <input type="number" min={0} value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} className="w-full border border-slate-200 rounded-lg pl-8 pr-3 py-2.5 bg-white text-sm outline-none" />
              </div>
            </div>
          </div>
          {form.calc_timing === 'per_reservation' && (
            <div className="max-w-xs">
              <label className="block mb-1 text-xs font-medium text-slate-600">最低コース時間（分）— この時間以上のコースに適用</label>
              <input type="number" min={0} value={form.min_duration} onChange={(e) => setForm({ ...form, min_duration: Number(e.target.value) })} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 bg-white text-sm outline-none" />
              <p className="text-xs text-slate-400 mt-1">0 = 全コースに適用</p>
            </div>
          )}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" className="rounded text-indigo-600 w-4 h-4" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
              有効にする
            </label>
          </div>
          <button type="submit" className="px-5 py-2.5 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 transition-colors">
            {editing ? '更新する' : '登録する'}
          </button>
        </form>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[650px]">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200 text-sm font-semibold text-slate-600">
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
              {rules.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
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
                    <button className="font-medium text-indigo-600 hover:text-indigo-800 transition-colors" onClick={() => {
                      setEditing(r)
                      setForm({ name: r.name, category: r.category, calc_timing: r.calc_timing, amount: r.amount, min_duration: r.min_duration, is_active: r.is_active })
                      setShowForm(true)
                    }}>編集</button>
                    <button className="font-medium text-rose-600 hover:text-rose-800 transition-colors" onClick={() => void handleDelete(r.id)}>削除</button>
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
    </div>
  )
}
