export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * オーナー（店舗グループ）を作成する。
 *
 * 以前は店舗登録画面からブラウザ経由で owners に直接INSERTしていたが、
 * owners はRLSが有効でポリシーが無いため必ず失敗していた。
 * 呼び出し側が失敗を握り潰していたので、オーナー未設定の店舗が黙って作られていた
 * （おニャンこスパ・ICHIGUN がこれに該当）。
 *
 * owners への書き込みはブラウザに開放せず、運営者権限を確認した上でここで行う。
 */
export async function POST(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: 'サーバー設定が不足しています（SUPABASE_SERVICE_ROLE_KEY）' },
      { status: 500 }
    )
  }
  const db = createClient(supabaseUrl, serviceKey)

  // --- 呼び出し元の権限確認 ---------------------------------------------
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
    const { name } = (await req.json()) as { name?: string }
    const groupName = (name || '').trim()
    if (!groupName) {
      return NextResponse.json({ error: 'グループ名が必要です' }, { status: 400 })
    }

    // 同名グループがあるなら作り直さず既存を返す。
    // 店舗登録をやり直したときに同じ名前のグループが増えるのを防ぐ。
    const { data: existing } = await db
      .from('owners')
      .select('id, name')
      .eq('name', groupName)
      .maybeSingle()
    if (existing) {
      return NextResponse.json({ ok: true, owner: existing, reused: true })
    }

    const { data: created, error: insertError } = await db
      .from('owners')
      .insert([{ name: groupName }])
      .select('id, name')
      .single()

    if (insertError || !created) {
      return NextResponse.json(
        { error: `グループの作成に失敗しました: ${insertError?.message || '不明なエラー'}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, owner: created, reused: false })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `処理に失敗しました: ${message}` }, { status: 500 })
  }
}
