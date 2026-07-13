'use client'
/* eslint-disable react-hooks/set-state-in-effect */

import { CourseManagementTab } from './components/CourseManagementTab'
import { OptionManagementTab } from './components/OptionManagementTab'
import { TherapistRankManagementTab } from './components/TherapistRankManagementTab'
import { DiscountPoliciesTab } from './components/DiscountPoliciesTab'
import { DeductionRulesTab } from './components/DeductionRulesTab'
import { CourseBackAmountsTab } from './components/CourseBackAmountsTab'
import { DesignationTypesTab } from './components/DesignationTypesTab'
import { TherapistTemplateTab } from './components/TherapistTemplateTab'
import { CustomerTemplateTab } from './components/CustomerTemplateTab'
import { WebReserveEmailTemplateTab } from './components/WebReserveEmailTemplateTab'
import { CustomTemplatesTab } from './components/CustomTemplatesTab'
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
  credit_payment_url: string | null
  google_calendar_id: string | null
  gas_calendar_sync_url: string | null
  allow_new_customers: boolean
  enable_email_notification: boolean
  admin_notification_email: string | null
  enable_line_notification: boolean
  line_channel_access_token: string | null
  line_to_id: string | null
  email_template_web_success: string | null
}

type ActiveTab = 'courses' | 'options' | 'ranks' | 'pricing_defaults' | 'back_amounts' | 'discounts' | 'deductions' | 'designation_types' | 'therapist_template' | 'customer_template' | 'web_email_template' | 'custom_templates' | 'notifications'

export default function SystemPage() {
  const { selectedShop } = useShop()
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<ActiveTab>('pricing_defaults')
  const [settings, setSettings] = useState<SystemSettings | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Testing states for notifications
  const [sendingTestEmail, setSendingTestEmail] = useState(false)
  const [sendingTestLine, setSendingTestLine] = useState(false)
  const [testEmailMessage, setTestEmailMessage] = useState<string | null>(null)
  const [testLineMessage, setTestLineMessage] = useState<string | null>(null)
  const [testEmailError, setTestEmailError] = useState<string | null>(null)
  const [testLineError, setTestLineError] = useState<string | null>(null)

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
    web_reserve_address_mode: 'unified' | 'split_by_membership'
    therapist_line_mode: 'official_line' | 'line'
    special_rules: string
    credit_payment_url: string
    google_calendar_id: string
    gas_calendar_sync_url: string
    allow_new_customers: boolean
    enable_email_notification: boolean
    admin_notification_email: string
    enable_line_notification: boolean
    line_channel_access_token: string
    line_to_id: string
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
    web_reserve_address_mode: 'unified',
    therapist_line_mode: 'official_line',
    special_rules: '',
    credit_payment_url: '',
    google_calendar_id: '',
    gas_calendar_sync_url: '',
    allow_new_customers: true,
    enable_email_notification: false,
    admin_notification_email: '',
    enable_line_notification: false,
    line_channel_access_token: '',
    line_to_id: '',
  })

  async function fetchSettings() {
    if (!selectedShop) { setLoading(false); setSettings(null); return }
    setLoading(true)
    const [settingsRes, shopRes] = await Promise.all([
      supabase.from('system_settings').select('*').eq('shop_id', selectedShop.id).limit(1),
      supabase.from('shops').select('sms_address_mode, web_reserve_address_mode, special_rules, therapist_line_mode').eq('id', selectedShop.id).single()
    ])

    if (settingsRes.error) { alert('システム設定の取得に失敗しました'); setLoading(false); return }

    const row = (settingsRes.data?.[0] as SystemSettings | undefined) || null
    const smsMode = shopRes.data?.sms_address_mode || 'unified'
    const webMode = shopRes.data?.web_reserve_address_mode || 'unified'
    const lineMode = shopRes.data?.therapist_line_mode || 'official_line'

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
      web_reserve_address_mode: webMode,
      therapist_line_mode: lineMode,
      special_rules: shopRes.data?.special_rules ?? '',
      credit_payment_url: row?.credit_payment_url ?? '',
      google_calendar_id: row?.google_calendar_id ?? '',
      gas_calendar_sync_url: row?.gas_calendar_sync_url ?? '',
      allow_new_customers: row?.allow_new_customers ?? true,
      enable_email_notification: row?.enable_email_notification ?? false,
      admin_notification_email: row?.admin_notification_email ?? '',
      enable_line_notification: row?.enable_line_notification ?? false,
      line_channel_access_token: row?.line_channel_access_token ?? '',
      line_to_id: row?.line_to_id ?? '',
    })
    setLoading(false)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedShop) { alert('店舗を選択してください'); return }
    setSaving(true)

    const { sms_address_mode, web_reserve_address_mode, special_rules, therapist_line_mode, ...systemSettingsPayload } = form
    const payload = {
      ...systemSettingsPayload,
      smtp_port: form.smtp_port === '' ? null : Number(form.smtp_port),
      smtp_host: form.smtp_host || null,
      smtp_user: form.smtp_user || null,
      smtp_pass: form.smtp_pass || null,
      smtp_from: form.smtp_from || null,
      credit_payment_url: form.credit_payment_url || null,
      google_calendar_id: form.google_calendar_id || null,
      gas_calendar_sync_url: form.gas_calendar_sync_url || null,
      admin_notification_email: form.admin_notification_email || null,
      line_channel_access_token: form.line_channel_access_token || null,
      line_to_id: form.line_to_id || null,
    }

    const [result, shopResult] = await Promise.all([
      settings?.id
        ? supabase.from('system_settings').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', settings.id)
        : supabase.from('system_settings').insert([{ ...payload, shop_id: selectedShop.id }]),
      supabase.from('shops').update({ special_rules, therapist_line_mode, updated_at: new Date().toISOString() }).eq('id', selectedShop.id)
    ])

    if (result.error) { alert('システム設定の保存に失敗しました'); setSaving(false); return }
    if (shopResult.error) { alert('店舗情報の更新に失敗しました'); setSaving(false); return }

    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
    void fetchSettings()
    setSaving(false)
  }

  useEffect(() => { void fetchSettings() }, [selectedShop])

  const handleSendTestEmail = async () => {
    if (!form.admin_notification_email) {
      alert('通知先メールアドレスを入力してください。')
      return
    }
    setSendingTestEmail(true)
    setTestEmailMessage(null)
    setTestEmailError(null)

    try {
      const res = await fetch('/api/admin/test-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'email',
          shopId: selectedShop?.id,
          smtpSettings: {
            smtp_host: form.smtp_host || null,
            smtp_port: form.smtp_port === '' ? null : Number(form.smtp_port),
            smtp_secure: form.smtp_secure,
            smtp_user: form.smtp_user || null,
            smtp_pass: form.smtp_pass || null,
            smtp_from: form.smtp_from || null,
          },
          toEmail: form.admin_notification_email,
        }),
      })

      const data = await res.json()
      if (!res.ok || data.error) {
        setTestEmailError(data.error || 'テストメールの送信に失敗しました。')
      } else {
        setTestEmailMessage(data.message || 'テストメールを送信しました。')
      }
    } catch (err: any) {
      setTestEmailError(err.message || '送信中にエラーが発生しました。')
    } finally {
      setSendingTestEmail(false)
    }
  }

  const handleSendTestLine = async () => {
    if (!form.line_channel_access_token || !form.line_to_id) {
      alert('LINEチャネルアクセストークンと通知先IDを入力してください。')
      return
    }
    setSendingTestLine(true)
    setTestLineMessage(null)
    setTestLineError(null)

    try {
      const res = await fetch('/api/admin/test-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'line',
          shopId: selectedShop?.id,
          token: form.line_channel_access_token,
          toId: form.line_to_id,
        }),
      })

      const data = await res.json()
      if (!res.ok || data.error) {
        setTestLineError(data.error || 'テストLINEメッセージの送信に失敗しました。')
      } else {
        setTestLineMessage(data.message || 'テストLINEメッセージを送信しました。')
      }
    } catch (err: any) {
      setTestLineError(err.message || '送信中にエラーが発生しました。')
    } finally {
      setSendingTestLine(false)
    }
  }

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
    { key: 'notifications', label: '通知設定' },
    { key: 'therapist_template', label: 'セラピスト連絡テンプレート' },
    { key: 'customer_template', label: 'お客様連絡テンプレート' },
    { key: 'web_email_template', label: 'WEB予約完了メール' },
    { key: 'custom_templates', label: '追加連絡テンプレート' },
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
      <div className="mx-auto max-w-4xl">
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
        {activeTab === 'therapist_template' && <TherapistTemplateTab />}
        {activeTab === 'customer_template' && <CustomerTemplateTab />}
        {activeTab === 'web_email_template' && <WebReserveEmailTemplateTab />}
        {activeTab === 'custom_templates' && <CustomTemplatesTab />}

        {activeTab === 'pricing_defaults' && (
          <form onSubmit={handleSave} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 md:p-5 space-y-8">
            <div>
              <h2 className="text-base font-bold text-slate-800 mb-1">店舗基本設定</h2>
              <p className="text-sm text-slate-500">店舗全体の基本ルールを管理します。</p>
            </div>

            {/* 特殊ルール・注意事項 */}
            <div className="border-b border-slate-100 pb-6">
              <h3 className="text-sm font-bold text-slate-700 mb-2">特殊ルール・注意事項</h3>
              <p className="text-xs text-slate-400 mb-2">スケジュール画面の「店舗ルール」ツールチップに表示される内容です。</p>
              <textarea
                value={form.special_rules}
                onChange={(e) => setForm({ ...form, special_rules: e.target.value })}
                rows={3}
                placeholder="例：受付時に身分証提示必須。2回目以降の利用で500円オフ。"
                className="w-full border border-slate-200 rounded-xl bg-slate-50 px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none resize-none"
              />
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

            {/* ご新規様の予約受付設定 */}
            <div className="border-b border-slate-100 pb-6">
              <h3 className="text-sm font-bold text-slate-700 mb-2">新規予約の自動受付</h3>
              <p className="text-xs text-slate-400 mb-4">
                ご新規様（未登録の電話番号）からのWEB予約を受け付けるかどうかを設定します。「受け付けない」にすると、電話番号が既に登録されている会員様のみが自動受付の対象になり、ご新規様はお断りします。
              </p>
              <div className="flex gap-6">
                <label className="inline-flex items-center gap-2 text-sm cursor-pointer font-bold text-slate-700">
                  <input
                    type="radio"
                    name="allow_new_customers"
                    value="true"
                    checked={form.allow_new_customers === true}
                    onChange={() => setForm({ ...form, allow_new_customers: true })}
                    className="accent-indigo-600 w-4 h-4 cursor-pointer"
                  />
                  <span>受け付ける（通常モード）</span>
                </label>
                <label className="inline-flex items-center gap-2 text-sm cursor-pointer font-bold text-slate-700">
                  <input
                    type="radio"
                    name="allow_new_customers"
                    value="false"
                    checked={form.allow_new_customers === false}
                    onChange={() => setForm({ ...form, allow_new_customers: false })}
                    className="accent-indigo-600 w-4 h-4 cursor-pointer"
                  />
                  <span>受け付けない（会員様限定モード）</span>
                </label>
              </div>
            </div>

            {/* セラピスト連絡用LINEモード */}
            <div className="border-b border-slate-100 pb-6">
              <h3 className="text-sm font-bold text-slate-700 mb-2">セラピスト用 LINE連絡モード</h3>
              <p className="text-xs text-slate-400 mb-4">
                セラピストへの連絡文面を送る際のLINE連携方法を設定します。
              </p>
              <div className="flex gap-6">
                <label className="inline-flex items-center gap-2 text-sm cursor-pointer font-bold text-slate-700">
                  <input
                    type="radio"
                    name="therapist_line_mode"
                    value="official_line"
                    checked={form.therapist_line_mode === 'official_line'}
                    onChange={() => setForm({ ...form, therapist_line_mode: 'official_line' })}
                    className="accent-indigo-600 w-4 h-4 cursor-pointer"
                  />
                  <span>公式LINE（コピー機能のみ）</span>
                </label>
                <label className="inline-flex items-center gap-2 text-sm cursor-pointer font-bold text-slate-700">
                  <input
                    type="radio"
                    name="therapist_line_mode"
                    value="line"
                    checked={form.therapist_line_mode === 'line'}
                    onChange={() => setForm({ ...form, therapist_line_mode: 'line' })}
                    className="accent-indigo-600 w-4 h-4 cursor-pointer"
                  />
                  <span>普通のLINE（LINEアプリ起動）</span>
                </label>
              </div>
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

            {/* クレジット決済設定 */}
            <div className="border-b border-slate-100 pb-6 space-y-5">
              <div>
                <h3 className="text-sm font-bold text-slate-700 mb-1">クレジット決済手数料率</h3>
                <p className="text-xs text-slate-400 mb-4">クレジット決済時にお客様へ請求する手数料です。0〜100%の範囲で設定できます。</p>
                <div className="flex items-center gap-3 max-w-xs">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={form.credit_card_fee_rate}
                      onChange={(e) => setForm({ ...form, credit_card_fee_rate: Math.min(100, Math.max(0, Number(e.target.value))) })}
                      className="w-full border border-slate-200 rounded-xl bg-slate-50 pr-8 pl-3 py-2.5 text-sm"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">%</span>
                  </div>
                  <span className="text-xs text-slate-500">（デフォルト: 10%）</span>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-700 mb-1">クレジット決済リンク URL</h3>
                <p className="text-xs text-slate-400 mb-4">お客様へ送信する決済ページのベースURLを設定します。</p>
                <input
                  type="text"
                  placeholder="https://pay.example.com/payment"
                  value={form.credit_payment_url}
                  onChange={(e) => setForm({ ...form, credit_payment_url: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl bg-slate-50 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-700 mb-1">GoogleカレンダーID</h3>
                <p className="text-xs text-slate-400 mb-4">予約情報を同期する対象のGoogleカレンダーID（例: example@gmail.com）を設定します。</p>
                <input
                  type="text"
                  placeholder="example@gmail.com"
                  value={form.google_calendar_id}
                  onChange={(e) => setForm({ ...form, google_calendar_id: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl bg-slate-50 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-700 mb-1">Google Apps Script 同期用ウェブアプリURL</h3>
                <p className="text-xs text-slate-400 mb-4">カレンダー連携用のGASウェブアプリURL（https://script.google.com/macros/s/...）を設定します。</p>
                <input
                  type="text"
                  placeholder="https://script.google.com/macros/s/xxxx/exec"
                  value={form.gas_calendar_sync_url}
                  onChange={(e) => setForm({ ...form, gas_calendar_sync_url: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl bg-slate-50 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
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

        {activeTab === 'notifications' && (
          <form onSubmit={handleSave} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 md:p-5 space-y-8">
            <div>
              <h2 className="text-base font-bold text-slate-800 mb-1">通知設定</h2>
              <p className="text-sm text-slate-500">WEB予約が入った際のアラート通知を設定します。</p>
            </div>

            {/* メール通知設定 */}
            <div className="border-b border-slate-100 pb-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-700">メール通知機能</h3>
                  <p className="text-xs text-slate-400">WEB予約が入った際に管理者宛てにメールで通知します。</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.enable_email_notification}
                    onChange={(e) => setForm({ ...form, enable_email_notification: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {form.enable_email_notification && (
                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">通知先メールアドレス</label>
                    <input
                      type="text"
                      placeholder="example@example.com (複数宛先はカンマ区切り)"
                      value={form.admin_notification_email}
                      onChange={(e) => setForm({ ...form, admin_notification_email: e.target.value })}
                      className="w-full border border-slate-200 rounded-xl bg-slate-50 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50"
                    />
                  </div>

                  <div className="flex flex-col gap-2 bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <span className="text-xs font-bold text-slate-600">メール送信テスト</span>
                    <p className="text-xs text-slate-400">
                      設定を保存する前に、現在の入力内容（および「基本設定」のSMTP設定）でテストメールを送信できます。
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      <button
                        type="button"
                        onClick={handleSendTestEmail}
                        disabled={sendingTestEmail}
                        className="px-3.5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 disabled:opacity-50 rounded-lg text-xs font-bold transition-colors"
                      >
                        {sendingTestEmail ? '送信中...' : 'テストメールを送信'}
                      </button>
                      {testEmailMessage && (
                        <span className="text-xs text-emerald-600 font-medium">{testEmailMessage}</span>
                      )}
                      {testEmailError && (
                        <span className="text-xs text-rose-600 font-medium">{testEmailError}</span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* LINE通知設定 */}
            <div className="border-b border-slate-100 pb-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-700">LINE通知機能</h3>
                  <p className="text-xs text-slate-400">WEB予約が入った際にLINEグループ/個人宛てに通知します。</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.enable_line_notification}
                    onChange={(e) => setForm({ ...form, enable_line_notification: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {form.enable_line_notification && (
                <div className="space-y-4 pt-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">LINE Messaging API チャネルアクセストークン</label>
                      <input
                        type="password"
                        placeholder="ey..."
                        value={form.line_channel_access_token}
                        onChange={(e) => setForm({ ...form, line_channel_access_token: e.target.value })}
                        className="w-full border border-slate-200 rounded-xl bg-slate-50 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">通知先ユーザーID / グループID</label>
                      <input
                        type="text"
                        placeholder="Uxxxxxxx または Cxxxxxxx"
                        value={form.line_to_id}
                        onChange={(e) => setForm({ ...form, line_to_id: e.target.value })}
                        className="w-full border border-slate-200 rounded-xl bg-slate-50 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50"
                      />
                    </div>
                  </div>

                  {/* LINE設定ガイド */}
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-xs text-slate-500 space-y-1.5">
                    <span className="font-bold text-slate-600">💡 LINE通知の連携手順：</span>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>LINE Developersにて「プロバイダー」と「Messaging APIチャネル」を作成します。</li>
                      <li>Messaging API設定タブの一番下から「チャネルアクセストークン(長期)」を発行して、本設定ページに入力します。</li>
                      <li>通知を受け取りたいLINEグループに作成したBotアカウントを追加します。</li>
                      <li>LINE Developersまたはwebhookログから、通知を受け取りたいグループID (Cから始まる文字列) または管理者個人のユーザーID (Uから始まる文字列) を取得し、本設定ページに入力します。</li>
                    </ol>
                  </div>

                  <div className="flex flex-col gap-2 bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <span className="text-xs font-bold text-slate-600">LINE送信テスト</span>
                    <p className="text-xs text-slate-400">
                      設定を保存する前に、現在のトークンと通知先ID宛てにテストLINEメッセージを送信できます。
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      <button
                        type="button"
                        onClick={handleSendTestLine}
                        disabled={sendingTestLine}
                        className="px-3.5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 disabled:opacity-50 rounded-lg text-xs font-bold transition-colors"
                      >
                        {sendingTestLine ? '送信中...' : 'テストLINEを送信'}
                      </button>
                      {testLineMessage && (
                        <span className="text-xs text-emerald-600 font-medium">{testLineMessage}</span>
                      )}
                      {testLineError && (
                        <span className="text-xs text-rose-600 font-medium">{testLineError}</span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 保存ボタン */}
            <div className="flex items-center gap-4 pt-2 border-t border-slate-100">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 text-sm"
              >
                {saving ? '保存中...' : '設定を保存'}
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
