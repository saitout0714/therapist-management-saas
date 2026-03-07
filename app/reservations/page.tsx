'use client'
/* eslint-disable react-hooks/set-state-in-effect */

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useShop } from '@/app/contexts/ShopContext'

type Reservation = {
  id: string
  date: string
  start_time: string
  end_time: string
  total_price: number
  status: string
  designation_type: string
  created_at: string
  customer: { name: string } | null
  therapist: { name: string } | null
  course: { name: string } | null
}

export default function ReservationsPage() {
  const { selectedShop } = useShop()
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)

  async function fetchReservations() {
    if (!selectedShop) {
      setReservations([])
      setLoading(false)
      return
    }

    setLoading(true)
    const { data, error } = await supabase
      .from('reservations')
      .select('id,date,start_time,end_time,total_price,status,designation_type,created_at,customer:customers(name),therapist:therapists(name),course:courses(name)')
      .eq('shop_id', selectedShop.id)
      .order('created_at', { ascending: false })

    if (error) alert('予約の取得に失敗しました')
    else setReservations((data as unknown as Reservation[]) || [])
    setLoading(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('この予約を削除しますか？')) return
    await supabase.from('reservation_options').delete().eq('reservation_id', id)
    const { error } = await supabase.from('reservations').delete().eq('id', id)
    if (error) {
      alert('削除に失敗しました')
      return
    }
    void fetchReservations()
  }

  const designationLabel = (v: string) => ({ free: 'フリー', nomination: '指名', confirmed: '本指名', princess: '姫予約' }[v] || v)
  const statusLabel = (v: string) => ({ pending: '保留中', confirmed: '確定', cancelled: 'キャンセル' }[v] || v)

  useEffect(() => {
    void fetchReservations()
  }, [selectedShop])

  const designationStyle = (value: string) => {
    if (value === 'confirmed') return 'bg-violet-50 text-violet-700 border border-violet-200'
    if (value === 'nomination') return 'bg-sky-50 text-sky-700 border border-sky-200'
    if (value === 'princess') return 'bg-amber-50 text-amber-700 border border-amber-200'
    return 'bg-slate-100 text-slate-600 border border-slate-200'
  }

  const statusStyle = (value: string) => {
    if (value === 'confirmed') return 'bg-emerald-50 text-emerald-700 border border-emerald-200'
    if (value === 'cancelled') return 'bg-rose-50 text-rose-700 border border-rose-200'
    return 'bg-amber-50 text-amber-700 border border-amber-200'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 p-6 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-center items-center py-20 text-indigo-600">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <span className="ml-3 font-medium">読み込み中...</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">予約管理</h1>
            <p className="text-sm text-slate-500 mt-1">予約情報の確認、編集、削除を行います。</p>
          </div>
          <Link
            href="/reservations/new"
            className="px-5 py-2.5 bg-indigo-600 text-white font-medium rounded-xl shadow-sm hover:bg-indigo-700 hover:shadow-md transition-all active:scale-95"
          >
            新規予約登録
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 md:px-8 md:py-5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800">予約一覧</h2>
            <span className="text-sm font-medium text-slate-500">{reservations.length} 件</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">予約日</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">時間</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">お客様</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">セラピスト</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">コース</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">指名</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">料金</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">状態</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reservations.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 text-sm font-semibold text-slate-800">{r.date}</td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-700">
                      {r.start_time.slice(0, 5)} - {r.end_time.slice(0, 5)}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700">{r.customer?.name || '-'}</td>
                    <td className="px-6 py-4 text-sm text-slate-700">{r.therapist?.name || '-'}</td>
                    <td className="px-6 py-4 text-sm text-slate-700">{r.course?.name || '-'}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${designationStyle(r.designation_type)}`}>
                        {designationLabel(r.designation_type)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-800">¥{r.total_price.toLocaleString()}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${statusStyle(r.status)}`}>
                        {statusLabel(r.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-3">
                        <Link href={`/reservations/${r.id}/edit`} className="text-indigo-600 hover:text-indigo-800 font-medium transition-colors">
                          編集
                        </Link>
                        <button className="text-rose-600 hover:text-rose-700 font-medium transition-colors" onClick={() => void handleDelete(r.id)}>
                          削除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {reservations.length === 0 && (
                  <tr>
                    <td className="px-6 py-12 text-center text-slate-500" colSpan={9}>予約がありません</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
