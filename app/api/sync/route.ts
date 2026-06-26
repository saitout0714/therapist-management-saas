import { NextRequest } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'

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
      shops,
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

    const projectRoot = process.cwd()
    let scriptPath = ''
    const args: string[] = []

    if (syncType === 'caskan') {
      scriptPath = path.join(projectRoot, 'scripts', 'caskan_sync.py')
      if (date) {
        args.push('--date', date)
      }
      if (weeks) {
        args.push('--weeks', String(weeks))
      }
      if (dryRun) {
        args.push('--dry-run')
      }
      if (force) {
        args.push('--force')
      }
      if (shops && Array.isArray(shops) && shops.length > 0) {
        args.push('--shops', ...shops)
      }
    } else {
      scriptPath = path.join(projectRoot, 'scripts', 'shift_scraper.py')
      if (date) {
        args.push('--date', date)
      }
      if (days) {
        args.push('--days', String(days))
      }
      if (dryRun) {
        args.push('--dry-run')
      }
      if (update) {
        args.push('--update')
      }
      if (delShifts) {
        args.push('--delete')
      }
      if (force) {
        args.push('--force')
      }
      if (sites && Array.isArray(sites) && sites.length > 0) {
        args.push('--sites', ...sites)
      }
    }

    // Set encoding to handle Japanese characters properly in cmd/powershell output
    const env = {
      ...process.env,
      PYTHONIOENCODING: 'utf-8',
    }

    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`[SYSTEM] Python プロセスの開始: python ${scriptPath} ${args.join(' ')}\n\n`))

        // Spawn python process
        // On Windows, using shell: true is safer for resolving command paths
        const pyProcess = spawn('python', [scriptPath, ...args], {
          env,
          shell: true,
          cwd: projectRoot,
        })

        pyProcess.stdout.on('data', (chunk) => {
          controller.enqueue(chunk)
        })

        pyProcess.stderr.on('data', (chunk) => {
          // Send errors to log as well
          controller.enqueue(chunk)
        })

        pyProcess.on('close', (code) => {
          controller.enqueue(encoder.encode(`\n[SYSTEM] プロセスがコード ${code} で終了しました。\n`))
          controller.close()
        })

        pyProcess.on('error', (err) => {
          controller.enqueue(encoder.encode(`\n[SYSTEM] エラーが発生しました: ${err.message}\n`))
          controller.close()
        })
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
