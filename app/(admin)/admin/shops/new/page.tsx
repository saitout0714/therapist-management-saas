'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useAuth } from '@/app/contexts/AuthContext'

export default function NewShopPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '',
    description: '',
    phone: '',
    is_active: true,
    is_dispatch_enabled: false,
    // クライアントオーナー設定
    owner_name: '',
    owner_login_id: '',
    owner_password: '',
    owner_plan: 'agency_client_owner' as 'agency_client_owner' | 'simple_client_owner',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    // 1. 店舗の登録と ID の取得
    const { data: newShops, error: insertError } = await supabase
      .from('shops')
      .insert([{
        name: form.name,
        short_name: null,
        description: form.description || null,
        phone: form.phone.trim() || null,
        is_active: form.is_active,
        is_dispatch_enabled: form.is_dispatch_enabled,
      }])
      .select('id')

    if (insertError) {
      setSaving(false)
      setError('店舗の登録に失敗しました: ' + insertError.message)
      return
    }

    const shopId = newShops?.[0]?.id

    // 2. オーナーアカウント情報の入力がある場合は、自動でアカウント作成 API を呼ぶ
    if (shopId && form.owner_login_id && form.owner_password && form.owner_name) {
      try {
        const res = await fetch('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            loginId: form.owner_login_id.trim().toLowerCase(),
            password: form.owner_password,
            name: form.owner_name.trim(),
            role: form.owner_plan,
            shopId: shopId,
          }),
        })

        const data = await res.json()
        if (data.error) {
          alert(`店舗は正常に登録されましたが、オーナーアカウントの作成に失敗しました:\n${data.error}\n\n後ほど「アカウント管理」等から手動でアカウントを登録してください。`)
        } else {
          alert('店舗およびクライアントオーナーアカウントを正常に作成しました！')
        }
      } catch (err: any) {
        alert(`店舗は登録されましたが、オーナーアカウントの作成中にエラーが発生しました: ${err.message}`)
      }
    } else {
      alert('店舗を登録しました。')
    }

    setSaving(false)
    router.push('/admin')
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
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">新しい店舗を登録</h1>
            <p className="text-sm text-slate-500 mt-0.5">店舗情報とクライアント用アカウントを設定します。</p>
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

              <div className="pt-3 border-t border-slate-100">
                <label className="flex items-center gap-3 cursor-pointer group w-fit">
                  <div className="relative flex items-center">
                    <input
                      type="checkbox"
                      checked={form.is_dispatch_enabled}
                      onChange={(e) => setForm({ ...form, is_dispatch_enabled: e.target.checked })}
                      className="peer sr-only"
                    />
                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600 transition-colors" />
                  </div>
                  <span className="text-xs font-bold text-slate-700 select-none group-hover:text-indigo-600 transition-colors">
                    派遣（デリバリー）機能を有効にする
                  </span>
                </label>
              </div>
            </div>

            {/* クライアントオーナー設定 */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center gap-2">
                <span>🔑 クライアントオーナーアカウント設定</span>
              </h2>
              <p className="text-xs text-slate-500">この店舗を管理・所有するクライアント用のログインアカウントを作成します。</p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">オーナーお名前（氏名）</label>
                  <input
                    type="text"
                    value={form.owner_name}
                    onChange={(e) => setForm({ ...form, owner_name: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all text-slate-800 font-medium"
                    placeholder="例: 田中 太郎"
                    required={form.owner_login_id !== '' || form.owner_password !== ''}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">契約プラン（権限）</label>
                  <select
                    value={form.owner_plan}
                    onChange={(e) => setForm({ ...form, owner_plan: e.target.value as any })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all text-slate-800 font-medium"
                  >
                    <option value="agency_client_owner">代行プラン (全機能)</option>
                    {user?.role === 'developer' && <option value="simple_client_owner">web予約プラン (一部機能)</option>}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">ログインID</label>
                  <input
                    type="text"
                    value={form.owner_login_id}
                    onChange={(e) => setForm({ ...form, owner_login_id: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all text-slate-800 font-mono"
                    placeholder="例: tanaka"
                    required={form.owner_name !== '' || form.owner_password !== ''}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">初期パスワード</label>
                  <input
                    type="password"
                    value={form.owner_password}
                    onChange={(e) => setForm({ ...form, owner_password: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all text-slate-800"
                    placeholder="8文字以上推奨"
                    required={form.owner_name !== '' || form.owner_login_id !== ''}
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
                {saving ? '登録中...' : '登録する'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
