'use client'

import React, { useEffect, useMemo, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import Image from 'next/image'
import { useShop } from '@/app/contexts/ShopContext'
import { useAuth } from '@/app/contexts/AuthContext'
import { toDisplayTime } from '@/lib/timeUtils'

interface Therapist {
  id: string
  name: string
  avatar?: string
  reservation_interval_minutes?: number | null
  age?: number | null
  height?: number | null
  bust?: number | null
  bustCup?: string | null
  waist?: number | null
  hip?: number | null
  staffMemo?: string | null
  unresolvedMemos?: { id: string; date: string; content: string; amount: number }[]
}

interface Room {
  id: string
  name: string
  memo?: string | null
  google_map_url?: string | null
}

interface Shift {
  id: string
  therapist_id: string
  room_id: string | null
  date: string
  start_time: string
  end_time: string
  notes?: string | null
}

interface Reservation {
  id: string
  therapist_id: string
  date: string
  start_time: string
  end_time: string
  status: string
  designation_type: string
  is_hime: boolean | null
  total_price: number
  discount_amount: number
  notes?: string | null
  payment_method: string | null
  customer_notified: boolean
  therapist_notified: boolean
  source?: string | null
  is_handled?: boolean | null
  extension_count?: number
  customers: { name: string; created_at: string } | null
  courses: { name: string; duration: number } | null
}

type SortMode = 'shift' | 'room' | 'reservation'

interface WeeklyDayViewProps {
  therapists: Therapist[]
  weekStartDate: Date
  onDayClick?: (date: string) => void
  sortMode?: SortMode
  roomOrderMap?: Map<string, number>
  shopIntervalMinutes?: number
  minCourseDuration?: number
  extensionUnitMinutes?: number
  onShiftEditOpen?: (therapistId: string, date: string) => void
}

function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const toMinutes = (t: string): number => {
  const [h, m] = t.split(':').map(Number)
  const adjustedH = h < 6 ? h + 24 : h
  return adjustedH * 60 + m
}



const DESIGNATION_LABEL: Record<string, string> = {
  free: 'フリー',
  first_nomination: '初回指名',
  nomination: '指名',
  confirmed: '本指名',
  princess: '姫予約',
}

const DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土']

const WeeklyDayView: React.FC<WeeklyDayViewProps> = ({
  therapists,
  weekStartDate,
  onDayClick,
  sortMode = 'shift',
  roomOrderMap = new Map(),
  shopIntervalMinutes = 20,
  minCourseDuration = 0,
  extensionUnitMinutes = 30,
  onShiftEditOpen,
}) => {
  const router = useRouter()
  const { selectedShop } = useShop()
  const { loading: authLoading, user } = useAuth()
  const [shifts, setShifts] = useState<Shift[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [rooms, setRooms] = useState<Room[]>([])

  const [memoPopup, setMemoPopup] = useState<{ therapistId: string; x: number; y: number } | null>(null)
  const [roomMemoPopup, setRoomMemoPopup] = useState<{ roomName: string; memo: string; mapUrl: string | null; x: number; y: number } | null>(null)
  const roomMemoHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [therapistPopup, setTherapistPopup] = useState<{ therapist: Therapist; x: number; y: number } | null>(null)
  const therapistPopupHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ドラッグスクロール用のState/Ref/Handler
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragDistanceRef = useRef(0)

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // 左クリックのみ反応
    if (e.button !== 0) return
    if (!scrollContainerRef.current) return

    const startScrollLeft = scrollContainerRef.current.scrollLeft
    const startClientX = e.clientX
    dragDistanceRef.current = 0

    const handleDragMove = (moveEvent: MouseEvent) => {
      if (!scrollContainerRef.current) return

      const distance = Math.abs(moveEvent.clientX - startClientX)
      dragDistanceRef.current = distance

      if (distance > 5) {
        setIsDragging(true)
        moveEvent.preventDefault()
        document.body.style.userSelect = 'none'
      }

      const deltaX = moveEvent.clientX - startClientX
      scrollContainerRef.current.scrollLeft = startScrollLeft - deltaX
    }

    const handleDragEnd = () => {
      window.removeEventListener('mousemove', handleDragMove)
      window.removeEventListener('mouseup', handleDragEnd)
      window.removeEventListener('blur', handleDragEnd)
      document.body.style.userSelect = ''
      setTimeout(() => {
        setIsDragging(false)
      }, 50)
    }

    window.addEventListener('mousemove', handleDragMove)
    window.addEventListener('mouseup', handleDragEnd)
    window.addEventListener('blur', handleDragEnd)
  }

  const handleContainerClickCapture = (e: React.MouseEvent) => {
    // ドラッグ移動が大きかった場合はクリックイベントを遮断する
    if (dragDistanceRef.current > 5) {
      e.stopPropagation()
      e.preventDefault()
    }
  }


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
    if (!selectedShop || authLoading || !user) return
    const startDate = formatDate(weekDates[0])
    const endDate = formatDate(weekDates[6])

    const [shiftsRes, reservationsRes] = await Promise.all([
      supabase
        .from('shifts')
        .select('id, therapist_id, room_id, date, start_time, end_time, notes')
        .eq('shop_id', selectedShop.id)
        .gte('date', startDate)
        .lte('date', endDate),
      supabase
        .from('reservations')
        .select('id, therapist_id, date, start_time, end_time, status, designation_type, is_hime, total_price, discount_amount, notes, payment_method, customer_notified, therapist_notified, source, is_handled, extension_count, customers(name, created_at), courses(name, duration)')
        .eq('shop_id', selectedShop.id)
        .gte('date', startDate)
        .lte('date', endDate)
        .in('status', ['confirmed', 'blocked']),
    ])

    setShifts((shiftsRes.data as Shift[]) || [])
    setReservations((reservationsRes.data as unknown as Reservation[]) || [])
  }

  useEffect(() => {
    void fetchWeekData()
  }, [selectedShop, weekDates, authLoading, user])

  useEffect(() => {
    const fetchRooms = async () => {
      if (!selectedShop) return
      const { data } = await supabase.from('rooms').select('id, name, memo, google_map_url').eq('shop_id', selectedShop.id)
      setRooms((data as Room[]) || [])
    }
    void fetchRooms()
  }, [selectedShop])

  const therapistMap = useMemo(() => {
    const map = new Map<string, Therapist>()
    therapists.forEach(t => map.set(t.id, t))
    map.set('unassigned', {
      id: 'unassigned',
      name: 'フリー（未割当）',
      avatar: undefined,
    })
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

    const todayStr = formatDate(new Date())
    const now = new Date()
    let nowMins = now.getHours() * 60 + now.getMinutes()
    if (now.getHours() < 6) nowMins += 24 * 60

    map.forEach((list, dateStr) => {
      const isOff = (s: Shift) => {
        const shiftStartStr = toDisplayTime(s.start_time)
        const shiftEndStr = toDisplayTime(s.end_time)
        return reservations.some(
          r =>
            r.date === dateStr &&
            r.status === 'blocked' &&
            r.therapist_id === s.therapist_id &&
            toDisplayTime(r.start_time) === shiftStartStr &&
            toDisplayTime(r.end_time) === shiftEndStr
        )
      }

      const hasUnassigned = reservations.some(
        r => r.date === dateStr && r.therapist_id === null && r.status !== 'blocked'
      )

      let others = [...list]

      if (sortMode === 'shift') {
        others.sort((a, b) => {
          if (isOff(a) !== isOff(b)) return isOff(a) ? 1 : -1
          return toMinutes(a.start_time.slice(0, 5)) - toMinutes(b.start_time.slice(0, 5))
        })
      } else if (sortMode === 'room') {
        others.sort((a, b) => {
          if (isOff(a) !== isOff(b)) return isOff(a) ? 1 : -1
          const aOrder = a.room_id ? (roomOrderMap.get(a.room_id) ?? 9999) : 9999
          const bOrder = b.room_id ? (roomOrderMap.get(b.room_id) ?? 9999) : 9999
          if (aOrder !== bOrder) return aOrder - bOrder
          return toMinutes(a.start_time.slice(0, 5)) - toMinutes(b.start_time.slice(0, 5))
        })
      } else if (sortMode === 'reservation') {
        const earliestMap = new Map<string, number>()
        reservations
          .filter(r => r.date === dateStr && r.status === 'confirmed' && r.therapist_id)
          .forEach(r => {
            const mins = toMinutes(r.start_time.slice(0, 5))
            const cur = earliestMap.get(r.therapist_id) ?? 9999
            if (mins < cur) earliestMap.set(r.therapist_id, mins)
          })

        const isEffectivelyFinished = (shift: Shift): boolean => {
          if (dateStr !== todayStr) return false
          let shiftEndMins = toMinutes(shift.end_time.slice(0, 5))
          const startMins = toMinutes(shift.start_time.slice(0, 5))
          if (shiftEndMins <= startMins) shiftEndMins += 24 * 60
          if (nowMins >= shiftEndMins) return true
          const therapist = therapistMap.get(shift.therapist_id)
          const interval = therapist?.reservation_interval_minutes ?? shopIntervalMinutes
          const therapistReservations = reservations.filter(
            r => r.therapist_id === shift.therapist_id && r.date === dateStr && r.status === 'confirmed'
          )
          const lastEndMins = therapistReservations.length > 0
            ? Math.max(...therapistReservations.map(r => toMinutes(r.end_time.slice(0, 5))))
            : null
          const nextAvailableMins = lastEndMins !== null
            ? Math.max(nowMins, lastEndMins + interval)
            : nowMins
          const requiredMins = minCourseDuration > 0 ? minCourseDuration : 1
          return nextAvailableMins + requiredMins > shiftEndMins
        }

        others.sort((a, b) => {
          if (isOff(a) !== isOff(b)) return isOff(a) ? 1 : -1
          const aFinished = isEffectivelyFinished(a)
          const bFinished = isEffectivelyFinished(b)
          if (aFinished !== bFinished) return aFinished ? 1 : -1
          const aMin = earliestMap.get(a.therapist_id) ?? 9999
          const bMin = earliestMap.get(b.therapist_id) ?? 9999
          if (aMin !== bMin) return aMin - bMin
          return toMinutes(a.start_time.slice(0, 5)) - toMinutes(b.start_time.slice(0, 5))
        })
      }

      if (hasUnassigned) {
        map.set(dateStr, [
          {
            id: 'unassigned-shift-' + dateStr,
            therapist_id: 'unassigned',
            room_id: null,
            date: dateStr,
            start_time: '10:00:00',
            end_time: '22:00:00',
            notes: '未割当のフリー予約があります',
          },
          ...others,
        ])
      } else {
        map.set(dateStr, others)
      }
    })

    return map
  }, [shifts, weekDates, sortMode, roomOrderMap, reservations, therapistMap, shopIntervalMinutes])

  const reservationsByDateTherapist = useMemo(() => {
    const map = new Map<string, Reservation[]>()
    reservations.forEach(r => {
      const key = `${r.date}_${r.therapist_id || 'unassigned'}`
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
      <div
        className="overflow-x-auto cursor-grab active:cursor-grabbing select-none"
        ref={scrollContainerRef}
        onMouseDown={handleMouseDown}
        onClickCapture={handleContainerClickCapture}
      >
        <div className="grid grid-cols-7 divide-x divide-slate-200 min-w-[1190px]">
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
                    {date.getMonth()+1}/{date.getDate()}
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
                      const endDisplay = toDisplayTime(shift.end_time)
                      const allDayReservations = reservationsByDateTherapist.get(`${dateStr}_${shift.therapist_id}`) || []
                      const dayReservations = allDayReservations.filter(r => r.status === 'confirmed')
                      const blockedNote = allDayReservations.find(r => r.status === 'blocked')?.notes
                      const shiftNote = blockedNote != null ? blockedNote : (shift.notes ?? null)

                      const shiftStartStr = toDisplayTime(shift.start_time)
                      const shiftEndStr = toDisplayTime(shift.end_time)
                      const isOff = therapist.id !== 'unassigned' && allDayReservations.some(r =>
                        r.status === 'blocked' &&
                        toDisplayTime(r.start_time) === shiftStartStr &&
                        toDisplayTime(r.end_time) === shiftEndStr
                      )

                      return (
                        <div
                          key={shift.id}
                          className={`transition-colors group relative
                            ${isOff ? 'bg-slate-100/80 hover:bg-slate-200/50 text-slate-400 border-l-4 border-rose-300' : 'bg-white hover:bg-indigo-50/40'}
                            ${shiftIdx < dayShifts.length - 1 ? 'border-b border-slate-100' : ''}`}
                        >
                          {/* ホバー時のインジゴ左バー — TimeChart と同じ */}
                          {!isOff && (
                            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                          )}

                          {/* セラピスト情報 */}
                          <div className="flex items-stretch">
                            {/* 写真 — 3:4固定比率 */}
                            <div className="w-[42px] flex-shrink-0 self-center pl-1.5 py-1">
                              <div className={`relative w-full overflow-hidden rounded bg-slate-100 flex items-center justify-center border border-slate-200 ${isOff ? 'opacity-40' : ''}`} style={{ aspectRatio: '3/4' }}>
                                {therapist.id === 'unassigned' ? (
                                  <div className="w-full h-full flex items-center justify-center bg-amber-50 text-amber-500">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                  </div>
                                ) : therapist.avatar ? (
                                  <Image src={therapist.avatar} alt={therapist.name} fill className="object-cover" unoptimized />
                                ) : (
                                  <span className="w-full h-full flex items-center justify-center text-lg font-bold text-slate-300">{therapist.name[0]}</span>
                                )}
                              </div>
                            </div>
                            {/* テキスト情報 */}
                            <div className="flex flex-col justify-center flex-1 min-w-0 px-2 py-1.5 gap-[4px]">
                              {/* 名前 */}
                              <div className="min-w-0 flex items-center justify-between gap-1">
                                <p
                                  className={`text-[13px] font-bold leading-none group-hover:text-indigo-700 transition-colors cursor-default truncate
                                    ${isOff ? 'text-slate-400' : 'text-slate-800'}`}
                                  onMouseEnter={(e) => {
                                    if (therapist.id === 'unassigned' ? true : false) return
                                    if (therapistPopupHideTimer.current) clearTimeout(therapistPopupHideTimer.current)
                                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                                    setTherapistPopup({ therapist, x: rect.left, y: rect.bottom + 4 })
                                  }}
                                  onMouseLeave={() => {
                                    if (therapist.id === 'unassigned') return
                                    therapistPopupHideTimer.current = setTimeout(() => setTherapistPopup(null), 150)
                                  }}
                                >
                                  {therapist.name}
                                </p>
                                {isOff && (
                                  <span className="flex-shrink-0 text-[9px] font-extrabold px-1.5 py-0.5 leading-none rounded bg-rose-100 text-rose-700 border border-rose-200">
                                    休み
                                  </span>
                                )}
                              </div>
                              {/* 引き継ぎメモ */}
                              {(therapist.unresolvedMemos?.length ?? 0) > 0 && (
                                <div className="flex min-w-0">
                                  <span
                                    className="flex-shrink-0 flex items-center gap-1 text-[10px] font-extrabold px-1.5 py-0.5 leading-none rounded bg-rose-50 text-rose-600 border border-rose-200 animate-pulse cursor-default truncate max-w-full"
                                    title={`引継メモ: ${therapist.unresolvedMemos!.map(m => m.content).join(', ')}`}
                                    onMouseEnter={e => {
                                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                                      setMemoPopup({ therapistId: therapist.id, x: rect.right + 6, y: rect.top })
                                    }}
                                    onMouseLeave={() => setMemoPopup(null)}
                                  >
                                    <svg className="w-3 h-3 text-rose-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                    <span className="truncate">引継: {therapist.unresolvedMemos![0].content}</span>
                                  </span>
                                </div>
                              )}
 
                              {/* 出勤時間 */}
                              <p className="text-[11px] font-semibold leading-none whitespace-nowrap">
                                {therapist.id === 'unassigned' ? (
                                  <span className="text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 font-bold">要対応</span>
                                ) : isOff ? (
                                  <span className="text-slate-400 line-through">{toDisplayTime(shift.start_time)}〜{endDisplay}</span>
                                ) : (
                                  <span className="text-emerald-600">{toDisplayTime(shift.start_time)}〜{endDisplay}</span>
                                )}
                              </p>
 
                              {/* ルーム + インターバル */}
                              <div className={`flex items-center gap-1.5 flex-wrap ${isOff ? 'opacity-40' : ''}`}>
                                {roomName && (
                                  <span
                                    className="text-[10px] text-slate-500 font-medium whitespace-nowrap flex items-center gap-0.5 cursor-default leading-none"
                                    onMouseEnter={(e) => {
                                      if (roomMemoHideTimer.current) clearTimeout(roomMemoHideTimer.current)
                                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                                      const activeRoom = rooms.find(r => r.id === shift.room_id)
                                      setRoomMemoPopup({
                                        roomName: roomName,
                                        memo: activeRoom?.memo ?? '',
                                        mapUrl: activeRoom?.google_map_url ?? null,
                                        x: rect.left,
                                        y: rect.bottom + 4
                                      })
                                    }}
                                    onMouseLeave={() => {
                                      roomMemoHideTimer.current = setTimeout(() => setRoomMemoPopup(null), 150)
                                    }}
                                  >
                                    <svg className="w-2.5 h-2.5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                    {roomName}
                                  </span>
                                )}
                                {therapist.id !== 'unassigned' && (
                                  <span className="flex-shrink-0 text-[9px] font-medium px-1.5 py-0.5 leading-none rounded bg-slate-100 text-slate-500 border border-slate-200">
                                    {therapist.reservation_interval_minutes && therapist.reservation_interval_minutes > 0 ? `${therapist.reservation_interval_minutes}分` : '20分'}
                                  </span>
                                )}
                              </div>
 
                              {/* notes */}
                              {shiftNote && therapist.id !== 'unassigned' && (
                                <p className="text-[9px] text-amber-600 font-medium leading-none whitespace-nowrap truncate" title={shiftNote}>
                                  {shiftNote}
                                </p>
                              )}
                            </div>
                            {/* アクションボタン（予約・編集）の縦スタック — 右端上下中央 */}
                            {therapist.id !== 'unassigned' && (
                              <div className="flex flex-col items-center justify-center gap-1 flex-shrink-0 mr-1.5 self-center">
                                {!isOff && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      const t = new Date()
                                      t.setHours(t.getHours() + 1, 0, 0, 0)
                                      const time = `${String(t.getHours()).padStart(2, '0')}:00`
                                      const params = new URLSearchParams({ therapist_id: therapist.id, date: dateStr, time })
                                      if (shift.room_id) params.set('room_id', shift.room_id)
                                      router.push(`/reservations/new?${params.toString()}`)
                                    }}
                                    className="flex-shrink-0 text-[9px] font-bold text-rose-500 bg-rose-50 hover:bg-rose-100 border border-rose-200 active:scale-95 px-1.5 py-0.5 rounded transition-all"
                                  >
                                    予約
                                  </button>
                                )}
                                {onShiftEditOpen && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      onShiftEditOpen(therapist.id, dateStr)
                                    }}
                                    title="シフトを編集"
                                    className="flex items-center justify-center w-6 h-6 rounded-md text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 transition-all"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>

                          {/* 予約リスト — TimeChart の予約ブロックと完全同一スタイル */}
                          {isOff ? (
                            <div className="px-2 pb-2.5">
                              <div className="rounded-lg px-2.5 py-2 border border-rose-200 bg-rose-50/50 text-rose-800 text-[11px] font-bold text-center flex flex-col gap-0.5 shadow-sm">
                                <div>全日受付不可 (休み)</div>
                                {shiftNote && (
                                  <div className="text-[10px] text-rose-600/90 font-medium whitespace-pre-wrap">{shiftNote}</div>
                                )}
                              </div>
                            </div>
                          ) : (() => {
                            const displayReservations = allDayReservations.filter(r => {
                              if (r.status === 'confirmed') return true
                              if (r.status === 'blocked') {
                                const isFullDayBlock = toDisplayTime(r.start_time) === shiftStartStr && toDisplayTime(r.end_time) === shiftEndStr
                                return !isFullDayBlock
                              }
                              return false
                            })

                            displayReservations.sort((a, b) => toMinutes(a.start_time.slice(0, 5)) - toMinutes(b.start_time.slice(0, 5)))

                            if (displayReservations.length > 0) {
                              return (
                                <div className="px-2 pb-2.5 flex flex-col gap-1.5">
                                  {displayReservations.map((res) => {
                                    if (res.status === 'blocked') {
                                      return (
                                        <div
                                          key={res.id}
                                          className="rounded-lg px-2 py-1.5 border border-rose-200 bg-rose-50/60 text-rose-800 cursor-pointer transition-transform hover:-translate-y-0.5 hover:shadow-md"
                                          onClick={() => router.push(`/reservations/${res.id}?from=shifts`)}
                                        >
                                          <div className="flex flex-col py-0.5 gap-1">
                                            <div className="text-[10px] font-bold text-rose-700 leading-none flex items-center justify-between gap-1">
                                              <span>{toDisplayTime(res.start_time)}-{toDisplayTime(res.end_time)}</span>
                                              <span className="bg-rose-100 text-rose-700 text-[8px] font-extrabold px-1 rounded-sm">受付不可</span>
                                            </div>
                                            {res.notes && (
                                              <p className="text-[10px] font-bold leading-tight truncate mt-0.5 text-rose-600/90" title={res.notes}>
                                                {res.notes}
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                      )
                                    }

                                    const isNewCustomer = res.customers?.created_at?.split('T')[0] === res.date
                                    const isNotificationUnsent = !res.customer_notified || !res.therapist_notified
                                    const isWeb = res.source === 'web'
                                    const cardBgClass = (res.is_hime || res.designation_type === 'princess')
                                      ? isNotificationUnsent
                                        ? 'bg-gradient-to-br from-[#e27396] to-[#c35175] border-2 border-amber-400 shadow-lg shadow-amber-500/40 animate-pulse'
                                        : 'bg-gradient-to-br from-[#e27396] to-[#c35175] border border-[#c35175]/30 shadow-md shadow-rose-900/10'
                                      : isWeb
                                        ? isNotificationUnsent
                                          ? 'bg-gradient-to-br from-[#f59e0b] to-[#ea580c] border-2 border-amber-300 shadow-lg shadow-amber-500/40 animate-pulse'
                                          : 'bg-gradient-to-br from-teal-600 to-emerald-700 border border-teal-500/40 shadow-md shadow-teal-700/20'
                                        : isNotificationUnsent
                                          ? 'bg-gradient-to-br from-[#f59e0b] to-[#ea580c] border-2 border-amber-300 shadow-lg shadow-amber-500/40 animate-pulse'
                                          : 'bg-gradient-to-br from-[#1f3c6d] to-[#0a1b3a] border border-[#0a1b3a]/40 shadow-md shadow-[#0a1b3a]/20'

                                    return (
                                      <div
                                        key={res.id}
                                        className={`rounded-lg px-2 py-1.5 border text-white cursor-pointer transition-transform hover:-translate-y-0.5 hover:shadow-lg ${cardBgClass}`}
                                        onClick={() => router.push(`/reservations/${res.id}?from=shifts`)}
                                      >
                                        <div className="flex flex-col justify-between overflow-hidden py-0.5 gap-1">
                                          {/* Row 1: 時間 & 未送信バッジ */}
                                          <div className="text-[10px] font-medium text-white leading-none flex items-center gap-1 flex-wrap">
                                            <span className="whitespace-nowrap">{toDisplayTime(res.start_time)}-{toDisplayTime(res.end_time)}</span>
                                            {!res.customer_notified && (
                                              <span className="bg-rose-500 text-white font-extrabold px-1 rounded-sm text-[8px] scale-90 origin-left whitespace-nowrap shadow-sm border border-rose-400" title="お客様未送信">客未</span>
                                            )}
                                            {!res.therapist_notified && (
                                              <span className="bg-rose-500 text-white font-extrabold px-1 rounded-sm text-[8px] scale-90 origin-left whitespace-nowrap shadow-sm border border-rose-400" title="セラピスト未送信">セラ未</span>
                                            )}
                                          </div>
                                          {/* Row 2: 顧客名 + 新規/会員バッジ */}
                                          <div className="flex items-center justify-start gap-1 min-w-0">
                                            <span className="font-bold text-[13px] text-white leading-none truncate drop-shadow-sm">
                                              {res.customers?.name || '—'}
                                            </span>
                                            <span className={`flex-shrink-0 text-[9px] px-1 rounded-sm font-bold ${isNewCustomer ? 'bg-rose-400/90' : 'bg-emerald-400/90'} text-white shadow-sm`}>
                                              {isNewCustomer ? '新規' : '会員'}
                                            </span>
                                            {res.payment_method === 'credit' && (
                                              <span className="flex-shrink-0 text-[9px] px-1 rounded-sm font-bold bg-amber-400 text-slate-900 border border-amber-300 shadow-sm whitespace-nowrap">
                                                💳 クレジット
                                              </span>
                                            )}
                                          </div>
                                          {/* Row 3: コース時間・指名種別・延長・金額 */}
                                          <div className="text-[10px] font-medium text-white flex items-center gap-1 leading-none flex-wrap">
                                            {res.courses?.duration && (
                                              <span className="opacity-90">{res.courses.duration}分</span>
                                            )}
                                            {res.extension_count !== undefined && res.extension_count > 0 && (
                                              <span className="bg-amber-500/90 text-white px-1 rounded-sm text-[9px] font-bold border border-amber-400/40">
                                                延長+{res.extension_count * extensionUnitMinutes}分
                                              </span>
                                            )}
                                            {res.designation_type && (
                                              <span className="bg-white/20 px-1 rounded-sm text-[9px] text-white border border-white/10">
                                                {DESIGNATION_LABEL[res.designation_type] || res.designation_type}
                                              </span>
                                            )}
                                            {res.total_price !== undefined && (
                                              <span className="text-[11px] font-extrabold text-white bg-black/15 px-1 py-0 rounded backdrop-blur-[1px]">
                                                ¥{res.total_price.toLocaleString()}
                                              </span>
                                            )}
                                            {res.discount_amount > 0 && (
                                              <span className="text-[10px] font-bold text-rose-200 bg-rose-500/30 px-1 py-0 rounded border border-rose-300/20">
                                                -¥{res.discount_amount.toLocaleString()}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              )
                            } else {
                              return (
                                <div className="px-3 pb-2.5">
                                  <span className="text-[10px] text-slate-300 font-medium">予約なし</span>
                                </div>
                              )
                            }
                          })()}
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

      {/* セラピスト情報ポップアップ */}
      {therapistPopup && (
        <div
          className="fixed z-[9999]"
          style={{ left: `${therapistPopup.x}px`, top: `${therapistPopup.y}px` }}
          onMouseEnter={() => { if (therapistPopupHideTimer.current) clearTimeout(therapistPopupHideTimer.current); }}
          onMouseLeave={() => setTherapistPopup(null)}
        >
          <div className="bg-white rounded-xl shadow-2xl overflow-hidden border border-slate-100 p-3 space-y-2">
            {(therapistPopup.therapist.age || therapistPopup.therapist.height) && (
              <div className="flex gap-1.5 flex-wrap">
                {therapistPopup.therapist.age && (
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-xs font-semibold">{therapistPopup.therapist.age}歳</span>
                )}
                {therapistPopup.therapist.height && (
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-xs font-semibold">{therapistPopup.therapist.height}cm</span>
                )}
              </div>
            )}
            {(therapistPopup.therapist.bust || therapistPopup.therapist.waist || therapistPopup.therapist.hip) && (
              <div className="flex gap-1.5 flex-wrap">
                {therapistPopup.therapist.bust && (
                  <span className="px-2 py-0.5 bg-rose-50 text-rose-600 border border-rose-100 rounded-full text-xs font-semibold">
                    B{therapistPopup.therapist.bust}{therapistPopup.therapist.bustCup ?? ''}
                  </span>
                )}
                {therapistPopup.therapist.waist && (
                  <span className="px-2 py-0.5 bg-rose-50 text-rose-600 border border-rose-100 rounded-full text-xs font-semibold">W{therapistPopup.therapist.waist}</span>
                )}
                {therapistPopup.therapist.hip && (
                  <span className="px-2 py-0.5 bg-rose-50 text-rose-600 border border-rose-100 rounded-full text-xs font-semibold">H{therapistPopup.therapist.hip}</span>
                )}
              </div>
            )}
            {therapistPopup.therapist.staffMemo && (
              <p className="text-xs text-amber-900 leading-relaxed whitespace-pre-wrap bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-2">{therapistPopup.therapist.staffMemo}</p>
            )}
          </div>
        </div>
      )}

      {/* ルームメモポップアップ */}
      {roomMemoPopup && (
        <div
          className="fixed z-[9999]"
          style={{ left: `${roomMemoPopup.x}px`, top: `${roomMemoPopup.y}px` }}
          onMouseEnter={() => { if (roomMemoHideTimer.current) clearTimeout(roomMemoHideTimer.current); }}
          onMouseLeave={() => setRoomMemoPopup(null)}
        >
          <div className="bg-white rounded-xl shadow-2xl overflow-hidden border border-slate-100 p-3 space-y-2">
            {roomMemoPopup.memo ? (
              <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{roomMemoPopup.memo}</p>
            ) : (
              !roomMemoPopup.mapUrl && (
                <p className="text-xs text-slate-400 italic">メモはありません</p>
              )
            )}
            {roomMemoPopup.mapUrl && (
              <a
                href={roomMemoPopup.mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 active:scale-95 transition-all text-white font-bold rounded-lg px-3 py-2 w-full text-xs"
              >
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                Googleマップを開く
              </a>
            )}
          </div>
        </div>
      )}

      {/* 未解決メモポップアップ */}
      {memoPopup && (() => {
        const t = therapists.find(th => th.id === memoPopup.therapistId);
        if (!t?.unresolvedMemos?.length) return null;
        return (
          <div
            className="fixed z-[9999] pointer-events-none"
            style={{ left: `${memoPopup.x}px`, top: `${memoPopup.y}px` }}
          >
            <div className="bg-white border border-amber-300 rounded-xl shadow-xl p-3 w-64">
              <p className="text-[10px] font-bold text-amber-700 mb-2 flex items-center gap-1">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                引き継ぎメモ（{t.unresolvedMemos.length}件）
              </p>
              <div className="space-y-2">
                {t.unresolvedMemos.map(memo => (
                  <div key={memo.id} className="bg-amber-50 rounded-lg px-2.5 py-2">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[10px] font-bold text-amber-700">{memo.date}</span>
                      {memo.amount !== 0 && (
                        <span className={`text-[9px] font-bold px-1.5 rounded ${memo.amount > 0 ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                          {memo.amount > 0 ? `+${memo.amount.toLocaleString()}` : memo.amount.toLocaleString()}円
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-700 leading-snug">{memo.content}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  )
}

export default WeeklyDayView
