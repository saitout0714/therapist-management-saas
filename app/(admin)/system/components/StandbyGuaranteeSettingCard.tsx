'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useShop } from '@/app/contexts/ShopContext'

/**
 * 待機保証の「既定額」を設定するカード。
 *
 * 保証を出すかどうか・いくら出すかは店舗ごとにルールが違うため、ここで決めた額は
 * あくまで集計レポートの日報モーダルで入力する際の初期値。実際に支給した額は
 * 案件ごとに上書きでき、standby_guarantees テーブルに1件ずつ記録される。
 *
 * 控除・手当ルール（deduction_rules）はバック共有元の店舗にぶら下がるが、
 * 待機保証の既定額は system_settings と同じくこの店舗だけの設定。
 */
export function StandbyGuaranteeSettingCard() {
  const { selectedShop } = useShop()
  const [amount, setAmount] = useState<number>(0)
  const [settingsId, setSettingsId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    async function fetchSetting() {
      if (!selectedShop) { setLoading(false); return }
      setLoading(true)
      const { data } = await supabase
        .from('system_settings')
        .select('id, standby_guarantee_amount')
        .eq('shop_id', selectedShop.id)
        .limit(1)
      const row = data?.[0]
      setSettingsId(row?.id ?? null)
      setAmount(row?.standby_guarantee_amount ?? 0)
      setLoading(false)
    }
    void fetchSetting()
  }, [selectedShop])

  const handleSave = async () => {
    if (!selectedShop) return
    setSaving(true)
    const { error } = settingsId
      ? await supabase
          .from('system_settings')
          .update({ standby_guarantee_amount: amount, updated_at: new Date().toISOString() })
          .eq('id', settingsId)
      : await supabase
          .from('system_settings')
          .insert([{ shop_id: selectedShop.id, standby_guarantee_amount: amount }])

    setSaving(false)
    if (error) { alert('待機保証の既定額の保存に失敗しました: ' + error.message); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  if (loading) return null

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 md:p-5 mb-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-800">待機保証の既定額</h3>
          <p className="text-xs text-slate-500 mt-1">
            予約が1本も入らなかった出勤者に出す保証金の初期値です。実際の支給は集計レポートの日報から、
            セラピスト・日付ごとに金額を入力して確定します（ここで決めた額は上書きできます）。
          </p>
          <p className="text-[11px] text-slate-400 mt-1">※0 のままなら初期値なし（毎回手入力）。この店舗だけの設定です。</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">¥</span>
            <input
              type="number"
              min={0}
              step={500}
              value={amount}
              onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))}
              className="w-40 border border-slate-200 rounded-lg pl-8 pr-3 py-2.5 bg-white text-sm outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2.5 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors text-sm disabled:opacity-50"
          >
            {saving ? '保存中...' : '保存'}
          </button>
          {saved && <span className="text-xs font-bold text-emerald-600">保存しました</span>}
        </div>
      </div>
    </div>
  )
}
