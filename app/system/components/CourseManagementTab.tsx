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
    includes_nomination_fee: boolean
}

export function CourseManagementTab() {
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
        includes_nomination_fee: false,
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
            includes_nomination_fee: false,
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
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-lg font-bold text-slate-800">コース管理</h2>
                    <p className="text-sm text-slate-500 mt-1">施術コースの料金・時間・表示順を編集します。</p>
                </div>
                <button
                    onClick={() => setShowForm((v) => !v)}
                    className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                >
                    {showForm ? 'キャンセル' : '新規登録'}
                </button>
            </div>

            {showForm && (
                <form onSubmit={handleSubmit} className="bg-slate-50 p-6 rounded-xl border border-slate-200 mb-6 space-y-4">
                    <input className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500/50 outline-none" placeholder="コース名" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <input type="number" className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500/50 outline-none" placeholder="施術時間（分）" value={formData.duration} onChange={(e) => setFormData({ ...formData, duration: Number(e.target.value) })} min={0} />
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">¥</span>
                            <input type="number" className="w-full border border-slate-200 rounded-lg pl-8 pr-4 py-2.5 focus:ring-2 focus:ring-indigo-500/50 outline-none" placeholder="基本料金" value={formData.base_price} onChange={(e) => setFormData({ ...formData, base_price: Number(e.target.value) })} min={0} />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <label className="flex items-center gap-2 text-sm text-slate-700">
                            <input type="checkbox" className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4" checked={formData.is_active} onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })} />
                            有効にする
                        </label>
                        <label className="flex items-center gap-2 text-sm text-slate-700">
                            <input type="checkbox" className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4" checked={formData.includes_nomination_fee} onChange={(e) => setFormData({ ...formData, includes_nomination_fee: e.target.checked })} />
                            指名料込みコース
                        </label>
                        <input type="number" className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500/50 outline-none" placeholder="表示順（小さい順）" value={formData.display_order} onChange={(e) => setFormData({ ...formData, display_order: Number(e.target.value) })} min={0} />
                    </div>
                    <textarea className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500/50 outline-none" placeholder="説明 (任意)" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={3} />
                    <div className="pt-2">
                        <button type="submit" className="px-5 py-2.5 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 transition-colors">
                            {editingCourse ? '更新する' : '登録する'}
                        </button>
                    </div>
                </form>
            )}

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[600px]">
                        <thead className="bg-slate-50">
                            <tr className="border-b border-slate-200 text-sm font-semibold text-slate-600">
                                <th className="p-4 w-16">順序</th>
                                <th className="p-4">コース名</th>
                                <th className="p-4 w-24">時間</th>
                                <th className="p-4 w-32">料金</th>
                                <th className="p-4 w-24">指名料</th>
                                <th className="p-4 w-24">状態</th>
                                <th className="p-4 w-32 text-right">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {courses.map((course) => (
                                <tr key={course.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="p-4 text-sm text-slate-600 font-medium">{course.display_order}</td>
                                    <td className="p-4 text-sm font-bold text-slate-800">{course.name}</td>
                                    <td className="p-4 text-sm text-slate-600">{course.duration}分</td>
                                    <td className="p-4 text-sm font-bold text-slate-800">¥{course.base_price.toLocaleString()}</td>
                                    <td className="p-4 text-sm">
                                        {course.includes_nomination_fee ? (
                                            <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-100">込み</span>
                                        ) : (
                                            <span className="text-slate-400">-</span>
                                        )}
                                    </td>
                                    <td className="p-4 text-sm">
                                        <span className={`inline-flex px-2 py-1 rounded-md text-xs font-semibold ${course.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                            {course.is_active ? '有効' : '無効'}
                                        </span>
                                    </td>
                                    <td className="p-4 text-sm text-right space-x-3 whitespace-nowrap">
                                        <button
                                            className="font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
                                            onClick={() => {
                                                setEditingCourse(course)
                                                setFormData({
                                                    name: course.name,
                                                    duration: course.duration,
                                                    base_price: course.base_price,
                                                    description: course.description || '',
                                                    is_active: course.is_active,
                                                    display_order: course.display_order,
                                                    includes_nomination_fee: course.includes_nomination_fee,
                                                })
                                                setShowForm(true)
                                            }}
                                        >
                                            編集
                                        </button>
                                        <button className="font-medium text-rose-600 hover:text-rose-800 transition-colors" onClick={() => void handleDelete(course.id)}>
                                            削除
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {courses.length === 0 && (
                                <tr>
                                    <td className="p-8 text-center text-slate-500" colSpan={6}>コースがありません</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
