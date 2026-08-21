'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useShop } from '@/app/contexts/ShopContext'
import { formatTierLabel } from '@/lib/standbyGuarantee'

/**
 * 待機保証の金額設定カード。
 *
 * 店舗によって「待機4時間未満は1,000円、6時間以上は2,000円」のように
 * 待機時間で金額が変わるため、「◯時間以上 → ◯円」の段階を並べて登録できる。
 * 段階を1つも登録しなければ、下の定額（既定額）がそのまま使われる。
 *
 * ここで決まるのは集計レポートの日報で入力するときの初期値。
 * 実際に支給した額は案件ごとに上書きでき、standby_guarantees に1件ずつ記録される。
 */

type TierRow = {
  /** 既存行はDBのid、追加したばかりの行は null */
  id: string | null
  minHours: string
  amount: string
}

export function StandbyGuaranteeSettingCard() {
  const { selectedShop } = useShop()
  const [fallbackAmount, setFallbackAmount] = useState<string>('0')
  const [settingsId, setSettingsId] = useState<string | null>(null)
  const [tiers, setTiers] = useState<TierRow[]>([])
  const [originalTierIds, setOriginalTierIds] = useState<string[]>([])
  const [tiersUnavailable, setTiersUnavailable] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function fetchSetting() {
    if (!selectedShop) { setLoading(false); return }
    setLoading(true)

    const [settingsRes, tiersRes] = await Promise.all([
      supabase
        .from('system_settings')
        .select('id, standby_guarantee_amount')
        .eq('shop_id', selectedShop.id)
        .limit(1),
      supabase
        .from('standby_guarantee_tiers')
        .select('id, min_hours, amount')
        .eq('shop_id', selectedShop.id)
        .order('min_hours', { ascending: true }),
    ])

    const row = settingsRes.data?.[0]
    setSettingsId(row?.id ?? null)
    setFallbackAmount(String(row?.standby_guarantee_amount ?? 0))

    // テーブル未作成（マイグレーション未実行）のときは段階設定だけ無効化する
    const missing = !!tiersRes.error
    setTiersUnavailable(missing)
    const rows = (tiersRes.data || []).map((t) => ({
      id: t.id as string,
      minHours: String(t.min_hours),
      amount: String(t.amount),
    }))
    setTiers(rows)
    setOriginalTierIds(rows.map((r) => r.id!).filter(Boolean))

    setLoading(false)
  }

  useEffect(() => { void fetchSetting() }, [selectedShop])

  const updateTier = (index: number, patch: Partial<TierRow>) => {
    setTiers(prev => prev.map((t, i) => (i === index ? { ...t, ...patch } : t)))
  }

  const addTier = () => {
    setTiers(prev => [...prev, { id: null, minHours: '', amount: '' }])
  }

  const removeTier = (index: number) => {
    setTiers(prev => prev.filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    if (!selectedShop) return

    // 入力チェック（保存してから「効かない」に気づくのを防ぐ）
    const parsed: { id: string | null; min_hours: number; amount: number }[] = []
    for (const t of tiers) {
      if (t.minHours.trim() === '' && t.amount.trim() === '') continue
      const minHours = Number(t.minHours)
      const amount = Number(t.amount)
      if (!Number.isFinite(minHours) || minHours < 0) { alert('「◯時間以上」には0以上の数値を入れてください。'); return }
      if (!Number.isFinite(amount) || amount < 0) { alert('金額には0以上の数値を入れてください。'); return }
      parsed.push({ id: t.id, min_hours: Math.round(minHours * 10) / 10, amount: Math.floor(amount) })
    }

    const seen = new Set<number>()
    for (const p of parsed) {
      if (seen.has(p.min_hours)) { alert(`「${formatTierLabel(p.min_hours)}」が重複しています。`); return }
      seen.add(p.min_hours)
    }

    setSaving(true)
    try {
      // 1) 画面から消された段階を削除
      const keptIds = parsed.map(p => p.id).filter((id): id is string => !!id)
      const removedIds = originalTierIds.filter(id => !keptIds.includes(id))
      if (removedIds.length > 0) {
        const { error } = await supabase.from('standby_guarantee_tiers').delete().in('id', removedIds)
        if (error) { alert('段階の削除に失敗しました: ' + error.message); return }
      }

      // 2) 既存行を更新
      for (const p of parsed.filter(x => x.id)) {
        const { error } = await supabase
          .from('standby_guarantee_tiers')
          .update({ min_hours: p.min_hours, amount: p.amount, updated_at: new Date().toISOString() })
          .eq('id', p.id!)
        if (error) { alert('段階の更新に失敗しました: ' + error.message); return }
      }

      // 3) 追加された行を登録
      const inserts = parsed.filter(x => !x.id).map(p => ({
        shop_id: selectedShop.id,
        min_hours: p.min_hours,
        amount: p.amount,
      }))
      if (inserts.length > 0) {
        const { error } = await supabase.from('standby_guarantee_tiers').insert(inserts)
        if (error) { alert('段階の登録に失敗しました: ' + error.message); return }
      }

      // 4) 定額（段階が無い／どれにも当てはまらないときの金額）
      const fallback = Math.max(0, Math.floor(Number(fallbackAmount) || 0))
      const { error: settingsError } = settingsId
        ? await supabase
            .from('system_settings')
            .update({ standby_guarantee_amount: fallback, updated_at: new Date().toISOString() })
            .eq('id', settingsId)
        : await supabase
            .from('system_settings')
            .insert([{ shop_id: selectedShop.id, standby_guarantee_amount: fallback }])
      if (settingsError) { alert('既定額の保存に失敗しました: ' + settingsError.message); return }

      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      await fetchSetting()
    } finally {
      setSaving(false)
    }
  }

  if (loading) return null

  const sortedPreview = [...tiers]
    .filter(t => t.minHours.trim() !== '')
    .map(t => ({ minHours: Number(t.minHours), amount: Number(t.amount) || 0 }))
    .filter(t => Number.isFinite(t.minHours))
    .sort((a, b) => a.minHours - b.minHours)

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 md:p-5 mb-6">
      <div className="mb-4">
        <h3 className="text-base font-bold text-slate-800">待機保証の金額</h3>
        <p className="text-xs text-slate-500 mt-1">
          予約が1本も入らなかった出勤者に出す保証金です。ここで決めた額は集計レポートの日報を開いたときの初期値になり、
          実際の支給額はその場で上書きできます。
        </p>
      </div>

      {tiersUnavailable && (
        <div className="p-3 mb-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-[11px] font-medium">
          待機時間による段階設定のテーブルがまだありません。
          <code className="mx-1 px-1.5 py-0.5 bg-amber-100 rounded font-mono">npx tsx scripts/db-migrate-standby-guarantee-tiers.ts</code>
          を実行すると使えるようになります（下の定額はそのまま使えます）。
        </div>
      )}

      {/* 待機時間による段階 */}
      <div className="border border-slate-200 rounded-xl p-4 mb-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
          <h4 className="text-sm font-bold text-slate-700">待機時間による段階</h4>
          <button
            type="button"
            onClick={addTier}
            disabled={tiersUnavailable}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-[11px] transition-colors disabled:opacity-50"
          >
            ＋ 段階を追加
          </button>
        </div>
        <p className="text-[11px] text-slate-400 mb-3">
          「◯時間以上なら◯円」を並べます。条件を満たすうちいちばん長い段階が使われます。
          <span className="block mt-0.5">
            例）4時間未満1,000円・6時間以上2,000円 → <span className="font-bold text-slate-500">0時間以上=1,000円</span> と <span className="font-bold text-slate-500">6時間以上=2,000円</span> の2行。
            「未満」は1つ下の段階として書きます。
          </span>
        </p>

        {tiers.length === 0 ? (
          <div className="text-[11px] text-slate-400 bg-slate-50 rounded-lg px-3 py-4 text-center">
            段階なし（下の定額がそのまま使われます）
          </div>
        ) : (
          <div className="space-y-2">
            {tiers.map((tier, index) => (
              <div key={tier.id ?? `new-${index}`} className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={tier.minHours}
                  onChange={(e) => updateTier(index, { minHours: e.target.value })}
                  placeholder="0"
                  className="w-24 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
                <span className="text-xs text-slate-500 font-bold whitespace-nowrap">時間以上 →</span>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">¥</span>
                  <input
                    type="number"
                    min={0}
                    step={500}
                    value={tier.amount}
                    onChange={(e) => updateTier(index, { amount: e.target.value })}
                    placeholder="0"
                    className="w-32 border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeTier(index)}
                  className="px-2.5 py-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors text-xs font-bold"
                  title="この段階を削除"
                >
                  削除
                </button>
              </div>
            ))}
          </div>
        )}

        {sortedPreview.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-500">
            <span className="font-bold text-slate-600">実際の適用: </span>
            {sortedPreview.map((t, i) => {
              const next = sortedPreview[i + 1]
              const range = next
                ? `${t.minHours}〜${next.minHours}時間`
                : `${t.minHours}時間以上`
              return (
                <span key={t.minHours} className="inline-block mr-3 font-mono">
                  {range} → ¥{t.amount.toLocaleString()}
                </span>
              )
            })}
          </div>
        )}
      </div>

      {/* 定額（フォールバック） */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border border-slate-200 rounded-xl p-4">
        <div>
          <h4 className="text-sm font-bold text-slate-700">定額（段階を使わない場合）</h4>
          <p className="text-[11px] text-slate-400 mt-0.5">
            段階が未登録のとき、および出勤時間が取れず待機時間を計算できないときに使われます。0なら初期値なし（毎回手入力）。
          </p>
        </div>
        <div className="relative shrink-0">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">¥</span>
          <input
            type="number"
            min={0}
            step={500}
            value={fallbackAmount}
            onChange={(e) => setFallbackAmount(e.target.value)}
            className="w-40 border border-slate-200 rounded-lg pl-8 pr-3 py-2.5 bg-white text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500/50"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 mt-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors text-sm disabled:opacity-50"
        >
          {saving ? '保存中...' : '待機保証の設定を保存'}
        </button>
        {saved && <span className="text-xs font-bold text-emerald-600">保存しました</span>}
        <span className="text-[11px] text-slate-400">※この店舗だけの設定です</span>
      </div>
    </div>
  )
}
