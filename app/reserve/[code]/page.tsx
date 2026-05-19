'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'

type Shop = {
  id: string
  name: string
  short_name: string | null
  description: string | null
}

type Course = {
  id: string
  name: string
  duration: number
  base_price: number
}

type TherapistRank = { name: string }

type Therapist = {
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

type Shift = {
  id: string
  date: string
  start_time: string
  end_time: string
  therapists: Therapist | null
}

type ExistingReservation = {
  therapist_id: string
  date: string
  start_time: string
  end_time: string
  status: string
}

type Step = 'attendance' | 'details' | 'customer' | 'confirm' | 'complete'

type CustomerForm = {
  name: string
  furigana: string
  phone: string
  email: string
  notes: string
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
  const nh = Math.floor(total / 60) % 24
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
    const h = Math.floor(current / 60) % 24
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
      // 予約本体
      const resBodyEnd = Math.min(total, rEnd)
      if (resBodyEnd > clampedStart) {
        segs.push({ left: (clampedStart / total) * 100, width: ((resBodyEnd - clampedStart) / total) * 100, type: 'reserved' })
      }
      // インターバル部分
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
      <Image src={photos[index]} alt={name} fill className="object-cover" unoptimized />
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

export default function ReservePage() {
  const params = useParams()
  const code = params.code as string

  const [step, setStep] = useState<Step>('attendance')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [shop, setShop] = useState<Shop | null>(null)
  const [courses, setCourses] = useState<Course[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [existingReservations, setExistingReservations] = useState<ExistingReservation[]>([])
  const [systemIntervalMinutes, setSystemIntervalMinutes] = useState(20)

  const [selectedDate, setSelectedDate] = useState('')
  const [selectedTherapist, setSelectedTherapist] = useState<Therapist | null>(null)
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null)
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [selectedStartTime, setSelectedStartTime] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'credit'>('cash')
  const [customer, setCustomer] = useState<CustomerForm>({
    name: '', furigana: '', phone: '', email: '', notes: ''
  })
  const [validationErrors, setValidationErrors] = useState<Partial<CustomerForm>>({})
  const timelineRef = useRef<HTMLDivElement>(null)

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
      if (data.shifts.length > 0) {
        setSelectedDate(data.shifts[0].date)
      } else {
        const today = new Date().toISOString().split('T')[0]
        setSelectedDate(today)
      }
    } catch {
      setError('データの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [code])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  // 選択日のシフト一覧
  const todayShifts = shifts.filter(s => s.date === selectedDate)

  // 利用可能な日付一覧（シフトがある日）
  const availableDates = [...new Set(shifts.map(s => s.date))].sort()

  const endTime = selectedStartTime && selectedCourse
    ? addMinutes(selectedStartTime, selectedCourse.duration)
    : ''

  const handleSelectTherapist = (therapist: Therapist, shift: Shift) => {
    setSelectedTherapist(therapist)
    setSelectedShift(shift)
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
    if (!selectedTherapist || !selectedShift || !selectedCourse || !selectedStartTime) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/public/${code}/reserve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          therapist_id: selectedTherapist.id,
          date: selectedShift.date,
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-rose-50 to-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-rose-200 border-t-rose-500 rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (error && !shop) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-rose-50 to-white flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow p-8 max-w-sm w-full text-center">
          <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
    <div className="min-h-screen bg-gradient-to-b from-rose-50 to-white">
      {/* ヘッダー */}
      <header className="bg-white border-b border-rose-100 sticky top-0 z-10">
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
                    i < stepIndex ? 'bg-rose-500 text-white' :
                    i === stepIndex ? 'bg-rose-500 text-white' :
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

      <div className="max-w-2xl mx-auto px-4 py-6 pb-24">
        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-600 text-sm">{error}</div>
        )}

        {/* Step 1: 出勤情報 */}
        {step === 'attendance' && (
          <div className="space-y-5">
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
                        ? 'bg-rose-500 text-white'
                        : 'bg-white border border-slate-200 text-slate-600 hover:border-rose-300'
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
                      className="bg-white rounded-2xl border border-slate-100 overflow-hidden hover:border-rose-300 hover:shadow-md transition-all text-left group"
                    >
                      <div className="aspect-[3/4] bg-slate-100 relative overflow-hidden">
                        <PhotoCarousel photos={t.photos?.length ? t.photos : (t.photo_url ? [t.photo_url] : [])} name={t.name} />
                      </div>
                      <div className="p-3">
                        <p className="font-bold text-slate-800 text-sm truncate">{t.name}</p>
                        {t.therapist_ranks && (
                          <p className="text-xs text-rose-500 font-medium mt-0.5">{t.therapist_ranks.name}</p>
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
              </div>
            )}
          </div>
        )}

        {/* Step 2: 詳細選択 */}
        {step === 'details' && selectedTherapist && selectedShift && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setStep('attendance'); setSelectedTherapist(null); setSelectedShift(null) }}
                className="w-9 h-9 bg-white rounded-full flex items-center justify-center border border-slate-200 text-slate-500 hover:border-rose-300"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h2 className="text-xl font-bold text-slate-800">コース・時間の選択</h2>
                <p className="text-sm text-slate-500">{selectedTherapist.name} / {formatDate(selectedShift.date)}</p>
              </div>
            </div>

            {/* セラピスト情報カード */}
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
                  <p className="text-xs text-rose-500">{selectedTherapist.therapist_ranks.name}</p>
                )}
                <p className="text-xs text-slate-400 mt-1">
                  出勤: {formatTime(selectedShift.start_time)} 〜 {formatTime(selectedShift.end_time)}
                </p>
              </div>
            </div>

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
                        ? 'border-rose-400 bg-rose-50'
                        : 'border-slate-200 bg-white hover:border-rose-300'
                    }`}
                  >
                    <div>
                      <p className={`font-medium text-sm ${selectedCourse?.id === c.id ? 'text-rose-700' : 'text-slate-700'}`}>{c.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{c.duration}分</p>
                    </div>
                    <p className={`font-bold text-sm ${selectedCourse?.id === c.id ? 'text-rose-600' : 'text-slate-600'}`}>
                      {formatPrice(c.base_price)}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* 開始時間選択 */}
            {selectedCourse && (() => {
              const interval = selectedTherapist.reservation_interval_minutes ?? systemIntervalMinutes
              const therapistReservations = existingReservations.filter(
                r => r.therapist_id === selectedTherapist.id && r.date === selectedShift.date
              )
              const now = new Date()
              const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
              const isToday = selectedShift.date === todayStr
              const currentSimpleMin = now.getHours() * 60 + now.getMinutes()
              const shiftStartSimpleMin = timeToMinutes(selectedShift.start_time)
              const inOrNearShift = currentSimpleMin >= shiftStartSimpleMin - 60 || now.getHours() < 6
              const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
              const minStartAbsMin = (isToday && inOrNearShift)
                ? timeToMinutesAbsolute(currentTimeStr, selectedShift.start_time) + 20
                : -Infinity

              const shiftStartMin = timeToMinutes(selectedShift.start_time)
              const shiftEndMin = timeToMinutesAbsolute(selectedShift.end_time, selectedShift.start_time)
              const totalMin = shiftEndMin - shiftStartMin

              // 5分刻みスロット生成
              const allSlots = generateSlots(selectedShift.start_time, selectedShift.end_time, selectedCourse.duration, 5)
              const slotsWithAvailability = allSlots.map(slot => {
                if (!isSlotAvailable(slot, selectedCourse.duration, therapistReservations, interval, selectedShift.start_time)) {
                  return { time: slot, available: false }
                }
                if (minStartAbsMin > -Infinity && timeToMinutesAbsolute(slot, selectedShift.start_time) < minStartAbsMin) {
                  return { time: slot, available: false }
                }
                return { time: slot, available: true }
              })
              const availableCount = slotsWithAvailability.filter(s => s.available).length
              const timelineSegs = getTimelineSegments(selectedShift.start_time, selectedShift.end_time, therapistReservations, interval)

              const handleTap = (clientX: number) => {
                if (!timelineRef.current) return
                const rect = timelineRef.current.getBoundingClientRect()
                const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
                const rawMin = shiftStartMin + ratio * totalMin
                const snapped = Math.round(rawMin / 5) * 5
                const th = Math.floor(snapped / 60) % 24
                const tm = snapped % 60
                const timeStr = `${String(th).padStart(2, '0')}:${String(tm).padStart(2, '0')}`
                const slot = slotsWithAvailability.find(s => s.time === timeStr)
                if (slot?.available) {
                  setSelectedStartTime(timeStr)
                } else {
                  const snappedAbs = timeToMinutesAbsolute(timeStr, selectedShift.start_time)
                  const nearest = [...slotsWithAvailability]
                    .filter(s => s.available)
                    .sort((a, b) => {
                      const da = Math.abs(timeToMinutesAbsolute(a.time, selectedShift.start_time) - snappedAbs)
                      const db = Math.abs(timeToMinutesAbsolute(b.time, selectedShift.start_time) - snappedAbs)
                      return da - db
                    })[0]
                  if (nearest) setSelectedStartTime(nearest.time)
                }
              }

              const adjustTime = (delta: number) => {
                if (!selectedStartTime) return
                const curr = timeToMinutesAbsolute(selectedStartTime, selectedShift.start_time)
                const target = curr + delta
                const ah = Math.floor(target / 60) % 24
                const am = target % 60
                const timeStr = `${String(ah).padStart(2, '0')}:${String(am).padStart(2, '0')}`
                const slot = slotsWithAvailability.find(s => s.time === timeStr)
                if (slot?.available) setSelectedStartTime(timeStr)
              }

              const selectedLeft = selectedStartTime
                ? ((timeToMinutesAbsolute(selectedStartTime, selectedShift.start_time) - shiftStartMin) / totalMin) * 100
                : null
              const selectedWidth = (selectedCourse.duration / totalMin) * 100

              const pastEndPct = (isToday && inOrNearShift && minStartAbsMin > -Infinity)
                ? Math.min(100, Math.max(0, ((minStartAbsMin - shiftStartMin) / totalMin) * 100))
                : 0

              const hourLabels = (() => {
                const result: { label: string; leftPct: number }[] = []
                const startHr = Math.ceil(shiftStartMin / 60)
                const endHr = Math.floor(shiftEndMin / 60)
                for (let hr = startHr; hr <= endHr; hr++) {
                  const absMin = hr * 60
                  if (absMin > shiftStartMin && absMin < shiftEndMin) {
                    result.push({
                      label: `${String(hr % 24).padStart(2, '0')}:00`,
                      leftPct: ((absMin - shiftStartMin) / totalMin) * 100,
                    })
                  }
                }
                return result
              })()

              return (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-700">開始時間を選択</h3>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${availableCount > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'}`}>
                      空き {availableCount} 枠
                    </span>
                  </div>

                  {availableCount === 0 ? (
                    <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-4 text-center">
                      <p className="text-sm text-rose-600 font-medium">このコースの空き枠がありません</p>
                      <p className="text-xs text-rose-400 mt-1">他のコースをお試しください</p>
                    </div>
                  ) : (
                    <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-4">
                      <p className="text-xs text-slate-400 text-center">バーをタップ・クリックして開始時間を選択（5分刻み）</p>

                      <div className="select-none">
                        {/* 出勤時間ラベル */}
                        <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                          <span>{formatTime(selectedShift.start_time)}</span>
                          <span>{formatTime(selectedShift.end_time)}</span>
                        </div>

                        {/* 時刻ラベル行 */}
                        {hourLabels.length > 0 && (
                          <div className="relative h-3 mb-0.5 overflow-hidden">
                            {hourLabels.map(({ label, leftPct }) => (
                              <span
                                key={label}
                                className="absolute text-[9px] text-slate-300 -translate-x-1/2"
                                style={{ left: `${leftPct}%` }}
                              >
                                {label}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* タイムラインバー（タップ可） */}
                        <div
                          ref={timelineRef}
                          className="relative rounded-xl overflow-hidden cursor-pointer active:opacity-80"
                          style={{ height: '48px' }}
                          onClick={e => handleTap(e.clientX)}
                          onTouchEnd={e => { if (e.changedTouches[0]) handleTap(e.changedTouches[0].clientX) }}
                        >
                          {/* 背景（予約可） */}
                          <div className="absolute inset-0 bg-emerald-100" />

                          {/* 時刻目盛り線 */}
                          {hourLabels.map(({ label, leftPct }) => (
                            <div
                              key={label}
                              className="absolute top-0 bottom-0 w-px bg-white/60"
                              style={{ left: `${leftPct}%` }}
                            />
                          ))}

                          {/* 予約不可ゾーン */}
                          {timelineSegs.map((seg, i) => (
                            <div
                              key={i}
                              className="absolute top-0 h-full bg-slate-300"
                              style={{ left: `${seg.left}%`, width: `${seg.width}%` }}
                            />
                          ))}

                          {/* 過去・受付不可ゾーン */}
                          {pastEndPct > 0 && (
                            <div
                              className="absolute top-0 left-0 h-full bg-slate-400/60"
                              style={{ width: `${pastEndPct}%` }}
                            />
                          )}

                          {/* 選択中スロット */}
                          {selectedLeft !== null && (
                            <div
                              className="absolute top-1.5 bottom-1.5 bg-rose-500 rounded-lg shadow-md flex items-center justify-center pointer-events-none"
                              style={{ left: `${selectedLeft}%`, width: `${Math.max(selectedWidth, 2)}%` }}
                            >
                              {selectedWidth > 8 && (
                                <span className="text-white text-[10px] font-bold truncate px-1">{selectedStartTime}</span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* 凡例 */}
                        <div className="flex items-center gap-3 mt-2">
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
                              <div className="w-3 h-2 rounded-sm bg-rose-500" />
                              <span className="text-[10px] text-slate-500">選択中</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 選択時間表示 + ±5分ボタン */}
                      <div className="flex items-center justify-center gap-4 py-1">
                        <button
                          onClick={() => adjustTime(-5)}
                          disabled={!selectedStartTime}
                          className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-rose-100 hover:text-rose-600 disabled:opacity-30 transition-colors"
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
                            <p className="text-sm text-slate-400">バーをタップして選択</p>
                          )}
                        </div>

                        <button
                          onClick={() => adjustTime(5)}
                          disabled={!selectedStartTime}
                          className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-rose-100 hover:text-rose-600 disabled:opacity-30 transition-colors"
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
                      ? 'border-rose-400 bg-rose-50 text-rose-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-rose-300'
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
                      ? 'border-rose-400 bg-rose-50 text-rose-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-rose-300'
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
              className="w-full py-4 bg-rose-500 text-white rounded-2xl font-bold text-base transition-all hover:bg-rose-600 disabled:opacity-40 disabled:cursor-not-allowed"
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
                className="w-9 h-9 bg-white rounded-full flex items-center justify-center border border-slate-200 text-slate-500 hover:border-rose-300"
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
                    <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-600">必須</span>
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
                    className={`w-full px-4 py-3 bg-slate-50 border rounded-xl text-slate-800 placeholder-slate-300 outline-none transition-all focus:ring-2 focus:ring-rose-400/50 ${
                      validationErrors[field.key] ? 'border-rose-400' : 'border-slate-200'
                    }`}
                  />
                  {validationErrors[field.key] && (
                    <p className="text-rose-500 text-xs mt-1">{validationErrors[field.key]}</p>
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
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-300 outline-none transition-all focus:ring-2 focus:ring-rose-400/50 resize-none"
                />
              </div>
            </div>

            <button
              onClick={handleCustomerNext}
              className="w-full py-4 bg-rose-500 text-white rounded-2xl font-bold text-base transition-all hover:bg-rose-600"
            >
              予約内容の確認へ
            </button>
          </div>
        )}

        {/* Step 4: 確認 */}
        {step === 'confirm' && selectedTherapist && selectedShift && selectedCourse && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setStep('customer')}
                className="w-9 h-9 bg-white rounded-full flex items-center justify-center border border-slate-200 text-slate-500 hover:border-rose-300"
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
                  { label: '日時', value: `${formatDate(selectedShift.date)} ${formatTime(selectedStartTime)} 〜 ${formatTime(endTime)}` },
                  { label: 'セラピスト', value: selectedTherapist.name },
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
              className="w-full py-4 bg-rose-500 text-white rounded-2xl font-bold text-base transition-all hover:bg-rose-600 disabled:opacity-60"
            >
              {submitting ? '送信中...' : 'この内容で予約を申し込む'}
            </button>
          </div>
        )}

        {/* Step 5: 完了 */}
        {step === 'complete' && (
          <div className="flex flex-col items-center text-center py-16 space-y-6">
            <div className="w-20 h-20 bg-rose-100 rounded-full flex items-center justify-center">
              <svg className="w-10 h-10 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
            {selectedShift && selectedCourse && selectedTherapist && (
              <div className="bg-white rounded-2xl border border-slate-100 p-5 w-full text-left space-y-2">
                <p className="text-sm text-slate-500">{formatDate(selectedShift.date)} {formatTime(selectedStartTime)} 〜 {formatTime(endTime)}</p>
                <p className="font-bold text-slate-800">{selectedTherapist.name}</p>
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
                setCustomer({ name: '', furigana: '', phone: '', email: '', notes: '' })
              }}
              className="text-sm text-rose-500 hover:underline"
            >
              トップへ戻る
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
