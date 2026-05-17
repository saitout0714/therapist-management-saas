'use client'

import { useState, useEffect, useCallback } from 'react'
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

function generateSlots(shiftStart: string, shiftEnd: string, durationMin: number, intervalMin: number) {
  const slots: string[] = []
  let current = timeToMinutes(shiftStart)
  const end = timeToMinutes(shiftEnd)
  while (current + durationMin <= end) {
    const h = Math.floor(current / 60)
    const m = current % 60
    slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    current += intervalMin
  }
  return slots
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
            {selectedCourse && (
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-slate-700">開始時間を選択</h3>
                {(() => {
                  const interval = selectedTherapist.reservation_interval_minutes || 30
                  const slots = generateSlots(
                    selectedShift.start_time,
                    selectedShift.end_time,
                    selectedCourse.duration,
                    interval
                  )
                  return slots.length === 0 ? (
                    <p className="text-sm text-slate-400">利用可能な時間帯がありません</p>
                  ) : (
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                      {slots.map(slot => (
                        <button
                          key={slot}
                          onClick={() => setSelectedStartTime(slot)}
                          className={`py-2.5 rounded-xl text-sm font-medium transition-all ${
                            selectedStartTime === slot
                              ? 'bg-rose-500 text-white'
                              : 'bg-white border border-slate-200 text-slate-600 hover:border-rose-300'
                          }`}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  )
                })()}
              </div>
            )}

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
