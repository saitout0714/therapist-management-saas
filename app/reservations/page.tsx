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

type SearchFilters = {
  dateFrom: string
  dateTo: string
  status: string
  customerName: string
  therapistName: string
}

const PAGE_SIZE = 100

const EMPTY_FILTERS: SearchFilters = {
  dateFrom: '',
  dateTo: '',
  status: '',
  customerName: '',
  therapistName: '',
}

export default function ReservationsPage() {
  const { selectedShop } = useShop()
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [designationTypes, setDesignationTypes] = useState<Record<string, string>>({})

  const [draft, setDraft] = useState<SearchFilters>(EMPTY_FILTERS)
  const [applied, setApplied] = useState<SearchFilters>(EMPTY_FILTERS)

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

  async function fetchReservations(currentPage: number, filters: SearchFilters) {
    if (!selectedShop) {
      setReservations([])
      setTotalCount(0)
      setLoading(false)
      return
    }

    setLoading(true)
    const from = (currentPage - 1) * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    // Resolve customer IDs from name search
    let customerIds: string[] | null = null
    if (filters.customerName.trim()) {
      const { data } = await supabase
        .from('customers')
        .select('id')
        .eq('shop_id', selectedShop.id)
        .ilike('name', `%${filters.customerName.trim()}%`)
      customerIds = data?.map((c: { id: string }) => c.id) ?? []
      if (customerIds.length === 0) {
        setReservations([])
        setTotalCount(0)
        setLoading(false)
        return
      }
    }

    // Resolve therapist IDs from name search
    let therapistIds: string[] | null = null
    if (filters.therapistName.trim()) {
      const { data } = await supabase
        .from('therapists')
        .select('id')
        .eq('shop_id', selectedShop.id)
        .ilike('name', `%${filters.therapistName.trim()}%`)
      therapistIds = data?.map((t: { id: string }) => t.id) ?? []
      if (therapistIds.length === 0) {
        setReservations([])
        setTotalCount(0)
        setLoading(false)
        return
      }
    }

    let query = supabase
      .from('reservations')
      .select(
        'id,date,start_time,end_time,total_price,status,designation_type,created_at,customer:customers(name),therapist:therapists!reservations_therapist_id_fkey(name),course:courses(name),created_by:users(name)',
        { count: 'exact' }
      )
      .eq('shop_id', selectedShop.id)
      .neq('status', 'blocked')

    if (filters.dateFrom) query = query.gte('date', filters.dateFrom)
    if (filters.dateTo) query = query.lte('date', filters.dateTo)
    if (filters.status) query = query.eq('status', filters.status)
    if (customerIds) query = query.in('customer_id', customerIds)
    if (therapistIds) query = query.in('therapist_id', therapistIds)

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) alert('予約の取得に失敗しました')
    else {
      setReservations((data as unknown as Reservation[]) || [])
      setTotalCount(count ?? 0)
    }
    setLoading(false)
  }

  const handleSearch = () => {
    setPage(1)
    setApplied(draft)
    void fetchReservations(1, draft)
  }

  const handleReset = () => {
    setDraft(EMPTY_FILTERS)
    setApplied(EMPTY_FILTERS)
    setPage(1)
    void fetchReservations(1, EMPTY_FILTERS)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('この予約を削除しますか？')) return
    await supabase.from('reservation_options').delete().eq('reservation_id', id)
    const { error } = await supabase.from('reservations').delete().eq('id', id)
    if (error) {
      alert('削除に失敗しました')
      return
    }
    void fetchReservations(page, applied)
  }

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
    void fetchReservations(newPage, applied)
  }

  const designationLabel = (v: string) => designationTypes[v] || v
  const statusLabel = (v: string) => ({ pending: '保留中', confirmed: '確定', cancelled: 'キャンセル', completed: '完了' }[v] || v)

  useEffect(() => {
    setPage(1)
    setDraft(EMPTY_FILTERS)
    setApplied(EMPTY_FILTERS)
    void fetchDesignationTypes()
    void fetchReservations(1, EMPTY_FILTERS)
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

  const hasActiveFilters = Object.values(applied).some(v => v !== '')

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

        {/* 検索フィルター */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-4">
          <h2 className="text-sm font-semibold text-slate-600 mb-4">絞り込み検索</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">予約日（開始）</label>
              <input
                type="date"
                value={draft.dateFrom}
                onChange={e => setDraft(d => ({ ...d, dateFrom: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">予約日（終了）</label>
              <input
                type="date"
                value={draft.dateTo}
                onChange={e => setDraft(d => ({ ...d, dateTo: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">ステータス</label>
              <select
                value={draft.status}
                onChange={e => setDraft(d => ({ ...d, status: e.target.value }))}
                className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
              >
                <option value="">すべて</option>
                <option value="pending">保留中</option>
                <option value="confirmed">確定</option>
                <option value="completed">完了</option>
                <option value="cancelled">キャンセル</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">お客様名</label>
              <input
                type="text"
                placeholder="部分一致"
                value={draft.customerName}
                onChange={e => setDraft(d => ({ ...d, customerName: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">セラピスト名</label>
              <input
                type="text"
                placeholder="部分一致"
                value={draft.therapistName}
                onChange={e => setDraft(d => ({ ...d, therapistName: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <button
              onClick={handleSearch}
              className="px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
            >
              検索
            </button>
            {hasActiveFilters && (
              <button
                onClick={handleReset}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
              >
                リセット
              </button>
            )}
            {hasActiveFilters && (
              <span className="text-xs text-indigo-600 font-medium ml-1">絞り込み中</span>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 md:px-8 md:py-5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800">予約一覧</h2>
            <span className="text-sm font-medium text-slate-500">
              {loading ? '読み込み中...' : (
                <>
                  全 {totalCount.toLocaleString()} 件
                  {totalPages > 1 && (
                    <span className="ml-2 text-slate-400">
                      （{(page - 1) * PAGE_SIZE + 1}〜{Math.min(page * PAGE_SIZE, totalCount)} 件表示）
                    </span>
                  )}
                </>
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
                {loading ? (
                  <tr>
                    <td className="px-6 py-12 text-center" colSpan={11}>
                      <div className="flex justify-center items-center text-indigo-600">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
                        <span className="ml-3 font-medium text-sm">読み込み中...</span>
                      </div>
                    </td>
                  </tr>
                ) : reservations.length === 0 ? (
                  <tr>
                    <td className="px-6 py-12 text-center text-slate-500" colSpan={11}>
                      {hasActiveFilters ? '条件に一致する予約がありません' : '予約がありません'}
                    </td>
                  </tr>
                ) : (
                  reservations.map((r) => (
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
                  ))
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
