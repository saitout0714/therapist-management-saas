import * as cheerio from 'cheerio'
import { supabaseAdmin } from '../supabaseAdmin'
import { calculateBackInMemory, type CachedData } from '../calculateBackInMemory'

const CASKAN_SHOP_CODE = process.env.CASKAN_SHOP_CODE || 'sparich'
const CASKAN_LOGIN_ID = process.env.CASKAN_LOGIN_ID || 'mts'
const CASKAN_PASSWORD = process.env.CASKAN_PASSWORD || 'MTS'

export interface ShopConfig {
  name: string
  caskanId: number
  supabaseId: string
}

export const SHOPS: ShopConfig[] = [
  { name: 'noel', caskanId: 1055, supabaseId: '0ffa0c56-c61f-4e41-95a2-8ec3028eefdc' },
  { name: 'aroma', caskanId: 1112, supabaseId: 'd45829ba-a7e3-48d8-8b09-5e49b9f494a7' },
  { name: 'rabbit_tachikawa', caskanId: 1631, supabaseId: 'a0000001-0000-0000-0000-000000000003' },
  { name: 'rabbit_machida', caskanId: 1772, supabaseId: '933b0d5a-d436-453d-a8bc-8741a74a52c9' },
  { name: 'secret_moment', caskanId: 1823, supabaseId: 'a0000001-0000-0000-0000-000000000002' },
  { name: 'spa_rich', caskanId: 1857, supabaseId: 'a0000001-0000-0000-0000-000000000001' },
  { name: 'kamigami', caskanId: 1971, supabaseId: '3d4e98bd-ed3f-4bea-8327-4891d65c427c' },
  { name: 'kujira_spa', caskanId: 2031, supabaseId: '471f85f5-c9dd-4ed4-812a-9c5001f6903b' },
]

const CASKAN_ROOM_MAP: Record<string, string> = {
  '729': '6b7ba35d-4236-4418-973d-798124c87481',
  '309': '25419824-4503-4987-99bd-e54c592383d5',
  '208': '20314ce7-397b-4310-bc5f-70857f954a51',
  '209': 'cdd6a7e6-76cf-4ce3-9e98-5dfc1dc1fc5d',
  '210': '54fc9357-9008-4aea-a190-e656e3c76230',
  '528': '4e02da50-3c19-4387-8e05-2dbeb871995e',
  '529': 'a83f6891-cda5-416b-bfa8-15991dba30d7',
  '530': '48a2de10-52f7-45a1-ac42-a236f3ab8281',
  '1977': 'c4d0f634-e58d-42c7-a58e-4fa071e0ae00',
  '1978': 'deacf801-24dd-404b-866e-0281be03973e',
  '1979': '3212fcf4-15af-4c21-bd1f-067b04b000b6',
  '1971': '9501e6dc-e348-48a1-9fed-4b05ef826726',
  '2089': 'e710834b-cb0e-49ba-8d4e-06e705c1215c',
  '2090': '31ebee7e-0fac-46c2-87eb-3b4ca45cf919',
  '2562': 'f269bf93-ef2f-425c-915f-8577896b828f',
  '2563': 'e2ffebbb-dd6d-42f3-9f57-2eabd7070ef7',
  '2927': '7a3dc129-6738-46f1-b4a8-167835a90e31',
  '4806': '1ec96894-d383-4156-9cab-7354f63b549a',
  '4812': 'debac2e1-22be-46ea-a5a0-d7f20b3bb3e8',
  '3962': 'a084152b-fced-43c6-8d20-810a596d6db4',
  '2800': '09ba5146-59aa-4ab6-8d12-ed4869cb17e2',
  '3389': '129f4759-961b-4573-8fd1-fcda3cd99066',
  '3166': '94ae822f-7585-41d8-bbfa-57e370a5a176',
  '3169': 'a21af0f2-441f-43bd-8718-2057e530b02a',
  '3167': '33d510b9-aa4f-424e-83d5-34e9d26d2c1c',
  '3170': 'c8906495-c1e4-440e-88f2-b8bb60a463ce',
  '3330': '101f4c93-b6a8-47cb-8ded-f4ea96007f1c',
  '3320': '8cdc1cef-4d4c-457d-9ae1-2e695c1e7745',
  '4892': 'c61876a2-0121-4a3b-8bb2-9585b5101c7d',
  '4813': '60ea8984-197f-437b-b3f5-9e3a94e0037a',
  '4814': '6154fad0-0b11-4de6-95c8-5190663ccc22',
  '3168': '657606f0-2f84-4ce6-9899-5e6e8445c428',
  '2560': '958d4d64-f535-4818-8873-5b197e7eae17',
}

class FetchSession {
  private cookies: Record<string, string> = {}

  async request(url: string, options: RequestInit = {}): Promise<Response> {
    const headers = new Headers(options.headers || {})
    const cookieHeader = Object.entries(this.cookies)
      .map(([name, value]) => `${name}=${value}`)
      .join('; ')
    
    if (cookieHeader) {
      headers.set('Cookie', cookieHeader)
    }
    
    if (!headers.has('User-Agent')) {
      headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
    }

    const response = await fetch(url, { ...options, headers })

    const setCookieHeaders = response.headers.getSetCookie 
      ? response.headers.getSetCookie() 
      : (response.headers.get('set-cookie')?.split(/,\s*(?=\w+=)/) || [])

    for (const cookieStr of setCookieHeaders) {
      const parts = cookieStr.split(';')[0].split('=')
      if (parts.length >= 2) {
        const name = parts[0].trim()
        const value = parts.slice(1).join('=').trim()
        this.cookies[name] = value
      }
    }

    return response
  }

  async get(url: string, options: RequestInit = {}): Promise<Response> {
    return this.request(url, { ...options, method: 'GET' })
  }

  async post(url: string, bodyData: Record<string, string>, options: RequestInit = {}): Promise<Response> {
    const formBody = new URLSearchParams()
    for (const [key, value] of Object.entries(bodyData)) {
      formBody.append(key, value)
    }
    return this.request(url, {
      ...options,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        ...(options.headers || {}),
      },
      body: formBody,
    })
  }
}

function normalizeCastName(raw: string): string {
  if (!raw) return ''
  const s = raw.split('/')[0].split('(')[0].split('（')[0]
  return s.trim()
}

function matchTherapist(caskanName: string, therapistMap: Record<string, string>): string | null {
  if (therapistMap[caskanName]) {
    return therapistMap[caskanName]
  }

  const normCaskan = normalizeCastName(caskanName)
  if (therapistMap[normCaskan]) {
    return therapistMap[normCaskan]
  }

  for (const [tName, tId] of Object.entries(therapistMap)) {
    if (normalizeCastName(tName) === normCaskan) {
      return tId
    }
  }

  return null
}

async function caskanLogin(session: FetchSession): Promise<boolean> {
  // Initialize the CAKEPHP session cookie with a GET request first
  await session.get('https://my.caskan.jp/login')

  const r = await session.post('https://my.caskan.jp/login', {
    mode: 'step1',
    shop_code: CASKAN_SHOP_CODE,
    code: CASKAN_LOGIN_ID,
  })
  if (r.status !== 200) return false

  const r2 = await session.post('https://my.caskan.jp/login/password', {
    mode: 'step2',
    login_password: CASKAN_PASSWORD,
  })
  
  return !r2.url.includes('login')
}

async function caskanSwitchShop(session: FetchSession, shopId: number): Promise<boolean> {
  const r = await session.get(`https://my.caskan.jp/assist_agent/login?shop_id=${shopId}`)
  return r.status === 200
}

interface CaskanShift {
  castName: string
  day: string
  startTime: string
  endTime: string
  roomId: string | null
  rawRoomId: string
}

async function caskanGetShifts(
  session: FetchSession,
  targetDate: Date,
  onLog: (msg: string) => void
): Promise<CaskanShift[]> {
  const dateStr = targetDate.toISOString().split('T')[0]
  const baseUrl = `https://my.caskan.jp/shift?date=${dateStr}`
  const r = await session.get(baseUrl)
  if (r.status !== 200) {
    onLog(`[WARN] シフトカレンダーの取得に失敗しました (Status: ${r.status})\n`)
    return []
  }
  const html = await r.text()
  let $ = cheerio.load(html)
  const shifts: CaskanShift[] = []

  const parsePage = (pageCheerio: cheerio.CheerioAPI) => {
    pageCheerio('.tbl-calendar tr').each((_, row) => {
      const nameLink = pageCheerio(row).find('a[href^="/cast/view"]')
      const castName = nameLink.text().trim()
      if (!castName) return

      pageCheerio(row).find('td[data-cast-id]').each((_, cell) => {
        const shiftId = pageCheerio(cell).attr('data-id') || ''
        if (!shiftId) return

        const fromH = pageCheerio(cell).attr('data-from-hour') || ''
        const fromM = pageCheerio(cell).attr('data-from-min') || '0'
        const toH = pageCheerio(cell).attr('data-to-hour') || ''
        const toM = pageCheerio(cell).attr('data-to-min') || '0'

        if (!fromH || !toH) {
          return
        }

        const rawRoomId = pageCheerio(cell).attr('data-room-id') || ''
        const roomId = CASKAN_ROOM_MAP[rawRoomId] || null

        if (rawRoomId && !roomId) {
          onLog(`[WARN] [ルームMAP未登録] キャスト:${castName} / キャスカン側部屋ID:${rawRoomId} が CASKAN_ROOM_MAP にありません。\n`)
        }

        const day = pageCheerio(cell).attr('data-day') || ''

        // Format to HH:MM:00
        const startTime = `${fromH.padStart(2, '0')}:${fromM.padStart(2, '0')}:00`
        const endTime = `${toH.padStart(2, '0')}:${toM.padStart(2, '0')}:00`

        shifts.push({
          castName,
          day,
          startTime,
          endTime,
          roomId,
          rawRoomId,
        })
      })
    })
  }

  // Parse page 1
  parsePage($)

  // Find other pages
  const pageUrls = new Set<string>()
  $('.pagination li a[href]').each((_, el) => {
    const href = $(el).attr('href')
    if (href) {
      const fullUrl = href.startsWith('http') ? href : `https://my.caskan.jp${href}`
      pageUrls.add(fullUrl)
    }
  })

  // Fetch and parse other pages
  for (const url of pageUrls) {
    onLog(`Fetching pagination page: ${url.replace('https://my.caskan.jp', '')}...\n`)
    const rPage = await session.get(url)
    if (rPage.status === 200) {
      const htmlPage = await rPage.text()
      const $page = cheerio.load(htmlPage)
      parsePage($page)
    } else {
      onLog(`[WARN] ページ取得失敗 (Status: ${rPage.status})\n`)
    }
  }

  return shifts
}

async function caskanGetScheduleShifts(
  session: FetchSession,
  dateStr: string,
  onLog: (msg: string) => void
): Promise<CaskanShift[]> {
  const r = await session.get(`https://my.caskan.jp/schedule?date=${dateStr}`)
  if (r.status !== 200) {
    onLog(`[WARN] デイリースケジュール (${dateStr}) の取得に失敗しました (Status: ${r.status})\n`)
    return []
  }
  const html = await r.text()
  const $ = cheerio.load(html)
  const shifts: CaskanShift[] = []

  $('tr').each((_, row) => {
    const editLink = $(row).find('.link-mod-shift')
    if (editLink.length === 0) return

    const th = $(row).find('th')
    if (th.length === 0) return

    const nameDiv = th.find('.small.nowrap').first()
    if (nameDiv.length === 0) return

    let castName = ''
    nameDiv.contents().each((_, node) => {
      if (node.type === 'text') {
        castName += $(node).text()
      }
    })
    castName = castName.trim()
    if (!castName) return

    const shiftId = editLink.attr('data-id') || ''
    if (!shiftId) return

    const day = editLink.attr('data-day') || ''
    const fromH = editLink.attr('data-from-hour') || ''
    const fromM = editLink.attr('data-from-min') || '0'
    const toH = editLink.attr('data-to-hour') || ''
    const toM = editLink.attr('data-to-min') || '0'
    const rawRoomId = editLink.attr('data-room-id') || ''

    if (!fromH || !toH) return

    const roomId = CASKAN_ROOM_MAP[rawRoomId] || null

    if (rawRoomId && !roomId) {
      onLog(`[WARN] [ルームMAP未登録] キャスト:${castName} / キャスカン側部屋ID:${rawRoomId} が CASKAN_ROOM_MAP にありません。\n`)
    }

    const startTime = `${fromH.padStart(2, '0')}:${fromM.padStart(2, '0')}:00`
    const endTime = `${toH.padStart(2, '0')}:${toM.padStart(2, '0')}:00`

    shifts.push({
      castName,
      day,
      startTime,
      endTime,
      roomId,
      rawRoomId,
    })
  })

  return shifts
}

interface ExistingShift {
  id: string
  therapist_id: string
  date: string
  start_time: string
  end_time: string
  room_id: string | null
}

async function getTherapistMap(shopUuid: string): Promise<Record<string, string>> {
  const { data, error } = await supabaseAdmin
    .from('therapists')
    .select('id, name')
    .eq('shop_id', shopUuid)

  if (error || !data) return {}
  const mapping: Record<string, string> = {}
  data.forEach((t) => {
    if (!mapping[t.name]) {
      mapping[t.name] = t.id
    }
  })
  return mapping
}

async function getExistingShifts(
  shopUuid: string,
  dateFrom: string,
  dateTo: string
): Promise<Record<string, ExistingShift[]>> {
  const { data, error } = await supabaseAdmin
    .from('shifts')
    .select('id, therapist_id, date, start_time, end_time, room_id')
    .eq('shop_id', shopUuid)
    .gte('date', dateFrom)
    .lte('date', dateTo)

  if (error || !data) return {}
  const mapping: Record<string, ExistingShift[]> = {}
  data.forEach((row) => {
    const key = `${row.therapist_id}_${row.date}`
    if (!mapping[key]) {
      mapping[key] = []
    }
    mapping[key].push({
      id: row.id,
      therapist_id: row.therapist_id,
      date: row.date,
      start_time: row.start_time,
      end_time: row.end_time,
      room_id: row.room_id,
    })
  })
  return mapping
}

export async function syncCaskanShop(
  shopName: string,
  startDateStr: string,
  weeks: number,
  force: boolean,
  dryRun: boolean,
  onLog: (msg: string) => void
): Promise<void> {
  const shop = SHOPS.find((s) => s.name === shopName)
  if (!shop) {
    onLog(`[ERROR] 店舗名 "${shopName}" は定義されていません。\n`)
    return
  }

  const session = new FetchSession()
  onLog('Login...\n')
  const loggedIn = await caskanLogin(session)
  if (!loggedIn) {
    onLog('LOGIN FAILED\n')
    return
  }
  onLog('Login OK\n')

  const parsedDate = new Date(startDateStr)
  // Calculate start of the week (Monday is 1 in JS, Sunday is 0)
  // We match python's weekday start which is Monday (weekday()=0)
  // In JS, day of week is 0 (Sunday) to 6 (Saturday).
  // Monday is 1. If it's Sunday (0), weekday_offset is 6. Otherwise day - 1.
  const dayOfWeek = parsedDate.getUTCDay()
  const weekdayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const weekStart = new Date(parsedDate)
  weekStart.setUTCDate(parsedDate.getUTCDate() - weekdayOffset)

  // Get current JST date (UTC + 9 hours)
  const today = new Date(new Date().getTime() + 9 * 60 * 60 * 1000)
  const todayStr = today.toISOString().split('T')[0]

  onLog('==================================================\n')
  onLog(`Shop: ${shop.name} (caskan:${shop.caskanId})\n`)
  onLog('==================================================\n')

  // Switch shop
  const switched = await caskanSwitchShop(session, shop.caskanId)
  if (!switched) {
    onLog(`[ERROR] 店舗切り替えに失敗しました (caskan:${shop.caskanId})\n`)
    return
  }

  // Load therapists
  const therapistMap = await getTherapistMap(shop.supabaseId)
  onLog(`Therapists: ${Object.keys(therapistMap).length}\n`)

  let totalOk = 0
  let totalUpdate = 0
  let totalDelete = 0
  let totalSkip = 0
  const unknown: string[] = []

  for (let weekOffset = 0; weekOffset < weeks; weekOffset++) {
    const target = new Date(weekStart)
    target.setUTCDate(weekStart.getUTCDate() + weekOffset * 7)
    
    let dateFrom = target.toISOString().split('T')[0]
    
    const targetEnd = new Date(target)
    targetEnd.setUTCDate(target.getUTCDate() + 6)
    const dateTo = targetEnd.toISOString().split('T')[0]

    if (!force) {
      const tomorrow = new Date(today)
      tomorrow.setUTCDate(today.getUTCDate() + 1)
      const tomorrowStr = tomorrow.toISOString().split('T')[0]

      if (dateTo < tomorrowStr) {
        onLog(`Date: ${dateFrom} - ${dateTo} [SKIP (Past)]\n`)
        continue
      }
      if (dateFrom < tomorrowStr) {
        dateFrom = tomorrowStr
      }
    }

    onLog(`Date: ${dateFrom} - ${dateTo}\n`)

    const weeklyShifts = await caskanGetShifts(session, target, onLog)
    
    // Group weekly shifts by day
    const weeklyShiftsByDay: Record<string, CaskanShift[]> = {}
    for (const s of weeklyShifts) {
      if (!weeklyShiftsByDay[s.day]) {
        weeklyShiftsByDay[s.day] = []
      }
      weeklyShiftsByDay[s.day].push(s)
    }

    const caskanShifts: CaskanShift[] = []
    const parseLocalDate = (str: string) => {
      const parts = str.split('-').map(Number)
      return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]))
    }

    const currentDate = parseLocalDate(dateFrom)
    const endDate = parseLocalDate(dateTo)

    while (currentDate <= endDate) {
      const dayStr = currentDate.toISOString().split('T')[0]
      onLog(`Syncing day: ${dayStr}... `)
      const daily = await caskanGetScheduleShifts(session, dayStr, onLog)
      if (daily.length > 0) {
        onLog(`found ${daily.length} shifts on daily schedule.\n`)
        caskanShifts.push(...daily)
      } else {
        const weekly = weeklyShiftsByDay[dayStr] || []
        if (weekly.length > 0) {
          onLog(`fallback to weekly: ${weekly.length} shifts.\n`)
          caskanShifts.push(...weekly)
        } else {
          onLog(`0 shifts.\n`)
        }
      }
      currentDate.setUTCDate(currentDate.getUTCDate() + 1)
    }

    const existingShifts = await getExistingShifts(shop.supabaseId, dateFrom, dateTo)

    const caskanIndex: Record<string, CaskanShift[]> = {}
    for (const s of caskanShifts) {
      const tId = matchTherapist(s.castName, therapistMap)
      if (!tId) {
        if (!unknown.includes(s.castName)) {
          unknown.push(s.castName)
        }
        continue
      }
      if (s.day < dateFrom || s.day > dateTo) {
        continue
      }
      const key = `${tId}_${s.day}`
      if (!caskanIndex[key]) {
        caskanIndex[key] = []
      }
      caskanIndex[key].push(s)
    }

    // Get all keys
    const allKeys = new Set<string>([
      ...Object.keys(existingShifts),
      ...Object.keys(caskanIndex),
    ])

    for (const key of allKeys) {
      const parts = key.split('_')
      const tId = parts[0]
      const day = parts[1]

      const caskanList = caskanIndex[key] || []
      const existingList = existingShifts[key] || []

      // Sort by start_time
      caskanList.sort((a, b) => a.startTime.localeCompare(b.startTime))
      existingList.sort((a, b) => a.start_time.localeCompare(b.start_time))

      const maxLen = Math.max(caskanList.length, existingList.length)
      for (let i = 0; i < maxLen; i++) {
        if (i < caskanList.length && i < existingList.length) {
          const s = caskanList[i]
          const ex = existingList[i]

          const exStart = ex.start_time.slice(0, 5)
          const sStart = s.startTime.slice(0, 5)
          const exEnd = ex.end_time.slice(0, 5)
          const sEnd = s.endTime.slice(0, 5)

          if (exStart !== sStart || exEnd !== sEnd || ex.room_id !== s.roomId) {
            if (!dryRun) {
              const { error } = await supabaseAdmin
                .from('shifts')
                .update({
                  start_time: s.startTime,
                  end_time: s.endTime,
                  room_id: s.roomId,
                })
                .eq('id', ex.id)
              if (error) {
                onLog(`[ERROR] database update failed for shift ${ex.id}: ${error.message}\n`)
              }
            }
            const tag = dryRun ? '[DRY]' : '[UPDATE]'
            onLog(`${tag}: ${day} ${exStart}->${sStart} (${sEnd})\n`)
            totalUpdate++
          } else {
            totalSkip++
          }
        } else if (i < caskanList.length) {
          const s = caskanList[i]
          if (!dryRun) {
            const { error } = await supabaseAdmin.from('shifts').insert({
              therapist_id: tId,
              shop_id: shop.supabaseId,
              date: day,
              start_time: s.startTime,
              end_time: s.endTime,
              room_id: s.roomId,
            })
            if (error) {
              onLog(`[ERROR] database insert failed for date ${day}: ${error.message}\n`)
            }
          }
          const tag = dryRun ? '[DRY]' : '[OK]'
          onLog(`${tag}: ${day} ${s.startTime.slice(0, 5)}-${s.endTime.slice(0, 5)}${s.roomId ? ' room:OK' : ' room:none'}\n`)
          totalOk++
        } else if (i < existingList.length) {
          const ex = existingList[i]
          if (!dryRun) {
            const { error } = await supabaseAdmin.from('shifts').delete().eq('id', ex.id)
            if (error) {
              onLog(`[ERROR] database delete failed for shift ${ex.id}: ${error.message}\n`)
            }
          }
          const tag = dryRun ? '[DRY]' : '[DELETED]'
          onLog(`${tag}: ${day} ${ex.start_time.slice(0, 5)}\n`)
          totalDelete++
        }
      }
    }
  }

  onLog(`Registered:${totalOk} Updated:${totalUpdate} Deleted:${totalDelete} Skipped:${totalSkip}\n`)
  if (unknown.length > 0) {
    onLog(`Unmatched: ${unknown.join(', ')}\n`)
  }
}

// ============================================================
// 予約 (reservations) 同期
// ============================================================

const DESIGNATION_LABEL_MAP: Record<string, string> = {
  '指名なし': 'free',
  '写真指名': 'first_nomination',
  '本指名': 'confirmed',
}

const STATUS_LABEL_MAP: Record<string, 'pending' | 'confirmed' | 'cancelled' | 'skip'> = {
  '新規予約': 'pending',
  '調整中': 'pending',
  '予約確定': 'confirmed',
  '完了': 'confirmed',
  'キャンセル': 'cancelled',
  '下書き': 'skip',
}

interface CaskanReserveListRow {
  reserveId: string
  customerNameRaw: string
  customerType: string
  reserveMonth: number
  reserveDay: number
  startTimeText: string
  castNameRaw: string
  designationLabel: string
  courseText: string
  roomNameRaw: string
  paymentLabel: string
  channelLabel: string
  statusLabel: string
}

interface CaskanReserveDetail {
  phone: string
  furigana: string
  requestNote: string
  treatmentMemo: string
  discountReason: string
  discountAmount: number
}

function normalizeReserveCastName(raw: string): string {
  let s = raw.trim()
  s = s.replace(/\.\.$/, '')
  s = s.replace(/\d{1,2}\/\d{1,2}.*$/, '')
  s = s.replace(/体験入店.*$/, '')
  return s.trim()
}

function normalizePhone(raw: string): string {
  return (raw || '').replace(/[^\d]/g, '')
}

function parseCourseText(text: string): { name: string; duration: number } | null {
  const clean = text.replace(/\s+/g, ' ').trim()
  const m = clean.match(/^(.*?)\s*(\d+)\s*分$/)
  if (!m) return null
  return { name: m[1].trim(), duration: parseInt(m[2], 10) }
}

function resolveYearForMMDD(month: number, day: number, dateFromStr: string, dateToStr: string): number {
  const fromYear = parseInt(dateFromStr.split('-')[0], 10)
  const toYear = parseInt(dateToStr.split('-')[0], 10)
  for (const year of [fromYear, toYear, fromYear + 1, fromYear - 1]) {
    const candidate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    if (candidate >= dateFromStr && candidate <= dateToStr) {
      return year
    }
  }
  return fromYear
}

function parseReserveListRow($: cheerio.CheerioAPI, tr: any): CaskanReserveListRow | null {
  const $tr = $(tr)
  const tds = $tr.find('td')
  if (tds.length < 15) return null

  const checkbox = $(tds[0]).find('input[name="reserve_id[]"]')
  const reserveId = checkbox.attr('value') || ''
  if (!reserveId) return null

  const customerCell = $(tds[3])
  const customerNameRaw = customerCell.find('a').text().trim()
  const customerType = customerCell.find('span').text().trim()

  const reserveDateText = $(tds[4]).text().trim().replace(/\s+/g, ' ')
  const dateMatch = reserveDateText.match(/(\d{1,2})\/(\d{1,2})\D+(\d{1,2}):(\d{2})/)
  if (!dateMatch) return null
  const reserveMonth = parseInt(dateMatch[1], 10)
  const reserveDay = parseInt(dateMatch[2], 10)
  const startTimeText = `${dateMatch[3].padStart(2, '0')}:${dateMatch[4]}`

  const castCell = $(tds[5])
  const castNameRaw = castCell.find('a').text().trim()
  const designationLabel = castCell.find('span').text().trim()

  const courseText = $(tds[6]).text().trim()
  const roomNameRaw = $(tds[7]).text().trim()
  const paymentLabel = $(tds[11]).text().trim()
  const channelLabel = $(tds[12]).text().trim()
  const statusLabel = $(tds[13]).find('a.link-status').text().trim() || $(tds[13]).text().trim()

  return {
    reserveId,
    customerNameRaw,
    customerType,
    reserveMonth,
    reserveDay,
    startTimeText,
    castNameRaw,
    designationLabel,
    courseText,
    roomNameRaw,
    paymentLabel,
    channelLabel,
    statusLabel,
  }
}

async function caskanFetchReserveListPage(
  session: FetchSession,
  dateFrom: string,
  dateTo: string,
  page: number,
  onLog: (msg: string) => void
): Promise<CaskanReserveListRow[]> {
  const url = page === 1
    ? `https://my.caskan.jp/reserve?date_from=${dateFrom}&date_to=${dateTo}`
    : `https://my.caskan.jp/reserve/index/page:${page}?date_from=${dateFrom}&date_to=${dateTo}`
  const r = await session.get(url)
  if (r.status !== 200) {
    onLog(`[WARN] 予約一覧の取得に失敗しました page:${page} (Status: ${r.status})\n`)
    return []
  }
  const html = await r.text()
  const $ = cheerio.load(html)
  const rows: CaskanReserveListRow[] = []
  $('table.tbl-reserve-list tr').each((i, tr) => {
    if (i === 0) return
    const parsed = parseReserveListRow($, tr)
    if (parsed) rows.push(parsed)
  })
  return rows
}

async function caskanFetchReserveDetail(session: FetchSession, reserveId: string): Promise<CaskanReserveDetail> {
  const r = await session.get(`https://my.caskan.jp/reserve/view?id=${reserveId}`)
  const detail: CaskanReserveDetail = {
    phone: '',
    furigana: '',
    requestNote: '',
    treatmentMemo: '',
    discountReason: '',
    discountAmount: 0,
  }
  if (r.status !== 200) return detail

  const html = await r.text()
  const $ = cheerio.load(html)
  const fields: Record<string, string> = {}
  $('table.tbl-panel').first().find('tr').each((_, tr) => {
    const th = $(tr).find('th').first().text().trim()
    const td = $(tr).find('td').first().text().trim().replace(/\s+/g, ' ')
    if (th) fields[th] = td
  })

  detail.phone = normalizePhone(fields['電話番号'] || '')
  detail.furigana = fields['フリガナ'] || ''
  detail.requestNote = fields['予約時ご要望'] || ''
  detail.treatmentMemo = fields['施術メモ'] || ''

  const discountValue = fields['割引'] || ''
  const discountMatch = discountValue.match(/^(.*?)\s*([0-9,]+)$/)
  if (discountMatch) {
    detail.discountReason = discountMatch[1].trim()
    detail.discountAmount = parseInt(discountMatch[2].replace(/,/g, ''), 10) || 0
  }

  return detail
}

export async function syncCaskanReservations(
  shopName: string,
  dateFromStr: string,
  dateToStr: string,
  dryRun: boolean,
  onLog: (msg: string) => void
): Promise<void> {
  const shop = SHOPS.find((s) => s.name === shopName)
  if (!shop) {
    onLog(`[ERROR] 店舗名 "${shopName}" は定義されていません。\n`)
    return
  }

  const session = new FetchSession()
  onLog('Login...\n')
  const loggedIn = await caskanLogin(session)
  if (!loggedIn) {
    onLog('LOGIN FAILED\n')
    return
  }
  onLog('Login OK\n')

  const switched = await caskanSwitchShop(session, shop.caskanId)
  if (!switched) {
    onLog(`[ERROR] 店舗切り替えに失敗しました (caskan:${shop.caskanId})\n`)
    return
  }

  onLog('==================================================\n')
  onLog(`Shop: ${shop.name} (caskan:${shop.caskanId})\n`)
  onLog(`予約日: ${dateFromStr} 〜 ${dateToStr}\n`)
  onLog('==================================================\n')

  // マスタデータの一括取得
  const [therapistsRes, roomsRes, coursesRes, customersRes, existingReservationsRes] = await Promise.all([
    supabaseAdmin.from('therapists').select('id, name, rank_id, back_calc_type').eq('shop_id', shop.supabaseId),
    supabaseAdmin.from('rooms').select('id, name').eq('shop_id', shop.supabaseId),
    supabaseAdmin.from('courses').select('id, name, duration, base_price, back_amount').eq('shop_id', shop.supabaseId).eq('is_active', true),
    supabaseAdmin.from('customers').select('id, name, phone').eq('shop_id', shop.supabaseId),
    supabaseAdmin.from('reservations').select('id, caskan_reservation_id, status, date, start_time, end_time, room_id')
      .eq('shop_id', shop.supabaseId).not('caskan_reservation_id', 'is', null),
  ])

  const therapists = therapistsRes.data || []
  const rooms = roomsRes.data || []
  const courses = coursesRes.data || []
  const customers = customersRes.data || []
  const existingByCaskanId = new Map<string, any>()
  for (const r of existingReservationsRes.data || []) {
    if (r.caskan_reservation_id) existingByCaskanId.set(r.caskan_reservation_id, r)
  }

  const therapistIds = Array.from(new Set(therapists.map((t: any) => t.id)))
  const [
    designationTypesRes,
    shopBackRuleRes,
    systemSettingsRes,
    therapistPricingsRes,
    therapistBackOverridesRes,
    rankBackRulesRes,
    deductionRulesRes,
    courseBackAmountsRes,
  ] = await Promise.all([
    supabaseAdmin.from('designation_types').select('id, slug, default_fee, default_back_amount, is_store_paid_back').eq('shop_id', shop.supabaseId),
    supabaseAdmin.from('shop_back_rules').select('*').eq('shop_id', shop.supabaseId).maybeSingle(),
    supabaseAdmin.from('system_settings').select('*').eq('shop_id', shop.supabaseId).maybeSingle(),
    therapistIds.length > 0 ? supabaseAdmin.from('therapist_pricing').select('*').in('therapist_id', therapistIds) : Promise.resolve({ data: [] as any[] }),
    therapistIds.length > 0 ? supabaseAdmin.from('therapist_back_overrides').select('*').in('therapist_id', therapistIds) : Promise.resolve({ data: [] as any[] }),
    supabaseAdmin.from('rank_back_rules').select('*').eq('shop_id', shop.supabaseId),
    supabaseAdmin.from('deduction_rules').select('*').eq('shop_id', shop.supabaseId).eq('is_active', true),
    supabaseAdmin.from('course_back_amounts').select('*').eq('shop_id', shop.supabaseId),
  ])

  const cache: CachedData = {
    shopBackRule: shopBackRuleRes.data || null,
    designationTypes: designationTypesRes.data || [],
    courseBackAmounts: courseBackAmountsRes.data || [],
    therapistBackOverrides: therapistBackOverridesRes.data || [],
    rankBackRules: rankBackRulesRes.data || [],
    deductionRules: deductionRulesRes.data || [],
    systemSettings: systemSettingsRes.data || null,
    therapistPricings: therapistPricingsRes.data || [],
  }

  const findTherapist = (rawName: string) => {
    const cleanName = normalizeReserveCastName(rawName)
    if (!cleanName) return null
    const exact = therapists.find((t: any) => t.name.trim() === cleanName)
    if (exact) return exact
    const partial = therapists.find((t: any) => t.name.includes(cleanName) || cleanName.includes(t.name))
    return partial || null
  }

  const normalizeRoomName = (s: string) => s.trim().replace(/[：]/g, ':').replace(/\s+/g, '')
  const findRoom = (rawName: string): string | null => {
    const cleanInput = normalizeRoomName(rawName || '')
    if (!cleanInput) return null
    const exact = rooms.find((r: any) => normalizeRoomName(r.name) === cleanInput)
    if (exact) return exact.id
    const partial = rooms.find((r: any) => {
      const n = normalizeRoomName(r.name)
      return n.includes(cleanInput) || cleanInput.includes(n)
    })
    return partial ? partial.id : null
  }

  const findCourse = (duration: number) => {
    if (courses.length === 0) return null
    const exact = courses.find((c: any) => c.duration === duration)
    if (exact) return exact
    return courses.reduce((prev: any, curr: any) =>
      Math.abs(curr.duration - duration) < Math.abs(prev.duration - duration) ? curr : prev
    )
  }

  const customersByPhone = new Map<string, any>()
  for (const c of customers) {
    if (c.phone) customersByPhone.set(normalizePhone(c.phone), c)
  }

  let totalOk = 0
  let totalUpdate = 0
  let totalSkip = 0
  let totalCancelled = 0
  const unknownTherapists: string[] = []
  const unknownRooms: string[] = []
  const unknownDesignations: string[] = []

  let page = 1
  const rows: CaskanReserveListRow[] = []
  while (page <= 50) {
    const pageRows = await caskanFetchReserveListPage(session, dateFromStr, dateToStr, page, onLog)
    if (pageRows.length === 0) break
    rows.push(...pageRows)
    onLog(`Page ${page}: ${pageRows.length}件取得\n`)
    if (pageRows.length < 100) break
    page++
  }

  onLog(`\n合計 ${rows.length}件の予約を処理します。\n\n`)

  for (const row of rows) {
    const statusKind = STATUS_LABEL_MAP[row.statusLabel] || 'pending'
    if (statusKind === 'skip') {
      totalSkip++
      continue
    }

    const existing = existingByCaskanId.get(row.reserveId)

    if (existing) {
      const year = resolveYearForMMDD(row.reserveMonth, row.reserveDay, dateFromStr, dateToStr)
      const date = `${year}-${String(row.reserveMonth).padStart(2, '0')}-${String(row.reserveDay).padStart(2, '0')}`
      const roomId = findRoom(row.roomNameRaw)
      const startTime = `${row.startTimeText}:00`

      const needsUpdate =
        existing.status !== statusKind ||
        existing.date !== date ||
        existing.start_time?.slice(0, 5) !== row.startTimeText ||
        existing.room_id !== roomId

      if (needsUpdate) {
        const tag = dryRun ? '[DRY-UPDATE]' : '[UPDATE]'
        onLog(`${tag} ${row.reserveId}: ${date} ${row.startTimeText} status=${statusKind}\n`)
        if (!dryRun) {
          const { error } = await supabaseAdmin.from('reservations').update({
            status: statusKind,
            date,
            start_time: startTime,
            room_id: roomId,
          }).eq('id', existing.id)
          if (error) {
            onLog(`[ERROR] update failed for ${row.reserveId}: ${error.message}\n`)
            continue
          }
        }
        totalUpdate++
        if (statusKind === 'cancelled') totalCancelled++
      } else {
        totalSkip++
      }
      continue
    }

    // 新規予約
    const therapist = findTherapist(row.castNameRaw)
    if (!therapist) {
      const cleanName = normalizeReserveCastName(row.castNameRaw)
      if (!unknownTherapists.includes(cleanName)) unknownTherapists.push(cleanName)
      continue
    }

    const roomId = findRoom(row.roomNameRaw)
    if (!roomId && !unknownRooms.includes(row.roomNameRaw)) {
      unknownRooms.push(row.roomNameRaw)
    }

    const parsedCourse = parseCourseText(row.courseText)
    if (!parsedCourse) {
      onLog(`[WARN] コース解析失敗: ${row.reserveId} "${row.courseText}"\n`)
      continue
    }
    const course = findCourse(parsedCourse.duration)
    if (!course) {
      onLog(`[WARN] コースが見つかりません: ${row.reserveId} (${parsedCourse.duration}分, 店舗にコース未登録)\n`)
      continue
    }

    const designationType = DESIGNATION_LABEL_MAP[row.designationLabel] || 'free'
    if (!DESIGNATION_LABEL_MAP[row.designationLabel] && !unknownDesignations.includes(row.designationLabel)) {
      unknownDesignations.push(row.designationLabel)
    }

    const year = resolveYearForMMDD(row.reserveMonth, row.reserveDay, dateFromStr, dateToStr)
    const date = `${year}-${String(row.reserveMonth).padStart(2, '0')}-${String(row.reserveDay).padStart(2, '0')}`
    const startTime = `${row.startTimeText}:00`
    const startMinutes = parseInt(row.startTimeText.split(':')[0], 10) * 60 + parseInt(row.startTimeText.split(':')[1], 10)
    const endMinutes = startMinutes + parsedCourse.duration
    const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}:00`

    // 予約詳細ページから電話番号・割引情報を取得 (新規のみ)
    const detail = await caskanFetchReserveDetail(session, row.reserveId)

    let customerId: string | null = null
    if (detail.phone) {
      const foundCustomer = customersByPhone.get(detail.phone)
      if (foundCustomer) {
        customerId = foundCustomer.id
      } else {
        const { data: newCustomer, error: custError } = await supabaseAdmin.from('customers').insert({
          shop_id: shop.supabaseId,
          name: row.customerNameRaw,
          phone: detail.phone,
          furigana: detail.furigana || null,
          status: '予約可',
        }).select('id, name, phone').single()
        if (custError || !newCustomer) {
          onLog(`[ERROR] 顧客作成に失敗しました: ${row.reserveId}: ${custError?.message}\n`)
          continue
        }
        customerId = newCustomer.id
        customersByPhone.set(detail.phone, newCustomer)
      }
    } else {
      onLog(`[WARN] 電話番号が取得できませんでした: ${row.reserveId} (${row.customerNameRaw})\n`)
      continue
    }

    const backResult = calculateBackInMemory({
      shopId: shop.supabaseId,
      therapistId: therapist.id,
      therapistRankId: therapist.rank_id || null,
      therapistBackCalcType: therapist.back_calc_type,
      courseId: course.id,
      coursePrice: course.base_price,
      courseDuration: course.duration,
      designationType,
      date,
      startTime: row.startTimeText,
      courseBackAmount: course.back_amount,
    }, cache)

    let basePrice = backResult.resolvedCustomerPrice
    let nominationFee = 0
    const dtRow = cache.designationTypes.find((d: any) => d.slug === designationType)

    if (designationType !== 'free' && !dtRow?.is_store_paid_back) {
      if (backResult.resolvedCustomerPrice > course.base_price) {
        nominationFee = backResult.resolvedCustomerPrice - course.base_price
        basePrice = course.base_price
      }
    }

    const discountAmount = detail.discountAmount || 0
    const totalPrice = basePrice + nominationFee - discountAmount
    const shopRevenue = Math.max(0, totalPrice - backResult.netBack)

    const notesParts = [detail.requestNote, detail.treatmentMemo].filter(Boolean)
    const notes = notesParts.length > 0 ? `キャスカン同期: ${notesParts.join(' / ')}` : 'キャスカン同期'

    const tag = dryRun ? '[DRY-NEW]' : '[NEW]'
    onLog(`${tag} ${row.reserveId}: ${date} ${row.startTimeText} ${therapist.name} ${row.customerNameRaw} ¥${totalPrice}\n`)

    if (!dryRun) {
      const { error } = await supabaseAdmin.from('reservations').insert({
        shop_id: shop.supabaseId,
        therapist_id: therapist.id,
        room_id: roomId,
        customer_id: customerId,
        date,
        start_time: startTime,
        end_time: endTime,
        course_id: course.id,
        status: statusKind,
        payment_method: row.paymentLabel === '現金' ? 'cash' : 'credit',
        options_payment_method: row.paymentLabel === '現金' ? 'cash' : 'credit',
        extension_payment_method: row.paymentLabel === '現金' ? 'cash' : 'credit',
        source: 'caskan',
        is_handled: true,
        base_price: basePrice,
        nomination_fee: nominationFee,
        total_price: totalPrice,
        discount_amount: discountAmount,
        discount_reason: detail.discountReason || null,
        designation_type: designationType,
        designation_type_id: dtRow?.id || null,
        therapist_back_amount: backResult.netBack,
        shop_revenue: shopRevenue,
        back_calculated_at: new Date().toISOString(),
        business_date: backResult.businessDate,
        reception_source: 'staff',
        notes,
        caskan_reservation_id: row.reserveId,
      })
      if (error) {
        onLog(`[ERROR] 予約作成に失敗しました: ${row.reserveId}: ${error.message}\n`)
        continue
      }
    }

    totalOk++
    if (statusKind === 'cancelled') totalCancelled++
  }

  onLog(`\n新規:${totalOk} 更新:${totalUpdate} 変更なし:${totalSkip} (うちキャンセル:${totalCancelled})\n`)
  if (unknownTherapists.length > 0) {
    onLog(`未マッチのキャスト: ${unknownTherapists.join(', ')}\n`)
  }
  if (unknownRooms.length > 0) {
    onLog(`未マッチのルーム: ${unknownRooms.join(', ')}\n`)
  }
  if (unknownDesignations.length > 0) {
    onLog(`未マッピングの指名種別 (freeとして扱いました): ${unknownDesignations.join(', ')}\n`)
  }
}
