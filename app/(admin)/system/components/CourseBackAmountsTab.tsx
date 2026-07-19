'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useShop } from '@/app/contexts/ShopContext'

type Course = { id: string; name: string; duration: number; base_price: number }
type Rank = { id: string; name: string }
type ExtensionRankPrice = { rank_id: string; extension_unit_price: number; extension_unit_back: number }
type DiscountPolicy = { id: string; name: string; therapist_burden_amount: number | null; is_active: boolean }
type DiscountRankOverride = { id?: string; discount_policy_id: string; rank_id: string; therapist_burden_amount: number }
type BackAmount = {
  id: string
  shop_id: string
  course_id: string
  rank_id: string | null
  designation_type: string
  back_amount: number
  customer_price: number | null
  course_price_override: number | null
  nomination_back_amount: number | null
}

type DesignationTypeItem = { value: string; label: string; default_fee: number; default_back_amount: number }

export function CourseBackAmountsTab() {
  const { selectedShop } = useShop()
  const [courses, setCourses] = useState<Course[]>([])
  const [ranks, setRanks] = useState<Rank[]>([])
  const [amounts, setAmounts] = useState<BackAmount[]>([])
  const [designationTypes, setDesignationTypes] = useState<DesignationTypeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedRank, setSelectedRank] = useState<string>('')
  
  // editableCells: key = `${rankId}-${courseId}-${designation_type}` => { course_price, customer_price, course_back, nomination_back }
  const [editableCells, setEditableCells] = useState<Record<string, { course_price: string; customer_price: string; course_back: string; nomination_back: string }>>({})
  
  const [extensionRankPrices, setExtensionRankPrices] = useState<ExtensionRankPrice[]>([])
  const [extensionDefaults, setExtensionDefaults] = useState({ price: 0, back: 0 })
  const [extRankSaving, setExtRankSaving] = useState(false)
  const [extRankSaved, setExtRankSaved] = useState(false)
  const [discountPolicies, setDiscountPolicies] = useState<DiscountPolicy[]>([])
  const [discountRankOverrides, setDiscountRankOverrides] = useState<DiscountRankOverride[]>([])
  const [discountRankSaving, setDiscountRankSaving] = useState(false)
  const [discountRankSaved, setDiscountRankSaved] = useState(false)

  const fetchData = useCallback(async () => {
    if (!selectedShop) { setLoading(false); return }
    setLoading(true)

    const [coursesRes, ranksRes, amountsRes, dtRes, extPricesRes, settingsRes, discountPoliciesRes, discountRankOverridesRes] = await Promise.all([
      supabase.from('courses').select('id, name, duration, base_price').eq('shop_id', selectedShop.id).eq('is_active', true).order('display_order'),
      supabase.from('therapist_ranks').select('id, name').eq('shop_id', selectedShop.id).order('display_order'),
      supabase.from('course_back_amounts').select('*').eq('shop_id', selectedShop.id),
      supabase.from('designation_types').select('slug, display_name, default_fee, default_back_amount').eq('shop_id', selectedShop.id).eq('is_active', true).order('display_order'),
      supabase.from('extension_rank_prices').select('rank_id, extension_unit_price, extension_unit_back').eq('shop_id', selectedShop.id),
      supabase.from('system_settings').select('extension_unit_price, extension_unit_back').eq('shop_id', selectedShop.id).limit(1),
      supabase.from('discount_policies').select('id, name, therapist_burden_amount, is_active').eq('shop_id', selectedShop.id).eq('is_active', true).order('created_at', { ascending: true }),
      supabase.from('discount_rank_overrides').select('id, discount_policy_id, rank_id, therapist_burden_amount').eq('shop_id', selectedShop.id),
    ])

    const c = (coursesRes.data as Course[]) || []
    const r = (ranksRes.data as Rank[]) || []
    const a = (amountsRes.data as BackAmount[]) || []
    const dt = ((dtRes.data || []) as { slug: string; display_name: string; default_fee: number | null; default_back_amount: number | null }[]).map(d => ({
      value: d.slug,
      label: d.display_name,
      default_fee: d.default_fee || 0,
      default_back_amount: d.default_back_amount || 0
    }))

    setCourses(c)
    setRanks(r)
    setAmounts(a)
    const activeDt = dt.length > 0 ? dt : [
      { value: 'free', label: 'フリー', default_fee: 0, default_back_amount: 0 },
      { value: 'first_nomination', label: '初指名', default_fee: 1000, default_back_amount: 1000 },
      { value: 'confirmed', label: '本指名', default_fee: 2000, default_back_amount: 2000 },
    ]
    setDesignationTypes(activeDt)

    const fetchedExtPrices = (extPricesRes.data || []) as ExtensionRankPrice[]
    setExtensionRankPrices(
      r.map(rank => {
        const existing = fetchedExtPrices.find(p => p.rank_id === rank.id)
        return { rank_id: rank.id, extension_unit_price: existing?.extension_unit_price ?? 0, extension_unit_back: existing?.extension_unit_back ?? 0 }
      })
    )
    const ss = settingsRes.data?.[0] as { extension_unit_price?: number; extension_unit_back?: number } | undefined
    setExtensionDefaults({ price: ss?.extension_unit_price ?? 0, back: ss?.extension_unit_back ?? 0 })

    const fetchedPolicies = (discountPoliciesRes.data || []) as DiscountPolicy[]
    const fetchedOverrides = (discountRankOverridesRes.data || []) as DiscountRankOverride[]
    setDiscountPolicies(fetchedPolicies)

    const allCombinations: DiscountRankOverride[] = []
    for (const rank of r) {
      for (const policy of fetchedPolicies) {
        const existing = fetchedOverrides.find(
          o => o.discount_policy_id === policy.id && o.rank_id === rank.id
        )
        allCombinations.push({
          id: existing?.id,
          discount_policy_id: policy.id,
          rank_id: rank.id,
          therapist_burden_amount: existing?.therapist_burden_amount ?? (policy.therapist_burden_amount ?? 0),
        })
      }
    }
    setDiscountRankOverrides(allCombinations)

    setSelectedRank(prev => prev || (r.length > 0 ? r[0].id : ''))
    setLoading(false)
  }, [selectedShop])

  useEffect(() => { void fetchData() }, [fetchData])

  // 全てのランク×コース×指名種別の組み合わせの初期入力値を設定
  useEffect(() => {
    const cells: Record<string, { course_price: string; customer_price: string; course_back: string; nomination_back: string }> = {}

    for (const r of ranks) {
      for (const c of courses) {
        for (const dt of designationTypes) {
          const key = `${r.id}-${c.id}-${dt.value}`
          const existing = amounts.find(
            a => a.course_id === c.id &&
              a.rank_id === r.id &&
              a.designation_type === dt.value
          )

          let nominationBack = ''
          let courseBack = ''

          if (existing) {
            if (existing.nomination_back_amount != null) {
              nominationBack = String(existing.nomination_back_amount)
              courseBack = String(Math.max(0, existing.back_amount - existing.nomination_back_amount))
            } else {
              // 古いデータで nomination_back_amount が NULL の場合
              // デフォルトの比率または店舗設定を適用して分離する
              const defaultBack = dt.default_back_amount
              const defaultFee = dt.default_fee
              if (dt.value === 'free') {
                nominationBack = '0'
                courseBack = String(existing.back_amount)
              } else if (defaultFee > 0 && defaultBack > 0) {
                const ratio = defaultBack / defaultFee
                // コース料金と合計請求額の差額（=指名料）
                const coursePriceOverride = existing.course_price_override != null ? existing.course_price_override : c.base_price
                const customerPrice = existing.customer_price != null ? existing.customer_price : coursePriceOverride
                const nominationFee = Math.max(0, customerPrice - coursePriceOverride)
                const calculatedNomBack = Math.round(nominationFee * ratio)

                nominationBack = String(calculatedNomBack)
                courseBack = String(Math.max(0, existing.back_amount - calculatedNomBack))
              } else {
                nominationBack = '0'
                courseBack = String(existing.back_amount)
              }
            }
          }

          cells[key] = {
            course_price: existing?.course_price_override != null ? String(existing.course_price_override) : '',
            customer_price: existing?.customer_price != null ? String(existing.customer_price) : '',
            course_back: courseBack,
            nomination_back: nominationBack,
          }
        }
      }
    }
    setEditableCells(cells)
  }, [amounts, designationTypes, courses, ranks])

  const handleCellChange = (rankId: string, courseId: string, designationType: string, field: 'course_price' | 'customer_price' | 'course_back' | 'nomination_back', value: string) => {
    const key = `${rankId}-${courseId}-${designationType}`
    setEditableCells(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }))
  }

  // ランク間の全設定コピー機能
  const handleCopyRankSettings = (fromRankId: string, toRankId: string) => {
    if (toRankId === 'all') {
      if (!confirm('現在のランクの全コース設定を、他のすべてのランクへ上書きコピーしますか？')) return
      setEditableCells(prev => {
        const newCells = { ...prev }
        ranks.forEach(r => {
          if (r.id !== fromRankId) {
            courses.forEach(c => {
              designationTypes.forEach(dt => {
                const fromKey = `${fromRankId}-${c.id}-${dt.value}`
                const toKey = `${r.id}-${c.id}-${dt.value}`
                if (prev[fromKey]) {
                  newCells[toKey] = { ...prev[fromKey] }
                }
              })
            })
          }
        })
        return newCells
      })
      alert('他のすべてのランクへ設定を複製しました（保存ボタンを押すまで保存されません）。')
    } else {
      setEditableCells(prev => {
        const newCells = { ...prev }
        courses.forEach(c => {
          designationTypes.forEach(dt => {
            const fromKey = `${fromRankId}-${c.id}-${dt.value}`
            const toKey = `${toRankId}-${c.id}-${dt.value}`
            if (prev[fromKey]) {
              newCells[toKey] = { ...prev[fromKey] }
            }
          })
        })
        return newCells
      })
      const toRankName = ranks.find(r => r.id === toRankId)?.name || ''
      alert(`「${toRankName}」へ全設定を複製しました（保存ボタンを押すまで保存されません）。`)
    }
  }

  // コース間のコピー機能（現在選択中のランク内）
  const handleCopyCourseSettings = (fromCourseId: string, toCourseId: string) => {
    if (toCourseId === 'all') {
      if (!confirm('このコースの設定内容を、現在のランクの他のすべてのコースへコピーしますか？')) return
      setEditableCells(prev => {
        const newCells = { ...prev }
        courses.forEach(c => {
          if (c.id !== fromCourseId) {
            designationTypes.forEach(dt => {
              const fromKey = `${selectedRank}-${fromCourseId}-${dt.value}`
              const toKey = `${selectedRank}-${c.id}-${dt.value}`
              if (prev[fromKey]) {
                newCells[toKey] = { ...prev[fromKey] }
              }
            })
          }
        })
        return newCells
      })
      alert('他のすべてのコースへ設定を複製しました（保存ボタンを押すまで保存されません）。')
    } else {
      setEditableCells(prev => {
        const newCells = { ...prev }
        designationTypes.forEach(dt => {
          const fromKey = `${selectedRank}-${fromCourseId}-${dt.value}`
          const toKey = `${selectedRank}-${toCourseId}-${dt.value}`
          if (prev[fromKey]) {
            newCells[toKey] = { ...prev[fromKey] }
          }
        })
        return newCells
      })
      const toCourseName = courses.find(c => c.id === toCourseId)?.name || ''
      alert(`「${toCourseName}」へ設定を複製しました（保存ボタンを押すまで保存されません）。`)
    }
  }

  const handleSave = async () => {
    if (!selectedShop || !selectedRank) return
    setSaving(true)

    try {
      const promises = []

      for (const c of courses) {
        for (const dt of designationTypes) {
          const key = `${selectedRank}-${c.id}-${dt.value}`
          const cell = editableCells[key]
          if (!cell) continue

          const coursePriceOverride = cell.course_price !== '' ? parseInt(cell.course_price, 10) : null
          const customerPrice = cell.customer_price !== '' ? parseInt(cell.customer_price, 10) : null
          const courseBack = cell.course_back !== '' ? parseInt(cell.course_back, 10) : null
          const nominationBack = cell.nomination_back !== '' ? parseInt(cell.nomination_back, 10) : null

          const existing = amounts.find(
            a => a.course_id === c.id &&
              a.rank_id === selectedRank &&
              a.designation_type === dt.value
          )

          // 項目がすべて空の場合
          if (cell.course_price === '' && cell.customer_price === '' && cell.course_back === '' && cell.nomination_back === '') {
            // もし既存設定がある場合は、設定がクリアされたとみなして削除する
            if (existing) {
              promises.push(supabase.from('course_back_amounts').delete().eq('id', existing.id))
            }
            continue
          }

          const finalBackAmount = (courseBack || 0) + (nominationBack || 0)
          const finalNominationBackAmount = nominationBack !== null ? nominationBack : null

          if (existing) {
            promises.push(
              supabase.from('course_back_amounts')
                .update({
                  back_amount: finalBackAmount,
                  nomination_back_amount: finalNominationBackAmount,
                  customer_price: customerPrice,
                  course_price_override: coursePriceOverride,
                  updated_at: new Date().toISOString()
                })
                .eq('id', existing.id)
            )
          } else {
            promises.push(
              supabase.from('course_back_amounts')
                .insert([{
                  shop_id: selectedShop.id,
                  course_id: c.id,
                  rank_id: selectedRank,
                  designation_type: dt.value,
                  back_amount: finalBackAmount,
                  nomination_back_amount: finalNominationBackAmount,
                  customer_price: customerPrice,
                  course_price_override: coursePriceOverride,
                }])
            )
          }
        }
      }

      if (promises.length > 0) {
        const results = await Promise.all(promises)
        const errorResult = results.find(res => res.error)
        if (errorResult && errorResult.error) {
          console.error(errorResult.error)
          alert(`一部またはすべての保存に失敗しました: ${errorResult.error.message}`)
          setSaving(false)
          return
        }
      }

      alert('選択したランクのすべてのコース設定を一括保存しました')
      void fetchData()
    } catch (err: any) {
      console.error(err)
      alert('保存中にエラーが発生しました')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveExtensionRankPrices = async () => {
    if (!selectedShop) return
    setExtRankSaving(true)
    try {
      const promises = extensionRankPrices.map(rp =>
        supabase
          .from('extension_rank_prices')
          .upsert({
            shop_id: selectedShop.id,
            rank_id: rp.rank_id,
            extension_unit_price: rp.extension_unit_price,
            extension_unit_back: rp.extension_unit_back,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'shop_id,rank_id' })
      )
      const results = await Promise.all(promises)
      const errorResult = results.find(res => res.error)
      if (errorResult && errorResult.error) {
        alert(`保存に失敗しました: ${errorResult.error.message}`)
      } else {
        setExtRankSaved(true)
        setTimeout(() => setExtRankSaved(false), 2500)
      }
    } catch (err) {
      console.error(err)
      alert('保存中にエラーが発生しました')
    } finally {
      setExtRankSaving(false)
    }
  }

  const handleSaveDiscountRankOverrides = async () => {
    if (!selectedShop) return
    setDiscountRankSaving(true)
    try {
      const promises = discountRankOverrides.map(override =>
        supabase
          .from('discount_rank_overrides')
          .upsert({
            shop_id: selectedShop.id,
            discount_policy_id: override.discount_policy_id,
            rank_id: override.rank_id,
            therapist_burden_amount: override.therapist_burden_amount,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'discount_policy_id,rank_id' })
      )
      const results = await Promise.all(promises)
      const errorResult = results.find(res => res.error)
      if (errorResult && errorResult.error) {
        alert(`保存に失敗しました: ${errorResult.error.message}`)
      } else {
        setDiscountRankSaved(true)
        setTimeout(() => setDiscountRankSaved(false), 2500)
        void fetchData()
      }
    } catch (err) {
      console.error(err)
      alert('保存中にエラーが発生しました')
    } finally {
      setDiscountRankSaving(false)
    }
  }

  const getDiscountOverride = (policyId: string, rankId: string) =>
    discountRankOverrides.find(o => o.discount_policy_id === policyId && o.rank_id === rankId)

  const setDiscountOverrideValue = (policyId: string, rankId: string, amount: number) => {
    setDiscountRankOverrides(prev => {
      const existing = prev.find(o => o.discount_policy_id === policyId && o.rank_id === rankId)
      if (existing) {
        return prev.map(o =>
          o.discount_policy_id === policyId && o.rank_id === rankId
            ? { ...o, therapist_burden_amount: amount }
            : o
        )
      }
      return [...prev, { discount_policy_id: policyId, rank_id: rankId, therapist_burden_amount: amount }]
    })
  }

  const handleDelete = async (rankId: string, courseId: string, designationType: string) => {
    const existing = amounts.find(
      a => a.course_id === courseId &&
        a.rank_id === rankId &&
        a.designation_type === designationType
    )
    if (!existing) return
    if (!confirm('この設定をリセット（削除）しますか？')) return
    const { error } = await supabase.from('course_back_amounts').delete().eq('id', existing.id)
    if (error) {
      alert('削除に失敗しました')
    } else {
      void fetchData()
    }
  }

  if (loading) return <div className="p-6">読み込み中...</div>

  return (
    <div className="space-y-8">
      {/* メインの料金＆給与バック設定エリア */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 md:p-5">
        <div className="mb-6">
          <h2 className="text-lg font-bold text-slate-800">コース・指名別 給与＆料金設定</h2>
          <p className="text-sm text-slate-500 mt-1">
            対象となるセラピストランクを選択し、各コース × 指名種別ごとの給与バック額とコース料金設定を一括編集します。<br />
            <span className="text-indigo-600 font-medium">※未入力の項目はデフォルト値（薄い文字）が自動適用されます。</span>
          </p>
        </div>

        {/* ランク選択フィルター */}
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/60 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="w-full max-w-md">
            <label className="block mb-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wider">対象ランク</label>
            <select
              value={selectedRank}
              onChange={(e) => setSelectedRank(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 bg-white text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none font-medium text-slate-800"
            >
              {ranks.map(r => (
                <option key={r.id} value={r.id}>{r.name} ランク</option>
              ))}
            </select>
          </div>

          {/* ランク全体のコピー */}
          <div className="flex flex-col text-xs w-full md:w-auto">
            <span className="text-slate-500 font-semibold mb-1">このランクの全設定を他のランクにコピー:</span>
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  handleCopyRankSettings(selectedRank, e.target.value)
                }
              }}
              className="border border-slate-200 rounded-lg px-3 py-2 bg-white text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/50"
            >
              <option value="">コピー先を選択...</option>
              <option value="all">他のすべてのランク</option>
              {ranks.filter(r => r.id !== selectedRank).map(r => (
                <option key={r.id} value={r.id}>{r.name} ランク</option>
              ))}
            </select>
          </div>
        </div>

        {/* コースごとの設定テーブルをループ表示 */}
        <div className="space-y-8">
          {courses.map(course => (
            <div key={course.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              {/* カードヘッダー */}
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                  {course.name}（{course.duration}分、基本料金: ¥{course.base_price.toLocaleString()}）
                </span>
                
                {/* コース内のコピー＆ペースト複製機能 */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500 font-medium">このコースの設定をコピー:</span>
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) {
                        handleCopyCourseSettings(course.id, e.target.value)
                      }
                    }}
                    className="border border-slate-200 rounded px-2 py-1 bg-white text-xs text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">コピー先を選択...</option>
                    <option value="all">他のすべてのコース</option>
                    {courses.filter(c => c.id !== course.id).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* カードボディ：マトリクス表 */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left min-w-[850px]">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="p-3 w-28">指名種別</th>
                      <th className="p-3 w-28">コース料金</th>
                      <th className="p-3 w-28">指名料</th>
                      <th className="p-3 w-32">合計請求額</th>
                      <th className="p-3 w-32 text-indigo-600">コースバック</th>
                      <th className="p-3 w-32 text-indigo-600">指名バック</th>
                      <th className="p-3 w-28 text-slate-500">給与バック合計</th>
                      <th className="p-3 w-28">店利益</th>
                      <th className="p-3 w-14"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {designationTypes.map(dt => {
                      const cellKey = `${selectedRank}-${course.id}-${dt.value}`
                      const cell = editableCells[cellKey] || { course_price: '', customer_price: '', course_back: '', nomination_back: '' }
                      
                      const baseCoursePrice = course.base_price
                      const coursePrice = cell.course_price !== '' ? (parseInt(cell.course_price, 10) || 0) : baseCoursePrice
                      const currentTotalPrice = cell.customer_price !== '' ? (parseInt(cell.customer_price, 10) || 0) : coursePrice
                      const nominationFee = currentTotalPrice - coursePrice

                      const courseBackNum = cell.course_back !== '' ? (parseInt(cell.course_back, 10) || 0) : 0
                      const nominationBackNum = cell.nomination_back !== '' ? (parseInt(cell.nomination_back, 10) || 0) : 0
                      const totalBackNum = (cell.course_back !== '' || cell.nomination_back !== '') ? (courseBackNum + nominationBackNum) : null
                      const shopProfit = totalBackNum !== null ? (currentTotalPrice - totalBackNum) : (currentTotalPrice - 0)
                      const hasValue = cell.course_price !== '' || cell.customer_price !== '' || cell.course_back !== '' || cell.nomination_back !== ''

                      const handleNominationFeeChangeLocal = (valStr: string) => {
                        const nh = parseInt(valStr, 10) || 0
                        const newTotal = coursePrice + nh
                        handleCellChange(selectedRank, course.id, dt.value, 'customer_price', String(newTotal))
                      }

                      const handleCoursePriceChangeLocal = (valStr: string) => {
                        handleCellChange(selectedRank, course.id, dt.value, 'course_price', valStr)
                        if (cell.customer_price !== '') {
                          const newCoursePrice = parseInt(valStr, 10) || 0
                          const newTotal = newCoursePrice + nominationFee
                          handleCellChange(selectedRank, course.id, dt.value, 'customer_price', String(newTotal))
                        }
                      }

                      return (
                        <tr key={dt.value} className="hover:bg-slate-50/30 transition-colors">
                          <td className="p-3">
                            <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                              dt.value === 'free' ? 'bg-slate-100 text-slate-700' :
                              dt.value === 'confirmed' ? 'bg-rose-50 text-rose-700 border border-rose-100' :
                              dt.value === 'first_nomination' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                              'bg-indigo-50 text-indigo-700 border border-indigo-100'
                            }`}>
                              {dt.label}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]">¥</span>
                              <input
                                type="number"
                                min={0}
                                value={cell.course_price}
                                onChange={(e) => handleCoursePriceChangeLocal(e.target.value)}
                                placeholder={String(baseCoursePrice)}
                                className="w-full border border-slate-200 rounded px-6 py-1.5 bg-slate-50/60 focus:ring-1 focus:ring-slate-400 outline-none text-slate-600 font-medium"
                              />
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]">¥</span>
                              <input
                                type="number"
                                value={nominationFee}
                                onChange={(e) => handleNominationFeeChangeLocal(e.target.value)}
                                className="w-full border border-slate-200 rounded px-6 py-1.5 bg-white focus:ring-1 focus:ring-indigo-500 outline-none text-slate-700 font-medium"
                              />
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">Σ</span>
                              <input
                                type="number"
                                min={0}
                                value={cell.customer_price}
                                onChange={(e) => handleCellChange(selectedRank, course.id, dt.value, 'customer_price', e.target.value)}
                                placeholder={String(coursePrice)}
                                className="w-full border border-indigo-100 rounded px-6 py-1.5 bg-indigo-50/30 focus:ring-1 focus:ring-indigo-500 outline-none font-bold text-slate-800"
                              />
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-emerald-400 font-bold">¥</span>
                              <input
                                type="number"
                                min={0}
                                value={cell.course_back}
                                onChange={(e) => handleCellChange(selectedRank, course.id, dt.value, 'course_back', e.target.value)}
                                placeholder="未設定"
                                className="w-full border border-emerald-100 rounded px-6 py-1.5 bg-emerald-50/30 focus:ring-1 focus:ring-emerald-500 outline-none font-bold text-indigo-700"
                              />
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-emerald-400 font-bold">¥</span>
                              <input
                                type="number"
                                min={0}
                                value={dt.value === 'free' ? '0' : cell.nomination_back}
                                disabled={dt.value === 'free'}
                                onChange={(e) => handleCellChange(selectedRank, course.id, dt.value, 'nomination_back', e.target.value)}
                                placeholder={dt.value === 'free' ? '0' : String(dt.default_back_amount)}
                                className="w-full border border-emerald-100 rounded px-6 py-1.5 bg-emerald-50/30 focus:ring-1 focus:ring-emerald-500 outline-none font-bold text-indigo-700 disabled:bg-slate-100/50 disabled:text-slate-400"
                              />
                            </div>
                          </td>
                          <td className="p-3 font-bold text-indigo-800 text-sm text-center">
                            {totalBackNum !== null ? (
                              <span>¥{totalBackNum.toLocaleString()}</span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                          <td className="p-3 font-semibold">
                            {hasValue && (
                              <span className={shopProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                                ¥{shopProfit.toLocaleString()}
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            {hasValue && (
                              <button
                                onClick={() => void handleDelete(selectedRank, course.id, dt.value)}
                                className="text-slate-300 hover:text-rose-500 p-1"
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
            </div>
          ))}
        </div>

        {/* 一括保存ボタン */}
        <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center gap-4">
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-200 transition-all disabled:opacity-50 flex items-center gap-2 text-sm"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
            )}
            このランクの全設定を一括保存する
          </button>
          <span className="text-xs text-slate-400">※変更された項目（どれかに入力された行）のみがデータベースに自動反映されます。</span>
        </div>
      </div>

      {/* 延長料金・バックの全ランク一元管理 */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 md:p-5">
        <div className="mb-5">
          <h3 className="text-base font-bold text-slate-800">延長料金・バック設定</h3>
          <p className="text-sm text-slate-500 mt-1">
            セラピストランクごとの延長1回あたりの料金と給与バック額を設定します。<br />
            <span className="text-slate-400">※未入力の項目はデフォルト値（料金 ¥{extensionDefaults.price.toLocaleString()} / バック ¥{extensionDefaults.back.toLocaleString()}）が使用されます。</span>
          </p>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-xs min-w-[500px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="px-4 py-3 text-left w-36">ランク</th>
                <th className="px-4 py-3 text-center w-48">延長料金 (1回あたり)</th>
                <th className="px-4 py-3 text-center w-48 text-indigo-600">延長バック (1回あたり)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ranks.map(rank => {
                const rp = extensionRankPrices.find(p => p.rank_id === rank.id) || { rank_id: rank.id, extension_unit_price: 0, extension_unit_back: 0 }
                return (
                  <tr key={rank.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-semibold text-slate-700">{rank.name}</td>
                    <td className="px-4 py-3">
                      <div className="relative max-w-[160px] mx-auto">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">¥</span>
                        <input
                          type="number"
                          min={0}
                          step={100}
                          value={rp.extension_unit_price || ''}
                          onChange={(e) => setExtensionRankPrices(prev =>
                            prev.map(p => p.rank_id === rank.id ? { ...p, extension_unit_price: Math.max(0, Number(e.target.value)) } : p)
                          )}
                          placeholder={String(extensionDefaults.price)}
                          className="w-full border border-slate-200 rounded px-6 py-1.5 text-right font-medium focus:ring-1 focus:ring-slate-400 outline-none"
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="relative max-w-[160px] mx-auto">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400 font-bold">¥</span>
                        <input
                          type="number"
                          min={0}
                          step={100}
                          value={rp.extension_unit_back || ''}
                          onChange={(e) => setExtensionRankPrices(prev =>
                            prev.map(p => p.rank_id === rank.id ? { ...p, extension_unit_back: Math.max(0, Number(e.target.value)) } : p)
                          )}
                          placeholder={String(extensionDefaults.back)}
                          className="w-full border border-indigo-100 rounded bg-indigo-50/30 px-6 py-1.5 text-right font-bold text-indigo-700 focus:ring-1 focus:ring-indigo-500 outline-none"
                        />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center gap-3 mt-5">
          <button
            type="button"
            onClick={() => void handleSaveExtensionRankPrices()}
            disabled={extRankSaving}
            className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 text-xs flex items-center gap-2"
          >
            {extRankSaving ? (
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
            )}
            すべての延長設定を保存する
          </button>
          {extRankSaved && (
            <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              保存しました
            </span>
          )}
        </div>
      </div>

      {/* 割引負担額の全ランク一元管理 */}
      {discountPolicies.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 md:p-5">
          <div className="mb-5">
            <h3 className="text-base font-bold text-slate-800">割引セラピスト負担額</h3>
            <p className="text-xs text-slate-500 mt-1">
              割引発生時のセラピスト負担額をランクごとに一元管理します。<br />
              <span className="text-slate-400">※未設定の箇所はデフォルト値（表ヘッダーに記載）が使用されます。</span>
            </p>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-xs min-w-[600px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <th className="px-4 py-3 text-left w-36">ランク</th>
                  {discountPolicies.map(policy => (
                    <th key={policy.id} className="px-4 py-3 text-center">
                      {policy.name}
                      <span className="text-[9px] text-slate-400 block font-normal mt-0.5">(デフォルト: ¥{(policy.therapist_burden_amount ?? 0).toLocaleString()})</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ranks.map(rank => (
                  <tr key={rank.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-semibold text-slate-700">{rank.name}</td>
                    {discountPolicies.map(policy => {
                      const override = getDiscountOverride(policy.id, rank.id)
                      const value = override ? override.therapist_burden_amount : (policy.therapist_burden_amount ?? 0)
                      return (
                        <td key={policy.id} className="px-4 py-3">
                          <div className="relative max-w-[140px] mx-auto">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400 font-bold">¥</span>
                            <input
                              type="number"
                              min={0}
                              step={100}
                              value={value}
                              onChange={(e) => setDiscountOverrideValue(policy.id, rank.id, Math.max(0, Number(e.target.value)))}
                              className="w-full border border-indigo-100 rounded bg-indigo-50/30 px-6 py-1.5 text-right font-bold text-indigo-700 focus:ring-1 focus:ring-indigo-500 outline-none"
                            />
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-3 mt-5">
            <button
              type="button"
              onClick={() => void handleSaveDiscountRankOverrides()}
              disabled={discountRankSaving}
              className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 text-xs flex items-center gap-2"
            >
              {discountRankSaving ? (
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
              )}
              すべての割引設定を保存する
            </button>
            {discountRankSaved && (
              <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
