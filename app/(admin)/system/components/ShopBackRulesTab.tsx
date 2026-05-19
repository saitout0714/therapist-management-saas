'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useShop } from '@/app/contexts/ShopContext'

type ShopBackRule = {
  id: string
  shop_id: string
  course_back_amount: number
  option_back_amount: number
  nomination_back_amount: number
  discount_therapist_burden: number
  rounding_method: 'floor' | 'ceil' | 'round'
  business_day_cutoff: string
}

type FormState = {
  course_back_amount: string
  option_back_amount: string
  nomination_back_amount: string
  discount_therapist_burden: string
  rounding_method: 'floor' | 'ceil' | 'round'
  business_day_cutoff: string
}

const ROUNDING_LABELS: Record<string, string> = {
  floor: '切り捨て',
  ceil:  '切り上げ',
  round: '四捨五入',
}

const SECTIONS = [
  {
    num: '1',
    color: 'bg-indigo-100 text-indigo-600',
    border: 'border-indigo-100',
    bg: 'bg-indigo-50/50',
    label: 'コースバック',
    field: 'course_back_amount' as keyof FormState,
    description: '予約1件ごとにセラピストに支払うバック額',
    hint: 'コース×ランク×指名種別ごとの特別額は「固定額バック表」で設定でき、そちらが優先されます。',
  },
  {
    num: '2',
    color: 'bg-emerald-100 text-emerald-600',
    border: 'border-emerald-100',
    bg: 'bg-emerald-50/50',
    label: 'オプションバック',
    field: 'option_back_amount' as keyof FormState,
    description: 'オプション1件ごとにセラピストに支払うバック額',
    hint: '予約にオプションが複数ある場合、件数分が合算されます。',
  },
  {
    num: '3',
    color: 'bg-violet-100 text-violet-600',
    border: 'border-violet-100',
    bg: 'bg-violet-50/50',
    label: '指名料バック',
    field: 'nomination_back_amount' as keyof FormState,
    description: '指名料（フリー以外）でセラピストに支払うバック額',
    hint: '指名種別（初指名・本指名・写真指名など）に関わらず同額が適用されます。',
  },
  {
    num: '4',
    color: 'bg-rose-100 text-rose-600',
    border: 'border-rose-100',
    bg: 'bg-rose-50/50',
    label: '割引時のセラピスト負担額',
    field: 'discount_therapist_burden' as keyof FormState,
    description: '割引が発生した際にセラピストが負担するデフォルト額',
    hint: '割引ルールごとに負担分を個別設定している場合はそちらが優先されます。0円の場合はお店が全額負担します。',
  },
] as const

function AmountInput({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium text-sm">¥</span>
      <input
        type="number"
        min={0}
        step={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-slate-200 rounded-xl pl-7 pr-4 py-3 bg-white focus:ring-2 focus:ring-indigo-500/50 outline-none text-sm font-semibold text-slate-800 shadow-sm"
        placeholder="0"
      />
    </div>
  )
}

export function ShopBackRulesTab() {
  const { selectedShop } = useShop()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [ruleId, setRuleId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>({
    course_back_amount: '0',
    option_back_amount: '0',
    nomination_back_amount: '0',
    discount_therapist_burden: '0',
    rounding_method: 'floor',
    business_day_cutoff: '06:00',
  })

  async function fetchRule() {
    if (!selectedShop) { setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('shop_back_rules')
      .select('*')
      .eq('shop_id', selectedShop.id)
      .limit(1)

    if (data && data.length > 0) {
      const row = data[0] as ShopBackRule
      setRuleId(row.id)
      setForm({
        course_back_amount:       String(row.course_back_amount ?? 0),
        option_back_amount:       String(row.option_back_amount ?? 0),
        nomination_back_amount:   String(row.nomination_back_amount ?? 0),
        discount_therapist_burden: String(row.discount_therapist_burden ?? 0),
        rounding_method:          row.rounding_method ?? 'floor',
        business_day_cutoff:      row.business_day_cutoff?.substring(0, 5) ?? '06:00',
      })
    }
    setLoading(false)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedShop) { alert('店舗を選択してください'); return }
    setSaving(true)

    const payload = {
      shop_id:                   selectedShop.id,
      course_back_amount:        parseInt(form.course_back_amount || '0', 10),
      option_back_amount:        parseInt(form.option_back_amount || '0', 10),
      nomination_back_amount:    parseInt(form.nomination_back_amount || '0', 10),
      discount_therapist_burden: parseInt(form.discount_therapist_burden || '0', 10),
      rounding_method:           form.rounding_method,
      business_day_cutoff:       form.business_day_cutoff,
      updated_at:                new Date().toISOString(),
    }

    const result = ruleId
      ? await supabase.from('shop_back_rules').update(payload).eq('id', ruleId)
      : await supabase.from('shop_back_rules').insert([payload])

    if (result.error) {
      alert('保存に失敗しました: ' + result.error.message)
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      void fetchRule()
    }
    setSaving(false)
  }

  const setField = (field: keyof FormState, value: string) =>
    setForm((f) => ({ ...f, [field]: value }))

  useEffect(() => { void fetchRule() }, [selectedShop])

  if (loading) return (
    <div className="flex items-center justify-center py-20 text-indigo-600">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mr-3" />
      読み込み中...
    </div>
  )

  return (
    <form onSubmit={handleSave} className="max-w-2xl space-y-5">
      {/* ページ説明 */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <h2 className="text-base font-bold text-slate-800 mb-1">デフォルトバック設定</h2>
        <p className="text-sm text-slate-500">
          この店舗全体に適用される基本のバック額を設定します。
          コースごと・ランクごとの特別ルールは「固定額バック表」タブで設定でき、そちらが優先されます。
        </p>
      </div>

      {/* 各バック設定セクション */}
      {SECTIONS.map((section) => (
        <div
          key={section.field}
          className={`bg-white rounded-2xl shadow-sm border ${section.border} overflow-hidden`}
        >
          <div className={`px-6 py-4 ${section.bg} border-b ${section.border} flex items-center gap-3`}>
            <span className={`w-7 h-7 rounded-full ${section.color} flex items-center justify-center text-xs font-bold flex-shrink-0`}>
              {section.num}
            </span>
            <div>
              <p className="text-sm font-bold text-slate-800">{section.label}</p>
              <p className="text-xs text-slate-500 mt-0.5">{section.description}</p>
            </div>
          </div>
          <div className="px-6 py-5">
            <AmountInput
              value={form[section.field] as string}
              onChange={(v) => setField(section.field, v)}
            />
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">{section.hint}</p>
          </div>
        </div>
      ))}

      {/* その他設定 */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100 flex items-center gap-3">
          <span className="w-7 h-7 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold flex-shrink-0">5</span>
          <p className="text-sm font-bold text-slate-800">その他の設定</p>
        </div>
        <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2">端数処理</label>
            <select
              value={form.rounding_method}
              onChange={(e) => setField('rounding_method', e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-3 bg-white focus:ring-2 focus:ring-indigo-500/50 outline-none text-sm shadow-sm"
            >
              {Object.entries(ROUNDING_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2">営業日切替時刻</label>
            <input
              type="time"
              value={form.business_day_cutoff}
              onChange={(e) => setField('business_day_cutoff', e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-3 bg-white focus:ring-2 focus:ring-indigo-500/50 outline-none text-sm shadow-sm"
            />
            <p className="text-xs text-slate-400 mt-1.5">この時刻より前の予約は前日の営業扱いになります</p>
          </div>
        </div>
      </div>

      {/* 保存ボタン */}
      <div className="flex items-center gap-4 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-sm text-sm"
        >
          {saving ? '保存中...' : '保存する'}
        </button>
        {saved && (
          <span className="text-sm font-medium text-emerald-600 flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            保存しました
          </span>
        )}
      </div>
    </form>
  )
}
