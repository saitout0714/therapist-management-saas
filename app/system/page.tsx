'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

// Course型の定義
type Course = {
  id: string
  name: string
  duration: number
  base_price: number
  description: string | null
  is_active: boolean
  display_order: number
  created_at: string
}

// Option型の定義
type Option = {
  id: string
  name: string
  duration: number
  price: number
  description: string | null
  is_active: boolean
  display_order: number
  created_at: string
}

// Therapist型の定義
type Therapist = {
  id: string
  name: string
  created_at: string
}

// TherapistPricing型の定義
type TherapistPricing = {
  id: string
  therapist_id: string
  nomination_fee: number
  confirmed_nomination_fee: number
  princess_reservation_fee: number
  created_at: string
}

type SystemSettings = {
  id: string
  default_nomination_fee: number
  default_confirmed_nomination_fee: number
  default_princess_reservation_fee: number
  created_at: string
}

export default function SystemPage() {
  const [activeTab, setActiveTab] = useState<'courses' | 'options' | 'therapist_pricing' | 'pricing_defaults'>('courses')
  
  // Coursesの状態
  const [courses, setCourses] = useState<Course[]>([])
  const [coursesLoading, setCoursesLoading] = useState(true)
  const [showCourseForm, setShowCourseForm] = useState(false)
  const [editingCourse, setEditingCourse] = useState<Course | null>(null)
  const [coursesFormData, setCoursesFormData] = useState({
    name: '',
    duration: 60,
    base_price: 6000,
    description: '',
    is_active: true,
    display_order: 0,
  })

  // Optionsの状態
  const [options, setOptions] = useState<Option[]>([])
  const [optionsLoading, setOptionsLoading] = useState(true)
  const [showOptionForm, setShowOptionForm] = useState(false)
  const [editingOption, setEditingOption] = useState<Option | null>(null)
  const [optionsFormData, setOptionsFormData] = useState({
    name: '',
    duration: 0,
    price: 0,
    description: '',
    is_active: true,
    display_order: 0,
  })

  // Therapist Pricingの状態
  const [therapists, setTherapists] = useState<Therapist[]>([])
  const [therapistPricings, setTherapistPricings] = useState<TherapistPricing[]>([])
  const [pricingLoading, setPricingLoading] = useState(true)
  const [editingPricing, setEditingPricing] = useState<TherapistPricing | null>(null)
  const [pricingFormData, setPricingFormData] = useState({
    nomination_fee: 0,
    confirmed_nomination_fee: 0,
    princess_reservation_fee: 0,
  })

  // System Settingsの状態
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null)
  const [settingsFormData, setSettingsFormData] = useState({
    default_nomination_fee: 0,
    default_confirmed_nomination_fee: 0,
    default_princess_reservation_fee: 0,
  })
  const [settingsLoading, setSettingsLoading] = useState(true)

  useEffect(() => {
    fetchCourses()
    fetchOptions()
    fetchTherapistsAndPricing()
    fetchSystemSettings()
  }, [])

  // ===== Courses Functions =====
  const fetchCourses = async () => {
    try {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .order('display_order', { ascending: true })
      
      if (error) throw error
      setCourses(data || [])
    } catch (error) {
      console.error('コースの取得に失敗:', error)
      alert('コースの取得に失敗しました')
    } finally {
      setCoursesLoading(false)
    }
  }

  const handleCourseSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      if (editingCourse) {
        const { error } = await supabase
          .from('courses')
          .update({
            ...coursesFormData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingCourse.id)
        
        if (error) throw error
        alert('コースを更新しました')
      } else {
        const { error } = await supabase
          .from('courses')
          .insert([coursesFormData])
        
        if (error) throw error
        alert('コースを登録しました')
      }
      
      resetCourseForm()
      fetchCourses()
    } catch (error) {
      console.error('保存に失敗:', error)
      alert('保存に失敗しました')
    }
  }

  const handleCourseEdit = (course: Course) => {
    setEditingCourse(course)
    setCoursesFormData({
      name: course.name,
      duration: course.duration,
      base_price: course.base_price,
      description: course.description || '',
      is_active: course.is_active,
      display_order: course.display_order,
    })
    setShowCourseForm(true)
  }

  const handleCourseDelete = async (id: string) => {
    if (!confirm('本当に削除しますか？')) return
    
    try {
      const { error } = await supabase
        .from('courses')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      alert('コースを削除しました')
      fetchCourses()
    } catch (error) {
      console.error('削除に失敗:', error)
      alert('削除に失敗しました')
    }
  }

  const resetCourseForm = () => {
    setCoursesFormData({
      name: '',
      duration: 60,
      base_price: 6000,
      description: '',
      is_active: true,
      display_order: 0,
    })
    setEditingCourse(null)
    setShowCourseForm(false)
  }

  // ===== Options Functions =====
  const fetchOptions = async () => {
    try {
      const { data, error } = await supabase
        .from('options')
        .select('*')
        .order('display_order', { ascending: true })
      
      if (error) throw error
      setOptions(data || [])
    } catch (error) {
      console.error('オプションの取得に失敗:', error)
      alert('オプションの取得に失敗しました')
    } finally {
      setOptionsLoading(false)
    }
  }

  const handleOptionSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      if (editingOption) {
        const { error } = await supabase
          .from('options')
          .update({
            ...optionsFormData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingOption.id)
        
        if (error) throw error
        alert('オプションを更新しました')
      } else {
        const { error } = await supabase
          .from('options')
          .insert([optionsFormData])
        
        if (error) throw error
        alert('オプションを登録しました')
      }
      
      resetOptionForm()
      fetchOptions()
    } catch (error) {
      console.error('保存に失敗:', error)
      alert('保存に失敗しました')
    }
  }

  const handleOptionEdit = (option: Option) => {
    setEditingOption(option)
    setOptionsFormData({
      name: option.name,
      duration: option.duration,
      price: option.price,
      description: option.description || '',
      is_active: option.is_active,
      display_order: option.display_order,
    })
    setShowOptionForm(true)
  }

  const handleOptionDelete = async (id: string) => {
    if (!confirm('本当に削除しますか？')) return
    
    try {
      const { error } = await supabase
        .from('options')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      alert('オプションを削除しました')
      fetchOptions()
    } catch (error) {
      console.error('削除に失敗:', error)
      alert('削除に失敗しました')
    }
  }

  const resetOptionForm = () => {
    setOptionsFormData({
      name: '',
      duration: 0,
      price: 0,
      description: '',
      is_active: true,
      display_order: 0,
    })
    setEditingOption(null)
    setShowOptionForm(false)
  }

  // ===== Therapist Pricing Functions =====
  const fetchTherapistsAndPricing = async () => {
    try {
      const [therapistsRes, pricingsRes] = await Promise.all([
        supabase.from('therapists').select('id, name, created_at').order('name'),
        supabase.from('therapist_pricing').select('*'),
      ])

      if (therapistsRes.error) throw therapistsRes.error
      if (pricingsRes.error) throw pricingsRes.error

      setTherapists(therapistsRes.data || [])
      setTherapistPricings(pricingsRes.data || [])
    } catch (error) {
      console.error('セラピストと料金情報の取得に失敗:', error)
      alert('セラピストと料金情報の取得に失敗しました')
    } finally {
      setPricingLoading(false)
    }
  }

  const getPricingForTherapist = (therapistId: string): TherapistPricing | undefined => {
    return therapistPricings.find((p) => p.therapist_id === therapistId)
  }

  const handlePricingEdit = (therapistId: string) => {
    const pricing = getPricingForTherapist(therapistId)
    setEditingPricing(
      pricing || {
        id: '',
        therapist_id: therapistId,
        nomination_fee: 0,
        confirmed_nomination_fee: 0,
        princess_reservation_fee: 0,
        created_at: '',
      }
    )
    setPricingFormData({
      nomination_fee: pricing?.nomination_fee || 0,
      confirmed_nomination_fee: pricing?.confirmed_nomination_fee || 0,
      princess_reservation_fee: pricing?.princess_reservation_fee || 0,
    })
  }

  const handlePricingSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingPricing) {
      alert('セラピストを選択してください')
      return
    }

    try {
      const therapistId = editingPricing.therapist_id
      if (!therapistId) {
        alert('セラピストIDが取得できませんでした')
        return
      }
      const existing = getPricingForTherapist(therapistId)

      if (existing) {
        const { error } = await supabase
          .from('therapist_pricing')
          .update({
            ...pricingFormData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)

        if (error) throw error
        alert('料金設定を更新しました')
      } else {
        const { error } = await supabase
          .from('therapist_pricing')
          .insert([
            {
              therapist_id: therapistId,
              ...pricingFormData,
            },
          ])

        if (error) throw error
        alert('料金設定を登録しました')
      }

      resetPricingForm()
      fetchTherapistsAndPricing()
    } catch (error) {
      console.error('保存に失敗:', error)
      const err = error as { message?: string; code?: string; details?: string; hint?: string }
      const message = err?.message || ''
      const details = err?.details || ''
      const hint = err?.hint || ''
      const code = err?.code || ''
      const fallback = !message && !details && !hint && !code ? JSON.stringify(error) : ''

      if ((message + details + hint).includes('confirmed_nomination_fee')) {
        alert('本指名料のカラムが未反映の可能性があります。マイグレーションを実行してください。')
        return
      }

      alert(
        `保存に失敗しました: ${message || '不明なエラー'}\n` +
          `code: ${code || '-'}\n` +
          `details: ${details || '-'}\n` +
          `hint: ${hint || '-'}\n` +
          (fallback ? `raw: ${fallback}` : '')
      )
    }
  }

  const resetPricingForm = () => {
    setPricingFormData({
      nomination_fee: 0,
      confirmed_nomination_fee: 0,
      princess_reservation_fee: 0,
    })
    setEditingPricing(null)
  }

  // ===== System Settings Functions =====
  const fetchSystemSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)

      if (error) throw error
      const settings = data?.[0] || null
      setSystemSettings(settings)
      setSettingsFormData({
        default_nomination_fee: settings?.default_nomination_fee || 0,
        default_confirmed_nomination_fee: settings?.default_confirmed_nomination_fee || 0,
        default_princess_reservation_fee: settings?.default_princess_reservation_fee || 0,
      })
    } catch (error) {
      console.error('システム設定の取得に失敗:', error)
      alert('システム設定の取得に失敗しました')
    } finally {
      setSettingsLoading(false)
    }
  }

  const handleSettingsSave = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (systemSettings?.id) {
        const { error } = await supabase
          .from('system_settings')
          .update({
            ...settingsFormData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', systemSettings.id)

        if (error) throw error
        alert('料金デフォルトを更新しました')
      } else {
        const { error } = await supabase
          .from('system_settings')
          .insert([
            {
              ...settingsFormData,
            },
          ])

        if (error) throw error
        alert('料金デフォルトを登録しました')
      }

      fetchSystemSettings()
    } catch (error) {
      console.error('保存に失敗:', error)
      alert('保存に失敗しました')
    }
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">システム管理</h1>

      {/* タブナビゲーション */}
      <div className="flex space-x-4 mb-6 border-b">
        <button
          onClick={() => setActiveTab('courses')}
          className={`px-4 py-2 font-semibold border-b-2 transition-colors ${
            activeTab === 'courses'
              ? 'text-blue-600 border-blue-600'
              : 'text-gray-600 border-transparent hover:text-gray-900'
          }`}
        >
          コース管理
        </button>
        <button
          onClick={() => setActiveTab('options')}
          className={`px-4 py-2 font-semibold border-b-2 transition-colors ${
            activeTab === 'options'
              ? 'text-blue-600 border-blue-600'
              : 'text-gray-600 border-transparent hover:text-gray-900'
          }`}
        >
          オプション管理
        </button>
        <button
          onClick={() => setActiveTab('therapist_pricing')}
          className={`px-4 py-2 font-semibold border-b-2 transition-colors ${
            activeTab === 'therapist_pricing'
              ? 'text-blue-600 border-blue-600'
              : 'text-gray-600 border-transparent hover:text-gray-900'
          }`}
        >
          セラピスト料金設定
        </button>
        <button
          onClick={() => setActiveTab('pricing_defaults')}
          className={`px-4 py-2 font-semibold border-b-2 transition-colors ${
            activeTab === 'pricing_defaults'
              ? 'text-blue-600 border-blue-600'
              : 'text-gray-600 border-transparent hover:text-gray-900'
          }`}
        >
          料金デフォルト
        </button>
      </div>

      {/* コース管理タブ */}
      {activeTab === 'courses' && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">コース管理</h2>
            <button
              onClick={() => setShowCourseForm(!showCourseForm)}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              {showCourseForm ? 'キャンセル' : '新規登録'}
            </button>
          </div>

          {/* コース登録・編集フォーム */}
          {showCourseForm && (
            <div className="bg-white p-6 rounded-lg shadow-md mb-6">
              <h3 className="text-lg font-semibold mb-4">
                {editingCourse ? 'コース編集' : 'コース新規登録'}
              </h3>
              <form onSubmit={handleCourseSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">コース名</label>
                  <input
                    type="text"
                    value={coursesFormData.name}
                    onChange={(e) => setCoursesFormData({ ...coursesFormData, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded"
                    required
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">施術時間（分）</label>
                    <input
                      type="number"
                      value={coursesFormData.duration}
                      onChange={(e) => setCoursesFormData({ ...coursesFormData, duration: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border rounded"
                      min="0"
                      step="5"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">基本料金（円）</label>
                    <input
                      type="number"
                      value={coursesFormData.base_price}
                      onChange={(e) => setCoursesFormData({ ...coursesFormData, base_price: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border rounded"
                      min="0"
                      step="100"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">説明</label>
                  <textarea
                    value={coursesFormData.description}
                    onChange={(e) => setCoursesFormData({ ...coursesFormData, description: e.target.value })}
                    className="w-full px-3 py-2 border rounded"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">表示順</label>
                    <input
                      type="number"
                      value={coursesFormData.display_order}
                      onChange={(e) => setCoursesFormData({ ...coursesFormData, display_order: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border rounded"
                      min="0"
                    />
                  </div>
                  
                  <div>
                    <label className="flex items-center space-x-2 mt-7">
                      <input
                        type="checkbox"
                        checked={coursesFormData.is_active}
                        onChange={(e) => setCoursesFormData({ ...coursesFormData, is_active: e.target.checked })}
                        className="w-4 h-4"
                      />
                      <span className="text-sm font-medium">有効</span>
                    </label>
                  </div>
                </div>

                <div className="flex space-x-2">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                  >
                    {editingCourse ? '更新' : '登録'}
                  </button>
                  <button
                    type="button"
                    onClick={resetCourseForm}
                    className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
                  >
                    キャンセル
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* コース一覧 */}
          {coursesLoading ? (
            <div className="text-center text-gray-500">読み込み中...</div>
          ) : (
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">順序</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">コース名</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">時間</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">料金</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">状態</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {courses.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                        コースが登録されていません
                      </td>
                    </tr>
                  ) : (
                    courses.map((course) => (
                      <tr key={course.id} className={!course.is_active ? 'bg-gray-100' : ''}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{course.display_order}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{course.name}</div>
                          {course.description && (
                            <div className="text-sm text-gray-500">{course.description}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{course.duration}分</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">¥{course.base_price.toLocaleString()}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            course.is_active 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {course.is_active ? '有効' : '無効'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                          <button
                            onClick={() => handleCourseEdit(course)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            編集
                          </button>
                          <button
                            onClick={() => handleCourseDelete(course.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            削除
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* オプション管理タブ */}
      {activeTab === 'options' && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">オプション管理</h2>
            <button
              onClick={() => setShowOptionForm(!showOptionForm)}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              {showOptionForm ? 'キャンセル' : '新規登録'}
            </button>
          </div>

          {/* オプション登録・編集フォーム */}
          {showOptionForm && (
            <div className="bg-white p-6 rounded-lg shadow-md mb-6">
              <h3 className="text-lg font-semibold mb-4">
                {editingOption ? 'オプション編集' : 'オプション新規登録'}
              </h3>
              <form onSubmit={handleOptionSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">オプション名</label>
                  <input
                    type="text"
                    value={optionsFormData.name}
                    onChange={(e) => setOptionsFormData({ ...optionsFormData, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded"
                    required
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">追加時間（分）</label>
                    <input
                      type="number"
                      value={optionsFormData.duration}
                      onChange={(e) => setOptionsFormData({ ...optionsFormData, duration: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border rounded"
                      min="0"
                      step="5"
                    />
                    <p className="text-xs text-gray-500 mt-1">0分の場合は時間追加なし</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">料金（円）</label>
                    <input
                      type="number"
                      value={optionsFormData.price}
                      onChange={(e) => setOptionsFormData({ ...optionsFormData, price: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border rounded"
                      min="0"
                      step="100"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">説明</label>
                  <textarea
                    value={optionsFormData.description}
                    onChange={(e) => setOptionsFormData({ ...optionsFormData, description: e.target.value })}
                    className="w-full px-3 py-2 border rounded"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">表示順</label>
                    <input
                      type="number"
                      value={optionsFormData.display_order}
                      onChange={(e) => setOptionsFormData({ ...optionsFormData, display_order: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border rounded"
                      min="0"
                    />
                  </div>
                  
                  <div>
                    <label className="flex items-center space-x-2 mt-7">
                      <input
                        type="checkbox"
                        checked={optionsFormData.is_active}
                        onChange={(e) => setOptionsFormData({ ...optionsFormData, is_active: e.target.checked })}
                        className="w-4 h-4"
                      />
                      <span className="text-sm font-medium">有効</span>
                    </label>
                  </div>
                </div>

                <div className="flex space-x-2">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                  >
                    {editingOption ? '更新' : '登録'}
                  </button>
                  <button
                    type="button"
                    onClick={resetOptionForm}
                    className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
                  >
                    キャンセル
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* オプション一覧 */}
          {optionsLoading ? (
            <div className="text-center text-gray-500">読み込み中...</div>
          ) : (
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">順序</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">オプション名</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">追加時間</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">料金</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">状態</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {options.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                        オプションが登録されていません
                      </td>
                    </tr>
                  ) : (
                    options.map((option) => (
                      <tr key={option.id} className={!option.is_active ? 'bg-gray-100' : ''}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{option.display_order}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{option.name}</div>
                          {option.description && (
                            <div className="text-sm text-gray-500">{option.description}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {option.duration > 0 ? `+${option.duration}分` : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">¥{option.price.toLocaleString()}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            option.is_active 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {option.is_active ? '有効' : '無効'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                          <button
                            onClick={() => handleOptionEdit(option)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            編集
                          </button>
                          <button
                            onClick={() => handleOptionDelete(option.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            削除
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* セラピスト料金設定タブ */}
      {activeTab === 'therapist_pricing' && (
        <div>
          <h2 className="text-xl font-semibold mb-6">セラピスト料金設定</h2>

          {pricingLoading ? (
            <div className="text-center text-gray-500">読み込み中...</div>
          ) : (
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">セラピスト名</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">指名料（円）</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">本指名料（円）</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">姫予約料金（円）</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {therapists.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                        セラピストが登録されていません
                      </td>
                    </tr>
                  ) : (
                    therapists.map((therapist) => {
                      const pricing = getPricingForTherapist(therapist.id)
                      return (
                        <tr key={therapist.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{therapist.name}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">¥{(pricing?.nomination_fee || 0).toLocaleString()}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">¥{(pricing?.confirmed_nomination_fee || 0).toLocaleString()}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">¥{(pricing?.princess_reservation_fee || 0).toLocaleString()}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <button
                              onClick={() => handlePricingEdit(therapist.id)}
                              className="text-blue-600 hover:text-blue-900 font-semibold"
                            >
                              編集
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* 料金編集モーダル */}
          {editingPricing && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 mt-8">
              <div className="bg-white rounded-lg shadow-lg p-6 w-96 max-w-full mx-4">
                <h3 className="text-lg font-bold mb-4">
                  {therapists.find((t) => t.id === editingPricing.therapist_id)?.name || ''} - 料金設定
                </h3>
                <form onSubmit={handlePricingSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">指名料（円）</label>
                    <input
                      type="number"
                      value={pricingFormData.nomination_fee}
                      onChange={(e) =>
                        setPricingFormData({
                          ...pricingFormData,
                          nomination_fee: Number(e.target.value || 0),
                        })
                      }
                      className="w-full px-3 py-2 border rounded"
                      min="0"
                      step="100"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">初回利用時に適用される指名料です</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">本指名料（円）</label>
                    <input
                      type="number"
                      value={pricingFormData.confirmed_nomination_fee}
                      onChange={(e) =>
                        setPricingFormData({
                          ...pricingFormData,
                          confirmed_nomination_fee: Number(e.target.value || 0),
                        })
                      }
                      className="w-full px-3 py-2 border rounded"
                      min="0"
                      step="100"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">リピート利用時に適用される本指名料です</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">姫予約料金（円）</label>
                    <input
                      type="number"
                      value={pricingFormData.princess_reservation_fee}
                      onChange={(e) =>
                        setPricingFormData({
                          ...pricingFormData,
                          princess_reservation_fee: Number(e.target.value || 0),
                        })
                      }
                      className="w-full px-3 py-2 border rounded"
                      min="0"
                      step="100"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">姫予約時に適用される料金です</p>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={resetPricingForm}
                      className="flex-1 px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
                    >
                      キャンセル
                    </button>
                    <button
                      type="submit"
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      保存
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'pricing_defaults' && (
        <div>
          <h2 className="text-xl font-semibold mb-6">料金デフォルト設定</h2>
          {settingsLoading ? (
            <div className="text-center text-gray-500">読み込み中...</div>
          ) : (
            <form onSubmit={handleSettingsSave} className="bg-white p-6 rounded-lg shadow-md space-y-4 max-w-xl">
              <div>
                <label className="block text-sm font-medium mb-1">指名料（円）</label>
                <input
                  type="number"
                  value={settingsFormData.default_nomination_fee}
                  onChange={(e) =>
                    setSettingsFormData({
                      ...settingsFormData,
                      default_nomination_fee: Number(e.target.value || 0),
                    })
                  }
                  className="w-full px-3 py-2 border rounded"
                  min="0"
                  step="100"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">セラピスト個別設定がない場合に適用されます</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">本指名料（円）</label>
                <input
                  type="number"
                  value={settingsFormData.default_confirmed_nomination_fee}
                  onChange={(e) =>
                    setSettingsFormData({
                      ...settingsFormData,
                      default_confirmed_nomination_fee: Number(e.target.value || 0),
                    })
                  }
                  className="w-full px-3 py-2 border rounded"
                  min="0"
                  step="100"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">セラピスト個別設定がない場合に適用されます</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">姫予約料金（円）</label>
                <input
                  type="number"
                  value={settingsFormData.default_princess_reservation_fee}
                  onChange={(e) =>
                    setSettingsFormData({
                      ...settingsFormData,
                      default_princess_reservation_fee: Number(e.target.value || 0),
                    })
                  }
                  className="w-full px-3 py-2 border rounded"
                  min="0"
                  step="100"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">セラピスト個別設定がない場合に適用されます</p>
              </div>
              <div className="pt-2">
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                  保存
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
