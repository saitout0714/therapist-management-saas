'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function EditCustomerPage() {
  const router = useRouter()
  const params = useParams()
  const customerId = params.id as string

  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    phone2: '',
    status: '予約可',
    ng_reason: '',
  })

  useEffect(() => {
    const fetchCustomerData = async () => {
      if (!customerId) return

      try {
        setInitializing(true)
        const { data: customer, error: fetchError } = await supabase
          .from('customers')
          .select('*')
          .eq('id', customerId)
          .single()

        if (fetchError) throw fetchError

        setForm({
          name: customer.name || '',
          email: customer.email || '',
          phone: customer.phone || '',
          phone2: customer.phone2 || '',
          status: customer.status || '予約可',
          ng_reason: customer.ng_reason || '',
        })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : '不明なエラー'
        setError('データの取得に失敗しました: ' + message)
      } finally {
        setInitializing(false)
      }
    }

    fetchCustomerData()
  }, [customerId])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (!form.name.trim()) {
      setError('名前は必須です')
      setLoading(false)
      return
    }

    try {
      const { error: updateError } = await supabase
        .from('customers')
        .update({
          name: form.name,
          email: form.email || null,
          phone: form.phone || null,
          phone2: form.phone2 || null,
          status: form.status,
          ng_reason: form.ng_reason || null,
        })
        .eq('id', customerId)

      if (updateError) throw updateError

      router.push('/customers')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '不明なエラー'
      console.error('顧客の更新に失敗:', err)
      setError('顧客情報の更新に失敗しました: ' + message)
      setLoading(false)
    }
  }

  if (initializing) {
    return (
      <div className="min-h-screen bg-gray-100 p-6 md:p-8 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6 md:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/customers" className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors shadow-sm border border-slate-200">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">顧客情報の編集</h1>
            <p className="text-sm text-slate-500 mt-1">お客様の基本情報を変更します。</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 md:p-8">
            {error && (
              <div className="mb-6 p-4 bg-rose-50 text-rose-600 rounded-xl text-sm font-medium flex items-start">
                <svg className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-6">
              <div className="space-y-5">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </span>
                  基本情報
                </h3>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center">
                    お名前 <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-600">必須</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all text-slate-800 placeholder-slate-400"
                    placeholder="山田 太郎"
                    required
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center">
                      電話番号① <span className="ml-2 text-xs text-slate-400 font-normal">任意</span>
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={form.phone}
                      onChange={handleChange}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all text-slate-800 placeholder-slate-400"
                      placeholder="090-1234-5678"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center">
                      電話番号② <span className="ml-2 text-xs text-slate-400 font-normal">任意</span>
                    </label>
                    <input
                      type="tel"
                      name="phone2"
                      value={form.phone2}
                      onChange={handleChange}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all text-slate-800 placeholder-slate-400"
                      placeholder="080-9876-5432"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center">
                      メールアドレス <span className="ml-2 text-xs text-slate-400 font-normal">任意</span>
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={form.email}
                      onChange={handleChange}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all text-slate-800 placeholder-slate-400"
                      placeholder="customer@example.com"
                    />
                  </div>
                </div>
              </div>

              {/* ステータス・NG */}
              <div className="space-y-5 pt-6 border-t border-slate-100">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider pb-2 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                  </span>
                  ステータス・NG設定
                </h3>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">ステータス</label>
                  <select
                    name="status"
                    value={form.status}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all text-slate-800"
                  >
                    <option value="予約可">予約可</option>
                    <option value="要注意">要注意</option>
                    <option value="出禁">出禁</option>
                  </select>
                </div>
                {(form.status === '要注意' || form.status === '出禁') && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      NG理由・注意事項 <span className="text-xs text-slate-400 font-normal">任意</span>
                    </label>
                    <textarea
                      name="ng_reason"
                      value={form.ng_reason}
                      onChange={handleChange}
                      rows={3}
                      placeholder="NG・注意の理由を記入してください"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all text-slate-800 placeholder-slate-400 resize-none"
                    />
                  </div>
                )}
              </div>

              <div className="pt-6 border-t border-slate-100 flex gap-3 justify-end mt-8">
                <Link
                  href="/customers"
                  className="px-6 py-3 bg-white border border-slate-200 text-slate-600 font-medium rounded-xl hover:bg-slate-50 transition-colors"
                >
                  キャンセル
                </Link>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-8 py-3 bg-indigo-600 text-white font-medium rounded-xl shadow-sm hover:bg-indigo-700 hover:shadow transition-all active:scale-95 disabled:opacity-70 disabled:pointer-events-none"
                >
                  {loading ? '更新中...' : '更新する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
