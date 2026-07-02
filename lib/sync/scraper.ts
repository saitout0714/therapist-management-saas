import * as cheerio from 'cheerio'
import { supabaseAdmin } from '../supabaseAdmin'

export interface SiteConfig {
  name: string
  shopId: string
  type: 'tsujido' | 'rosecafe' | 'himitsuspa' | 'kokoro' | 'queen_hiroshima' | 'carezza'
  url_tpl: string
  container?: string
  box_selector?: string
  name_sel?: string
  time_sel?: string
}

export const SITES: SiteConfig[] = [
  {
    name: '辻堂茅ヶ崎',
    shopId: '92c51e51-339b-48ce-8535-0f45c859b195',
    type: 'tsujido',
    url_tpl: 'https://mens-esthe-tsujido.com/schedule/?works={date}',
    container: '#all_content',
    box_selector: '.therapist-box.archive-sche',
    name_sel: '.therapist_name',
    time_sel: '.therapist_time',
  },
  {
    name: 'ローズカフェ',
    shopId: 'a0000001-0000-0000-0000-000000000005',
    type: 'rosecafe',
    url_tpl: 'https://rosecafe.men-este.com/schedule.html?dat={date}',
  },
  {
    name: '淑女の秘密スパ',
    shopId: '3464ed8c-44e8-46f1-b701-9b6ae0f465a8',
    type: 'himitsuspa',
    url_tpl: 'https://himitsuspa.com/schedule/index.php?day={date_compact}',
  },
  {
    name: 'アーバンスパ',
    shopId: '7d430288-8aed-4381-b3bf-f35fad962d2f',
    type: 'kokoro',
    url_tpl: 'https://urbanspa.jp/schedule/?works={date}',
    name_sel: '.therapist_name',
    time_sel: '.startend',
  },
  {
    name: '新宿秘密妻',
    shopId: '774101be-d8c5-4ca5-ba4a-fc61c039fbaa',
    type: 'kokoro',
    url_tpl: 'https://himitsuma.com/schedule/?works={date}',
    name_sel: '.therapist_name',
    time_sel: '.startend',
  },
  {
    name: 'クイーン広島',
    shopId: '09807189-96f2-4ccc-b238-815bd9e579e7',
    type: 'queen_hiroshima',
    url_tpl: 'https://hiroshima-queen.com/schedule.php',
  },
  {
    name: 'カレッツァ',
    shopId: '75e69a2a-eaac-4d2f-91af-e7579c1a84ab',
    type: 'carezza',
    url_tpl: 'https://carezza.esthe-hp.com/scheduleAll.html',
  },
]

function normalizeName(raw: string): string {
  if (!raw) return ''
  let s = raw.trim()
  s = s.replace(/[\(（][^\)）]*[\)）]/g, '')
  s = s.replace(/[〈《<][^〉 sweat_suite>]*[〉》>]/g, '')
  s = s.replace(/\d{1,2}\/\d{1,2}(初出勤|デビュー|出勤)?/g, '')
  s = s.replace(/(初出勤|デビュー|NEW|new|🆕)/g, '')
  s = s.replace(/[★☆♡♥✨💫🆕✿❤️🌸🌺🌹💋💕💓💗💝♪🎵🎀🍀🌟⭐🌙☀️🌈🦋🐝🌼🌻🍓🍒]/g, '')
  s = s.replace(/[\s\u3000]+/g, '')
  s = s.replace(/[^\w\u3000-\u9fff\u30a0-\u30ff\u3040-\u309f\u4e00-\u9fff]/g, '')
  return s.trim()
}

function parseTime(text: string): [string, string] | null {
  const m = text.match(/(\d{1,2}:\d{2})\s*[～~\-]\s*(LAST|\d{1,2}:\d{2})/i)
  if (!m) return null
  
  const start = m[1]
  const endRaw = m[2].toUpperCase()
  const [sh, sm] = start.split(':')
  
  let end = ''
  if (endRaw === 'LAST') {
    end = '29:00'
  } else {
    const [eh, em] = endRaw.split(':')
    end = `${String(parseInt(eh, 10)).padStart(2, '0')}:${em}`
  }
  
  return [`${String(parseInt(sh, 10)).padStart(2, '0')}:${sm}`, end]
}

async function fetchHtml(url: string): Promise<cheerio.CheerioAPI> {
  const resp = await fetch(url, {
    signal: AbortSignal.timeout(15000),
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    }
  })
  
  const contentType = resp.headers.get('content-type') || ''
  const buffer = await resp.arrayBuffer()
  
  let charset = 'utf-8'
  const match = contentType.match(/charset=([\w\-]+)/i)
  if (match) {
    charset = match[1].toLowerCase()
  } else {
    // Probe HTML body for charset tag
    const tempText = new TextDecoder('utf-8').decode(buffer)
    const metaMatch = tempText.match(/<meta[^>]*charset=["']?([\w\-]+)/i)
    if (metaMatch) {
      charset = metaMatch[1].toLowerCase()
    }
  }
  
  if (charset === 'shift_jis' || charset === 'sjis' || charset === 'shift-jis') {
    charset = 'shift-jis'
  } else if (charset === 'euc-jp') {
    charset = 'euc-jp'
  } else {
    charset = 'utf-8'
  }
  
  const text = new TextDecoder(charset).decode(buffer)
  return cheerio.load(text)
}

// Database Helpers
async function getTherapists(shopId: string): Promise<Record<string, string>> {
  const { data, error } = await supabaseAdmin
    .from('therapists')
    .select('id, name')
    .eq('shop_id', shopId)

  if (error || !data) throw new Error(error?.message || 'Therapists fetch failed')
  const mapping: Record<string, string> = {}
  data.forEach((t) => {
    mapping[normalizeName(t.name)] = t.id
  })
  return mapping
}

interface Room {
  id: string
  name: string
}

async function getRooms(shopId: string): Promise<Room[]> {
  const { data, error } = await supabaseAdmin
    .from('rooms')
    .select('id, name')
    .eq('shop_id', shopId)

  if (error || !data) throw new Error(error?.message || 'Rooms fetch failed')
  return data
}

interface ExistingShift {
  id: string
  start_time: string
  end_time: string
  room_id: string | null
}

async function getExistingShifts(shopId: string, dateStr: string): Promise<Record<string, ExistingShift>> {
  const { data, error } = await supabaseAdmin
    .from('shifts')
    .select('id, therapist_id, start_time, end_time, room_id')
    .eq('shop_id', shopId)
    .eq('date', dateStr)

  if (error || !data) throw new Error(error?.message || 'Shifts fetch failed')
  
  const result: Record<string, ExistingShift> = {}
  data.forEach((s) => {
    result[s.therapist_id] = {
      id: s.id,
      start_time: s.start_time ? s.start_time.slice(0, 5) : '',
      end_time: s.end_time ? s.end_time.slice(0, 5) : '',
      room_id: s.room_id,
    }
  })
  return result
}

function matchTherapist(normName: string, therapistMap: Record<string, string>): string | null {
  if (therapistMap[normName]) {
    return therapistMap[normName]
  }
  for (const [k, v] of Object.entries(therapistMap)) {
    if (k.startsWith(normName) || normName.startsWith(k)) {
      return v
    }
  }
  for (const [k, v] of Object.entries(therapistMap)) {
    if (normName.length >= 2 && (normName.includes(k) || k.includes(normName))) {
      return v
    }
  }
  return null
}

function resolveRoom(roomName: string, rooms: Room[]): string | null {
  if (!rooms || rooms.length === 0) {
    return null
  }
  if (roomName) {
    // 1. Exact match
    for (const r of rooms) {
      if (r.name === roomName) {
        return r.id
      }
    }
    // 2. Partial match
    const candidates = rooms.filter((r) => r.name.includes(roomName) || roomName.includes(r.name))
    if (candidates.length > 0) {
      candidates.sort((a, b) => Math.abs(a.name.length - roomName.length) - Math.abs(b.name.length - roomName.length))
      return candidates[0].id
    }
    return null
  }
  return rooms[0].id
}

// Scraper implementations
async function scrapeTsujido(site: SiteConfig, dateStr: string): Promise<any[]> {
  const url = site.url_tpl.replace('{date}', dateStr)
  const $ = await fetchHtml(url)
  const container = $(site.container || '#all_content')
  if (!container.length) {
    return []
  }
  
  const results: any[] = []
  container.find(site.box_selector || '.therapist-box.archive-sche').each((_, el) => {
    const box = $(el)
    const nameEl = box.find('h3.name a').length
      ? box.find('h3.name a')
      : box.find('.name a').length
      ? box.find('.name a')
      : box.find(site.name_sel || '.therapist_name')
      
    if (!nameEl.length) return
    const rawName = nameEl.text()

    const timeEl = box.find('.time-box-wrap').length
      ? box.find('.time-box-wrap')
      : box.find('.todays-time').length
      ? box.find('.todays-time')
      : box.find(site.time_sel || '.therapist_time')
      
    if (!timeEl.length) return
    const timeRes = parseTime(timeEl.text())
    if (!timeRes) return
    const [start, end] = timeRes

    const roomEl = box.find('p.room')
    const roomRaw = roomEl.length ? roomEl.text().trim() : ''
    const roomName = roomRaw.replace(/[（）()\s]/g, '')

    results.push({ name: rawName, start, end, room: roomName })
  })
  
  return results
}

async function scrapeKokoro(site: SiteConfig, dateStr: string): Promise<any[]> {
  const url = site.url_tpl.replace('{date}', dateStr)
  const $ = await fetchHtml(url)
  const labels = $('.tab_area label')
  const panels = $('.tab_panel')
  if (!labels.length || !panels.length) {
    return []
  }
  
  const targetDt = new Date(dateStr)
  const targetMonth = targetDt.getMonth() + 1
  const targetDay = targetDt.getDate()

  let panelIdx: number | null = null
  labels.each((i, el) => {
    const labelText = $(el).text().trim()
    const m = labelText.match(/(\d{1,2})[/\u6708](\d{1,2})/)
    if (m) {
      const lMonth = parseInt(m[1], 10)
      const lDay = parseInt(m[2], 10)
      if (lMonth === targetMonth && lDay === targetDay) {
        panelIdx = i
        return false
      }
    }
  })

  if (panelIdx === null || panelIdx >= panels.length) {
    return []
  }
  
  const panel = $(panels[panelIdx])
  const results: any[] = []
  
  panel.find('.cast-flex').each((_, el) => {
    const box = $(el)
    const nameEl = box.find(site.name_sel || '.therapist_name')
    const timeEl = box.find(site.time_sel || '.startend')
    if (!nameEl.length || !timeEl.length) return
    
    const timeRes = parseTime(timeEl.text())
    if (!timeRes) return
    const [start, end] = timeRes
    
    results.push({ name: nameEl.text().trim(), start, end, room: '' })
  })
  
  return results
}

async function scrapeRosecafe(site: SiteConfig, dateStr: string): Promise<any[]> {
  const url = site.url_tpl.replace('{date}', dateStr)
  const $ = await fetchHtml(url)
  const panels = $('.main-tab-panel')
  const container = panels.length ? $(panels[0]) : $('body')
  
  const results: any[] = []
  const seen = new Set<string>()
  
  container.find('.staff-box').each((_, el) => {
    const box = $(el)
    const roomWrap = box.find('.list_roomicon_wrap')
    if (!roomWrap.length) return
    
    const nameEl = box.find('.box-inner li')
    if (!nameEl.length) return
    const rawName = nameEl.text().trim()
    const norm = normalizeName(rawName)
    if (!norm || ['スタッフ', '料金', '新人', '全員'].includes(norm)) return

    const timeText = roomWrap.text()
    const timeRes = parseTime(timeText)
    if (!timeRes) return
    const [start, end] = timeRes

    const sh = parseInt(start.split(':')[0], 10)
    const eh = parseInt(end.split(':')[0], 10)
    if (eh > 26 && sh <= 6) return

    const roomEl = box.find('.list_roomicon')
    const roomName = roomEl.length ? roomEl.text().trim() : ''

    const key = `${norm}_${start}`
    if (seen.has(key)) return
    seen.add(key)

    results.push({ name: rawName, start, end, room: roomName })
  })
  
  return results
}

async function scrapeHimitsuspa(site: SiteConfig, dateStr: string): Promise<any[]> {
  const dateCompact = dateStr.replace(/-/g, '')
  const url = site.url_tpl.replace('{date_compact}', dateCompact)
  const $ = await fetchHtml(url)
  
  const results: any[] = []
  $('.therapist_view').each((_, el) => {
    const view = $(el)
    const nameEl = view.find('.therapist_name')
    const timeEl = view.find('.therapist_time')
    if (!nameEl.length || !timeEl.length) return
    
    const rawName = nameEl.text().trim()
    const rawTime = timeEl.text().trim()
    const timeRes = parseTime(rawTime)
    if (!timeRes) return
    const [start, end] = timeRes
    
    results.push({ name: rawName, start, end, room: '' })
  })
  
  return results
}

async function scrapeQueenHiroshima(site: SiteConfig, dateStr: string): Promise<any[]> {
  const targetDt = new Date(dateStr)
  const targetMd = `${String(targetDt.getMonth() + 1).padStart(2, '0')}/${String(targetDt.getDate()).padStart(2, '0')}`

  const baseUrl = site.url_tpl
  for (let offset = 0; offset < 3; offset++) {
    const url = `${baseUrl}?offset=${offset}`
    const $ = await fetchHtml(url)
    
    const firstTable = $('.scheduleList table')
    if (!firstTable.length) continue
    
    let colIdx: number | null = null
    firstTable.find('thead th').each((idx, el) => {
      if ($(el).text().includes(targetMd)) {
        colIdx = idx
        return false
      }
    })

    if (colIdx !== null) {
      const results: any[] = []
      $('.scheduleList > li').each((_, el) => {
        const li = $(el)
        const nameEl = li.find('.ladyName a').length ? li.find('.ladyName a') : li.find('.ladyName')
        if (!nameEl.length) return
        const rawName = nameEl.text().trim()
        
        const table = li.find('table')
        if (!table.length) return
        
        const tds = table.find('tbody tr td')
        if (colIdx! < tds.length) {
          const td = $(tds[colIdx!])
          const timeText = td.text().trim()
          if (timeText) {
            const timeRes = parseTime(timeText)
            if (timeRes) {
              results.push({
                name: rawName,
                start: timeRes[0],
                end: timeRes[1],
                room: ''
              })
            }
          }
        }
      })
      return results
    }
  }
  return []
}

async function scrapeCarezza(site: SiteConfig, dateStr: string): Promise<any[]> {
  // Get JST today date string YYYY-MM-DD
  const todayStr = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date()).replace(/\//g, '-')
  
  // Parse in local components to calculate difference safely
  const partsT = todayStr.split('-').map(Number)
  const partsD = dateStr.split('-').map(Number)
  const dToday = new Date(partsT[0], partsT[1] - 1, partsT[2])
  const dTarget = new Date(partsD[0], partsD[1] - 1, partsD[2])
  
  const diffTime = dTarget.getTime() - dToday.getTime()
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24))
  const dayNum = diffDays
  
  if (dayNum < 0 || dayNum > 6) {
    // Carezza scheduleAll.html only supports 7 days from today (dayNum 0 to 6)
    return []
  }

  const url = `https://carezza.esthe-hp.com/ajax/getdayscheduleitemlist/dayNum/${dayNum}/nowPage/1/`
  const $ = await fetchHtml(url)
  
  const results: any[] = []
  let currentRoom = ''
  
  // Wrap the HTML inside a container div to safely iterate children
  const container = cheerio.load(`<div>${$.html()}</div>`)('div').first()
  
  container.children().each((_, el) => {
    const $el = $(el)
    if ($el.hasClass('courseTitle')) {
      currentRoom = $el.find('span').text().trim()
    } else if ($el.is('ul')) {
      $el.find('.scheduleData').each((_, li) => {
        const $li = $(li)
        const nameEl = $li.find('.itemName ruby')
        if (!nameEl.length) return
        const rawName = nameEl.text().trim()
        
        let timeText = ''
        $li.find('.itmeTodaySchedule span').each((_, span) => {
          timeText += $(span).text().trim() + ' '
        })
        timeText = timeText.trim()
        
        const timeRes = parseTime(timeText)
        if (!timeRes) return
        const [start, end] = timeRes
        
        results.push({ name: rawName, start, end, room: currentRoom })
      })
    }
  })
  
  return results
}

const SCRAPERS: Record<string, (site: SiteConfig, dateStr: string) => Promise<any[]>> = {
  tsujido: scrapeTsujido,
  kokoro: scrapeKokoro,
  rosecafe: scrapeRosecafe,
  himitsuspa: scrapeHimitsuspa,
  queen_hiroshima: scrapeQueenHiroshima,
  carezza: scrapeCarezza,
}

export async function syncScraperSite(
  siteName: string,
  dateStr: string,
  days: number,
  dryRun: boolean,
  update: boolean,
  delShifts: boolean,
  force: boolean,
  onLog: (msg: string) => void
): Promise<void> {
  const site = SITES.find((s) => s.name === siteName)
  if (!site) {
    onLog(`[ERROR] サイト名 "${siteName}" は定義されていません。\n`)
    return
  }

  // Get current JST date (YYYY-MM-DD)
  const todayStr = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date()).replace(/\//g, '-')

  const parsedStart = new Date(dateStr)
  for (let offset = 0; offset < days; offset++) {
    const targetDt = new Date(parsedStart)
    targetDt.setUTCDate(parsedStart.getUTCDate() + offset)
    const targetDateStr = targetDt.toISOString().split('T')[0]

    if (!force && targetDateStr <= todayStr) {
      onLog(`  [SKIP] ${targetDateStr} は過去または当日のためスキップ\n`)
      continue
    }

    onLog(`\n────────────────────────────────────────────────────────────\n`)
    onLog(`  ${site.name}  |  ${targetDateStr}${dryRun ? '  [DRY RUN]' : ''}${update ? '  [UPDATE]' : ''}${delShifts ? '  [DELETE]' : ''}\n`)
    onLog(`────────────────────────────────────────────────────────────\n`)

    try {
      const therapistMap = await getTherapists(site.shopId)
      const rooms = await getRooms(site.shopId)
      const existingShifts = await getExistingShifts(site.shopId, targetDateStr)

      onLog(`  セラピスト数: ${Object.keys(therapistMap).length} / ルーム数: ${rooms.length} / 登録済: ${Object.keys(existingShifts).length}\n`)

      const scraper = SCRAPERS[site.type]
      if (!scraper) {
        onLog(`  [ERR] 未対応の type: ${site.type}\n`)
        continue
      }

      const scraped = await scraper(site, targetDateStr)
      onLog(`  スクレイピング件数: ${scraped.length}\n`)

      let registered = 0
      let updated = 0
      let deleted = 0
      let skippedDup = 0
      let skippedUnmatch = 0
      let skippedRoom = 0

      const scrapedTids = new Set<string>()

      for (const item of scraped) {
        const norm = normalizeName(item.name)
        const tid = matchTherapist(norm, therapistMap)

        if (!tid) {
          onLog(`    [WARN] 未マッチ: "${item.name}" → normalize="${norm}"\n`)
          skippedUnmatch++
          continue
        }

        const roomId = resolveRoom(item.room, rooms)

        // Room is specified but doesn't match => dummy shift, skip
        if (roomId === null) {
          onLog(`    [SKIP] ルーム未登録のためスキップ（ダミー出勤）: ${item.name} [${item.room || ''}]\n`)
          skippedRoom++
          continue
        }

        scrapedTids.add(tid)
        const roomLabel = item.room || ''

        // If shift already exists
        if (existingShifts[tid]) {
          const existing = existingShifts[tid]
          if (!update) {
            onLog(`    [SKIP] 登録済みスキップ: ${item.name}\n`)
            skippedDup++
            continue
          }

          const changedParts: string[] = []
          if (existing.start_time !== item.start || existing.end_time !== item.end) {
            changedParts.push(`時間: ${existing.start_time}～${existing.end_time} → ${item.start}～${item.end}`)
          }
          if (existing.room_id !== roomId) {
            const oldRoom = rooms.find((r) => r.id === existing.room_id)?.name || existing.room_id || 'なし'
            changedParts.push(`ルーム: ${oldRoom} → ${roomLabel}`)
          }

          if (changedParts.length === 0) {
            onLog(`    [SKIP] 変更なしスキップ: ${item.name}\n`)
            skippedDup++
            continue
          }

          if (!dryRun) {
            const { error } = await supabaseAdmin
              .from('shifts')
              .update({
                room_id: roomId,
                start_time: `${item.start}:00`,
                end_time: `${item.end}:00`,
              })
              .eq('id', existing.id)
            if (error) {
              onLog(`    [ERR] database update failed for shift ${existing.id}: ${error.message}\n`)
            }
          }

          const tag = dryRun ? '[DRY]' : '[UPDATE]'
          onLog(`    ${tag} 更新: ${item.name} (${changedParts.join(', ')})\n`)
          updated++
          continue
        }

        // New Registration
        if (!dryRun) {
          const { error } = await supabaseAdmin.from('shifts').insert({
            therapist_id: tid,
            shop_id: site.shopId,
            date: targetDateStr,
            room_id: roomId,
            start_time: `${item.start}:00`,
            end_time: `${item.end}:00`,
          })
          if (error) {
            onLog(`    [ERR] database insert failed for date ${targetDateStr}: ${error.message}\n`)
          }
        }

        const tag = dryRun ? '[DRY]' : '[OK]'
        onLog(`    ${tag} 登録: ${item.name} ${item.start}～${item.end} [${roomLabel}]\n`)
        
        // Add to temporary index to prevent duplicate inserts if script matches multiple
        existingShifts[tid] = {
          id: '',
          start_time: item.start,
          end_time: item.end,
          room_id: roomId,
        }
        registered++

        // Slight pause to avoid spamming the DB in short order
        await new Promise((resolve) => setTimeout(resolve, 300))
      }

      // Deletion of shifts not present on website
      if (delShifts) {
        for (const [tid, existing] of Object.entries(existingShifts)) {
          if (!scrapedTids.has(tid)) {
            // Find therapist name
            const therapistName = Object.entries(therapistMap).find(([_, id]) => id === tid)?.[0] || tid
            
            if (!dryRun) {
              const { error } = await supabaseAdmin.from('shifts').delete().eq('id', existing.id)
              if (error) {
                onLog(`    [ERR] database delete failed for shift ${existing.id}: ${error.message}\n`)
              }
            }

            const tag = dryRun ? '[DRY]' : '[DEL]'
            onLog(`    ${tag} 削除: ${therapistName} (サイトから消滅)\n`)
            deleted++
          }
        }
      }

      onLog(`  → 登録:${registered}  更新:${updated}  削除:${deleted}  重複スキップ:${skippedDup}  未マッチ:${skippedUnmatch}  ルームなしスキップ:${skippedRoom}\n`)
    } catch (e: any) {
      onLog(`  [ERR] 処理中にエラーが発生しました: ${e.message || e}\n`)
    }
  }
}
