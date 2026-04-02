import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useShop } from '@/app/contexts/ShopContext'

type NominationFee = {
    id: string
    fee_type: string
    name: string
    price: number
}

// 指名料種別のプリセット定義
const feeTypes = [
    { value: 'first_time', label: '初回指名' },
    { value: 'regular', label: '本指名' },
    { value: 'princess', label: '姫予約' },
    { value: 'other', label: 'その他' }
]

export function NominationFeeManagementTab() {
    const { selectedShop } = useShop()
    const [fees, setFees] = useState<NominationFee[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [editingFee, setEditingFee] = useState<NominationFee | null>(null)
    const [formData, setFormData] = useState({ fee_type: 'first_time', name: '', price: 0 })

    async function fetchFees() {
        if (!selectedShop) {
            setFees([])
            setLoading(false)
            return
        }
        setLoading(true)
        const { data, error } = await supabase.from('nomination_fees').select('*').eq('shop_id', selectedShop.id).order('created_at', { ascending: true })
        if (error) alert('データの取得に失敗しました')
        else setFees((data as NominationFee[]) || [])
        setLoading(false)
    }

    const resetForm = () => {
        setFormData({ fee_type: 'first_time', name: '', price: 0 })
        setEditingFee(null)
        setShowForm(false)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedShop) {
            alert('店舗を選択してください')
            return
        }

        const payload = { ...formData, shop_id: selectedShop.id, updated_at: new Date().toISOString() }
        console.log('Sending payload:', payload)
        const result = editingFee
            ? await supabase.from('nomination_fees').update(payload).eq('id', editingFee.id)
            : await supabase.from('nomination_fees').insert([{ ...payload }])

        if (result.error) {
            console.error('保存エラー:', result.error)
            alert('保存に失敗しました: ' + (result.error.message || JSON.stringify(result.error)))
            return
        }

        resetForm()
        void fetchFees()
    }

    const handleDelete = async (id: string) => {
        if (!confirm('本当に削除しますか？')) return
        const { error } = await supabase.from('nomination_fees').delete().eq('id', id)
        if (error) {
            alert('削除に失敗しました')
            return
        }
        void fetchFees()
    }

    useEffect(() => {
        void fetchFees()
    }, [selectedShop])

    if (loading) return <div className="p-6">読み込み中...</div>

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-lg font-bold text-slate-800">指名料ルール / マスタ管理</h2>
                    <p className="text-sm text-slate-500 mt-1">店舗の基本となる指名料ルール（基本価格や種別）を設定します。</p>
                </div>
                <button onClick={() => setShowForm((v) => !v)} className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors">
                    {showForm ? 'キャンセル' : '新規登録'}
                </button>
            </div>

            {showForm && (
                <form onSubmit={handleSubmit} className="bg-slate-50 p-6 rounded-xl border border-slate-200 mb-6 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm text-slate-600 font-medium mb-1">指名種別</label>
                            <select className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500/50 outline-none" value={formData.fee_type} onChange={(e) => setFormData({ ...formData, fee_type: e.target.value })}>
                                {feeTypes.map(ft => <option key={ft.value} value={ft.value}>{ft.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm text-slate-600 font-medium mb-1">表示名</label>
                            <input className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500/50 outline-none" placeholder="初回指名料" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
                        </div>
                        <div>
                            <label className="block text-sm text-slate-600 font-medium mb-1">基本料金</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">¥</span>
                                <input type="number" className="w-full border border-slate-200 rounded-lg pl-8 pr-4 py-2.5 focus:ring-2 focus:ring-indigo-500/50 outline-none" placeholder="1000" value={formData.price} onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })} min={0} />
                            </div>
                        </div>
                    </div>
                    <div className="pt-2">
                        <button type="submit" className="px-5 py-2.5 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 transition-colors">{editingFee ? '更新する' : '登録する'}</button>
                    </div>
                </form>
            )}

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-left border-collapse min-w-[500px]">
                    <thead className="bg-slate-50">
                        <tr className="border-b border-slate-200 text-sm font-semibold text-slate-600">
                            <th className="p-4 w-32">種別</th>
                            <th className="p-4">表示名</th>
                            <th className="p-4 w-32">基本料金</th>
                            <th className="p-4 w-32 text-right">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {fees.map((r) => (
                            <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-4 text-sm text-slate-600 font-medium">
                                    {feeTypes.find(f => f.value === r.fee_type)?.label || r.fee_type}
                                </td>
                                <td className="p-4 text-sm font-bold text-slate-800">{r.name}</td>
                                <td className="p-4 text-sm font-bold text-slate-800">¥{r.price.toLocaleString()}</td>
                                <td className="p-4 text-sm text-right space-x-3 whitespace-nowrap">
                                    <button className="font-medium text-indigo-600 hover:text-indigo-800 transition-colors" onClick={() => { setEditingFee(r); setFormData({ fee_type: r.fee_type, name: r.name, price: r.price }); setShowForm(true) }}>編集</button>
                                    <button className="font-medium text-rose-600 hover:text-rose-800 transition-colors" onClick={() => void handleDelete(r.id)}>削除</button>
                                </td>
                            </tr>
                        ))}
                        {fees.length === 0 && <tr><td className="p-8 text-center text-slate-500" colSpan={4}>データがありません</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
