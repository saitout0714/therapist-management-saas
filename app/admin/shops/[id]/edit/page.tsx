'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function EditShopPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '',
    short_name: '',
    description: '',
    is_active: true,
  })

  useEffect(() => {
    const fetchShop = async () => {
      const { data, error: fetchError } = await supabase
        .from('shops')
        .select('*')
        .eq('id', id)
        .single()

      if (fetchError || !data) {
        setError('店舗情報の取得に失敗しました')
        setLoading(false)
        return
      }

      setForm({
        name: data.name,
        short_name: data.short_name || '',
        description: data.description || '',
        is_active: data.is_active,
      })
      setLoading(false)
    }

    void fetchShop()
  }, [id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    const { error: updateError } = await supabase
      .from('shops')
      .update({
        name: form.name,
        short_name: form.short_name.trim() || null,
        description: form.description || null,
        is_active: form.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    setSaving(false)
    if (updateError) {
      setError('保存に失敗しました: ' + updateError.message)
      return
    }
    router.push('/admin')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6 md:p-8">
      <div className="max-w-xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
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
            <p className="text-sm text-slate-500 mt-0.5">変更内容を入力して更新してください。</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 md:p-8">
          {error && (
            <div className="mb-5 p-3 bg-rose-50 border border-rose-100 rounded-xl text-sm text-rose-600">{error}</div>
          )}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">店舗名</label>
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
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  略称
                  <span className="ml-1.5 text-xs text-slate-400 font-normal">タブに表示される短い名前（任意）</span>
                </label>
                <input
                  type="text"
                  value={form.short_name}
                  onChange={(e) => setForm({ ...form, short_name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all text-slate-800 font-medium"
                  placeholder="例: 新宿"
                  maxLength={10}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">説明</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all text-slate-800"
                rows={3}
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
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600 transition-colors" />
                </div>
                <span className="text-sm font-bold text-slate-700 select-none group-hover:text-indigo-600 transition-colors">
                  {form.is_active ? '営業中（有効）' : '休業中（無効）'}
                </span>
              </label>
            </div>

            <div className="flex gap-3 pt-4 border-t border-slate-100 justify-end">
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
      </div>
    </div>
  )
}
