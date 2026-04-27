import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SHOP_ID = 'a0000001-0000-0000-0000-000000000003'

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function POST(req: NextRequest) {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY が .env.local に設定されていません' },
      { status: 500 },
    )
  }

  const gasEndpoint = process.env.GAS_IMPORT_ENDPOINT
  if (!gasEndpoint) {
    return NextResponse.json(
      { error: 'GAS_IMPORT_ENDPOINT が .env.local に設定されていません。GASスクリプトをウェブアプリとしてデプロイし、URLを設定してください。' },
      { status: 400 },
    )
  }

  let body: { startDate: string; endDate: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'リクエストボディが無効です' }, { status: 400 })
  }

  const { startDate, endDate } = body
  if (!startDate || !endDate) {
    return NextResponse.json({ error: '開始日と終了日は必須です' }, { status: 400 })
  }

  if (startDate > endDate) {
    return NextResponse.json({ error: '開始日は終了日より前にしてください' }, { status: 400 })
  }

  try {
    const gasRes = await fetch(gasEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startDate, endDate }),
      signal: AbortSignal.timeout(300_000),
    })

    const text = await gasRes.text()

    let parsed: { ok: boolean; result?: ImportResult; error?: string }
    try {
      parsed = JSON.parse(text)
    } catch {
      return NextResponse.json(
        { error: 'GASからのレスポンスが不正なJSON形式です', raw: text.slice(0, 500) },
        { status: 502 },
      )
    }

    if (!parsed.ok) {
      return NextResponse.json(
        { error: parsed.error || 'GAS実行中にエラーが発生しました' },
        { status: 500 },
      )
    }

    return NextResponse.json({ ok: true, result: parsed.result })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { error: 'GASウェブアプリへのリクエストに失敗しました: ' + message },
      { status: 502 },
    )
  }
}

type ImportResult = {
  imported: number
  skipped: number
  errors: number
  log: string[]
}

/** GASを使わずSupabaseへ直接インポートする（デバッグ・テスト用）*/
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const shopId = searchParams.get('shop_id') || SHOP_ID

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY が設定されていません' },
      { status: 500 },
    )
  }

  const supabase = createAdminClient()
  const { data: therapists, error } = await supabase
    .from('therapists')
    .select('id, name')
    .eq('shop_id', shopId)
    .eq('is_active', true)
    .order('name')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    message: 'インポートAPIの接続確認用エンドポイント（GETは確認のみ）',
    shop_id: shopId,
    therapists_count: therapists?.length ?? 0,
    therapists: (therapists ?? []).map((t: { name: string }) => t.name),
    gas_endpoint_configured: !!process.env.GAS_IMPORT_ENDPOINT,
  })
}
