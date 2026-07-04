'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useShop } from '@/app/contexts/ShopContext'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { resolveCustomerPrice, calculateBack, calculateShiftAllowances, BackCalculationInput } from '@/lib/calculateBack'
import TimeSelectHM from '@/app/components/TimeSelectHM'

type Customer = {
  id: string
  name: string
  email: string | null
  phone: string | null
  status?: string
  ng_reason?: string | null
  memo?: string | null
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
    reception_source: 'staff' as 'staff' | 'client' | 'therapist' | 'owner',
    payment_method: 'cash' as 'cash' | 'credit',
    options_payment_method: 'cash' as 'cash' | 'credit',
    extension_payment_method: 'cash' as 'cash' | 'credit',
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
  const [customerSearchResults, setCustomerSearchResults] = useState<Customer[]>([])
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false)
  const [selectedCustomerObj, setSelectedCustomerObj] = useState<Customer | null>(null)
  const [newCustomer, setNewCustomer] = useState({ name: '', email: '', phone: '' })
  const customerSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const normalizedSearch = customerSearch.trim()
  const filteredCustomers = customerSearchResults

  const calcEndTime = (start: string, durationMin: number): string => {
    const [h, m] = start.split(':').map(Number)
    const total = h * 60 + m + durationMin
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
  }

  useEffect(() => {
    fetchInitialData()
  }, [selectedShop])

  useEffect(() => {
    if (customerSearchTimer.current) clearTimeout(customerSearchTimer.current)
    const q = customerSearch.trim()
    if (!q || !selectedShop) { setCustomerSearchResults([]); return }
    customerSearchTimer.current = setTimeout(async () => {
      setCustomerSearchLoading(true)
      const normalized = q.replace(/-/g, '')
      const { data } = await supabase
        .from('customers')
        .select('id, name, email, phone, status, ng_reason, memo')
        .eq('shop_id', selectedShop.id)
        .or(`name.ilike.%${q}%,phone.ilike.%${normalized}%,email.ilike.%${q}%`)
        .order('name')
        .limit(50)
      setCustomerSearchResults(data || [])
      setCustomerSearchLoading(false)
    }, 300)
    return () => { if (customerSearchTimer.current) clearTimeout(customerSearchTimer.current) }
  }, [customerSearch, selectedShop])

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
        supabase.from('customers').select('id, name, email, phone, status, ng_reason, memo').eq('shop_id', selectedShop.id).order('name'),
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
          .select('id, name, email, phone, status, ng_reason, memo')
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
        therapist_id: reservation.therapist_id || 'unassigned',
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
        extension_payment_method: reservation.extension_payment_method || 'cash',
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
        nominationFee = basePrice - originalBase
        basePrice = originalBase // 基本料金を本来の金額にリセット
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
    let creditBase = 0
    if (formData.payment_method === 'credit') {
      creditBase += basePrice + nominationFee
    }
    if (formData.extension_payment_method === 'credit') {
      creditBase += extensionPrice
    }
    if (formData.options_payment_method === 'credit') {
      creditBase += optionsPrice
    }
    if (creditBase > 0) {
      const subtotalForRatio = basePrice + optionsPrice + extensionPrice + nominationFee
      const creditRatio = subtotalForRatio > 0 ? creditBase / subtotalForRatio : 1
      const discountForCredit = Math.floor(dynamicDiscount * creditRatio)
      
      creditBase = Math.max(0, creditBase - discountForCredit)
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
        setFormData((prev) => ({ ...prev, designation_type: 'first_nomination' }))
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

    if ((!formData.customer_id && !newCustomer.name) || !formData.course_id || !formData.therapist_id) {
      alert('必須項目を入力してください')
      return
    }

    if (!selectedShop) {
      alert('店舗を選択してください')
      return
    }

    // NGセラピストチェック
    if (formData.customer_id && formData.therapist_id) {
      try {
        const { data: ngData, error: ngError } = await supabase
          .from('customer_therapist_ng')
          .select('id')
          .eq('customer_id', formData.customer_id)
          .eq('therapist_id', formData.therapist_id)
          .limit(1)

        if (ngError) throw ngError
        if (ngData && ngData.length > 0) {
          alert('このセラピストはこのお客様に対してNG登録されています。予約を登録できません。')
          return
        }
      } catch (err: any) {
        console.error('NGチェックエラー:', err)
        alert('NGチェック中にエラーが発生しました')
        return
      }
    }

    try {
      // 新規顧客の場合は先に登録
      if (!formData.customer_id && newCustomer.name) {
        const { data: createdCustomer, error: customerError } = await supabase
          .from('customers')
          .insert([{
            name: newCustomer.name,
            phone: customerSearch || null,
            shop_id: selectedShop.id,
          }])
          .select()
          .single()
        if (customerError) throw new Error('顧客登録に失敗しました: ' + customerError.message)
        setFormData(prev => ({ ...prev, customer_id: createdCustomer.id }))
        formData.customer_id = createdCustomer.id
      }


      const selectedDesignationType = designationTypes.find(d => d.slug === formData.designation_type)

      const { error } = await supabase
        .from('reservations')
        .update({
          customer_id: formData.customer_id,
          therapist_id: formData.therapist_id === 'unassigned' ? null : formData.therapist_id,
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
          designation_type_id: (selectedDesignationType?.id && !selectedDesignationType.id.startsWith('default-')) ? selectedDesignationType.id : null,
          notes: formData.notes,
          status: formData.status,
          reception_source: formData.reception_source,
          payment_method: formData.payment_method,
          options_payment_method: formData.options_payment_method,
          extension_payment_method: formData.extension_payment_method,
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
      let redirectDate = formData.date
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
        redirectDate = backResult.businessDate || formData.date
        await supabase.from('reservations').update({
          therapist_back_amount: backResult.netBack,
          shop_revenue: backResult.shopRevenue,
          back_calculated_at: new Date().toISOString(),
          business_date: backResult.businessDate,
        }).eq('id', reservationId)
      } catch (backErr) {
        console.warn('バック計算に失敗しましたが予約は更新されています:', backErr)
      }

      // Googleカレンダー同期APIの呼び出し（非同期）
      try {
        void fetch('/api/calendar-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reservationId,
            action: 'update'
          })
        }).catch((syncErr) => {
          console.error('[CalendarSync] 同期APIの呼び出しに失敗しました:', syncErr)
        })
      } catch (syncErr) {
        console.error('[CalendarSync] 同期API呼び出しのセットアップに失敗しました:', syncErr)
      }

      // 遷移元に応じて戻る先を変更
      if (fromPage === 'weekly') {
        window.location.href = `/shifts?date=${redirectDate}&view=week`
      } else if (fromPage === 'vertical') {
        window.location.href = `/shifts?date=${redirectDate}&view=vertical&scroll_to_time=${formData.start_time}`
      } else if (fromPage === 'shifts') {
        window.location.href = `/shifts?date=${redirectDate}&scroll_to_time=${formData.start_time}`
      } else {
        router.push('/reservations')
      }
    } catch (error: any) {
      console.error('予約の更新に失敗:', error)
      const details = error?.details ? ` (${error.details})` : ''
      const message = error?.message || (typeof error === 'object' ? JSON.stringify(error) : String(error))
      setSaveError(`予約の更新に失敗しました: ${message}${details}`)
    }
  }

  // アコーディオン開閉状態（モバイル: 1-4のみ初期展開、PC: CSS で常時表示）
  const [openSections, setOpenSections] = useState<Set<number>>(new Set([1, 2, 3, 4]))
  const [summaryExpanded, setSummaryExpanded] = useState(false)
  const toggleSection = (num: number) => setOpenSections(prev => {
    const next = new Set(prev); next.has(num) ? next.delete(num) : next.add(num); return next
  })

  if (loading) {
    return <div className="p-4 md:p-4">読み込み中...</div>
  }

  const hasExtension = !!(systemSettings && (systemSettings.extension_unit_minutes ?? 0) > 0)
  const n = (base: number) => String(base + (hasExtension ? 1 : 0))
  const Chevron = ({ num }: { num: number }) => (
    <svg className={`w-4 h-4 text-slate-400 transition-transform duration-200 lg:hidden flex-shrink-0 ${openSections.has(num) ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  )

  return (
    <div className="p-3 md:p-6 max-w-5xl">
      <h1 className="text-lg font-bold text-slate-800 tracking-tight mb-4">予約編集</h1>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2 order-2 sm:order-1 space-y-3 pb-24 sm:pb-0">
          {/* 1: お客様 */}
          <section className="bg-transparent sm:bg-white rounded-none sm:rounded-xl sm:shadow-sm sm:border border-slate-100 overflow-hidden py-1 sm:py-3 mb-2 sm:mb-0">
            <div className="flex items-center gap-2 pl-2 pr-1 sm:px-4 py-1.5 sm:py-3 border-l-4 border-indigo-500 bg-slate-50/30 sm:bg-slate-50/60 mb-1 sm:mb-0">
              <h2 className="text-xs sm:text-sm font-black text-slate-500 sm:text-slate-700 uppercase tracking-wider">お客様</h2>
              {formData.customer_id && (
                <span className="text-[10px] sm:text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{selectedCustomerObj?.name}</span>
              )}
            </div>
            <div className="px-1 sm:px-4 pb-2.5 sm:pb-4 pt-1 sm:pt-3 space-y-2.5">
              <div className="grid grid-cols-2 gap-2.5">
                {/* 電話番号フィールド */}
                <div className="relative">
                  <label className="block text-[11px] sm:text-xs font-semibold text-slate-500 mb-1">電話番号</label>
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => {
                      const val = e.target.value
                      setCustomerSearch(val)
                      setNewCustomer(prev => ({ ...prev, name: '' }))
                      if (formData.customer_id) {
                        setFormData({ ...formData, customer_id: '' })
                        setSelectedCustomerObj(null)
                      }
                    }}
                    placeholder="検索 (電話・名・メール)"
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-700 outline-none transition-all text-xs placeholder:text-[10px] placeholder:text-slate-400"
                  />
                  {!formData.customer_id && normalizedSearch && (
                    <div className="border border-slate-200 rounded-xl max-h-48 overflow-auto bg-white shadow-sm mt-1 absolute z-30 w-64">
                      {customerSearchLoading ? (
                        <div className="px-3 py-2 text-xs text-gray-500">検索中...</div>
                      ) : filteredCustomers.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-gray-500">該当するお客様がいません</div>
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
                            className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0"
                          >
                            <span className="font-medium">{customer.name}</span>{' '}
                            <span className="text-gray-500 text-[10px]">{customer.phone ? `(${customer.phone})` : ''}</span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* お客様名フィールド */}
                <div>
                  <label className="block text-[11px] sm:text-xs font-semibold text-slate-500 mb-1">
                    お客様名
                    {!selectedCustomerObj && customerSearch.trim() && filteredCustomers.length === 0 && !customerSearchLoading && !formData.customer_id && (
                      <span className="ml-1 text-[9px] font-bold text-amber-600 bg-amber-50 px-1 py-0.2 rounded">新規</span>
                    )}
                  </label>
                  {selectedCustomerObj ? (
                    <div className="flex items-center gap-1.5">
                      <div className={`flex-1 px-2.5 py-1.5 border rounded-lg text-xs font-bold flex items-center gap-1.5 overflow-hidden ${selectedCustomerObj.status === '出禁' ? 'bg-red-50 border-red-300 text-red-900' : selectedCustomerObj.status === '要注意' ? 'bg-yellow-50 border-yellow-300 text-yellow-900' : 'bg-indigo-50 border-indigo-200 text-indigo-900'}`}>
                        <svg className={`w-3.5 h-3.5 flex-shrink-0 ${selectedCustomerObj.status === '出禁' ? 'text-red-500' : selectedCustomerObj.status === '要注意' ? 'text-yellow-500' : 'text-indigo-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="truncate flex-1">{selectedCustomerObj.name}</span>
                        {selectedCustomerObj.status && selectedCustomerObj.status !== '予約可' && (
                          <span className={`px-1 rounded font-bold text-[9px] flex-shrink-0 ${selectedCustomerObj.status === '出禁' ? 'bg-red-200 text-red-700' : 'bg-yellow-200 text-yellow-700'}`}>
                            {selectedCustomerObj.status}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCustomerObj(null)
                          setFormData({ ...formData, customer_id: '' })
                          setCustomerSearch('')
                        }}
                        className="px-2 py-1.5 text-[10px] text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
                      >
                        変更
                      </button>
                    </div>
                  ) : customerSearch.trim() && filteredCustomers.length === 0 && !customerSearchLoading && !formData.customer_id ? (
                    <input
                      type="text"
                      value={newCustomer.name}
                      onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                      placeholder="新規お客様名を入力"
                      className="w-full px-2.5 py-1.5 bg-amber-50 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-400/50 outline-none transition-all placeholder:text-[10px] placeholder:text-amber-400 text-xs"
                    />
                  ) : (
                    <div className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] text-slate-400">
                      検索から選択してください
                    </div>
                  )}
                </div>
              </div>

              {(selectedCustomerObj?.status === '出禁' || selectedCustomerObj?.status === '要注意') && (
                <div className={`px-2.5 py-1.5 rounded-lg text-[10px] flex items-start gap-1.5 ${selectedCustomerObj.status === '出禁' ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-yellow-50 border border-yellow-200 text-yellow-700'}`}>
                  <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <span className="font-bold">「{selectedCustomerObj.status}」です。</span>
                    {selectedCustomerObj.ng_reason && <span className="ml-1">{selectedCustomerObj.ng_reason}</span>}
                  </div>
                </div>
              )}
              {selectedCustomerObj?.memo && (
                <div className="px-3 py-2 rounded-lg text-[10px] flex flex-col gap-1 bg-amber-50 border border-amber-200 text-amber-900 shadow-sm">
                  <div className="flex items-center gap-1 font-bold">
                    <svg className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    顧客メモ
                  </div>
                  <div className="font-medium whitespace-pre-wrap leading-relaxed">
                    {selectedCustomerObj.memo}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* 2: セラピスト・指名 */}
          <section className="bg-transparent sm:bg-white rounded-none sm:rounded-xl sm:shadow-sm sm:border border-slate-100 overflow-hidden py-1 sm:py-3 mb-2 sm:mb-0 border-t border-slate-100/70 sm:border-t-0">
            <div className="flex items-center justify-between pl-2 pr-1 sm:px-4 py-1.5 sm:py-3 border-l-4 border-cyan-500 bg-slate-50/30 sm:bg-slate-50/60 mb-1 sm:mb-0">
              <h2 className="text-xs sm:text-sm font-black text-slate-500 sm:text-slate-700 uppercase tracking-wider">セラピスト・指名</h2>
              {formData.therapist_id && (
                <span className="text-[10px] sm:text-xs font-bold text-cyan-600 bg-cyan-50 px-2 py-0.5 rounded-full">{therapists.find(t => t.id === formData.therapist_id)?.name}</span>
              )}
            </div>
            <div className="px-1 sm:px-4 pb-2.5 sm:pb-4 pt-1 sm:pt-3 space-y-3">
              <div>
                <label className="block text-[11px] sm:text-xs font-semibold text-slate-500 mb-1">セラピスト <span className="text-rose-500">*</span></label>
                <select
                  value={formData.therapist_id}
                  onChange={(e) => setFormData({ ...formData, therapist_id: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all text-xs"
                  required
                >
                  <option value="">選択してください</option>
                  <option value="unassigned" className="font-bold text-amber-700 bg-amber-50">フリー予約（未割当）</option>
                  {therapists.map(therapist => (
                    <option key={therapist.id} value={therapist.id}>
                      {therapist.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] sm:text-xs font-semibold text-slate-500">指名タイプ <span className="text-rose-500">*</span></label>
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); handleDesignationSearch() }}
                    disabled={designationSearchLoading}
                    className="px-2 py-0.5 text-[10px] font-medium bg-indigo-50 text-indigo-600 rounded-full hover:bg-indigo-100 disabled:opacity-50 transition-colors"
                  >
                    {designationSearchLoading ? '検索中...' : '自動判定'}
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-1.5 sm:flex sm:flex-wrap">
                  {designationTypes.map(dt => (
                    <label
                      key={dt.id}
                      className={`flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-1 px-2 py-1.5 border rounded-lg cursor-pointer transition-all select-none text-center sm:text-left ${formData.designation_type === dt.slug ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                    >
                      <div className="flex items-center gap-1">
                        <input
                          type="radio"
                          name="designation_type"
                          value={dt.slug}
                          checked={formData.designation_type === dt.slug}
                          onChange={() => {
                            setFormData({
                              ...formData,
                              designation_type: dt.slug,
                              is_hime: dt.slug === 'princess' ? true : formData.is_hime
                            })
                          }}
                          className="w-3 h-3 accent-indigo-600"
                        />
                        <span className="font-bold text-[11px] sm:text-xs whitespace-nowrap">{dt.display_name}</span>
                      </div>
                      {dt.is_store_paid_back && (
                        <span className={`text-[9px] sm:text-[10px] ${formData.designation_type === dt.slug ? 'text-indigo-100' : 'text-slate-400'}`}>店負担</span>
                      )}
                    </label>
                  ))}
                  {designationTypes.length === 0 && (
                    <p className="text-xs text-amber-600 bg-amber-50 p-3 rounded-lg col-span-3">指名種別が未設定です。</p>
                  )}
                </div>
              </div>

              {/* 姫予約 */}
              <div className="border-t border-slate-100 pt-2.5">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formData.is_hime}
                    onChange={(e) => setFormData({ ...formData, is_hime: e.target.checked })}
                    className="w-4 h-4 rounded accent-pink-500 cursor-pointer appearance-auto"
                  />
                  <span className="text-xs font-semibold text-slate-700">
                    <span className="text-pink-500 mr-1">♥</span>姫予約（セラピスト直受け）
                  </span>
                </label>
                {formData.is_hime && (
                  <div className="mt-2 ml-6">
                    <label className="block text-[11px] sm:text-xs font-medium text-slate-500 mb-1">ボーナス金額 (円)</label>
                    <input
                      type="number"
                      value={formData.hime_bonus}
                      onChange={(e) => setFormData({ ...formData, hime_bonus: Number(e.target.value) })}
                      min={0}
                      step={100}
                      className="w-40 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-pink-400/50 outline-none transition-all text-xs placeholder:text-[10px]"
                      placeholder="0"
                    />
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* 3: 日時・コース */}
          <section className="bg-transparent sm:bg-white rounded-none sm:rounded-xl sm:shadow-sm sm:border border-slate-100 overflow-hidden py-1 sm:py-3 mb-2 sm:mb-0 border-t border-slate-100/70 sm:border-t-0">
            <div className="flex items-center justify-between pl-2 pr-1 sm:px-4 py-1.5 sm:py-3 border-l-4 border-emerald-500 bg-slate-50/30 sm:bg-slate-50/60 mb-1 sm:mb-0">
              <h2 className="text-xs sm:text-sm font-black text-slate-500 sm:text-slate-700 uppercase tracking-wider">日時・コース</h2>
              {formData.date && formData.start_time && (
                <span className="text-[10px] sm:text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">{formData.date} {formData.start_time}〜</span>
              )}
            </div>
            <div className="px-1 sm:px-4 pb-2.5 sm:pb-4 pt-1 sm:pt-3 space-y-2.5">
              <div className="grid grid-cols-[1.2fr_1fr_1fr] gap-1.5">
                <div>
                  <label className="block text-[11px] sm:text-xs font-semibold text-slate-500 mb-1">日付 <span className="text-rose-500">*</span></label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] sm:text-xs font-semibold text-slate-500 mb-1">開始 <span className="text-rose-500">*</span></label>
                  <TimeSelectHM
                    value={formData.start_time}
                    onChange={v => {
                      const dur = calculatedPrice.duration || 0;
                      setFormData({ ...formData, start_time: v, end_time: dur > 0 ? calcEndTime(v, dur) : formData.end_time });
                    }}
                    placeholder
                    minHour={0}
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] sm:text-xs font-semibold text-slate-500 mb-1">終了 <span className="text-rose-500">*</span></label>
                  <TimeSelectHM
                    value={formData.end_time}
                    onChange={v => setFormData({ ...formData, end_time: v })}
                    placeholder
                    minHour={0}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr] gap-3 items-end">
                <div className="flex-1">
                  <label className="block text-[11px] sm:text-xs font-semibold text-slate-500 mb-1">コース <span className="text-rose-500">*</span></label>
                  <select
                    value={formData.course_id}
                    onChange={(e) => setFormData({ ...formData, course_id: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all text-xs"
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

                {systemSettings && (systemSettings.extension_unit_minutes ?? 0) > 0 && (
                  <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-lg border border-slate-200 justify-between h-[32px] w-28 sm:w-auto">
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, extension_count: Math.max(0, prev.extension_count - 1) }))}
                      className="w-6 h-6 rounded-md border border-slate-200 bg-white text-slate-700 text-sm font-bold flex items-center justify-center hover:bg-slate-100 transition-colors disabled:opacity-30"
                      disabled={formData.extension_count === 0}
                    >−</button>
                    <div className="text-center flex-1">
                      <span className="text-sm font-extrabold text-indigo-600">{formData.extension_count}</span>
                      <span className="text-[10px] font-semibold text-slate-500 ml-0.5">延長</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, extension_count: prev.extension_count + 1 }))}
                      className="w-6 h-6 rounded-md border border-indigo-200 bg-indigo-50 text-indigo-600 text-sm font-bold flex items-center justify-center hover:bg-indigo-100 transition-colors"
                    >＋</button>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* 4: オプション・ステータス・割引・支払 */}
          <section className="bg-transparent sm:bg-white rounded-none sm:rounded-xl sm:shadow-sm sm:border border-slate-100 overflow-hidden py-1 sm:py-3 mb-2 sm:mb-0 border-t border-slate-100/70 sm:border-t-0">
            <div className="flex items-center justify-between pl-2 pr-1 sm:px-4 py-1.5 sm:py-3 border-l-4 border-amber-500 bg-slate-50/30 sm:bg-slate-50/60 mb-1 sm:mb-0">
              <h2 className="text-xs sm:text-sm font-black text-slate-500 sm:text-slate-700 uppercase tracking-wider">オプション・割引・支払</h2>
            </div>
            <div className="px-1 sm:px-4 pb-2.5 sm:pb-4 pt-1 sm:pt-3 space-y-3.5">

              {/* ステータス */}
              <div>
                <label className="block text-[11px] sm:text-xs font-semibold text-slate-500 mb-1.5">
                  予約ステータス <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['pending', 'confirmed', 'cancelled'] as const).map(s => (
                    <label key={s} className={`flex items-center justify-center gap-1 px-1.5 py-1.5 border rounded-lg cursor-pointer transition-all select-none text-center ${formData.status === s ? s === 'confirmed' ? 'bg-emerald-600 border-emerald-600 text-white' : s === 'cancelled' ? 'bg-rose-500 border-rose-500 text-white' : 'bg-slate-600 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                      <input type="radio" name="status" value={s} checked={formData.status === s} onChange={() => setFormData({ ...formData, status: s })} className="w-3 h-3 accent-indigo-600" />
                      <span className="font-bold text-[10px] sm:text-xs whitespace-nowrap">{s === 'confirmed' ? '確定' : s === 'cancelled' ? 'キャンセル' : '保留中'}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* オプション */}
              <div className="border-t border-slate-100 pt-3">
                <label className="block text-xs font-medium text-slate-500 mb-2">
                  オプション
                  {formData.selected_options.length > 0 && <span className="ml-2 text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-full text-[10px]">{formData.selected_options.length}個選択</span>}
                </label>
                {options.length === 0 ? (
                  <p className="text-slate-400 text-xs bg-slate-50 p-3 rounded-xl">オプションがありません</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {options.map(option => {
                      const isSelected = formData.selected_options.includes(option.id)
                      const mins = option.duration_minutes_added > 0 ? option.duration_minutes_added : option.duration
                      return (
                        <label
                          key={option.id}
                          className={`flex items-center gap-2.5 px-2.5 py-2 border rounded-lg cursor-pointer transition-all select-none ${isSelected ? 'bg-indigo-50 border-indigo-300' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleOptionToggle(option.id)}
                            className="w-3.5 h-3.5 accent-indigo-600 cursor-pointer flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className={`font-bold text-[11px] sm:text-xs truncate ${isSelected ? 'text-indigo-800' : 'text-slate-800'}`}>{option.name}</div>
                            <div className="text-[10px] text-slate-400">
                              {mins > 0 && <span>+{mins}分 / </span>}
                              <span>¥{option.price.toLocaleString()}</span>
                            </div>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-500">手入力オプション</span>
                    <button
                      type="button"
                      onClick={addCustomOption}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
                    >
                      <span className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-xs">+</span>
                      追加
                    </button>
                  </div>
                  {customOptions.length > 0 && (
                    <div className="grid grid-cols-[2fr_1fr_1fr_1.5rem] gap-2 px-1 mb-1">
                      <span className="text-xs font-medium text-slate-400">オプション名</span>
                      <span className="text-xs font-medium text-slate-400 text-center">料金</span>
                      <span className="text-xs font-medium text-indigo-400 text-center">バック</span>
                      <span />
                    </div>
                  )}
                  <div className="space-y-2">
                    {customOptions.map((co, idx) => (
                      <div key={idx} className="grid grid-cols-[2fr_1fr_1fr_1.5rem] gap-2 items-center bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                        <input
                          type="text"
                          value={co.name}
                          onChange={(e) => updateCustomOption(idx, 'name', e.target.value)}
                          placeholder="オプション名"
                          className="min-w-0 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs placeholder:text-xs outline-none focus:ring-2 focus:ring-indigo-500/30"
                        />
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">¥</span>
                          <input
                            type="number"
                            value={co.price || ''}
                            onChange={(e) => updateCustomOption(idx, 'price', Number(e.target.value))}
                            placeholder="0"
                            className="w-full pl-5 pr-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs placeholder:text-xs outline-none focus:ring-2 focus:ring-indigo-500/30"
                          />
                        </div>
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-indigo-400 text-xs font-bold">¥</span>
                          <input
                            type="number"
                            value={co.backAmount || ''}
                            onChange={(e) => updateCustomOption(idx, 'backAmount', Number(e.target.value))}
                            placeholder="0"
                            className="w-full pl-5 pr-2 py-1.5 bg-white border border-indigo-200 rounded-lg text-xs placeholder:text-xs outline-none focus:ring-2 focus:ring-indigo-500/30 text-indigo-700"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeCustomOption(idx)}
                          className="text-rose-400 hover:text-rose-600 text-lg leading-none text-center"
                        >×</button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 割引 */}
              <div className="border-t border-slate-100 pt-3">
                <label className="block text-xs font-medium text-slate-500 mb-2">
                  割引・キャンペーン
                  {selectedDiscountIds.length > 0 && <span className="ml-2 text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded-full text-[10px]">{selectedDiscountIds.length}件適用</span>}
                </label>
                {discountPolicies.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {discountPolicies.map(p => {
                      const checked = selectedDiscountIds.includes(p.id)
                      const disabledByNonCombinable = !checked && selectedDiscountIds.some(id => {
                        const sel = discountPolicies.find(dp => dp.id === id)
                        return sel && !sel.is_combinable
                      })
                      return (
                        <label
                          key={p.id}
                          className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg border cursor-pointer transition-all ${
                            checked
                              ? 'bg-teal-50 border-teal-300 text-teal-800'
                              : disabledByNonCombinable
                              ? 'bg-slate-50 border-slate-100 text-slate-400 cursor-not-allowed'
                              : 'bg-white border-slate-200 hover:bg-teal-50/40 hover:border-teal-200'
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="w-3.5 h-3.5 rounded text-teal-600 focus:ring-teal-500"
                            checked={checked}
                            disabled={disabledByNonCombinable}
                            onChange={() => {
                              handleDiscountToggle(p.id)
                              if (!selectedDiscountIds.includes(p.id)) {
                                setFormData(prev => ({ ...prev, discount_amount: 0, discount_reason: '' }))
                              }
                            }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-[11px] sm:text-xs truncate">{p.name}</div>
                            <div className="text-[10px] text-teal-700 font-bold">
                              {p.discount_type === 'fixed' ? `¥${p.discount_value.toLocaleString()}引き` : `${p.discount_value}%引き`}
                              {!p.is_combinable && (
                                <span className="ml-1 text-[9px] px-1 py-0.2 rounded bg-amber-100 text-amber-700 font-semibold">単独</span>
                              )}
                            </div>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                )}
                {selectedDiscountIds.length === 0 && (
                  <div className="mt-3 grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">手入力割引額 (円)</label>
                      <input
                        type="number"
                        value={formData.discount_amount}
                        onChange={(e) => setFormData({ ...formData, discount_amount: Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all placeholder:text-slate-400 placeholder:text-xs font-medium text-sm"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">セラピスト負担 (円)</label>
                      <input
                        type="number"
                        min={0}
                        value={formData.manual_therapist_burden || ''}
                        onChange={(e) => setFormData({ ...formData, manual_therapist_burden: Number(e.target.value) })}
                        placeholder="0"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all placeholder:text-slate-400 placeholder:text-xs font-medium text-sm"
                      />
                      <p className="mt-1 text-xs text-slate-400">0円＝店全額負担</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">割引理由</label>
                      <input
                        type="text"
                        value={formData.discount_reason}
                        onChange={(e) => setFormData({ ...formData, discount_reason: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all text-sm placeholder:text-xs"
                        placeholder="初回割引、キャンペーン等"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 支払方法 */}
              <div className="border-t border-slate-100 pt-3">
                <label className="block text-xs font-medium text-slate-500 mb-2">支払方法</label>
                <div className="flex gap-3">
                  <label className={`flex items-center gap-2 px-4 py-2.5 border rounded-lg cursor-pointer transition-all select-none flex-1 ${formData.payment_method === 'cash' ? 'bg-slate-700 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                    <input type="radio" name="payment_method" value="cash" checked={formData.payment_method === 'cash'} onChange={() => setFormData({ ...formData, payment_method: 'cash' })} className="w-3.5 h-3.5 accent-slate-600" />
                    <span>💴</span>
                    <span className="font-bold text-xs">現金</span>
                  </label>
                  <label className={`flex items-center gap-2 px-4 py-2.5 border rounded-lg cursor-pointer transition-all select-none flex-1 ${formData.payment_method === 'credit' ? 'bg-amber-500 border-amber-500 text-white' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                    <input type="radio" name="payment_method" value="credit" checked={formData.payment_method === 'credit'} onChange={() => setFormData({ ...formData, payment_method: 'credit' })} className="w-3.5 h-3.5 accent-amber-500" />
                    <span>💳</span>
                    <span className="font-bold text-xs">クレジット</span>
                  </label>
                </div>
                {formData.payment_method === 'credit' && (
                  <div className="mt-3 bg-amber-50 rounded-xl p-3 border border-amber-100 space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-2">オプションの支払方法</label>
                      <div className="flex gap-3">
                        <label className={`flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer transition-all select-none flex-1 ${formData.options_payment_method === 'cash' ? 'bg-slate-700 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                          <input type="radio" name="options_payment_method" value="cash" checked={formData.options_payment_method === 'cash'} onChange={() => setFormData({ ...formData, options_payment_method: 'cash' })} className="w-3.5 h-3.5 accent-slate-600" />
                          <span className="text-xs font-bold">💴 現金（セラピストへ）</span>
                        </label>
                        <label className={`flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer transition-all select-none flex-1 ${formData.options_payment_method === 'credit' ? 'bg-amber-500 border-amber-500 text-white' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                          <input type="radio" name="options_payment_method" value="credit" checked={formData.options_payment_method === 'credit'} onChange={() => setFormData({ ...formData, options_payment_method: 'credit' })} className="w-3.5 h-3.5 accent-amber-500" />
                          <span className="text-xs font-bold">💳 クレジット</span>
                        </label>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-2">延長料金の支払方法</label>
                      <div className="flex gap-3">
                        <label className={`flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer transition-all select-none flex-1 ${formData.extension_payment_method === 'cash' ? 'bg-slate-700 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                          <input type="radio" name="extension_payment_method" value="cash" checked={formData.extension_payment_method === 'cash'} onChange={() => setFormData({ ...formData, extension_payment_method: 'cash' })} className="w-3.5 h-3.5 accent-slate-600" />
                          <span className="text-xs font-bold">💴 現金（セラピストへ）</span>
                        </label>
                        <label className={`flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer transition-all select-none flex-1 ${formData.extension_payment_method === 'credit' ? 'bg-amber-500 border-amber-500 text-white' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                          <input type="radio" name="extension_payment_method" value="credit" checked={formData.extension_payment_method === 'credit'} onChange={() => setFormData({ ...formData, extension_payment_method: 'credit' })} className="w-3.5 h-3.5 accent-amber-500" />
                          <span className="text-xs font-bold">💳 クレジット</span>
                        </label>
                      </div>
                    </div>
                    <div className="text-xs text-amber-700 bg-amber-100 rounded-lg p-2">
                      手数料率: {systemSettings?.credit_card_fee_rate ?? 10}%
                      {calculatedPrice.creditFeeAmount > 0 && (
                        <span className="ml-2 font-bold">→ ¥{calculatedPrice.creditFeeAmount.toLocaleString()} を追加請求</span>
                      )}
                    </div>
                  </div>
                )}
              </div>

            </div>
          </section>

          {/* 5: 受付・備考 */}
          <section className="bg-transparent sm:bg-white rounded-none sm:rounded-xl sm:shadow-sm sm:border border-slate-100 overflow-hidden py-1 sm:py-3 mb-2 sm:mb-0 border-t border-slate-100/70 sm:border-t-0">
            <div className="flex items-center justify-between pl-2 pr-1 sm:px-4 py-1.5 sm:py-3 border-l-4 border-slate-400 bg-slate-50/30 sm:bg-slate-50/60 mb-1 sm:mb-0">
              <h2 className="text-xs sm:text-sm font-black text-slate-500 sm:text-slate-700 uppercase tracking-wider">受付・備考</h2>
            </div>
            <div className="px-1 sm:px-4 pb-2.5 sm:pb-4 pt-1 sm:pt-3 space-y-2.5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] sm:text-xs font-medium text-slate-500 mb-1">受付区分</label>
                  <select
                    value={formData.reception_source}
                    onChange={e => setFormData({...formData, reception_source: e.target.value as any})}
                    className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all text-xs"
                  >
                    <option value="staff">mts</option>
                    <option value="owner">オーナー</option>
                    <option value="therapist">姫予約</option>
                    {formData.reception_source === 'client' && (
                      <option value="client">WEB予約</option>
                    )}
                  </select>
                </div>
                <div className="flex items-end justify-end pb-1">
                  <div className="text-[10px] text-slate-400 flex items-center">
                    <svg className="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    操作者: <span className="font-bold ml-1 text-slate-600 truncate max-w-20">{creatorName || '不明'}</span>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-[11px] sm:text-xs font-medium text-slate-500 mb-1">備考・メモ</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="特別なリクエストや店内共有事項など"
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all resize-y text-xs placeholder:text-[10px]"
                  rows={1}
                />
              </div>
            </div>
          </section>
        </div>

        {/* 右側：料金計算サマリー */}
        <div className="col-span-1 order-1 sm:order-2">
          {/* 1. PC用サマリー（常に全表示、サイドバー固定） */}
          <div className="hidden sm:block bg-gradient-to-br from-white to-slate-50 p-4 rounded-2xl shadow-lg border border-slate-100 sticky top-20">
            <h2 className="text-sm font-bold text-slate-800 mb-3">予約サマリー</h2>

            <div className="space-y-1.5 text-xs mb-3 pb-3 border-b border-slate-200">
              <div className="flex justify-between items-center text-slate-600">
                <span>基本料金</span>
                <span className="font-bold text-slate-800">¥{calculatedPrice.basePrice.toLocaleString()}</span>
              </div>
              {calculatedPrice.optionsPrice > 0 && (
                <div className="flex justify-between items-center text-slate-600">
                  <span>オプション</span>
                  <span className="font-bold text-slate-800">¥{calculatedPrice.optionsPrice.toLocaleString()}</span>
                </div>
              )}
              {calculatedPrice.extensionPrice > 0 && (
                <div className="flex justify-between items-center text-slate-600">
                  <span>延長 ({formData.extension_count}回)</span>
                  <span className="font-bold text-slate-800">¥{calculatedPrice.extensionPrice.toLocaleString()}</span>
                </div>
              )}
              {calculatedPrice.nominationFee > 0 && (
                <div className="flex justify-between items-center text-slate-600">
                  <span>指名料/姫予約</span>
                  <span className="font-bold text-slate-800">¥{calculatedPrice.nominationFee.toLocaleString()}</span>
                </div>
              )}
              {calculatedPrice.discountAmount > 0 && (
                <div className="flex justify-between items-center text-rose-500">
                  <span>割引</span>
                  <span className="font-bold">-¥{calculatedPrice.discountAmount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-1.5 border-t border-slate-100">
                <span className="text-slate-500">施術時間</span>
                <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">{calculatedPrice.duration}分</span>
              </div>
            </div>

            {calculatedPrice.creditFeeAmount > 0 && (
              <div className="flex justify-between items-center text-amber-600 mb-2 text-xs">
                <span>クレジット手数料 ({systemSettings?.credit_card_fee_rate ?? 10}%)</span>
                <span className="font-bold">+¥{calculatedPrice.creditFeeAmount.toLocaleString()}</span>
              </div>
            )}

            <div className="flex flex-col mb-3">
              <span className="text-xs text-slate-500 mb-0.5">合計金額</span>
              <span className="text-3xl font-extrabold text-indigo-600 tracking-tight">¥{calculatedPrice.totalPrice.toLocaleString()}</span>
            </div>

            {calculatedPrice.creditFeeAmount > 0 && (
              <div className="mb-4 p-3 bg-amber-50 rounded-xl border border-amber-100">
                <div className="text-xs text-amber-700 font-medium">💳 クレジット請求総額</div>
                <div className="text-xl font-extrabold text-amber-600">
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
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 mb-2">
                {saveError}
              </div>
            )}

            <div className="space-y-2">
              <button
                type="submit"
                className="w-full px-5 py-3 bg-indigo-600 text-white rounded-xl shadow-[0_4px_14px_0_rgb(79,70,229,39%)] hover:bg-indigo-700 font-bold text-sm transition-all active:scale-95"
              >
                予約を更新する
              </button>
              <button
                type="button"
                onClick={() => router.back()}
                className="w-full px-5 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 font-semibold text-sm transition-all active:scale-95"
              >
                キャンセル
              </button>
            </div>
          </div>

          {/* 2. スマホ用ボトムバー（常に最下部に固定、アコーディオンなしでコンパクトに全部表示） */}
          <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-3 z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] flex flex-col gap-2">
            {/* 上段: 内訳を1行で横スクロール可能に表示 */}
            <div className="flex items-center text-[10px] text-slate-500 font-medium gap-1.5 border-b border-slate-100 pb-2 overflow-x-auto whitespace-nowrap scrollbar-none">
              <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[9px] text-slate-600 font-bold flex-shrink-0">内訳</span>
              <span>基本:¥{calculatedPrice.basePrice.toLocaleString()}</span>
              {calculatedPrice.optionsPrice > 0 && <span>/ オプ:¥{calculatedPrice.optionsPrice.toLocaleString()}</span>}
              {calculatedPrice.extensionPrice > 0 && <span>/ 延長:¥{calculatedPrice.extensionPrice.toLocaleString()}</span>}
              {calculatedPrice.nominationFee > 0 && <span>/ 指名:¥{calculatedPrice.nominationFee.toLocaleString()}</span>}
              {calculatedPrice.discountAmount > 0 && <span className="text-rose-500">/ 割引:-¥{calculatedPrice.discountAmount.toLocaleString()}</span>}
              <span>/ {calculatedPrice.duration}分</span>
              {calculatedPrice.creditFeeAmount > 0 && (
                <span className="text-amber-600 font-bold bg-amber-50 px-1.5 py-0.5 rounded flex-shrink-0">
                  / 手数料:+¥{calculatedPrice.creditFeeAmount.toLocaleString()} (請求:¥{(calculatedPrice.totalPrice + calculatedPrice.creditFeeAmount).toLocaleString()})
                </span>
              )}
            </div>

            {/* 下段: 合計金額とアクションボタン */}
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[9px] text-slate-400 font-semibold tracking-wider leading-none mb-0.5">合計金額 (税込)</span>
                <span className="text-lg font-black text-indigo-600 tracking-tight leading-none">
                  ¥{calculatedPrice.totalPrice.toLocaleString()}
                </span>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-xs shadow-md shadow-indigo-600/20 active:scale-95 whitespace-nowrap"
                >
                  更新する
                </button>
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="px-3 py-2 bg-slate-100 text-slate-600 rounded-xl font-semibold text-xs active:scale-95 whitespace-nowrap"
                >
                  キャンセル
                </button>
              </div>
            </div>
            {saveError && (
              <div className="text-[10px] text-red-600 bg-red-50 p-1.5 rounded border border-red-200 mt-1">
                {saveError}
              </div>
            )}
          </div>
        </div>
      </form>
    </div>
  )
}
