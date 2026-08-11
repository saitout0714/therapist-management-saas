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

  // 共有設定を変更したときの結果レポート
  const [consolidateReport, setConsolidateReport] = useState<string[]>([])
  /**
   * グループの共有設定（料金 or バック）を切り替える。
   * 参照先を変えるだけだとデータが取り残されて「設定が消えた」ように見えるため、
   * 必ず先に dryRun で「何が動くか・何が空になるか」を提示してから実行する。
   */
  const applySharing = async (
    scope: 'pricing' | 'back',
    mode: 'shared' | 'independent',
    baseShopId: string
  ) => {
    setError('')
    setSuccess('')
    const kindLabel = scope === 'pricing' ? '料金設定' : 'バック設定'

    if (mode === 'shared' && !baseShopId) {
      setError(`${kindLabel}を共有する基準店舗を選んでください`)
      return
    }

    const { data: { session } } = await supabase.auth.getSession()
    const accessToken = session?.access_token
    if (!accessToken) {
      setError('セッションが取得できませんでした。再ログインしてください')
      return
    }

    const call = async (dryRun: boolean) => {
      const res = await fetch('/api/admin/consolidate-shop-sharing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          // 独立に戻す場合も店舗の特定にこの店舗を使う
          targetShopId: mode === 'shared' ? baseShopId : id,
          ownerId: selectedOwnerId || null,
          scope,
          mode,
          dryRun,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '不明なエラー')
      return json as { targetShopName: string; groupShopNames: string[]; moved: string[]; skipped: string[]; warnings: string[] }
    }

    setSharingSaving(scope)
    try {
      const plan = await call(true)
      const baseName = groupShops.find((s) => s.id === baseShopId)?.name || plan.targetShopName

      const lines = [
        mode === 'shared'
          ? `${kindLabel}を「${baseName}」のものにグループ全体で統一します。`
          : `${kindLabel}を店舗ごとに独立させます。各店舗は自前のデータを使うようになります。`,
        `対象店舗: ${plan.groupShopNames.join(' / ')}`,
      ]
      if (plan.moved.length > 0) lines.push('', `【移動するデータ】\n${plan.moved.join('\n')}`)
      if (plan.skipped.length > 0) lines.push('', `【そのままにするデータ】\n${plan.skipped.join('\n')}`)
      if (plan.warnings.length > 0) lines.push('', `【注意】\n${plan.warnings.join('\n')}`)
      lines.push('', '実行しますか？')

      if (!confirm(lines.join('\n'))) return

      const result = await call(false)
      setOwnerSharing((prev) =>
        prev
          ? scope === 'pricing'
            ? { ...prev, pricingMode: mode, pricingBaseShopId: mode === 'shared' ? baseShopId : '' }
            : { ...prev, backMode: mode, backBaseShopId: mode === 'shared' ? baseShopId : '' }
          : prev
      )
      setConsolidateReport([...result.moved, ...result.skipped, ...result.warnings])
      setSuccess(
        mode === 'shared'
          ? `✨ ${kindLabel}を「${baseName}」に統一しました`
          : `✨ ${kindLabel}を店舗ごとに独立させました`
      )
    } catch (err: any) {
      setError(`${kindLabel}の変更に失敗しました: ` + err.message)
    } finally {
      setSharingSaving(null)
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

  /**
   * 料金・バックを共有するかはオーナー（グループ）単位の設定が正。
   * 店舗ごとの共有元指定は旧方式で、店舗が増えるたびに指し直す必要があった。
   */
  type OwnerSharing = {
    ownerName: string
    pricingMode: 'shared' | 'independent'
    pricingBaseShopId: string
    backMode: 'shared' | 'independent'
    backBaseShopId: string
  }
  const [ownerSharing, setOwnerSharing] = useState<OwnerSharing | null>(null)
  const [groupShops, setGroupShops] = useState<{ id: string; name: string }[]>([])
  const [sharingSaving, setSharingSaving] = useState<'pricing' | 'back' | null>(null)

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
        // グループ（オーナー）の共有設定と、基準店の候補になる同一オーナーの店舗
        const { data: selfShop } = await supabase.from('shops').select('owner_id, name').eq('id', id).maybeSingle()
        if (selfShop?.owner_id) {
          const [{ data: ownerRow }, { data: siblings }] = await Promise.all([
            supabase
              .from('owners')
              .select('id, name, pricing_mode, pricing_base_shop_id, back_mode, back_base_shop_id')
              .eq('id', selfShop.owner_id)
              .maybeSingle(),
            supabase.from('shops').select('id, name').eq('owner_id', selfShop.owner_id).order('name'),
          ])
          if (ownerRow) {
            setOwnerSharing({
              ownerName: ownerRow.name || '',
              pricingMode: (ownerRow.pricing_mode as 'shared' | 'independent') || 'independent',
              pricingBaseShopId: ownerRow.pricing_base_shop_id || '',
              backMode: (ownerRow.back_mode as 'shared' | 'independent') || 'independent',
              backBaseShopId: ownerRow.back_base_shop_id || '',
            })
          }
          setGroupShops(siblings || [])
        } else {
          setGroupShops(selfShop ? [{ id: id as string, name: selfShop.name }] : [])
        }

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
        // 共有元(*_source_shop_id)はここでは触らない。
        // 共有設定は /api/admin/consolidate-shop-sharing がデータ移送とセットで更新するため、
        // 画面ロード時の古い値でここから上書きすると設定が巻き戻ってしまう。
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

            {consolidateReport.length > 0 && (
              <ul className="space-y-0.5 text-[11px] text-indigo-900 bg-indigo-50/80 border border-indigo-100 rounded-xl p-2.5">
                {consolidateReport.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            )}

            {!ownerSharing ? (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                この店舗にオーナーが設定されていないため、グループの共有設定を編集できません。
                先に「店舗情報」タブでオーナーを設定してください。
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-[11px] text-slate-500">
                  ここでの変更は <span className="font-bold text-slate-700">{ownerSharing.ownerName}</span> の
                  全{groupShops.length}店舗（{groupShops.map((s) => s.name).join(' / ')}）に適用されます。
                </div>

                {([
                  { scope: 'pricing' as const, title: '料金設定', detail: 'コース・オプション・割引・指名種別', mode: ownerSharing.pricingMode, base: ownerSharing.pricingBaseShopId },
                  { scope: 'back' as const, title: 'バック設定', detail: 'セラピストランク・ランク別バック・控除ルール', mode: ownerSharing.backMode, base: ownerSharing.backBaseShopId },
                ]).map(({ scope, title, detail, mode, base }) => (
                  <div key={scope} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <div>
                      <h3 className="text-xs font-bold text-slate-800">{title}</h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">{detail}</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={sharingSaving !== null}
                        onClick={() => applySharing(scope, 'independent', '')}
                        className={`px-3.5 py-2 text-xs font-bold rounded-lg border transition-all disabled:opacity-50 ${
                          mode === 'independent'
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                            : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        店舗ごとに独立
                      </button>
                      <button
                        type="button"
                        disabled={sharingSaving !== null}
                        onClick={() => applySharing(scope, 'shared', base || (id as string))}
                        className={`px-3.5 py-2 text-xs font-bold rounded-lg border transition-all disabled:opacity-50 ${
                          mode === 'shared'
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                            : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        グループで共有
                      </button>
                      {sharingSaving === scope && <span className="text-xs text-slate-500 self-center">処理中...</span>}
                    </div>

                    {mode === 'shared' && (
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">基準にする店舗</label>
                        <select
                          value={base}
                          disabled={sharingSaving !== null}
                          onChange={(e) => applySharing(scope, 'shared', e.target.value)}
                          className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 disabled:opacity-50"
                        >
                          <option value="">選択してください</option>
                          {groupShops.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name} の{title}を全店舗で使う
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <p className="text-[11px] text-slate-500">
                      {mode === 'shared'
                        ? `現在: ${groupShops.find((s) => s.id === base)?.name || '未設定'} の${title}を全店舗で使用中`
                        : `現在: 各店舗が自分の${title}を使用中`}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
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
