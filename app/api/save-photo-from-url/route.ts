import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, key)
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_BYTES = 8 * 1024 * 1024 // 8MB

export async function POST(req: NextRequest) {
  try {
    const { photo_url, therapist_id } = await req.json()

    if (!photo_url || !therapist_id) {
      return NextResponse.json({ error: 'photo_url と therapist_id は必須です' }, { status: 400 })
    }

    // 外部URLから画像を取得
    let imgBuffer: ArrayBuffer
    let contentType: string
    try {
      const res = await fetch(photo_url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
          'Referer': new URL(photo_url).origin,
        },
        signal: AbortSignal.timeout(15000),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      contentType = res.headers.get('content-type')?.split(';')[0].trim() || 'image/jpeg'
      if (!ALLOWED_TYPES.includes(contentType)) {
        // content-typeが不明な場合はJPEGとして扱う
        contentType = 'image/jpeg'
      }
      imgBuffer = await res.arrayBuffer()
      if (imgBuffer.byteLength > MAX_BYTES) {
        return NextResponse.json({ error: '画像サイズが大きすぎます（上限8MB）' }, { status: 400 })
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : '不明なエラー'
      return NextResponse.json({ error: `画像の取得に失敗しました: ${msg}` }, { status: 422 })
    }

    const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : contentType === 'image/gif' ? 'gif' : 'jpg'
    const photoId = crypto.randomUUID()
    const path = `${therapist_id}/${photoId}.${ext}`

    const supabase = getServiceClient()

    // Supabase Storageにアップロード
    const { error: uploadError } = await supabase.storage
      .from('therapist-photos')
      .upload(path, imgBuffer, { contentType, upsert: false })

    if (uploadError) {
      return NextResponse.json({ error: 'Storageへのアップロードに失敗しました: ' + uploadError.message }, { status: 500 })
    }

    const { data: urlData } = supabase.storage.from('therapist-photos').getPublicUrl(path)

    // 現在の枚数を取得してdisplay_orderを決定
    const { count } = await supabase
      .from('therapist_photos')
      .select('*', { count: 'exact', head: true })
      .eq('therapist_id', therapist_id)

    const { data: inserted, error: insertError } = await supabase
      .from('therapist_photos')
      .insert({ therapist_id, photo_url: urlData.publicUrl, display_order: count || 0 })
      .select('id, photo_url, display_order')
      .single()

    if (insertError) {
      return NextResponse.json({ error: 'DBへの保存に失敗しました: ' + insertError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, photo: inserted })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '不明なエラー'
    return NextResponse.json({ error: `サーバーエラー: ${msg}` }, { status: 500 })
  }
}
