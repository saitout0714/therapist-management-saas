'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useShop } from '@/app/contexts/ShopContext'

type Course = { id: string; name: string; duration: number; base_price: number }
type Rank = { id: string; name: string }
type ExtensionRankPrice = { rank_id: string; extension_unit_price: number; extension_unit_back: number }
type BackAmount = {
  id: string
  shop_id: string
  course_id: string
  rank_id: string | null
  designation_type: string
  back_amount: number
  customer_price: number | null
  course_price_override: number | null
}

type DesignationTypeItem = { value: string; label: string }

export function CourseBackAmountsTab() {
  const { selectedShop } = useShop()
  const [courses, setCourses] = useState<Course[]>([])
  const [ranks, setRanks] = useState<Rank[]>([])
  const [amounts, setAmounts] = useState<BackAmount[]>([])
  const [designationTypes, setDesignationTypes] = useState<DesignationTypeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedCourse, setSelectedCourse] = useState<string>('')
  const [selectedRank, setSelectedRank] = useState<string>('')
  // editableCells: key = designation_type => { course_price, back_amount, customer_price }
  const [editableCells, setEditableCells] = useState<Record<string, { course_price: string; back_amount: string; customer_price: string }>>({})
  const [extensionRankPrices, setExtensionRankPrices] = useState<ExtensionRankPrice[]>([])
  const [extensionDefaults, setExtensionDefaults] = useState({ price: 0, back: 0 })
  const [extRankSaving, setExtRankSaving] = useState(false)
  const [extRankSaved, setExtRankSaved] = useState(false)

  const fetchData = useCallback(async () => {
    if (!selectedShop) { setLoading(false); return }
    setLoading(true)

    const [coursesRes, ranksRes, amountsRes, dtRes, extPricesRes, settingsRes] = await Promise.all([
      supabase.from('courses').select('id, name, duration, base_price').eq('shop_id', selectedShop.id).eq('is_active', true).order('display_order'),
      supabase.from('therapist_ranks').select('id, name').eq('shop_id', selectedShop.id).order('display_order'),
      supabase.from('course_back_amounts').select('*').eq('shop_id', selectedShop.id),
      supabase.from('designation_types').select('slug, display_name').eq('shop_id', selectedShop.id).eq('is_active', true).order('display_order'),
      supabase.from('extension_rank_prices').select('rank_id, extension_unit_price, extension_unit_back').eq('shop_id', selectedShop.id),
      supabase.from('system_settings').select('extension_unit_price, extension_unit_back').eq('shop_id', selectedShop.id).limit(1),
    ])

    const c = (coursesRes.data as Course[]) || []
    const r = (ranksRes.data as Rank[]) || []
    const a = (amountsRes.data as BackAmount[]) || []
    const dt = ((dtRes.data || []) as { slug: string; display_name: string }[]).map(d => ({ value: d.slug, label: d.display_name }))

    setCourses(c)
    setRanks(r)
    setAmounts(a)
    setDesignationTypes(dt.length > 0 ? dt : [
      { value: 'free', label: 'フリー' },
      { value: 'first_nomination', label: '初指名' },
      { value: 'confirmed', label: '本指名' },
    ])

    const fetchedExtPrices = (extPricesRes.data || []) as ExtensionRankPrice[]
    // 全ランクに対してデフォルト 0/0 で初期化し、既存データで上書き
    setExtensionRankPrices(
      r.map(rank => {
        const existing = fetchedExtPrices.find(p => p.rank_id === rank.id)
        return { rank_id: rank.id, extension_unit_price: existing?.extension_unit_price ?? 0, extension_unit_back: existing?.extension_unit_back ?? 0 }
      })
    )
    const ss = settingsRes.data?.[0] as { extension_unit_price?: number; extension_unit_back?: number } | undefined
    setExtensionDefaults({ price: ss?.extension_unit_price ?? 0, back: ss?.extension_unit_back ?? 0 })

    if (c.length > 0 && !selectedCourse) setSelectedCourse(c[0].id)
    if (r.length > 0 && !selectedRank) setSelectedRank(r[0].id)
    setLoading(false)
  }, [selectedShop, selectedCourse, selectedRank])

  useEffect(() => { void fetchData() }, [fetchData])

  // 選択中のコース×ランクに該当する amounts をフィルタし、editable cells を構築
  useEffect(() => {
    const cells: Record<string, { course_price: string; back_amount: string; customer_price: string }> = {}

    for (const dt of designationTypes) {
      const existing = amounts.find(
        a => a.course_id === selectedCourse &&
          a.rank_id === selectedRank &&
          a.designation_type === dt.value
      )
      cells[dt.value] = {
        course_price: existing?.course_price_override != null ? String(existing.course_price_override) : '',
        back_amount: existing ? String(existing.back_amount) : '',
        customer_price: existing?.customer_price != null ? String(existing.customer_price) : '',
      }
    }
    setEditableCells(cells)
  }, [selectedCourse, selectedRank, amounts, designationTypes])

  const handleCellChange = (designationType: string, field: 'course_price' | 'back_amount' | 'customer_price', value: string) => {
    setEditableCells(prev => ({
      ...prev,
      [designationType]: { ...prev[designationType], [field]: value },
    }))
  }

  const handleSave = async () => {
    if (!selectedShop || !selectedCourse || !selectedRank) return
    setSaving(true)

    const rankId = selectedRank

    for (const dt of designationTypes) {
      const cell = editableCells[dt.value]
      // コース料金・給与バック額・合計請求額がすべて未入力の行はスキップ
      if (!cell || (cell.course_price === '' && cell.back_amount === '' && cell.customer_price === '')) continue

      const backAmount = cell.back_amount !== '' ? parseInt(cell.back_amount, 10) : 0
      if (isNaN(backAmount)) continue

      const customerPrice = cell.customer_price !== '' ? parseInt(cell.customer_price, 10) : null
      const coursePriceOverride = cell.course_price !== '' ? parseInt(cell.course_price, 10) : null

      const existing = amounts.find(
        a => a.course_id === selectedCourse &&
          a.rank_id === rankId &&
          a.designation_type === dt.value
      )

      if (existing) {
        const { error } = await supabase.from('course_back_amounts')
          .update({ back_amount: backAmount, customer_price: customerPrice, course_price_override: coursePriceOverride, updated_at: new Date().toISOString() })
          .eq('id', existing.id)
        if (error) {
          const msg = error.message || error.details || error.hint || error.code || JSON.stringify(error)
          console.error('更新エラー詳細:', { message: error.message, details: error.details, hint: error.hint, code: error.code })
          alert(`保存に失敗しました（${dt.label}）: ${msg}`)
          setSaving(false)
          return
        }
      } else {
        const { error } = await supabase.from('course_back_amounts')
          .insert([{
            shop_id: selectedShop.id,
            course_id: selectedCourse,
            rank_id: rankId,
            designation_type: dt.value,
            back_amount: backAmount,
            customer_price: customerPrice,
            course_price_override: coursePriceOverride,
          }])
        if (error) {
          const msg = error.message || error.details || error.hint || error.code || JSON.stringify(error)
          console.error('挿入エラー詳細:', { message: error.message, details: error.details, hint: error.hint, code: error.code })
          alert(`保存に失敗しました（${dt.label}）: ${msg}`)
          setSaving(false)
          return
        }
      }
    }

    alert('保存しました')
    setSaving(false)
    void fetchData()
  }

  const handleSaveExtensionRankPrices = async () => {
    if (!selectedShop) return
    setExtRankSaving(true)
    for (const rp of extensionRankPrices) {
      const { error } = await supabase
        .from('extension_rank_prices')
        .upsert({
          shop_id: selectedShop.id,
          rank_id: rp.rank_id,
          extension_unit_price: rp.extension_unit_price,
          extension_unit_back: rp.extension_unit_back,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'shop_id,rank_id' })
      if (error) { alert(`保存に失敗しました: ${error.message}`); console.error(error); setExtRankSaving(false); return }
    }
    setExtRankSaving(false)
    setExtRankSaved(true)
    setTimeout(() => setExtRankSaved(false), 2500)
  }

  const handleDelete = async (designationType: string) => {
    const rankId = selectedRank
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
  const selectedRankName = ranks.find(r => r.id === selectedRank)?.name
  const baseCoursePrice = selectedCourseName?.base_price || 0

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 md:p-8">
      <div className="mb-6">
        <h2 className="text-lg font-bold text-slate-800">コース・指名別 給与＆料金設定</h2>
        <p className="text-sm text-slate-500 mt-1">
          コース × ランク × 指名種別ごとの給与バック額と顧客料金を詳細に設定します。<br />
          <span className="text-indigo-600 font-medium">※顧客請求額 = コース料金 + 指名料 となります。</span>
        </p>
      </div>

      {/* フィルター */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1">
          <label className="block mb-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wider">対象コース</label>
          <select
            value={selectedCourse}
            onChange={(e) => setSelectedCourse(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 bg-slate-50 text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none"
          >
            {courses.map(c => (
              <option key={c.id} value={c.id}>{c.name}（{c.duration}分）</option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="block mb-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wider">対象ランク</label>
          <select
            value={selectedRank}
            onChange={(e) => setSelectedRank(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 bg-slate-50 text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none"
          >
            {ranks.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 現在の選択を表示 */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 mb-6 text-sm flex items-center gap-2">
        <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        <span className="text-indigo-900 font-medium">
          「{selectedCourseName?.name}」×「{selectedRankName}」の設定を編集中
        </span>
      </div>

      {/* マトリクス表 */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left min-w-[800px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="p-3 text-sm font-semibold text-slate-600">指名種別</th>
              <th className="p-3 text-sm font-semibold text-slate-600 w-32">コース料金</th>
              <th className="p-3 text-sm font-semibold text-slate-600 w-36">指名料</th>
              <th className="p-3 text-sm font-semibold text-slate-600 w-36">合計請求額</th>
              <th className="p-3 text-sm font-bold text-indigo-600 w-36">給与バック額</th>
              <th className="p-3 text-sm font-semibold text-slate-600 w-28">店利益</th>
              <th className="p-3 w-16"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {designationTypes.map((dt: DesignationTypeItem) => {
              const cell = editableCells[dt.value] || { course_price: '', back_amount: '', customer_price: '' }
              // 行ごとのコース料金: 入力値があればそれ、なければコースのデフォルト
              const coursePrice = cell.course_price !== '' ? (parseInt(cell.course_price, 10) || 0) : baseCoursePrice

              // 現在の合計額（未入力ならコース料金）
              const currentTotalPrice = cell.customer_price !== '' ? (parseInt(cell.customer_price, 10) || 0) : coursePrice
              // 指名料 = 合計額 - コース料金
              const nominationFee = currentTotalPrice - coursePrice

              const backNum = parseInt(cell.back_amount, 10) || 0
              const shopProfit = currentTotalPrice - backNum
              const hasValue = cell.back_amount !== '' || cell.customer_price !== '' || cell.course_price !== ''

              // 指名料の変更ハンドラ（合計額 = コース料金 + 指名料）
              const handleNominationFeeChange = (valStr: string) => {
                const nh = parseInt(valStr, 10) || 0
                const newTotal = coursePrice + nh
                handleCellChange(dt.value, 'customer_price', String(newTotal))
              }

              // コース料金変更時: 指名料を固定したまま合計額を再計算
              const handleCoursePriceChange = (valStr: string) => {
                handleCellChange(dt.value, 'course_price', valStr)
                if (cell.customer_price !== '') {
                  const newCoursePrice = parseInt(valStr, 10) || 0
                  const newTotal = newCoursePrice + nominationFee
                  handleCellChange(dt.value, 'customer_price', String(newTotal))
                }
              }

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
                        value={cell.course_price}
                        onChange={(e) => handleCoursePriceChange(e.target.value)}
                        placeholder={String(baseCoursePrice)}
                        className="w-full border border-slate-200 rounded-lg pl-7 pr-2 py-2 text-sm bg-slate-50/60 focus:ring-2 focus:ring-slate-400/50 outline-none font-medium text-slate-600"
                      />
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">¥</span>
                      <input
                        type="number"
                        value={nominationFee}
                        onChange={(e) => handleNominationFeeChange(e.target.value)}
                        className="w-full border border-slate-200 rounded-lg pl-7 pr-2 py-2 text-sm bg-white focus:ring-2 focus:ring-indigo-500/50 outline-none font-medium"
                      />
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">Σ</span>
                      <input
                        type="number"
                        min={0}
                        value={cell.customer_price}
                        onChange={(e) => handleCellChange(dt.value, 'customer_price', e.target.value)}
                        placeholder={String(coursePrice)}
                        className="w-full border border-indigo-100 rounded-lg pl-7 pr-2 py-2 text-sm bg-indigo-50/30 focus:ring-2 focus:ring-indigo-500/50 outline-none font-bold text-slate-800"
                      />
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-indigo-400 text-xs font-bold">B</span>
                      <input
                        type="number"
                        min={0}
                        value={cell.back_amount}
                        onChange={(e) => handleCellChange(dt.value, 'back_amount', e.target.value)}
                        placeholder="未設定"
                        className="w-full border border-emerald-100 rounded-lg pl-7 pr-2 py-2 text-sm bg-emerald-50/30 focus:ring-2 focus:ring-emerald-500/50 outline-none font-bold text-indigo-700"
                      />
                    </div>
                  </td>
                  <td className="p-3">
                    {hasValue && (
                      <span className={`text-sm font-bold ${shopProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        ¥{shopProfit.toLocaleString()}
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    {hasValue && (
                      <button
                        onClick={() => void handleDelete(dt.value)}
                        className="p-1.5 text-slate-300 hover:text-rose-500 transition-colors"
                        title="設定をリセット"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
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
      <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-200 transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
            )}
            設定を保存する
          </button>
          <span className="text-xs text-slate-400">※指名料・合計請求額・給与バック額のいずれかを入力した行が保存されます</span>
        </div>
      </div>

      {/* 既存の全設定一覧（サマリー） */}
      {amounts.filter(a => a.course_id === selectedCourse).length > 0 && (
        <div className="mt-12 bg-slate-50 rounded-2xl p-6 border border-slate-200">
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            <h3 className="text-sm font-bold text-slate-700">
              現在の登録済み設定一覧（{selectedCourseName?.name}）
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs min-w-[600px]">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="pb-2 font-semibold">ランク</th>
                  <th className="pb-2 font-semibold">指名種別</th>
                  <th className="pb-2 font-semibold">指名料</th>
                  <th className="pb-2 font-semibold">合計請求額</th>
                  <th className="pb-2 font-bold text-indigo-500">給与バック</th>
                  <th className="pb-2 font-semibold text-emerald-600 text-right">店利益</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/50">
                {amounts
                  .filter(a => a.course_id === selectedCourse)
                  .sort((a, b) => {
                    const rankOrder = (a.rank_id || '').localeCompare(b.rank_id || '')
                    if (rankOrder !== 0) return rankOrder
                    return designationTypes.findIndex((d: DesignationTypeItem) => d.value === a.designation_type) -
                           designationTypes.findIndex((d: DesignationTypeItem) => d.value === b.designation_type)
                  })
                  .map(a => {
                    const coursePrice = a.course_price_override ?? courses.find(c => c.id === a.course_id)?.base_price ?? 0
                    const rankName = a.rank_id ? ranks.find(r => r.id === a.rank_id)?.name || '不明' : '全ランク共通'
                    const dtLabel = designationTypes.find((d: DesignationTypeItem) => d.value === a.designation_type)?.label || a.designation_type
                    const price = a.customer_price ?? coursePrice
                    const nomFee = price - coursePrice
                    return (
                      <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 text-slate-600">{rankName}</td>
                        <td className="py-2.5 font-medium text-slate-800">{dtLabel}</td>
                        <td className="py-2.5 text-slate-600">¥{nomFee.toLocaleString()}</td>
                        <td className="py-2.5 font-bold text-slate-800">¥{price.toLocaleString()}</td>
                        <td className="py-2.5 font-bold text-indigo-600">¥{a.back_amount.toLocaleString()}</td>
                        <td className="py-2.5 font-bold text-emerald-600 text-right">¥{(price - a.back_amount).toLocaleString()}</td>
                      </tr>
                    )
                  })
                }
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* ランク別延長設定 */}
      {ranks.length > 0 && (
        <div className="mt-10 bg-white rounded-2xl border border-slate-200 p-6">
          <div className="mb-4">
            <h3 className="text-base font-bold text-slate-800">ランク別 延長料金・バック設定</h3>
            <p className="text-xs text-slate-500 mt-1">
              延長最小単位は「基本設定」で設定します。ランク未設定の場合は基本設定のデフォルト（料金 ¥{extensionDefaults.price.toLocaleString()} / バック ¥{extensionDefaults.back.toLocaleString()}）が使用されます。
            </p>
          </div>
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs">ランク</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-600 text-xs">延長料金（1回あたり）</th>
                  <th className="px-4 py-3 text-center font-semibold text-indigo-600 text-xs">延長バック（1回あたり）</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ranks.map((rank) => {
                  const rp = extensionRankPrices.find(p => p.rank_id === rank.id) || { rank_id: rank.id, extension_unit_price: 0, extension_unit_back: 0 }
                  return (
                    <tr key={rank.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-medium text-slate-700">{rank.name}</td>
                      <td className="px-4 py-3">
                        <div className="relative max-w-[160px] mx-auto">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">¥</span>
                          <input
                            type="number"
                            min={0}
                            step={100}
                            value={rp.extension_unit_price}
                            onChange={(e) => setExtensionRankPrices(prev =>
                              prev.map(p => p.rank_id === rank.id ? { ...p, extension_unit_price: Math.max(0, Number(e.target.value)) } : p)
                            )}
                            className="w-full border border-slate-200 rounded-lg bg-white pl-7 pr-2 py-2 text-sm text-right"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="relative max-w-[160px] mx-auto">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400 text-xs font-bold">B</span>
                          <input
                            type="number"
                            min={0}
                            step={100}
                            value={rp.extension_unit_back}
                            onChange={(e) => setExtensionRankPrices(prev =>
                              prev.map(p => p.rank_id === rank.id ? { ...p, extension_unit_back: Math.max(0, Number(e.target.value)) } : p)
                            )}
                            className="w-full border border-emerald-100 rounded-lg bg-emerald-50/30 pl-7 pr-2 py-2 text-sm text-right font-bold text-indigo-700"
                          />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-3 mt-4">
            <button
              type="button"
              onClick={() => void handleSaveExtensionRankPrices()}
              disabled={extRankSaving}
              className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 text-sm flex items-center gap-2"
            >
              {extRankSaving ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
              )}
              延長設定を保存する
            </button>
            {extRankSaved && (
              <span className="text-sm font-medium text-emerald-600 flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                保存しました
              </span>
            )}
          </div>
        </div>
      )}
    </div>

  )
}
