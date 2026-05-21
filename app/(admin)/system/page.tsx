'use client'
/* eslint-disable react-hooks/set-state-in-effect */

import { CourseManagementTab } from './components/CourseManagementTab'
import { OptionManagementTab } from './components/OptionManagementTab'
import { TherapistRankManagementTab } from './components/TherapistRankManagementTab'
import { DiscountPoliciesTab } from './components/DiscountPoliciesTab'
import { DeductionRulesTab } from './components/DeductionRulesTab'
import { CourseBackAmountsTab } from './components/CourseBackAmountsTab'
import { DesignationTypesTab } from './components/DesignationTypesTab'
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
  extension_unit_minutes: number
  extension_unit_price: number
  extension_unit_back: number
  smtp_host: string | null
  smtp_port: number | null
  smtp_secure: boolean | null
  smtp_user: string | null
  smtp_pass: string | null
  smtp_from: string | null
}

type ActiveTab = 'courses' | 'options' | 'ranks' | 'pricing_defaults' | 'back_amounts' | 'discounts' | 'deductions' | 'designation_types'

export default function SystemPage() {
  const { selectedShop } = useShop()
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<ActiveTab>('pricing_defaults')
  const [settings, setSettings] = useState<SystemSettings | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState<{
    default_nomination_fee: number
    default_confirmed_nomination_fee: number
    default_princess_reservation_fee: number
    reservation_interval_minutes: number
    nomination_back_amount: number
    confirmed_nomination_back_amount: number
    princess_back_amount: number
    credit_card_fee_rate: number
    extension_unit_minutes: number
    extension_unit_price: number
    extension_unit_back: number
    smtp_host: string
    smtp_port: number | ''
    smtp_secure: boolean
    smtp_user: string
    smtp_pass: string
    smtp_from: string
    sms_address_mode: 'unified' | 'split_by_membership'
  }>({
    default_nomination_fee: 0,
    default_confirmed_nomination_fee: 0,
    default_princess_reservation_fee: 0,
    reservation_interval_minutes: 20,
    nomination_back_amount: 0,
    confirmed_nomination_back_amount: 0,
    princess_back_amount: 0,
    credit_card_fee_rate: 10,
    extension_unit_minutes: 30,
    extension_unit_price: 0,
    extension_unit_back: 0,
    smtp_host: '',
    smtp_port: '',
    smtp_secure: false,
    smtp_user: '',
    smtp_pass: '',
    smtp_from: '',
    sms_address_mode: 'unified',
  })

  async function fetchSettings() {
    if (!selectedShop) { setLoading(false); setSettings(null); return }
    setLoading(true)
    const [settingsRes, shopRes] = await Promise.all([
      supabase.from('system_settings').select('*').eq('shop_id', selectedShop.id).limit(1),
      supabase.from('shops').select('sms_address_mode').eq('id', selectedShop.id).single()
    ])

    if (settingsRes.error) { alert('システム設定の取得に失敗しました'); setLoading(false); return }

    const row = (settingsRes.data?.[0] as SystemSettings | undefined) || null
    const smsMode = shopRes.data?.sms_address_mode || 'unified'

    setSettings(row)
    setForm({
      default_nomination_fee: row?.default_nomination_fee ?? 0,
      default_confirmed_nomination_fee: row?.default_confirmed_nomination_fee ?? 0,
      default_princess_reservation_fee: row?.default_princess_reservation_fee ?? 0,
      reservation_interval_minutes: row?.reservation_interval_minutes ?? 20,
      nomination_back_amount: row?.nomination_back_amount ?? 0,
      confirmed_nomination_back_amount: row?.confirmed_nomination_back_amount ?? 0,
      princess_back_amount: row?.princess_back_amount ?? 0,
      credit_card_fee_rate: row?.credit_card_fee_rate ?? 10,
      extension_unit_minutes: row?.extension_unit_minutes ?? 30,
      extension_unit_price: row?.extension_unit_price ?? 0,
      extension_unit_back: row?.extension_unit_back ?? 0,
      smtp_host: row?.smtp_host ?? '',
      smtp_port: row?.smtp_port ?? '',
      smtp_secure: row?.smtp_secure ?? false,
      smtp_user: row?.smtp_user ?? '',
      smtp_pass: row?.smtp_pass ?? '',
      smtp_from: row?.smtp_from ?? '',
      sms_address_mode: smsMode,
    })
    setLoading(false)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedShop) { alert('店舗を選択してください'); return }
    setSaving(true)

    const { sms_address_mode, ...systemSettingsPayload } = form
    const payload = {
      ...systemSettingsPayload,
      smtp_port: form.smtp_port === '' ? null : Number(form.smtp_port),
      smtp_host: form.smtp_host || null,
      smtp_user: form.smtp_user || null,
      smtp_pass: form.smtp_pass || null,
      smtp_from: form.smtp_from || null,
    }

    const [result, shopResult] = await Promise.all([
      settings?.id
        ? supabase.from('system_settings').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', settings.id)
        : supabase.from('system_settings').insert([{ ...payload, shop_id: selectedShop.id }]),
      supabase.from('shops').update({ sms_address_mode, updated_at: new Date().toISOString() }).eq('id', selectedShop.id)
    ])

    if (result.error) { alert('システム設定の保存に失敗しました'); setSaving(false); return }
    if (shopResult.error) { alert('店舗情報の更新に失敗しました'); setSaving(false); return }

    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
    void fetchSettings()
    setSaving(false)
  }

  useEffect(() => { void fetchSettings() }, [selectedShop])

  if (loading) {
    return (
      <div className="bg-gray-100 p-4 md:p-4">
        <div className="flex justify-center items-center py-20 text-indigo-600">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          <span className="ml-3 font-medium">読み込み中...</span>
        </div>
      </div>
    )
  }

  const tabs: { key: ActiveTab; label: string }[] = [
    { key: 'pricing_defaults', label: '基本設定' },
    { key: 'courses', label: 'コース管理' },
    { key: 'designation_types', label: '指名種別' },
    { key: 'options', label: 'オプション管理' },
    { key: 'discounts', label: '割引' },
    { key: 'deductions', label: '控除' },
    { key: 'ranks', label: 'ランク設定' },
    { key: 'back_amounts', label: 'ランク別 料金バック' },

  ]

  return (
    <div className="bg-gray-100 p-4 md:p-4">
      <div className="mx-auto">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">システム管理</h1>
          <p className="text-sm text-slate-500 mt-1">サービス設定と店舗の初期料金設定を管理します。</p>
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${activeTab === tab.key
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'courses' && <CourseManagementTab />}
        {activeTab === 'designation_types' && <DesignationTypesTab />}
        {activeTab === 'options' && <OptionManagementTab />}
        {activeTab === 'ranks' && <TherapistRankManagementTab />}
        {activeTab === 'back_amounts' && <CourseBackAmountsTab />}
        {activeTab === 'discounts' && <DiscountPoliciesTab />}
        {activeTab === 'deductions' && <DeductionRulesTab />}

        {activeTab === 'pricing_defaults' && (
          <form onSubmit={handleSave} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 md:p-5 max-w-2xl space-y-8">
            <div>
              <h2 className="text-base font-bold text-slate-800 mb-1">店舗基本設定</h2>
              <p className="text-sm text-slate-500">店舗全体の基本ルールを管理します。</p>
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



            {/* 延長設定 */}
            <div className="border-b border-slate-100 pb-6">
              <h3 className="text-sm font-bold text-slate-700 mb-1">延長設定</h3>
              <p className="text-xs text-slate-400 mb-4">延長の最小単位・料金・セラピストバックを設定します。予約画面で延長回数を指定すると自動計算されます。</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">延長最小単位</label>
                  <div className="relative">
                    <select
                      value={form.extension_unit_minutes}
                      onChange={(e) => setForm({ ...form, extension_unit_minutes: Number(e.target.value) })}
                      className="w-full border border-slate-200 rounded-xl bg-slate-50 px-3 py-2.5 text-sm"
                    >
                      {[10, 15, 20, 30, 45, 60].map(m => (
                        <option key={m} value={m}>{m}分</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">延長料金（1回あたり）</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">¥</span>
                    <input
                      type="number"
                      min={0}
                      step={100}
                      value={form.extension_unit_price}
                      onChange={(e) => setForm({ ...form, extension_unit_price: Math.max(0, Number(e.target.value)) })}
                      className="w-full border border-slate-200 rounded-xl bg-slate-50 pl-7 pr-3 py-2.5 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">延長バック（1回あたり）</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">¥</span>
                    <input
                      type="number"
                      min={0}
                      step={100}
                      value={form.extension_unit_back}
                      onChange={(e) => setForm({ ...form, extension_unit_back: Math.max(0, Number(e.target.value)) })}
                      className="w-full border border-slate-200 rounded-xl bg-slate-50 pl-7 pr-3 py-2.5 text-sm"
                    />
                  </div>
                </div>
              </div>
              {form.extension_unit_price > 0 && (
                <p className="mt-2 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
                  例: 延長 {form.extension_unit_minutes}分 × 3回 = +{form.extension_unit_minutes * 3}分 / +¥{(form.extension_unit_price * 3).toLocaleString()} / バック +¥{(form.extension_unit_back * 3).toLocaleString()}
                </p>
              )}
              <p className="mt-2 text-xs text-slate-400">ランク別の料金・バックは「ランク別 料金バック」タブで設定できます。</p>
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

            {/* SMS住所送信モード */}
            <div className="border-b border-slate-100 pb-6">
              <h3 className="text-sm font-bold text-slate-700 mb-1">SMS住所送信モード</h3>
              <p className="text-xs text-slate-400 mb-4">Web予約確定時に自動送信されるSMSでの、住所情報の送信方法を設定します。</p>
              <div className="space-y-3">
                <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200/80 cursor-pointer hover:bg-slate-50 transition-all duration-200 group">
                  <input
                    type="radio"
                    name="sms_address_mode"
                    value="unified"
                    checked={form.sms_address_mode === 'unified'}
                    onChange={() => setForm({ ...form, sms_address_mode: 'unified' })}
                    className="mt-1 accent-indigo-600 w-4 h-4"
                  />
                  <div>
                    <p className="text-sm font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">一律送信</p>
                    <p className="text-xs text-slate-500 mt-0.5">新規・会員問わず同じ住所（ルームに設定した住所）を送信します。</p>
                  </div>
                </label>
                <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200/80 cursor-pointer hover:bg-slate-50 transition-all duration-200 group">
                  <input
                    type="radio"
                    name="sms_address_mode"
                    value="split_by_membership"
                    checked={form.sms_address_mode === 'split_by_membership'}
                    onChange={() => setForm({ ...form, sms_address_mode: 'split_by_membership' })}
                    className="mt-1 accent-indigo-600 w-4 h-4"
                  />
                  <div>
                    <p className="text-sm font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">新規／会員で切替</p>
                    <p className="text-xs text-slate-500 mt-0.5">新規のお客様にはルームに設定した「近隣住所」を、会員には実住所を送信します。</p>
                  </div>
                </label>
              </div>
            </div>

            {/* メール送信設定 (SMTP) */}
            <div className="border-b border-slate-100 pb-6">
              <h3 className="text-sm font-bold text-slate-700 mb-1">メール送信設定 (SMTP)</h3>
              <p className="text-xs text-slate-400 mb-4">
                Web予約が完了した際にお客様へ自動送信される確認メールのSMTP設定です。<br />
                未設定（空欄）の場合は、システム共通の環境変数に設定されたSMTPサーバーから送信されます。
              </p>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">SMTPホスト名</label>
                    <input
                      type="text"
                      placeholder="smtp.example.com"
                      value={form.smtp_host}
                      onChange={(e) => setForm({ ...form, smtp_host: e.target.value })}
                      className="w-full border border-slate-200 rounded-xl bg-slate-50 px-3 py-2.5 text-sm placeholder:text-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">ポート番号</label>
                    <input
                      type="number"
                      placeholder="587"
                      value={form.smtp_port}
                      onChange={(e) => setForm({ ...form, smtp_port: e.target.value === '' ? '' : Number(e.target.value) })}
                      className="w-full border border-slate-200 rounded-xl bg-slate-50 px-3 py-2.5 text-sm placeholder:text-slate-300"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 py-1">
                  <input
                    type="checkbox"
                    id="smtp_secure"
                    checked={form.smtp_secure}
                    onChange={(e) => setForm({ ...form, smtp_secure: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <label htmlFor="smtp_secure" className="text-xs font-semibold text-slate-600 select-none cursor-pointer">
                    SSL/TLSを使用する (通常465番ポートの場合にチェック)
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">SMTPユーザー名</label>
                    <input
                      type="text"
                      placeholder="user@example.com"
                      value={form.smtp_user}
                      onChange={(e) => setForm({ ...form, smtp_user: e.target.value })}
                      className="w-full border border-slate-200 rounded-xl bg-slate-50 px-3 py-2.5 text-sm placeholder:text-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">SMTPパスワード</label>
                    <input
                      type="password"
                      placeholder="••••••••••••••••"
                      value={form.smtp_pass}
                      onChange={(e) => setForm({ ...form, smtp_pass: e.target.value })}
                      className="w-full border border-slate-200 rounded-xl bg-slate-50 px-3 py-2.5 text-sm placeholder:text-slate-300"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">差出人表記 (FROM)</label>
                  <input
                    type="text"
                    placeholder='"新宿店" <shinjuku@example.com>'
                    value={form.smtp_from}
                    onChange={(e) => setForm({ ...form, smtp_from: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl bg-slate-50 px-3 py-2.5 text-sm placeholder:text-slate-300"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    送信元の名前とメールアドレスを指定します。例: `&quot;新宿店&quot; &lt;shinjuku@example.com&gt;`
                  </p>
                </div>
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
