'use client'
/* eslint-disable react-hooks/set-state-in-effect */

import { CourseManagementTab } from './components/CourseManagementTab'
import { OptionManagementTab } from './components/OptionManagementTab'
import { TherapistRankManagementTab } from './components/TherapistRankManagementTab'
import { DiscountPoliciesTab } from './components/DiscountPoliciesTab'
import { DeductionRulesTab } from './components/DeductionRulesTab'
import { CourseBackAmountsTab } from './components/CourseBackAmountsTab'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useShop } from '@/app/contexts/ShopContext'

type SystemSettings = {
  id: string
  shop_id: string
  default_nomination_fee: number
  default_confirmed_nomination_fee: number
  default_princess_reservation_fee: number
  reservation_interval_minutes: number
  nomination_back_amount: number
  confirmed_nomination_back_amount: number
  princess_back_amount: number
  credit_card_fee_rate: number
}

type ActiveTab = 'courses' | 'options' | 'ranks' | 'pricing_defaults' | 'back_amounts' | 'discounts' | 'deductions'

export default function SystemPage() {
  const { selectedShop } = useShop()
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<ActiveTab>('courses')
  const [settings, setSettings] = useState<SystemSettings | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({
    default_nomination_fee: 0,
    default_confirmed_nomination_fee: 0,
    default_princess_reservation_fee: 0,
    reservation_interval_minutes: 20,
    nomination_back_amount: 0,
    confirmed_nomination_back_amount: 0,
    princess_back_amount: 0,
    credit_card_fee_rate: 10,
  })

  async function fetchSettings() {
    if (!selectedShop) { setLoading(false); setSettings(null); return }
    setLoading(true)
    const { data, error } = await supabase
      .from('system_settings')
      .select('*')
      .eq('shop_id', selectedShop.id)
      .limit(1)

    if (error) { alert('システム設定の取得に失敗しました'); setLoading(false); return }

    const row = (data?.[0] as SystemSettings | undefined) || null
    setSettings(row)
    setForm({
      default_nomination_fee:             row?.default_nomination_fee ?? 0,
      default_confirmed_nomination_fee:   row?.default_confirmed_nomination_fee ?? 0,
      default_princess_reservation_fee:   row?.default_princess_reservation_fee ?? 0,
      reservation_interval_minutes:       row?.reservation_interval_minutes ?? 20,
      nomination_back_amount:             row?.nomination_back_amount ?? 0,
      confirmed_nomination_back_amount:   row?.confirmed_nomination_back_amount ?? 0,
      princess_back_amount:               row?.princess_back_amount ?? 0,
      credit_card_fee_rate:               row?.credit_card_fee_rate ?? 10,
    })
    setLoading(false)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedShop) { alert('店舗を選択してください'); return }
    setSaving(true)

    const result = settings?.id
      ? await supabase.from('system_settings').update({ ...form, updated_at: new Date().toISOString() }).eq('id', settings.id)
      : await supabase.from('system_settings').insert([{ ...form, shop_id: selectedShop.id }])

    if (result.error) { alert('保存に失敗しました'); setSaving(false); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
    void fetchSettings()
    setSaving(false)
  }

  useEffect(() => { void fetchSettings() }, [selectedShop])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 p-6 md:p-8">
        <div className="flex justify-center items-center py-20 text-indigo-600">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          <span className="ml-3 font-medium">読み込み中...</span>
        </div>
      </div>
    )
  }

  const tabs: { key: ActiveTab; label: string }[] = [
    { key: 'courses',          label: 'コース管理' },
    { key: 'pricing_defaults', label: '指名料・インターバル' },
    { key: 'options',          label: 'オプション管理' },
    { key: 'ranks',            label: 'ランク設定' },
    { key: 'back_amounts',     label: '固定額バック表' },
    { key: 'discounts',        label: '割引ルール' },
    { key: 'deductions',       label: '控除・手当' },
  ]

  return (
    <div className="min-h-screen bg-gray-100 p-6 md:p-8">
      <div className="mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">システム管理</h1>
          <p className="text-sm text-slate-500 mt-1">サービス設定と店舗の初期料金設定を管理します。</p>
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'courses'      && <CourseManagementTab />}
        {activeTab === 'options'      && <OptionManagementTab />}
        {activeTab === 'ranks'        && <TherapistRankManagementTab />}
        {activeTab === 'back_amounts' && <CourseBackAmountsTab />}
        {activeTab === 'discounts'    && <DiscountPoliciesTab />}
        {activeTab === 'deductions'   && <DeductionRulesTab />}

        {activeTab === 'pricing_defaults' && (
          <form onSubmit={handleSave} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 md:p-8 max-w-2xl space-y-8">
            <div>
              <h2 className="text-base font-bold text-slate-800 mb-1">指名料・インターバル設定</h2>
              <p className="text-sm text-slate-500">セラピスト個別設定がない場合に適用されるデフォルト値です。</p>
            </div>

            {/* 予約インターバル */}
            <div className="border-b border-slate-100 pb-6">
              <h3 className="text-sm font-bold text-slate-700 mb-4">予約インターバル（準備時間）</h3>
              <select
                value={form.reservation_interval_minutes}
                onChange={(e) => setForm({ ...form, reservation_interval_minutes: Number(e.target.value) })}
                className="w-full border border-slate-200 rounded-xl bg-slate-50 px-3 py-2.5 text-sm"
              >
                {[0, 5, 10, 15, 20, 25, 30, 45, 60].map(m => (
                  <option key={m} value={m}>{m}分</option>
                ))}
              </select>
              <p className="text-xs text-slate-400 mt-1.5">セラピスト個別設定がある場合はそちらが優先されます。</p>
            </div>

            {/* 指名料デフォルト */}
            <div>
              <h3 className="text-sm font-bold text-slate-700 mb-4">指名料デフォルト</h3>
              <div className="space-y-4">
                {[
                  { label: '指名料（通常）', feeField: 'default_nomination_fee', backField: 'nomination_back_amount' },
                  { label: '本指名料',       feeField: 'default_confirmed_nomination_fee', backField: 'confirmed_nomination_back_amount' },
                  { label: '姫予約料金',     feeField: 'default_princess_reservation_fee', backField: 'princess_back_amount' },
                ].map(({ label, feeField, backField }) => (
                  <div key={feeField}>
                    <p className="text-xs font-semibold text-slate-600 mb-2">{label}</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] text-slate-400 mb-1">顧客請求額</p>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">¥</span>
                          <input
                            type="number"
                            min={0}
                            value={form[feeField as keyof typeof form]}
                            onChange={(e) => setForm({ ...form, [feeField]: Number(e.target.value) })}
                            className="w-full border border-slate-200 rounded-xl bg-slate-50 pl-8 pr-3 py-2.5 text-sm"
                          />
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] text-indigo-600 font-semibold mb-1">セラピストバック額</p>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400 text-sm font-bold">B</span>
                          <input
                            type="number"
                            min={0}
                            value={form[backField as keyof typeof form]}
                            onChange={(e) => setForm({ ...form, [backField]: Number(e.target.value) })}
                            className="w-full border border-indigo-200 rounded-xl bg-indigo-50/50 pl-8 pr-3 py-2.5 text-sm font-semibold text-indigo-800"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* クレジット決済手数料 */}
            <div className="border-b border-slate-100 pb-6">
              <h3 className="text-sm font-bold text-slate-700 mb-1">クレジット決済手数料率</h3>
              <p className="text-xs text-slate-400 mb-4">クレジット決済時にお客様へ請求する手数料です。0〜12%の範囲で設定できます。</p>
              <div className="flex items-center gap-3 max-w-xs">
                <div className="relative flex-1">
                  <input
                    type="number"
                    min={0}
                    max={12}
                    step={0.5}
                    value={form.credit_card_fee_rate}
                    onChange={(e) => setForm({ ...form, credit_card_fee_rate: Math.min(12, Math.max(0, Number(e.target.value))) })}
                    className="w-full border border-slate-200 rounded-xl bg-slate-50 pr-8 pl-3 py-2.5 text-sm"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">%</span>
                </div>
                <span className="text-xs text-slate-500">（デフォルト: 10%）</span>
              </div>
            </div>

            <div className="flex items-center gap-4 pt-2 border-t border-slate-100">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 text-sm"
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
        )}
      </div>
    </div>
  )
}
