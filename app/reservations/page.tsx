'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

type Reservation = {
  id: string
  customer_id: string
  therapist_id: string
  course_id: string
  date: string
  start_time: string
  end_time: string
  total_price: number
  status: string
  designation_type: string
  discount_amount: number
  created_at: string
}

type RelatedData = {
  customer: { name: string } | null
  therapist: { name: string } | null
  course: { name: string } | null
}

export default function ReservationsPage() {
  const [reservations, setReservations] = useState<(Reservation & RelatedData)[]>([])
  const [loading, setLoading] = useState(true)
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0])

  useEffect(() => {
    fetchReservations()
  }, [filterDate])

  const fetchReservations = async () => {
    try {
      const { data, error } = await supabase
        .from('reservations')
        .select(`
          *,
          customer:customers(name),
          therapist:therapists(name),
          course:courses(name)
        `)
        .eq('date', filterDate)
        .order('start_time', { ascending: true })

      if (error) throw error

      setReservations(data || [])
    } catch (error) {
      console.error('予約の取得に失敗:', error)
      alert('予約の取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('この予約を削除しますか？')) return

    try {
      // 関連するオプションを削除
      await supabase.from('reservation_options').delete().eq('reservation_id', id)
      
      // 予約を削除
      const { error } = await supabase
        .from('reservations')
        .delete()
        .eq('id', id)

      if (error) throw error
      alert('予約を削除しました')
      fetchReservations()
    } catch (error) {
      console.error('削除に失敗:', error)
      alert('削除に失敗しました')
    }
  }

  const getDesignationLabel = (type: string) => {
    const labels = {
      free: 'フリー',
      nomination: '指名',
      confirmed: '本指名',
    }
    return labels[type as keyof typeof labels] || type
  }

  const getStatusLabel = (status: string) => {
    const labels = {
      pending: '保留中',
      confirmed: '確定',
      cancelled: 'キャンセル',
    }
    return labels[status as keyof typeof labels] || status
  }

  if (loading) {
    return <div className="p-8">読み込み中...</div>
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">予約管理</h1>
        <Link
          href="/reservations/new"
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          + 新規予約
        </Link>
      </div>

      {/* 日付フィルタ */}
      <div className="mb-6 flex items-center space-x-4">
        <label className="text-sm font-medium">日付:</label>
        <input
          type="date"
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
          className="px-3 py-2 border rounded"
        />
      </div>

      {/* 予約一覧 */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">時間</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">お客様</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">セラピスト</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">コース</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">指名</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">料金</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">状態</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {reservations.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-4 text-center text-gray-500">
                  この日付の予約はありません
                </td>
              </tr>
            ) : (
              reservations.map((reservation) => (
                <tr key={reservation.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {reservation.start_time} - {reservation.end_time}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {reservation.customer?.name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {reservation.therapist?.name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {reservation.course?.name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      reservation.designation_type === 'free'
                        ? 'bg-gray-100 text-gray-800'
                        : reservation.designation_type === 'nomination'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-purple-100 text-purple-800'
                    }`}>
                      {getDesignationLabel(reservation.designation_type)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    ¥{reservation.total_price.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      reservation.status === 'confirmed'
                        ? 'bg-green-100 text-green-800'
                        : reservation.status === 'pending'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {getStatusLabel(reservation.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                    <Link
                      href={`/reservations/${reservation.id}/edit`}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      編集
                    </Link>
                    <button
                      onClick={() => handleDelete(reservation.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      削除
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
