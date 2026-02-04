'use client' // ボタン操作などの動きがあるページにはこれが必要です

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useShop } from '@/app/contexts/ShopContext'

export default function RegisterPage() {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { selectedShop } = useShop()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    if (!selectedShop) {
      alert('店舗を選択してください')
      setLoading(false)
      return
    }

    // Supabaseにデータを送る（INSERT）
    const { error } = await supabase
      .from('therapists')
      .insert([{ name: name, shop_id: selectedShop.id }])

    if (error) {
      alert('エラーが発生しました: ' + error.message)
    } else {
      alert('登録に成功しました！')
      router.push('/test') // 一覧ページへ戻る
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-gray-800">セラピスト新規登録</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">名前</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="例：さくらこ"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition disabled:bg-gray-400"
          >
            {loading ? '登録中...' : '登録する'}
          </button>
        </form>
      </div>
    </div>
  )
}