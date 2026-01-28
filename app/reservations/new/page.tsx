'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

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
}

export default function NewReservationPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [options, setOptions] = useState<Option[]>([])
  const [therapists, setTherapists] = useState<Therapist[]>([])
  const [therapistPricings, setTherapistPricings] = useState<TherapistPricing[]>([])

  const [formData, setFormData] = useState({
    customer_id: '',
    date: new Date().toISOString().split('T')[0],
    start_time: '10:00',
    course_id: '',
    therapist_id: '',
    designation_type: 'free' as 'free' | 'nomination' | 'confirmed',
    selected_options: [] as string[],
    discount_amount: 0,
    discount_reason: '',
    notes: '',
  })

  const [newCustomer, setNewCustomer] = useState({
    show: false,
    name: '',
    email: '',
    phone: '',
  })

  // 計算用の状態
  const [calculatedPrice, setCalculatedPrice] = useState({
    basePrice: 0,
    optionsPrice: 0,
    nominationFee: 0,
    discountAmount: 0,
    totalPrice: 0,
    duration: 0,
  })

  useEffect(() => {
    fetchInitialData()
  }, [])

  useEffect(() => {
    calculatePrice()
  }, [formData, courses, options, therapistPricings])

  const fetchInitialData = async () => {
    try {
      const [customersRes, coursesRes, optionsRes, therapistsRes, pricingRes] = await Promise.all([
        supabase.from('customers').select('id, name, email, phone').order('name'),
        supabase.from('courses').select('*').eq('is_active', true).order('display_order'),
        supabase.from('options').select('*').eq('is_active', true).order('display_order'),
        supabase.from('therapists').select('id, name').order('name'),
        supabase.from('therapist_pricing').select('*'),
      ])

      if (customersRes.error) throw customersRes.error
      if (coursesRes.error) throw coursesRes.error
      if (optionsRes.error) throw optionsRes.error
      if (therapistsRes.error) throw therapistsRes.error
      if (pricingRes.error) throw pricingRes.error

      setCustomers(customersRes.data || [])
      setCourses(coursesRes.data || [])
      setOptions(optionsRes.data || [])
      setTherapists(therapistsRes.data || [])
      setTherapistPricings(pricingRes.data || [])
    } catch (error) {
      console.error('データの取得に失敗:', error)
      alert('データの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const calculatePrice = () => {
    const selectedCourse = courses.find(c => c.id === formData.course_id)
    const selectedTherapist = therapists.find(t => t.id === formData.therapist_id)
    const therapistPricing = therapistPricings.find(p => p.therapist_id === formData.therapist_id)

    let basePrice = selectedCourse?.base_price || 0
    let optionsPrice = 0
    let duration = selectedCourse?.duration || 0

    // オプション料金と時間を計算
    formData.selected_options.forEach(optionId => {
      const option = options.find(o => o.id === optionId)
      if (option) {
        optionsPrice += option.price
        duration += option.duration
      }
    })

    // 指名料を計算
    let nominationFee = 0
    if (formData.designation_type === 'nomination' || formData.designation_type === 'confirmed') {
      nominationFee = therapistPricing?.nomination_fee || 0
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

  const handleAddNewCustomer = async () => {
    if (!newCustomer.name) {
      alert('お客様名を入力してください')
      return
    }

    try {
      const { data, error } = await supabase
        .from('customers')
        .insert([{
          name: newCustomer.name,
          email: newCustomer.email || null,
          phone: newCustomer.phone || null,
        }])
        .select()

      if (error) throw error

      const newCust = data[0]
      setCustomers([...customers, newCust])
      setFormData({ ...formData, customer_id: newCust.id })
      setNewCustomer({ show: false, name: '', email: '', phone: '' })
      alert('お客様を追加しました')
    } catch (error) {
      console.error('お客様の追加に失敗:', error)
      alert('お客様の追加に失敗しました')
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

    try {
      // 終了時刻を計算
      const [hours, minutes] = formData.start_time.split(':').map(Number)
      const startDate = new Date(`${formData.date}T${formData.start_time}`)
      const endDate = new Date(startDate.getTime() + calculatedPrice.duration * 60000)
      const endTime = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`

      const { error } = await supabase
        .from('reservations')
        .insert([{
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
          status: 'confirmed',
        }])

      if (error) throw error

      // オプションを別テーブルに登録
      if (formData.selected_options.length > 0) {
        const { data: reservations } = await supabase
          .from('reservations')
          .select('id')
          .eq('customer_id', formData.customer_id)
          .eq('date', formData.date)
          .eq('start_time', formData.start_time)
          .order('created_at', { ascending: false })
          .limit(1)

        if (reservations && reservations[0]) {
          const reservationId = reservations[0].id
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
      }

      alert('予約を登録しました')
      router.push('/reservations')
    } catch (error) {
      console.error('予約の登録に失敗:', error)
      alert('予約の登録に失敗しました')
    }
  }

  if (loading) {
    return <div className="p-8">読み込み中...</div>
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">予約登録</h1>

      <form onSubmit={handleSubmit} className="grid grid-cols-3 gap-6">
        {/* 左側：入力フォーム */}
        <div className="col-span-2 space-y-6">
          {/* お客様情報 */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">お客様情報</h2>
            
            {!newCustomer.show ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">お客様名</label>
                  <select
                    value={formData.customer_id}
                    onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                    className="w-full px-3 py-2 border rounded"
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
                <button
                  type="button"
                  onClick={() => setNewCustomer({ ...newCustomer, show: true })}
                  className="text-blue-600 hover:text-blue-900 text-sm"
                >
                  + 新規お客様を追加
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">お客様名 *</label>
                  <input
                    type="text"
                    value={newCustomer.name}
                    onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">電話番号</label>
                  <input
                    type="tel"
                    value={newCustomer.phone}
                    onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                    className="w-full px-3 py-2 border rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">メール</label>
                  <input
                    type="email"
                    value={newCustomer.email}
                    onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                    className="w-full px-3 py-2 border rounded"
                  />
                </div>
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={handleAddNewCustomer}
                    className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                  >
                    追加
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewCustomer({ show: false, name: '', email: '', phone: '' })}
                    className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400 text-sm"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 日時情報 */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">日時</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">日付 *</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">開始時刻 *</label>
                <input
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                  required
                />
              </div>
            </div>
          </div>

          {/* コース情報 */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">コース</h2>
            <div>
              <label className="block text-sm font-medium mb-2">コース選択 *</label>
              <select
                value={formData.course_id}
                onChange={(e) => setFormData({ ...formData, course_id: e.target.value })}
                className="w-full px-3 py-2 border rounded"
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
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">オプション</h2>
            {options.length === 0 ? (
              <p className="text-gray-500 text-sm">オプションがありません</p>
            ) : (
              <div className="space-y-2">
                {options.map(option => (
                  <label key={option.id} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.selected_options.includes(option.id)}
                      onChange={() => handleOptionToggle(option.id)}
                      className="w-4 h-4"
                    />
                    <span className="flex-1">
                      <span className="font-medium">{option.name}</span>
                      {option.duration > 0 && <span className="text-gray-600"> +{option.duration}分</span>}
                    </span>
                    <span className="text-gray-600">¥{option.price.toLocaleString()}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* セラピスト情報 */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">セラピスト</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">担当セラピスト *</label>
                <select
                  value={formData.therapist_id}
                  onChange={(e) => setFormData({ ...formData, therapist_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
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
                <label className="block text-sm font-medium mb-2">指名タイプ *</label>
                <div className="space-y-2">
                  <label className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded cursor-pointer border rounded">
                    <input
                      type="radio"
                      name="designation"
                      value="free"
                      checked={formData.designation_type === 'free'}
                      onChange={() => setFormData({ ...formData, designation_type: 'free' })}
                      className="w-4 h-4"
                    />
                    <span>フリー (指名料なし)</span>
                  </label>
                  <label className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded cursor-pointer border rounded">
                    <input
                      type="radio"
                      name="designation"
                      value="nomination"
                      checked={formData.designation_type === 'nomination'}
                      onChange={() => setFormData({ ...formData, designation_type: 'nomination' })}
                      className="w-4 h-4"
                    />
                    <span>指名</span>
                  </label>
                  <label className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded cursor-pointer border rounded">
                    <input
                      type="radio"
                      name="designation"
                      value="confirmed"
                      checked={formData.designation_type === 'confirmed'}
                      onChange={() => setFormData({ ...formData, designation_type: 'confirmed' })}
                      className="w-4 h-4"
                    />
                    <span>本指名</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* 割引情報 */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">割引</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">割引額（円）</label>
                <input
                  type="number"
                  value={formData.discount_amount}
                  onChange={(e) => setFormData({ ...formData, discount_amount: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border rounded"
                  min="0"
                  step="100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">割引理由</label>
                <input
                  type="text"
                  value={formData.discount_reason}
                  onChange={(e) => setFormData({ ...formData, discount_reason: e.target.value })}
                  placeholder="例：初回割引、クーポン利用"
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
            </div>
          </div>

          {/* 備考 */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">備考</h2>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="特別なリクエストや注記など"
              className="w-full px-3 py-2 border rounded"
              rows={4}
            />
          </div>
        </div>

        {/* 右側：料金計算サマリー */}
        <div className="col-span-1">
          <div className="bg-white p-6 rounded-lg shadow sticky top-8">
            <h2 className="text-lg font-semibold mb-4">料金計算</h2>
            
            <div className="space-y-3 text-sm mb-4 pb-4 border-b">
              <div className="flex justify-between">
                <span>基本料金:</span>
                <span>¥{calculatedPrice.basePrice.toLocaleString()}</span>
              </div>
              
              {calculatedPrice.optionsPrice > 0 && (
                <div className="flex justify-between">
                  <span>オプション:</span>
                  <span>¥{calculatedPrice.optionsPrice.toLocaleString()}</span>
                </div>
              )}
              
              {calculatedPrice.nominationFee > 0 && (
                <div className="flex justify-between">
                  <span>指名料:</span>
                  <span>¥{calculatedPrice.nominationFee.toLocaleString()}</span>
                </div>
              )}
              
              {calculatedPrice.discountAmount > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>割引:</span>
                  <span>-¥{calculatedPrice.discountAmount.toLocaleString()}</span>
                </div>
              )}
              
              <div className="flex justify-between">
                <span className="text-gray-600">施術時間:</span>
                <span className="text-gray-600">{calculatedPrice.duration}分</span>
              </div>
            </div>

            <div className="flex justify-between items-center mb-6 text-lg font-semibold">
              <span>合計:</span>
              <span className="text-2xl text-blue-600">¥{calculatedPrice.totalPrice.toLocaleString()}</span>
            </div>

            <div className="space-y-2">
              <button
                type="submit"
                className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-semibold"
              >
                予約を登録
              </button>
              <button
                type="button"
                onClick={() => router.back()}
                className="w-full px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
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
