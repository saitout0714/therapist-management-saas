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
  const [owners, setOwners] = useState<{ id: string; name: string }[]>([])
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>('')
  const [allShops, setAllShops] = useState<{ id: string; name: string }[]>([])

  // 店舗基本フォーム
  const [form, setForm] = useState({
    name: '',
    short_name: '',
    phone: '',
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

  // クライアントオーナーアカウント入力
  const [hasOwner, setHasOwner] = useState(false)
  const [ownerForm, setOwnerForm] = useState({
    name: '',
    plan: 'agency_plan',
    login_id: '',
    password: '',
  })

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      setError('')

      try {
        // 全店舗一覧（共有元選択用）
        const { data: shopsData } = await supabase.from('shops').select('id, name').neq('id', id)
        if (shopsData) setAllShops(shopsData)

        // オーナー候補ユーザー一覧
        const { data: usersData } = await supabase
          .from('users')
          .select('id, name')
          .in('role', ['client_owner', 'store_owner', 'agency_staff'])
        if (usersData) setOwners(usersData)

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
          is_active: !!shopRes.is_active,
          is_dispatch_enabled: !!shopRes.is_dispatch_enabled,
        })

        // クライアントオーナーアカウント
        const { data: ownerUser } = await supabase
          .from('users')
          .select('name, login_id, plan')
          .eq('shop_id', id)
          .eq('role', 'client_owner')
          .maybeSingle()

        if (ownerUser) {
          setHasOwner(true)
          setOwnerForm({
            name: ownerUser.name || '',
            plan: (ownerUser as any).plan || 'agency_plan',
            login_id: ownerUser.login_id || '',
            password: '',
          })
        }

        // 予約連携コード
        const { data: codeData } = await supabase
          .from('reservation_codes')
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
        .from('reservation_codes')
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
        .from('reservation_codes')
        .select('id')
        .eq('shop_id', id)
        .maybeSingle()

      if (existing) {
        const { error: updateErr } = await supabase
          .from('reservation_codes')
          .update({
            code: raw,
            is_active: codeActive,
            updated_at: new Date().toISOString(),
          })
          .eq('shop_id', id)

        if (updateErr) throw updateErr
      } else {
        const { error: insertErr } = await supabase
          .from('reservation_codes')
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
    setSuccess('')

    try {
      // 1. 店舗情報更新
      let updatePayload: any = {
        name: form.name,
        owner_id: selectedOwnerId || null,
        short_name: form.short_name.trim() || null,
        phone: form.phone.trim() || null,
        is_active: form.is_active,
        is_dispatch_enabled: form.is_dispatch_enabled,
        pricing_source_shop_id: pricingSourceShopId || null,
        back_source_shop_id: backSourceShopId || null,
        updated_at: new Date().toISOString(),
      }

      let { error: updateError } = await supabase
        .from('shops')
        .update(updatePayload)
        .eq('id', id)

      if (updateError) throw updateError

      // 2. オーナーアカウント設定
      if (ownerForm.name) {
        if (hasOwner) {
          const updateObj: any = { name: ownerForm.name }
          if (ownerForm.login_id) updateObj.login_id = ownerForm.login_id
          if (ownerForm.password) updateObj.password = ownerForm.password

          await supabase
            .from('users')
            .update(updateObj)
            .eq('shop_id', id)
            .eq('role', 'client_owner')
        } else if (ownerForm.login_id && ownerForm.password) {
          await supabase.from('users').insert({
            shop_id: id,
            role: 'client_owner',
            name: ownerForm.name,
            login_id: ownerForm.login_id,
            password: ownerForm.password,
          })
          setHasOwner(true)
        }
      }

      setSuccess('店舗基本情報、システム設定、オーナーアカウントを保存・更新しました！')
    } catch (err: any) {
      setError('保存処理に失敗しました: ' + err.message)
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
              <label className="block text-xs font-bold text-slate-700 mb-1">担当オーナー選択（ユーザー紐付け）</label>
              <select
                value={selectedOwnerId}
                onChange={(e) => setSelectedOwnerId(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
              >
                <option value="">未割り当て</option>
                {owners.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} ({o.id.slice(0, 8)})
                  </option>
                ))}
              </select>
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

          {/* クライアントオーナーアカウント設定 */}
          <div className="space-y-4 pt-4 border-t">
            <h2 className="text-sm font-bold text-slate-800 border-b pb-2 flex items-center justify-between">
              <span>🔑 クライアントオーナーアカウント ＆ 契約プラン設定</span>
              <span className="text-xs text-slate-400 font-normal">店舗の権限と契約プランを設定します</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">オーナー表示名</label>
                <input
                  type="text"
                  value={ownerForm.name}
                  onChange={(e) => setOwnerForm({ ...ownerForm, name: e.target.value })}
                  placeholder="例: SpecialGrade オーナー"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">契約プラン（権限）</label>
                <select
                  value={ownerForm.plan}
                  onChange={(e) => setOwnerForm({ ...ownerForm, plan: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                >
                  <option value="agency_plan">代行プラン（全機能）</option>
                  <option value="web_reserve_plan">web予約プラン</option>
                  <option value="standard_plan">標準プラン</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ログインID</label>
                <input
                  type="text"
                  value={ownerForm.login_id}
                  onChange={(e) => setOwnerForm({ ...ownerForm, login_id: e.target.value })}
                  placeholder="例: owner_sg"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">パスワード</label>
                <input
                  type="password"
                  value={ownerForm.password}
                  onChange={(e) => setOwnerForm({ ...ownerForm, password: e.target.value })}
                  placeholder={hasOwner ? '変更する場合のみ入力' : 'パスワードを設定'}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm tracking-wider rounded-xl shadow-lg transition-all"
          >
            {saving ? '保存中...' : '店舗基本情報 ＆ オーナー設定を保存'}
          </button>
        </form>
      )}

      {/* タブ2: 料金 ＆ バック計算共有設定 (代行・グループマルチ店舗共有) */}
      {activeTab === 'pricing_share' && (
        <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-slate-800 border-b pb-2">代行プラン・マルチショップ共有設定</h2>
            <p className="text-xs text-slate-500">
              同一営業の複数店舗（グループ店）で「料金設定」「バック設定」を別店舗の1つのデータとして共有する場合に選択します。
            </p>

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
                    {s.name} の料金データを共有する
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
                    {s.name} のバック計算ルールを共有する
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm tracking-wider rounded-xl shadow-lg transition-all"
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
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm tracking-wider rounded-xl shadow-lg transition-all"
          >
            {codeSaving ? '保存中...' : 'Web予約連携コードを保存'}
          </button>
        </div>
      )}

    </div>
  )
}
