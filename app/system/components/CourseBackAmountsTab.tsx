'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useShop } from '@/app/contexts/ShopContext'

type Course = { id: string; name: string; duration: number; base_price: number }
type Rank = { id: string; name: string }
type BackAmount = {
  id: string
  shop_id: string
  course_id: string
  rank_id: string | null
  designation_type: string
  back_amount: number
  customer_price: number | null
}

const DESIGNATION_TYPES = [
  { value: 'free', label: 'フリー' },
  { value: 'first_nomination', label: '初指名' },
  { value: 'confirmed', label: '本指名' },
  { value: 'photo', label: '写真指名' },
  { value: 'princess', label: '姫予約' },
  { value: 'certified', label: '認定指名' },
]

export function CourseBackAmountsTab() {
  const { selectedShop } = useShop()
  const [courses, setCourses] = useState<Course[]>([])
  const [ranks, setRanks] = useState<Rank[]>([])
  const [amounts, setAmounts] = useState<BackAmount[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedCourse, setSelectedCourse] = useState<string>('')
  const [selectedRank, setSelectedRank] = useState<string>('all')
  // editableCells: key = `${designation_type}` => { back_amount, customer_price }
  const [editableCells, setEditableCells] = useState<Record<string, { back_amount: string; customer_price: string }>>({})

  const fetchData = useCallback(async () => {
    if (!selectedShop) { setLoading(false); return }
    setLoading(true)

    const [coursesRes, ranksRes, amountsRes] = await Promise.all([
      supabase.from('courses').select('id, name, duration, base_price').eq('shop_id', selectedShop.id).eq('is_active', true).order('display_order'),
      supabase.from('therapist_ranks').select('id, name').eq('shop_id', selectedShop.id).order('display_order'),
      supabase.from('course_back_amounts').select('*').eq('shop_id', selectedShop.id),
    ])

    const c = (coursesRes.data as Course[]) || []
    const r = (ranksRes.data as Rank[]) || []
    const a = (amountsRes.data as BackAmount[]) || []

    setCourses(c)
    setRanks(r)
    setAmounts(a)

    if (c.length > 0 && !selectedCourse) setSelectedCourse(c[0].id)
    setLoading(false)
  }, [selectedShop, selectedCourse])

  useEffect(() => { void fetchData() }, [fetchData])

  // 選択中のコース×ランクに該当する amounts をフィルタし、editable cells を構築
  useEffect(() => {
    const cells: Record<string, { back_amount: string; customer_price: string }> = {}
    const rankFilter = selectedRank === 'all' ? null : selectedRank

    for (const dt of DESIGNATION_TYPES) {
      const existing = amounts.find(
        a => a.course_id === selectedCourse &&
          (rankFilter ? a.rank_id === rankFilter : a.rank_id === null) &&
          a.designation_type === dt.value
      )
      cells[dt.value] = {
        back_amount: existing ? String(existing.back_amount) : '',
        customer_price: existing?.customer_price != null ? String(existing.customer_price) : '',
      }
    }
    setEditableCells(cells)
  }, [selectedCourse, selectedRank, amounts])

  const handleCellChange = (designationType: string, field: 'back_amount' | 'customer_price', value: string) => {
    setEditableCells(prev => ({
      ...prev,
      [designationType]: { ...prev[designationType], [field]: value },
    }))
  }

  const handleSave = async () => {
    if (!selectedShop || !selectedCourse) return
    setSaving(true)

    const rankId = selectedRank === 'all' ? null : selectedRank

    for (const dt of DESIGNATION_TYPES) {
      const cell = editableCells[dt.value]
      if (!cell || cell.back_amount === '') continue

      const backAmount = parseInt(cell.back_amount, 10)
      if (isNaN(backAmount)) continue

      const customerPrice = cell.customer_price ? parseInt(cell.customer_price, 10) : null

      const existing = amounts.find(
        a => a.course_id === selectedCourse &&
          (rankId ? a.rank_id === rankId : a.rank_id === null) &&
          a.designation_type === dt.value
      )

      if (existing) {
        await supabase.from('course_back_amounts')
          .update({ back_amount: backAmount, customer_price: customerPrice, updated_at: new Date().toISOString() })
          .eq('id', existing.id)
      } else {
        await supabase.from('course_back_amounts')
          .insert([{
            shop_id: selectedShop.id,
            course_id: selectedCourse,
            rank_id: rankId,
            designation_type: dt.value,
            back_amount: backAmount,
            customer_price: customerPrice,
          }])
      }
    }

    alert('保存しました')
    setSaving(false)
    void fetchData()
  }

  const handleDelete = async (designationType: string) => {
    const rankId = selectedRank === 'all' ? null : selectedRank
    const existing = amounts.find(
      a => a.course_id === selectedCourse &&
        (rankId ? a.rank_id === rankId : a.rank_id === null) &&
        a.designation_type === designationType
    )
    if (!existing) return
    if (!confirm('この行のバック設定を削除しますか？')) return
    await supabase.from('course_back_amounts').delete().eq('id', existing.id)
    void fetchData()
  }

  if (loading) return <div className="p-6">読み込み中...</div>

  const selectedCourseName = courses.find(c => c.id === selectedCourse)
  const selectedRankName = selectedRank === 'all' ? '全ランク共通' : ranks.find(r => r.id === selectedRank)?.name

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 md:p-8">
      <div className="mb-6">
        <h2 className="text-lg font-bold text-slate-800">固定額バック表</h2>
        <p className="text-sm text-slate-500 mt-1">
          コース × ランク × 指名種別ごとのバック額を設定します。<br />
          <span className="text-amber-600 font-medium">バック設定で「固定額（マトリクス表）」を選択した店舗でのみ使用されます。</span>
        </p>
      </div>

      {/* フィルター */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1">
          <label className="block mb-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wider">コース</label>
          <select
            value={selectedCourse}
            onChange={(e) => setSelectedCourse(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 bg-slate-50 text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none"
          >
            {courses.map(c => (
              <option key={c.id} value={c.id}>{c.name}（{c.duration}分 / ¥{c.base_price.toLocaleString()}）</option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="block mb-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wider">ランク</label>
          <select
            value={selectedRank}
            onChange={(e) => setSelectedRank(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 bg-slate-50 text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none"
          >
            <option value="all">全ランク共通（ランク未設定時に適用）</option>
            {ranks.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 現在の選択を表示 */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 mb-6 text-sm">
        <span className="font-bold text-indigo-700">{selectedCourseName?.name}</span>
        <span className="text-indigo-500 mx-2">×</span>
        <span className="font-bold text-indigo-700">{selectedRankName}</span>
        <span className="text-indigo-500 ml-2">のバック額を編集中</span>
      </div>

      {/* マトリクス表 */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left min-w-[600px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="p-3 text-sm font-semibold text-slate-600">指名種別</th>
              <th className="p-3 text-sm font-semibold text-slate-600 w-40">バック額（円）</th>
              <th className="p-3 text-sm font-semibold text-slate-600 w-40">
                <span>顧客請求額（円）</span>
                <span className="text-xs text-slate-400 block font-normal">※コース基本料と異なる場合</span>
              </th>
              <th className="p-3 text-sm font-semibold text-slate-600 w-24">店落ち</th>
              <th className="p-3 w-16"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {DESIGNATION_TYPES.map(dt => {
              const cell = editableCells[dt.value] || { back_amount: '', customer_price: '' }
              const backNum = parseInt(cell.back_amount, 10) || 0
              const priceNum = cell.customer_price ? parseInt(cell.customer_price, 10) : (selectedCourseName?.base_price || 0)
              const shopKeep = priceNum - backNum
              const hasValue = cell.back_amount !== ''

              return (
                <tr key={dt.value} className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-3">
                    <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-bold ${
                      dt.value === 'free' ? 'bg-slate-100 text-slate-700' :
                      dt.value === 'confirmed' ? 'bg-rose-50 text-rose-700' :
                      dt.value === 'first_nomination' ? 'bg-amber-50 text-amber-700' :
                      dt.value === 'certified' ? 'bg-purple-50 text-purple-700' :
                      'bg-blue-50 text-blue-700'
                    }`}>
                      {dt.label}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">¥</span>
                      <input
                        type="number"
                        min={0}
                        value={cell.back_amount}
                        onChange={(e) => handleCellChange(dt.value, 'back_amount', e.target.value)}
                        placeholder="未設定"
                        className="w-full border border-slate-200 rounded-lg pl-7 pr-2 py-2 text-sm bg-white focus:ring-2 focus:ring-indigo-500/50 outline-none"
                      />
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">¥</span>
                      <input
                        type="number"
                        min={0}
                        value={cell.customer_price}
                        onChange={(e) => handleCellChange(dt.value, 'customer_price', e.target.value)}
                        placeholder={selectedCourseName ? String(selectedCourseName.base_price) : '0'}
                        className="w-full border border-slate-200 rounded-lg pl-7 pr-2 py-2 text-sm bg-white focus:ring-2 focus:ring-indigo-500/50 outline-none"
                      />
                    </div>
                  </td>
                  <td className="p-3">
                    {hasValue && (
                      <span className={`text-sm font-bold ${shopKeep >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        ¥{shopKeep.toLocaleString()}
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    {hasValue && (
                      <button
                        onClick={() => void handleDelete(dt.value)}
                        className="text-xs text-rose-500 hover:text-rose-700 font-medium transition-colors"
                      >
                        削除
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* 保存ボタン */}
      <div className="mt-6 pt-4 border-t border-slate-100 flex items-center gap-4">
        <button
          onClick={() => void handleSave()}
          disabled={saving}
          className="px-5 py-2.5 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50"
        >
          {saving ? '保存中...' : '保存する'}
        </button>
        <span className="text-xs text-slate-400">空欄の行はスキップされます</span>
      </div>

      {/* 既存の全設定一覧 */}
      {amounts.filter(a => a.course_id === selectedCourse).length > 0 && (
        <div className="mt-8">
          <h3 className="text-sm font-bold text-slate-700 mb-3">
            このコースの既存設定一覧
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm min-w-[500px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500">
                  <th className="p-2.5">ランク</th>
                  <th className="p-2.5">指名種別</th>
                  <th className="p-2.5">バック額</th>
                  <th className="p-2.5">請求額</th>
                  <th className="p-2.5">店落ち</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {amounts
                  .filter(a => a.course_id === selectedCourse)
                  .sort((a, b) => {
                    const rankOrder = (a.rank_id || '').localeCompare(b.rank_id || '')
                    if (rankOrder !== 0) return rankOrder
                    return DESIGNATION_TYPES.findIndex(d => d.value === a.designation_type) -
                           DESIGNATION_TYPES.findIndex(d => d.value === b.designation_type)
                  })
                  .map(a => {
                    const rankName = a.rank_id ? ranks.find(r => r.id === a.rank_id)?.name || '不明' : '全ランク共通'
                    const dtLabel = DESIGNATION_TYPES.find(d => d.value === a.designation_type)?.label || a.designation_type
                    const price = a.customer_price ?? (courses.find(c => c.id === a.course_id)?.base_price || 0)
                    return (
                      <tr key={a.id} className="hover:bg-slate-50/50">
                        <td className="p-2.5 text-slate-600">{rankName}</td>
                        <td className="p-2.5 font-medium text-slate-800">{dtLabel}</td>
                        <td className="p-2.5 font-bold text-indigo-600">¥{a.back_amount.toLocaleString()}</td>
                        <td className="p-2.5 text-slate-600">¥{price.toLocaleString()}</td>
                        <td className="p-2.5 font-medium text-emerald-600">¥{(price - a.back_amount).toLocaleString()}</td>
                      </tr>
                    )
                  })
                }
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
