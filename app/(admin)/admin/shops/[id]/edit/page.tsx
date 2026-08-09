'use client'

import React, { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function EditShopPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const id = resolvedParams.id
  const router = useRouter()

  const [activeTab, setActiveTab] = useState<'basic' | 'pricing_share' | 'code'>('basic')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // オーナーアカウント選択肢
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>('')
  const [allShops, setAllShops] = useState<{ id: string; name: string }[]>([])

  // 一括統一の実行状態と結果レポート
  const [consolidating, setConsolidating] = useState(false)
  const [consolidateReport, setConsolidateReport] = useState<string[]>([])

  /**
   * グループの料金・バック共有元をこの店舗に統一する。
   * 参照先を切り替えるだけだと旧共有元のデータが取り残されて
   * 「設定が消えた」状態になるため、サーバー側でデータ移送も行う。
   * まず dryRun で移動内容を提示し、承諾を得てから本実行する。
   */
  const runConsolidate = async () => {
    setError('')
    setSuccess('')
    setConsolidateReport([])

    const { data: { session } } = await supabase.auth.getSession()
    const accessToken = session?.access_token
    if (!accessToken) {
      setError('セッションが取得できませんでした。再ログインしてください')
      return
    }

    const ownerId = selectedOwnerId || (allShops.find(s => s.id === id) as any)?.owner_id || null

    const call = async (dryRun: boolean) => {
      const res = await fetch('/api/admin/consolidate-shop-sharing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ targetShopId: id, ownerId, dryRun }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '不明なエラー')
      return json as {
        targetShopName: string
        groupShopNames: string[]
        moved: string[]
        skipped: string[]
        warnings: string[]
      }
    }

    setConsolidating(true)
    try {
      // 1. まず何が起きるかを確認する（データは変更しない）
      const plan = await call(true)

      const lines = [
        `「${plan.targetShopName}」のデータをグループ共通にします。`,
        `対象店舗: ${plan.groupShopNames.join(' / ')}`,
        '',
        plan.moved.length > 0
          ? `【移動するデータ】\n${plan.moved.join('\n')}`
          : '【移動するデータ】\n・なし',
      ]
      if (plan.skipped.length > 0) lines.push('', `【そのままにするデータ】\n${plan.skipped.join('\n')}`)
      if (plan.warnings.length > 0) lines.push('', `【注意】\n${plan.warnings.join('\n')}`)
      lines.push('', '実行しますか？')

      if (!confirm(lines.join('\n'))) {
        setConsolidating(false)
        return
      }

      // 2. 本実行
      const result = await call(false)

      setPricingSourceShopId('')
      setBackSourceShopId('')
      setConsolidateReport([...result.moved, ...result.skipped, ...result.warnings])
      setSuccess(`✨ グループ全店舗の料金・バック共有元を「${result.targetShopName}」に統一しました`)
    } catch (err: any) {
      setError('一括共有設定に失敗しました: ' + err.message)
    } finally {
      setConsolidating(false)
    }
  }

  // 店舗基本フォーム
  const [form, setForm] = useState({
    name: '',
    short_name: '',
    phone: '',
    hp_url: '',
    is_active: true,
    is_dispatch_enabled: false,
  })

  // 代行・マルチ店舗共有
  const [pricingSourceShopId, setPricingSourceShopId] = useState<string>('')
  const [backSourceShopId, setBackSourceShopId] = useState<string>('')

  // 予約連携コード
  const [reservationCode, setReservationCode] = useState('')
  const [savedCode, setSavedCode] = useState('')
  const [codeActive, setCodeActive] = useState(true)
  const [codeSaving, setCodeSaving] = useState(false)
  const [codeError, setCodeError] = useState('')

  // 契約プラン & 3機能フラグ（オーナーアカウントの編集は /users に集約）
  const [ownerForm, setOwnerForm] = useState({
    plan: 'agency_only_plan',
    has_hp: false,
    has_reserve: false,
    has_agency: true,
  })

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      setError('')

      try {
        // 全店舗一覧（共有元選択用）
        const { data: shopsData } = await supabase.from('shops').select('id, name').neq('id', id)
        if (shopsData) setAllShops(shopsData)

        // 1. 対象店舗データ
        const { data: shopRes, error: shopErr } = await supabase
          .from('shops')
          .select('*')
          .eq('id', id)
          .single()

        if (shopErr || !shopRes) {
          setError('店舗データが見つかりません。')
          setLoading(false)
          return
        }

        setSelectedOwnerId(shopRes.owner_id || '')
        setPricingSourceShopId(shopRes.pricing_source_shop_id || '')
        setBackSourceShopId(shopRes.back_source_shop_id || '')

        setForm({
          name: shopRes.name || '',
          short_name: shopRes.short_name || '',
          phone: shopRes.phone || shopRes.phone_number || '',
          hp_url: shopRes.hp_url || '',
          is_active: !!shopRes.is_active,
          is_dispatch_enabled: !!shopRes.is_dispatch_enabled,
        })

        // プラン情報の復元（DBに値が無い店舗はプラン名から推測）
        const savedPlan = (shopRes as any).plan || 'agency_only_plan'
        const savedHasHp = (shopRes as any).has_hp ?? ['hp_web_reserve_plan', 'hp_web_agency_plan'].includes(savedPlan)
        const savedHasReserve = (shopRes as any).has_reserve ?? ['web_agency_plan', 'hp_web_reserve_plan', 'hp_web_agency_plan'].includes(savedPlan)
        const savedHasAgency = (shopRes as any).has_agency ?? ['agency_only_plan', 'web_agency_plan', 'hp_web_agency_plan', 'agency_plan'].includes(savedPlan)

        setOwnerForm({
          plan: savedPlan,
          has_hp: savedHasHp,
          has_reserve: savedHasReserve,
          has_agency: savedHasAgency,
        })

        // 予約連携コード
        const { data: codeData } = await supabase
          .from('shop_reservation_codes')
          .select('code, is_active')
          .eq('shop_id', id)
          .maybeSingle()

        if (codeData) {
          setReservationCode(codeData.code)
          setSavedCode(codeData.code)
          setCodeActive(codeData.is_active ?? true)
        }

      } catch (err: any) {
        setError('読み込みエラー: ' + err.message)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [id])

  // 予約連携コード保存
  const handleSaveCode = async () => {
    const raw = reservationCode.trim()
    if (!raw) {
      setCodeError('コードを入力してください。')
      return
    }

    setCodeSaving(true)
    setCodeError('')

    try {
      const { data: dup } = await supabase
        .from('shop_reservation_codes')
        .select('id')
        .eq('code', raw)
        .neq('shop_id', id)
        .maybeSingle()

      if (dup) {
        setCodeError('このコードは既に他の店舗で使用されています。')
        setCodeSaving(false)
        return
      }

      const { data: existing } = await supabase
        .from('shop_reservation_codes')
        .select('id')
        .eq('shop_id', id)
        .maybeSingle()

      if (existing) {
        const { error: updateErr } = await supabase
          .from('shop_reservation_codes')
          .update({
            code: raw,
            is_active: codeActive,
          })
          .eq('shop_id', id)

        if (updateErr) throw updateErr
      } else {
        const { error: insertErr } = await supabase
          .from('shop_reservation_codes')
          .insert({
            shop_id: id,
            code: raw,
            is_active: codeActive,
          })

        if (insertErr) throw insertErr
      }

      setSavedCode(raw)
      alert('Web予約連携コードを保存しました！')
    } catch (err: any) {
      setCodeError('保存失敗: ' + err.message)
    } finally {
      setCodeSaving(false)
    }
  }

  // 店舗管理全保存
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      // 1. 店舗プロファイル更新
      const baseShopPayload: any = {
        name: form.name,
        short_name: form.short_name.trim() || null,
        phone: form.phone.trim() || null,
        hp_url: form.hp_url.trim() || null,
        is_active: form.is_active,
        is_dispatch_enabled: form.is_dispatch_enabled,
        pricing_source_shop_id: pricingSourceShopId || null,
        back_source_shop_id: backSourceShopId || null,
        updated_at: new Date().toISOString(),
      }

      // 契約プラン・機能フラグも同時に保存
      const shopPayload = {
        ...baseShopPayload,
        plan: ownerForm.plan,
        has_hp: ownerForm.has_hp,
        has_reserve: ownerForm.has_reserve,
        has_agency: ownerForm.has_agency,
      }

      const { error: shopErr } = await supabase.from('shops').update(shopPayload).eq('id', id)
      if (shopErr) throw shopErr

      setSuccess('✨ 店舗設定および契約プランを正常に保存しました！')
      alert('✨ 店舗設定および契約プランを正常に保存しました！')
    } catch (err: any) {
      console.error(err)
      setError('保存に失敗しました: ' + (err.message || '通信エラー'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500 font-sans">
        <div className="animate-spin inline-block w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full mb-2" />
        <p>店舗管理データを読み込み中...</p>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 font-sans space-y-6">
      
      {/* ヘッダー */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-4">
        <div>
          <Link href="/admin" className="text-xs text-indigo-600 hover:underline flex items-center gap-1 mb-1 font-bold">
            ← SaaS店舗一覧に戻る
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">店舗管理 ＆ システム設定</h1>
          <p className="text-xs text-slate-500">店舗登録情報、オーナーアカウント、システム共有、Web予約コードを編集・管理します</p>
        </div>
      </div>

      {/* 3つのSaaS管理タブ */}
      <div className="flex border-b border-slate-200 gap-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab('basic')}
          className={`px-4 py-3 font-bold text-xs border-b-2 shrink-0 transition-all ${
            activeTab === 'basic'
              ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          🏬 基本情報 ＆ オーナー設定
        </button>

        <button
          onClick={() => setActiveTab('pricing_share')}
          className={`px-4 py-3 font-bold text-xs border-b-2 shrink-0 transition-all ${
            activeTab === 'pricing_share'
              ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          💰 料金 ＆ バック計算共有 (代行グループ)
        </button>

        <button
          onClick={() => setActiveTab('code')}
          className={`px-4 py-3 font-bold text-xs border-b-2 shrink-0 transition-all ${
            activeTab === 'code'
              ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          🔑 Web予約連携コード設定
        </button>
      </div>

      {/* メッセージ */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold">
          {error}
        </div>
      )}
      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs font-bold">
          {success}
        </div>
      )}

      {/* タブ1: 店舗基本情報 & オーナーアカウント割り当て */}
      {activeTab === 'basic' && (
        <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-slate-800 border-b pb-2">店舗プロファイル基本設定</h2>

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
                  placeholder="例: 周南、赤羽"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">お問合せ電話番号</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="例: 070-1462-0389"
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
            </div>
            <div className="flex items-center gap-6 pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 rounded"
                />
                <span className="text-xs font-bold text-slate-700">店舗を有効（稼働中）にする</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_dispatch_enabled}
                  onChange={(e) => setForm({ ...form, is_dispatch_enabled: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 rounded"
                />
                <span className="text-xs font-bold text-slate-700">派遣（デリバリー）機能を有効にする</span>
              </label>
            </div>
          </div>

          {/* クライアントオーナーアカウント設定 ＆ 3機能モジュール */}
          <div className="space-y-5 pt-4 border-t">
            <div className="border-b pb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-slate-800">🔑 契約プラン ＆ 3機能モジュール設定</h2>
                <p className="text-xs text-slate-500">店舗の利用機能（HP管理 / Web予約 / 電話代行）をワンタップで契約・切り替えできます</p>
              </div>
            </div>

            {/* ワンタップ プリセット選択ボタン */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">⚡ ワンタップ・プランプリセット選択</label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <button
                  type="button"
                  onClick={() => setOwnerForm({ ...ownerForm, plan: 'agency_only_plan', has_hp: false, has_reserve: false, has_agency: true })}
                  className={`px-3 py-2.5 rounded-xl border text-xs font-bold text-left transition-all ${
                    !ownerForm.has_hp && !ownerForm.has_reserve && ownerForm.has_agency
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm ring-2 ring-indigo-500/20'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  📞 代行単体
                  <span className="block text-[10px] font-normal text-slate-400 mt-0.5">電話代行のみ</span>
                </button>

                <button
                  type="button"
                  onClick={() => setOwnerForm({ ...ownerForm, plan: 'web_agency_plan', has_hp: false, has_reserve: true, has_agency: true })}
                  className={`px-3 py-2.5 rounded-xl border text-xs font-bold text-left transition-all ${
                    !ownerForm.has_hp && ownerForm.has_reserve && ownerForm.has_agency
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm ring-2 ring-indigo-500/20'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  💙 代行＋Web予約
                  <span className="block text-[10px] font-normal text-slate-400 mt-0.5">こころリンス型</span>
                </button>

                <button
                  type="button"
                  onClick={() => setOwnerForm({ ...ownerForm, plan: 'hp_web_agency_plan', has_hp: true, has_reserve: true, has_agency: true })}
                  className={`px-3 py-2.5 rounded-xl border text-xs font-bold text-left transition-all ${
                    ownerForm.has_hp && ownerForm.has_reserve && ownerForm.has_agency
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm ring-2 ring-indigo-500/20'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  🌟 フルセット
                  <span className="block text-[10px] font-normal text-slate-400 mt-0.5">HP＋Web予約＋代行</span>
                </button>

                <button
                  type="button"
                  onClick={() => setOwnerForm({ ...ownerForm, plan: 'hp_web_reserve_plan', has_hp: true, has_reserve: true, has_agency: false })}
                  className={`px-3 py-2.5 rounded-xl border text-xs font-bold text-left transition-all ${
                    ownerForm.has_hp && ownerForm.has_reserve && !ownerForm.has_agency
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm ring-2 ring-indigo-500/20'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  🌸 HP＋Web予約
                  <span className="block text-[10px] font-normal text-slate-400 mt-0.5">HP＋予約システム</span>
                </button>

                <button
                  type="button"
                  onClick={() => setOwnerForm({ ...ownerForm, plan: 'web_reserve_plan', has_hp: false, has_reserve: true, has_agency: false })}
                  className={`px-3 py-2.5 rounded-xl border text-xs font-bold text-left transition-all ${
                    !ownerForm.has_hp && ownerForm.has_reserve && !ownerForm.has_agency
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm ring-2 ring-indigo-500/20'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  📅 Web予約単体
                  <span className="block text-[10px] font-normal text-slate-400 mt-0.5">自社WordPress使用</span>
                </button>
              </div>
            </div>

            {/* 個別3機能モジュール チェックボックス */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <label className="block text-xs font-bold text-slate-700">🧩 利用可能機能モジュール（個別ON/OFF）</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="flex items-center gap-2 cursor-pointer bg-white p-2.5 rounded-lg border border-slate-200">
                  <input
                    type="checkbox"
                    checked={ownerForm.has_hp}
                    onChange={(e) => setOwnerForm({ ...ownerForm, has_hp: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                  <div>
                    <span className="block text-xs font-bold text-slate-800">🌐 HP制作・管理機能</span>
                    <span className="text-[10px] text-slate-400">HP設定・バナー・トピックス</span>
                  </div>
                </label>

                <label className="flex items-center gap-2 cursor-pointer bg-white p-2.5 rounded-lg border border-slate-200">
                  <input
                    type="checkbox"
                    checked={ownerForm.has_reserve}
                    onChange={(e) => setOwnerForm({ ...ownerForm, has_reserve: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                  <div>
                    <span className="block text-xs font-bold text-slate-800">📅 Web予約・顧客管理</span>
                    <span className="text-[10px] text-slate-400">Web予約・シフト・システム</span>
                  </div>
                </label>

                <label className="flex items-center gap-2 cursor-pointer bg-white p-2.5 rounded-lg border border-slate-200">
                  <input
                    type="checkbox"
                    checked={ownerForm.has_agency}
                    onChange={(e) => setOwnerForm({ ...ownerForm, has_agency: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                  <div>
                    <span className="block text-xs font-bold text-slate-800">📞 電話代行・mts集計</span>
                    <span className="text-[10px] text-slate-400">代行集計・20日締め表示</span>
                  </div>
                </label>
              </div>
            </div>

            {/* オーナーアカウントの作成・編集は「アカウント管理」に集約 */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-xl p-4">
              <div>
                <p className="text-xs font-bold text-slate-700">オーナーのログインID・パスワードの変更</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  アカウントの新規作成・編集・削除は「アカウント管理」画面に集約しました。
                </p>
              </div>
              <Link
                href="/users"
                className="shrink-0 px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 transition-all text-center"
              >
                アカウント管理を開く
              </Link>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="btn-primary w-full"
          >
            {saving ? '保存中...' : '店舗基本情報 ＆ プラン設定を保存'}
          </button>
        </form>
      )}

      {/* タブ2: 料金 ＆ バック計算共有設定 (代行・グループマルチ店舗共有) */}
      {activeTab === 'pricing_share' && (
        <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-slate-800 border-b pb-2">代行プラン・マルチショップ共有設定</h2>
            <p className="text-xs text-slate-500">
              同一営業の複数店舗（バカラグループ等）で「料金設定」「バック設定」を1つの共通データとして共有する場合に設定します。
            </p>

            <div className="p-3.5 bg-indigo-50/80 border border-indigo-100 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-indigo-900">⚡ ワンタップ・一括共有設定</h3>
                  <p className="text-[11px] text-indigo-700 mt-0.5">どの店舗から料金やランク・バック率を変更しても、グループ全店で即時共通化されます。</p>
                  <p className="text-[11px] text-indigo-700 mt-1">
                    旧共有元にデータが残っている場合は、この店舗へ移送してから切り替えます（実行前に内容を確認できます）。
                  </p>
                </div>
                <button
                  type="button"
                  disabled={consolidating}
                  onClick={runConsolidate}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-lg shadow-sm transition-all shrink-0"
                >
                  {consolidating ? '処理中...' : '⚡ この店舗データに全グループ一括統一'}
                </button>
              </div>

              {consolidateReport.length > 0 && (
                <ul className="mt-1 space-y-0.5 text-[11px] text-indigo-900 bg-white/70 border border-indigo-100 rounded-lg p-2.5">
                  {consolidateReport.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">料金設定 (コース・オプション・割引・指名種別) の共有元店舗</label>
              <select
                value={pricingSourceShopId}
                onChange={(e) => setPricingSourceShopId(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
              >
                <option value="">共有しない（自店舗のデータを使用）</option>
                {allShops.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} の料金データを共有する {s.id === id ? ' (※この店舗自身が共有マスター)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">バック計算設定 (セラピストバック・ルール) の共有元店舗</label>
              <select
                value={backSourceShopId}
                onChange={(e) => setBackSourceShopId(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
              >
                <option value="">共有しない（自店舗のデータを使用）</option>
                {allShops.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} のバック計算ルールを共有する {s.id === id ? ' (※この店舗自身が共有マスター)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="btn-primary w-full"
          >
            {saving ? '保存中...' : '共有設定を保存'}
          </button>
        </form>
      )}

      {/* タブ3: Web予約連携コード設定 */}
      {activeTab === 'code' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-slate-800 border-b pb-2">Web予約システム連携用アクセスコード</h2>
            <p className="text-xs text-slate-500">
              一般お客様用Web予約画面（`/reserve/[code]`）で店舗を識別するための固有セキュリティコードです。
            </p>

            {codeError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold">
                {codeError}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">予約連携コード (英数字)</label>
              <input
                type="text"
                value={reservationCode}
                onChange={(e) => setReservationCode(e.target.value)}
                placeholder="例: sg2026, specialgrade-code"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold font-mono text-slate-800"
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={codeActive}
                onChange={(e) => setCodeActive(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded"
              />
              <span className="text-xs font-bold text-slate-700">このコードによる予約受付を有効にする</span>
            </label>

            {savedCode && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="text-[11px] text-slate-500 font-bold">一般顧客用 Web予約URL:</span>
                <p className="text-xs font-mono font-bold text-indigo-600 select-all">
                  {typeof window !== 'undefined' ? `${window.location.origin}/reserve/${savedCode}` : `/reserve/${savedCode}`}
                </p>
              </div>
            )}
          </div>

          <button
            onClick={handleSaveCode}
            disabled={codeSaving}
            className="btn-primary w-full"
          >
            {codeSaving ? '保存中...' : 'Web予約連携コードを保存'}
          </button>
        </div>
      )}

    </div>
  )
}
