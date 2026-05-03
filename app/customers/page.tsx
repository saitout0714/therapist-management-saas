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
  phone2: string | null
  created_at: string
  status: string
  ng_reason: string | null
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

  // 統合モード
  const [mergeMode, setMergeMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [mergeModalOpen, setMergeModalOpen] = useState(false)
  const [masterId, setMasterId] = useState<string | null>(null)
  const [merging, setMerging] = useState(false)
  const [mergeError, setMergeError] = useState<string | null>(null)

  // 削除
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null)
  const [deleting, setDeleting] = useState(false)

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
        .select('id, name, email, phone, phone2, created_at, status, ng_reason')
        .eq('shop_id', selectedShop.id)
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw error
      const list = data || []
      setCustomers(list)
      await fetchVisitCounts(list.map((c) => c.id))
    } catch (err) {
      console.error('顧客の取得に失敗:', JSON.stringify(err))
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
        .select('id, name, email, phone, phone2, created_at, status, ng_reason')
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

  const toggleMergeMode = () => {
    setMergeMode((prev) => !prev)
    setSelectedIds(new Set())
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const openMergeModal = () => {
    const ids = Array.from(selectedIds)
    setMasterId(ids[0])
    setMergeError(null)
    setMergeModalOpen(true)
  }

  const closeMergeModal = () => {
    setMergeModalOpen(false)
    setMasterId(null)
    setMergeError(null)
  }

  const selectedCustomers = customers.filter((c) => selectedIds.has(c.id))
  const masterCustomer = customers.find((c) => c.id === masterId) || null

  // 統合後の phone2 を計算（マスターの phone と異なる電話番号を収集）
  const computePhone2 = (master: Customer, duplicates: Customer[]): string | null => {
    const existing = new Set([master.phone, master.phone2].filter(Boolean))
    for (const d of duplicates) {
      if (d.phone && !existing.has(d.phone)) return d.phone
    }
    return master.phone2 || null
  }

  const executeDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      // 予約を先に削除してから顧客を削除
      await supabase.from('reservations').delete().eq('customer_id', deleteTarget.id)
      const { error } = await supabase.from('customers').delete().eq('id', deleteTarget.id)
      if (error) throw error
      setDeleteTarget(null)
      await fetchRecentCustomers()
    } catch (err) {
      console.error('削除に失敗:', err)
      alert('削除に失敗しました。もう一度お試しください。')
    } finally {
      setDeleting(false)
    }
  }

  const executeMerge = async () => {
    if (!masterId || !masterCustomer) return
    setMerging(true)
    setMergeError(null)

    const duplicateIds = Array.from(selectedIds).filter((id) => id !== masterId)
    const duplicates = customers.filter((c) => duplicateIds.includes(c.id))
    const phone2 = computePhone2(masterCustomer, duplicates)

    try {
      // 重複顧客の予約をマスターに付け替え
      if (duplicateIds.length > 0) {
        const { error: resErr } = await supabase
          .from('reservations')
          .update({ customer_id: masterId })
          .in('customer_id', duplicateIds)
        if (resErr) throw resErr
      }

      // マスターの phone2 を更新
      const { error: updateErr } = await supabase
        .from('customers')
        .update({ phone2: phone2 })
        .eq('id', masterId)
      if (updateErr) throw updateErr

      // 重複顧客を削除
      const { error: deleteErr } = await supabase
        .from('customers')
        .delete()
        .in('id', duplicateIds)
      if (deleteErr) throw deleteErr

      closeMergeModal()
      setMergeMode(false)
      setSelectedIds(new Set())
      await fetchRecentCustomers()
    } catch (err) {
      console.error('統合に失敗:', err)
      setMergeError('統合に失敗しました。もう一度お試しください。')
    } finally {
      setMerging(false)
    }
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
          <div className="flex items-center gap-3">
            {mergeMode && selectedIds.size >= 2 && (
              <button
                onClick={openMergeModal}
                className="px-5 py-2.5 bg-amber-500 text-white font-medium rounded-xl shadow-sm hover:bg-amber-600 transition-all active:scale-95 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                統合する（{selectedIds.size}件）
              </button>
            )}
            <button
              onClick={toggleMergeMode}
              className={`px-5 py-2.5 font-medium rounded-xl shadow-sm transition-all active:scale-95 flex items-center gap-2 ${
                mergeMode
                  ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              {mergeMode ? '統合モードを終了' : '重複統合'}
            </button>
            <Link
              href="/customers/new"
              className="px-5 py-2.5 bg-indigo-600 text-white font-medium rounded-xl shadow-sm hover:bg-indigo-700 hover:shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <span className="text-lg leading-none">+</span>
              <span>新規顧客登録</span>
            </Link>
          </div>
        </div>

        {mergeMode && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700 flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            統合したい顧客を2件以上チェックして「統合する」ボタンを押してください。
            {selectedIds.size > 0 && <span className="font-bold ml-1">{selectedIds.size}件選択中</span>}
          </div>
        )}

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
                  {mergeMode && <th className="px-4 py-4 w-10"></th>}
                  <th className="px-6 py-4 whitespace-nowrap">指名</th>
                  <th className="px-6 py-4 whitespace-nowrap">電話番号</th>
                  <th className="px-6 py-4 whitespace-nowrap">メールアドレス</th>
                  <th className="px-6 py-4 whitespace-nowrap text-center">来店履歴</th>
                  <th className="px-6 py-4 whitespace-nowrap">ステータス</th>
                  <th className="px-4 py-4 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customers.length === 0 ? (
                  <tr>
                    <td colSpan={mergeMode ? 7 : 6} className="px-6 py-12 text-center">
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
                    const status = customer.status || '予約可'
                    const isSelected = selectedIds.has(customer.id)
                    return (
                      <tr
                        key={customer.id}
                        className={`hover:bg-slate-50/50 transition-colors group ${isSelected ? 'bg-amber-50/60' : ''}`}
                        onClick={mergeMode ? () => toggleSelect(customer.id) : undefined}
                        style={mergeMode ? { cursor: 'pointer' } : undefined}
                      >
                        {mergeMode && (
                          <td className="px-4 py-4">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelect(customer.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-4 h-4 rounded border-slate-300 text-amber-500 focus:ring-amber-400"
                            />
                          </td>
                        )}
                        <td className="px-6 py-4">
                          {mergeMode ? (
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg transition-colors ${isSelected ? 'bg-amber-100 text-amber-600' : 'bg-indigo-50 text-indigo-600'}`}>
                                {customer.name.charAt(0)}
                              </div>
                              <span className="font-bold text-slate-800">{customer.name}</span>
                            </div>
                          ) : (
                            <Link href={`/customers/${customer.id}`} className="flex items-center gap-3 group/link">
                              <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-lg group-hover/link:bg-indigo-100 transition-colors">
                                {customer.name.charAt(0)}
                              </div>
                              <span className="font-bold text-slate-800 group-hover/link:text-indigo-600 transition-colors">{customer.name}</span>
                            </Link>
                          )}
                        </td>
                        <td className="px-6 py-4 text-slate-600 font-medium">
                          <div className="flex flex-col gap-0.5">
                            <span>{customer.phone || <span className="text-slate-400 font-normal italic">未登録</span>}</span>
                            {customer.phone2 && (
                              <span className="text-xs text-slate-400">{customer.phone2}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-600">
                          {customer.email || <span className="text-slate-400 italic">未登録</span>}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={(e) => { e.stopPropagation(); openHistoryModal(customer) }}
                            className="inline-flex items-center justify-center px-3 py-1 bg-slate-100 text-slate-600 font-medium rounded-lg hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                          >
                            <span className="mr-1 text-lg leading-none">{visitCounts.get(customer.id) ?? '…'}</span> 回
                          </button>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 text-xs font-bold rounded-full ${statusStyles[status] || 'bg-slate-100 text-slate-800'}`}>
                            {status}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          {!mergeMode && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setDeleteTarget(customer) }}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg"
                              title="削除"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
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
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={closeHistoryModal}></div>
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
                <button onClick={closeHistoryModal} className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors">
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
                            <td colSpan={5} className="px-6 py-12 text-center text-slate-500">来店履歴がありません</td>
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
                )}
              </div>
            </div>
          </div>
        )}

        {/* 削除確認モーダル */}
        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => !deleting && setDeleteTarget(null)}></div>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md relative z-10 overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-800">顧客を削除する</h2>
                <button
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleting}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors disabled:opacity-50"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center font-bold text-xl flex-shrink-0">
                    {deleteTarget.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 text-lg">{deleteTarget.name}</p>
                    <p className="text-sm text-slate-500">{deleteTarget.phone || '電話番号未登録'}</p>
                  </div>
                </div>

                {(visitCounts.get(deleteTarget.id) ?? 0) > 0 ? (
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start gap-3">
                    <svg className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm text-rose-700">
                      この顧客には <span className="font-bold">{visitCounts.get(deleteTarget.id)}件</span> の来店履歴があります。
                      削除すると来店履歴もすべて削除されます。この操作は元に戻せません。
                    </p>
                  </div>
                ) : (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-start gap-3">
                    <svg className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm text-slate-600">この顧客を削除します。この操作は元に戻せません。</p>
                  </div>
                )}
              </div>

              <div className="px-6 pb-6 flex gap-3 justify-end">
                <button
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleting}
                  className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 font-medium rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  キャンセル
                </button>
                <button
                  onClick={executeDelete}
                  disabled={deleting}
                  className="px-5 py-2.5 bg-rose-500 text-white font-medium rounded-xl hover:bg-rose-600 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
                >
                  {deleting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      削除中...
                    </>
                  ) : '削除する'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 統合モーダル */}
        {mergeModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={closeMergeModal}></div>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg relative z-10 overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-800">顧客を統合する</h2>
                <button onClick={closeMergeModal} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="p-6 space-y-5">
                <div>
                  <p className="text-sm font-medium text-slate-600 mb-3">残す顧客（マスター）を選択してください</p>
                  <div className="space-y-2">
                    {selectedCustomers.map((c) => (
                      <label
                        key={c.id}
                        className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                          masterId === c.id ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="master"
                          value={c.id}
                          checked={masterId === c.id}
                          onChange={() => setMasterId(c.id)}
                          className="text-indigo-600 focus:ring-indigo-500"
                        />
                        <div className="w-9 h-9 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                          {c.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-800 text-sm">{c.name}</p>
                          <p className="text-xs text-slate-400 truncate">
                            {[c.phone, c.phone2].filter(Boolean).join(' / ') || '電話番号未登録'}
                          </p>
                        </div>
                        <span className="text-xs text-slate-400 whitespace-nowrap">
                          {visitCounts.get(c.id) ?? 0}回
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {masterCustomer && (() => {
                  const duplicates = selectedCustomers.filter((c) => c.id !== masterId)
                  const phone2 = computePhone2(masterCustomer, duplicates)
                  return (
                    <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">統合後のプレビュー</p>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">名前</span>
                        <span className="font-medium text-slate-800">{masterCustomer.name}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">電話番号①</span>
                        <span className="font-medium text-slate-800">{masterCustomer.phone || '—'}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">電話番号②</span>
                        <span className={`font-medium ${phone2 && phone2 !== masterCustomer.phone2 ? 'text-emerald-600' : 'text-slate-800'}`}>
                          {phone2 || '—'}
                          {phone2 && phone2 !== masterCustomer.phone2 && <span className="ml-1 text-xs text-emerald-500">（追加）</span>}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">メール</span>
                        <span className="font-medium text-slate-800">{masterCustomer.email || '—'}</span>
                      </div>
                      <div className="flex justify-between text-sm pt-1 border-t border-slate-200">
                        <span className="text-slate-500">予約履歴</span>
                        <span className="font-medium text-slate-800">
                          {selectedCustomers.reduce((sum, c) => sum + (visitCounts.get(c.id) ?? 0), 0)}回に統合
                        </span>
                      </div>
                    </div>
                  )
                })()}

                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-start gap-2">
                  <svg className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-xs text-rose-600">
                    マスター以外の顧客データは削除されます。この操作は元に戻せません。
                  </p>
                </div>

                {mergeError && (
                  <p className="text-sm text-rose-600 bg-rose-50 rounded-lg p-3">{mergeError}</p>
                )}
              </div>

              <div className="px-6 pb-6 flex gap-3 justify-end">
                <button
                  onClick={closeMergeModal}
                  disabled={merging}
                  className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 font-medium rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  キャンセル
                </button>
                <button
                  onClick={executeMerge}
                  disabled={merging || !masterId}
                  className="px-5 py-2.5 bg-amber-500 text-white font-medium rounded-xl hover:bg-amber-600 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2"
                >
                  {merging ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      統合中...
                    </>
                  ) : '統合する'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
