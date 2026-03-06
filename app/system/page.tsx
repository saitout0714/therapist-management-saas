'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useShop } from '@/app/contexts/ShopContext'

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
  shop_id: string
  default_nomination_fee: number
  default_confirmed_nomination_fee: number
  default_princess_reservation_fee: number
  created_at: string
}

export default function SystemPage() {
  const { selectedShop } = useShop()
  const [activeTab, setActiveTab] = useState<'courses' | 'options' | 'pricing_defaults'>('courses')

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
    fetchSystemSettings()
  }, [selectedShop])

  // ===== Courses Functions =====
  const fetchCourses = async () => {
    try {
      if (!selectedShop) return
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('shop_id', selectedShop.id)
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
        if (!selectedShop) {
          alert('店舗を選択してください')
          return
        }
        const { error } = await supabase
          .from('courses')
          .insert([
            {
              ...coursesFormData,
              shop_id: selectedShop.id,
            },
          ])

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
      if (!selectedShop) return
      const { data, error } = await supabase
        .from('options')
        .select('*')
        .eq('shop_id', selectedShop.id)
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
        if (!selectedShop) {
          alert('店舗を選択してください')
          return
        }
        const { error } = await supabase
          .from('options')
          .insert([
            {
              ...optionsFormData,
              shop_id: selectedShop.id,
            },
          ])

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



  // ===== System Settings Functions =====
  const fetchSystemSettings = async () => {
    try {
      if (!selectedShop) return
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .eq('shop_id', selectedShop.id)
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
      if (!selectedShop) {
        alert('店舗を選択してください')
        return
      }

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
              shop_id: selectedShop.id,
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
    <div className="min-h-screen bg-slate-50/50 p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">システム管理</h1>
          <p className="text-sm text-slate-500 mt-1">コース、オプション、基本指名料などのシステム設定を管理します。</p>
        </div>

        {/* タブナビゲーション */}
        <div className="flex space-x-1 mb-6 border-b border-slate-200 overflow-x-auto whitespace-nowrap pb-px">
          {[
            { id: 'courses', label: 'コース管理' },
            { id: 'options', label: 'オプション管理' },
            { id: 'pricing_defaults', label: '指名料デフォルト' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-6 py-3 font-medium text-sm transition-all relative rounded-t-xl ${activeTab === tab.id
                  ? 'text-indigo-600 bg-white border-t border-l border-r border-slate-200'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/50'
                }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute -bottom-px left-0 w-full h-0.5 bg-white"></div>
              )}
            </button>
          ))}
        </div>

        {/* コース管理タブ */}
        {activeTab === 'courses' && (
          <div className="animate-in fade-in duration-300">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-800">コース一覧</h2>
              <button
                onClick={() => setShowCourseForm(!showCourseForm)}
                className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl shadow-sm hover:bg-indigo-700 hover:shadow transition-all active:scale-95"
              >
                {showCourseForm ? (
                  <span className="flex items-center gap-1.5"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>キャンセル</span>
                ) : (
                  <span className="flex items-center gap-1.5"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>新規コース登録</span>
                )}
              </button>
            </div>

            {/* コース登録・編集フォーム */}
            {showCourseForm && (
              <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-100 mb-8 border-t-4 border-t-indigo-500">
                <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </span>
                  {editingCourse ? 'コースの編集' : '新しいコースを登録'}
                </h3>
                <form onSubmit={handleCourseSubmit} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">コース名</label>
                    <input
                      type="text"
                      value={coursesFormData.name}
                      onChange={(e) => setCoursesFormData({ ...coursesFormData, name: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                      placeholder="例: ベーシックコース"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">施術時間（分）</label>
                      <input
                        type="number"
                        value={coursesFormData.duration}
                        onChange={(e) => setCoursesFormData({ ...coursesFormData, duration: parseInt(e.target.value) })}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                        min="0"
                        step="5"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">基本料金（円）</label>
                      <input
                        type="number"
                        value={coursesFormData.base_price}
                        onChange={(e) => setCoursesFormData({ ...coursesFormData, base_price: parseInt(e.target.value) })}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                        min="0"
                        step="100"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">説明</label>
                    <textarea
                      value={coursesFormData.description}
                      onChange={(e) => setCoursesFormData({ ...coursesFormData, description: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                      rows={3}
                      placeholder="コースの詳細を入力（任意）"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-end">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">表示順</label>
                      <input
                        type="number"
                        value={coursesFormData.display_order}
                        onChange={(e) => setCoursesFormData({ ...coursesFormData, display_order: parseInt(e.target.value) })}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                        min="0"
                      />
                    </div>

                    <div className="pb-2.5">
                      <label className="flex items-center space-x-3 cursor-pointer group">
                        <div className="relative flex items-center">
                          <input
                            type="checkbox"
                            checked={coursesFormData.is_active}
                            onChange={(e) => setCoursesFormData({ ...coursesFormData, is_active: e.target.checked })}
                            className="peer sr-only"
                          />
                          <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600 transition-colors"></div>
                        </div>
                        <span className="text-sm font-bold text-slate-700 select-none group-hover:text-indigo-600 transition-colors">{coursesFormData.is_active ? '有効' : '無効'}</span>
                      </label>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-5 mt-2 border-t border-slate-100 justify-end">
                    <button
                      type="button"
                      onClick={resetCourseForm}
                      className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 font-medium rounded-xl hover:bg-slate-50 transition-colors"
                    >
                      キャンセル
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-xl shadow-sm hover:bg-indigo-700 hover:shadow transition-all active:scale-95 flex items-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      {editingCourse ? '更新する' : '登録する'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* コース一覧 */}
            {coursesLoading ? (
              <div className="flex justify-center items-center py-20 text-indigo-600">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                <span className="ml-3 font-medium">読み込み中...</span>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">順位</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">コース名</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider hidden md:table-cell">時間</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider hidden sm:table-cell">料金</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">状態</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {courses.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                            コースが登録されていません。上のボタンから追加してください。
                          </td>
                        </tr>
                      ) : (
                        courses.map((course) => (
                          <tr key={course.id} className={`hover:bg-slate-50/50 hover:-translate-y-[1px] hover:shadow-sm transition-all ${!course.is_active ? 'opacity-60 bg-slate-50/30' : ''}`}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-medium">#{course.display_order}</td>
                            <td className="px-6 py-4 min-w-[200px]">
                              <div className="text-sm font-bold text-slate-800">{course.name}</div>
                              {course.description && (
                                <div className="text-xs text-slate-500 mt-1 line-clamp-1">{course.description}</div>
                              )}
                              {/* モバイルのみ表示するメタデータ */}
                              <div className="mt-1 text-xs text-slate-500 sm:hidden">
                                {course.duration}分 / ¥{course.base_price.toLocaleString()}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-medium hidden md:table-cell">{course.duration} <span className="text-xs text-slate-400 font-normal">MIN</span></td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-800 hidden sm:table-cell"><span className="text-xs font-normal text-slate-500 mr-0.5">¥</span>{course.base_price.toLocaleString()}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${course.is_active
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                : 'bg-slate-100 border-slate-200 text-slate-600'
                                }`}>
                                {course.is_active ? (
                                  <><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>有効</>
                                ) : (
                                  <><span className="w-1.5 h-1.5 rounded-full bg-slate-400 mr-1.5"></span>無効</>
                                )}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleCourseEdit(course)}
                                  className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                  title="編集"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                                </button>
                                <button
                                  onClick={() => handleCourseDelete(course.id)}
                                  className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                                  title="削除"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* オプション管理タブ */}
        {activeTab === 'options' && (
          <div className="animate-in fade-in duration-300">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-800">オプション一覧</h2>
              <button
                onClick={() => setShowOptionForm(!showOptionForm)}
                className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl shadow-sm hover:bg-indigo-700 hover:shadow transition-all active:scale-95"
              >
                {showOptionForm ? (
                  <span className="flex items-center gap-1.5"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>キャンセル</span>
                ) : (
                  <span className="flex items-center gap-1.5"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>新規オプション登録</span>
                )}
              </button>
            </div>

            {/* オプション登録・編集フォーム */}
            {showOptionForm && (
              <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-100 mb-8 border-t-4 border-t-indigo-500">
                <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                    </svg>
                  </span>
                  {editingOption ? 'オプションの編集' : '新しいオプションを登録'}
                </h3>
                <form onSubmit={handleOptionSubmit} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">オプション名</label>
                    <input
                      type="text"
                      value={optionsFormData.name}
                      onChange={(e) => setOptionsFormData({ ...optionsFormData, name: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                      placeholder="例: アロマ追加"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">追加時間（分）</label>
                      <input
                        type="number"
                        value={optionsFormData.duration}
                        onChange={(e) => setOptionsFormData({ ...optionsFormData, duration: parseInt(e.target.value) })}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                        min="0"
                        step="5"
                      />
                      <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        0分の場合は時間追加なし
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">料金（円）</label>
                      <input
                        type="number"
                        value={optionsFormData.price}
                        onChange={(e) => setOptionsFormData({ ...optionsFormData, price: parseInt(e.target.value) })}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                        min="0"
                        step="100"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">説明</label>
                    <textarea
                      value={optionsFormData.description}
                      onChange={(e) => setOptionsFormData({ ...optionsFormData, description: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                      rows={3}
                      placeholder="オプションの詳細を入力（任意）"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-end">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">表示順</label>
                      <input
                        type="number"
                        value={optionsFormData.display_order}
                        onChange={(e) => setOptionsFormData({ ...optionsFormData, display_order: parseInt(e.target.value) })}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                        min="0"
                      />
                    </div>

                    <div className="pb-2.5">
                      <label className="flex items-center space-x-3 cursor-pointer group">
                        <div className="relative flex items-center">
                          <input
                            type="checkbox"
                            checked={optionsFormData.is_active}
                            onChange={(e) => setOptionsFormData({ ...optionsFormData, is_active: e.target.checked })}
                            className="peer sr-only"
                          />
                          <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600 transition-colors"></div>
                        </div>
                        <span className="text-sm font-bold text-slate-700 select-none group-hover:text-indigo-600 transition-colors">{optionsFormData.is_active ? '有効' : '無効'}</span>
                      </label>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-5 mt-2 border-t border-slate-100 justify-end">
                    <button
                      type="button"
                      onClick={resetOptionForm}
                      className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 font-medium rounded-xl hover:bg-slate-50 transition-colors"
                    >
                      キャンセル
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-xl shadow-sm hover:bg-indigo-700 hover:shadow transition-all active:scale-95 flex items-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      {editingOption ? '更新する' : '登録する'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* オプション一覧 */}
            {optionsLoading ? (
              <div className="flex justify-center items-center py-20 text-indigo-600">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                <span className="ml-3 font-medium">読み込み中...</span>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">順位</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">オプション名</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider hidden md:table-cell">追加時間</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider hidden sm:table-cell">料金</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">状態</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {options.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                            オプションが登録されていません。上のボタンから追加してください。
                          </td>
                        </tr>
                      ) : (
                        options.map((option) => (
                          <tr key={option.id} className={`hover:bg-slate-50/50 hover:-translate-y-[1px] hover:shadow-sm transition-all ${!option.is_active ? 'opacity-60 bg-slate-50/30' : ''}`}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-medium">#{option.display_order}</td>
                            <td className="px-6 py-4 min-w-[200px]">
                              <div className="text-sm font-bold text-slate-800">{option.name}</div>
                              {option.description && (
                                <div className="text-xs text-slate-500 mt-1 line-clamp-1">{option.description}</div>
                              )}
                              {/* モバイルのみ表示するメタデータ */}
                              <div className="mt-1 text-xs text-slate-500 sm:hidden">
                                {option.duration > 0 ? `+${option.duration}分` : '-'} / ¥{option.price.toLocaleString()}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-medium hidden md:table-cell">
                              {option.duration > 0 ? <span className="text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded">+{option.duration}分</span> : <span className="text-slate-400">-</span>}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-800 hidden sm:table-cell"><span className="text-xs font-normal text-slate-500 mr-0.5">¥</span>{option.price.toLocaleString()}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${option.is_active
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                : 'bg-slate-100 border-slate-200 text-slate-600'
                                }`}>
                                {option.is_active ? (
                                  <><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>有効</>
                                ) : (
                                  <><span className="w-1.5 h-1.5 rounded-full bg-slate-400 mr-1.5"></span>無効</>
                                )}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleOptionEdit(option)}
                                  className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                  title="編集"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                                </button>
                                <button
                                  onClick={() => handleOptionDelete(option.id)}
                                  className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                                  title="削除"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}



        {activeTab === 'pricing_defaults' && (
          <div className="animate-in fade-in duration-300">
            <h2 className="text-xl font-bold text-slate-800 mb-6">指名料デフォルト設定</h2>

            {settingsLoading ? (
              <div className="flex justify-center items-center py-20 text-indigo-600">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                <span className="ml-3 font-medium">読み込み中...</span>
              </div>
            ) : (
              <form onSubmit={handleSettingsSave} className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-100 mb-8 border-t-4 border-t-indigo-500 max-w-2xl">
                <div className="mb-6 flex items-start gap-3 p-4 bg-indigo-50 text-indigo-800 rounded-xl">
                  <svg className="w-6 h-6 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <p className="text-sm font-medium leading-relaxed">ここで設定した料金は、セラピストごとの個別設定がない場合の基準価格として予約時に適用されます。</p>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">指名料（通常）</label>
                    <div className="relative max-w-sm">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <span className="text-slate-400 font-bold">¥</span>
                      </div>
                      <input
                        type="number"
                        value={settingsFormData.default_nomination_fee}
                        onChange={(e) =>
                          setSettingsFormData({
                            ...settingsFormData,
                            default_nomination_fee: Number(e.target.value || 0),
                          })
                        }
                        className="w-full pl-9 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all text-slate-800 font-bold text-lg"
                        min="0"
                        step="100"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">本指名料</label>
                    <div className="relative max-w-sm">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <span className="text-slate-400 font-bold">¥</span>
                      </div>
                      <input
                        type="number"
                        value={settingsFormData.default_confirmed_nomination_fee}
                        onChange={(e) =>
                          setSettingsFormData({
                            ...settingsFormData,
                            default_confirmed_nomination_fee: Number(e.target.value || 0),
                          })
                        }
                        className="w-full pl-9 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all text-slate-800 font-bold text-lg"
                        min="0"
                        step="100"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">姫（優先）予約料金</label>
                    <div className="relative max-w-sm">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <span className="text-slate-400 font-bold">¥</span>
                      </div>
                      <input
                        type="number"
                        value={settingsFormData.default_princess_reservation_fee}
                        onChange={(e) =>
                          setSettingsFormData({
                            ...settingsFormData,
                            default_princess_reservation_fee: Number(e.target.value || 0),
                          })
                        }
                        className="w-full pl-9 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all text-slate-800 font-bold text-lg"
                        min="0"
                        step="100"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-6 mt-6 border-t border-slate-100 flex justify-end">
                  <button type="submit" className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-sm hover:bg-indigo-700 hover:shadow transition-all active:scale-95 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    設定を保存する
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
