'use client'

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
  created_by: { name: string } | null
}

const PAGE_SIZE = 100

export default function ReservationsPage() {
  const { selectedShop } = useShop()
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [designationTypes, setDesignationTypes] = useState<Record<string, string>>({})

  async function fetchDesignationTypes() {
    if (!selectedShop) return
    const { data } = await supabase
      .from('designation_types')
      .select('slug, display_name')
      .eq('shop_id', selectedShop.id)
    if (data) {
      const map: Record<string, string> = {}
      data.forEach((d: { slug: string; display_name: string }) => { map[d.slug] = d.display_name })
      setDesignationTypes(map)
    }
  }

  async function fetchReservations(currentPage: number) {
    if (!selectedShop) {
      setReservations([])
      setTotalCount(0)
      setLoading(false)
      return
    }

    setLoading(true)
    const from = (currentPage - 1) * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    const { data, error, count } = await supabase
      .from('reservations')
      .select(
        'id,date,start_time,end_time,total_price,status,designation_type,created_at,customer:customers(name),therapist:therapists!reservations_therapist_id_fkey(name),course:courses(name),created_by:users(name)',
        { count: 'exact' }
      )
      .eq('shop_id', selectedShop.id)
      .neq('status', 'blocked')
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) alert('予約の取得に失敗しました')
    else {
      setReservations((data as unknown as Reservation[]) || [])
      setTotalCount(count ?? 0)
    }
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
    void fetchReservations(page)
  }

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
    void fetchReservations(newPage)
  }

  const designationLabel = (v: string) => designationTypes[v] || v
  const statusLabel = (v: string) => ({ pending: '保留中', confirmed: '確定', cancelled: 'キャンセル', completed: '完了' }[v] || v)

  useEffect(() => {
    setPage(1)
    void fetchDesignationTypes()
    void fetchReservations(1)
  }, [selectedShop])

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  const designationStyle = (value: string) => {
    if (value === 'confirmed') return 'bg-violet-50 text-violet-700 border border-violet-200'
    if (value === 'nomination') return 'bg-sky-50 text-sky-700 border border-sky-200'
    if (value === 'princess') return 'bg-pink-50 text-pink-700 border border-pink-200'
    return 'bg-slate-100 text-slate-600 border border-slate-200'
  }

  const statusStyle = (value: string) => {
    if (value === 'confirmed') return 'bg-emerald-50 text-emerald-700 border border-emerald-200'
    if (value === 'completed') return 'bg-blue-50 text-blue-700 border border-blue-200'
    if (value === 'cancelled') return 'bg-rose-50 text-rose-700 border border-rose-200'
    return 'bg-amber-50 text-amber-700 border border-amber-200'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 p-6 md:p-8">
        <div className="mx-auto">
          <div className="flex justify-center items-center py-20 text-indigo-600">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <span className="ml-3 font-medium">読み込み中...</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6 md:p-8">
      <div className="mx-auto">
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
            <span className="text-sm font-medium text-slate-500">
              全 {totalCount.toLocaleString()} 件
              {totalPages > 1 && (
                <span className="ml-2 text-slate-400">
                  （{(page - 1) * PAGE_SIZE + 1}〜{Math.min(page * PAGE_SIZE, totalCount)} 件表示）
                </span>
              )}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] text-left border-collapse">
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
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">登録日</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">担当者</th>
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
                    <td className="px-6 py-4 text-sm text-slate-500 whitespace-nowrap">
                      {r.created_at ? new Date(r.created_at).toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700 whitespace-nowrap">{r.created_by?.name || '-'}</td>
                    <td className="px-6 py-4 text-sm text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-3">
                        <Link href={`/reservations/${r.id}`} className="text-indigo-600 hover:text-indigo-800 font-medium transition-colors">
                          詳細 / 編集
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
                    <td className="px-6 py-12 text-center text-slate-500" colSpan={11}>予約がありません</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* ページネーション */}
          {totalPages > 1 && (
            <div className="px-8 py-4 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 1}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                ← 前のページ
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                  .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                    if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) acc.push('...')
                    acc.push(p)
                    return acc
                  }, [])
                  .map((p, idx) =>
                    p === '...' ? (
                      <span key={`ellipsis-${idx}`} className="px-2 text-slate-400">…</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => handlePageChange(p as number)}
                        className={`w-9 h-9 text-sm font-medium rounded-xl transition-all ${
                          page === p
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {p}
                      </button>
                    )
                  )}
              </div>

              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={page === totalPages}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                次のページ →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
