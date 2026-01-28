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

export default function SystemPage() {
  const [activeTab, setActiveTab] = useState<'courses' | 'options'>('courses')
  
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

  useEffect(() => {
    fetchCourses()
    fetchOptions()
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
    </div>
  )
}
