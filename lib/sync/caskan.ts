import * as cheerio from 'cheerio'
import { supabaseAdmin } from '../supabaseAdmin'

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
  '4812': 'ddebb857-d5f0-4689-990f-7e80ef033dd3',
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
  '4812_2': 'debac2e1-22be-46ea-a5a0-d7f20b3bb3e8', // Avoid duplicate key, python has duplicate 4812 key
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

  for (const [tName, tId] of Object.entries(therapistMap)) {
    const normT = normalizeCastName(tName)
    if (normT && normCaskan) {
      if (normT.startsWith(normCaskan) || normCaskan.startsWith(normT)) {
        return tId
      }
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
  const r = await session.get(`https://my.caskan.jp/shift?date=${dateStr}`)
  const html = await r.text()
  const $ = cheerio.load(html)
  const shifts: CaskanShift[] = []

  $('.tbl-calendar tr').each((_, row) => {
    const nameLink = $(row).find('a[href^="/cast/view"]')
    const castName = nameLink.text().trim()
    if (!castName) return

    $(row).find('td[data-cast-id]').each((_, cell) => {
      const shiftId = $(cell).attr('data-id') || ''
      if (!shiftId) return

      const fromH = $(cell).attr('data-from-hour') || ''
      const fromM = $(cell).attr('data-from-min') || '0'
      const toH = $(cell).attr('data-to-hour') || ''
      const toM = $(cell).attr('data-to-min') || '0'

      if ($(cell).attr('data-time-undecided') === '1' || !fromH || !toH) {
        return
      }

      const rawRoomId = $(cell).attr('data-room-id') || ''
      // Fallback for duplicates in python map
      let roomId = CASKAN_ROOM_MAP[rawRoomId] || null
      if (!roomId && rawRoomId === '4812') {
        roomId = CASKAN_ROOM_MAP['4812_2']
      }

      if (rawRoomId && !roomId) {
        onLog(`[WARN] [ルームMAP未登録] キャスト:${castName} / キャスカン側部屋ID:${rawRoomId} が CASKAN_ROOM_MAP にありません。\n`)
      }

      const day = $(cell).attr('data-day') || ''

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

    const caskanShifts = await caskanGetShifts(session, target, onLog)
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
      if (s.day < dateFrom) {
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
