'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'

export type Shop = {
  id: string
  name: string
  short_name: string | null
  description: string | null
}

export type Course = {
  id: string
  name: string
  duration: number
  base_price: number
}

export type TherapistRank = { name: string }

export type Therapist = {
  id: string
  name: string
  age: number | null
  height: number | null
  bust: number | null
  bust_cup: string | null
  waist: number | null
  hip: number | null
  comment: string | null
  photo_url: string | null
  photos: string[]
  rank_id: string | null
  is_active: boolean
  is_rookie?: boolean
  reservation_interval_minutes: number | null
  therapist_ranks: TherapistRank | null
}

export type Shift = {
  id: string
  date: string
  start_time: string
  end_time: string
  therapists: Therapist | null
}

export type ExistingReservation = {
  therapist_id: string
  date: string
  start_time: string
  end_time: string
  status: string
}

export type Step = 'attendance' | 'details' | 'customer' | 'confirm' | 'complete'

export type CustomerForm = {
  name: string
  furigana: string
  phone: string
  email: string
  notes: string
}

export type InitialReserveData = {
  shop: Shop | null
  courses: Course[]
  shifts: Shift[]
  reservations: ExistingReservation[]
  system_interval_minutes: number
  allow_new_customers?: boolean
  code: string
}

function formatTime(t: string) {
  return t.slice(0, 5)
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  const days = ['日', '月', '火', '水', '木', '金', '土']
  return `${d.getMonth() + 1}月${d.getDate()}日(${days[d.getDay()]})`
}

function formatPrice(p: number) {
  return p.toLocaleString('ja-JP') + '円'
}

function addMinutes(time: string, mins: number) {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + mins
  const nh = Math.floor(total / 60)
  const nm = total % 60
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`
}

// JSTの日付と時刻文字列を合成してDateオブジェクトを生成するヘルパー関数
function getJstDateFromDateTime(dateStr: string, timeStr: string): Date {
  const [yyyy, mm, dd] = dateStr.split('-').map(Number)
  let [h, m] = timeStr.split(':').map(Number)
  let extraDays = 0
  if (h >= 24) {
    extraDays = Math.floor(h / 24)
    h = h % 24
  }
  const utcMs = Date.UTC(yyyy, mm - 1, dd + extraDays, h, m) - 9 * 60 * 60 * 1000
  return new Date(utcMs)
}

function timeToMinutes(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

// 深夜跨ぎ対応：シフト開始時刻を基準に分に変換
function timeToMinutesAbsolute(t: string, shiftStart: string): number {
  const [h, m] = t.split(':').map(Number)
  const [sh] = shiftStart.split(':').map(Number)
  let mins = h * 60 + m
  // シフト開始より1時間以上前なら翌日扱い（深夜跨ぎ）
  if (mins < sh * 60 - 60) mins += 24 * 60
  return mins
}

// スロット候補を生成（開始時刻の文字列リスト）
function generateSlots(shiftStart: string, shiftEnd: string, durationMin: number, intervalMin: number) {
  const slots: string[] = []
  const base = timeToMinutes(shiftStart)
  let current = base
  const end = timeToMinutesAbsolute(shiftEnd, shiftStart)
  while (current + durationMin <= end) {
    const h = Math.floor(current / 60)
    const m = current % 60
    slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    current += intervalMin
  }
  return slots
}

// スロットが既存予約と衝突しないか判定
// 新規枠 [sStart, sStart+duration] と既存予約を interval 含めてチェック
function isSlotAvailable(
  slotStart: string,
  duration: number,
  reservations: ExistingReservation[],
  interval: number,
  shiftStart: string,
): boolean {
  const sStart = timeToMinutesAbsolute(slotStart, shiftStart)
  const sEnd = sStart + duration
  for (const res of reservations) {
    const rStart = timeToMinutesAbsolute(res.start_time, shiftStart)
    const rEnd = timeToMinutesAbsolute(res.end_time, shiftStart)
    if (res.status === 'blocked') {
      if (sStart < rEnd && sEnd > rStart) return false
    } else {
      // 既存予約の有効窓 [rStart, rEnd+interval] と新規の有効窓 [sStart, sEnd+interval] が重なる場合NG
      if (sStart < rEnd + interval && sEnd + interval > rStart) return false
    }
  }
  return true
}

// タイムラインのブロックセグメントを計算（表示用 %）
function getTimelineSegments(
  shiftStart: string,
  shiftEnd: string,
  reservations: ExistingReservation[],
  interval: number,
): { left: number; width: number; type: 'reserved' | 'interval' | 'blocked' }[] {
  const shiftStartMin = timeToMinutes(shiftStart)
  const shiftEndMin = timeToMinutesAbsolute(shiftEnd, shiftStart)
  const total = shiftEndMin - shiftStartMin
  if (total <= 0) return []

  const segs: { left: number; width: number; type: 'reserved' | 'interval' | 'blocked' }[] = []
  for (const res of reservations) {
    const rStart = timeToMinutesAbsolute(res.start_time, shiftStart) - shiftStartMin
    const rEnd = timeToMinutesAbsolute(res.end_time, shiftStart) - shiftStartMin
    const rEndWithInterval = res.status === 'blocked' ? rEnd : rEnd + interval
    const clampedStart = Math.max(0, rStart)
    const clampedEnd = Math.min(total, rEndWithInterval)
    if (clampedStart >= clampedEnd) continue
    if (res.status === 'blocked') {
      segs.push({ left: (clampedStart / total) * 100, width: ((clampedEnd - clampedStart) / total) * 100, type: 'blocked' })
    } else {
      // 事前インターバル: 予約開始の interval 分前 ～ 予約開始
      const preIntStart = Math.max(0, rStart - interval)
      const preIntEnd = Math.min(total, rStart)
      if (preIntEnd > preIntStart) {
        segs.push({ left: (preIntStart / total) * 100, width: ((preIntEnd - preIntStart) / total) * 100, type: 'interval' })
      }
      // 予約本体
      const resBodyEnd = Math.min(total, rEnd)
      if (resBodyEnd > clampedStart) {
        segs.push({ left: (clampedStart / total) * 100, width: ((resBodyEnd - clampedStart) / total) * 100, type: 'reserved' })
      }
      // 事後インターバル: 予約終了 ～ 予約終了 + interval
      if (rEnd < total && rEndWithInterval > rEnd) {
        const intStart = Math.max(0, rEnd)
        const intEnd = Math.min(total, rEndWithInterval)
        if (intEnd > intStart) {
          segs.push({ left: (intStart / total) * 100, width: ((intEnd - intStart) / total) * 100, type: 'interval' })
        }
      }
    }
  }
  return segs
}

function PhotoCarousel({ photos, name }: { photos: string[]; name: string }) {
  const [index, setIndex] = useState(0)
  if (photos.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-100">
        <svg className="w-12 h-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      </div>
    )
  }
  return (
    <div className="relative w-full h-full group">
      <Image
        src={photos[index]}
        alt={name}
        fill
        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
        className="object-cover"
        priority={index === 0}
      />
      {photos.length > 1 && (
        <>
          <button
            onClick={e => { e.stopPropagation(); setIndex(i => (i - 1 + photos.length) % photos.length) }}
            className="absolute left-1 top-1/2 -translate-y-1/2 w-6 h-6 bg-black/40 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <button
            onClick={e => { e.stopPropagation(); setIndex(i => (i + 1) % photos.length) }}
            className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 bg-black/40 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
          <div className="absolute bottom-1.5 left-0 right-0 flex justify-center gap-1">
            {photos.map((_, i) => (
              <button
                key={i}
                onClick={e => { e.stopPropagation(); setIndex(i) }}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${i === index ? 'bg-white' : 'bg-white/50'}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function hexToHsl(hex: string) {
  hex = hex.replace('#', '')
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
  }
  const r = parseInt(hex.substring(0, 2), 16) / 255
  const g = parseInt(hex.substring(2, 4), 16) / 255
  const b = parseInt(hex.substring(4, 6), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0)
        break
      case g:
        h = (b - r) / d + 2
        break
      case b:
        h = (r - g) / d + 4
        break
    }
    h /= 6
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  }
}

function generateThemeStyles(hexColor: string) {
  try {
    const { h, s, l } = hexToHsl(hexColor)
    return `
      :root {
        --color-blue-50: hsl(${h}, ${s}%, 96%) !important;
        --color-blue-100: hsl(${h}, ${s}%, 91%) !important;
        --color-blue-200: hsl(${h}, ${s}%, 82%) !important;
        --color-blue-300: hsl(${h}, ${s}%, 72%) !important;
        --color-blue-400: hsl(${h}, ${s}%, 62%) !important;
        --color-blue-500: hsl(${h}, ${s}%, ${l}%) !important;
        --color-blue-600: hsl(${h}, ${s}%, ${Math.max(10, l - 8)}%) !important;
        --color-blue-700: hsl(${h}, ${s}%, ${Math.max(10, l - 16)}%) !important;
        --color-blue-800: hsl(${h}, ${s}%, ${Math.max(10, l - 24)}%) !important;
        --color-blue-900: hsl(${h}, ${s}%, ${Math.max(5, l - 32)}%) !important;
      }
      .border-blue-100 {
        border-color: hsl(${h}, ${s}%, 91%) !important;
      }
    `
  } catch (e) {
    console.error('Failed to generate theme styles:', e)
    return ''
  }
}

export default function ReserveClient({ initialData }: { initialData: InitialReserveData }) {
  const { code } = initialData
  const searchParams = useSearchParams()
  const isEmbed = searchParams.get('embed') === '1'

  const [step, setStep] = useState<Step>('attendance')
  const [loading, setLoading] = useState(false)
  const [dataLoading, setDataLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [shop, setShop] = useState<Shop | null>(initialData.shop)
  const [courses, setCourses] = useState<Course[]>(initialData.courses)
  const [shifts, setShifts] = useState<Shift[]>(initialData.shifts)
  const [existingReservations, setExistingReservations] = useState<ExistingReservation[]>(initialData.reservations)
  const [systemIntervalMinutes, setSystemIntervalMinutes] = useState(initialData.system_interval_minutes)
  const [allowNewCustomers, setAllowNewCustomers] = useState(initialData.allow_new_customers ?? true)
  const [businessDayCutoff, setBusinessDayCutoff] = useState('06:00')

  const [selectedDate, setSelectedDate] = useState(() => {
    if (initialData.shifts.length > 0) {
      return initialData.shifts[0].date
    }
    const jstNow = new Date(new Date().getTime() + 9 * 60 * 60 * 1000)
    return jstNow.toISOString().split('T')[0]
  })

  const [selectedTherapist, setSelectedTherapist] = useState<Therapist | null>(null)
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null)
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [selectedStartTime, setSelectedStartTime] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'credit'>('cash')
  const [customer, setCustomer] = useState<CustomerForm>({
    name: '', furigana: '', phone: '', email: '', notes: ''
  })
  const [validationErrors, setValidationErrors] = useState<Partial<CustomerForm>>({})
  const [isFreeReservation, setIsFreeReservation] = useState(false)
  const timelineRef = useRef<HTMLDivElement>(null)
  const mainRef = useRef<HTMLDivElement>(null)
  const hasInitializedFromUrl = useRef(false)

  // 現在の営業日の基準日付 (JSTタイムゾーンセーフ、深夜営業時間考慮)
  const currentBusinessDateStr = useMemo(() => {
    const now = new Date()
    const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000)
    const jstDate = new Date(utcTime + (9 * 3600000))
    
    const [cutH, cutM] = businessDayCutoff.split(':').map(Number)
    const currentJstMinutes = jstDate.getHours() * 60 + jstDate.getMinutes()
    const cutoffMinutes = (cutH ?? 6) * 60 + (cutM ?? 0)
    
    const businessDate = new Date(jstDate)
    if (currentJstMinutes < cutoffMinutes) {
      businessDate.setDate(businessDate.getDate() - 1)
    }
    
    const y = businessDate.getFullYear()
    const m = String(businessDate.getMonth() + 1).padStart(2, '0')
    const d = String(businessDate.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }, [businessDayCutoff])

  // 利用可能な日付一覧（現在の営業日以降で、シフトがある日）
  const availableDates = useMemo(() => {
    const uniqueDates = [...new Set(shifts.map(s => s.date))].sort()
    return uniqueDates.filter(dateStr => dateStr >= currentBusinessDateStr)
  }, [shifts, currentBusinessDateStr])

  useEffect(() => {
    if (!isEmbed) return
    const el = mainRef.current
    if (!el) return
    const sendHeight = () => {
      window.parent.postMessage({ type: 'iframeResize', height: el.scrollHeight }, '*')
    }
    const ro = new ResizeObserver(sendHeight)
    ro.observe(el)
    sendHeight()
    return () => ro.disconnect()
  }, [isEmbed])

  // URLクエリパラメータから指名セラピストおよび出勤日を自動事前選択
  useEffect(() => {
    if (hasInitializedFromUrl.current) return
    if (shifts.length === 0) return

    const urlTherapistId = searchParams.get('therapist_id')
    const urlDate = searchParams.get('date')

    if (urlTherapistId) {
      let matchingShift = null
      if (urlDate) {
        matchingShift = shifts.find(s => {
          const t = Array.isArray(s.therapists) ? s.therapists[0] : s.therapists
          return t && t.id === urlTherapistId && s.date === urlDate
        })
      }
      
      if (!matchingShift) {
        matchingShift = shifts.find(s => {
          const t = Array.isArray(s.therapists) ? s.therapists[0] : s.therapists
          return t && t.id === urlTherapistId
        })
      }

      if (matchingShift) {
        const t = Array.isArray(matchingShift.therapists) ? matchingShift.therapists[0] : matchingShift.therapists
        if (t) {
          setIsFreeReservation(false)
          setSelectedTherapist(t)
          setSelectedShift(matchingShift)
          setSelectedDate(matchingShift.date)
          setStep('details')
          hasInitializedFromUrl.current = true
        }
      }
    }
  }, [searchParams, shifts])

  const fetchData = useCallback(async () => {
    setDataLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/public/${code}`, { credentials: 'omit' })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'データの取得に失敗しました')
        return
      }
      const data = await res.json()
      setShop(data.shop)
      setCourses(data.courses)
      setShifts(data.shifts)
      setExistingReservations(data.reservations || [])
      setSystemIntervalMinutes(data.system_interval_minutes ?? 20)
      setAllowNewCustomers(data.allow_new_customers ?? true)
      setBusinessDayCutoff(data.business_day_cutoff ?? '06:00')
    } catch {
      setError('データの取得に失敗しました')
    } finally {
      setDataLoading(false)
    }
  }, [code])

  // マウント時にデータを非同期取得
  useEffect(() => {
    void fetchData()
  }, [fetchData])

  // 読み込み完了後に最初の日付を選択
  useEffect(() => {
    if (availableDates.length > 0 && !availableDates.includes(selectedDate)) {
      setSelectedDate(availableDates[0])
    }
  }, [availableDates, selectedDate])

  // therapist_id がパラメータで渡された場合に自動遷移させる処理
  useEffect(() => {
    const paramTherapistId = searchParams.get('therapist_id')
    const paramDate = searchParams.get('date')
    
    if (paramTherapistId && shifts.length > 0) {
      let targetShift = null
      if (paramDate) {
        targetShift = shifts.find(s => s.therapists && s.therapists.id === paramTherapistId && s.date === paramDate)
      } else {
        const sortedMyShifts = shifts
          .filter(s => s.therapists && s.therapists.id === paramTherapistId)
          .sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time))
        if (sortedMyShifts.length > 0) {
          targetShift = sortedMyShifts[0]
        }
      }

      if (targetShift && targetShift.therapists) {
        setSelectedDate(targetShift.date)
        setSelectedTherapist(targetShift.therapists)
        setSelectedShift(targetShift)
        setSelectedCourse(null)
        setSelectedStartTime('')
        setStep('details')
      }
    }
  }, [searchParams, shifts])

  // 最短のコース時間
  const minCourseDuration = useMemo(() => {
    return courses.length > 0 ? Math.min(...courses.map(c => c.duration)) : 60
  }, [courses])

  // 選択日のシフト一覧 (空き枠判定を行い、ご予約満了者を一番下にする)
  const todayShifts = useMemo(() => {
    const rawShifts = shifts.filter(s => s.date === selectedDate)
    const now = new Date()
    const minAllowedTime = now.getTime() + 20 * 60 * 1000 // 20分後

    const shiftsWithAvailability = rawShifts.map(shift => {
      const t = shift.therapists
      if (!t) return { ...shift, hasAvailableSlot: false }

      const interval = t.reservation_interval_minutes ?? systemIntervalMinutes
      const therapistReservations = existingReservations.filter(
        r => r.therapist_id === t.id && r.date === shift.date
      )

      // 最短コースで枠生成を試す
      const allSlots = generateSlots(shift.start_time, shift.end_time, minCourseDuration, 5)
      const hasAnyAvailable = allSlots.some(slot => {
        const isAvail = isSlotAvailable(slot, minCourseDuration, therapistReservations, interval, shift.start_time)
        const slotJstDate = getJstDateFromDateTime(shift.date, slot)
        const isTimeValid = slotJstDate.getTime() >= minAllowedTime
        return isAvail && isTimeValid
      })

      return {
        ...shift,
        hasAvailableSlot: hasAnyAvailable
      }
    })

    // 空き枠があるセラピストを優先し、ご予約満了のセラピストを一番下にする
    return shiftsWithAvailability.sort((a, b) => {
      if (a.hasAvailableSlot && !b.hasAvailableSlot) return -1
      if (!a.hasAvailableSlot && b.hasAvailableSlot) return 1
      return 0
    })
  }, [shifts, selectedDate, systemIntervalMinutes, existingReservations, minCourseDuration])

  // (availableDates is defined above)

  const endTime = selectedStartTime && selectedCourse
    ? addMinutes(selectedStartTime, selectedCourse.duration)
    : ''

  const handleSelectTherapist = (therapist: Therapist, shift: Shift) => {
    setIsFreeReservation(false)
    setSelectedTherapist(therapist)
    setSelectedShift(shift)
    setSelectedCourse(null)
    setSelectedStartTime('')
    setStep('details')
  }

  const handleSelectFree = () => {
    setIsFreeReservation(true)
    setSelectedTherapist(null)
    setSelectedShift(null)
    setSelectedCourse(null)
    setSelectedStartTime('')
    setStep('details')
  }

  const handleDetailsNext = () => {
    if (!selectedCourse || !selectedStartTime) return
    setStep('customer')
  }

  const validateCustomer = () => {
    const errs: Partial<CustomerForm> = {}
    if (!customer.name.trim()) errs.name = 'お名前は必須です'
    if (!customer.furigana.trim()) errs.furigana = 'フリガナは必須です'
    if (!customer.phone.trim()) errs.phone = '電話番号は必須です'
    else if (!/^[\d\-+() ]+$/.test(customer.phone.trim())) errs.phone = '正しい電話番号を入力してください'
    if (!customer.email.trim()) errs.email = 'メールアドレスは必須です'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email.trim())) errs.email = '正しいメールアドレスを入力してください'
    setValidationErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleCustomerNext = () => {
    if (validateCustomer()) setStep('confirm')
  }

  const handleSubmit = async () => {
    if (!selectedCourse || !selectedStartTime) return
    if (!isFreeReservation && (!selectedTherapist || !selectedShift)) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/public/${code}/reserve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          therapist_id: selectedTherapist?.id ?? null,
          date: selectedShift?.date ?? selectedDate,
          start_time: selectedStartTime,
          end_time: endTime,
          course_id: selectedCourse.id,
          payment_method: paymentMethod,
          customer,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || '予約の送信に失敗しました')
        return
      }
      setStep('complete')
    } catch {
      setError('予約の送信に失敗しました。時間をおいて再度お試しください。')
    } finally {
      setSubmitting(false)
    }
  }

  // フリー予約時の仮想シフト（当日の全シフトから最早開始・最遅終了を計算）
  const freeVirtualShift: Shift | null = isFreeReservation
    ? (() => {
        const dayShifts = shifts.filter(s => s.date === selectedDate)
        if (dayShifts.length === 0) return null
        const sorted = [...dayShifts].sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time))
        const startTime = sorted[0].start_time
        let latestEnd = sorted[0].end_time
        for (const s of sorted) {
          if (timeToMinutesAbsolute(s.end_time, startTime) > timeToMinutesAbsolute(latestEnd, startTime)) {
            latestEnd = s.end_time
          }
        }
        return { id: 'free', date: selectedDate, start_time: startTime, end_time: latestEnd, therapists: null }
      })()
    : null

  const currentShift = selectedShift ?? freeVirtualShift

  if (loading && !shop) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (error && !shop) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow p-8 max-w-sm w-full text-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-slate-700 font-medium">{error}</p>
        </div>
      </div>
    )
  }

  const stepLabels: { key: Step; label: string }[] = [
    { key: 'attendance', label: '出勤情報' },
    { key: 'details', label: '詳細選択' },
    { key: 'customer', label: 'お客様情報' },
    { key: 'confirm', label: '確認' },
  ]
  const stepIndex = stepLabels.findIndex(s => s.key === step)

  const themeParam = searchParams.get('theme')
  const activeThemeColor = themeParam || (code === 'kokoro-rinse' || shop?.name?.includes('こころリンス') ? '758e7b' : null)

  return (
    <div ref={mainRef} className={`${isEmbed ? 'min-h-0' : 'min-h-screen'} bg-white`}>
      {activeThemeColor && (
        <style dangerouslySetInnerHTML={{ __html: generateThemeStyles(activeThemeColor) }} />
      )}
      {/* ヘッダー */}
      {!isEmbed && (
        <header className="bg-white border-b border-blue-100 sticky top-0 z-10">
          <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400">Web予約</p>
              <h1 className="text-base font-bold text-slate-800 leading-tight">{shop?.name || ''}</h1>
            </div>
            {step !== 'complete' && (
              <div className="flex items-center gap-1.5">
                {stepLabels.map((s, i) => (
                  <div key={s.key} className={`flex items-center gap-1.5 ${i > 0 ? 'ml-0' : ''}`}>
                    {i > 0 && <div className="w-3 h-px bg-slate-200" />}
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                      i < stepIndex ? 'bg-blue-500 text-white' :
                      i === stepIndex ? 'bg-blue-500 text-white' :
                      'bg-slate-100 text-slate-400'
                    }`}>
                      {i < stepIndex ? (
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : i + 1}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </header>
      )}

      <div className="max-w-2xl mx-auto px-4 py-6 pb-24">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">{error}</div>
        )}

        {/* Step 1: 出勤情報 */}
        {step === 'attendance' && (
          <div className="space-y-5">
            {allowNewCustomers === false && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-sm whitespace-pre-wrap leading-relaxed">
{`⚠️ 会員限定予約のお知らせ

当店は既存の会員様限定のWEB予約となっております。ご新規様のWEB予約は受け付けておりません。

※会員様で予約完了できない場合もお手数ですが、お電話、公式LINEにてお問合せください。`}
              </div>
            )}
            <div>
              <h2 className="text-xl font-bold text-slate-800">出勤情報</h2>
              <p className="text-sm text-slate-500 mt-1">ご希望のセラピストをお選びください</p>
            </div>

            {/* 日付タブ */}
            {dataLoading ? (
              <div className="grid grid-cols-7 gap-1 w-full animate-pulse">
                {[...Array(7)].map((_, i) => (
                  <div key={i} className="flex flex-col items-center justify-center py-5 bg-slate-100 rounded-xl">
                    <div className="h-3 bg-slate-200 rounded w-8 mb-1.5" />
                    <div className="h-2.5 bg-slate-200 rounded w-6" />
                  </div>
                ))}
              </div>
            ) : availableDates.length > 0 && (
              <div className="grid grid-cols-7 gap-1 w-full">
                {availableDates.map(dateStr => {
                  const d = new Date(dateStr + 'T00:00:00')
                  const m = d.getMonth() + 1
                  const date = d.getDate()
                  const days = ['日', '月', '火', '水', '木', '金', '土']
                  const dayOfWeek = days[d.getDay()]
                  const isSunday = dayOfWeek === '日'
                  const isSaturday = dayOfWeek === '土'
                  const dayClass = isSunday ? 'text-red-500' : (isSaturday ? 'text-blue-500' : 'text-slate-500')
                  const activeClass = selectedDate === dateStr
                    ? 'bg-blue-500 border-blue-500 text-white'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-blue-300'
                  return (
                    <button
                      key={dateStr}
                      onClick={() => setSelectedDate(dateStr)}
                      className={`flex flex-col items-center justify-center py-2 border rounded-xl transition-all ${activeClass}`}
                    >
                      <span className="text-xs font-bold">{m}/{date}</span>
                      <span className={`text-[10px] font-bold mt-0.5 ${selectedDate === dateStr ? 'text-white' : dayClass}`}>{dayOfWeek}</span>
                    </button>
                  )
                })}
              </div>
            )}

            {dataLoading ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm animate-pulse p-3 space-y-3">
                    <div className="aspect-[3/4] bg-slate-100 rounded-xl" />
                    <div className="h-4 bg-slate-200 rounded w-2/3" />
                    <div className="h-3 bg-slate-200 rounded w-1/2" />
                    <div className="h-3 bg-slate-200 rounded w-3/4" />
                  </div>
                ))}
              </div>
            ) : todayShifts.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center">
                <p className="text-slate-400 text-sm">本日の出勤情報はありません</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {todayShifts.map(shift => {
                  const t = shift.therapists
                  if (!t) return null
                  const isAvailable = (shift as any).hasAvailableSlot !== false
                  return (
                    <div
                      key={shift.id}
                      onClick={() => {
                        if (isAvailable) {
                          handleSelectTherapist(t, shift)
                        }
                      }}
                      className={`relative bg-white rounded-2xl border border-slate-100 overflow-hidden transition-all text-left group ${
                        isAvailable 
                          ? 'cursor-pointer hover:border-[#789280] hover:shadow-md' 
                          : 'cursor-not-allowed opacity-60'
                      }`}
                    >
                      <div className="aspect-[3/4] bg-slate-100 relative overflow-hidden">
                        <PhotoCarousel photos={t.photos?.length ? t.photos : (t.photo_url ? [t.photo_url] : [])} name={t.name} />
                        {t.is_rookie && (
                          <span className="absolute top-2 right-2 bg-gradient-to-r from-pink-500 to-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md z-10 animate-pulse">
                            ♥ 新人
                          </span>
                        )}
                        {!isAvailable && (
                          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center z-20">
                            <span className="bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-lg tracking-wider border border-red-400/30">
                              ご予約満了
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <p className="font-bold text-slate-800 text-sm truncate">{t.name}</p>
                        {t.therapist_ranks && (
                          <p className="text-xs text-[#b89035] font-semibold mt-0.5">{t.therapist_ranks.name}</p>
                        )}
                        <div className="flex items-center gap-1 mt-2 text-xs text-slate-400">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {formatTime(shift.start_time)} 〜 {formatTime(shift.end_time)}
                        </div>
                        {(t.age || t.height) && (
                          <p className="text-xs text-slate-400 mt-1">
                            {t.age && `${t.age}歳`}{t.age && t.height && ' / '}{t.height && `${t.height}cm`}
                          </p>
                        )}
                        {t.comment && (
                          <p className="text-xs text-slate-500 mt-1.5 line-clamp-2">{t.comment}</p>
                        )}
                      </div>
                    </div>
                  )
                })}
                {/* フリー（指名なし）カード */}
                <div
                  onClick={handleSelectFree}
                  className="cursor-pointer bg-white rounded-2xl border border-dashed border-slate-200 overflow-hidden hover:border-[#789280] hover:shadow-md transition-all text-left group"
                >
                  <div className="aspect-[3/4] bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col items-center justify-center gap-3">
                    <div className="w-14 h-14 rounded-full bg-white border-2 border-dashed border-slate-300 flex items-center justify-center">
                      <svg className="w-7 h-7 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <p className="text-xs text-slate-400 font-medium">指名なし</p>
                  </div>
                  <div className="p-3">
                    <p className="font-bold text-slate-700 text-sm">フリー</p>
                    <p className="text-xs text-slate-400 mt-0.5">セラピストおまかせ</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: 詳細選択 */}
        {step === 'details' && (selectedTherapist !== null || isFreeReservation) && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setStep('attendance'); setSelectedTherapist(null); setSelectedShift(null); setIsFreeReservation(false) }}
                className="w-9 h-9 bg-white rounded-full flex items-center justify-center border border-slate-200 text-slate-500 hover:border-blue-300"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h2 className="text-xl font-bold text-slate-800">コース・時間の選択</h2>
                <p className="text-sm text-slate-500">
                  {isFreeReservation ? 'フリー（指名なし）' : selectedTherapist?.name} / {formatDate(currentShift?.date ?? selectedDate)}
                </p>
              </div>
            </div>

            {/* セラピスト情報カード */}
            {selectedTherapist ? (
              <div className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0 relative">
                  <PhotoCarousel
                    photos={selectedTherapist.photos?.length ? selectedTherapist.photos : (selectedTherapist.photo_url ? [selectedTherapist.photo_url] : [])}
                    name={selectedTherapist.name}
                  />
                </div>
                <div>
                  <p className="font-bold text-slate-800">{selectedTherapist.name}</p>
                  {selectedTherapist.therapist_ranks && (
                    <p className="text-xs text-blue-500">{selectedTherapist.therapist_ranks.name}</p>
                  )}
                  <p className="text-xs text-slate-400 mt-1">
                    出勤: {formatTime(selectedShift!.start_time)} 〜 {formatTime(selectedShift!.end_time)}
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-4 flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl bg-slate-100 flex-shrink-0 flex items-center justify-center">
                  <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <p className="font-bold text-slate-800">フリー（指名なし）</p>
                  <p className="text-xs text-slate-400 mt-0.5">セラピストはお任せします</p>
                  {currentShift && (
                    <p className="text-xs text-slate-400 mt-1">
                      受付時間: {formatTime(currentShift.start_time)} 〜 {formatTime(currentShift.end_time)}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* コース選択 */}
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-slate-700">コースを選択</h3>
              <div className="space-y-2">
                {courses.map(c => (
                  <button
                    key={c.id}
                    onClick={() => { setSelectedCourse(c); setSelectedStartTime('') }}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all text-left ${
                      selectedCourse?.id === c.id
                        ? 'border-blue-400 bg-blue-50'
                        : 'border-slate-200 bg-white hover:border-blue-300'
                    }`}
                  >
                    <div>
                      <p className={`font-medium text-sm ${selectedCourse?.id === c.id ? 'text-blue-700' : 'text-slate-700'}`}>{c.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{c.duration}分</p>
                    </div>
                    <p className={`font-bold text-sm ${selectedCourse?.id === c.id ? 'text-blue-600' : 'text-slate-600'}`}>
                      {formatPrice(c.base_price)}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* 開始時間選択 */}
            {selectedCourse && currentShift && (() => {
              const interval = selectedTherapist?.reservation_interval_minutes ?? systemIntervalMinutes
              const therapistReservations = isFreeReservation ? [] : existingReservations.filter(
                r => r.therapist_id === selectedTherapist!.id && r.date === currentShift.date
              )
              const now = new Date()
              const minAllowedTime = now.getTime() + 20 * 60 * 1000 // 20分後

              const shiftStartMin = timeToMinutes(currentShift.start_time)
              const shiftEndMin = timeToMinutesAbsolute(currentShift.end_time, currentShift.start_time)
              const totalMin = shiftEndMin - shiftStartMin

              // 5分刻みスロット生成
              const allSlots = generateSlots(currentShift.start_time, currentShift.end_time, selectedCourse.duration, 5)
              const slotsWithAvailability = allSlots.map(slot => {
                if (!isSlotAvailable(slot, selectedCourse.duration, therapistReservations, interval, currentShift.start_time)) {
                  return { time: slot, available: false }
                }
                const slotJstDate = getJstDateFromDateTime(currentShift.date, slot)
                if (slotJstDate.getTime() < minAllowedTime) {
                  return { time: slot, available: false }
                }
                return { time: slot, available: true }
              })
              const availableCount = slotsWithAvailability.filter(s => s.available).length
              const timelineSegs = getTimelineSegments(currentShift.start_time, currentShift.end_time, therapistReservations, interval)

              const handleTap = (clientX: number) => {
                if (!timelineRef.current) return
                const rect = timelineRef.current.getBoundingClientRect()
                const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
                const rawMin = shiftStartMin + ratio * totalMin
                const snapped = Math.round(rawMin / 5) * 5
                const th = Math.floor(snapped / 60)
                const tm = snapped % 60
                const timeStr = `${String(th).padStart(2, '0')}:${String(tm).padStart(2, '0')}`
                const slot = slotsWithAvailability.find(s => s.time === timeStr)
                if (slot?.available) {
                  setSelectedStartTime(timeStr)
                } else {
                  const snappedAbs = timeToMinutesAbsolute(timeStr, currentShift.start_time)
                  const nearest = [...slotsWithAvailability]
                    .filter(s => s.available)
                    .sort((a, b) => {
                      const da = Math.abs(timeToMinutesAbsolute(a.time, currentShift.start_time) - snappedAbs)
                      const db = Math.abs(timeToMinutesAbsolute(b.time, currentShift.start_time) - snappedAbs)
                      return da - db
                    })[0]
                  if (nearest) setSelectedStartTime(nearest.time)
                }
              }

              const adjustTime = (delta: number) => {
                if (!selectedStartTime) return
                const curr = timeToMinutesAbsolute(selectedStartTime, currentShift.start_time)
                const target = curr + delta
                const ah = Math.floor(target / 60)
                const am = target % 60
                const timeStr = `${String(ah).padStart(2, '0')}:${String(am).padStart(2, '0')}`
                const slot = slotsWithAvailability.find(s => s.time === timeStr)
                if (slot?.available) setSelectedStartTime(timeStr)
              }

              const selectedLeft = selectedStartTime
                ? ((timeToMinutesAbsolute(selectedStartTime, currentShift.start_time) - shiftStartMin) / totalMin) * 100
                : null
              const selectedWidth = (selectedCourse.duration / totalMin) * 100

              const shiftStartDate = getJstDateFromDateTime(currentShift.date, currentShift.start_time)
              const shiftEndDate = getJstDateFromDateTime(currentShift.date, currentShift.end_time)
              const totalShiftMin = (shiftEndDate.getTime() - shiftStartDate.getTime()) / (60 * 1000)
              const elapsedMin = (now.getTime() + 20 * 60 * 1000 - shiftStartDate.getTime()) / (60 * 1000)
              const pastEndPct = Math.min(100, Math.max(0, (elapsedMin / totalShiftMin) * 100))

              const hourLabels = (() => {
                const result: { label: string; leftPct: number }[] = []
                const startHr = Math.ceil(shiftStartMin / 60)
                const endHr = Math.floor(shiftEndMin / 60)
                const totalHours = totalMin / 60
                const step = totalHours > 12 ? 3 : totalHours > 6 ? 2 : 1
                for (let hr = startHr; hr <= endHr; hr++) {
                  if (hr % step !== 0) continue
                  const absMin = hr * 60
                  if (absMin > shiftStartMin && absMin < shiftEndMin) {
                    result.push({
                      label: `${String(hr).padStart(2, '0')}:00`,
                      leftPct: ((absMin - shiftStartMin) / totalMin) * 100,
                    })
                  }
                }
                return result
              })()

              return (
                <div className="space-y-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-700">開始時間を選択</h3>
                  </div>

                  {availableCount === 0 ? (
                    <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-4 text-center">
                      <p className="text-sm text-red-600 font-medium">このコースの空き枠がありません</p>
                      <p className="text-xs text-red-400 mt-1">他のコースをお試しください</p>
                    </div>
                  ) : (
                    <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-4">
                      {/* タイムライン概要 */}
                      <div className="select-none">
                        {/* 出勤時間ラベル */}
                        <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                          <span>{formatTime(currentShift.start_time)}</span>
                          <span>{formatTime(currentShift.end_time)}</span>
                        </div>

                        {/* 時刻ラベル行 */}
                        {hourLabels.length > 0 && (
                          <div className="relative h-3 mb-0.5">
                            {hourLabels.map(({ label, leftPct }) => (
                              <span
                                key={label}
                                className="absolute text-[9px] text-slate-400 -translate-x-1/2"
                                style={{ left: `${leftPct}%` }}
                              >
                                {label}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* タイムラインバー（概要表示・タップ可） */}
                        <div
                          ref={timelineRef}
                          className="relative rounded-xl overflow-hidden cursor-pointer active:opacity-80"
                          style={{ height: '36px' }}
                          onClick={e => handleTap(e.clientX)}
                          onTouchEnd={e => { if (e.changedTouches[0]) handleTap(e.changedTouches[0].clientX) }}
                        >
                          <div className="absolute inset-0 bg-emerald-100" />
                          {hourLabels.map(({ label, leftPct }) => (
                            <div
                              key={label}
                              className="absolute top-0 bottom-0 w-px bg-white/60"
                              style={{ left: `${leftPct}%` }}
                            />
                          ))}
                          {timelineSegs.map((seg, i) => (
                            <div
                              key={i}
                              className="absolute top-0 h-full bg-slate-300"
                              style={{ left: `${seg.left}%`, width: `${seg.width}%` }}
                            />
                          ))}
                          {pastEndPct > 0 && (
                            <div
                              className="absolute top-0 left-0 h-full bg-slate-400/60"
                              style={{ width: `${pastEndPct}%` }}
                            />
                          )}
                          {selectedLeft !== null && (
                            <div
                              className="absolute top-1 bottom-1 bg-[#789280] rounded-lg shadow-md flex items-center justify-center pointer-events-none"
                              style={{ left: `${selectedLeft}%`, width: `${Math.max(selectedWidth, 2)}%` }}
                            >
                              {selectedWidth > 8 && (
                                <span className="text-white text-[10px] font-bold truncate px-1">{selectedStartTime}</span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* 凡例 */}
                        <div className="flex items-center gap-3 mt-1.5">
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-2 rounded-sm bg-[#e2ebe6]" />
                            <span className="text-[10px] text-slate-500">予約可</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-2 rounded-sm bg-slate-300" />
                            <span className="text-[10px] text-slate-500">予約不可</span>
                          </div>
                          {selectedStartTime && (
                            <div className="flex items-center gap-1">
                              <div className="w-3 h-2 rounded-sm bg-[#789280]" />
                              <span className="text-[10px] text-slate-500">選択中</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 時間ボタングリッド */}
                      <div>
                        <p className="text-xs text-slate-500 mb-2">開始時間を選択（±5分で微調整できます）</p>
                        <div className="max-h-52 overflow-y-auto rounded-xl">
                          <div className="grid grid-cols-4 gap-2">
                            {slotsWithAvailability
                              .filter((s, _, arr) => {
                                const [h, m] = s.time.split(':').map(Number)
                                if (m % 30 === 0) return true

                                // 30分刻み以外の時間は、空き枠（available）の場合のみ候補にする
                                if (!s.available) return false

                                // かつ、前後30分以内に利用可能な30分刻みの枠がない場合のみ表示する
                                const timeInMins = h * 60 + m
                                const hasAvailable30MinNearby = arr.some(other => {
                                  const [oh, om] = other.time.split(':').map(Number)
                                  if (om % 30 !== 0) return false
                                  if (!other.available) return false
                                  const otherMins = oh * 60 + om
                                  return Math.abs(otherMins - timeInMins) <= 30
                                })

                                return !hasAvailable30MinNearby
                              })
                              .map(slot => (
                                <button
                                  key={slot.time}
                                  onClick={() => { if (slot.available) setSelectedStartTime(slot.time) }}
                                  disabled={!slot.available}
                                  className={`py-3 rounded-xl text-sm font-semibold transition-all ${
                                    selectedStartTime === slot.time
                                      ? 'bg-[#789280] text-white shadow-sm'
                                      : slot.available
                                      ? 'bg-[#f4f7f5] text-[#4a5c50] active:bg-[#e2ebe6]'
                                      : 'bg-slate-100 text-slate-300 cursor-not-allowed line-through'
                                  }`}
                                >
                                  {slot.time}
                                </button>
                              ))}
                          </div>
                        </div>
                      </div>

                      {/* 選択時間表示 + ±5分ボタン */}
                      <div className="flex items-center justify-center gap-4 py-1">
                        <button
                          onClick={() => adjustTime(-5)}
                          disabled={!selectedStartTime}
                          className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-[#f0f4f1] hover:text-[#4a5c50] disabled:opacity-30 transition-colors"
                          aria-label="-5分"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>

                        <div className="text-center min-w-[140px]">
                          {selectedStartTime ? (
                            <>
                              <p className="text-3xl font-black text-slate-800 tabular-nums leading-none">{selectedStartTime}</p>
                              <p className="text-xs text-slate-400 mt-1.5">〜 {endTime}（{selectedCourse.duration}分）</p>
                            </>
                          ) : (
                            <p className="text-sm text-slate-400">時間を選んでください</p>
                          )}
                        </div>

                        <button
                          onClick={() => adjustTime(5)}
                          disabled={!selectedStartTime}
                          className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-[#f0f4f1] hover:text-[#4a5c50] disabled:opacity-30 transition-colors"
                          aria-label="+5分"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}

            {/* 支払い方法 */}
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-slate-700">お支払い方法</h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setPaymentMethod('cash')}
                  className={`py-3 rounded-xl border text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                    paymentMethod === 'cash'
                      ? 'border-[#789280] bg-[#f0f4f1]/50 text-[#4a5c50]'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-[#789280]'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z" />
                  </svg>
                  現金
                </button>
                <button
                  onClick={() => setPaymentMethod('credit')}
                  className={`py-3 rounded-xl border text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                    paymentMethod === 'credit'
                      ? 'border-[#789280] bg-[#f0f4f1]/50 text-[#4a5c50]'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-[#789280]'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                  クレジット
                </button>
              </div>
            </div>

            <button
              onClick={handleDetailsNext}
              disabled={!selectedCourse || !selectedStartTime}
              className="w-full py-4 bg-[#789280] text-white rounded-2xl font-bold text-base transition-all hover:bg-[#5d7362] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              お客様情報の入力へ
            </button>
          </div>
        )}

        {/* Step 3: お客様情報 */}
        {step === 'customer' && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setStep('details')}
                className="w-9 h-9 bg-white rounded-full flex items-center justify-center border border-slate-200 text-slate-500 hover:border-[#789280]"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h2 className="text-xl font-bold text-slate-800">お客様情報</h2>
                <p className="text-sm text-slate-500">ご予約者の情報を入力してください</p>
              </div>
            </div>

            {allowNewCustomers === false && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-700 whitespace-pre-wrap leading-relaxed">
{`⚠️ 会員限定予約のお知らせ

当店は既存の会員様限定のWEB予約となっております。ご新規様のWEB予約は受け付けておりません。

※会員様で予約完了できない場合もお手数ですが、お電話、公式LINEにてお問合せください。`}
              </div>
            )}

            <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4">
              {([
                { key: 'name', label: 'お名前', placeholder: '山田 花子', type: 'text' },
                { key: 'furigana', label: 'フリガナ', placeholder: 'ヤマダ ハナコ', type: 'text' },
                { key: 'phone', label: '電話番号', placeholder: '090-1234-5678', type: 'tel' },
                { key: 'email', label: 'メールアドレス', placeholder: 'example@email.com', type: 'email' },
              ] as { key: keyof CustomerForm; label: string; placeholder: string; type: string }[]).map(field => (
                <div key={field.key}>
                  <label className="flex items-center text-sm font-medium text-slate-700 mb-1.5">
                    {field.label}
                    <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#f0f4f1] text-[#4a5c50]">必須</span>
                  </label>
                  <input
                    type={field.type}
                    value={customer[field.key]}
                    onChange={e => {
                      setCustomer(prev => ({ ...prev, [field.key]: e.target.value }))
                      if (validationErrors[field.key]) {
                        setValidationErrors(prev => ({ ...prev, [field.key]: undefined }))
                      }
                    }}
                    placeholder={field.placeholder}
                    className={`w-full px-4 py-3 bg-slate-50 border rounded-xl text-slate-800 placeholder-slate-300 outline-none transition-all focus:ring-2 focus:ring-[#789280]/50 ${
                      validationErrors[field.key] ? 'border-red-400' : 'border-slate-200'
                    }`}
                  />
                  {validationErrors[field.key] && (
                    <p className="text-red-500 text-xs mt-1">{validationErrors[field.key]}</p>
                  )}
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">その他ご希望</label>
                <textarea
                  value={customer.notes}
                  onChange={e => setCustomer(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="ご要望やご質問があればご記入ください"
                  rows={3}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-300 outline-none transition-all focus:ring-2 focus:ring-[#789280]/50 resize-none"
                />
              </div>
            </div>

            <button
              onClick={handleCustomerNext}
              className="w-full py-4 bg-[#789280] text-white rounded-2xl font-bold text-base transition-all hover:bg-[#5d7362]"
            >
              予約内容の確認へ
            </button>
          </div>
        )}

        {/* Step 4: 確認 */}
        {step === 'confirm' && (selectedTherapist !== null || isFreeReservation) && selectedCourse && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setStep('customer')}
                className="w-9 h-9 bg-white rounded-full flex items-center justify-center border border-slate-200 text-slate-500 hover:border-[#789280]"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h2 className="text-xl font-bold text-slate-800">予約内容の確認</h2>
                <p className="text-sm text-slate-500">内容をご確認ください</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">ご予約内容</p>
              </div>
              <div className="divide-y divide-slate-100">
                {[
                  { label: '日時', value: `${formatDate(currentShift?.date ?? selectedDate)} ${formatTime(selectedStartTime)} 〜 ${formatTime(endTime)}` },
                  { label: 'セラピスト', value: selectedTherapist?.name ?? 'フリー（指名なし）' },
                  { label: 'コース', value: `${selectedCourse.name}（${selectedCourse.duration}分）` },
                  { label: '料金', value: formatPrice(selectedCourse.base_price) },
                  { label: 'お支払い', value: paymentMethod === 'cash' ? '現金' : 'クレジットカード' },
                ].map(row => (
                  <div key={row.label} className="px-5 py-3 flex items-start justify-between gap-4">
                    <span className="text-sm text-slate-500 flex-shrink-0">{row.label}</span>
                    <span className="text-sm font-medium text-slate-800 text-right">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">お客様情報</p>
              </div>
              <div className="divide-y divide-slate-100">
                {[
                  { label: 'お名前', value: customer.name },
                  { label: 'フリガナ', value: customer.furigana },
                  { label: '電話番号', value: customer.phone },
                  { label: 'メール', value: customer.email },
                  ...(customer.notes ? [{ label: 'ご希望', value: customer.notes }] : []),
                ].map(row => (
                  <div key={row.label} className="px-5 py-3 flex items-start justify-between gap-4">
                    <span className="text-sm text-slate-500 flex-shrink-0">{row.label}</span>
                    <span className="text-sm font-medium text-slate-800 text-right break-all">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <p className="text-xs text-amber-700">
                ご予約は仮予約となります。店舗より確認のご連絡をお送りしてから正式に確定いたします。
              </p>
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full py-4 bg-[#789280] text-white rounded-2xl font-bold text-base transition-all hover:bg-[#5d7362] disabled:opacity-60"
            >
              {submitting ? '送信中...' : 'この内容で予約を申し込む'}
            </button>
          </div>
        )}

        {/* Step 5: 完了 */}
        {step === 'complete' && (
          <div className="flex flex-col items-center text-center py-16 space-y-6">
            <div className="w-20 h-20 bg-[#f0f4f1] rounded-full flex items-center justify-center">
              <svg className="w-10 h-10 text-[#789280]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-800">ご予約を受け付けました</h2>
              <p className="text-slate-500 mt-2 text-sm leading-relaxed">
                ありがとうございます。<br />
                店舗より確認のご連絡をお送りします。<br />
                しばらくお待ちください。
              </p>
            </div>
            {selectedCourse && (currentShift || isFreeReservation) && (
              <div className="bg-white rounded-2xl border border-slate-100 p-5 w-full text-left space-y-2">
                <p className="text-sm text-slate-500">{formatDate(currentShift?.date ?? selectedDate)} {formatTime(selectedStartTime)} 〜 {formatTime(endTime)}</p>
                <p className="font-bold text-slate-800">{selectedTherapist?.name ?? 'フリー（指名なし）'}</p>
                <p className="text-sm text-slate-600">{selectedCourse.name}（{selectedCourse.duration}分）</p>
              </div>
            )}
            <button
              onClick={() => {
                setStep('attendance')
                setSelectedTherapist(null)
                setSelectedShift(null)
                setSelectedCourse(null)
                setSelectedStartTime('')
                setIsFreeReservation(false)
                setCustomer({ name: '', furigana: '', phone: '', email: '', notes: '' })
              }}
              className="text-sm text-[#4a5c50] hover:underline font-semibold"
            >
              トップへ戻る
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
