'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
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
  shop: Shop
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

export default function ReserveClient({ initialData }: { initialData: InitialReserveData }) {
  const { code } = initialData
  const searchParams = useSearchParams()
  const isEmbed = searchParams.get('embed') === '1'

  const [step, setStep] = useState<Step>('attendance')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [shop, setShop] = useState<Shop | null>(initialData.shop)
  const [courses, setCourses] = useState<Course[]>(initialData.courses)
  const [shifts, setShifts] = useState<Shift[]>(initialData.shifts)
  const [existingReservations, setExistingReservations] = useState<ExistingReservation[]>(initialData.reservations)
  const [systemIntervalMinutes, setSystemIntervalMinutes] = useState(initialData.system_interval_minutes)

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

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/public/${code}`)
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
    } catch {
      setError('データの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [code])

  // 選択日のシフト一覧
  const todayShifts = shifts.filter(s => s.date === selectedDate)

  // 利用可能な日付一覧（シフトがある日）
  const availableDates = [...new Set(shifts.map(s => s.date))].sort()

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

  if (loading) {
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

  return (
    <div ref={mainRef} className="min-h-screen bg-white">
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
            {initialData.allow_new_customers === false && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-sm space-y-1">
                <p className="font-bold">📢 【会員様限定】WEB予約について</p>
                <p>現在、新規のお客様のWEB予約は受け付けておりません。</p>
                <p>既存の会員様のみご利用いただけます。ご新規様はお電話または公式LINEよりお問い合わせください。</p>
              </div>
            )}
            <div>
              <h2 className="text-xl font-bold text-slate-800">出勤情報</h2>
              <p className="text-sm text-slate-500 mt-1">ご希望のセラピストをお選びください</p>
            </div>

            {/* 日付タブ */}
            {availableDates.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                {availableDates.map(date => (
                  <button
                    key={date}
                    onClick={() => setSelectedDate(date)}
                    className={`flex-shrink-0 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                      selectedDate === date
                        ? 'bg-blue-500 text-white'
                        : 'bg-white border border-slate-200 text-slate-600 hover:border-blue-300'
                    }`}
                  >
                    {formatDate(date)}
                  </button>
                ))}
              </div>
            )}

            {todayShifts.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center">
                <p className="text-slate-400 text-sm">本日の出勤情報はありません</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {todayShifts.map(shift => {
                  const t = shift.therapists
                  if (!t) return null
                  return (
                    <button
                      key={shift.id}
                      onClick={() => handleSelectTherapist(t, shift)}
                      className="bg-white rounded-2xl border border-slate-100 overflow-hidden hover:border-blue-300 hover:shadow-md transition-all text-left group"
                    >
                      <div className="aspect-[3/4] bg-slate-100 relative overflow-hidden">
                        <PhotoCarousel photos={t.photos?.length ? t.photos : (t.photo_url ? [t.photo_url] : [])} name={t.name} />
                      </div>
                      <div className="p-3">
                        <p className="font-bold text-slate-800 text-sm truncate">{t.name}</p>
                        {t.therapist_ranks && (
                          <p className="text-xs text-blue-500 font-medium mt-0.5">{t.therapist_ranks.name}</p>
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
                    </button>
                  )
                })}
                {/* フリー（指名なし）カード */}
                <button
                  onClick={handleSelectFree}
                  className="bg-white rounded-2xl border border-dashed border-slate-200 overflow-hidden hover:border-blue-300 hover:shadow-md transition-all text-left group"
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
                </button>
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
              const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
              const isToday = currentShift.date === todayStr
              const currentSimpleMin = now.getHours() * 60 + now.getMinutes()
              const shiftStartSimpleMin = timeToMinutes(currentShift.start_time)
              const inOrNearShift = currentSimpleMin >= shiftStartSimpleMin - 60 || now.getHours() < 6
              const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
              const minStartAbsMin = (isToday && inOrNearShift)
                ? timeToMinutesAbsolute(currentTimeStr, currentShift.start_time) + 20
                : -Infinity

              const shiftStartMin = timeToMinutes(currentShift.start_time)
              const shiftEndMin = timeToMinutesAbsolute(currentShift.end_time, currentShift.start_time)
              const totalMin = shiftEndMin - shiftStartMin

              // 5分刻みスロット生成
              const allSlots = generateSlots(currentShift.start_time, currentShift.end_time, selectedCourse.duration, 5)
              const slotsWithAvailability = allSlots.map(slot => {
                if (!isSlotAvailable(slot, selectedCourse.duration, therapistReservations, interval, currentShift.start_time)) {
                  return { time: slot, available: false }
                }
                if (minStartAbsMin > -Infinity && timeToMinutesAbsolute(slot, currentShift.start_time) < minStartAbsMin) {
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

              const pastEndPct = (isToday && inOrNearShift && minStartAbsMin > -Infinity)
                ? Math.min(100, Math.max(0, ((minStartAbsMin - shiftStartMin) / totalMin) * 100))
                : 0

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
                              className="absolute top-1 bottom-1 bg-blue-500 rounded-lg shadow-md flex items-center justify-center pointer-events-none"
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
                            <div className="w-3 h-2 rounded-sm bg-emerald-200" />
                            <span className="text-[10px] text-slate-500">予約可</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-2 rounded-sm bg-slate-300" />
                            <span className="text-[10px] text-slate-500">予約不可</span>
                          </div>
                          {selectedStartTime && (
                            <div className="flex items-center gap-1">
                              <div className="w-3 h-2 rounded-sm bg-blue-500" />
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
                                      ? 'bg-blue-500 text-white shadow-sm'
                                      : slot.available
                                      ? 'bg-emerald-50 text-slate-700 active:bg-emerald-200'
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
                          className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-blue-100 hover:text-blue-600 disabled:opacity-30 transition-colors"
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
                          className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-blue-100 hover:text-blue-600 disabled:opacity-30 transition-colors"
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
                      ? 'border-blue-400 bg-blue-50 text-blue-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300'
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
                      ? 'border-blue-400 bg-blue-50 text-blue-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300'
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
              className="w-full py-4 bg-blue-500 text-white rounded-2xl font-bold text-base transition-all hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed"
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
                className="w-9 h-9 bg-white rounded-full flex items-center justify-center border border-slate-200 text-slate-500 hover:border-blue-300"
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

            {initialData.allow_new_customers === false && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-700 space-y-1">
                <p className="font-bold">⚠️ 会員限定予約のお知らせ</p>
                <p>当店は既存の会員様限定のWEB予約となっております。ご新規様のWEB予約は受け付けておりません。</p>
                <p className="text-xs text-red-500">※会員様で電話番号が登録されていない場合も予約が完了できない場合がございます。その際はお手数ですが、店舗へ直接ご連絡ください。</p>
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
                    <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-600">必須</span>
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
                    className={`w-full px-4 py-3 bg-slate-50 border rounded-xl text-slate-800 placeholder-slate-300 outline-none transition-all focus:ring-2 focus:ring-blue-400/50 ${
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
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-300 outline-none transition-all focus:ring-2 focus:ring-blue-400/50 resize-none"
                />
              </div>
            </div>

            <button
              onClick={handleCustomerNext}
              className="w-full py-4 bg-blue-500 text-white rounded-2xl font-bold text-base transition-all hover:bg-blue-600"
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
                className="w-9 h-9 bg-white rounded-full flex items-center justify-center border border-slate-200 text-slate-500 hover:border-blue-300"
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
              className="w-full py-4 bg-blue-500 text-white rounded-2xl font-bold text-base transition-all hover:bg-blue-600 disabled:opacity-60"
            >
              {submitting ? '送信中...' : 'この内容で予約を申し込む'}
            </button>
          </div>
        )}

        {/* Step 5: 完了 */}
        {step === 'complete' && (
          <div className="flex flex-col items-center text-center py-16 space-y-6">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center">
              <svg className="w-10 h-10 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
              className="text-sm text-blue-500 hover:underline"
            >
              トップへ戻る
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
