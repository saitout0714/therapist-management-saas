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
      setReservations(reservationsRes.data || [])
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
    return <div className="p-8">読み込み中...</div>
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">顧客管理</h1>
        <Link
          href="#"
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          + 新規顧客
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                指名
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                電話番号
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                メールアドレス
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                来店履歴
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                メモ
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                ステータス
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {customers.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                  顧客がいません
                </td>
              </tr>
            ) : (
              customers.map((customer) => {
                const status = '予約可'
                return (
                  <tr key={customer.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {customer.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {customer.phone || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {customer.email || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      <button
                        onClick={() => openHistoryModal(customer)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        {visitCounts.get(customer.id) || 0}回
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">-</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          statusStyles[status] || 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => openEditModal(customer)}
                        className="text-blue-600 hover:text-blue-900"
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

      {editModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-96 max-w-full mx-4">
            <h2 className="text-xl font-bold mb-4">顧客情報編集</h2>
            <form onSubmit={handleEditSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">お客様名 *</label>
                <input
                  type="text"
                  name="name"
                  value={editForm.name}
                  onChange={handleEditChange}
                  className="w-full px-3 py-2 border rounded"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">電話番号</label>
                <input
                  type="tel"
                  name="phone"
                  value={editForm.phone}
                  onChange={handleEditChange}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">メールアドレス</label>
                <input
                  type="email"
                  name="email"
                  value={editForm.email}
                  onChange={handleEditChange}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="flex-1 px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  保存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {historyModalOpen && historyTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-[720px] max-w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">来店履歴（{historyTarget.name}）</h2>
              <button
                onClick={closeHistoryModal}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="max-h-[60vh] overflow-auto border rounded">
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">日付</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">時間</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">コース</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">セラピスト</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">状態</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {selectedHistory.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-4 text-center text-gray-500">
                        来店履歴がありません
                      </td>
                    </tr>
                  ) : (
                    selectedHistory.map((r) => (
                      <tr key={r.id}>
                        <td className="px-4 py-2 text-sm text-gray-700">{r.date}</td>
                        <td className="px-4 py-2 text-sm text-gray-700">{r.start_time} - {r.end_time}</td>
                        <td className="px-4 py-2 text-sm text-gray-700">{r.course?.name || '-'}</td>
                        <td className="px-4 py-2 text-sm text-gray-700">{r.therapist?.name || '-'}</td>
                        <td className="px-4 py-2 text-sm text-gray-700">{r.status}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={closeHistoryModal}
                className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
