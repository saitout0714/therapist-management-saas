'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useShop } from '@/app/contexts/ShopContext'

type SiblingShop = { id: string; name: string }

export default function NewTherapistPage() {
  const router = useRouter()
  const { selectedShop } = useShop()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')

  const [scope, setScope] = useState<'all_shops' | 'per_shop'>('per_shop')
  const [siblingShops, setSiblingShops] = useState<SiblingShop[]>([])
  const [checkedShopIds, setCheckedShopIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    const load = async () => {
      if (!selectedShop) return
      setCheckedShopIds(new Set([selectedShop.id]))
      if (!selectedShop.owner_id) return

      const [{ data: ownerRow }, { data: shopsData }] = await Promise.all([
        supabase.from('owners').select('therapist_scope').eq('id', selectedShop.owner_id).maybeSingle(),
        supabase.from('shops').select('id, name').eq('owner_id', selectedShop.owner_id).order('name'),
      ])
      setScope((ownerRow?.therapist_scope as 'all_shops' | 'per_shop' | undefined) ?? 'per_shop')
      setSiblingShops(shopsData || [])
    }
    load()
  }, [selectedShop])

  const toggleShop = (id: string) => {
    setCheckedShopIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

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

    const targetShopIds = scope === 'all_shops'
      ? siblingShops.map(s => s.id)
      : Array.from(checkedShopIds)

    if (targetShopIds.length === 0) {
      setError('在籍する店舗を1つ以上選んでください')
      return
    }

    setLoading(true)
    const { data: minOrderData } = await supabase.from('therapists').select('order').eq('shop_id', selectedShop.id).order('order', { ascending: true }).limit(1)
    const nextOrder = minOrderData && minOrderData.length > 0 && minOrderData[0].order !== null ? minOrderData[0].order - 1 : 0

    const { data: insertData, error: insertError } = await supabase
      .from('therapists')
      .insert([{ name, shop_id: selectedShop.id, owner_id: selectedShop.owner_id || null, order: nextOrder }])
      .select()
      .single()

    if (insertError) {
      setLoading(false)
      setError('登録に失敗しました: ' + insertError.message)
      return
    }

    if (insertData) {
      const { error: rosterError } = await supabase
        .from('therapist_shops')
        .insert(targetShopIds.map(shopId => ({ therapist_id: insertData.id, shop_id: shopId })))
      setLoading(false)
      if (rosterError) {
        setError('在籍店舗の登録に失敗しました: ' + rosterError.message)
        return
      }
      router.push(`/therapists/${insertData.id}/edit`)
    } else {
      setLoading(false)
      router.push('/therapists')
    }
  }

  const showShopPicker = scope === 'per_shop' && siblingShops.length > 1

  return (
    <div className="bg-gray-100 p-4 md:p-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-4">
          <Link href="/therapists" className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-slate-500 border border-slate-200">←</Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">セラピスト新規登録</h1>
            <p className="text-sm text-slate-500 mt-1">
              {scope === 'all_shops'
                ? '名前を入力して登録します。同じグループの全店舗に自動的に在籍します。'
                : '名前を入力し、在籍する店舗にチェックを入れて登録します。'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSave} className="bg-white rounded-2xl border p-6 space-y-4">
          {error && <div className="p-3 rounded bg-rose-50 text-rose-600 text-sm">{error}</div>}
          <div>
            <label className="block text-sm mb-1">名前</label>
            <input className="w-full border rounded px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} placeholder="山田 花子" required />
          </div>

          {showShopPicker && (
            <div>
              <label className="block text-sm mb-2">在籍する店舗</label>
              <div className="space-y-2">
                {siblingShops.map(shop => (
                  <label key={shop.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checkedShopIds.has(shop.id)}
                      onChange={() => toggleShop(shop.id)}
                      className="w-4 h-4"
                    />
                    {shop.name}
                  </label>
                ))}
              </div>
            </div>
          )}

          {scope === 'all_shops' && siblingShops.length > 1 && (
            <div className="text-xs text-slate-500 bg-slate-50 rounded-lg p-3">
              在籍店舗: {siblingShops.map(s => s.name).join('・')}（全店共通グループのため自動設定）
            </div>
          )}

          <button type="submit" disabled={loading} className="px-4 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-60">{loading ? '登録中...' : '登録する'}</button>
        </form>
      </div>
    </div>
  )
}
