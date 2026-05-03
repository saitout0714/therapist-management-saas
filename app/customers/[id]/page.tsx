'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

type Customer = {
  id: string
  name: string
  email: string | null
  phone: string | null
  phone2: string | null
  created_at: string
  status: string
  ng_reason: string | null
  shop_id: string
}

type Reservation = {
  id: string
  customer_id: string
  date: string
  start_time: string
  end_time: string
  status: string
  therapist: { name: string } | null
  course: { name: string } | null
}

type NgPair = {
  id: string
  therapist_id: string
  reason: string | null
  therapist: { name: string } | null
}

type TherapistOption = {
  id: string
  name: string
}

const customerStatusStyles: Record<string, string> = {
  予約可: 'bg-green-100 text-green-700',
  要注意: 'bg-yellow-100 text-yellow-700',
  出禁: 'bg-red-100 text-red-700',
}

export default function CustomerDetailPage() {
  const params = useParams()
  const customerId = params.id as string

  const [customer, setCustomer] = useState<Customer | null>(null)
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [ngPairs, setNgPairs] = useState<NgPair[]>([])
  const [therapistOptions, setTherapistOptions] = useState<TherapistOption[]>([])
  const [ngAddTherapistId, setNgAddTherapistId] = useState('')
  const [ngAddReason, setNgAddReason] = useState('')
  const [ngAdding, setNgAdding] = useState(false)
  const [ngRemoving, setNgRemoving] = useState<string | null>(null)

  useEffect(() => {
    const fetchCustomerData = async () => {
      if (!customerId) return

      try {
        setLoading(true)

        const { data: customerData, error: customerError } = await supabase
          .from('customers')
          .select('*')
          .eq('id', customerId)
          .single()

        if (customerError) throw customerError

        const [reservationsRes, ngRes, therapistsRes] = await Promise.all([
          supabase
            .from('reservations')
            .select(`id, customer_id, date, start_time, end_time, status, therapist:therapists!reservations_therapist_id_fkey(name), course:courses(name)`)
            .eq('customer_id', customerId)
            .order('date', { ascending: false })
            .order('start_time', { ascending: false }),
          supabase
            .from('customer_therapist_ng')
            .select('id, therapist_id, reason, therapist:therapists(name)')
            .eq('customer_id', customerId),
          supabase
            .from('therapists')
            .select('id, name')
            .eq('shop_id', customerData.shop_id)
            .eq('is_active', true)
            .order('name'),
        ])

        setCustomer(customerData)
        setReservations((reservationsRes.data as unknown as Reservation[]) || [])
        setNgPairs((ngRes.data as unknown as NgPair[]) || [])
        setTherapistOptions(therapistsRes.data || [])
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : '不明なエラー'
        console.error('データの取得に失敗:', err)
        setError('データの取得に失敗しました: ' + message)
      } finally {
        setLoading(false)
      }
    }

    fetchCustomerData()
  }, [customerId])

  const addNgPair = async () => {
    if (!ngAddTherapistId || !customer) return
    setNgAdding(true)
    try {
      const { data, error } = await supabase
        .from('customer_therapist_ng')
        .insert([{
          shop_id: customer.shop_id,
          customer_id: customer.id,
          therapist_id: ngAddTherapistId,
          reason: ngAddReason || null,
        }])
        .select('id, therapist_id, reason, therapist:therapists(name)')
        .single()
      if (error) throw error
      setNgPairs(prev => [...prev, data as unknown as NgPair])
      setNgAddTherapistId('')
      setNgAddReason('')
    } catch {
      alert('NGセラピストの追加に失敗しました')
    } finally {
      setNgAdding(false)
    }
  }

  const removeNgPair = async (pairId: string) => {
    setNgRemoving(pairId)
    try {
      const { error } = await supabase.from('customer_therapist_ng').delete().eq('id', pairId)
      if (error) throw error
      setNgPairs(prev => prev.filter(p => p.id !== pairId))
    } catch {
      alert('NGの解除に失敗しました')
    } finally {
      setNgRemoving(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 p-6 md:p-8 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    )
  }

  if (error || !customer) {
    return (
      <div className="min-h-screen bg-gray-100 p-6 md:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="p-4 bg-rose-50 text-rose-600 rounded-xl text-sm font-medium flex items-center mb-6">
            <svg className="w-5 h-5 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error || '顧客が見つかりませんでした。'}
          </div>
          <Link
            href="/customers"
            className="inline-flex px-5 py-2.5 bg-white border border-slate-200 text-slate-600 font-medium rounded-xl hover:bg-slate-50 transition-colors"
          >
            顧客一覧に戻る
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* ヘッダー部分 */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/customers" className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors shadow-sm border border-slate-200">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <div className="flex-1 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-800 tracking-tight">{customer.name} 様の詳細</h1>
              <p className="text-sm text-slate-500 mt-1">顧客の基本情報と来店履歴を確認できます。</p>
            </div>
            <Link
              href={`/customers/${customer.id}/edit`}
              className="px-4 py-2 bg-indigo-50 text-indigo-600 font-medium rounded-lg hover:bg-indigo-100 transition-colors text-sm"
            >
              情報を編集する
            </Link>
          </div>
        </div>

        {/* ステータス警告バナー */}
        {(customer.status === '要注意' || customer.status === '出禁') && (
          <div className={`mb-6 p-4 rounded-2xl flex items-start gap-3 ${customer.status === '出禁' ? 'bg-red-50 border border-red-200' : 'bg-yellow-50 border border-yellow-200'}`}>
            <svg className={`w-5 h-5 flex-shrink-0 mt-0.5 ${customer.status === '出禁' ? 'text-red-500' : 'text-yellow-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className={`font-bold text-sm ${customer.status === '出禁' ? 'text-red-700' : 'text-yellow-700'}`}>
                このお客様は「{customer.status}」です
              </p>
              {customer.ng_reason && (
                <p className={`text-sm mt-1 ${customer.status === '出禁' ? 'text-red-600' : 'text-yellow-600'}`}>{customer.ng_reason}</p>
              )}
            </div>
          </div>
        )}

        {/* 顧客基本情報 */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 md:p-8 mb-8 flex flex-col sm:flex-row gap-6 items-start">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center font-bold text-2xl flex-shrink-0 ${customer.status === '出禁' ? 'bg-red-50 text-red-500' : customer.status === '要注意' ? 'bg-yellow-50 text-yellow-600' : 'bg-indigo-50 text-indigo-600'}`}>
            {customer.name.charAt(0)}
          </div>
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8">
            <div>
              <p className="text-sm text-slate-500 font-medium mb-1">お名前</p>
              <div className="flex items-center gap-2">
                <p className="text-lg font-bold text-slate-800">{customer.name}</p>
                <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full ${customerStatusStyles[customer.status] || 'bg-slate-100 text-slate-600'}`}>
                  {customer.status || '予約可'}
                </span>
              </div>
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium mb-1">来店回数</p>
              <p className="text-lg font-bold text-indigo-600">{reservations.length} 回</p>
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium mb-1">電話番号①</p>
              <p className="text-slate-800 font-medium">{customer.phone || <span className="text-slate-400 font-normal italic">未登録</span>}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium mb-1">メールアドレス</p>
              <p className="text-slate-800 font-medium">{customer.email || <span className="text-slate-400 font-normal italic">未登録</span>}</p>
            </div>
            {customer.phone2 && (
              <div>
                <p className="text-sm text-slate-500 font-medium mb-1">電話番号②</p>
                <p className="text-slate-800 font-medium">{customer.phone2}</p>
              </div>
            )}
          </div>
        </div>

        {/* NGセラピスト管理 */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-8">
          <div className="p-6 md:px-8 md:pt-8 md:pb-6 border-b border-slate-100">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </span>
              NGセラピスト
            </h2>
            <p className="text-sm text-slate-500 mt-1">このお客様に対してNGのセラピストを管理します。</p>
          </div>

          <div className="p-6 md:p-8 space-y-4">
            {/* 既存NGリスト */}
            {ngPairs.length === 0 ? (
              <p className="text-sm text-slate-400 italic">NGセラピストは登録されていません</p>
            ) : (
              <div className="space-y-2">
                {ngPairs.map(pair => (
                  <div key={pair.id} className="flex items-center justify-between p-3 bg-rose-50 border border-rose-100 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center text-sm font-bold">
                        {pair.therapist?.name?.charAt(0) ?? '?'}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800">{pair.therapist?.name ?? '不明'}</p>
                        {pair.reason && <p className="text-xs text-slate-500 mt-0.5">{pair.reason}</p>}
                      </div>
                    </div>
                    <button
                      onClick={() => removeNgPair(pair.id)}
                      disabled={ngRemoving === pair.id}
                      className="text-xs px-3 py-1.5 text-rose-600 bg-white border border-rose-200 rounded-lg hover:bg-rose-50 disabled:opacity-50 transition-colors"
                    >
                      {ngRemoving === pair.id ? '解除中...' : 'NG解除'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* NGセラピスト追加フォーム */}
            <div className="pt-4 border-t border-slate-100">
              <p className="text-sm font-semibold text-slate-600 mb-3">NGセラピストを追加</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  value={ngAddTherapistId}
                  onChange={(e) => setNgAddTherapistId(e.target.value)}
                  className="flex-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-rose-400/50"
                >
                  <option value="">セラピストを選択</option>
                  {therapistOptions
                    .filter(t => !ngPairs.some(p => p.therapist_id === t.id))
                    .map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                </select>
                <input
                  type="text"
                  value={ngAddReason}
                  onChange={(e) => setNgAddReason(e.target.value)}
                  placeholder="理由（任意）"
                  className="flex-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-rose-400/50"
                />
                <button
                  onClick={addNgPair}
                  disabled={!ngAddTherapistId || ngAdding}
                  className="px-4 py-2.5 bg-rose-500 text-white text-sm font-bold rounded-xl hover:bg-rose-600 disabled:opacity-40 disabled:pointer-events-none transition-colors whitespace-nowrap"
                >
                  {ngAdding ? '追加中...' : '追加'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 来店履歴 */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 md:px-8 md:pt-8 md:pb-6 border-b border-slate-100 bg-white/95 backdrop-blur z-20">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
              来店履歴
            </h2>
          </div>

          <div className="overflow-x-auto bg-slate-50/50 p-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden p-0">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <th className="px-6 py-4">日付</th>
                    <th className="px-6 py-4">時間</th>
                    <th className="px-6 py-4">コース</th>
                    <th className="px-6 py-4">担当</th>
                    <th className="px-6 py-4">状態</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reservations.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                        来店履歴がありません
                      </td>
                    </tr>
                  ) : (
                    reservations.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-800">{r.date.replace(/-/g, '/')}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-medium">
                          {r.start_time.substring(0, 5)} - {r.end_time.substring(0, 5)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                          {r.course?.name ? (
                            <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg font-medium">{r.course?.name}</span>
                          ) : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {r.therapist?.name ? (
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">
                                {r.therapist.name.charAt(0)}
                              </div>
                              <span className="font-medium text-slate-700">{r.therapist.name}</span>
                            </div>
                          ) : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`px-2.5 py-1 font-bold rounded-lg ${
                            r.status === '来店済み' ? 'bg-emerald-50 text-emerald-600' :
                            r.status === 'キャンセル' ? 'bg-rose-50 text-rose-600' :
                            r.status === '予約確定' ? 'bg-sky-50 text-sky-600' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
