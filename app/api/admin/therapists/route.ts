import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

/**
 * セラピストの新規登録と在籍店舗(therapist_shops)の保存。
 *
 * therapist_shops は RLS で SELECT しか許可していないため、ブラウザから直接
 * INSERT/UPSERT すると 42501 で必ず失敗する。画面側で「セラピスト本体を作る →
 * 在籍行を作る」と2回に分けて書いていたので、後半だけが落ちて在籍行のない
 * セラピストが残り、エラーを出すたびに重複が増えていた。
 * 書き込みはこのルートに集約し、在籍行が作れなければ本体も作らない。
 */

type RosterInput = {
  shop_id: string
  is_active?: boolean
  alias_name?: string | null
  age?: number | null
  height?: number | null
  bust?: number | null
  bust_cup?: string | null
  waist?: number | null
  hip?: number | null
  comment?: string | null
  rank_id?: string | null
}

// サービスロールは RLS を素通りするので、対象店舗が本当に同じオーナー配下か
// ここで必ず確かめる。
async function assertSameOwner(shopId: string, targetShopIds: string[]) {
  const { data: baseShop, error: baseError } = await supabaseAdmin
    .from('shops')
    .select('id, owner_id')
    .eq('id', shopId)
    .maybeSingle()

  if (baseError) return { error: `店舗の確認に失敗しました: ${baseError.message}` }
  if (!baseShop) return { error: '店舗が見つかりません' }

  const { data: shops, error: shopsError } = await supabaseAdmin
    .from('shops')
    .select('id, owner_id')
    .in('id', targetShopIds)

  if (shopsError) return { error: `在籍店舗の確認に失敗しました: ${shopsError.message}` }
  if ((shops || []).length !== targetShopIds.length) {
    return { error: '在籍店舗に存在しない店舗が含まれています' }
  }
  const outsider = (shops || []).find(s => s.owner_id !== baseShop.owner_id)
  if (outsider) return { error: '同じグループ外の店舗は在籍店舗に指定できません' }

  return { ownerId: baseShop.owner_id as string | null }
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as { name?: string; shopId?: string; targetShopIds?: string[] }
    const name = (body.name || '').trim()
    const shopId = body.shopId
    const targetShopIds = [...new Set(body.targetShopIds || [])]

    if (!name) return NextResponse.json({ error: '名前は必須です' }, { status: 400 })
    if (!shopId) return NextResponse.json({ error: '店舗を選択してください' }, { status: 400 })
    if (targetShopIds.length === 0) {
      return NextResponse.json({ error: '在籍する店舗を1つ以上選んでください' }, { status: 400 })
    }

    const check = await assertSameOwner(shopId, targetShopIds)
    if (check.error) return NextResponse.json({ error: check.error }, { status: 400 })

    // 一覧の先頭に来るように、既存の最小 order より1つ小さい値を振る
    const { data: minOrderData } = await supabaseAdmin
      .from('therapists')
      .select('order')
      .eq('shop_id', shopId)
      .order('order', { ascending: true })
      .limit(1)
    const nextOrder = minOrderData && minOrderData.length > 0 && minOrderData[0].order !== null
      ? minOrderData[0].order - 1
      : 0

    const { data: therapist, error: insertError } = await supabaseAdmin
      .from('therapists')
      .insert([{ name, shop_id: shopId, owner_id: check.ownerId, order: nextOrder }])
      .select()
      .single()

    if (insertError || !therapist) {
      return NextResponse.json({ error: `登録に失敗しました: ${insertError?.message || '不明なエラー'}` }, { status: 500 })
    }

    const { error: rosterError } = await supabaseAdmin
      .from('therapist_shops')
      .insert(targetShopIds.map(id => ({ therapist_id: therapist.id, shop_id: id })))

    if (rosterError) {
      // 在籍行が作れないセラピストを残すと、シフト登録画面にだけ出てくる
      // 幽霊セラピストになるので本体も戻す。
      await supabaseAdmin.from('therapists').delete().eq('id', therapist.id)
      return NextResponse.json({ error: `在籍店舗の登録に失敗しました: ${rosterError.message}` }, { status: 500 })
    }

    return NextResponse.json({ id: therapist.id })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json() as { therapistId?: string; shopId?: string; roster?: RosterInput[] }
    const { therapistId, shopId } = body
    const roster = body.roster || []

    if (!therapistId) return NextResponse.json({ error: 'therapistId が必要です' }, { status: 400 })
    if (!shopId) return NextResponse.json({ error: 'shopId が必要です' }, { status: 400 })
    if (roster.length === 0) return NextResponse.json({ ok: true })

    const check = await assertSameOwner(shopId, roster.map(r => r.shop_id))
    if (check.error) return NextResponse.json({ error: check.error }, { status: 400 })

    const { data: therapist } = await supabaseAdmin
      .from('therapists')
      .select('id, owner_id')
      .eq('id', therapistId)
      .maybeSingle()
    if (!therapist) return NextResponse.json({ error: 'セラピストが見つかりません' }, { status: 404 })
    if (therapist.owner_id && therapist.owner_id !== check.ownerId) {
      return NextResponse.json({ error: '別グループのセラピストは編集できません' }, { status: 403 })
    }

    const { error: upsertError } = await supabaseAdmin
      .from('therapist_shops')
      .upsert(
        roster.map(r => ({ ...r, therapist_id: therapistId })),
        { onConflict: 'therapist_id,shop_id' }
      )

    if (upsertError) {
      return NextResponse.json({ error: `在籍店舗の保存に失敗しました: ${upsertError.message}` }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
