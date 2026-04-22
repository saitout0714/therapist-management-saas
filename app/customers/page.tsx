'use client'

import { useEffect, useCallback, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useShop } from '@/app/contexts/ShopContext'
import Link from 'next/link'

type Customer = {
  id: string
  name: string
  email: string | null
  phone: string | null
  created_at: string
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

const statusStyles: Record<string, string> = {
  予約可: 'bg-green-100 text-green-800',
  要注意: 'bg-yellow-100 text-yellow-800',
  出禁: 'bg-red-100 text-red-800',
}

export default function CustomersPage() {
  const { selectedShop } = useShop()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [visitCounts, setVisitCounts] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [historyModalOpen, setHistoryModalOpen] = useState(false)
  const [historyTarget, setHistoryTarget] = useState<Customer | null>(null)
  const [selectedHistory, setSelectedHistory] = useState<Reservation[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchVisitCounts = useCallback(async (customerIds: string[]) => {
    if (!selectedShop || customerIds.length === 0) return
    const { data } = await supabase
      .from('reservations')
      .select('customer_id')
      .in('customer_id', customerIds)
      .eq('shop_id', selectedShop.id)
    const map = new Map<string, number>()
    ;(data || []).forEach((r: { customer_id: string }) => {
      map.set(r.customer_id, (map.get(r.customer_id) || 0) + 1)
    })
    setVisitCounts(map)
  }, [selectedShop])

  const fetchRecentCustomers = useCallback(async () => {
    if (!selectedShop) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, email, phone, created_at')
        .eq('shop_id', selectedShop.id)
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw error
      const list = data || []
      setCustomers(list)
      await fetchVisitCounts(list.map((c) => c.id))
    } catch (err) {
      console.error('顧客の取得に失敗:', err)
    } finally {
      setLoading(false)
    }
  }, [selectedShop, fetchVisitCounts])

  const searchCustomers = useCallback(async (query: string) => {
    if (!selectedShop) return
    setSearching(true)
    try {
      const normalized = query.replace(/-/g, '')
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, email, phone, created_at')
        .eq('shop_id', selectedShop.id)
        .or(`name.ilike.%${query}%,phone.ilike.%${normalized}%,email.ilike.%${query}%`)
        .order('name')
        .limit(200)
      if (error) throw error
      const list = data || []
      setCustomers(list)
      await fetchVisitCounts(list.map((c) => c.id))
    } catch (err) {
      console.error('顧客検索に失敗:', err)
    } finally {
      setSearching(false)
    }
  }, [selectedShop, fetchVisitCounts])

  useEffect(() => {
    setSearchQuery('')
    fetchRecentCustomers()
  }, [selectedShop])

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    const q = searchQuery.trim()
    if (!q) {
      fetchRecentCustomers()
      return
    }
    debounceTimer.current = setTimeout(() => {
      searchCustomers(q)
    }, 300)
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [searchQuery])

  const openHistoryModal = async (customer: Customer) => {
    setHistoryTarget(customer)
    setHistoryModalOpen(true)
    setHistoryLoading(true)
    const { data } = await supabase
      .from('reservations')
      .select(`id, customer_id, date, start_time, end_time, status, therapist:therapists!reservations_therapist_id_fkey(name), course:courses(name)`)
      .eq('customer_id', customer.id)
      .order('date', { ascending: false })
      .order('start_time', { ascending: false })
    setSelectedHistory((data as unknown as Reservation[]) || [])
    setHistoryLoading(false)
  }

  const closeHistoryModal = () => {
    setHistoryModalOpen(false)
    setHistoryTarget(null)
    setSelectedHistory([])
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20 text-indigo-600">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        <span className="ml-3 font-medium">読み込み中...</span>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6 md:p-8">
      <div className="mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">顧客管理</h1>
            <p className="text-sm text-slate-500 mt-1">店舗を利用されるお客様の情報や来店履歴を管理します。</p>
          </div>
          <Link
            href="/customers/new"
            className="px-5 py-2.5 bg-indigo-600 text-white font-medium rounded-xl shadow-sm hover:bg-indigo-700 hover:shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <span className="text-lg leading-none">+</span>
            <span>新規顧客登録</span>
          </Link>
        </div>

        <div className="mb-4">
          <div className="relative max-w-sm">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="名前・電話番号・メールで検索"
              className="w-full pl-9 pr-9 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
            />
            {searching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin"></div>
              </div>
            )}
            {searchQuery && !searching && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          {!searchQuery && (
            <p className="text-xs text-slate-400 mt-1 ml-1">最新100件を表示中。名前・電話番号で検索すると全件から探せます。</p>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100 text-sm font-medium text-slate-600">
                  <th className="px-6 py-4 whitespace-nowrap">指名</th>
                  <th className="px-6 py-4 whitespace-nowrap">電話番号</th>
                  <th className="px-6 py-4 whitespace-nowrap">メールアドレス</th>
                  <th className="px-6 py-4 whitespace-nowrap text-center">来店履歴</th>
                  <th className="px-6 py-4 whitespace-nowrap">ステータス</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                      </div>
                      {searchQuery ? (
                        <>
                          <h3 className="text-lg font-medium text-slate-800 mb-2">該当する顧客が見つかりません</h3>
                          <p className="text-slate-500">検索条件を変えてお試しください。</p>
                        </>
                      ) : (
                        <>
                          <h3 className="text-lg font-medium text-slate-800 mb-2">顧客データがありません</h3>
                          <p className="text-slate-500">右上の「新規顧客登録」ボタンから顧客を追加してください。</p>
                        </>
                      )}
                    </td>
                  </tr>
                ) : (
                  customers.map((customer) => {
                    const status = '予約可'
                    return (
                      <tr key={customer.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-4">
                          <Link href={`/customers/${customer.id}`} className="flex items-center gap-3 group/link">
                            <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-lg group-hover/link:bg-indigo-100 transition-colors">
                              {customer.name.charAt(0)}
                            </div>
                            <span className="font-bold text-slate-800 group-hover/link:text-indigo-600 transition-colors">{customer.name}</span>
                          </Link>
                        </td>
                        <td className="px-6 py-4 text-slate-600 font-medium">
                          {customer.phone || <span className="text-slate-400 font-normal italic">未登録</span>}
                        </td>
                        <td className="px-6 py-4 text-slate-600">
                          {customer.email || <span className="text-slate-400 italic">未登録</span>}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => openHistoryModal(customer)}
                            className="inline-flex items-center justify-center px-3 py-1 bg-slate-100 text-slate-600 font-medium rounded-lg hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                          >
                            <span className="mr-1 text-lg leading-none">{visitCounts.get(customer.id) ?? '…'}</span> 回
                          </button>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-3 py-1 text-xs font-bold rounded-full ${statusStyles[status] || 'bg-slate-100 text-slate-800'}`}
                          >
                            {status}
                          </span>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 来店履歴モーダル */}
        {historyModalOpen && historyTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
              onClick={closeHistoryModal}
            ></div>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl relative z-10 overflow-hidden transform transition-all flex flex-col max-h-[85vh]">
              <div className="p-6 md:px-8 md:pt-8 md:pb-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur z-20">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xl">
                    {historyTarget.name.charAt(0)}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-800">{historyTarget.name} 様の来店履歴</h2>
                    <p className="text-sm text-slate-500 mt-1">合計来店回数: <span className="font-bold text-indigo-600">{selectedHistory.length}</span>回</p>
                  </div>
                </div>
                <button
                  onClick={closeHistoryModal}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="p-6 md:p-8 overflow-y-auto bg-slate-50/50">
                {historyLoading ? (
                  <div className="flex justify-center py-12">
                    <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
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
                        {selectedHistory.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                              来店履歴がありません
                            </td>
                          </tr>
                        ) : (
                          selectedHistory.map((r) => (
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
                                <span className={`px-2.5 py-1 font-bold rounded-lg ${r.status === '来店済み' ? 'bg-emerald-50 text-emerald-600' :
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
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
