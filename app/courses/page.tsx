'use client'
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useShop } from '@/app/contexts/ShopContext'

type Course = {
  id: string
  name: string
  duration: number
  base_price: number
  description: string | null
  is_active: boolean
  display_order: number
}

export default function CoursesPage() {
  const { selectedShop } = useShop()
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingCourse, setEditingCourse] = useState<Course | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    duration: 60,
    base_price: 6000,
    description: '',
    is_active: true,
    display_order: 0,
  })

  async function fetchCourses() {
    if (!selectedShop) {
      setCourses([])
      setLoading(false)
      return
    }

    setLoading(true)
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .eq('shop_id', selectedShop.id)
      .order('display_order', { ascending: true })

    if (error) {
      alert('コースの取得に失敗しました')
    } else {
      setCourses((data as Course[]) || [])
    }
    setLoading(false)
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedShop) {
      alert('店舗を選択してください')
      return
    }

    const payload = {
      ...formData,
      shop_id: selectedShop.id,
      updated_at: new Date().toISOString(),
    }

    const result = editingCourse
      ? await supabase.from('courses').update(payload).eq('id', editingCourse.id)
      : await supabase.from('courses').insert([{ ...payload }])

    if (result.error) {
      alert('保存に失敗しました')
      return
    }

    resetForm()
    void fetchCourses()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('本当に削除しますか？')) return
    const { error } = await supabase.from('courses').delete().eq('id', id)
    if (error) {
      alert('削除に失敗しました')
      return
    }
    void fetchCourses()
  }

  useEffect(() => {
    void fetchCourses()
  }, [selectedShop])

  if (loading) return <div className="p-6">読み込み中...</div>

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">コース管理</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg"
        >
          {showForm ? 'キャンセル' : '新規登録'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl border mb-6 space-y-4">
          <input className="w-full border rounded px-3 py-2" placeholder="コース名" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
          <div className="grid grid-cols-2 gap-3">
            <input type="number" className="border rounded px-3 py-2" placeholder="施術時間（分）" value={formData.duration} onChange={(e) => setFormData({ ...formData, duration: Number(e.target.value) })} min={0} />
            <input type="number" className="border rounded px-3 py-2" placeholder="基本料金（円）" value={formData.base_price} onChange={(e) => setFormData({ ...formData, base_price: Number(e.target.value) })} min={0} />
          </div>
          <textarea className="w-full border rounded px-3 py-2" placeholder="説明" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
          <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-lg">{editingCourse ? '更新' : '登録'}</button>
        </form>
      )}

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50">
            <tr>
              <th className="p-3">順序</th>
              <th className="p-3">コース名</th>
              <th className="p-3">時間</th>
              <th className="p-3">料金</th>
              <th className="p-3">状態</th>
              <th className="p-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {courses.map((course) => (
              <tr key={course.id} className="border-t">
                <td className="p-3">{course.display_order}</td>
                <td className="p-3">{course.name}</td>
                <td className="p-3">{course.duration}分</td>
                <td className="p-3">¥{course.base_price.toLocaleString()}</td>
                <td className="p-3">{course.is_active ? '有効' : '無効'}</td>
                <td className="p-3 space-x-3">
                  <button
                    className="text-indigo-600"
                    onClick={() => {
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
                    }}
                  >
                    編集
                  </button>
                  <button className="text-rose-600" onClick={() => void handleDelete(course.id)}>削除</button>
                </td>
              </tr>
            ))}
            {courses.length === 0 && (
              <tr>
                <td className="p-6 text-center text-slate-500" colSpan={6}>コースがありません</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
