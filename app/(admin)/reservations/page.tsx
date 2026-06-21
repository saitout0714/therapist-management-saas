'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useShop } from '@/app/contexts/ShopContext'
import { toDisplayTime } from '@/lib/timeUtils'

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
  is_handled?: boolean
  source?: string
  customer_notified?: boolean
  therapist_notified?: boolean
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
  const [showFilters, setShowFilters] = useState(false)

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
        'id,date,start_time,end_time,total_price,status,designation_type,created_at,is_handled,source,customer_notified,therapist_notified,customer:customers(name),therapist:therapists!reservations_therapist_id_fkey(name),course:courses(name),created_by:users(name)',
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

    // 削除前の同期用パラメータ取得
    let eventId: string | null = null
    let calendarId: string | null = null
    try {
      const { data: resData } = await supabase
        .from('reservations')
        .select('google_event_id, shop_id')
        .eq('id', id)
        .maybeSingle()
      
      if (resData) {
        eventId = resData.google_event_id
        if (resData.shop_id) {
          const { data: settingsData } = await supabase
            .from('system_settings')
            .select('google_calendar_id')
            .eq('shop_id', resData.shop_id)
            .maybeSingle()
          if (settingsData) {
            calendarId = settingsData.google_calendar_id
          }
        }
      }
    } catch (err) {
      console.warn('[CalendarSync] 削除前のカレンダー情報取得に失敗しました:', err)
    }

    await supabase.from('reservation_options').delete().eq('reservation_id', id)
    const { error } = await supabase.from('reservations').delete().eq('id', id)
    if (error) {
      alert('削除に失敗しました')
      return
    }

    // 削除に成功したら非同期でカレンダーから削除
    if (eventId && calendarId) {
      try {
        await fetch('/api/calendar-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'delete',
            deletedEventId: eventId,
            deletedCalendarId: calendarId
          })
        })
      } catch (syncErr) {
        console.error('[CalendarSync] カレンダー削除同期に失敗しました:', syncErr)
      }
    }

    void fetchReservations(page, applied)
  }

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
    void fetchReservations(newPage, applied)
  }

  const designationLabel = (v: string) => {
    if (designationTypes[v]) return designationTypes[v]
    switch (v) {
      case 'free': return 'フリー'
      case 'nomination': return '指名'
      case 'first_nomination': return '初回指名'
      case 'confirmed': return '本指名'
      case 'princess': return '姫予約'
      default: return v
    }
  }
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
    <div className="bg-gray-100 p-2 md:p-4">
      <div className="mx-auto">
        <div className="flex justify-between items-center mb-4">
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
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 mb-4 overflow-hidden">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-700">絞り込み検索</span>
              {hasActiveFilters && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  絞り込み中
                </span>
              )}
            </div>
            <svg
              className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${showFilters ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {showFilters && (
            <div className="p-6 pt-0 border-t border-slate-50">
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
              </div>
            </div>
          )}
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

          {/* PC用テーブル表示 */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[1200px] text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">詳細</th>
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
                    <td className="px-6 py-12 text-center" colSpan={12}>
                      <div className="flex justify-center items-center text-indigo-600">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
                        <span className="ml-3 font-medium text-sm">読み込み中...</span>
                      </div>
                    </td>
                  </tr>
                ) : reservations.length === 0 ? (
                  <tr>
                    <td className="px-6 py-12 text-center text-slate-500" colSpan={12}>
                      {hasActiveFilters ? '条件に一致する予約がありません' : '予約がありません'}
                    </td>
                  </tr>
                ) : (
                  reservations.map((r, idx) => {
                    const isNotificationUnsent = !r.customer_notified || !r.therapist_notified;
                    return (
                      <tr key={r.id} className={`transition-colors ${isNotificationUnsent ? 'bg-amber-50/80 border-l-4 border-l-amber-500 hover:bg-amber-100/60 shadow-[inset_1px_0_0_0_rgba(245,158,11,0.2)] font-medium' : idx % 2 === 0 ? 'bg-white hover:bg-slate-50/80' : 'bg-slate-100 hover:bg-slate-200/80'}`}>
                        <td className="px-6 py-4 text-sm whitespace-nowrap">
                          <Link href={`/reservations/${r.id}`} className="text-indigo-600 hover:text-indigo-800 font-medium transition-colors">
                            詳細
                          </Link>
                        </td>
                        <td className="px-6 py-4 text-sm font-semibold text-slate-800">{r.date}</td>
                        <td className="px-6 py-4 text-sm font-medium text-slate-700">
                          {toDisplayTime(r.start_time)} - {toDisplayTime(r.end_time)}
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
                          <div className="flex flex-col gap-1 items-start">
                            <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${statusStyle(r.status)}`}>
                              {statusLabel(r.status)}
                            </span>
                          </div>
                        </td>

                        <td className="px-6 py-4 text-sm text-slate-500 whitespace-nowrap">
                          {r.created_at ? new Date(r.created_at).toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-700 whitespace-nowrap">{r.created_by?.name || '-'}</td>
                        <td className="px-6 py-4 text-sm text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-3">
                            <button className="text-rose-600 hover:text-rose-700 font-medium transition-colors cursor-pointer" onClick={() => void handleDelete(r.id)}>
                              削除
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* スマホ用カード表示 */}
          <div className="block md:hidden">
            {loading ? (
              <div className="p-6 text-center">
                <div className="flex justify-center items-center text-indigo-600">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
                  <span className="ml-2.5 font-medium text-xs">読み込み中...</span>
                </div>
              </div>
            ) : reservations.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-xs">
                {hasActiveFilters ? '条件に一致する予約がありません' : '予約がありません'}
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {reservations.map((r, idx) => {
                  const isNotificationUnsent = !r.customer_notified || !r.therapist_notified;
                  return (
                    <div
                      key={r.id}
                      className={`p-2.5 transition-colors ${
                        isNotificationUnsent
                          ? 'bg-amber-50/70 border-l-4 border-l-amber-500 shadow-[inset_1px_0_0_0_rgba(245,158,11,0.15)]'
                          : idx % 2 === 0
                            ? 'bg-white hover:bg-slate-50/80'
                            : 'bg-slate-100 hover:bg-slate-200/80'
                      }`}
                    >
                      {/* 1行目: 詳細 ＆ 日時 ＆ アクション */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/reservations/${r.id}`}
                            className="text-xs font-bold text-sky-500 hover:text-sky-600 shrink-0"
                          >
                            詳細
                          </Link>
                          <span className="text-xs font-bold text-slate-800">
                            {r.date} {toDisplayTime(r.start_time)}
                          </span>
                          {r.created_at && (
                            <span className="text-[10px] font-normal text-slate-400">
                              (登録: {new Date(r.created_at).toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })})
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => void handleDelete(r.id)}
                            className="text-xs font-semibold text-rose-600 hover:text-rose-700 transition-colors cursor-pointer"
                          >
                            削除
                          </button>
                        </div>
                      </div>

                      {/* 2行目: 均等幅グリッド（5カラム）によるデータ表示 */}
                      <div className="grid grid-cols-5 gap-1 items-center text-xs text-slate-700">
                        {/* お客様名 */}
                        <span className="font-bold text-slate-900 truncate text-left whitespace-nowrap">{r.customer?.name || 'なし'}</span>

                        {/* セラピスト名 */}
                        <span className="font-semibold text-indigo-700 truncate text-center whitespace-nowrap">{r.therapist?.name || 'フリー'}</span>

                        {/* コース名 */}
                        <span className="text-slate-600 truncate text-center whitespace-nowrap">{r.course?.name || '-'}</span>

                        {/* 指名区分 */}
                        <div className="flex justify-center">
                          <span className={`inline-flex justify-center px-1.5 py-0.5 rounded text-[9px] font-semibold shrink-0 whitespace-nowrap ${designationStyle(r.designation_type)}`}>
                            {designationLabel(r.designation_type)}
                          </span>
                        </div>

                        {/* 状態バッジ */}
                        <div className="flex justify-center">
                          <span className={`inline-flex justify-center px-1.5 py-0.5 rounded-full text-[9px] font-bold shrink-0 whitespace-nowrap ${statusStyle(r.status)}`}>
                            {statusLabel(r.status)}
                          </span>
                        </div>
                      </div>


                    </div>
                  );
                })}
              </div>
            )}
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
