import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useShop } from '@/app/contexts/ShopContext'

type Course = {
    id: string
    name: string
    duration: number
    base_price: number
    back_amount: number
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
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
    const [formData, setFormData] = useState({
        name: '',
        duration: 60,
        base_price: 6000,
        back_amount: 0,
        description: '',
        is_active: true,
        display_order: 0,
        includes_nomination_fee: false,
    })

    async function fetchCourses() {
        if (!selectedShop) { setCourses([]); setLoading(false); return }
        setLoading(true)
        const { data, error } = await supabase
            .from('courses')
            .select('*')
            .eq('shop_id', selectedShop.id)
            .order('display_order', { ascending: true })
        if (error) alert('コースの取得に失敗しました')
        else setCourses((data as Course[]) || [])
        setLoading(false)
    }

    const handleDragStart = (e: React.DragEvent, index: number) => {
        setDraggedIndex(index)
        e.dataTransfer.effectAllowed = 'move'
    }

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault()
        if (draggedIndex === null || draggedIndex === index) return

        const newCourses = [...courses]
        const draggedItem = newCourses[draggedIndex]
        newCourses.splice(draggedIndex, 1)
        newCourses.splice(index, 0, draggedItem)

        setDraggedIndex(index)
        setCourses(newCourses)
    }

    const handleDragEnd = async () => {
        setDraggedIndex(null)
        if (!selectedShop) return

        // Optimistically update display_order in local state
        const updated = courses.map((course, idx) => ({ ...course, display_order: idx }))
        setCourses(updated)

        const promises = courses.map((course, idx) =>
            supabase.from('courses').update({ display_order: idx, updated_at: new Date().toISOString() }).eq('id', course.id)
        )
        const results = await Promise.all(promises)
        const hasError = results.some(r => r.error)
        if (hasError) {
            alert('並び替え順の保存に失敗しました')
            void fetchCourses()
        }
    }

    const resetForm = () => {
        setFormData({ name: '', duration: 60, base_price: 6000, back_amount: 0, description: '', is_active: true, display_order: 0, includes_nomination_fee: false })
        setEditingCourse(null)
        setShowForm(false)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedShop) { alert('店舗を選択してください'); return }
        const payload = { ...formData, shop_id: selectedShop.id, updated_at: new Date().toISOString() }
        const result = editingCourse
            ? await supabase.from('courses').update(payload).eq('id', editingCourse.id)
            : await supabase.from('courses').insert([payload])
        if (result.error) { alert('保存に失敗しました'); return }
        resetForm()
        void fetchCourses()
    }

    const handleDelete = async (id: string) => {
        if (!confirm('本当に削除しますか？')) return
        const { error } = await supabase.from('courses').delete().eq('id', id)
        if (error) { alert('削除に失敗しました'); return }
        void fetchCourses()
    }

    useEffect(() => { void fetchCourses() }, [selectedShop])

    if (loading) return <div className="p-6">読み込み中...</div>

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 md:p-5">
            {showForm ? (
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Header Bar */}
                    <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
                        <button
                            type="button"
                            onClick={resetForm}
                            className="p-2 -ml-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                            title="一覧に戻る"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                        </button>
                        <div>
                            <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-bold ${
                                editingCourse ? 'bg-indigo-100 text-indigo-800' : 'bg-emerald-100 text-emerald-800'
                            }`}>
                                {editingCourse ? '編集選択中' : '新規登録'}
                            </span>
                            <h3 className="text-lg font-bold text-slate-800 mt-1">
                                {editingCourse ? `「${editingCourse.name}」の編集` : '新規コース登録'}
                            </h3>
                        </div>
                    </div>

                    {/* Form Body */}
                    <div className="space-y-6 max-w-2xl">
                        <div className="space-y-1">
                            <label className="block text-xs font-semibold text-slate-600">コース名</label>
                            <input
                                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500/50 outline-none"
                                placeholder="コース名"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                required
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="block text-xs font-semibold text-slate-600">施術時間（分）</label>
                                <input
                                    type="number"
                                    className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500/50 outline-none"
                                    placeholder="例: 60"
                                    value={formData.duration}
                                    onChange={(e) => setFormData({ ...formData, duration: Number(e.target.value) })}
                                    min={0}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="block text-xs font-semibold text-slate-600">基本料金（顧客請求額）</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">¥</span>
                                    <input
                                        type="number"
                                        className="w-full border border-slate-200 rounded-lg pl-8 pr-4 py-2.5 focus:ring-2 focus:ring-indigo-500/50 outline-none"
                                        placeholder="例: 6000"
                                        value={formData.base_price}
                                        onChange={(e) => setFormData({ ...formData, base_price: Number(e.target.value) })}
                                        min={0}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="block text-xs font-semibold text-indigo-700">セラピストバック額</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400 text-sm font-bold">¥</span>
                                <input
                                    type="number"
                                    className="w-full border border-indigo-200 rounded-lg pl-8 pr-4 py-2.5 focus:ring-2 focus:ring-indigo-500/50 outline-none bg-indigo-50/50 font-semibold text-indigo-800"
                                    placeholder="セラピストバック額"
                                    value={formData.back_amount}
                                    onChange={(e) => setFormData({ ...formData, back_amount: Number(e.target.value) })}
                                    min={0}
                                />
                            </div>
                            <p className="text-xs text-slate-400 mt-1">コース施術時にセラピストに支払うバック額です。</p>
                        </div>

                        <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-4 py-2.5 text-xs text-indigo-700">
                            💡 コース×ランク×指名種別ごとの特別バック額は「固定額バック表」タブで設定でき、そちらが優先されます。
                        </div>

                        <div className="flex items-center">
                            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                                    checked={formData.is_active}
                                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                />
                                有効にする
                            </label>
                        </div>

                        <div className="space-y-1">
                            <label className="block text-xs font-semibold text-slate-600">説明</label>
                            <textarea
                                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500/50 outline-none"
                                placeholder="説明 (任意)"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                rows={3}
                            />
                        </div>
                    </div>

                    {/* Footer Buttons */}
                    <div className="pt-6 border-t border-slate-100 flex gap-3 max-w-2xl">
                        <button
                            type="button"
                            onClick={resetForm}
                            className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors text-sm"
                        >
                            キャンセル
                        </button>
                        <button
                            type="submit"
                            className="px-5 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors text-sm"
                        >
                            {editingCourse ? '更新する' : '登録する'}
                        </button>
                    </div>
                </form>
            ) : (
                <>
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                        <div>
                            <h2 className="text-lg font-bold text-slate-800">コース管理</h2>
                            <p className="text-sm text-slate-500 mt-1">施術コースの料金・バック額・時間・表示順を編集します。</p>
                        </div>
                        <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors">
                            新規登録
                        </button>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse min-w-[700px]">
                                <thead className="bg-slate-50">
                                    <tr className="border-b border-slate-200 text-sm font-semibold text-slate-600">
                                        <th className="p-4 w-10"></th>
                                        <th className="p-4">コース名</th>
                                        <th className="p-4 w-20">時間</th>
                                        <th className="p-4 w-28">料金</th>
                                        <th className="p-4 w-28 text-indigo-600">バック額</th>
                                        <th className="p-4 w-20">状態</th>
                                        <th className="p-4 w-28 text-right">操作</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {courses.map((course, index) => (
                                        <tr
                                            key={course.id}
                                            className={`hover:bg-slate-50/50 transition-colors ${draggedIndex === index ? 'opacity-40 bg-slate-100' : ''}`}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, index)}
                                            onDragOver={(e) => handleDragOver(e, index)}
                                            onDragEnd={handleDragEnd}
                                        >
                                            <td className="p-4 text-sm text-slate-600 font-medium whitespace-nowrap">
                                                <span className="cursor-grab select-none text-slate-400 font-bold hover:text-indigo-600">⋮⋮</span>
                                            </td>
                                            <td className="p-4 text-sm font-bold text-slate-800">{course.name}</td>
                                            <td className="p-4 text-sm text-slate-600">{course.duration}分</td>
                                            <td className="p-4 text-sm font-bold text-slate-800">¥{course.base_price.toLocaleString()}</td>
                                            <td className="p-4 text-sm font-bold text-indigo-700">
                                                ¥{(course.back_amount ?? 0).toLocaleString()}
                                            </td>
                                            <td className="p-4 text-sm">
                                                <span className={`inline-flex px-2 py-1 rounded-md text-xs font-semibold ${course.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                                    {course.is_active ? '有効' : '無効'}
                                                </span>
                                            </td>
                                            <td className="p-4 text-sm text-right space-x-3 whitespace-nowrap">
                                                <button
                                                    className="font-medium text-indigo-600 hover:text-indigo-800 transition-colors align-middle"
                                                    onClick={() => {
                                                        setEditingCourse(course)
                                                        setFormData({
                                                            name: course.name,
                                                            duration: course.duration,
                                                            base_price: course.base_price,
                                                            back_amount: course.back_amount ?? 0,
                                                            description: course.description || '',
                                                            is_active: course.is_active,
                                                            display_order: course.display_order,
                                                            includes_nomination_fee: course.includes_nomination_fee,
                                                        })
                                                        setShowForm(true)
                                                    }}
                                                >編集</button>
                                                <button className="font-medium text-rose-600 hover:text-rose-800 transition-colors align-middle" onClick={() => void handleDelete(course.id)}>削除</button>
                                            </td>
                                        </tr>
                                    ))}
                                    {courses.length === 0 && (
                                        <tr><td className="p-8 text-center text-slate-500" colSpan={8}>コースがありません</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
