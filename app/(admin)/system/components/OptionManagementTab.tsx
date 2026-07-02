import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useShop } from '@/app/contexts/ShopContext'

type Option = {
    id: string
    name: string
    price: number
    back_amount: number
    description: string | null
    is_active: boolean
    display_order: number
    option_type: 'extension' | 'item' | 'treatment'
    duration_minutes_added: number
    back_category: string
}

export function OptionManagementTab() {
    const { selectedShop } = useShop()
    const [options, setOptions] = useState<Option[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [editingOption, setEditingOption] = useState<Option | null>(null)
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
    const [formData, setFormData] = useState({
        name: '', price: 0, back_amount: 0, description: '', is_active: true,
        display_order: 0, option_type: 'extension' as 'extension' | 'item' | 'treatment', duration_minutes_added: 0,
        back_category: 'その他',
    })

    async function fetchOptions() {
        if (!selectedShop) { setOptions([]); setLoading(false); return }
        setLoading(true)
        const { data, error } = await supabase.from('options').select('*').eq('shop_id', selectedShop.id).order('display_order', { ascending: true })
        if (error) alert('オプションの取得に失敗しました')
        else setOptions((data as Option[]) || [])
        setLoading(false)
    }

    const handleDragStart = (e: React.DragEvent, index: number) => {
        setDraggedIndex(index)
        e.dataTransfer.effectAllowed = 'move'
    }

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault()
        if (draggedIndex === null || draggedIndex === index) return

        const newOptions = [...options]
        const draggedItem = newOptions[draggedIndex]
        newOptions.splice(draggedIndex, 1)
        newOptions.splice(index, 0, draggedItem)

        setDraggedIndex(index)
        setOptions(newOptions)
    }

    const handleDragEnd = async () => {
        setDraggedIndex(null)
        if (!selectedShop) return

        // Optimistically update display_order in local state
        const updated = options.map((option, idx) => ({ ...option, display_order: idx }))
        setOptions(updated)

        const promises = options.map((option, idx) =>
            supabase.from('options').update({ display_order: idx, updated_at: new Date().toISOString() }).eq('id', option.id)
        )
        const results = await Promise.all(promises)
        const hasError = results.some(r => r.error)
        if (hasError) {
            alert('並び替え順の保存に失敗しました')
            void fetchOptions()
        }
    }

    const resetForm = () => {
        setFormData({ name: '', price: 0, back_amount: 0, description: '', is_active: true, display_order: 0, option_type: 'extension', duration_minutes_added: 0, back_category: 'その他' })
        setEditingOption(null)
        setShowForm(false)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedShop) { alert('店舗を選択してください'); return }
        // duration カラム（旧）と duration_minutes_added（新）を同期する
        const payload = {
          ...formData,
          duration: formData.option_type === 'extension' ? formData.duration_minutes_added : 0,
          shop_id: selectedShop.id,
          updated_at: new Date().toISOString(),
        }
        const result = editingOption
            ? await supabase.from('options').update(payload).eq('id', editingOption.id)
            : await supabase.from('options').insert([payload])
        if (result.error) { alert('保存に失敗しました'); return }
        resetForm()
        void fetchOptions()
    }

    const handleDelete = async (id: string) => {
        if (!confirm('本当に削除しますか？')) return
        const { error } = await supabase.from('options').delete().eq('id', id)
        if (error) { alert('削除に失敗しました'); return }
        void fetchOptions()
    }

    useEffect(() => { void fetchOptions() }, [selectedShop])

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
                                editingOption ? 'bg-indigo-100 text-indigo-800' : 'bg-emerald-100 text-emerald-800'
                            }`}>
                                {editingOption ? '編集選択中' : '新規登録'}
                            </span>
                            <h3 className="text-lg font-bold text-slate-800 mt-1">
                                {editingOption ? `「${editingOption.name}」の編集` : '新規オプション登録'}
                            </h3>
                        </div>
                    </div>

                    {/* Form Body */}
                    <div className="space-y-6 max-w-2xl">
                        <div className="space-y-1">
                            <label className="block text-xs font-semibold text-slate-600">オプション名</label>
                            <input
                                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500/50 outline-none"
                                placeholder="オプション名"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                required
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="block text-xs font-semibold text-slate-600">オプション種別</label>
                                <select
                                    className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500/50 outline-none"
                                    value={formData.option_type}
                                    onChange={(e) => setFormData({ ...formData, option_type: e.target.value as 'extension' | 'item' | 'treatment' })}
                                >
                                    <option value="extension">延長</option>
                                    <option value="item">アイテム備品等</option>
                                    <option value="treatment">施術</option>
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="block text-xs font-semibold text-indigo-700">バックカテゴリ</label>
                                <select
                                    className="w-full border border-indigo-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500/50 outline-none bg-indigo-50/50 font-medium text-indigo-800"
                                    value={formData.back_category}
                                    onChange={(e) => setFormData({ ...formData, back_category: e.target.value })}
                                >
                                    <option value="その他">その他</option>
                                    <option value="衣装">衣装</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="block text-xs font-semibold text-slate-600">追加料金（顧客請求額）</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">¥</span>
                                    <input
                                        type="number"
                                        className="w-full border border-slate-200 rounded-lg pl-8 pr-4 py-2.5 focus:ring-2 focus:ring-indigo-500/50 outline-none"
                                        placeholder="例: 2000"
                                        value={formData.price}
                                        onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                                        min={0}
                                    />
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
                            </div>
                        </div>

                        {formData.option_type === 'extension' && (
                            <div className="space-y-1">
                                <label className="block text-xs font-semibold text-slate-600">追加時間（分）</label>
                                <input
                                    type="number"
                                    className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500/50 outline-none"
                                    placeholder="追加時間（分）"
                                    value={formData.duration_minutes_added}
                                    onChange={(e) => setFormData({ ...formData, duration_minutes_added: Number(e.target.value) })}
                                    min={0}
                                />
                            </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="block text-xs font-semibold text-slate-600">表示順</label>
                                <input
                                    type="number"
                                    className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500/50 outline-none"
                                    placeholder="表示順（小さい順）"
                                    value={formData.display_order}
                                    onChange={(e) => setFormData({ ...formData, display_order: Number(e.target.value) })}
                                    min={0}
                                />
                            </div>
                            <div className="flex items-center pt-6">
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
                            {editingOption ? '更新する' : '登録する'}
                        </button>
                    </div>
                </form>
            ) : (
                <>
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                        <div>
                            <h2 className="text-lg font-bold text-slate-800">オプション管理</h2>
                            <p className="text-sm text-slate-500 mt-1">オプションの追加料金・バック額・追加時間を編集します。</p>
                        </div>
                        <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors">
                            新規登録
                        </button>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse min-w-[650px]">
                                <thead className="bg-slate-50">
                                    <tr className="border-b border-slate-200 text-sm font-semibold text-slate-600">
                                        <th className="p-4 w-14">順序</th>
                                        <th className="p-4">オプション名</th>
                                        <th className="p-4 w-24">追加時間</th>
                                        <th className="p-4 w-28">料金</th>
                                        <th className="p-4 w-28 text-indigo-600">バック額</th>
                                        <th className="p-4 w-24 text-indigo-600">カテゴリ</th>
                                        <th className="p-4 w-20">状態</th>
                                        <th className="p-4 w-28 text-right">操作</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {options.map((option, index) => (
                                        <tr
                                            key={option.id}
                                            className={`hover:bg-slate-50/50 transition-colors ${draggedIndex === index ? 'opacity-40 bg-slate-100' : ''}`}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, index)}
                                            onDragOver={(e) => handleDragOver(e, index)}
                                            onDragEnd={handleDragEnd}
                                        >
                                            <td className="p-4 text-sm text-slate-600 font-medium whitespace-nowrap">
                                                <span className="inline-block mr-2 cursor-grab select-none text-slate-400 font-bold hover:text-indigo-600">⋮⋮</span>
                                                {option.display_order}
                                            </td>
                                            <td className="p-4 text-sm font-bold text-slate-800">
                                                <div className="flex items-center gap-2">
                                                    {option.option_type === 'extension'
                                                        ? <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-50 text-sky-600 border border-sky-100">延長</span>
                                                        : option.option_type === 'treatment'
                                                        ? <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-violet-50 text-violet-600 border border-violet-100">施術</span>
                                                        : <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-100">アイテム</span>}
                                                    {option.name}
                                                </div>
                                            </td>
                                            <td className="p-4 text-sm text-slate-600">
                                                {option.option_type === 'extension' && option.duration_minutes_added > 0 ? `+${option.duration_minutes_added}分` : '-'}
                                            </td>
                                            <td className="p-4 text-sm font-bold text-slate-800">¥{option.price.toLocaleString()}</td>
                                            <td className="p-4 text-sm font-bold text-indigo-700">¥{(option.back_amount ?? 0).toLocaleString()}</td>
                                            <td className="p-4 text-sm">
                                                <span className={`inline-flex px-2 py-1 rounded-md text-xs font-semibold ${option.back_category === '衣装' ? 'bg-violet-50 text-violet-700' : 'bg-slate-100 text-slate-600'}`}>
                                                    {option.back_category || 'その他'}
                                                </span>
                                            </td>
                                            <td className="p-4 text-sm">
                                                <span className={`inline-flex px-2 py-1 rounded-md text-xs font-semibold ${option.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                                    {option.is_active ? '有効' : '無効'}
                                                </span>
                                            </td>
                                            <td className="p-4 text-sm text-right space-x-3 whitespace-nowrap">
                                                <button
                                                    className="font-medium text-indigo-600 hover:text-indigo-800 transition-colors align-middle"
                                                    onClick={() => {
                                                        setEditingOption(option)
                                                        setFormData({ name: option.name, price: option.price, back_amount: option.back_amount ?? 0, description: option.description || '', is_active: option.is_active, display_order: option.display_order, option_type: option.option_type, duration_minutes_added: option.duration_minutes_added, back_category: option.back_category || 'その他' })
                                                        setShowForm(true)
                                                    }}
                                                >編集</button>
                                                <button className="font-medium text-rose-600 hover:text-rose-800 transition-colors align-middle" onClick={() => void handleDelete(option.id)}>削除</button>
                                            </td>
                                        </tr>
                                    ))}
                                    {options.length === 0 && <tr><td className="p-8 text-center text-slate-500" colSpan={8}>オプションがありません</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
