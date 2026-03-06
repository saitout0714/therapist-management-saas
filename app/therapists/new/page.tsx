'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useShop } from '@/app/contexts/ShopContext'

export default function NewTherapistPage() {
  const router = useRouter()
  const { selectedShop } = useShop()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('名前は必須です')
      return
    }
    if (!selectedShop) {
      setError('店舗を選択してください')
      return
    }

    setLoading(true)
    const { data: maxOrderData } = await supabase.from('therapists').select('order').eq('shop_id', selectedShop.id).order('order', { ascending: false }).limit(1)
    const nextOrder = maxOrderData && maxOrderData.length > 0 && maxOrderData[0].order !== null ? maxOrderData[0].order + 1 : 0

    const { error: insertError } = await supabase.from('therapists').insert([{ name, shop_id: selectedShop.id, order: nextOrder }])
    setLoading(false)

    if (insertError) {
      setError('登録に失敗しました: ' + insertError.message)
      return
    }

    router.push('/therapists')
  }

  return (
    <div className="min-h-screen bg-slate-100 p-6 md:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/therapists" className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-slate-500 border border-slate-200">←</Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">セラピスト新規登録</h1>
            <p className="text-sm text-slate-500 mt-1">名前を入力して登録します。</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="bg-white rounded-2xl border p-6 space-y-4">
          {error && <div className="p-3 rounded bg-rose-50 text-rose-600 text-sm">{error}</div>}
          <div>
            <label className="block text-sm mb-1">名前</label>
            <input className="w-full border rounded px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} placeholder="山田 花子" required />
          </div>
          <button type="submit" disabled={loading} className="px-4 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-60">{loading ? '登録中...' : '登録する'}</button>
        </form>
      </div>
    </div>
  )
}
