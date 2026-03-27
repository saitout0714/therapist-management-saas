'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { useShop } from '@/app/contexts/ShopContext'

interface Therapist {
  id: string
  name: string
  avatar?: string
}

interface Room {
  id: string
  name: string
}

interface Shift {
  id: string
  therapist_id: string
  room_id: string | null
  date: string
  start_time: string
  end_time: string
}

interface Reservation {
  id: string
  therapist_id: string
  date: string
  start_time: string
  end_time: string
  status: string
  designation_type: string
  total_price: number
  customers: { name: string; created_at: string } | null
  courses: { name: string; duration: number } | null
}

interface WeeklyDayViewProps {
  therapists: Therapist[]
  weekStartDate: Date
  onDayClick?: (date: string) => void
}

function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const toMinutes = (t: string): number => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

const dbTimeToDisplay = (dbTime: string, refDbTime: string): string => {
  const base = dbTime.slice(0, 5)
  const ref = refDbTime.slice(0, 5)
  if (toMinutes(base) <= toMinutes(ref)) {
    const [h, m] = base.split(':').map(Number)
    return `${String(h + 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }
  return base
}

const DESIGNATION_LABEL: Record<string, string> = {
  free: 'フリー',
  nomination: '指名',
  confirmed: '本指名',
  princess: '姫予約',
}

const DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土']

const WeeklyDayView: React.FC<WeeklyDayViewProps> = ({ therapists, weekStartDate, onDayClick }) => {
  const router = useRouter()
  const { selectedShop } = useShop()
  const [shifts, setShifts] = useState<Shift[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [rooms, setRooms] = useState<Room[]>([])

  const weekDates = useMemo(() => {
    const dates: Date[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStartDate)
      d.setDate(weekStartDate.getDate() + i)
      dates.push(d)
    }
    return dates
  }, [weekStartDate])

  const fetchWeekData = async () => {
    if (!selectedShop) return
    const startDate = formatDate(weekDates[0])
    const endDate = formatDate(weekDates[6])

    const [shiftsRes, reservationsRes] = await Promise.all([
      supabase
        .from('shifts')
        .select('id, therapist_id, room_id, date, start_time, end_time')
        .eq('shop_id', selectedShop.id)
        .gte('date', startDate)
        .lte('date', endDate),
      supabase
        .from('reservations')
        .select('id, therapist_id, date, start_time, end_time, status, designation_type, total_price, customers(name, created_at), courses(name, duration)')
        .eq('shop_id', selectedShop.id)
        .gte('date', startDate)
        .lte('date', endDate)
        .eq('status', 'confirmed'),
    ])

    setShifts((shiftsRes.data as Shift[]) || [])
    setReservations((reservationsRes.data as unknown as Reservation[]) || [])
  }

  useEffect(() => {
    void fetchWeekData()
  }, [selectedShop, weekDates])

  useEffect(() => {
    const fetchRooms = async () => {
      if (!selectedShop) return
      const { data } = await supabase.from('rooms').select('id, name').eq('shop_id', selectedShop.id)
      setRooms((data as Room[]) || [])
    }
    void fetchRooms()
  }, [selectedShop])

  const therapistMap = useMemo(() => {
    const map = new Map<string, Therapist>()
    therapists.forEach(t => map.set(t.id, t))
    return map
  }, [therapists])

  const roomMap = useMemo(() => {
    const map = new Map<string, string>()
    rooms.forEach(r => map.set(r.id, r.name))
    return map
  }, [rooms])

  const shiftsByDate = useMemo(() => {
    const map = new Map<string, Shift[]>()
    weekDates.forEach(d => map.set(formatDate(d), []))
    shifts.forEach(s => {
      const list = map.get(s.date)
      if (list) list.push(s)
    })
    map.forEach(list => {
      list.sort((a, b) => toMinutes(a.start_time.slice(0, 5)) - toMinutes(b.start_time.slice(0, 5)))
    })
    return map
  }, [shifts, weekDates])

  const reservationsByDateTherapist = useMemo(() => {
    const map = new Map<string, Reservation[]>()
    reservations.forEach(r => {
      const key = `${r.date}_${r.therapist_id}`
      const list = map.get(key) || []
      list.push(r)
      map.set(key, list)
    })
    map.forEach(list => {
      list.sort((a, b) => toMinutes(a.start_time.slice(0, 5)) - toMinutes(b.start_time.slice(0, 5)))
    })
    return map
  }, [reservations])

  const today = formatDate(new Date())

  return (
    <div className="flex flex-col bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      {/* 週間グリッド — bg-slate-50 は TimeChart の timeline エリアと同じ */}
      <div className="overflow-x-auto">
        <div className="grid grid-cols-7 divide-x divide-slate-200 min-w-[980px]">
          {weekDates.map((date) => {
            const dateStr = formatDate(date)
            const dayShifts = shiftsByDate.get(dateStr) || []
            const isToday = dateStr === today
            const dayOfWeek = date.getDay()
            const isSun = dayOfWeek === 0
            const isSat = dayOfWeek === 6

            return (
              <div key={dateStr} className="flex flex-col">
                {/* 列ヘッダー — TimeChart の時間軸ヘッダーと同トーン */}
                <div
                  className={`flex flex-col items-center justify-center py-3 border-b border-slate-200 sticky top-0 z-10 bg-white/95 backdrop-blur shadow-sm
                    ${onDayClick ? 'cursor-pointer hover:bg-indigo-50/60' : ''}
                    ${isToday ? 'bg-indigo-50/80' : ''}`}
                  onClick={() => onDayClick?.(dateStr)}
                >
                  <span className={`text-xs font-bold tracking-wide
                    ${isSun ? 'text-rose-500' : isSat ? 'text-blue-500' : 'text-slate-500'}`}>
                    {DAY_LABELS[dayOfWeek]}
                  </span>
                  <span className={`text-xl font-bold leading-tight mt-0.5
                    ${isToday ? 'text-indigo-600' : isSun ? 'text-rose-500' : isSat ? 'text-blue-500' : 'text-slate-800'}`}>
                    {date.getDate()}
                  </span>
                  {isToday
                    ? <span className="mt-1 text-[9px] font-bold bg-indigo-600 text-white px-1.5 py-0.5 rounded-full">今日</span>
                    : <span className="mt-1 text-[10px] text-slate-400 font-medium">{dayShifts.length > 0 ? `${dayShifts.length}名` : '—'}</span>
                  }
                </div>

                {/* セラピストカード列 — bg-slate-50 でタイムラインエリアと統一 */}
                <div className={`flex flex-col gap-0 flex-1 min-h-[400px] ${isToday ? 'bg-indigo-50/20' : 'bg-slate-50'}`}>
                  {dayShifts.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center py-10">
                      <span className="text-xs text-slate-300 font-medium">シフトなし</span>
                    </div>
                  ) : (
                    dayShifts.map((shift, shiftIdx) => {
                      const therapist = therapistMap.get(shift.therapist_id)
                      if (!therapist) return null
                      const roomName = shift.room_id ? roomMap.get(shift.room_id) : null
                      const endDisplay = dbTimeToDisplay(shift.end_time, shift.start_time)
                      const dayReservations = reservationsByDateTherapist.get(`${dateStr}_${shift.therapist_id}`) || []

                      return (
                        <div
                          key={shift.id}
                          className={`bg-white hover:bg-indigo-50/40 transition-colors group relative
                            ${shiftIdx < dayShifts.length - 1 ? 'border-b border-slate-100' : ''}`}
                        >
                          {/* ホバー時のインジゴ左バー — TimeChart と同じ */}
                          <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />

                          {/* セラピスト情報 — TimeChart の左列と同スタイル */}
                          <div className="flex items-center gap-3 px-3 pt-3 pb-2">
                            {therapist.avatar ? (
                              <img
                                src={therapist.avatar}
                                alt={therapist.name}
                                className="w-10 h-10 rounded-full object-cover shadow-sm ring-2 ring-white flex-shrink-0"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-100 to-indigo-50 text-indigo-500 flex items-center justify-center font-bold text-base shadow-sm ring-2 ring-white flex-shrink-0">
                                {therapist.name.charAt(0)}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-slate-800 truncate group-hover:text-indigo-700 transition-colors">
                                {therapist.name}
                              </p>
                              {/* シフト時間 — TimeChart の emerald バッジと同じ */}
                              <span className="inline-block text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-100 mt-1 leading-tight">
                                {shift.start_time.slice(0, 5)} - {endDisplay}
                              </span>
                              {/* ルーム */}
                              {roomName && (
                                <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1 font-medium truncate">
                                  <svg className="w-3 h-3 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                  </svg>
                                  {roomName}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* 予約リスト — TimeChart の予約ブロックと完全同一スタイル */}
                          {dayReservations.length > 0 ? (
                            <div className="px-2 pb-2.5 flex flex-col gap-1.5">
                              {dayReservations.map((res) => {
                                const isNewCustomer = res.customers?.created_at?.split('T')[0] === res.date
                                return (
                                  <div
                                    key={res.id}
                                    className="rounded-xl px-3 py-2 bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-600 border border-indigo-400/50 shadow-md shadow-indigo-500/20 text-white cursor-pointer transition-transform hover:-translate-y-0.5 hover:shadow-lg"
                                    onClick={() => router.push(`/reservations/${res.id}?from=shifts`)}
                                  >
                                    <div className="flex flex-col justify-center overflow-hidden py-0.5">
                                      {/* Row 1: 時間 */}
                                      <div className="text-[9px] font-medium text-white/95 mb-0.5 leading-tight">
                                        <span className="whitespace-nowrap">{res.start_time.slice(0, 5)}-{res.end_time.slice(0, 5)}</span>
                                      </div>
                                      {/* Row 2: 顧客名 + 新規/会員バッジ */}
                                      <div className="flex items-center justify-start gap-1.5 mb-1 min-w-0">
                                        <span className="font-bold text-[11px] truncate drop-shadow-sm">
                                          {res.customers?.name || '—'}
                                        </span>
                                        <span className={`flex-shrink-0 text-[8px] px-1 rounded-sm font-bold ${isNewCustomer ? 'bg-rose-400/90' : 'bg-emerald-400/90'} text-white shadow-sm`}>
                                          {isNewCustomer ? '新規' : '会員'}
                                        </span>
                                      </div>
                                      {/* Row 3: コース時間・指名種別・金額 */}
                                      <div className="text-[9px] font-medium text-white/90 flex items-center gap-1.5 leading-tight">
                                        {res.courses?.duration && (
                                          <span className="opacity-90">{res.courses.duration}分</span>
                                        )}
                                        {res.designation_type && (
                                          <span className="bg-white/20 px-1 rounded-sm text-[8px] border border-white/10">
                                            {DESIGNATION_LABEL[res.designation_type] || res.designation_type}
                                          </span>
                                        )}
                                        {res.total_price !== undefined && (
                                          <span className="text-[10px] font-extrabold text-white bg-black/15 px-1.5 py-0.5 rounded-md backdrop-blur-[1px] ml-1">
                                            ¥{res.total_price.toLocaleString()}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          ) : (
                            <div className="px-3 pb-2.5">
                              <span className="text-[10px] text-slate-300 font-medium">予約なし</span>
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default WeeklyDayView
