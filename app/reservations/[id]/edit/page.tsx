'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useShop } from '@/app/contexts/ShopContext'
import { useRouter, useParams, useSearchParams } from 'next/navigation'

type Customer = {
  id: string
  name: string
  email: string | null
  phone: string | null
}

type Course = {
  id: string
  name: string
  duration: number
  base_price: number
}

type Option = {
  id: string
  name: string
  duration: number
  price: number
}

type Therapist = {
  id: string
  name: string
}

type TherapistPricing = {
  id: string
  therapist_id: string
  nomination_fee: number
  confirmed_nomination_fee: number
  princess_reservation_fee: number
}

type SystemSettings = {
  id: string
  default_nomination_fee: number
  default_confirmed_nomination_fee: number
  default_princess_reservation_fee: number
}

type ReservationOptionRow = {
  option_id: string
}

export default function EditReservationPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const reservationId = params.id as string
  const fromPage = searchParams.get('from')
  const { selectedShop } = useShop()

  const [loading, setLoading] = useState(true)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [options, setOptions] = useState<Option[]>([])
  const [therapists, setTherapists] = useState<Therapist[]>([])
  const [therapistPricings, setTherapistPricings] = useState<TherapistPricing[]>([])
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null)

  const [formData, setFormData] = useState({
    customer_id: '',
    date: '',
    start_time: '',
    course_id: '',
    therapist_id: '',
    designation_type: 'free' as 'free' | 'nomination' | 'confirmed' | 'princess',
    selected_options: [] as string[],
    discount_amount: 0,
    discount_reason: '',
    notes: '',
    status: 'confirmed' as 'pending' | 'confirmed' | 'cancelled',
  })

  const [calculatedPrice, setCalculatedPrice] = useState({
    basePrice: 0,
    optionsPrice: 0,
    nominationFee: 0,
    discountAmount: 0,
    totalPrice: 0,
    duration: 0,
  })
  const [designationSearchLoading, setDesignationSearchLoading] = useState(false)

  useEffect(() => {
    fetchInitialData()
  }, [selectedShop])

  useEffect(() => {
    calculatePrice()
  }, [formData, courses, options, therapistPricings, systemSettings])

  const fetchInitialData = async () => {
    if (!selectedShop) return
    try {
      const [customersRes, coursesRes, optionsRes, therapistsRes, pricingRes, settingsRes, reservationRes] = await Promise.all([
        supabase.from('customers').select('id, name, email, phone').eq('shop_id', selectedShop.id).order('name'),
        supabase.from('courses').select('*').eq('shop_id', selectedShop.id).eq('is_active', true).order('display_order'),
        supabase.from('options').select('*').eq('shop_id', selectedShop.id).eq('is_active', true).order('display_order'),
        supabase.from('therapists').select('id, name').eq('shop_id', selectedShop.id).order('name'),
        supabase.from('therapist_pricing').select('*'),
        supabase.from('system_settings').select('*').order('created_at', { ascending: false }).limit(1),
        supabase.from('reservations').select('*, reservation_options(option_id)').eq('id', reservationId).eq('shop_id', selectedShop.id).single(),
      ])

      if (customersRes.error) throw customersRes.error
      if (coursesRes.error) throw coursesRes.error
      if (optionsRes.error) throw optionsRes.error
      if (therapistsRes.error) throw therapistsRes.error
      if (pricingRes.error) throw pricingRes.error
      if (settingsRes.error) throw settingsRes.error
      if (reservationRes.error) throw reservationRes.error

      setCustomers(customersRes.data || [])
      setCourses(coursesRes.data || [])
      setOptions(optionsRes.data || [])
      setTherapists(therapistsRes.data || [])
      setTherapistPricings(pricingRes.data || [])
      setSystemSettings(settingsRes.data?.[0] || null)

      const reservation = reservationRes.data
      const selectedOptions = (reservation.reservation_options as ReservationOptionRow[] | undefined)?.map((ro) => ro.option_id) || []

      setFormData({
        customer_id: reservation.customer_id,
        date: reservation.date,
        start_time: reservation.start_time,
        course_id: reservation.course_id,
        therapist_id: reservation.therapist_id,
        designation_type: reservation.designation_type,
        selected_options: selectedOptions,
        discount_amount: reservation.discount_amount || 0,
        discount_reason: '',
        notes: reservation.notes || '',
        status: reservation.status,
      })
    } catch (error) {
      console.error('データの取得に失敗:', error)
      alert('データの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const calculatePrice = () => {
    const selectedCourse = courses.find(c => c.id === formData.course_id)
    const therapistPricing = therapistPricings.find(p => p.therapist_id === formData.therapist_id)

    const basePrice = selectedCourse?.base_price || 0
    let optionsPrice = 0
    let duration = selectedCourse?.duration || 0

    formData.selected_options.forEach(optionId => {
      const option = options.find(o => o.id === optionId)
      if (option) {
        optionsPrice += option.price
        duration += option.duration
      }
    })

    const defaultNominationFee = systemSettings?.default_nomination_fee || 0
    const defaultConfirmedFee = systemSettings?.default_confirmed_nomination_fee || 0
    const defaultPrincessFee = systemSettings?.default_princess_reservation_fee || 0
    const resolveFee = (therapistFee: number | null | undefined, defaultFee: number) =>
      therapistFee && therapistFee > 0 ? therapistFee : defaultFee

    let nominationFee = 0
    if (formData.designation_type === 'nomination') {
      nominationFee = resolveFee(therapistPricing?.nomination_fee, defaultNominationFee)
    } else if (formData.designation_type === 'confirmed') {
      nominationFee = resolveFee(therapistPricing?.confirmed_nomination_fee, defaultConfirmedFee)
    } else if (formData.designation_type === 'princess') {
      nominationFee = resolveFee(therapistPricing?.princess_reservation_fee, defaultPrincessFee)
    }

    const totalPrice = basePrice + optionsPrice + nominationFee - formData.discount_amount

    setCalculatedPrice({
      basePrice,
      optionsPrice,
      nominationFee,
      discountAmount: formData.discount_amount,
      totalPrice: Math.max(0, totalPrice),
      duration,
    })
  }

  const handleDesignationSearch = async () => {
    if (!formData.customer_id || !formData.therapist_id || !selectedShop) {
      alert('お客様と担当セラピストを選択してください')
      return
    }

    try {
      setDesignationSearchLoading(true)
      const { data, error } = await supabase
        .from('reservations')
        .select('id')
        .eq('customer_id', formData.customer_id)
        .eq('therapist_id', formData.therapist_id)
        .eq('shop_id', selectedShop.id)
        .neq('id', reservationId)
        .limit(1)

      if (error) throw error

      if (data && data.length > 0) {
        setFormData((prev) => ({ ...prev, designation_type: 'confirmed' }))
      } else {
        setFormData((prev) => ({ ...prev, designation_type: 'nomination' }))
      }
    } catch (error) {
      console.error('指名判定の検索に失敗:', error)
      alert('指名判定の検索に失敗しました')
    } finally {
      setDesignationSearchLoading(false)
    }
  }

  const handleOptionToggle = (optionId: string) => {
    const newSelected = formData.selected_options.includes(optionId)
      ? formData.selected_options.filter(id => id !== optionId)
      : [...formData.selected_options, optionId]

    setFormData({ ...formData, selected_options: newSelected })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.customer_id || !formData.course_id || !formData.therapist_id) {
      alert('必須項目を入力してください')
      return
    }

    if (!selectedShop) {
      alert('店舗を選択してください')
      return
    }

    try {
      const startDate = new Date(`${formData.date}T${formData.start_time}`)
      const endDate = new Date(startDate.getTime() + calculatedPrice.duration * 60000)
      const endTime = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`

      const { error } = await supabase
        .from('reservations')
        .update({
          customer_id: formData.customer_id,
          therapist_id: formData.therapist_id,
          course_id: formData.course_id,
          date: formData.date,
          start_time: formData.start_time,
          end_time: endTime,
          base_price: calculatedPrice.basePrice,
          options_price: calculatedPrice.optionsPrice,
          nomination_fee: calculatedPrice.nominationFee,
          total_price: calculatedPrice.totalPrice,
          discount_amount: formData.discount_amount,
          designation_type: formData.designation_type,
          notes: formData.notes,
          status: formData.status,
        })
        .eq('id', reservationId)

      if (error) throw error

      // 既存のオプションを削除して再登録
      await supabase.from('reservation_options').delete().eq('reservation_id', reservationId)

      if (formData.selected_options.length > 0) {
        const optionInserts = formData.selected_options.map(optionId => {
          const option = options.find(o => o.id === optionId)
          return {
            reservation_id: reservationId,
            option_id: optionId,
            price: option?.price || 0,
          }
        })

        await supabase.from('reservation_options').insert(optionInserts)
      }

      alert('予約を更新しました')

      // 遷移元に応じて戻る先を変更
      if (fromPage === 'shifts') {
        router.push('/shifts')
      } else {
        router.push('/reservations')
      }
    } catch (error) {
      console.error('予約の更新に失敗:', error)
      alert('予約の更新に失敗しました')
    }
  }

  if (loading) {
    return <div className="p-4 md:p-8">読み込み中...</div>
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-800 tracking-tight mb-8">予約編集</h1>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        <div className="lg:col-span-2 space-y-6 lg:space-y-8">
          {/* お客様情報 */}
          <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center">
              <span className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mr-3">1</span>
              お客様情報
            </h2>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">お客様名 <span className="text-rose-500">*</span></label>
              <select
                value={formData.customer_id}
                onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                required
              >
                <option value="">選択してください</option>
                {customers.map(customer => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name} {customer.phone && `(${customer.phone})`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 日時情報 */}
          <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center">
              <span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mr-3">2</span>
              日時
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">日付 <span className="text-rose-500">*</span></label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">開始時刻 <span className="text-rose-500">*</span></label>
                <div className="flex gap-2">
                  <select
                    value={formData.start_time.split(':')[0] || ''}
                    onChange={(e) => {
                      const hour = e.target.value;
                      const minute = formData.start_time.split(':')[1] || '00';
                      setFormData({ ...formData, start_time: `${hour}:${minute}` });
                    }}
                    className="w-1/2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                    required
                  >
                    <option value="">時</option>
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={String(i).padStart(2, '0')}>
                        {String(i).padStart(2, '0')}時
                      </option>
                    ))}
                  </select>
                  <select
                    value={formData.start_time.split(':')[1] || ''}
                    onChange={(e) => {
                      const hour = formData.start_time.split(':')[0] || '00';
                      const minute = e.target.value;
                      setFormData({ ...formData, start_time: `${hour}:${minute}` });
                    }}
                    className="w-1/2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                    required
                  >
                    <option value="">分</option>
                    {Array.from({ length: 12 }, (_, i) => {
                      const min = i * 5;
                      return (
                        <option key={min} value={String(min).padStart(2, '0')}>
                          {String(min).padStart(2, '0')}分
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* コース情報 */}
          <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center">
              <span className="w-8 h-8 rounded-lg bg-pink-50 text-pink-600 flex items-center justify-center mr-3">3</span>
              コース
            </h2>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">コース選択 <span className="text-rose-500">*</span></label>
              <select
                value={formData.course_id}
                onChange={(e) => setFormData({ ...formData, course_id: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                required
              >
                <option value="">選択してください</option>
                {courses.map(course => (
                  <option key={course.id} value={course.id}>
                    {course.name} - {course.duration}分 ¥{course.base_price.toLocaleString()}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* オプション選択 */}
          <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center">
              <span className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center mr-3">4</span>
              オプション
            </h2>
            {options.length === 0 ? (
              <p className="text-slate-500 text-sm bg-slate-50 p-4 rounded-xl">オプションがありません</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {options.map(option => (
                  <label key={option.id} className={`flex items-center p-4 border rounded-xl cursor-pointer transition-all ${formData.selected_options.includes(option.id) ? 'bg-indigo-50/50 border-indigo-200' : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}>
                    <input
                      type="checkbox"
                      checked={formData.selected_options.includes(option.id)}
                      onChange={() => handleOptionToggle(option.id)}
                      className="w-5 h-5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                    />
                    <div className="ml-3 flex-1">
                      <div className="font-bold text-slate-800">{option.name}</div>
                      <div className="text-sm text-slate-500 flex items-center justify-between mt-1">
                        {option.duration > 0 ? <span>+{option.duration}分</span> : <span></span>}
                        <span className="font-bold text-slate-700">¥{option.price.toLocaleString()}</span>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* セラピスト情報 */}
          <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center">
              <span className="w-8 h-8 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center mr-3">5</span>
              担当セラピスト
            </h2>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">担当するセラピスト <span className="text-rose-500">*</span></label>
                <select
                  value={formData.therapist_id}
                  onChange={(e) => setFormData({ ...formData, therapist_id: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                  required
                >
                  <option value="">選択してください</option>
                  {therapists.map(therapist => (
                    <option key={therapist.id} value={therapist.id}>
                      {therapist.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-semibold text-slate-700">指名タイプ <span className="text-rose-500">*</span></label>
                  <button
                    type="button"
                    onClick={handleDesignationSearch}
                    disabled={designationSearchLoading}
                    className="px-4 py-1.5 text-sm font-medium bg-indigo-50 text-indigo-600 rounded-full hover:bg-indigo-100 disabled:opacity-50 transition-colors"
                  >
                    {designationSearchLoading ? '検索中...' : '履歴から自動判定する'}
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <label className={`flex flex-col items-center justify-center p-3 sm:p-4 border rounded-xl cursor-pointer transition-all text-center ${formData.designation_type === 'free' ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                    <input
                      type="radio"
                      name="designation"
                      value="free"
                      checked={formData.designation_type === 'free'}
                      onChange={() => setFormData({ ...formData, designation_type: 'free' })}
                      className="sr-only"
                    />
                    <span className="font-bold text-sm">フリー</span>
                    <span className={`text-xs mt-1 ${formData.designation_type === 'free' ? 'text-indigo-100' : 'text-slate-500'}`}>指名料なし</span>
                  </label>
                  <label className={`flex flex-col items-center justify-center p-3 sm:p-4 border rounded-xl cursor-pointer transition-all text-center ${formData.designation_type === 'nomination' ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                    <input
                      type="radio"
                      name="designation"
                      value="nomination"
                      checked={formData.designation_type === 'nomination'}
                      onChange={() => setFormData({ ...formData, designation_type: 'nomination' })}
                      className="sr-only"
                    />
                    <span className="font-bold text-sm">指名</span>
                  </label>
                  <label className={`flex flex-col items-center justify-center p-3 sm:p-4 border rounded-xl cursor-pointer transition-all text-center ${formData.designation_type === 'confirmed' ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                    <input
                      type="radio"
                      name="designation"
                      value="confirmed"
                      checked={formData.designation_type === 'confirmed'}
                      onChange={() => setFormData({ ...formData, designation_type: 'confirmed' })}
                      className="sr-only"
                    />
                    <span className="font-bold text-sm">本指名</span>
                  </label>
                  <label className={`flex flex-col items-center justify-center p-3 sm:p-4 border rounded-xl cursor-pointer transition-all text-center ${formData.designation_type === 'princess' ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                    <input
                      type="radio"
                      name="designation"
                      value="princess"
                      checked={formData.designation_type === 'princess'}
                      onChange={() => setFormData({ ...formData, designation_type: 'princess' })}
                      className="sr-only"
                    />
                    <span className="font-bold text-sm">姫予約</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* ステータス */}
          <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center">
              <span className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center mr-3">6</span>
              ステータス
            </h2>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">予約ステータス <span className="text-rose-500">*</span></label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as 'pending' | 'confirmed' | 'cancelled' })}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                required
              >
                <option value="pending">保留中</option>
                <option value="confirmed">確定</option>
                <option value="cancelled">キャンセル</option>
              </select>
            </div>
          </div>

          {/* 割引・備考 */}
          <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-100 mb-8">
            <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center">
              <span className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center mr-3">7</span>
              割引・備考
            </h2>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">割引額（円）</label>
                <input
                  type="number"
                  value={formData.discount_amount}
                  onChange={(e) => setFormData({ ...formData, discount_amount: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                  min="0"
                  step="100"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">備考</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="特別なリクエストや注記など"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all resize-y"
                  rows={4}
                />
              </div>
            </div>
          </div>
        </div>

        {/* 右側：料金計算サマリー */}
        <div className="col-span-1">
          <div className="bg-gradient-to-br from-white to-slate-50 p-6 md:p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 sticky top-28">
            <h2 className="text-xl font-bold text-slate-800 mb-6">予約サマリー</h2>

            <div className="space-y-4 text-sm mb-6 pb-6 border-b border-slate-200">
              <div className="flex justify-between items-center text-slate-600">
                <span className="font-medium">基本料金:</span>
                <span className="font-bold text-slate-800 text-base">¥{calculatedPrice.basePrice.toLocaleString()}</span>
              </div>

              {calculatedPrice.optionsPrice > 0 && (
                <div className="flex justify-between items-center text-slate-600">
                  <span className="font-medium">オプション:</span>
                  <span className="font-bold text-slate-800 text-base">¥{calculatedPrice.optionsPrice.toLocaleString()}</span>
                </div>
              )}

              {calculatedPrice.nominationFee > 0 && (
                <div className="flex justify-between items-center text-slate-600">
                  <span className="font-medium">指名料/姫予約:</span>
                  <span className="font-bold text-slate-800 text-base">¥{calculatedPrice.nominationFee.toLocaleString()}</span>
                </div>
              )}

              {calculatedPrice.discountAmount > 0 && (
                <div className="flex justify-between items-center text-rose-500">
                  <span className="font-medium">割引:</span>
                  <span className="font-bold text-base">-¥{calculatedPrice.discountAmount.toLocaleString()}</span>
                </div>
              )}

              <div className="flex justify-between items-center pt-2">
                <span className="font-medium text-slate-600">予約枠（施術時間）:</span>
                <span className="font-bold text-slate-800 bg-slate-100 px-3 py-1 rounded-lg text-xs">{calculatedPrice.duration}分</span>
              </div>
            </div>

            <div className="flex flex-col mb-8">
              <span className="text-sm font-semibold text-slate-500 mb-1">合計金額</span>
              <span className="text-4xl font-extrabold text-indigo-600 tracking-tight">¥{calculatedPrice.totalPrice.toLocaleString()}</span>
            </div>

            <div className="space-y-3">
              <button
                type="submit"
                className="w-full px-5 py-4 bg-indigo-600 text-white rounded-xl shadow-[0_4px_14px_0_rgb(79,70,229,39%)] hover:bg-indigo-700 hover:shadow-[0_6px_20px_rgba(79,70,229,23%)] font-bold text-lg transition-all active:scale-95"
              >
                予約を更新する
              </button>
              <button
                type="button"
                onClick={() => router.back()}
                className="w-full px-5 py-4 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 font-bold transition-all active:scale-95"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
