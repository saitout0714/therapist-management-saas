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
  duration_minutes_added: number
  option_type: string
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
  therapist_burden_amount: number | null
  is_active: boolean
  is_combinable: boolean
}

type DiscountRankOverride = {
  discount_policy_id: string
  rank_id: string
  therapist_burden_amount: number
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
  const [discountRankOverrides, setDiscountRankOverrides] = useState<DiscountRankOverride[]>([])
  const [selectedDiscountIds, setSelectedDiscountIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saveError, setSaveError] = useState<string | null>(null)
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
  const [selectedCustomerObj, setSelectedCustomerObj] = useState<Customer | null>(null)

  const normalizedSearch = customerSearch.trim().toLowerCase()
  const filteredCustomers = normalizedSearch
    ? customers.filter(c => `${c.name ?? ''} ${c.phone ?? ''} ${c.email ?? ''}`.toLowerCase().includes(normalizedSearch))
    : []

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
  }, [formData, courses, options, therapistPricings, systemSettings, selectedDiscountIds, discountPolicies, designationTypes, customOptions]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (formData.start_time && calculatedPrice.duration > 0) {
      setFormData(prev => ({ ...prev, end_time: calcEndTime(formData.start_time, calculatedPrice.duration) }))
    }
  }, [formData.start_time, calculatedPrice.duration])

  const resolveDiscountBurden = (policy: DiscountPolicy, rankId: string | null): number | null => {
    if (rankId) {
      const override = discountRankOverrides.find(
        o => o.discount_policy_id === policy.id && o.rank_id === rankId
      )
      if (override !== undefined) return override.therapist_burden_amount
    }
    return policy.therapist_burden_amount ?? null
  }

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

      if (customersRes.error)  { console.error('customers:', customersRes.error.message, customersRes.error);  throw new Error('顧客データ: ' + customersRes.error.message) }
      if (coursesRes.error)    { console.error('courses:', coursesRes.error.message, coursesRes.error);    throw new Error('コース: ' + coursesRes.error.message) }
      if (optionsRes.error)    { console.error('options:', optionsRes.error.message, optionsRes.error);    throw new Error('オプション: ' + optionsRes.error.message) }
      if (therapistsRes.error) { console.error('therapists:', therapistsRes.error.message, therapistsRes.error); throw new Error('セラピスト: ' + therapistsRes.error.message) }
      if (reservationRes.error){ console.error('reservation:', reservationRes.error.message, reservationRes.error); throw new Error('予約データ: ' + reservationRes.error.message) }
      // 以下は非クリティカル（失敗しても空配列で続行）
      if (pricingRes.error)    console.warn('therapist_pricing:', pricingRes.error.message)
      if (settingsRes.error)   console.warn('system_settings:', settingsRes.error.message)
      if (discountsRes.error)  console.warn('discount_policies:', discountsRes.error.message)

      setCustomers(customersRes.data || [])
      setCourses(coursesRes.data || [])
      setOptions(optionsRes.data || [])
      setTherapists((therapistsRes.data || []) as unknown as Therapist[])
      setTherapistPricings(pricingRes.data || [])
      setSystemSettings(settingsRes.data?.[0] || null)
      setDiscountPolicies(discountsRes.data || [])
      setDesignationTypes((designationRes.data || []) as DesignationTypeItem[])
      setExtensionRankPrices((extRankPricesRes.data || []) as ExtensionRankPrice[])

      // discount_rank_overrides は補助データなので独立してフェッチ（失敗しても他に影響しない）
      try {
        const { data: overridesData } = await supabase
          .from('discount_rank_overrides')
          .select('discount_policy_id, rank_id, therapist_burden_amount')
          .eq('shop_id', selectedShop.id)
        setDiscountRankOverrides((overridesData || []) as DiscountRankOverride[])
      } catch {
        setDiscountRankOverrides([])
      }

      const reservation = reservationRes.data
      const allResOptions = (reservation.reservation_options as any[]) || []
      const selectedOptions = allResOptions.filter((ro: any) => ro.option_id).map((ro: any) => ro.option_id)
      const loadedCustomOptions = allResOptions
        .filter((ro: any) => !ro.option_id)
        .map((ro: any) => ({ name: ro.custom_name || '', price: ro.price || 0, backAmount: ro.custom_back_amount || 0 }))
      setCustomOptions(loadedCustomOptions)
      const appliedDiscounts = (reservation.reservation_discounts as any[]) || []
      const mainDiscount = appliedDiscounts[0]

      // 予約の顧客を直接取得してセット（customers配列の件数上限に依存しない）
      if (reservation.customer_id) {
        const { data: customerData } = await supabase
          .from('customers')
          .select('id, name, email, phone')
          .eq('id', reservation.customer_id)
          .single()
        if (customerData) {
          setSelectedCustomerObj(customerData)
          if (customerData.phone) setCustomerSearch(customerData.phone)
        }
      }

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

      const policyIds = appliedDiscounts.filter((d: any) => d.policy_id).map((d: any) => d.policy_id as string)
      if (policyIds.length > 0) {
        setSelectedDiscountIds(policyIds)
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
        duration += option.duration_minutes_added > 0 ? option.duration_minutes_added : (option.duration || 0)
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

    const selectedPolicies = discountPolicies.filter(p => selectedDiscountIds.includes(p.id))
    let dynamicDiscount = formData.discount_amount

    if (selectedPolicies.length > 0) {
      const subtotal = basePrice + optionsPrice + extensionPrice + nominationFee
      dynamicDiscount = selectedPolicies.reduce((sum, policy) => {
        if (policy.discount_type === 'fixed') return sum + policy.discount_value
        if (policy.discount_type === 'percentage') return sum + Math.floor(subtotal * policy.discount_value / 100)
        return sum
      }, 0)
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

  const handleDiscountToggle = (policyId: string) => {
    const policy = discountPolicies.find(p => p.id === policyId)
    if (!policy) return
    if (selectedDiscountIds.includes(policyId)) {
      setSelectedDiscountIds(prev => prev.filter(id => id !== policyId))
    } else if (!policy.is_combinable) {
      setSelectedDiscountIds([policyId])
    } else {
      const hasNonCombinable = selectedDiscountIds.some(id => {
        const p = discountPolicies.find(dp => dp.id === id)
        return p && !p.is_combinable
      })
      setSelectedDiscountIds(hasNonCombinable ? [policyId] : [...selectedDiscountIds, policyId])
    }
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
      const savedTherapist = therapists.find(t => t.id === formData.therapist_id)
      if (selectedDiscountIds.length > 0 && calculatedPrice.discountAmount > 0) {
        const subtotal = calculatedPrice.basePrice + calculatedPrice.optionsPrice + calculatedPrice.extensionPrice + calculatedPrice.nominationFee
        const discountInserts = selectedDiscountIds.map(id => {
          const policy = discountPolicies.find(p => p.id === id)!
          const amt = policy.discount_type === 'fixed'
            ? policy.discount_value
            : Math.floor(subtotal * policy.discount_value / 100)
          return {
            reservation_id: reservationId,
            policy_id: policy.id,
            applied_amount: amt,
            burden_type: policy.burden_type,
            therapist_burden_amount: resolveDiscountBurden(policy, savedTherapist?.rank_id ?? null),
            is_adhoc: false,
            adhoc_name: null,
            note: formData.discount_reason || null,
          }
        })
        await supabase.from('reservation_discounts').insert(discountInserts)
      } else if (selectedDiscountIds.length === 0 && calculatedPrice.discountAmount > 0) {
        await supabase.from('reservation_discounts').insert([{
          reservation_id: reservationId,
          policy_id: null,
          applied_amount: calculatedPrice.discountAmount,
          burden_type: 'shop_only',
          therapist_burden_amount: formData.manual_therapist_burden,
          is_adhoc: true,
          adhoc_name: '手動割引',
          note: formData.discount_reason || null,
        }])
      }

      // ★ バック再計算
      try {
        const selectedTherapist = therapists.find(t => t.id === formData.therapist_id)
        const selectedCourse = courses.find(c => c.id === formData.course_id)
        const subtotalForBack = calculatedPrice.basePrice + calculatedPrice.optionsPrice + calculatedPrice.extensionPrice + calculatedPrice.nominationFee
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
          discounts: selectedDiscountIds.length > 0
            ? selectedDiscountIds.map(id => {
                const policy = discountPolicies.find(p => p.id === id)!
                const amt = policy.discount_type === 'fixed'
                  ? policy.discount_value
                  : Math.floor(subtotalForBack * policy.discount_value / 100)
                return {
                  applied_amount: amt,
                  burden_type: policy.burden_type as 'shop_only' | 'split' | 'therapist_only',
                  therapist_burden_amount: resolveDiscountBurden(policy, selectedTherapist?.rank_id ?? null),
                }
              })
            : calculatedPrice.discountAmount > 0
            ? [{
                applied_amount: calculatedPrice.discountAmount,
                burden_type: 'shop_only' as 'shop_only' | 'split' | 'therapist_only',
                therapist_burden_amount: formData.manual_therapist_burden,
              }]
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

      // 遷移元に応じて戻る先を変更
      if (fromPage === 'shifts') {
        router.push('/shifts')
      } else {
        router.push('/reservations')
      }
    } catch (error: any) {
      console.error('予約の更新に失敗:', error)
      setSaveError(`予約の更新に失敗しました: ${error.message || '不明なエラー'}`)
    }
  }

  // アコーディオン開閉状態（モバイル: 1-4のみ初期展開、PC: CSS で常時表示）
  const [openSections, setOpenSections] = useState<Set<number>>(new Set([1, 2, 3, 4]))
  const toggleSection = (num: number) => setOpenSections(prev => {
    const next = new Set(prev); next.has(num) ? next.delete(num) : next.add(num); return next
  })

  if (loading) {
    return <div className="p-4 md:p-8">読み込み中...</div>
  }

  const hasExtension = !!(systemSettings && (systemSettings.extension_unit_minutes ?? 0) > 0)
  const n = (base: number) => String(base + (hasExtension ? 1 : 0))
  const Chevron = ({ num }: { num: number }) => (
    <svg className={`w-4 h-4 text-slate-400 transition-transform duration-200 lg:hidden flex-shrink-0 ${openSections.has(num) ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  )

  return (
    <div className="p-3 md:p-6 mx-auto">
      <h1 className="text-xl font-bold text-slate-800 tracking-tight mb-4">予約編集</h1>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-3 lg:gap-5">
        <div className="lg:col-span-2 space-y-2">
          {/* お客様情報 */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <button type="button" onClick={() => toggleSection(1)} className="w-full flex items-center justify-between px-4 py-3 text-left">
              <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <span className="w-6 h-6 rounded-md bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
                お客様情報
                {formData.customer_id && <span className="text-xs font-normal text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">{selectedCustomerObj?.name}</span>}
              </h2>
              <Chevron num={1} />
            </button>
            <div className={`${!openSections.has(1) ? 'hidden lg:block' : ''} px-4 pb-4 space-y-3`}>
              {/* 電話番号フィールド */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">電話番号</label>
                <input
                  type="text"
                  value={customerSearch}
                  onChange={(e) => {
                    setCustomerSearch(e.target.value)
                    if (selectedCustomerObj) {
                      setSelectedCustomerObj(null)
                      setFormData({ ...formData, customer_id: '' })
                    }
                  }}
                  placeholder="電話番号・名前・メールで検索"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-700 outline-none transition-all"
                />
                {/* 検索結果ドロップダウン（顧客未選択時のみ） */}
                {!selectedCustomerObj && normalizedSearch && (
                  <div className="border border-slate-200 rounded-xl max-h-48 overflow-auto bg-white shadow-sm mt-1">
                    {filteredCustomers.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-gray-500">該当するお客様がいません</div>
                    ) : (
                      filteredCustomers.slice(0, 50).map(customer => (
                        <button
                          key={customer.id}
                          type="button"
                          onClick={() => {
                            setSelectedCustomerObj(customer)
                            setFormData({ ...formData, customer_id: customer.id })
                            setCustomerSearch(customer.phone || '')
                          }}
                          className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0"
                        >
                          <span className="font-medium">{customer.name}</span>{' '}
                          <span className="text-gray-500">{customer.phone ? `(${customer.phone})` : ''}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* お客様名フィールド */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">お客様名 <span className="text-rose-500">*</span></label>
                {selectedCustomerObj ? (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-xl text-sm font-bold text-indigo-900 flex items-center gap-2">
                      <svg className="w-4 h-4 text-indigo-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {selectedCustomerObj.name}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCustomerObj(null)
                        setFormData({ ...formData, customer_id: '' })
                        setCustomerSearch('')
                      }}
                      className="px-4 py-3 text-sm text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors whitespace-nowrap"
                    >
                      変更
                    </button>
                  </div>
                ) : (
                  <div className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-400">
                    電話番号や名前を検索してお客様を選択してください
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* セラピスト情報 */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <button type="button" onClick={() => toggleSection(2)} className="w-full flex items-center justify-between px-4 py-3 text-left">
              <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <span className="w-6 h-6 rounded-md bg-cyan-50 text-cyan-600 flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
                担当セラピスト
                {formData.therapist_id && <span className="text-xs font-normal text-cyan-500 bg-cyan-50 px-2 py-0.5 rounded-full">{therapists.find(t => t.id === formData.therapist_id)?.name}</span>}
              </h2>
              <Chevron num={2} />
            </button>
            <div className={`${!openSections.has(2) ? 'hidden lg:block' : ''} px-4 pb-4 space-y-4`}>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">担当するセラピスト <span className="text-rose-500">*</span></label>
                <select
                  value={formData.therapist_id}
                  onChange={(e) => setFormData({ ...formData, therapist_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
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
                    <label className="block text-xs font-semibold text-slate-600 mb-1">ボーナス金額 (円)</label>
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
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <button type="button" onClick={() => toggleSection(3)} className="w-full flex items-center justify-between px-4 py-3 text-left">
              <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <span className="w-6 h-6 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
                日時
                {formData.date && formData.start_time && <span className="text-xs font-normal text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{formData.date} {formData.start_time}〜</span>}
              </h2>
              <Chevron num={3} />
            </button>
            <div className={`${!openSections.has(3) ? 'hidden lg:block' : ''} px-4 pb-4`}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">日付 <span className="text-rose-500">*</span></label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">開始時刻 <span className="text-rose-500">*</span></label>
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
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
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
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
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
                <label className="block text-xs font-semibold text-slate-600 mb-1">終了時刻 <span className="text-rose-500">*</span></label>
                <div className="flex gap-2">
                  <select
                    value={formData.end_time.split(':')[0] || ''}
                    onChange={(e) => {
                      const hour = e.target.value;
                      const minute = formData.end_time.split(':')[1] || '00';
                      setFormData({ ...formData, end_time: `${hour}:${minute}` });
                    }}
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
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
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
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
          </div>

          {/* コース情報 */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <button type="button" onClick={() => toggleSection(4)} className="w-full flex items-center justify-between px-4 py-3 text-left">
              <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <span className="w-6 h-6 rounded-md bg-pink-50 text-pink-600 flex items-center justify-center text-xs font-bold flex-shrink-0">4</span>
                コース
                {formData.course_id && <span className="text-xs font-normal text-pink-500 bg-pink-50 px-2 py-0.5 rounded-full">{courses.find(c => c.id === formData.course_id)?.name}</span>}
              </h2>
              <Chevron num={4} />
            </button>
            <div className={`${!openSections.has(4) ? 'hidden lg:block' : ''} px-4 pb-4`}>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">コース選択 <span className="text-rose-500">*</span></label>
              <select
                value={formData.course_id}
                onChange={(e) => setFormData({ ...formData, course_id: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
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
          </div>

          {/* 延長 */}
          {systemSettings && (systemSettings.extension_unit_minutes ?? 0) > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
              <button type="button" onClick={() => toggleSection(5)} className="w-full flex items-center justify-between px-4 py-3 text-left">
              <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <span className="w-6 h-6 rounded-md bg-orange-50 text-orange-600 flex items-center justify-center text-xs font-bold flex-shrink-0">5</span>
                延長
                {formData.extension_count > 0 && <span className="text-xs font-normal text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full">{formData.extension_count}回</span>}
              </h2>
              <Chevron num={5} />
              </button>
              <div className={`${!openSections.has(5) ? 'hidden lg:block' : ''} px-4 pb-4`}>
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
              <p className="text-xs text-slate-400 mt-2">
                {systemSettings.extension_unit_minutes ?? 30}分 × {formData.extension_count}回
                {(systemSettings.extension_unit_price ?? 0) > 0 ? ` = ¥${(formData.extension_count * (systemSettings.extension_unit_price ?? 0)).toLocaleString()}` : ''}
              </p>
              </div>
            </div>
          )}

          {/* オプション選択 */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <button type="button" onClick={() => toggleSection(6)} className="w-full flex items-center justify-between px-4 py-3 text-left">
              <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <span className="w-6 h-6 rounded-md bg-orange-50 text-orange-600 flex items-center justify-center text-xs font-bold flex-shrink-0">{hasExtension ? '6' : '5'}</span>
                オプション
                {formData.selected_options.length > 0 && <span className="text-xs font-normal text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full">{formData.selected_options.length}個選択</span>}
              </h2>
              <Chevron num={6} />
            </button>
            <div className={`${!openSections.has(6) ? 'hidden lg:block' : ''} px-4 pb-4`}>
            {options.length === 0 ? (
              <p className="text-slate-500 text-sm bg-slate-50 p-3 rounded-lg">オプションがありません</p>
            ) : (
              <div className="flex flex-col gap-2">
                {options.map(option => {
                  const isSelected = formData.selected_options.includes(option.id)
                  const mins = option.duration_minutes_added > 0 ? option.duration_minutes_added : option.duration
                  return (
                    <label
                      key={option.id}
                      className={`flex items-center gap-3 px-4 py-3 border rounded-xl cursor-pointer transition-all select-none ${isSelected ? 'bg-indigo-50 border-indigo-300' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleOptionToggle(option.id)}
                        className="w-4 h-4 accent-indigo-600 cursor-pointer flex-shrink-0"
                      />
                      <span className={`flex-1 font-semibold text-sm ${isSelected ? 'text-indigo-800' : 'text-slate-800'}`}>{option.name}</span>
                      {mins > 0 && <span className="text-xs text-slate-400 flex-shrink-0">+{mins}分</span>}
                      <span className="font-bold text-sm text-slate-700 flex-shrink-0">¥{option.price.toLocaleString()}</span>
                    </label>
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
          </div>

          {/* ステータス */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <button type="button" onClick={() => toggleSection(7)} className="w-full flex items-center justify-between px-4 py-3 text-left">
              <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <span className="w-6 h-6 rounded-md bg-amber-50 text-amber-600 flex items-center justify-center text-xs font-bold flex-shrink-0">{n(6)}</span>
                ステータス
                <span className={`text-xs font-normal px-2 py-0.5 rounded-full ${formData.status === 'confirmed' ? 'bg-emerald-50 text-emerald-600' : formData.status === 'cancelled' ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-500'}`}>
                  {formData.status === 'confirmed' ? '確定' : formData.status === 'cancelled' ? 'キャンセル' : '保留中'}
                </span>
              </h2>
              <Chevron num={7} />
            </button>
            <div className={`${!openSections.has(7) ? 'hidden lg:block' : ''} px-4 pb-4`}>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">予約ステータス <span className="text-rose-500">*</span></label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as 'pending' | 'confirmed' | 'cancelled' })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                required
              >
                <option value="pending">保留中</option>
                <option value="confirmed">確定</option>
                <option value="cancelled">キャンセル</option>
              </select>
            </div>
            </div>
          </div>

          {/* 割引情報 */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <button type="button" onClick={() => toggleSection(8)} className="w-full flex items-center justify-between px-4 py-3 text-left">
              <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <span className="w-6 h-6 rounded-md bg-teal-50 text-teal-600 flex items-center justify-center text-xs font-bold flex-shrink-0">{n(7)}</span>
                割引・キャンペーン
                {selectedDiscountIds.length > 0 && <span className="text-xs font-normal text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full">{selectedDiscountIds.length}件適用</span>}
                {selectedDiscountIds.length === 0 && calculatedPrice.discountAmount > 0 && <span className="text-xs font-normal text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full">-¥{calculatedPrice.discountAmount.toLocaleString()}</span>}
              </h2>
              <Chevron num={8} />
            </button>
            <div className={`${!openSections.has(8) ? 'hidden lg:block' : ''} px-4 pb-4 space-y-4`}>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">システム割引の適用</label>
                  {discountPolicies.length === 0 ? (
                    <p className="text-sm text-slate-400">登録されている割引ポリシーがありません</p>
                  ) : (
                    <div className="space-y-2">
                      {discountPolicies.map(p => {
                        const checked = selectedDiscountIds.includes(p.id)
                        const disabledByNonCombinable = !checked && selectedDiscountIds.some(id => {
                          const sel = discountPolicies.find(dp => dp.id === id)
                          return sel && !sel.is_combinable
                        })
                        return (
                          <label
                            key={p.id}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all ${
                              checked
                                ? 'bg-teal-50 border-teal-300 text-teal-800'
                                : disabledByNonCombinable
                                ? 'bg-slate-50 border-slate-100 text-slate-400 cursor-not-allowed'
                                : 'bg-white border-slate-200 hover:bg-teal-50/40 hover:border-teal-200'
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500"
                              checked={checked}
                              disabled={disabledByNonCombinable}
                              onChange={() => {
                                handleDiscountToggle(p.id)
                                if (!selectedDiscountIds.includes(p.id)) {
                                  setFormData(prev => ({ ...prev, discount_amount: 0, discount_reason: '' }))
                                }
                              }}
                            />
                            <span className="font-semibold text-sm flex-1">{p.name}</span>
                            <span className="text-sm font-bold text-teal-700">
                              {p.discount_type === 'fixed' ? `¥${p.discount_value.toLocaleString()}引き` : `${p.discount_value}%引き`}
                            </span>
                            {!p.is_combinable && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-semibold">併用不可</span>
                            )}
                          </label>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              {selectedDiscountIds.length === 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-top-2 duration-400">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">手入力割引額 (円)</label>
                    <input
                      type="number"
                      value={formData.discount_amount}
                      onChange={(e) => setFormData({ ...formData, discount_amount: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all placeholder:text-slate-400 font-medium"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">セラピスト負担額 (円)</label>
                    <input
                      type="number"
                      min={0}
                      value={formData.manual_therapist_burden || ''}
                      onChange={(e) => setFormData({ ...formData, manual_therapist_burden: Number(e.target.value) })}
                      placeholder="0"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all placeholder:text-slate-400 font-medium"
                    />
                    <p className="mt-1 text-xs text-slate-400">0円＝店舗全額負担、割引額と同額＝セラピスト全額負担</p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">割引理由</label>
                    <input
                      type="text"
                      value={formData.discount_reason}
                      onChange={(e) => setFormData({ ...formData, discount_reason: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                      placeholder="初回割引、キャンペーン等"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 支払方法 */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <button type="button" onClick={() => toggleSection(9)} className="w-full flex items-center justify-between px-4 py-3 text-left">
              <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <span className="w-6 h-6 rounded-md bg-amber-50 text-amber-600 flex items-center justify-center text-xs font-bold flex-shrink-0">{n(8)}</span>
                支払方法
                <span className="text-xs font-normal text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">{formData.payment_method === 'cash' ? '現金' : 'クレジット'}</span>
              </h2>
              <Chevron num={9} />
            </button>
            <div className={`${!openSections.has(9) ? 'hidden lg:block' : ''} px-4 pb-4 space-y-4`}>
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
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <button type="button" onClick={() => toggleSection(10)} className="w-full flex items-center justify-between px-4 py-3 text-left">
              <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <span className="w-6 h-6 rounded-md bg-slate-100 text-slate-500 flex items-center justify-center text-xs font-bold flex-shrink-0">{n(9)}</span>
                受付管理
              </h2>
              <Chevron num={10} />
            </button>
            <div className={`${!openSections.has(10) ? 'hidden lg:block' : ''} px-4 pb-4`}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
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
          </div>

          {/* 備考 */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <button type="button" onClick={() => toggleSection(11)} className="w-full flex items-center justify-between px-4 py-3 text-left">
              <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <span className="w-6 h-6 rounded-md bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-bold flex-shrink-0">{n(10)}</span>
                備考・メモ
              </h2>
              <Chevron num={11} />
            </button>
            <div className={`${!openSections.has(11) ? 'hidden lg:block' : ''} px-4 pb-4`}>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="特別なリクエストや店内共有事項など"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all resize-y text-sm"
              rows={3}
            />
            </div>
          </div>
        </div>

        {/* 右側：料金計算サマリー */}
        <div className="col-span-1">
          <div className="bg-gradient-to-br from-white to-slate-50 p-4 md:p-5 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 sticky top-20">
            <h2 className="text-base font-bold text-slate-800 mb-4">予約サマリー</h2>

            <div className="space-y-2.5 text-sm mb-4 pb-4 border-b border-slate-200">
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
              <span className="text-xs font-semibold text-slate-500 mb-0.5">合計金額</span>
              <span className="text-3xl font-extrabold text-indigo-600 tracking-tight">¥{calculatedPrice.totalPrice.toLocaleString()}</span>
            </div>

            {calculatedPrice.creditFeeAmount > 0 && (
              <div className="mb-4 p-3 bg-amber-50 rounded-xl border border-amber-100">
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

            {saveError && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                {saveError}
              </div>
            )}

            <div className="space-y-2">
              <button
                type="submit"
                className="w-full px-5 py-3 bg-indigo-600 text-white rounded-xl shadow-[0_4px_14px_0_rgb(79,70,229,39%)] hover:bg-indigo-700 font-bold text-base transition-all active:scale-95"
              >
                予約を更新する
              </button>
              <button
                type="button"
                onClick={() => router.back()}
                className="w-full px-5 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 font-bold transition-all active:scale-95"
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
