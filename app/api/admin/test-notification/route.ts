export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendTestEmail, sendTestLine } from '@/lib/notifications'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action, shopId, smtpSettings, toEmail, token, toId } = body

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    let shopName = 'テスト店舗'
    if (shopId) {
      const { data: shop } = await supabase.from('shops').select('name').eq('id', shopId).maybeSingle()
      if (shop?.name) {
        shopName = shop.name
      }
    }

    if (action === 'email') {
      if (!toEmail) {
        return NextResponse.json({ error: '送信先メールアドレスが設定されていません。' }, { status: 400 })
      }
      await sendTestEmail({
        smtpSettings,
        toEmail,
        shopName,
      })
      return NextResponse.json({ success: true, message: 'テストメールを送信しました。受信トレイをご確認ください。' })
    }

    if (action === 'line') {
      if (!token || !toId) {
        return NextResponse.json({ error: 'LINEチャネルアクセストークンまたは通知先IDが設定されていません。' }, { status: 400 })
      }
      await sendTestLine({
        token,
        toId,
        shopName,
      })
      return NextResponse.json({ success: true, message: 'テストLINEメッセージを送信しました。LINEをご確認ください。' })
    }

    return NextResponse.json({ error: '無効なアクションです。' }, { status: 400 })
  } catch (error: any) {
    console.error('[Test Notification Route Error]:', error)
    return NextResponse.json({ error: error.message || 'テスト送信に失敗しました。設定値を確認してください。' }, { status: 500 })
  }
}
