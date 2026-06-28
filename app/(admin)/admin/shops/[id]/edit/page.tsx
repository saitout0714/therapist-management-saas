'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

function EmbedCodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const embedCode = `<iframe\n  src="${origin}/reserve/${code}?embed=1"\n  width="100%"\n  height="900"\n  frameborder="0"\n  style="border:none;"\n></iframe>`

  const handleCopy = () => {
    void navigator.clipboard.writeText(embedCode).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-slate-600">ホームページ埋め込みコード（iframe）</p>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
        >
          {copied ? (
            <>
              <svg className="w-3.5 h-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              コピーしました
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              コピー
            </>
          )}
        </button>
      </div>
      <pre className="text-xs font-mono text-slate-700 whitespace-pre-wrap break-all bg-white border border-slate-100 rounded-lg p-3 leading-relaxed">{embedCode}</pre>
      <p className="text-xs text-slate-400 mt-2">クライアントのホームページにこのコードを貼り付けると、予約フォームが埋め込まれます。</p>
    </div>
  )
}

export default function EditShopPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '',
    description: '',
    phone: '',
    is_active: true,
  })
  const [reservationCode, setReservationCode] = useState('')
  const [savedCode, setSavedCode] = useState('')
  const [codeActive, setCodeActive] = useState(true)
  const [codeSaving, setCodeSaving] = useState(false)
  const [codeError, setCodeError] = useState('')

  // クライアントオーナーアカウント状態
  const [hasOwner, setHasOwner] = useState(false)
  const [ownerUserId, setOwnerUserId] = useState('')
  const [ownerForm, setOwnerForm] = useState({
    name: '',
    login_id: '',
    password: '',
    role: 'agency_client_owner' as 'agency_client_owner' | 'simple_client_owner',
  })

  // 店舗連携設定用状態
  const [otherShops, setOtherShops] = useState<{ id: string; name: string }[]>([])
  const [links, setLinks] = useState<any[]>([])
  const [linksLoading, setLinksLoading] = useState(true)
  const [linksError, setLinksError] = useState('')

  useEffect(() => {
    const fetchShop = async () => {
      const [shopRes, codeRes, ownerRes] = await Promise.all([
        supabase.from('shops').select('*').eq('id', id).single(),
        supabase.from('shop_reservation_codes').select('code, is_active').eq('shop_id', id).single(),
        supabase
          .from('shop_owners')
          .select(`
            user_id,
            users (
              id,
              login_id,
              name,
              role
            )
          `)
          .eq('shop_id', id)
      ])

      if (shopRes.error || !shopRes.data) {
        setError('店舗情報の取得に失敗しました')
        setLoading(false)
        return
      }

      setForm({
        name: shopRes.data.name,
        description: shopRes.data.description || '',
        phone: shopRes.data.phone || '',
        is_active: shopRes.data.is_active,
      })

      if (!codeRes.error && codeRes.data) {
        setReservationCode(codeRes.data.code)
        setSavedCode(codeRes.data.code)
        setCodeActive(codeRes.data.is_active)
      }

      // クライアントオーナーアカウントの取得とマッピング
      if (ownerRes.data && ownerRes.data.length > 0) {
        // プランオーナーのロールに一致するものを探す
        const ownerRelation = ownerRes.data.find((item: any) => {
          const user = Array.isArray(item.users) ? item.users[0] : item.users
          return user && (user.role === 'agency_client_owner' || user.role === 'simple_client_owner')
        })

        if (ownerRelation) {
          const user = Array.isArray(ownerRelation.users) ? ownerRelation.users[0] : ownerRelation.users
          if (user) {
            setHasOwner(true)
            setOwnerUserId(user.id)
            setOwnerForm({
              name: user.name || '',
              login_id: user.login_id || '',
              password: '', // パスワードは非表示
              role: user.role as any,
            })
          }
        }
      }

      setLoading(false)
    }

    void fetchShop()
    void fetchLinks()
  }, [id])

  const fetchLinks = async () => {
    setLinksLoading(true)
    setLinksError('')
    try {
      const [otherShopsRes, linksRes] = await Promise.all([
        supabase.from('shops').select('id, name').neq('id', id).order('name'),
        supabase.from('shop_links').select('*').or(`shop_id_1.eq.${id},shop_id_2.eq.${id}`).eq('is_active', true)
      ])
      if (otherShopsRes.error) throw otherShopsRes.error
      if (linksRes.error) throw linksRes.error

      setOtherShops(otherShopsRes.data || [])
      setLinks(linksRes.data || [])
    } catch (err: any) {
      setLinksError('連携データの取得に失敗しました: ' + err.message)
    } finally {
      setLinksLoading(false)
    }
  }

  const handleToggleLink = async (targetShopId: string, isCurrentlyLinked: boolean) => {
    setLinksError('')
    const [id1, id2] = id < targetShopId ? [id, targetShopId] : [targetShopId, id]
    try {
      if (isCurrentlyLinked) {
        const { error: deleteError } = await supabase
          .from('shop_links')
          .delete()
          .eq('shop_id_1', id1)
          .eq('shop_id_2', id2)
        if (deleteError) throw deleteError
      } else {
        const { error: insertError } = await supabase
          .from('shop_links')
          .insert([{ shop_id_1: id1, shop_id_2: id2, is_active: true }])
        if (insertError) throw insertError
      }
      await fetchLinks()
    } catch (err: any) {
      setLinksError('連携状態の更新に失敗しました: ' + err.message)
    }
  }

  const handleSaveCode = async () => {
    setCodeSaving(true)
    setCodeError('')
    const code = reservationCode.trim()
    if (!code) {
      setCodeError('URLコードを入力してください')
      setCodeSaving(false)
      return
    }
    if (!/^[a-z0-9-]+$/.test(code)) {
      setCodeError('半角英小文字・数字・ハイフンのみ使用できます')
      setCodeSaving(false)
      return
    }
    const { error: upsertError } = await supabase
      .from('shop_reservation_codes')
      .upsert({ shop_id: id, code, is_active: codeActive }, { onConflict: 'shop_id' })
    if (upsertError) {
      const msg = upsertError.message
      if (msg.includes('unique') || msg.includes('duplicate')) {
        setCodeError('このコードは既に使用されています')
      } else if (msg.includes('does not exist') || msg.includes('relation')) {
        setCodeError('テーブルが存在しません。Supabaseホームで add-web-reservation.sql を実行してください。')
      } else {
        setCodeError('保存に失敗しました: ' + msg)
      }
    } else {
      setSavedCode(code)
    }
    setCodeSaving(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    // 1. 店舗の更新
    const { error: updateError } = await supabase
      .from('shops')
      .update({
        name: form.name,
        short_name: null,
        description: form.description || null,
        phone: form.phone.trim() || null,
        is_active: form.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (updateError) {
      setSaving(false)
      setError('保存に失敗しました: ' + updateError.message)
      return
    }

    // 2. クライアントオーナーアカウントの更新または新規作成
    if (ownerForm.name) {
      try {
        if (hasOwner) {
          // A. 既存オーナーの更新 (PUT API)
          const res = await fetch('/api/admin/users', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: ownerUserId,
              name: ownerForm.name.trim(),
              role: ownerForm.role,
              password: ownerForm.password || undefined, // 入力があった場合のみ送信
            }),
          })
          const data = await res.json()
          if (data.error) throw new Error(data.error)
        } else if (ownerForm.login_id && ownerForm.password) {
          // B. オーナーの新規作成 (POST API)
          const res = await fetch('/api/admin/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              loginId: ownerForm.login_id.trim().toLowerCase(),
              password: ownerForm.password,
              name: ownerForm.name.trim(),
              role: ownerForm.role,
              shopId: id,
            }),
          })
          const data = await res.json()
          if (data.error) throw new Error(data.error)
        }
        alert('店舗情報およびオーナーアカウントを更新しました！')
      } catch (err: any) {
        alert(`店舗情報は更新されましたが、オーナーアカウントの保存に失敗しました: ${err.message}`)
      }
    } else {
      alert('店舗情報を更新しました。')
    }

    setSaving(false)
    router.push('/admin')
  }

  if (loading) {
    return (
      <div className="h-full bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    )
  }

  return (
    <div className="bg-gray-100 p-4 md:p-4">
      <div className="max-w-xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <Link
            href="/admin"
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-200 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">店舗情報の編集</h1>
            <p className="text-sm text-slate-500 mt-0.5">店舗情報とクライアント用アカウントを更新します。</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:p-5">
          {error && (
            <div className="mb-5 p-3 bg-rose-50 border border-rose-100 rounded-xl text-sm text-rose-600">{error}</div>
          )}
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* 店舗基本設定 */}
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">🏢 店舗基本情報</h2>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">店舗名</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all text-slate-800 font-medium"
                  placeholder="例: 新宿本店"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">電話番号</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all text-slate-800 font-medium"
                  placeholder="例: 03-1234-5678"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">説明</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all text-slate-800 text-sm"
                  rows={2}
                  placeholder="店舗の詳細情報やメモ（任意）"
                />
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-3 cursor-pointer group w-fit">
                  <div className="relative flex items-center">
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                      className="peer sr-only"
                    />
                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600 transition-colors" />
                  </div>
                  <span className="text-xs font-bold text-slate-700 select-none group-hover:text-indigo-600 transition-colors">
                    {form.is_active ? '営業中（有効）' : '休業中（無効）'}
                  </span>
                </label>
              </div>
            </div>

            {/* クライアントオーナー設定 */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">
                🔑 クライアントオーナーアカウント設定
              </h2>
              <p className="text-xs text-slate-500">
                {hasOwner 
                  ? 'この店舗を所有するクライアントのアカウント情報を編集します。' 
                  : 'この店舗を所有するクライアント用のアカウントを新規作成します。'
                }
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">オーナーお名前（氏名）</label>
                  <input
                    type="text"
                    value={ownerForm.name}
                    onChange={(e) => setOwnerForm({ ...ownerForm, name: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all text-slate-800 font-medium"
                    placeholder="例: 田中 太郎"
                    required={ownerForm.login_id !== '' || ownerForm.password !== ''}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">契約プラン（権限）</label>
                  <select
                    value={ownerForm.role}
                    onChange={(e) => setOwnerForm({ ...ownerForm, role: e.target.value as any })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all text-slate-800 font-medium"
                  >
                    <option value="agency_client_owner">代行プラン (全機能)</option>
                    <option value="simple_client_owner">web予約プラン (一部機能)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">
                    ログインID
                    {hasOwner && <span className="ml-2 text-[10px] text-slate-400 font-normal">※ 変更できません</span>}
                  </label>
                  <input
                    type="text"
                    value={ownerForm.login_id}
                    onChange={(e) => setOwnerForm({ ...ownerForm, login_id: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') })}
                    disabled={hasOwner}
                    className={`w-full px-4 py-2.5 rounded-xl font-mono text-sm outline-none border transition-all ${
                      hasOwner 
                        ? 'bg-slate-100 border-slate-150 text-slate-500 cursor-not-allowed' 
                        : 'bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500/50'
                    }`}
                    placeholder="例: tanaka"
                    required={ownerForm.name !== '' || ownerForm.password !== ''}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">
                    {hasOwner ? '新パスワード (変更する場合のみ入力)' : '初期パスワード'}
                  </label>
                  <input
                    type="password"
                    value={ownerForm.password}
                    onChange={(e) => setOwnerForm({ ...ownerForm, password: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all text-slate-800"
                    placeholder={hasOwner ? '変更する場合のみ入力' : '8文字以上推奨'}
                    required={!hasOwner && (ownerForm.name !== '' || ownerForm.login_id !== '')}
                    autoComplete="new-password"
                  />
                </div>
              </div>
            </div>

            {/* 送信ボタン */}
            <div className="flex gap-3 pt-6 border-t border-slate-100 justify-end">
              <Link
                href="/admin"
                className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 font-medium rounded-xl hover:bg-slate-50 transition-colors"
              >
                キャンセル
              </Link>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-xl shadow-sm hover:bg-indigo-700 hover:shadow transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {saving ? '更新中...' : '更新する'}
              </button>
            </div>
          </form>
        </div>

        {/* Web予約URL設定 */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:p-5 mt-4">
          <h2 className="text-base font-bold text-slate-800 mb-1">Web予約URL設定</h2>
          <p className="text-xs text-slate-500 mb-4">お客様がアクセスするWeb予約ページのURLコードを設定します。</p>

          {codeError && (
            <div className="mb-3 p-3 bg-rose-50 border border-rose-100 rounded-xl text-sm text-rose-600">{codeError}</div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">URLコード</label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-400 whitespace-nowrap">/reserve/</span>
                <input
                  type="text"
                  value={reservationCode}
                  onChange={e => setReservationCode(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="shop-abc"
                  className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all text-slate-800 font-mono text-sm"
                />
              </div>
              <p className="text-xs text-slate-400 mt-1">半角英小文字・数字・ハイフンのみ</p>
            </div>

            <label className="flex items-center gap-3 cursor-pointer">
              <div className="relative flex items-center">
                <input
                  type="checkbox"
                  checked={codeActive}
                  onChange={e => setCodeActive(e.target.checked)}
                  className="peer sr-only"
                />
                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600 transition-colors" />
              </div>
              <span className="text-sm font-medium text-slate-700">{codeActive ? '予約受付中' : '予約停止中'}</span>
            </label>

            {savedCode && (
              <>
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3">
                  <p className="text-xs text-indigo-600 font-medium mb-1">現在の予約URL</p>
                  <p className="text-sm font-mono text-indigo-800 break-all">
                    {typeof window !== 'undefined' ? window.location.origin : ''}/reserve/{savedCode}
                  </p>
                </div>

                <EmbedCodeBlock code={savedCode} />
              </>
            )}

            <button
              type="button"
              onClick={handleSaveCode}
              disabled={codeSaving}
              className="px-5 py-2.5 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 text-sm"
            >
              {codeSaving ? '保存中...' : 'URLコードを保存'}
            </button>
          </div>
        </div>

        {/* 店舗連携設定 */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:p-5 mt-4">
          <h2 className="text-base font-bold text-slate-800 mb-1">🤝 店舗連携（相互リンク）設定</h2>
          <p className="text-xs text-slate-500 mb-4 font-normal leading-relaxed">
            この店舗と他店舗との相互連携を設定します。連携をオンにした店舗間でのみ、セラピストの共有や部屋の共有、スケジュールの自動同期、精算の合算が許可されます。
            未連携の店舗間ではお互いの情報が完全に遮断されます。
          </p>

          {linksError && (
            <div className="mb-3 p-3 bg-rose-50 border border-rose-100 rounded-xl text-sm text-rose-600 font-medium">{linksError}</div>
          )}

          {linksLoading ? (
            <div className="flex justify-center items-center py-6 text-indigo-600">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600" />
            </div>
          ) : otherShops.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6 font-medium">連携可能な他の店舗がありません。</p>
          ) : (
            <div className="space-y-3">
              {otherShops.map(shop => {
                const isLinked = links.some(l => 
                  (l.shop_id_1 === id && l.shop_id_2 === shop.id) || 
                  (l.shop_id_1 === shop.id && l.shop_id_2 === id)
                )
                return (
                  <div 
                    key={shop.id} 
                    className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                      isLinked ? 'border-indigo-150 bg-indigo-50/10' : 'border-slate-200 bg-white hover:bg-slate-50/40'
                    }`}
                  >
                    <div>
                      <span className="text-sm font-bold text-slate-800">{shop.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleLink(shop.id, isLinked)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all active:scale-95 whitespace-nowrap shadow-sm ${
                        isLinked ? 'bg-rose-500 hover:bg-rose-600 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                      }`}
                    >
                      {isLinked ? '連携を解除' : '連携する'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

