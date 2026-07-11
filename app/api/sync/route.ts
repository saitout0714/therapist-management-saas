import { NextRequest } from 'next/server'
import { syncCaskanShop } from '@/lib/sync/caskan'
import { syncScraperSite } from '@/lib/sync/scraper'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      syncType,
      date,
      days,
      weeks,
      sites,
      site,
      shops,
      shop,
      dryRun,
      update,
      delete: delShifts,
      force,
    } = body

    if (!syncType || (syncType !== 'caskan' && syncType !== 'scraper')) {
      return new Response(
        JSON.stringify({ error: 'syncType は "caskan" または "scraper" である必要があります' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Determine target shop or site (supporting both single value and list fallback)
    let targetShop = shop || ''
    if (!targetShop && shops && Array.isArray(shops) && shops.length > 0) {
      targetShop = shops[0]
    }

    let targetSite = site || ''
    if (!targetSite && sites && Array.isArray(sites) && sites.length > 0) {
      targetSite = sites[0]
    }

    if (syncType === 'caskan' && !targetShop) {
      return new Response(
        JSON.stringify({ error: '同期対象の店舗 (shop) が指定されていません' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (syncType === 'scraper' && !targetSite) {
      return new Response(
        JSON.stringify({ error: '同期対象のサイト (site) が指定されていません' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        const onLog = (msg: string) => {
          controller.enqueue(encoder.encode(msg))
        }

        try {
          if (syncType === 'caskan') {
            onLog(`[SYSTEM] キャスカン同期開始: 店舗=${targetShop}, 開始日=${date}, 週数=${weeks || 1}, 強制=${!!force}, テスト=${!!dryRun}\n\n`)
            await syncCaskanShop(targetShop, date, weeks || 1, !!force, !!dryRun, onLog)
            onLog(`\n[SYSTEM] キャスカン同期 (店舗: ${targetShop}) が終了しました。\n`)
          } else {
            onLog(`[SYSTEM] サイトスクレイピング同期開始: サイト=${targetSite}, 開始日=${date}, 日数=${days || 1}, 更新=${!!update}, 削除=${!!delShifts}, 強制=${!!force}, テスト=${!!dryRun}\n\n`)
            await syncScraperSite(targetSite, date, days || 1, !!dryRun, !!update, !!delShifts, !!force, onLog)
            onLog(`\n[SYSTEM] サイトスクレイピング同期 (サイト: ${targetSite}) が終了しました。\n`)
          }
        } catch (err: any) {
          onLog(`\n[SYSTEM ERROR] 同期実行中にエラーが発生しました: ${err.message || err}\n`)
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    })
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || '予期せぬサーバーエラーが発生しました' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

