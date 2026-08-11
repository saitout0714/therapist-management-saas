export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * グループ内の料金・バック設定の「共有元」を1店舗に統一する。
 *
 * 従来は shops.pricing_source_shop_id / back_source_shop_id を
 * 付け替えるだけだったため、旧共有元にあった実データが参照されなくなり
 * 「設定が消えた」ように見える事故が起きていた（バカラのランクの件）。
 * このAPIは参照先を切り替える前に、旧共有元のデータを新共有元へ移送する。
 */

// pricing_source_shop_id で共有されるテーブル
const PRICING_TABLES = [
  { table: 'courses', label: 'コース' },
  { table: 'options', label: 'オプション' },
  { table: 'discount_policies', label: '割引ポリシー' },
  { table: 'designation_types', label: '指名種別' },
] as const

// back_source_shop_id で共有されるテーブル
const BACK_TABLES = [
  { table: 'therapist_ranks', label: 'セラピストランク' },
  { table: 'course_back_amounts', label: 'ランク別料金バック' },
  { table: 'extension_rank_prices', label: '延長ランク料金' },
  { table: 'discount_rank_overrides', label: '割引のランク別上書き' },
  { table: 'deduction_rules', label: '控除ルール' },
] as const

type ShopRow = { id: string; name: string; owner_id: string | null }

export async function POST(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'サーバー設定が不足しています（SUPABASE_SERVICE_ROLE_KEY）' }, { status: 500 })
  }
  const db = createClient(supabaseUrl, serviceKey)

  // --- 呼び出し元の権限確認 ---------------------------------------------
  // 店舗をまたいでデータを移動する操作なので、developer / system_admin に限定する。
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) {
    return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  }
  const { data: authData, error: authError } = await db.auth.getUser(token)
  if (authError || !authData?.user) {
    return NextResponse.json({ error: 'セッションが無効です。再ログインしてください' }, { status: 401 })
  }
  const { data: caller } = await db
    .from('users')
    .select('role')
    .eq('id', authData.user.id)
    .maybeSingle()
  const role = (caller as { role?: string } | null)?.role
  if (role !== 'developer' && role !== 'system_admin' && role !== 'admin') {
    return NextResponse.json({ error: 'この操作には運営者権限が必要です' }, { status: 403 })
  }

  try {
    const {
      targetShopId,
      ownerId: ownerIdOverride,
      dryRun,
      scope = 'both',
      mode = 'shared',
    } = (await req.json()) as {
      targetShopId?: string
      ownerId?: string | null
      dryRun?: boolean
      /** 料金だけ・バックだけ・両方のどれを操作するか */
      scope?: 'pricing' | 'back' | 'both'
      /** shared = 基準店に寄せる / independent = 各店が自前のデータを使う */
      mode?: 'shared' | 'independent'
    }

    if (!targetShopId) {
      return NextResponse.json({ error: 'targetShopId が必要です' }, { status: 400 })
    }

    const touchPricing = scope === 'pricing' || scope === 'both'
    const touchBack = scope === 'back' || scope === 'both'
    const scopedTables = [
      ...(touchPricing ? PRICING_TABLES : []),
      ...(touchBack ? BACK_TABLES : []),
    ]

    const { data: target, error: targetError } = await db
      .from('shops')
      .select('id, name, owner_id')
      .eq('id', targetShopId)
      .maybeSingle<ShopRow>()

    if (targetError || !target) {
      return NextResponse.json({ error: '対象店舗が見つかりません' }, { status: 404 })
    }

    // --- グループ店舗の特定 ------------------------------------------------
    const ownerId = ownerIdOverride ?? target.owner_id
    let groupShops: ShopRow[] = [target]
    if (ownerId) {
      const { data } = await db
        .from('shops')
        .select('id, name, owner_id')
        .eq('owner_id', ownerId)
      if (data && data.length > 0) groupShops = data as ShopRow[]
    }
    const others = groupShops.filter((s) => s.id !== target.id)
    const nameById = new Map(groupShops.map((s) => [s.id, s.name]))

    const moved: string[] = []
    const skipped: string[] = []
    const warnings: string[] = []

    const countRows = async (table: string, shopId: string): Promise<number | null> => {
      const { count, error } = await db
        .from(table)
        .select('id', { count: 'exact', head: true })
        .eq('shop_id', shopId)
      if (error) return null
      return count ?? 0
    }

    // --- 独立へ戻す場合 ----------------------------------------------------
    // データは動かさない。共有をやめると基準店以外は自前のデータを見に行くので、
    // 持っていない店舗は設定が空になる。何が空になるかを必ず先に知らせる。
    if (mode === 'independent') {
      for (const { table, label } of scopedTables) {
        const empties: string[] = []
        for (const s of groupShops) {
          const c = await countRows(table, s.id)
          if (c === null) {
            warnings.push(`⚠️ ${label}: テーブルを読めなかったため確認できていません`)
            break
          }
          if (c === 0) empties.push(s.name)
        }
        if (empties.length > 0) {
          warnings.push(`⚠️ ${label}: ${empties.join(' / ')} は自前のデータが0件のため空になります`)
        } else {
          skipped.push(`・${label}: 全店舗が自前のデータを持っています`)
        }
      }

      if (!dryRun) {
        const ownerPatch: Record<string, unknown> = {}
        if (touchPricing) { ownerPatch.pricing_mode = 'independent'; ownerPatch.pricing_base_shop_id = null }
        if (touchBack) { ownerPatch.back_mode = 'independent'; ownerPatch.back_base_shop_id = null }
        if (ownerId) {
          const { error } = await db.from('owners').update(ownerPatch).eq('id', ownerId)
          if (error) return NextResponse.json({ error: `オーナー設定の更新に失敗: ${error.message}` }, { status: 500 })
        }

        // 旧方式の列も揃えておく（参照が残っている間の食い違いを防ぐ）
        const shopPatch: Record<string, unknown> = {}
        if (touchPricing) shopPatch.pricing_source_shop_id = null
        if (touchBack) shopPatch.back_source_shop_id = null
        const { error: shopError } = await db
          .from('shops')
          .update(shopPatch)
          .in('id', groupShops.map((s) => s.id))
        if (shopError) return NextResponse.json({ error: `店舗設定の更新に失敗: ${shopError.message}` }, { status: 500 })
      }

      return NextResponse.json({
        ok: true,
        dryRun: !!dryRun,
        mode,
        scope,
        targetShopName: target.name,
        groupShopNames: groupShops.map((s) => nameById.get(s.id) || s.id),
        moved,
        skipped,
        warnings,
      })
    }

    // --- テーブルごとにデータを新共有元へ寄せる ------------------------------
    for (const { table, label } of scopedTables) {
      const targetCount = await countRows(table, target.id)

      if (targetCount === null) {
        warnings.push(`⚠️ ${label}: テーブルを読めなかったため処理していません`)
        continue
      }

      // 統一先に既にデータがあるなら、そちらが正。他店のデータは動かさない
      // （ボタンの意味は「この店舗のデータに統一する」なので統一先を優先する）
      if (targetCount > 0) {
        skipped.push(`・${label}: ${target.name}に既存${targetCount}件があるためそのまま`)
        continue
      }

      // 統一先が空の場合のみ、グループ内でデータを持っている店舗から引き取る
      const holders: { shop: ShopRow; count: number }[] = []
      for (const s of others) {
        const c = await countRows(table, s.id)
        if (c && c > 0) holders.push({ shop: s, count: c })
      }

      if (holders.length === 0) continue

      if (holders.length > 1) {
        // 複数店舗に散らばっている場合は自動でマージすると重複する。人が決めるべき。
        const detail = holders.map((h) => `${h.shop.name}=${h.count}件`).join(' / ')
        warnings.push(`⚠️ ${label}: 複数店舗にデータがあるため移動していません（${detail}）`)
        continue
      }

      const from = holders[0]
      if (dryRun) {
        moved.push(`・${label}: ${from.shop.name}から${from.count}件を移動予定`)
        continue
      }

      const { error: moveError } = await db
        .from(table)
        .update({ shop_id: target.id })
        .eq('shop_id', from.shop.id)

      if (moveError) {
        warnings.push(`⚠️ ${label}: 移動に失敗しました（${moveError.message}）`)
      } else {
        moved.push(`・${label}: ${from.shop.name}から${from.count}件を${target.name}へ移動`)
      }
    }

    // --- 参照先の切り替え --------------------------------------------------
    if (!dryRun) {
      // 共有するかどうかはオーナー設定が正。まずこちらを更新する。
      const ownerPatch: Record<string, unknown> = {}
      if (touchPricing) { ownerPatch.pricing_mode = 'shared'; ownerPatch.pricing_base_shop_id = target.id }
      if (touchBack) { ownerPatch.back_mode = 'shared'; ownerPatch.back_base_shop_id = target.id }
      if (ownerId) {
        const { error } = await db.from('owners').update(ownerPatch).eq('id', ownerId)
        if (error) {
          return NextResponse.json({ error: `オーナー設定の更新に失敗: ${error.message}` }, { status: 500 })
        }
      } else {
        warnings.push('⚠️ この店舗にオーナーが設定されていないため、グループ設定は保存していません')
      }

      // 旧方式の列も揃えておく（参照が残っている間の食い違いを防ぐ）
      const selfPatch: Record<string, unknown> = {}
      if (touchPricing) selfPatch.pricing_source_shop_id = null
      if (touchBack) selfPatch.back_source_shop_id = null
      const { error: selfError } = await db
        .from('shops')
        .update(selfPatch)
        .eq('id', target.id)
      if (selfError) {
        return NextResponse.json({ error: `共有元の更新に失敗: ${selfError.message}` }, { status: 500 })
      }

      if (others.length > 0) {
        const othersPatch: Record<string, unknown> = {}
        if (touchPricing) othersPatch.pricing_source_shop_id = target.id
        if (touchBack) othersPatch.back_source_shop_id = target.id
        const { error: othersError } = await db
          .from('shops')
          .update(othersPatch)
          .in('id', others.map((s) => s.id))
        if (othersError) {
          return NextResponse.json({ error: `共有元の更新に失敗: ${othersError.message}` }, { status: 500 })
        }
      }
    }

    return NextResponse.json({
      ok: true,
      dryRun: !!dryRun,
      mode,
      scope,
      targetShopName: target.name,
      groupShopNames: groupShops.map((s) => nameById.get(s.id) || s.id),
      moved,
      skipped,
      warnings,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `処理に失敗しました: ${message}` }, { status: 500 })
  }
}
