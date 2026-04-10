'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useShop } from '@/app/contexts/ShopContext'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { resolveCustomerPrice, calculateBack, calculateShiftAllowances, BackCalculationInput } from '@/lib/calculateBack'

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
  back_amount: number
  includes_nomination_fee?: boolean
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
  rank_id: string | null
  back_calc_type: 'percentage' | 'fixed' | 'half_split' | null
  therapist_ranks?: { name: string } | null
}

type DesignationTypeItem = {
  id: string
  slug: string
  display_name: string
  is_store_paid_back: boolean
  treats_as_confirmed: boolean
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
  credit_card_fee_rate?: number
  extension_unit_minutes?: number
  extension_unit_price?: number
  extension_unit_back?: number
}

type ExtensionRankPrice = {
  rank_id: string
  extension_unit_price: number
  extension_unit_back: number
}

type DiscountPolicy = {
  id: string
  name: string
  discount_type: 'fixed' | 'percentage'
  discount_value: number
  burden_type: 'shop_only' | 'split' | 'therapist_only'
  is_active: boolean
}

type Shift = {
  therapist_id: string
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

  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null)
  const [discountPolicies, setDiscountPolicies] = useState<DiscountPolicy[]>([])
  const [selectedDiscountId, setSelectedDiscountId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [options, setOptions] = useState<Option[]>([])
  const [therapists, setTherapists] = useState<Therapist[]>([])
  const [therapistPricings, setTherapistPricings] = useState<TherapistPricing[]>([])
  const [designationTypes, setDesignationTypes] = useState<DesignationTypeItem[]>([])
  const [extensionRankPrices, setExtensionRankPrices] = useState<ExtensionRankPrice[]>([])
  const [resolvedBasePrice, setResolvedBasePrice] = useState<number | null>(null)

  const [formData, setFormData] = useState({
    customer_id: '',
    date: '',
    start_time: '',
    end_time: '',
    course_id: '',
    therapist_id: '',
    designation_type: 'free' as string,
    selected_options: [] as string[],
    extension_count: 0,
    discount_amount: 0,
    discount_reason: '',
    manual_therapist_burden: 0,
    notes: '',
    status: 'confirmed' as 'pending' | 'confirmed' | 'cancelled',
    reception_source: 'staff' as 'staff' | 'client' | 'therapist',
    payment_method: 'cash' as 'cash' | 'credit',
    options_payment_method: 'cash' as 'cash' | 'credit',
    is_hime: false,
    hime_bonus: 0,
  })
  const [creatorName, setCreatorName] = useState<string | null>(null)

  type CustomOption = { name: string; price: number; backAmount: number }
  const [customOptions, setCustomOptions] = useState<CustomOption[]>([])

  const addCustomOption = () => setCustomOptions(prev => [...prev, { name: '', price: 0, backAmount: 0 }])
  const removeCustomOption = (idx: number) => setCustomOptions(prev => prev.filter((_, i) => i !== idx))
  const updateCustomOption = (idx: number, field: keyof CustomOption, value: string | number) =>
    setCustomOptions(prev => prev.map((o, i) => i === idx ? { ...o, [field]: value } : o))

  const [calculatedPrice, setCalculatedPrice] = useState({
    basePrice: 0,
    optionsPrice: 0,
    extensionPrice: 0,
    nominationFee: 0,
    discountAmount: 0,
    totalPrice: 0,
    duration: 0,
    creditFeeAmount: 0,
  })
  const [designationSearchLoading, setDesignationSearchLoading] = useState(false)
  const [customerSearch, setCustomerSearch] = useState('')

  const normalizedSearch = customerSearch.trim().toLowerCase()
  const filteredCustomers = normalizedSearch
    ? customers.filter(c => `${c.name ?? ''} ${c.phone ?? ''} ${c.email ?? ''}`.toLowerCase().includes(normalizedSearch))
    : []
  const selectedCustomer = customers.find(c => c.id === formData.customer_id)

  const calcEndTime = (start: string, durationMin: number): string => {
    const [h, m] = start.split(':').map(Number)
    const total = h * 60 + m + durationMin
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
  }

  useEffect(() => {
    fetchInitialData()
  }, [selectedShop])

  useEffect(() => {
    void calculatePrice()
  }, [formData, courses, options, therapistPricings, systemSettings, selectedDiscountId, discountPolicies, designationTypes, customOptions]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (formData.start_time && calculatedPrice.duration > 0) {
      setFormData(prev => ({ ...prev, end_time: calcEndTime(formData.start_time, calculatedPrice.duration) }))
    }
  }, [formData.start_time, calculatedPrice.duration])

  const fetchInitialData = async () => {
    if (!selectedShop) return
    try {
      const [customersRes, coursesRes, optionsRes, therapistsRes, pricingRes, settingsRes, reservationRes, discountsRes, designationRes, extRankPricesRes] = await Promise.all([
        supabase.from('customers').select('id, name, email, phone').eq('shop_id', selectedShop.id).order('name'),
        supabase.from('courses').select('*').eq('shop_id', selectedShop.id).eq('is_active', true).order('display_order'),
        supabase.from('options').select('*').eq('shop_id', selectedShop.id).eq('is_active', true).order('display_order'),
        supabase.from('therapists').select('id, name, rank_id, back_calc_type, therapist_ranks(name)').eq('shop_id', selectedShop.id).order('name'),
        supabase.from('therapist_pricing').select('*'),
        supabase.from('system_settings').select('*').eq('shop_id', selectedShop.id).limit(1),
        supabase.from('reservations').select('*, reservation_options(option_id, price, custom_name, custom_back_amount), reservation_discounts(*)').eq('id', reservationId).eq('shop_id', selectedShop.id).single(),
        supabase.from('discount_policies').select('*').eq('shop_id', selectedShop.id).eq('is_active', true).order('created_at', { ascending: true }),
        supabase.from('designation_types').select('*').eq('shop_id', selectedShop.id).eq('is_active', true).order('display_order'),
        supabase.from('extension_rank_prices').select('rank_id, extension_unit_price, extension_unit_back').eq('shop_id', selectedShop.id),
      ])

      if (customersRes.error) throw customersRes.error
      if (coursesRes.error) throw coursesRes.error
      if (optionsRes.error) throw optionsRes.error
      if (therapistsRes.error) throw therapistsRes.error
      if (pricingRes.error) throw pricingRes.error
      if (settingsRes.error) throw settingsRes.error
      if (reservationRes.error) throw reservationRes.error
      if (discountsRes.error) throw discountsRes.error

      setCustomers(customersRes.data || [])
      setCourses(coursesRes.data || [])
      setOptions(optionsRes.data || [])
      setTherapists((therapistsRes.data || []) as unknown as Therapist[])
      setTherapistPricings(pricingRes.data || [])
      setSystemSettings(settingsRes.data?.[0] || null)
      setDiscountPolicies(discountsRes.data || [])
      setDesignationTypes((designationRes.data || []) as DesignationTypeItem[])
      setExtensionRankPrices((extRankPricesRes.data || []) as ExtensionRankPrice[])

      const reservation = reservationRes.data
      const allResOptions = (reservation.reservation_options as any[]) || []
      const selectedOptions = allResOptions.filter((ro: any) => ro.option_id).map((ro: any) => ro.option_id)
      const loadedCustomOptions = allResOptions
        .filter((ro: any) => !ro.option_id)
        .map((ro: any) => ({ name: ro.custom_name || '', price: ro.price || 0, backAmount: ro.custom_back_amount || 0 }))
      setCustomOptions(loadedCustomOptions)
      const appliedDiscounts = (reservation.reservation_discounts as any[]) || []
      const mainDiscount = appliedDiscounts[0]

      setFormData({
        customer_id: reservation.customer_id,
        date: reservation.date,
        start_time: reservation.start_time,
        end_time: reservation.end_time || '',
        course_id: reservation.course_id,
        therapist_id: reservation.therapist_id,
        designation_type: reservation.designation_type,
        selected_options: selectedOptions,
        extension_count: reservation.extension_count || 0,
        discount_amount: reservation.discount_amount || 0,
        discount_reason: mainDiscount?.note || '',
        manual_therapist_burden: mainDiscount?.therapist_burden_amount ?? 0,
        notes: reservation.notes || '',
        status: reservation.status,
        reception_source: reservation.reception_source || 'staff',
        payment_method: reservation.payment_method || 'cash',
        options_payment_method: reservation.options_payment_method || 'cash',
        is_hime: reservation.is_hime || false,
        hime_bonus: reservation.hime_bonus || 0,
      })

      if (mainDiscount?.policy_id) {
        setSelectedDiscountId(mainDiscount.policy_id)
      }

      // 登録者名の取得を個別に実施（結合エラー回避のため）
      if (reservation.created_by_id) {
        const { data: creatorData } = await supabase
          .from('users')
          .select('name')
          .eq('id', reservation.created_by_id)
          .single()
        
        if (creatorData?.name) {
          setCreatorName(creatorData.name)
        } else {
          setCreatorName('不明')
        }
      } else {
        setCreatorName('不明')
      }
    } catch (error: any) {
      console.error('データの取得に失敗:', error)
      alert(`データの取得に失敗しました: ${error.message || '不明なエラー'}`)
    } finally {
      setLoading(false)
    }
  }

  const calculatePrice = async () => {
    const selectedCourse = courses.find(c => c.id === formData.course_id)
    const therapistPricing = therapistPricings.find(p => p.therapist_id === formData.therapist_id)
    const selectedTherapist = therapists.find(t => t.id === formData.therapist_id)

    let basePrice = selectedCourse?.base_price || 0
    let optionsPrice = 0
    let duration = selectedCourse?.duration || 0

    // course_back_amounts から顧客料金を自動解決
    if (selectedShop && formData.course_id && formData.designation_type) {
      const rankId = selectedTherapist?.rank_id || null
      const resolved = await resolveCustomerPrice(
        selectedShop.id,
        formData.course_id,
        rankId,
        formData.designation_type,
        basePrice
      )
      basePrice = resolved.customerPrice
      setResolvedBasePrice(resolved.customerPrice)
    } else {
      setResolvedBasePrice(null)
    }

    // オプション料金と時間を計算
    formData.selected_options.forEach(optionId => {
      const option = options.find(o => o.id === optionId)
      if (option) {
        optionsPrice += option.price
        duration += option.duration
      }
    })
    // 手入力カスタムオプション
    customOptions.forEach(co => { optionsPrice += co.price || 0 })

    // 延長料金と時間を計算（ランク別オーバーライド → デフォルト の優先順）
    const extUnitMinutes = systemSettings?.extension_unit_minutes ?? 30
    const selectedTherapistRankId = selectedTherapist?.rank_id || null
    const rankExtPrice = selectedTherapistRankId
      ? extensionRankPrices.find(p => p.rank_id === selectedTherapistRankId)
      : null
    const extUnitPrice = rankExtPrice?.extension_unit_price ?? systemSettings?.extension_unit_price ?? 0
    const extensionPrice = formData.extension_count * extUnitPrice
    duration += formData.extension_count * extUnitMinutes

    // 指名料を計算（designation_types マスタの設定で判定）
    let nominationFee = 0
    const selectedDesignation = designationTypes.find(d => d.slug === formData.designation_type)

    if (selectedDesignation?.is_store_paid_back) {
      nominationFee = 0
    } else if (formData.designation_type !== 'free') {
      const originalBase = selectedCourse?.base_price || 0
      if (basePrice > originalBase) {
        nominationFee = 0 // 既にbasePriceに含有
      } else {
        const defaultNominationFee = systemSettings?.default_nomination_fee || 0
        const defaultConfirmedFee = systemSettings?.default_confirmed_nomination_fee || 0
        const defaultPrincessFee = systemSettings?.default_princess_reservation_fee || 0
        const resolveFee = (therapistFee: number | null | undefined, defaultFee: number) =>
          therapistFee && therapistFee > 0 ? therapistFee : defaultFee

        if (formData.designation_type === 'first_nomination' || formData.designation_type === 'nomination') {
          nominationFee = resolveFee(therapistPricing?.nomination_fee, defaultNominationFee)
        } else if (formData.designation_type === 'confirmed') {
          nominationFee = resolveFee(therapistPricing?.confirmed_nomination_fee, defaultConfirmedFee)
        } else if (formData.designation_type === 'princess') {
          nominationFee = resolveFee(therapistPricing?.princess_reservation_fee, defaultPrincessFee)
        }
      }
    }

    const selectedPolicy = discountPolicies.find(p => p.id === selectedDiscountId)
    let dynamicDiscount = formData.discount_amount

    if (selectedPolicy) {
      if (selectedPolicy.discount_type === 'fixed') {
        dynamicDiscount = selectedPolicy.discount_value
      } else if (selectedPolicy.discount_type === 'percentage') {
        const subtotal = basePrice + optionsPrice + extensionPrice + nominationFee
        dynamicDiscount = Math.floor(subtotal * (selectedPolicy.discount_value / 100))
      }
    }

    const totalPrice = basePrice + optionsPrice + extensionPrice + nominationFee - dynamicDiscount

    // クレジット手数料の計算
    const feeRate = (systemSettings?.credit_card_fee_rate ?? 10) / 100
    let creditFeeAmount = 0
    if (formData.payment_method === 'credit') {
      const creditBase = basePrice + nominationFee + extensionPrice + (formData.options_payment_method === 'credit' ? optionsPrice : 0)
      creditFeeAmount = Math.floor(creditBase * feeRate)
    }

    setCalculatedPrice({
      basePrice,
      optionsPrice,
      extensionPrice,
      nominationFee,
      discountAmount: dynamicDiscount,
      totalPrice: Math.max(0, totalPrice),
      duration,
      creditFeeAmount,
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

      const selectedDesignationType = designationTypes.find(d => d.slug === formData.designation_type)

      const { error } = await supabase
        .from('reservations')
        .update({
          customer_id: formData.customer_id,
          therapist_id: formData.therapist_id,
          course_id: formData.course_id,
          date: formData.date,
          start_time: formData.start_time,
          end_time: formData.end_time,
          base_price: calculatedPrice.basePrice,
          options_price: calculatedPrice.optionsPrice,
          extension_count: formData.extension_count,
          nomination_fee: calculatedPrice.nominationFee,
          total_price: calculatedPrice.totalPrice,
          discount_amount: calculatedPrice.discountAmount,
          designation_type: formData.designation_type,
          designation_type_id: selectedDesignationType?.id || null,
          notes: formData.notes,
          status: formData.status,
          reception_source: formData.reception_source,
          payment_method: formData.payment_method,
          options_payment_method: formData.options_payment_method,
          credit_fee_amount: calculatedPrice.creditFeeAmount,
          is_hime: formData.is_hime,
          hime_bonus: formData.is_hime ? formData.hime_bonus : 0,
        })
        .eq('id', reservationId)

      if (error) throw error

      // 既存のオプションと割引履歴を削除して再登録
      await supabase.from('reservation_options').delete().eq('reservation_id', reservationId)
      await supabase.from('reservation_discounts').delete().eq('reservation_id', reservationId)

      const optionInserts = formData.selected_options.map(optionId => {
        const option = options.find(o => o.id === optionId)
        return {
          reservation_id: reservationId,
          option_id: optionId,
          price: option?.price || 0,
        }
      })
      const customOptionInserts = customOptions
        .filter(co => co.name.trim() && co.price > 0)
        .map(co => ({
          reservation_id: reservationId,
          option_id: null as string | null,
          price: co.price,
          custom_name: co.name.trim(),
          custom_back_amount: co.backAmount,
        }))
      const allOptionInserts = [...optionInserts, ...customOptionInserts]
      if (allOptionInserts.length > 0) {
        await supabase.from('reservation_options').insert(allOptionInserts)
      }

      // 割引情報の適用
      if (calculatedPrice.discountAmount > 0) {
        const selectedPolicy = discountPolicies.find(p => p.id === selectedDiscountId)
        await supabase.from('reservation_discounts').insert([{
          reservation_id: reservationId,
          policy_id: selectedPolicy ? selectedPolicy.id : null,
          applied_amount: calculatedPrice.discountAmount,
          burden_type: selectedPolicy ? selectedPolicy.burden_type : 'shop_only',
          therapist_burden_amount: selectedPolicy ? null : formData.manual_therapist_burden,
          is_adhoc: !selectedPolicy,
          adhoc_name: !selectedPolicy ? '手動割引' : null,
          note: formData.discount_reason || null
        }])
      }

      // ★ バック再計算
      try {
        const selectedTherapist = therapists.find(t => t.id === formData.therapist_id)
        const selectedCourse = courses.find(c => c.id === formData.course_id)
        const backInput: BackCalculationInput = {
          shopId: selectedShop.id,
          therapistId: formData.therapist_id,
          therapistRankId: selectedTherapist?.rank_id || null,
          therapistBackCalcType: selectedTherapist?.back_calc_type || null,
          courseId: formData.course_id,
          coursePrice: selectedCourse?.base_price || 0,
          courseBackAmount: selectedCourse?.back_amount || 0,
          courseDuration: selectedCourse?.duration || 0,
          designationType: formData.designation_type,
          nominationFee: calculatedPrice.nominationFee,
          extensionCount: formData.extension_count,
          options: [
            ...optionInserts.map(o => ({ option_id: o.option_id, price: o.price })),
            ...customOptionInserts.map(co => ({ option_id: null as string | null, price: co.price, custom_back_amount: co.custom_back_amount })),
          ],
          discounts: calculatedPrice.discountAmount > 0
            ? [{ applied_amount: calculatedPrice.discountAmount, burden_type: (discountPolicies.find(p => p.id === selectedDiscountId)?.burden_type || 'shop_only') as 'shop_only' | 'split' | 'therapist_only', therapist_burden_amount: selectedDiscountId ? null : formData.manual_therapist_burden }]
            : [],
          date: formData.date,
          startTime: formData.start_time,
          himeBonus: formData.is_hime ? formData.hime_bonus : 0,
        }
        const backResult = await calculateBack(backInput)
        await supabase.from('reservations').update({
          therapist_back_amount: backResult.netBack,
          shop_revenue: backResult.shopRevenue,
          back_calculated_at: new Date().toISOString(),
          business_date: backResult.businessDate,
        }).eq('id', reservationId)
      } catch (backErr) {
        console.warn('バック計算に失敗しましたが予約は更新されています:', backErr)
      }

      alert('予約を更新しました')

      // 遷移元に応じて戻る先を変更
      if (fromPage === 'shifts') {
        router.push('/shifts')
      } else {
        router.push('/reservations')
      }
    } catch (error: any) {
      console.error('予約の更新に失敗:', error)
      alert(`予約の更新に失敗しました: ${error.message || '不明なエラー'}`)
    }
  }

  if (loading) {
    return <div className="p-4 md:p-8">読み込み中...</div>
  }

  const hasExtension = !!(systemSettings && (systemSettings.extension_unit_minutes ?? 0) > 0)
  const n = (base: number) => String(base + (hasExtension ? 1 : 0))

  return (
    <div className="p-4 md:p-8 mx-auto">
      <h1 className="text-2xl font-bold text-slate-800 tracking-tight mb-8">予約編集</h1>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        <div className="lg:col-span-2 space-y-6 lg:space-y-8">
          {/* お客様情報 */}
          <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center">
              <span className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mr-3">1</span>
              お客様情報
            </h2>
            <div className="space-y-3">
              {/* 選択済み表示 */}
              {selectedCustomer ? (
                <div className="flex items-center justify-between p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 text-sm text-indigo-900 font-medium">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {selectedCustomer.name}
                    {selectedCustomer.phone ? ` (${selectedCustomer.phone})` : ''}
                  </div>
                  <button
                    type="button"
                    onClick={() => { setFormData({ ...formData, customer_id: '' }); setCustomerSearch('') }}
                    className="text-xs text-slate-400 hover:text-rose-500 underline ml-3 transition-colors"
                  >
                    変更する
                  </button>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">電話番号・お客様名で検索 <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    placeholder="電話番号・名前・メールで検索"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-700 outline-none transition-all"
                    autoFocus
                  />
                  <div className="border border-slate-200 rounded-xl max-h-48 overflow-auto bg-white shadow-sm mt-2">
                    {!normalizedSearch ? (
                      <div className="px-3 py-2 text-sm text-gray-500">電話番号や名前を入力してください</div>
                    ) : filteredCustomers.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-gray-500">該当するお客様がいません</div>
                    ) : (
                      filteredCustomers.slice(0, 50).map(customer => (
                        <button
                          key={customer.id}
                          type="button"
                          onClick={() => { setFormData({ ...formData, customer_id: customer.id }); setCustomerSearch('') }}
                          className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0"
                        >
                          <span className="font-medium">{customer.name}</span>{' '}
                          <span className="text-gray-500">{customer.phone ? `(${customer.phone})` : ''}</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* セラピスト情報 */}
          <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center">
              <span className="w-8 h-8 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center mr-3">2</span>
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
                    onClick={(e) => {
                      e.preventDefault()
                      handleDesignationSearch()
                    }}
                    disabled={designationSearchLoading}
                    className="px-4 py-1.5 text-sm font-medium bg-indigo-50 text-indigo-600 rounded-full hover:bg-indigo-100 disabled:opacity-50 transition-colors"
                  >
                    {designationSearchLoading ? '検索中...' : '履歴から自動判定する'}
                  </button>
                </div>
                <div className={`grid grid-cols-2 sm:grid-cols-${Math.min(designationTypes.length, 5)} gap-3`}>
                  {designationTypes.map(dt => (
                    <button
                      key={dt.id}
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        setFormData({
                          ...formData,
                          designation_type: dt.slug,
                          is_hime: dt.slug === 'princess' ? true : formData.is_hime
                        })
                        e.currentTarget.blur()
                      }}
                      className={`flex flex-col items-center justify-center p-3 sm:p-4 border rounded-xl transition-all text-center ${formData.designation_type === dt.slug ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                    >
                      <span className="font-bold text-sm">{dt.display_name}</span>
                      {dt.is_store_paid_back && (
                        <span className={`text-xs mt-1 ${formData.designation_type === dt.slug ? 'text-indigo-100' : 'text-slate-500'}`}>店負担バック</span>
                      )}
                    </button>
                  ))}
                  {designationTypes.length === 0 && (
                    <p className="text-sm text-amber-600 col-span-full bg-amber-50 p-3 rounded-lg">指名種別が未設定です。</p>
                  )}
                </div>
              </div>

              {/* 姫予約 */}
              <div className="pt-2 border-t border-slate-100">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formData.is_hime}
                    onChange={(e) => setFormData({ ...formData, is_hime: e.target.checked })}
                    className="w-5 h-5 rounded accent-pink-500 cursor-pointer appearance-auto"
                  />
                  <span className="text-sm font-semibold text-slate-700">
                    <span className="text-pink-500 mr-1">♥</span>姫予約（セラピスト直受け）
                  </span>
                </label>
                {formData.is_hime && (
                  <div className="mt-3 ml-8 animate-in fade-in slide-in-from-top-2 duration-200">
                    <label className="block text-sm font-semibold text-slate-700 mb-2">ボーナス金額 (円)</label>
                    <input
                      type="number"
                      value={formData.hime_bonus}
                      onChange={(e) => setFormData({ ...formData, hime_bonus: Number(e.target.value) })}
                      min={0}
                      step={100}
                      className="w-48 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-400/50 outline-none transition-all"
                      placeholder="0"
                    />
                    <p className="mt-1.5 text-xs text-slate-400">セラピストに支払うボーナス額（0円の場合は空欄可）</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 日時情報 */}
          <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center">
              <span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mr-3">3</span>
              日時
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
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
                      const newStart = `${hour}:${minute}`
                      const dur = calculatedPrice.duration || 0
                      setFormData({ ...formData, start_time: newStart, end_time: dur > 0 ? calcEndTime(newStart, dur) : formData.end_time });
                    }}
                    className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                    required
                  >
                    <option value="">時</option>
                    {Array.from({ length: 30 }, (_, i) => (
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
                      const newStart = `${hour}:${minute}`
                      const dur = calculatedPrice.duration || 0
                      setFormData({ ...formData, start_time: newStart, end_time: dur > 0 ? calcEndTime(newStart, dur) : formData.end_time });
                    }}
                    className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
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
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">終了時刻 <span className="text-rose-500">*</span></label>
                <div className="flex gap-2">
                  <select
                    value={formData.end_time.split(':')[0] || ''}
                    onChange={(e) => {
                      const hour = e.target.value;
                      const minute = formData.end_time.split(':')[1] || '00';
                      setFormData({ ...formData, end_time: `${hour}:${minute}` });
                    }}
                    className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                    required
                  >
                    <option value="">時</option>
                    {Array.from({ length: 30 }, (_, i) => (
                      <option key={i} value={String(i).padStart(2, '0')}>
                        {String(i).padStart(2, '0')}時
                      </option>
                    ))}
                  </select>
                  <select
                    value={formData.end_time.split(':')[1] || ''}
                    onChange={(e) => {
                      const hour = formData.end_time.split(':')[0] || '00';
                      const minute = e.target.value;
                      setFormData({ ...formData, end_time: `${hour}:${minute}` });
                    }}
                    className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
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
              <span className="w-8 h-8 rounded-lg bg-pink-50 text-pink-600 flex items-center justify-center mr-3">4</span>
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

          {/* 延長 */}
          {systemSettings && (systemSettings.extension_unit_minutes ?? 0) > 0 && (
            <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-100">
              <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center">
                <span className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center mr-3">5</span>
                延長
              </h2>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, extension_count: Math.max(0, prev.extension_count - 1) }))}
                  className="w-10 h-10 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 text-xl font-bold flex items-center justify-center hover:bg-slate-100 transition-colors disabled:opacity-30"
                  disabled={formData.extension_count === 0}
                >−</button>
                <div className="flex-1 text-center">
                  <div className="text-3xl font-extrabold text-indigo-600">{formData.extension_count}<span className="text-base font-semibold text-slate-500 ml-1">回</span></div>
                  {formData.extension_count > 0 && (
                    <div className="text-sm text-slate-500 mt-1">
                      +{formData.extension_count * (systemSettings.extension_unit_minutes ?? 30)}分 / ¥{(formData.extension_count * (systemSettings.extension_unit_price ?? 0)).toLocaleString()}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, extension_count: prev.extension_count + 1 }))}
                  className="w-10 h-10 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-600 text-xl font-bold flex items-center justify-center hover:bg-indigo-100 transition-colors"
                >＋</button>
              </div>
              <p className="text-xs text-slate-400 mt-3">
                {systemSettings.extension_unit_minutes ?? 30}分 × {formData.extension_count}回
                {(systemSettings.extension_unit_price ?? 0) > 0 ? ` = ¥${(formData.extension_count * (systemSettings.extension_unit_price ?? 0)).toLocaleString()}` : ''}
              </p>
            </div>
          )}

          {/* オプション選択 */}
          <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center">
              <span className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center mr-3">{hasExtension ? '6' : '5'}</span>
              オプション
            </h2>
            {options.length === 0 ? (
              <p className="text-slate-500 text-sm bg-slate-50 p-4 rounded-xl">オプションがありません</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {options.map(option => {
                  const isSelected = formData.selected_options.includes(option.id)
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleOptionToggle(option.id)}
                      className={`flex items-center p-4 border rounded-xl cursor-pointer transition-all text-left w-full ${isSelected ? 'bg-indigo-50 border-indigo-400' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                    >
                      <span
                        className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                          isSelected ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300'
                        }`}
                      >
                        {isSelected && (
                          <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </span>
                      <div className="ml-3 flex-1">
                        <div className={`font-bold ${isSelected ? 'text-indigo-800' : 'text-slate-800'}`}>{option.name}</div>
                        <div className="text-sm text-slate-500 flex items-center justify-between mt-1">
                          {option.duration > 0 ? <span>+{option.duration}分</span> : <span></span>}
                          <span className="font-bold text-slate-700">¥{option.price.toLocaleString()}</span>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            {/* 手入力カスタムオプション */}
            <div className="mt-5 pt-5 border-t border-slate-100">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-slate-600">手入力オプション（セラピスト個別）</span>
                <button
                  type="button"
                  onClick={addCustomOption}
                  className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
                >
                  <span className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-xs">+</span>
                  追加
                </button>
              </div>
              {customOptions.length === 0 && (
                <p className="text-xs text-slate-400">セラピストごとの個別オプションがある場合は追加してください</p>
              )}
              {customOptions.length > 0 && (
                <div className="grid grid-cols-[2fr_1fr_1fr_1.5rem] gap-2 px-3 mb-1">
                  <span className="text-xs font-medium text-slate-400">オプション名</span>
                  <span className="text-xs font-medium text-slate-400 text-center">料金</span>
                  <span className="text-xs font-medium text-indigo-400 text-center">バック</span>
                  <span />
                </div>
              )}
              <div className="space-y-2">
                {customOptions.map((co, idx) => (
                  <div key={idx} className="grid grid-cols-[2fr_1fr_1fr_1.5rem] gap-2 items-center bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <input
                      type="text"
                      value={co.name}
                      onChange={(e) => updateCustomOption(idx, 'name', e.target.value)}
                      placeholder="オプション名"
                      className="min-w-0 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500/30"
                    />
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">¥</span>
                      <input
                        type="number"
                        value={co.price || ''}
                        onChange={(e) => updateCustomOption(idx, 'price', Number(e.target.value))}
                        placeholder="0"
                        className="w-full pl-6 pr-2 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500/30"
                      />
                    </div>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-indigo-400 text-xs font-bold">¥</span>
                      <input
                        type="number"
                        value={co.backAmount || ''}
                        onChange={(e) => updateCustomOption(idx, 'backAmount', Number(e.target.value))}
                        placeholder="0"
                        className="w-full pl-6 pr-2 py-2 bg-white border border-indigo-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500/30 text-indigo-700"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeCustomOption(idx)}
                      className="text-rose-400 hover:text-rose-600 text-lg leading-none text-center"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ステータス */}
          <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center">
              <span className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center mr-3">{n(6)}</span>
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

          {/* 割引情報 */}
          <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center">
              <span className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center mr-3">{n(7)}</span>
              割引・キャンペーン
            </h2>
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">システム割引の適用</label>
                  <select
                    value={selectedDiscountId}
                    onChange={(e) => {
                      setSelectedDiscountId(e.target.value)
                      if (e.target.value) {
                        setFormData({ ...formData, discount_amount: 0, discount_reason: '' })
                      }
                    }}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                  >
                    <option value="">適用しない（または手動入力）</option>
                    {discountPolicies.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.discount_type === 'fixed' ? `¥${p.discount_value.toLocaleString()}引き` : `${p.discount_value}%引き`})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {!selectedDiscountId && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-top-2 duration-400">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">手入力割引額 (円)</label>
                    <input
                      type="number"
                      value={formData.discount_amount}
                      onChange={(e) => setFormData({ ...formData, discount_amount: Number(e.target.value) })}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all placeholder:text-slate-400 font-medium"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">セラピスト負担額 (円)</label>
                    <input
                      type="number"
                      min={0}
                      value={formData.manual_therapist_burden || ''}
                      onChange={(e) => setFormData({ ...formData, manual_therapist_burden: Number(e.target.value) })}
                      placeholder="0"
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all placeholder:text-slate-400 font-medium"
                    />
                    <p className="mt-1 text-xs text-slate-400">0円＝店舗全額負担、割引額と同額＝セラピスト全額負担</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">割引理由</label>
                    <input
                      type="text"
                      value={formData.discount_reason}
                      onChange={(e) => setFormData({ ...formData, discount_reason: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                      placeholder="初回割引、キャンペーン等"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 支払方法 */}
          <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center">
              <span className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center mr-3">{n(8)}</span>
              支払方法
            </h2>
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3">コース・指名料の支払方法</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, payment_method: 'cash' })}
                    className={`flex flex-col items-center justify-center p-4 border rounded-xl transition-all ${formData.payment_method === 'cash' ? 'bg-slate-700 border-slate-700 text-white shadow-md' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                  >
                    <span className="text-xl mb-1">💴</span>
                    <span className="font-bold text-sm">現金</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, payment_method: 'credit' })}
                    className={`flex flex-col items-center justify-center p-4 border rounded-xl transition-all ${formData.payment_method === 'credit' ? 'bg-amber-500 border-amber-500 text-white shadow-md' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                  >
                    <span className="text-xl mb-1">💳</span>
                    <span className="font-bold text-sm">クレジット</span>
                  </button>
                </div>
              </div>

              {formData.payment_method === 'credit' && (
                <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100 space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-3">オプションの支払方法</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, options_payment_method: 'cash' })}
                        className={`flex items-center justify-center gap-2 p-3 border rounded-xl transition-all text-sm font-bold ${formData.options_payment_method === 'cash' ? 'bg-slate-700 border-slate-700 text-white shadow-md' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                      >
                        💴 現金（セラピストへ）
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, options_payment_method: 'credit' })}
                        className={`flex items-center justify-center gap-2 p-3 border rounded-xl transition-all text-sm font-bold ${formData.options_payment_method === 'credit' ? 'bg-amber-500 border-amber-500 text-white shadow-md' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                      >
                        💳 クレジット
                      </button>
                    </div>
                  </div>
                  <div className="text-xs text-amber-700 bg-amber-100 rounded-xl p-3">
                    手数料率: {systemSettings?.credit_card_fee_rate ?? 10}%
                    {calculatedPrice.creditFeeAmount > 0 && (
                      <span className="ml-2 font-bold">→ ¥{calculatedPrice.creditFeeAmount.toLocaleString()} を追加請求</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 受付管理 */}
          <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center">
              <span className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center mr-3">{n(9)}</span>
              受付管理
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-2xl border border-slate-100">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">受付区分</label>
                <select 
                  value={formData.reception_source}
                  onChange={e => setFormData({...formData, reception_source: e.target.value as any})}
                  className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all text-sm font-medium"
                >
                  <option value="staff">スタッフ受付</option>
                  <option value="client">顧客直接 (WEB等)</option>
                  <option value="therapist">セラピスト直接</option>
                </select>
              </div>
              <div className="flex flex-col justify-end pb-1 text-right">
                <div className="text-[11px] text-slate-400 flex items-center justify-end">
                  <svg className="w-3.5 h-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  登録者: <span className="font-bold ml-1 text-slate-600">{creatorName || '不明'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 備考 */}
          <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-100 mb-8">
            <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center">
              <span className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mr-3">{n(10)}</span>
              備考・メモ
            </h2>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="特別なリクエストや店内共有事項など"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all resize-y text-sm"
              rows={4}
            />
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

              {calculatedPrice.extensionPrice > 0 && (
                <div className="flex justify-between items-center text-slate-600">
                  <span className="font-medium">延長 ({formData.extension_count}回):</span>
                  <span className="font-bold text-slate-800 text-base">¥{calculatedPrice.extensionPrice.toLocaleString()}</span>
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

            {calculatedPrice.creditFeeAmount > 0 && (
              <div className="flex justify-between items-center text-amber-600 mb-2">
                <span className="font-medium text-sm">クレジット手数料 ({systemSettings?.credit_card_fee_rate ?? 10}%):</span>
                <span className="font-bold text-base">+¥{calculatedPrice.creditFeeAmount.toLocaleString()}</span>
              </div>
            )}

            <div className="flex flex-col mb-2">
              <span className="text-sm font-semibold text-slate-500 mb-1">合計金額</span>
              <span className="text-4xl font-extrabold text-indigo-600 tracking-tight">¥{calculatedPrice.totalPrice.toLocaleString()}</span>
            </div>

            {calculatedPrice.creditFeeAmount > 0 && (
              <div className="mb-6 p-3 bg-amber-50 rounded-xl border border-amber-100">
                <div className="text-xs text-amber-700 font-medium">💳 クレジット請求総額</div>
                <div className="text-xl font-extrabold text-amber-600 tracking-tight">
                  ¥{(calculatedPrice.totalPrice + calculatedPrice.creditFeeAmount).toLocaleString()}
                </div>
                {formData.options_payment_method === 'cash' && calculatedPrice.optionsPrice > 0 && (
                  <div className="text-[10px] text-amber-600 mt-1">
                    ※ オプション ¥{calculatedPrice.optionsPrice.toLocaleString()} は現金でセラピストへ
                  </div>
                )}
              </div>
            )}

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
