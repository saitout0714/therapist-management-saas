import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useShop } from '@/app/contexts/ShopContext'

type TherapistRank = {
    id: string
    name: string
    display_order: number
}

export function TherapistRankManagementTab() {
    const { selectedShop } = useShop()
    const [ranks, setRanks] = useState<TherapistRank[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [editingRank, setEditingRank] = useState<TherapistRank | null>(null)
    const [formData, setFormData] = useState({ name: '', display_order: 0 })

    async function fetchRanks() {
        if (!selectedShop) {
            setRanks([])
            setLoading(false)
            return
        }
        setLoading(true)
        const { data, error } = await supabase.from('therapist_ranks').select('*').eq('shop_id', selectedShop.id).order('display_order', { ascending: true })
        if (error) alert('データの取得に失敗しました')
        else setRanks((data as TherapistRank[]) || [])
        setLoading(false)
    }

    const resetForm = () => {
        setFormData({ name: '', display_order: 0 })
        setEditingRank(null)
        setShowForm(false)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedShop) {
            alert('店舗を選択してください')
            return
        }

        const payload = { ...formData, shop_id: selectedShop.id, updated_at: new Date().toISOString() }
        const result = editingRank
            ? await supabase.from('therapist_ranks').update(payload).eq('id', editingRank.id)
            : await supabase.from('therapist_ranks').insert([{ ...payload }])

        if (result.error) {
            alert('保存に失敗しました')
            return
        }

        resetForm()
        void fetchRanks()
    }

    const handleDelete = async (id: string) => {
        if (!confirm('本当に削除しますか？')) return
        const { error } = await supabase.from('therapist_ranks').delete().eq('id', id)
        if (error) {
            alert('削除に失敗しました')
            return
        }
        void fetchRanks()
    }

    useEffect(() => {
        void fetchRanks()
    }, [selectedShop])

    if (loading) return <div className="p-6">読み込み中...</div>

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-lg font-bold text-slate-800">セラピストランク管理</h2>
                    <p className="text-sm text-slate-500 mt-1">セラピストのランク（ホワイト、ブラック等）を作成します。</p>
                </div>
                <button onClick={() => setShowForm((v) => !v)} className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors">
                    {showForm ? 'キャンセル' : '新規登録'}
                </button>
            </div>

            {showForm && (
                <form onSubmit={handleSubmit} className="bg-slate-50 p-6 rounded-xl border border-slate-200 mb-6 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <input className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500/50 outline-none" placeholder="ランク名" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
                        <input type="number" className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500/50 outline-none" placeholder="表示順（小さい順）" value={formData.display_order} onChange={(e) => setFormData({ ...formData, display_order: Number(e.target.value) })} min={0} />
                    </div>
                    <div className="pt-2">
                        <button type="submit" className="px-5 py-2.5 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 transition-colors">{editingRank ? '更新する' : '登録する'}</button>
                    </div>
                </form>
            )}

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-left border-collapse min-w-[500px]">
                    <thead className="bg-slate-50">
                        <tr className="border-b border-slate-200 text-sm font-semibold text-slate-600">
                            <th className="p-4 w-16">順序</th>
                            <th className="p-4">ランク名</th>
                            <th className="p-4 w-32 text-right">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {ranks.map((r) => (
                            <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-4 text-sm text-slate-600 font-medium">{r.display_order}</td>
                                <td className="p-4 text-sm font-bold text-slate-800">{r.name}</td>
                                <td className="p-4 text-sm text-right space-x-3 whitespace-nowrap">
                                    <button className="font-medium text-indigo-600 hover:text-indigo-800 transition-colors" onClick={() => { setEditingRank(r); setFormData({ name: r.name, display_order: r.display_order }); setShowForm(true) }}>編集</button>
                                    <button className="font-medium text-rose-600 hover:text-rose-800 transition-colors" onClick={() => void handleDelete(r.id)}>削除</button>
                                </td>
                            </tr>
                        ))}
                        {ranks.length === 0 && <tr><td className="p-8 text-center text-slate-500" colSpan={3}>データがありません</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
