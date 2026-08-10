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
import { getPricingShopId } from '@/lib/shopUtils'

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
  paypay_fee_rate: number
  enable_cash_payment: boolean | null
  enable_credit_payment: boolean | null
  enable_paypay_payment: boolean | null
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

type ActiveTab = 'store_info' | 'courses' | 'options' | 'ranks' | 'back_amounts' | 'discounts' | 'deductions' | 'designation_types' | 'special_rules' | 'extension' | 'reservation_rules' | 'payment' | 'integrations' | 'therapist_template' | 'customer_template' | 'web_email_template' | 'custom_templates' | 'notifications'

/** 1つの form / handleSave を共有するタブ（表示する項目だけを切り替える） */
const SHARED_FORM_TABS: ActiveTab[] = ['special_rules', 'reservation_rules', 'extension', 'payment', 'integrations']

const FORM_TAB_HEADINGS: Partial<Record<ActiveTab, { title: string; description: string }>> = {
  special_rules: { title: '特殊ルール・注意事項', description: 'スケジュール画面の「店舗ルール / 料金システム」に表示される申し送りメモです。' },
  reservation_rules: { title: '予約ルール', description: '予約の受け付け方に関する店舗共通のルールです。' },
  extension: { title: '延長設定', description: '延長の最小単位・料金・セラピストバックを設定します。' },
  payment: { title: '決済設定', description: '決済手数料率と、お客様へ案内する決済ページのURLを設定します。' },
  integrations: { title: '外部連携', description: 'Googleカレンダーとの同期に使う設定です。' },
}

type MainCategory = 'store' | 'pricing' | 'back' | 'reservation' | 'payment' | 'templates' | 'notify'

export default function SystemPage() {
  const { selectedShop } = useShop()
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<ActiveTab>('store_info')
  const [mainCat, setMainCat] = useState<MainCategory>('store')
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
    paypay_fee_rate: number
    enable_cash_payment: boolean
    enable_credit_payment: boolean
    enable_paypay_payment: boolean
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
    esthe_ranking_login_id: string
    esthe_ranking_password: string
    esthe_ranking_shop_url: string
  }>({
    default_nomination_fee: 0,
    default_confirmed_nomination_fee: 0,
    default_princess_reservation_fee: 0,
    reservation_interval_minutes: 20,
    nomination_back_amount: 0,
    confirmed_nomination_back_amount: 0,
    princess_back_amount: 0,
    credit_card_fee_rate: 10,
    paypay_fee_rate: 0,
    enable_cash_payment: true,
    enable_credit_payment: true,
    enable_paypay_payment: false,
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
    esthe_ranking_login_id: '',
    esthe_ranking_password: '',
    esthe_ranking_shop_url: '',
  })

  async function fetchSettings() {
    if (!selectedShop) { setLoading(false); setSettings(null); return }
    setLoading(true)
    const [settingsRes, shopRes, pricingShopRes] = await Promise.all([
      supabase.from('system_settings').select('*').eq('shop_id', selectedShop.id).limit(1),
      supabase.from('shops').select('sms_address_mode, web_reserve_address_mode, special_rules, esthe_ranking_login_id, esthe_ranking_password, esthe_ranking_shop_url').eq('id', selectedShop.id).single(),
      supabase.from('shops').select('special_rules').eq('id', getPricingShopId(selectedShop)).single()
    ])

    if (settingsRes.error) { alert('システム設定の取得に失敗しました'); setLoading(false); return }

    const row = (settingsRes.data?.[0] as SystemSettings | undefined) || null
    const smsMode = shopRes.data?.sms_address_mode || 'unified'
    const webMode = shopRes.data?.web_reserve_address_mode || 'unified'

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
      paypay_fee_rate: row?.paypay_fee_rate ?? 0,
      enable_cash_payment: row?.enable_cash_payment ?? true,
      enable_credit_payment: row?.enable_credit_payment ?? true,
      enable_paypay_payment: row?.enable_paypay_payment ?? false,
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
      special_rules: pricingShopRes.data?.special_rules ?? '',
      credit_payment_url: row?.credit_payment_url ?? '',
      google_calendar_id: row?.google_calendar_id ?? '',
      gas_calendar_sync_url: row?.gas_calendar_sync_url ?? '',
      allow_new_customers: row?.allow_new_customers ?? true,
      enable_email_notification: row?.enable_email_notification ?? false,
      admin_notification_email: row?.admin_notification_email ?? '',
      enable_line_notification: row?.enable_line_notification ?? false,
      line_channel_access_token: row?.line_channel_access_token ?? '',
      line_to_id: row?.line_to_id ?? '',
      esthe_ranking_login_id: shopRes.data?.esthe_ranking_login_id ?? '',
      esthe_ranking_password: shopRes.data?.esthe_ranking_password ?? '',
      esthe_ranking_shop_url: shopRes.data?.esthe_ranking_shop_url ?? '',
    })
    setLoading(false)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedShop) { alert('店舗を選択してください'); return }
    setSaving(true)

    const { sms_address_mode, web_reserve_address_mode, special_rules, esthe_ranking_login_id, esthe_ranking_password, esthe_ranking_shop_url, ...systemSettingsPayload } = form
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

    const [result, shopResult, pricingShopResult] = await Promise.all([
      settings?.id
        ? supabase.from('system_settings').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', settings.id)
        : supabase.from('system_settings').insert([{ ...payload, shop_id: selectedShop.id }]),
      supabase.from('shops').update({ esthe_ranking_login_id, esthe_ranking_password, esthe_ranking_shop_url, updated_at: new Date().toISOString() }).eq('id', selectedShop.id),
      supabase.from('shops').update({ special_rules, updated_at: new Date().toISOString() }).eq('id', getPricingShopId(selectedShop))
    ])

    if (result.error) { alert('システム設定の保存に失敗しました'); setSaving(false); return }
    if (shopResult.error) { alert('店舗情報の更新に失敗しました'); setSaving(false); return }
    if (pricingShopResult.error) { alert('店舗ルールの更新に失敗しました'); setSaving(false); return }

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

  // 店舗情報カテゴリは項目が1つなので2段目のタブを出さない
  const storeTabs: { key: ActiveTab; label: string }[] = []

  const pricingTabs: { key: ActiveTab; label: string }[] = [
    { key: 'courses', label: 'コース設定' },
    { key: 'options', label: 'オプション設定' },
    { key: 'designation_types', label: '指名種別' },
    { key: 'discounts', label: '割引ルール' },
    { key: 'extension', label: '延長設定' },
    { key: 'special_rules', label: '特殊ルール・注意事項' },
  ]

  const backTabs: { key: ActiveTab; label: string }[] = [
    { key: 'ranks', label: 'セラピストランク設定' },
    { key: 'back_amounts', label: 'ランク別料金バック' },
    { key: 'deductions', label: '控除ルール' },
  ]

  const reservationTabs: { key: ActiveTab; label: string }[] = [
    { key: 'reservation_rules', label: '予約ルール' },
  ]

  const paymentTabs: { key: ActiveTab; label: string }[] = [
    { key: 'payment', label: '決済設定' },
  ]

  const templateTabs: { key: ActiveTab; label: string }[] = [
    { key: 'therapist_template', label: 'セラピスト連絡テンプレート' },
    { key: 'customer_template', label: 'お客様連絡テンプレート' },
    { key: 'web_email_template', label: 'WEB予約完了メール' },
    { key: 'custom_templates', label: '追加連絡テンプレート' },
  ]

  const notifyTabs: { key: ActiveTab; label: string }[] = [
    { key: 'notifications', label: '通知設定' },
    { key: 'integrations', label: '外部連携' },
  ]

  const currentSubTabs =
    mainCat === 'store' ? storeTabs :
    mainCat === 'pricing' ? pricingTabs :
    mainCat === 'back' ? backTabs :
    mainCat === 'reservation' ? reservationTabs :
    mainCat === 'payment' ? paymentTabs :
    mainCat === 'templates' ? templateTabs : notifyTabs

  return (
    <div className="bg-gray-100 p-4 md:p-4 font-sans">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">店舗 ＆ システム設定</h1>
          <p className="text-sm text-slate-500 mt-1">店舗基本情報、コース料金、給与バック、テンプレート、各種通知設定を一元管理します。</p>
        </div>

        {/* 1段階目：メインカテゴリのカード */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => { setMainCat('store'); setActiveTab('store_info'); }}
            className={`p-3 rounded-2xl border text-xs font-bold text-left transition-all ${
              mainCat === 'store'
                ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-xs ring-2 ring-indigo-500/20'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            🏬 店舗情報
            <span className="block text-[10px] font-normal text-slate-400 mt-0.5">店舗名・電話・住所・SNS</span>
          </button>

          <button
            type="button"
            onClick={() => { setMainCat('pricing'); setActiveTab('courses'); }}
            className={`p-3 rounded-2xl border text-xs font-bold text-left transition-all ${
              mainCat === 'pricing'
                ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-xs ring-2 ring-indigo-500/20'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            💰 コース・料金
            <span className="block text-[10px] font-normal text-slate-400 mt-0.5">コース・オプション・延長</span>
          </button>

          <button
            type="button"
            onClick={() => { setMainCat('back'); setActiveTab('ranks'); }}
            className={`p-3 rounded-2xl border text-xs font-bold text-left transition-all ${
              mainCat === 'back'
                ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-xs ring-2 ring-indigo-500/20'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            👩‍💼 バック・給与
            <span className="block text-[10px] font-normal text-slate-400 mt-0.5">ランク設定・還元率・控除</span>
          </button>

          <button
            type="button"
            onClick={() => { setMainCat('reservation'); setActiveTab('reservation_rules'); }}
            className={`p-3 rounded-2xl border text-xs font-bold text-left transition-all ${
              mainCat === 'reservation'
                ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-xs ring-2 ring-indigo-500/20'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            📅 予約ルール
            <span className="block text-[10px] font-normal text-slate-400 mt-0.5">インターバル・新規受付</span>
          </button>

          <button
            type="button"
            onClick={() => { setMainCat('payment'); setActiveTab('payment'); }}
            className={`p-3 rounded-2xl border text-xs font-bold text-left transition-all ${
              mainCat === 'payment'
                ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-xs ring-2 ring-indigo-500/20'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            💳 決済
            <span className="block text-[10px] font-normal text-slate-400 mt-0.5">手数料率・決済リンク</span>
          </button>

          <button
            type="button"
            onClick={() => { setMainCat('templates'); setActiveTab('therapist_template'); }}
            className={`p-3 rounded-2xl border text-xs font-bold text-left transition-all ${
              mainCat === 'templates'
                ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-xs ring-2 ring-indigo-500/20'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            ✉️ テンプレート
            <span className="block text-[10px] font-normal text-slate-400 mt-0.5">送信モード・自動文面</span>
          </button>

          <button
            type="button"
            onClick={() => { setMainCat('notify'); setActiveTab('notifications'); }}
            className={`p-3 rounded-2xl border text-xs font-bold text-left transition-all ${
              mainCat === 'notify'
                ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-xs ring-2 ring-indigo-500/20'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            ⚙️ 通知・連携
            <span className="block text-[10px] font-normal text-slate-400 mt-0.5">メール・LINE・カレンダー</span>
          </button>

        </div>

        {/* 2段階目：サブカテゴリ切り替えタブ（項目が1つだけのカテゴリでは出さない） */}
        {currentSubTabs.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 border-b border-slate-200">
          {currentSubTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === tab.key
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        )}

        {activeTab === 'store_info' && <StoreInfoTab />}
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

        {SHARED_FORM_TABS.includes(activeTab) && (
          <form onSubmit={handleSave} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 md:p-5 space-y-8">
            <div>
              <h2 className="text-base font-bold text-slate-800 mb-1">{FORM_TAB_HEADINGS[activeTab]?.title}</h2>
              <p className="text-sm text-slate-500">{FORM_TAB_HEADINGS[activeTab]?.description}</p>
            </div>

            {activeTab === 'special_rules' && (
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
            )}

            {activeTab === 'reservation_rules' && (<>
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
            </>)}

            {activeTab === 'extension' && (
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
            )}

            {activeTab === 'payment' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-bold text-slate-700 mb-1">利用できる決済方法</h3>
                <p className="text-xs text-slate-400 mb-3">
                  チェックを外した決済方法は、予約の登録・編集画面の選択肢に出なくなります。
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {([
                    { key: 'enable_cash_payment' as const, label: '現金', hint: '当日セラピストへお支払い' },
                    { key: 'enable_credit_payment' as const, label: 'クレジット', hint: '決済ページを案内' },
                    { key: 'enable_paypay_payment' as const, label: 'PayPay', hint: 'PayPayでお支払い' },
                  ]).map(({ key, label, hint }) => (
                    <label key={key} className="flex items-start gap-2 cursor-pointer bg-slate-50 border border-slate-200 rounded-xl p-3">
                      <input
                        type="checkbox"
                        checked={form[key]}
                        onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
                        className="w-4 h-4 accent-indigo-600 mt-0.5"
                      />
                      <span>
                        <span className="block text-xs font-bold text-slate-800">{label}</span>
                        <span className="block text-[10px] text-slate-400">{hint}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {form.enable_credit_payment && (
                <div className="border-t border-slate-100 pt-5 space-y-5">
                  <div>
                    <h3 className="text-sm font-bold text-slate-700 mb-1">クレジット決済手数料率</h3>
                    <p className="text-xs text-slate-400 mb-4">
                      お客様へ請求する手数料です。0%にすると、ご案内の文面から「決済手数料○%込み」の表記が消えます。
                    </p>
                    <div className="flex items-center gap-3 max-w-xs">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={form.credit_card_fee_rate}
                        onChange={(e) => setForm({ ...form, credit_card_fee_rate: Number(e.target.value) })}
                        className="w-full border border-slate-200 rounded-xl bg-slate-50 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50"
                      />
                      <span className="text-sm font-bold text-slate-500">%</span>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-slate-700 mb-1">クレジット決済リンク URL</h3>
                    <p className="text-xs text-slate-400 mb-4">お客様へ送信する決済ページのベースURLを設定します。未設定だとご案内に決済ページのリンクが入りません。</p>
                    <input
                      type="text"
                      placeholder="https://pay.example.com/payment"
                      value={form.credit_payment_url}
                      onChange={(e) => setForm({ ...form, credit_payment_url: e.target.value })}
                      className="w-full border border-slate-200 rounded-xl bg-slate-50 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50"
                    />
                    {!form.credit_payment_url.trim() && (
                      <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2">
                        決済リンクが未設定です。クレジットを選んでも、お客様に決済ページを案内できません。
                      </p>
                    )}
                  </div>
                </div>
              )}

              {form.enable_paypay_payment && (
                <div className="border-t border-slate-100 pt-5">
                  <h3 className="text-sm font-bold text-slate-700 mb-1">PayPay決済手数料率</h3>
                  <p className="text-xs text-slate-400 mb-4">PayPay決済時にお客様へ請求する手数料です。</p>
                  <div className="flex items-center gap-3 max-w-xs">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={form.paypay_fee_rate}
                      onChange={(e) => setForm({ ...form, paypay_fee_rate: Number(e.target.value) })}
                      className="w-full border border-slate-200 rounded-xl bg-slate-50 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50"
                    />
                    <span className="text-sm font-bold text-slate-500">%</span>
                  </div>
                </div>
              )}
            </div>
            )}


            {activeTab === 'integrations' && (
            <div className="space-y-5">

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
            )}

            <div className="flex items-center gap-4 pt-2 border-t border-slate-100">
              <button
                type="submit"
                disabled={saving}
                className="btn-primary"
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
                className="btn-primary"
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

function StoreInfoTab() {
  const { selectedShop, refreshShops } = useShop()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const EMPTY_FORM = {
    name: '',
    short_name: '',
    phone: '',
    hp_url: '',
    business_hours: '',
    address: '',
    access_info: '',
    google_map_url: '',
  }

  const [form, setForm] = useState(EMPTY_FORM)

  useEffect(() => {
    let cancelled = false

    async function loadShop() {
      if (!selectedShop?.id) return
      setLoading(true)
      setError(null)

      const { data, error: fetchErr } = await supabase
        .from('shops')
        .select('name, short_name, phone, hp_url, business_hours, address, access_info, google_map_url')
        .eq('id', selectedShop.id)
        .single()

      if (cancelled) return

      if (fetchErr) {
        setError('店舗情報の読み込みに失敗しました: ' + fetchErr.message)
        setLoading(false)
        return
      }

      setForm({
        name: data?.name || '',
        short_name: data?.short_name || '',
        phone: data?.phone || '',
        hp_url: data?.hp_url || '',
        business_hours: data?.business_hours || '',
        address: data?.address || '',
        access_info: data?.access_info || '',
        google_map_url: (data as any)?.google_map_url || '',
      })
      setLoading(false)
    }

    void loadShop()
    return () => {
      cancelled = true
    }
  }, [selectedShop?.id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedShop?.id) return

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const { error: uErr } = await supabase
        .from('shops')
        .update({
          name: form.name,
          short_name: form.short_name.trim() || null,
          phone: form.phone.trim() || null,
          hp_url: form.hp_url.trim() || null,
          business_hours: form.business_hours.trim() || null,
          address: form.address.trim() || null,
          access_info: form.access_info.trim() || null,
          google_map_url: form.google_map_url.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedShop.id)

      if (uErr) throw uErr

      setSuccess('店舗基本情報・アクセスページを更新しました！')
      if (refreshShops) await refreshShops()
    } catch (err: any) {
      console.error('Failed to save shop info:', err)
      setError(err.message || '店舗情報の保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  if (!selectedShop) {
    return (
      <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-500">
        店舗が選択されていません
      </div>
    )
  }

  if (loading) {
    return (
      <div className="bg-white p-8 rounded-2xl border border-slate-200 flex items-center justify-center gap-3 text-slate-500">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600" />
        <span className="text-xs font-bold">店舗情報を読み込み中...</span>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
      <div className="border-b pb-4">
        <h2 className="text-base font-bold text-slate-800">🏬 店舗プロフィール・基本情報</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          店舗のお問合せ電話番号、営業時間、アクセス案内、Google Mapsを変更できます
        </p>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold">
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-bold">
          {success}
        </div>
      )}

      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">店舗名 *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">店舗略称・バッジ表記</label>
            <input
              type="text"
              value={form.short_name}
              onChange={(e) => setForm({ ...form, short_name: e.target.value })}
              placeholder="例: 周南"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">お問合せ電話番号</label>
            <input
              type="text"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="例: 090-0000-0000"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">店舗HP URL 🌐</label>
            <input
              type="url"
              value={form.hp_url}
              onChange={(e) => setForm({ ...form, hp_url: e.target.value })}
              placeholder="例: https://example.com"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">営業時間</label>
            <input
              type="text"
              value={form.business_hours}
              onChange={(e) => setForm({ ...form, business_hours: e.target.value })}
              placeholder="例: OPEN/11:00～5:00 (受付/10:30〜2:00)"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">住所</label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="例: 東京都新宿区歌舞伎町 / 渋谷区道玄坂"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">アクセス案内文 (Accessページ表示)</label>
            <input
              type="text"
              value={form.access_info}
              onChange={(e) => setForm({ ...form, access_info: e.target.value })}
              placeholder="例: 新宿駅東口徒歩3分・渋谷駅ハチ公口徒歩4分"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Google Maps URL 📍</label>
            <input
              type="text"
              value={form.google_map_url}
              onChange={(e) => setForm({ ...form, google_map_url: e.target.value })}
              placeholder="https://maps.google.com/..."
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
            />
          </div>
        </div>

      </div>

      <div className="pt-4 border-t flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="btn-primary"
        >
          {saving ? '保存中...' : '店舗基本情報を保存'}
        </button>
      </div>
    </form>
  )
}
