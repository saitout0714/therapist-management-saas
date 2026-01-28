'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

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

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingCourse, setEditingCourse] = useState<Course | null>(null)
  
  // フォームの状態
  const [formData, setFormData] = useState({
    name: '',
    duration: 60,
    base_price: 6000,
    description: '',
    is_active: true,
    display_order: 0,
  })

  useEffect(() => {
    fetchCourses()
  }, [])

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
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      if (editingCourse) {
        // 更新
        const { error } = await supabase
          .from('courses')
          .update({
            ...formData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingCourse.id)
        
        if (error) throw error
        alert('コースを更新しました')
      } else {
        // 新規作成
        const { error } = await supabase
          .from('courses')
          .insert([formData])
        
        if (error) throw error
        alert('コースを登録しました')
      }
      
      resetForm()
      fetchCourses()
    } catch (error) {
      console.error('保存に失敗:', error)
      alert('保存に失敗しました')
    }
  }

  const handleEdit = (course: Course) => {
    setEditingCourse(course)
    setFormData({
      name: course.name,
      duration: course.duration,
      base_price: course.base_price,
      description: course.description || '',
      is_active: course.is_active,
      display_order: course.display_order,
    })
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
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

  const resetForm = () => {
    setFormData({
      name: '',
      duration: 60,
      base_price: 6000,
      description: '',
      is_active: true,
      display_order: 0,
    })
    setEditingCourse(null)
    setShowForm(false)
  }

  if (loading) {
    return <div className="p-8">読み込み中...</div>
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">コース管理</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          {showForm ? 'キャンセル' : '新規登録'}
        </button>
      </div>

      {/* 登録・編集フォーム */}
      {showForm && (
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <h2 className="text-xl font-semibold mb-4">
            {editingCourse ? 'コース編集' : 'コース新規登録'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">コース名</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border rounded"
                required
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">施術時間（分）</label>
                <input
                  type="number"
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
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
                  value={formData.base_price}
                  onChange={(e) => setFormData({ ...formData, base_price: parseInt(e.target.value) })}
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
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border rounded"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">表示順</label>
                <input
                  type="number"
                  value={formData.display_order}
                  onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border rounded"
                  min="0"
                />
              </div>
              
              <div>
                <label className="flex items-center space-x-2 mt-7">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
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
                onClick={resetForm}
                className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
              >
                キャンセル
              </button>
            </div>
          </form>
        </div>
      )}

      {/* コース一覧 */}
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
                      onClick={() => handleEdit(course)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      編集
                    </button>
                    <button
                      onClick={() => handleDelete(course.id)}
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
    </div>
  )
}
