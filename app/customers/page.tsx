'use client'

import { useEffect, useMemo, useState } from 'react'
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
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Customer | null>(null)
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    phone: '',
  })
  const [historyModalOpen, setHistoryModalOpen] = useState(false)
  const [historyTarget, setHistoryTarget] = useState<Customer | null>(null)

  useEffect(() => {
    fetchCustomers()
  }, [selectedShop])

  const fetchCustomers = async () => {
    if (!selectedShop) return
    try {
      const [customersRes, reservationsRes] = await Promise.all([
        supabase
          .from('customers')
          .select('id, name, email, phone, created_at')
          .eq('shop_id', selectedShop.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('reservations')
          .select(`id, customer_id, date, start_time, end_time, status, therapist:therapists(name), course:courses(name)`)
          .eq('shop_id', selectedShop.id)
          .order('date', { ascending: false })
          .order('start_time', { ascending: false }),
      ])

      if (customersRes.error) throw customersRes.error
      if (reservationsRes.error) throw reservationsRes.error

      setCustomers(customersRes.data || [])
      setReservations((reservationsRes.data as unknown as Reservation[]) || [])
    } catch (error) {
      console.error('顧客の取得に失敗:', error)
      alert('顧客の取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const visitCounts = useMemo(() => {
    const map = new Map<string, number>()
    reservations.forEach((r) => {
      map.set(r.customer_id, (map.get(r.customer_id) || 0) + 1)
    })
    return map
  }, [reservations])

  const openHistoryModal = (customer: Customer) => {
    setHistoryTarget(customer)
    setHistoryModalOpen(true)
  }

  const closeHistoryModal = () => {
    setHistoryModalOpen(false)
    setHistoryTarget(null)
  }

  const selectedHistory = useMemo(() => {
    if (!historyTarget) return []
    return reservations.filter((r) => r.customer_id === historyTarget.id)
  }, [historyTarget, reservations])

  const openEditModal = (customer: Customer) => {
    setEditTarget(customer)
    setEditForm({
      name: customer.name || '',
      email: customer.email || '',
      phone: customer.phone || '',
    })
    setEditModalOpen(true)
  }

  const closeEditModal = () => {
    setEditModalOpen(false)
    setEditTarget(null)
  }

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setEditForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editTarget) return
    if (!editForm.name.trim()) {
      alert('名前は必須です')
      return
    }

    try {
      const { error } = await supabase
        .from('customers')
        .update({
          name: editForm.name,
          email: editForm.email || null,
          phone: editForm.phone || null,
        })
        .eq('id', editTarget.id)

      if (error) throw error

      await fetchCustomers()
      closeEditModal()
      alert('顧客情報を更新しました')
    } catch (error) {
      console.error('顧客の更新に失敗:', error)
      alert('顧客の更新に失敗しました')
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
    <div className="min-h-screen bg-slate-50/50 p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">顧客管理</h1>
            <p className="text-sm text-slate-500 mt-1">店舗を利用されるお客様の情報や来店履歴を管理します。</p>
          </div>
          <button
            onClick={() => {
              setEditTarget(null)
              setEditForm({ name: '', email: '', phone: '' })
              setEditModalOpen(true)
            }}
            className="px-5 py-2.5 bg-indigo-600 text-white font-medium rounded-xl shadow-sm hover:bg-indigo-700 hover:shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <span className="text-lg leading-none">+</span>
            <span>新規顧客登録</span>
          </button>
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
                  <th className="px-6 py-4 whitespace-nowrap text-center w-24">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-medium text-slate-800 mb-2">顧客データがありません</h3>
                      <p className="text-slate-500">右上の「新規顧客登録」ボタンから顧客を追加してください。</p>
                    </td>
                  </tr>
                ) : (
                  customers.map((customer) => {
                    const status = '予約可'
                    return (
                      <tr key={customer.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-lg">
                              {customer.name.charAt(0)}
                            </div>
                            <span className="font-bold text-slate-800">{customer.name}</span>
                          </div>
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
                            <span className="mr-1 text-lg leading-none">{visitCounts.get(customer.id) || 0}</span> 回
                          </button>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-3 py-1 text-xs font-bold rounded-full ${statusStyles[status] || 'bg-slate-100 text-slate-800'
                              }`}
                          >
                            {status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => openEditModal(customer)}
                            className="text-indigo-600 hover:text-indigo-800 font-medium text-sm transition-colors opacity-80 group-hover:opacity-100"
                          >
                            編集
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 編集モーダル */}
        {editModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
              onClick={closeEditModal}
            ></div>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md relative z-10 overflow-hidden transform transition-all">
              <div className="p-6 md:p-8">
                <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </span>
                  {editTarget ? '顧客情報の編集' : '新規顧客登録'}
                </h2>

                <form id="customer-form" onSubmit={handleEditSave} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center">
                      お名前 <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-600">必須</span>
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={editForm.name}
                      onChange={handleEditChange}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all text-slate-800 placeholder-slate-400"
                      placeholder="山田 太郎"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center">
                      電話番号 <span className="ml-2 text-xs text-slate-400 font-normal">任意</span>
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={editForm.phone}
                      onChange={handleEditChange}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all text-slate-800 placeholder-slate-400"
                      placeholder="090-1234-5678"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center">
                      メールアドレス <span className="ml-2 text-xs text-slate-400 font-normal">任意</span>
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={editForm.email}
                      onChange={handleEditChange}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all text-slate-800 placeholder-slate-400"
                      placeholder="customer@example.com"
                    />
                  </div>
                </form>
              </div>

              <div className="bg-slate-50 p-4 md:px-8 border-t border-slate-100 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 font-medium rounded-xl hover:bg-slate-50 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  form="customer-form"
                  className="px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-xl shadow-sm hover:bg-indigo-700 hover:shadow transition-all active:scale-95"
                >
                  {editTarget ? '更新する' : '登録する'}
                </button>
              </div>
            </div>
          </div>
        )}

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
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
