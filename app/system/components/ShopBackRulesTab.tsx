'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useShop } from '@/app/contexts/ShopContext'

type ShopBackRule = {
  id: string
  shop_id: string
  course_calc_type: 'percentage' | 'fixed'
  course_back_rate: number
  option_calc_type: 'full_back' | 'percentage' | 'fixed' | 'per_item'
  option_back_rate: number
  nomination_calc_type: 'full_back' | 'percentage' | 'fixed'
  nomination_back_rate: number
  rounding_method: 'floor' | 'ceil' | 'round'
  business_day_cutoff: string
}

const CALC_TYPE_LABELS: Record<string, string> = {
  percentage: 'パーセンテージ（%）',
  fixed: '固定額（マトリクス表）',
  full_back: 'フルバック（100%）',
  per_item: 'オプション個別設定',
}

const ROUNDING_LABELS: Record<string, string> = {
  floor: '切り捨て（セラピスト不利）',
  ceil: '切り上げ（セラピスト有利）',
  round: '四捨五入',
}

export function ShopBackRulesTab() {
  const { selectedShop } = useShop()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [rule, setRule] = useState<ShopBackRule | null>(null)
  const [form, setForm] = useState({
    course_calc_type: 'percentage' as 'percentage' | 'fixed',
    course_back_rate: 50,
    option_calc_type: 'full_back' as 'full_back' | 'percentage' | 'fixed' | 'per_item',
    option_back_rate: 100,
    nomination_calc_type: 'full_back' as 'full_back' | 'percentage' | 'fixed',
    nomination_back_rate: 100,
    rounding_method: 'floor' as 'floor' | 'ceil' | 'round',
    business_day_cutoff: '06:00',
  })

  async function fetchRule() {
    if (!selectedShop) {
      setRule(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from('shop_back_rules')
      .select('*')
      .eq('shop_id', selectedShop.id)
      .limit(1)

    if (error) {
      console.error('Failed to fetch shop_back_rules:', error)
    } else if (data && data.length > 0) {
      const row = data[0] as ShopBackRule
      setRule(row)
      setForm({
        course_calc_type: row.course_calc_type,
        course_back_rate: Number(row.course_back_rate),
        option_calc_type: row.option_calc_type,
        option_back_rate: Number(row.option_back_rate),
        nomination_calc_type: row.nomination_calc_type,
        nomination_back_rate: Number(row.nomination_back_rate),
        rounding_method: row.rounding_method,
        business_day_cutoff: row.business_day_cutoff?.substring(0, 5) || '06:00',
      })
    }
    setLoading(false)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedShop) {
      alert('店舗を選択してください')
      return
    }
    setSaving(true)

    const payload = {
      ...form,
      shop_id: selectedShop.id,
      updated_at: new Date().toISOString(),
    }

    const result = rule?.id
      ? await supabase.from('shop_back_rules').update(payload).eq('id', rule.id)
      : await supabase.from('shop_back_rules').insert([payload])

    if (result.error) {
      console.error('Save error:', result.error)
      alert('保存に失敗しました: ' + result.error.message)
    } else {
      alert('バック設定を保存しました')
      void fetchRule()
    }
    setSaving(false)
  }

  useEffect(() => {
    void fetchRule()
  }, [selectedShop])

  if (loading) return <div className="p-6">読み込み中...</div>

  return (
    <form onSubmit={handleSave} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 md:p-8 max-w-4xl">
      <div className="mb-6">
        <h2 className="text-lg font-bold text-slate-800">バック計算設定</h2>
        <p className="text-sm text-slate-500 mt-1">この店舗のデフォルトのバック計算方式を設定します。</p>
      </div>

      {/* コースバック設定 */}
      <div className="mb-8">
        <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">1</span>
          コース料金のバック方式
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-8">
          <div>
            <label className="block mb-1.5 text-sm font-medium text-slate-600">計算方式</label>
            <select
              value={form.course_calc_type}
              onChange={(e) => setForm({ ...form, course_calc_type: e.target.value as 'percentage' | 'fixed' })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 bg-slate-50 focus:ring-2 focus:ring-indigo-500/50 outline-none text-sm"
            >
              <option value="percentage">{CALC_TYPE_LABELS.percentage}</option>
              <option value="fixed">{CALC_TYPE_LABELS.fixed}</option>
            </select>
          </div>
          {form.course_calc_type === 'percentage' && (
            <div>
              <label className="block mb-1.5 text-sm font-medium text-slate-600">バック率（%）</label>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  value={form.course_back_rate}
                  onChange={(e) => setForm({ ...form, course_back_rate: Number(e.target.value) })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 pr-8 bg-slate-50 focus:ring-2 focus:ring-indigo-500/50 outline-none text-sm"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
              </div>
            </div>
          )}
          {form.course_calc_type === 'fixed' && (
            <div className="sm:col-span-2">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                💡 固定額方式の場合、下部の「固定額バック表」タブでコース×ランク×指名種別ごとのバック額を設定してください。
              </div>
            </div>
          )}
        </div>
      </div>

      {/* オプションバック設定 */}
      <div className="mb-8">
        <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-bold">2</span>
          オプション料金のバック方式
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-8">
          <div>
            <label className="block mb-1.5 text-sm font-medium text-slate-600">計算方式</label>
            <select
              value={form.option_calc_type}
              onChange={(e) => setForm({ ...form, option_calc_type: e.target.value as 'full_back' | 'percentage' | 'fixed' | 'per_item' })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 bg-slate-50 focus:ring-2 focus:ring-indigo-500/50 outline-none text-sm"
            >
              <option value="full_back">{CALC_TYPE_LABELS.full_back}</option>
              <option value="percentage">{CALC_TYPE_LABELS.percentage}</option>
              <option value="per_item">{CALC_TYPE_LABELS.per_item}</option>
            </select>
          </div>
          {form.option_calc_type === 'percentage' && (
            <div>
              <label className="block mb-1.5 text-sm font-medium text-slate-600">バック率（%）</label>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  value={form.option_back_rate}
                  onChange={(e) => setForm({ ...form, option_back_rate: Number(e.target.value) })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 pr-8 bg-slate-50 focus:ring-2 focus:ring-indigo-500/50 outline-none text-sm"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 指名料バック設定 */}
      <div className="mb-8">
        <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center text-xs font-bold">3</span>
          指名料のバック方式
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-8">
          <div>
            <label className="block mb-1.5 text-sm font-medium text-slate-600">計算方式</label>
            <select
              value={form.nomination_calc_type}
              onChange={(e) => setForm({ ...form, nomination_calc_type: e.target.value as 'full_back' | 'percentage' | 'fixed' })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 bg-slate-50 focus:ring-2 focus:ring-indigo-500/50 outline-none text-sm"
            >
              <option value="full_back">{CALC_TYPE_LABELS.full_back}</option>
              <option value="percentage">{CALC_TYPE_LABELS.percentage}</option>
            </select>
          </div>
          {form.nomination_calc_type === 'percentage' && (
            <div>
              <label className="block mb-1.5 text-sm font-medium text-slate-600">バック率（%）</label>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  value={form.nomination_back_rate}
                  onChange={(e) => setForm({ ...form, nomination_back_rate: Number(e.target.value) })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 pr-8 bg-slate-50 focus:ring-2 focus:ring-indigo-500/50 outline-none text-sm"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* その他設定 */}
      <div className="mb-8">
        <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold">4</span>
          その他の設定
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-8">
          <div>
            <label className="block mb-1.5 text-sm font-medium text-slate-600">端数処理</label>
            <select
              value={form.rounding_method}
              onChange={(e) => setForm({ ...form, rounding_method: e.target.value as 'floor' | 'ceil' | 'round' })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 bg-slate-50 focus:ring-2 focus:ring-indigo-500/50 outline-none text-sm"
            >
              {Object.entries(ROUNDING_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block mb-1.5 text-sm font-medium text-slate-600">営業日切替時刻</label>
            <input
              type="time"
              value={form.business_day_cutoff}
              onChange={(e) => setForm({ ...form, business_day_cutoff: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 bg-slate-50 focus:ring-2 focus:ring-indigo-500/50 outline-none text-sm"
            />
            <p className="text-xs text-slate-400 mt-1">この時刻より前の予約は前日の営業扱いになります</p>
          </div>
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100">
        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
        >
          {saving ? '保存中...' : '保存する'}
        </button>
      </div>
    </form>
  )
}
