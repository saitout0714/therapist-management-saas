/**
 * キャスカン(Caskan) → yoyakl データ移行スクリプト（汎用・複数案件で再利用可能）
 *
 * 対象店舗は既に yoyakl で本番稼働中である前提で、既存レコードとの重複を避けながら
 * 過去データ（顧客・セラピスト・ルーム・予約履歴）を補完する。
 *
 * 事前準備（対象店舗ごとに1回だけ）:
 *   - yoyakl側に対象店舗(shops)・コース(courses)・designation_types が登録済みであること
 *   - ルーム(rooms)も可能な範囲で事前登録しておくと、名前一致でroom_idが自動マッチする
 *
 * 認証情報:
 *   案件ごとにキャスカンのアカウント（shop_code/login_id/password）が異なる場合は、
 *   環境変数を上書きして実行する（.env.localは書き換えず、コマンド実行時にのみ指定）。
 *   パスワードがシェル履歴に残らないよう、必ずこの方式を使うこと。
 *
 *     CASKAN_SHOP_CODE=xxxx CASKAN_LOGIN_ID=yyyy CASKAN_PASSWORD=zzzz \
 *       npx tsx scripts/migrate-caskan.ts --caskan-shop-id=1234 --store-id=<supabase店舗UUID> --commit
 *
 * 店舗の指定方法（どちらか）:
 *   --shop=<name>                         lib/sync/caskan.ts の SHOPS 配列に登録済みの店舗名を使う
 *   --caskan-shop-id=<id> --store-id=<uuid> [--shop-name=<label>]
 *                                          SHOPSに未登録でもその場で指定できる（新規案件向け）
 *
 * 使い方:
 *   npx tsx scripts/migrate-caskan.ts --shop=rabbit_tachikawa                  # dryRun（既定）
 *   npx tsx scripts/migrate-caskan.ts --shop=rabbit_tachikawa --commit         # 実際にDBへ書き込む
 *   npx tsx scripts/migrate-caskan.ts --shop=rabbit_tachikawa --date-to=2026-07-20
 *   npx tsx scripts/migrate-caskan.ts --caskan-shop-id=1234 --store-id=<uuid> --shop-name=new_client
 *   npx tsx scripts/migrate-caskan.ts --shop=rabbit_tachikawa --only=customers,casts,rooms,reservations
 *
 * スコープ外: コース料金・割引・バック金額の設定（/system/edit）には一切触れない。
 */

import * as cheerio from 'cheerio'
import type { CheerioAPI } from 'cheerio'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'
import {
  SHOPS,
  FetchSession,
  caskanLogin,
  caskanSwitchShop,
  matchTherapist,
  normalizeCastName,
  getTherapistMap,
  CASKAN_ROOM_MAP,
} from '../lib/sync/caskan'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceRoleKey) {
  console.error('環境変数が不足しています（NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY）')
  process.exit(1)
}
const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })

const BASE = 'https://my.caskan.jp'
const DELAY_MS = 350
const FLOOR_YEAR = 2010

// ─── CLI引数 ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const dryRun = !args.includes('--commit')
const dateToArg = args.find((a) => a.startsWith('--date-to='))
const dateFromArg = args.find((a) => a.startsWith('--date-from='))
const onlyArg = args.find((a) => a.startsWith('--only='))
const shopArg = args.find((a) => a.startsWith('--shop='))
const caskanShopIdArg = args.find((a) => a.startsWith('--caskan-shop-id='))
const storeIdArg = args.find((a) => a.startsWith('--store-id='))
const shopNameArg = args.find((a) => a.startsWith('--shop-name='))
const CUTOFF_DATE_TO = dateToArg ? dateToArg.split('=')[1] : '2026-07-20'
const CUTOFF_DATE_FROM = dateFromArg ? dateFromArg.split('=')[1] : null // nullが最古から
const ONLY = onlyArg ? new Set(onlyArg.split('=')[1].split(',')) : new Set(['customers', 'casts', 'rooms', 'reservations'])
const CURRENT_YEAR = parseInt(CUTOFF_DATE_TO.slice(0, 4), 10)
const MIN_YEAR = CUTOFF_DATE_FROM ? parseInt(CUTOFF_DATE_FROM.slice(0, 4), 10) : FLOOR_YEAR

function resolveShop(): { name: string; caskanId: number; supabaseId: string } {
  if (shopArg) {
    const name = shopArg.split('=')[1]
    const found = SHOPS.find((s) => s.name === name)
    if (!found) {
      console.error(`店舗 "${name}" が SHOPS (lib/sync/caskan.ts) に見つかりません。--caskan-shop-id と --store-id で直接指定することもできます。`)
      process.exit(1)
    }
    return found
  }
  if (caskanShopIdArg && storeIdArg) {
    return {
      name: shopNameArg ? shopNameArg.split('=')[1] : 'adhoc',
      caskanId: parseInt(caskanShopIdArg.split('=')[1], 10),
      supabaseId: storeIdArg.split('=')[1],
    }
  }
  console.error('店舗を指定してください: --shop=<SHOPSに登録済みの名前> または --caskan-shop-id=<id> --store-id=<uuid>')
  process.exit(1)
}

function log(msg: string) {
  process.stdout.write(msg)
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function idFromHref(href: string | undefined): string | null {
  if (!href) return null
  const m = href.match(/[?&]id=(\d+)/)
  return m ? m[1] : null
}

function parseMoney(text: string): number {
  const digits = text.replace(/[^\d]/g, '')
  return digits ? parseInt(digits, 10) : 0
}

// Supabase/PostgRESTのデフォルト最大行数(1000件)を超えるテーブルは
// 単純な.select()だと先頭1000件しか返らず既存レコードの取りこぼしにつながるため、
// 必ずこのヘルパーで全件取得する。
async function fetchAllRows<T>(table: string, select: string, shopId: string): Promise<T[]> {
  const all: T[] = []
  let offset = 0
  const PAGE = 1000
  while (true) {
    const { data, error } = await supabase.from(table).select(select).eq('shop_id', shopId).range(offset, offset + PAGE - 1)
    if (error) {
      log(`[ERROR] ${table} の取得に失敗: ${error.message}\n`)
      break
    }
    if (!data || data.length === 0) break
    all.push(...(data as T[]))
    if (data.length < PAGE) break
    offset += PAGE
  }
  return all
}

function getTotalPages($: CheerioAPI): number {
  let max = 1
  $('.pagination a').each((_, a) => {
    const n = parseInt($(a).text().trim(), 10)
    if (!isNaN(n) && n > max) max = n
  })
  return max
}

// ─── 型定義 ──────────────────────────────────────────────────────────────
interface CaskanCustomerRow {
  caskanId: string
  name: string
  phone: string
  email: string
  status: string
  memo: string
}

interface CaskanCastRow {
  caskanId: string
  rawName: string
  cleanName: string
  status: string
  tab: number
}

interface CaskanRoomRow {
  caskanId: string
  name: string
}

interface CaskanReservationRow {
  caskanReservationId: string
  customerCaskanId: string | null
  customerName: string
  customerTypeTag: string
  reserveDateRaw: string
  year: number
  castCaskanId: string | null
  castRawName: string
  designationTag: string
  courseText: string
  roomName: string
  salesAmount: number
  backAmount: number
  profitAmount: number
  paymentText: string
  routeText: string
  statusId: string
  statusText: string
}

// ─── 一覧ページのパース ────────────────────────────────────────────────────
function parseCustomerListPage($: CheerioAPI): CaskanCustomerRow[] {
  const rows: CaskanCustomerRow[] = []
  $('a[href^="/customer/view?id="]').each((_, el) => {
    const link = $(el)
    const tr = link.closest('tr')
    const tds = tr.find('> td')
    if (tds.length < 9) return
    const caskanId = idFromHref(link.attr('href'))
    if (!caskanId) return
    rows.push({
      caskanId,
      name: $(tds[3]).text().replace(/\s+/g, ' ').trim(),
      phone: $(tds[5]).text().replace(/\s+/g, ' ').trim(),
      email: $(tds[6]).text().replace(/\s+/g, ' ').trim(),
      status: $(tds[7]).text().replace(/\s+/g, ' ').trim(),
      memo: $(tds[8]).text().replace(/\s+/g, ' ').trim(),
    })
  })
  return rows
}

function parseCastListPage($: CheerioAPI, tab: number): CaskanCastRow[] {
  const rows: CaskanCastRow[] = []
  $('.parts-cast-name').each((_, el) => {
    const nameSpan = $(el)
    const raw = nameSpan.text().trim()
    const tr = nameSpan.closest('tr')
    const link = tr.find('a[href^="/cast/view?id="]').first()
    const caskanId = idFromHref(link.attr('href'))
    if (!caskanId) return
    const nameTd = nameSpan.closest('td')
    const status = nameTd.next('td').text().trim()
    rows.push({ caskanId, rawName: raw, cleanName: normalizeCastName(raw), status, tab })
  })
  return rows
}

function parseRoomListPage($: CheerioAPI): CaskanRoomRow[] {
  const rows: CaskanRoomRow[] = []
  $('a[href^="/room/view?id="]').each((_, el) => {
    const a = $(el)
    const caskanId = idFromHref(a.attr('href'))
    if (!caskanId) return
    const clone = a.clone()
    clone.find('span').remove()
    const name = clone.text().replace(/\s+/g, ' ').trim()
    if (!name) return
    rows.push({ caskanId, name })
  })
  return rows
}

function parseReserveListPage($: CheerioAPI, year: number): CaskanReservationRow[] {
  const rows: CaskanReservationRow[] = []
  $('a[href^="/reserve/view?id="]').each((_, el) => {
    const detailLink = $(el)
    const tr = detailLink.closest('tr')
    const tds = tr.find('> td')
    if (tds.length < 15) return
    const caskanReservationId = idFromHref(detailLink.attr('href'))
    if (!caskanReservationId) return

    const customerCell = $(tds[3])
    const customerLink = customerCell.find('a[href^="/customer/view?id="]').first()
    const customerCaskanId = idFromHref(customerLink.attr('href'))
    const customerName = customerLink.text().trim()
    const customerTypeTag = customerCell.find('span').first().text().trim()

    const reserveDateRaw = $(tds[4]).text().replace(/\s+/g, ' ').trim()

    const castCell = $(tds[5])
    const castLink = castCell.find('a[href^="/cast/view?id="]').first()
    const castCaskanId = idFromHref(castLink.attr('href'))
    const castRawName = castLink.text().trim()
    const designationTag = castCell.find('span').first().text().trim()

    const courseText = $(tds[6]).text().replace(/\s+/g, ' ').trim()
    const roomName = $(tds[7]).text().replace(/\s+/g, ' ').trim()
    const salesAmount = parseMoney($(tds[8]).text())
    const backAmount = parseMoney($(tds[9]).text())
    const profitAmount = parseMoney($(tds[10]).text())
    const paymentText = $(tds[11]).text().trim()
    const routeText = $(tds[12]).text().replace(/\s+/g, ' ').trim()
    const statusLink = $(tds[13]).find('a.link-status')
    const statusId = statusLink.attr('data-current-status-id') || ''
    const statusText = statusLink.text().replace(/\s+/g, ' ').trim()

    rows.push({
      caskanReservationId,
      customerCaskanId,
      customerName,
      customerTypeTag,
      reserveDateRaw,
      year,
      castCaskanId,
      castRawName,
      designationTag,
      courseText,
      roomName,
      salesAmount,
      backAmount,
      profitAmount,
      paymentText,
      routeText,
      statusId,
      statusText,
    })
  })
  return rows
}

// ─── 日付・値のマッピング ───────────────────────────────────────────────────
function parseReserveDate(raw: string, year: number): { date: string; startTime: string } | null {
  const m = raw.match(/^(\d{1,2})\/(\d{1,2})\s*\S\s*(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const [, mo, d, h, mi] = m
  const date = `${year}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
  const startTime = `${h.padStart(2, '0')}:${mi}`
  return { date, startTime }
}

function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + minutes
  const hh = Math.floor(total / 60)
  const mm = total % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

function extractDurationMinutes(courseText: string): number | null {
  const m = courseText.match(/(\d+)\s*分\s*$/)
  return m ? parseInt(m[1], 10) : null
}

function mapDesignation(tag: string): { slug: 'free' | 'first_nomination' | 'confirmed'; label: string } {
  if (tag.includes('本指名')) return { slug: 'confirmed', label: tag }
  if (tag.includes('写真指名')) return { slug: 'first_nomination', label: tag }
  if (tag.includes('指名なし')) return { slug: 'free', label: tag }
  return { slug: 'free', label: tag || '(不明)' }
}

function mapPaymentMethod(text: string): string {
  if (text.includes('カード') || text.includes('クレジット')) return 'credit'
  if (text.includes('PayPay')) return 'paypay'
  return 'cash'
}

function mapReceptionSource(route: string): string {
  return route.includes('WEB') ? 'client' : 'staff'
}

function mapCustomerTypeOverride(tag: string): string | null {
  if (tag.includes('新規')) return 'new'
  if (tag.includes('リピ')) return 'repeat'
  return null
}

// キャスカンのステータス値: 1=新規予約 5=調整中 10=予約確定 20=完了 99=キャンセル
function mapReservationStatus(statusId: string): 'pending' | 'confirmed' | 'cancelled' {
  if (statusId === '20' || statusId === '10') return 'confirmed'
  if (statusId === '99') return 'cancelled'
  return 'pending'
}

function mapCustomerStatus(text: string): string {
  if (text.includes('禁')) return '出禁'
  if (text.includes('注意')) return '要注意'
  return '予約可'
}

function normalizePhone(phone: string): string {
  return phone.replace(/[^\d]/g, '')
}

// ─── キャスカン一覧の全ページ取得 ────────────────────────────────────────────
async function fetchAllCustomers(session: FetchSession): Promise<CaskanCustomerRow[]> {
  const all: CaskanCustomerRow[] = []
  let page = 1
  while (true) {
    const url = page === 1 ? `${BASE}/customer` : `${BASE}/customer/index/page:${page}`
    const r = await session.get(url)
    if (r.status !== 200) {
      log(`[WARN] 顧客一覧 page${page} 取得失敗 status=${r.status}\n`)
      break
    }
    const $ = cheerio.load(await r.text())
    const rows = parseCustomerListPage($)
    if (rows.length === 0) break
    all.push(...rows)
    const totalPages = getTotalPages($)
    log(`顧客一覧 page ${page}/${totalPages}: ${rows.length}件 (累計${all.length}件)\n`)
    if (page >= totalPages) break
    page++
    await sleep(DELAY_MS)
  }
  return all
}

async function fetchAllCasts(session: FetchSession): Promise<CaskanCastRow[]> {
  const all: CaskanCastRow[] = []
  for (const tab of [1, 2, 3]) {
    const r = await session.get(`${BASE}/cast?tab=${tab}`)
    if (r.status !== 200) {
      log(`[WARN] キャスト一覧 tab=${tab} 取得失敗 status=${r.status}\n`)
      continue
    }
    const $ = cheerio.load(await r.text())
    const rows = parseCastListPage($, tab)
    log(`キャスト一覧 tab=${tab} (${tab === 1 ? '在籍' : tab === 2 ? '退店済み' : '削除済み'}): ${rows.length}件\n`)
    all.push(...rows)
    await sleep(DELAY_MS)
  }
  return all
}

async function fetchAllRooms(session: FetchSession): Promise<CaskanRoomRow[]> {
  const r = await session.get(`${BASE}/room`)
  if (r.status !== 200) {
    log(`[WARN] ルーム一覧取得失敗 status=${r.status}\n`)
    return []
  }
  const $ = cheerio.load(await r.text())
  const rows = parseRoomListPage($)
  log(`ルーム一覧: ${rows.length}件\n`)
  return rows
}

async function findYearsWithData(session: FetchSession): Promise<number[]> {
  // --date-from が明示されている場合はその年まで必ず確認する（間に0件の年があっても打ち切らない）。
  // 未指定の場合はFLOOR_YEARまで自動探索し、2年連続で0件になった時点で打ち切る。
  const autoDetectFloor = !CUTOFF_DATE_FROM
  const years: number[] = []
  let consecutiveEmpty = 0
  for (let y = CURRENT_YEAR; y >= MIN_YEAR; y--) {
    const dateFrom = y === MIN_YEAR && CUTOFF_DATE_FROM ? CUTOFF_DATE_FROM : `${y}-01-01`
    const dateTo = y === CURRENT_YEAR ? CUTOFF_DATE_TO : `${y}-12-31`
    const url = `${BASE}/reserve?date_from=${dateFrom}&date_to=${dateTo}`
    const r = await session.get(url)
    if (r.status !== 200) {
      log(`[WARN] ${y}年 予約一覧の確認に失敗 status=${r.status}\n`)
      break
    }
    const $ = cheerio.load(await r.text())
    const rows = parseReserveListPage($, y)
    if (rows.length > 0) {
      years.push(y)
      consecutiveEmpty = 0
      log(`${y}年: データあり\n`)
    } else {
      consecutiveEmpty++
      log(`${y}年: データなし\n`)
      if (autoDetectFloor && consecutiveEmpty >= 2) break
    }
    await sleep(DELAY_MS)
  }
  return years.sort((a, b) => a - b)
}

async function fetchYearReservations(session: FetchSession, year: number): Promise<CaskanReservationRow[]> {
  const dateFrom = year === MIN_YEAR && CUTOFF_DATE_FROM ? CUTOFF_DATE_FROM : `${year}-01-01`
  const dateTo = year === CURRENT_YEAR ? CUTOFF_DATE_TO : `${year}-12-31`
  const all: CaskanReservationRow[] = []
  let page = 1
  while (true) {
    const url =
      page === 1
        ? `${BASE}/reserve?date_from=${dateFrom}&date_to=${dateTo}`
        : `${BASE}/reserve/index/page:${page}?date_from=${dateFrom}&date_to=${dateTo}`
    const r = await session.get(url)
    if (r.status !== 200) {
      log(`[WARN] ${year}年 予約一覧 page${page} 取得失敗\n`)
      break
    }
    const $ = cheerio.load(await r.text())
    const rows = parseReserveListPage($, year)
    if (rows.length === 0) break
    all.push(...rows)
    const totalPages = getTotalPages($)
    log(`${year}年 予約一覧 page ${page}/${totalPages}: ${rows.length}件 (累計${all.length}件)\n`)
    if (page >= totalPages) break
    page++
    await sleep(DELAY_MS)
  }
  return all
}

// ─── メイン処理 ──────────────────────────────────────────────────────────────
async function main() {
  const shop = resolveShop()

  log('==================================================\n')
  log(`キャスカン移行: ${shop.name} (caskan shop_id=${shop.caskanId}, store_id=${shop.supabaseId})\n`)
  log(`モード: ${dryRun ? 'DRY RUN（書き込みなし）' : '本番書き込み'}\n`)
  log(`予約取り込み期間: ${CUTOFF_DATE_FROM || '最古'} 〜 ${CUTOFF_DATE_TO}\n`)
  log(`対象: ${[...ONLY].join(', ')}\n`)
  log('==================================================\n\n')

  // ── 事前バックアップ: 現状件数を記録 ──────────────────────────────────────
  const [{ count: beforeCustomers }, { count: beforeTherapists }, { count: beforeRooms }, { count: beforeReservations }] =
    await Promise.all([
      supabase.from('customers').select('id', { count: 'exact', head: true }).eq('shop_id', shop.supabaseId),
      supabase.from('therapists').select('id', { count: 'exact', head: true }).eq('shop_id', shop.supabaseId),
      supabase.from('rooms').select('id', { count: 'exact', head: true }).eq('shop_id', shop.supabaseId),
      supabase.from('reservations').select('id', { count: 'exact', head: true }).eq('shop_id', shop.supabaseId),
    ])
  const backup = {
    takenAt: new Date().toISOString(),
    shop: shop.name,
    shopId: shop.supabaseId,
    counts: {
      customers: beforeCustomers || 0,
      therapists: beforeTherapists || 0,
      rooms: beforeRooms || 0,
      reservations: beforeReservations || 0,
    },
  }
  log(`[バックアップ] 移行前の件数: 顧客=${backup.counts.customers} セラピスト=${backup.counts.therapists} ルーム=${backup.counts.rooms} 予約=${backup.counts.reservations}\n`)
  const backupDir = path.resolve(process.cwd(), 'scratch')
  fs.mkdirSync(backupDir, { recursive: true })
  const backupPath = path.join(backupDir, `caskan_migration_backup_${Date.now()}.json`)
  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2), 'utf-8')
  log(`[バックアップ] ${backupPath} に記録しました\n\n`)

  // ── ログイン ──────────────────────────────────────────────────────────────
  const session = new FetchSession()
  log('キャスカンにログイン中...\n')
  const loggedIn = await caskanLogin(session)
  if (!loggedIn) {
    console.error('ログインに失敗しました')
    process.exit(1)
  }
  const switched = await caskanSwitchShop(session, shop.caskanId)
  if (!switched) {
    console.error('店舗切り替えに失敗しました')
    process.exit(1)
  }
  log('ログインOK\n\n')

  // ── 既存データの取得 ──────────────────────────────────────────────────────
  const existingCustomers = await fetchAllRows<{ id: string; name: string; phone: string | null }>(
    'customers',
    'id, name, phone',
    shop.supabaseId
  )
  log(`[既存データ] 顧客: ${existingCustomers.length}件を取得\n`)
  const existingTherapistMap = await getTherapistMap(shop.supabaseId)
  const { data: existingCourses } = await supabase
    .from('courses')
    .select('id, name, duration')
    .eq('shop_id', shop.supabaseId)
  const { data: designationTypes } = await supabase
    .from('designation_types')
    .select('id, slug')
    .eq('shop_id', shop.supabaseId)
  const designationTypeIdBySlug = new Map<string, string>()
  ;(designationTypes || []).forEach((d) => designationTypeIdBySlug.set(d.slug, d.id))

  const phoneToCustomerId = new Map<string, string>()
  const nameToCustomerIds = new Map<string, string[]>()
  ;(existingCustomers || []).forEach((c) => {
    if (c.phone) {
      const p = normalizePhone(c.phone)
      if (p && !phoneToCustomerId.has(p)) phoneToCustomerId.set(p, c.id)
    }
    const n = (c.name || '').trim()
    if (n) {
      if (!nameToCustomerIds.has(n)) nameToCustomerIds.set(n, [])
      nameToCustomerIds.get(n)!.push(c.id)
    }
  })

  // ── 1. 顧客・キャスト・ルームのスクレイピング ─────────────────────────────
  let caskanCustomers: CaskanCustomerRow[] = []
  let caskanCasts: CaskanCastRow[] = []
  let caskanRooms: CaskanRoomRow[] = []

  if (ONLY.has('customers') || ONLY.has('reservations')) {
    log('--- 顧客一覧を取得中 ---\n')
    caskanCustomers = await fetchAllCustomers(session)
    log(`顧客一覧取得完了: ${caskanCustomers.length}件\n\n`)
  }
  if (ONLY.has('casts') || ONLY.has('reservations')) {
    log('--- キャスト一覧を取得中 ---\n')
    caskanCasts = await fetchAllCasts(session)
    log(`キャスト一覧取得完了: ${caskanCasts.length}件\n\n`)
  }
  if (ONLY.has('rooms') || ONLY.has('reservations')) {
    log('--- ルーム一覧を取得中 ---\n')
    caskanRooms = await fetchAllRooms(session)
    log(`ルーム一覧取得完了: ${caskanRooms.length}件\n\n`)
  }

  // ── 2. 顧客のマッチング ──────────────────────────────────────────────────
  const customerCaskanIdToSupabaseId = new Map<string, string>()
  const customersToCreate: CaskanCustomerRow[] = []
  let custPhoneMatch = 0
  let custNameMatch = 0
  let custAmbiguous = 0
  const custAmbiguousNames: string[] = []

  for (const c of caskanCustomers) {
    const phone = normalizePhone(c.phone)
    if (phone && phoneToCustomerId.has(phone)) {
      customerCaskanIdToSupabaseId.set(c.caskanId, phoneToCustomerId.get(phone)!)
      custPhoneMatch++
      continue
    }
    const name = c.name.trim()
    const candidates = name ? nameToCustomerIds.get(name) : undefined
    if (candidates && candidates.length === 1) {
      customerCaskanIdToSupabaseId.set(c.caskanId, candidates[0])
      custNameMatch++
      continue
    }
    if (candidates && candidates.length > 1) {
      custAmbiguous++
      custAmbiguousNames.push(name)
      // 複数候補で確定できないため新規作成（誤った顧客への紐付けを避ける）
    }
    customersToCreate.push(c)
  }

  log(`[顧客] 電話番号一致: ${custPhoneMatch}件 / 名前一致(一意): ${custNameMatch}件 / 名前重複で要確認: ${custAmbiguous}件 / 新規作成対象: ${customersToCreate.length}件\n`)
  if (custAmbiguousNames.length > 0) {
    log(`  要確認(同名の既存顧客が複数): ${[...new Set(custAmbiguousNames)].slice(0, 20).join(', ')}${custAmbiguousNames.length > 20 ? ' ...' : ''}\n`)
  }
  log('\n')

  // ── 3. キャストのマッチング（在籍・退店済みのみ新規作成対象） ───────────────
  const castCaskanIdToSupabaseId = new Map<string, string>()
  const castsToCreate: CaskanCastRow[] = []
  const unmatchedDeletedCasts: CaskanCastRow[] = []
  let castNameMatch = 0

  for (const c of caskanCasts) {
    const matched = matchTherapist(c.cleanName, existingTherapistMap) || matchTherapist(c.rawName, existingTherapistMap)
    if (matched) {
      castCaskanIdToSupabaseId.set(c.caskanId, matched)
      castNameMatch++
      continue
    }
    if (c.tab === 3) {
      unmatchedDeletedCasts.push(c)
    } else {
      castsToCreate.push(c)
    }
  }

  log(`[キャスト] 既存セラピストと名前一致: ${castNameMatch}件 / 新規作成対象(在籍+退店済み): ${castsToCreate.length}件 / 削除済みで未マッチ(作成せず): ${unmatchedDeletedCasts.length}件\n`)
  if (unmatchedDeletedCasts.length > 0) {
    log(`  削除済み未マッチ一覧: ${unmatchedDeletedCasts.map((c) => c.cleanName).slice(0, 20).join(', ')}${unmatchedDeletedCasts.length > 20 ? ' ...' : ''}\n`)
  }
  log('\n')

  // ── 4. ルームのマッチング ────────────────────────────────────────────────
  // 優先度1: CASKAN_ROOM_MAP（シフト同期で使用中の検証済みマッピング、既存店舗向け）
  // 優先度2: yoyakl側 rooms テーブルとの名前一致（CASKAN_ROOM_MAP未登録の新規店舗向け）
  const existingRooms = ONLY.has('rooms') || ONLY.has('reservations')
    ? await fetchAllRows<{ id: string; name: string }>('rooms', 'id, name', shop.supabaseId)
    : []
  const existingRoomNameToId = new Map<string, string>()
  existingRooms.forEach((r) => {
    if (r.name && !existingRoomNameToId.has(r.name)) existingRoomNameToId.set(r.name, r.id)
  })

  const roomNameToSupabaseId = new Map<string, string>()
  const unmappedRooms: CaskanRoomRow[] = []
  let roomMatchedByMap = 0
  let roomMatchedByName = 0
  for (const r of caskanRooms) {
    const byMap = CASKAN_ROOM_MAP[r.caskanId]
    if (byMap) {
      roomNameToSupabaseId.set(r.name, byMap)
      roomMatchedByMap++
      continue
    }
    const byName = existingRoomNameToId.get(r.name)
    if (byName) {
      roomNameToSupabaseId.set(r.name, byName)
      roomMatchedByName++
      continue
    }
    unmappedRooms.push(r)
  }
  if (unmappedRooms.length > 0) {
    log(`[ルーム] 未マッピング(CASKAN_ROOM_MAP・名前一致とも該当なし): ${unmappedRooms.map((r) => `${r.name}(id:${r.caskanId})`).join(', ')}\n`)
  }
  log(`[ルーム] マッピング成功: ${roomNameToSupabaseId.size}件(ID一致${roomMatchedByMap}件/名前一致${roomMatchedByName}件) / 未登録: ${unmappedRooms.length}件\n\n`)

  // ── 5. 新規作成（dryRunの場合はスキップ） ──────────────────────────────────
  if (!dryRun && customersToCreate.length > 0) {
    log(`顧客を新規作成中 (${customersToCreate.length}件)...\n`)
    const BATCH = 200
    for (let i = 0; i < customersToCreate.length; i += BATCH) {
      const chunk = customersToCreate.slice(i, i + BATCH)
      const { data, error } = await supabase
        .from('customers')
        .insert(
          chunk.map((c) => ({
            shop_id: shop.supabaseId,
            name: c.name,
            phone: c.phone || null,
            email: c.email || null,
            status: mapCustomerStatus(c.status),
            memo: c.memo || null,
          }))
        )
        .select('id')
      if (error) {
        log(`[ERROR] 顧客作成失敗 (offset ${i}): ${error.message}\n`)
        continue
      }
      data!.forEach((row, idx) => customerCaskanIdToSupabaseId.set(chunk[idx].caskanId, row.id))
      log(`  顧客作成: ${Math.min(i + BATCH, customersToCreate.length)}/${customersToCreate.length}\n`)
    }
  } else if (dryRun) {
    log(`[DRY] 顧客 ${customersToCreate.length}件を新規作成予定（未実行）\n`)
  }

  if (!dryRun && castsToCreate.length > 0) {
    log(`セラピストを新規作成中 (${castsToCreate.length}件)...\n`)
    const BATCH = 200
    for (let i = 0; i < castsToCreate.length; i += BATCH) {
      const chunk = castsToCreate.slice(i, i + BATCH)
      const { data, error } = await supabase
        .from('therapists')
        .insert(
          chunk.map((c) => ({
            shop_id: shop.supabaseId,
            name: c.cleanName || c.rawName,
            is_active: c.tab === 1,
          }))
        )
        .select('id')
      if (error) {
        log(`[ERROR] セラピスト作成失敗 (offset ${i}): ${error.message}\n`)
        continue
      }
      data!.forEach((row, idx) => castCaskanIdToSupabaseId.set(chunk[idx].caskanId, row.id))
      log(`  セラピスト作成: ${Math.min(i + BATCH, castsToCreate.length)}/${castsToCreate.length}\n`)
    }
  } else if (dryRun) {
    log(`[DRY] セラピスト ${castsToCreate.length}件を新規作成予定（未実行）\n`)
  }
  log('\n')

  if (!ONLY.has('reservations')) {
    log('予約の取り込みは対象外に指定されているため終了します。\n')
    return
  }

  // ── 6. コースマップ ──────────────────────────────────────────────────────
  const courses = existingCourses || []
  function matchCourse(courseText: string): string | null {
    const exact = courses.find((c) => c.name === courseText.trim())
    if (exact) return exact.id
    const duration = extractDurationMinutes(courseText)
    if (duration != null) {
      const byDuration = courses.filter((c) => c.duration === duration)
      if (byDuration.length === 1) return byDuration[0].id
    }
    return null
  }

  // ── 7. 既存の caskan_reservation_id を取得（冪等性のため） ───────────────
  const existingCaskanReservationIds = new Set<string>()
  {
    let offset = 0
    const PAGE = 1000
    while (true) {
      const { data, error } = await supabase
        .from('reservations')
        .select('caskan_reservation_id')
        .eq('shop_id', shop.supabaseId)
        .not('caskan_reservation_id', 'is', null)
        .range(offset, offset + PAGE - 1)
      if (error) {
        log(`[ERROR] 既存予約の取得に失敗: ${error.message}\n`)
        break
      }
      if (!data || data.length === 0) break
      data.forEach((r) => {
        if (r.caskan_reservation_id) existingCaskanReservationIds.add(r.caskan_reservation_id)
      })
      if (data.length < PAGE) break
      offset += PAGE
    }
  }
  log(`[予約] 既存の caskan_reservation_id: ${existingCaskanReservationIds.size}件\n\n`)

  // ── 8. 予約のスクレイピング（年ごとに範囲を区切って取得） ────────────────
  log('--- 対象年の判定 ---\n')
  const years = await findYearsWithData(session)
  log(`対象年: ${years.join(', ') || '(データなし)'}\n\n`)

  const allReservations: CaskanReservationRow[] = []
  for (const year of years) {
    log(`--- ${year}年の予約を取得中 ---\n`)
    const rows = await fetchYearReservations(session, year)
    allReservations.push(...rows)
    await sleep(DELAY_MS)
  }
  log(`\n予約スクレイピング完了: 合計${allReservations.length}件\n\n`)

  // ── 9. 予約の変換・マッチング ─────────────────────────────────────────────
  // dryRunでは customersToCreate / castsToCreate はまだ実際には作成されていないため、
  // それらに紐づく予約は「本当に特定不能」ではなく「--commit実行後に解決される」ケースとして
  // 分けて集計する（そうしないとdryRunのログが誤って大量の警告に見えてしまう）。
  const pendingCustomerCaskanIds = new Set(customersToCreate.map((c) => c.caskanId))
  const pendingCastCaskanIds = new Set(castsToCreate.map((c) => c.caskanId))

  let skipExisting = 0
  let skipNoCustomer = 0
  let skipBadDate = 0
  let pendingNewCustomerCount = 0
  let unmatchedTherapistCount = 0
  let unmatchedRoomCount = 0
  let unmatchedCourseCount = 0
  const unmatchedTherapistNames = new Set<string>()
  const unmatchedRoomNames = new Set<string>()
  const unmatchedCourseTexts = new Set<string>()
  const statusBreakdown: Record<string, number> = {}

  const toInsert: Record<string, unknown>[] = []

  for (const row of allReservations) {
    if (existingCaskanReservationIds.has(row.caskanReservationId)) {
      skipExisting++
      continue
    }

    const parsedDate = parseReserveDate(row.reserveDateRaw, row.year)
    if (!parsedDate) {
      skipBadDate++
      log(`[WARN] 予約日のパースに失敗: caskan_id=${row.caskanReservationId} raw="${row.reserveDateRaw}"\n`)
      continue
    }

    let customerId: string | null = row.customerCaskanId ? customerCaskanIdToSupabaseId.get(row.customerCaskanId) || null : null
    if (!customerId && row.customerName) {
      const candidates = nameToCustomerIds.get(row.customerName.trim())
      if (candidates && candidates.length === 1) customerId = candidates[0]
    }
    if (!customerId) {
      if (dryRun && row.customerCaskanId && pendingCustomerCaskanIds.has(row.customerCaskanId)) {
        // commit時に顧客が新規作成されれば解決するため、dryRunでは警告扱いにしない
        pendingNewCustomerCount++
        continue
      }
      skipNoCustomer++
      log(`[WARN] 顧客が特定できずスキップ: caskan_id=${row.caskanReservationId} 顧客="${row.customerName}"(id:${row.customerCaskanId})\n`)
      continue
    }

    let therapistId: string | null = row.castCaskanId ? castCaskanIdToSupabaseId.get(row.castCaskanId) || null : null
    if (!therapistId && row.castRawName) {
      therapistId = matchTherapist(row.castRawName, existingTherapistMap)
    }
    if (!therapistId && row.castRawName) {
      const isPendingCast = dryRun && row.castCaskanId && pendingCastCaskanIds.has(row.castCaskanId)
      if (!isPendingCast) {
        unmatchedTherapistCount++
        unmatchedTherapistNames.add(row.castRawName)
      }
    }

    const roomId = row.roomName ? roomNameToSupabaseId.get(row.roomName) || null : null
    if (row.roomName && !roomId) {
      unmatchedRoomCount++
      unmatchedRoomNames.add(row.roomName)
    }

    const courseId = matchCourse(row.courseText)
    if (row.courseText && !courseId) {
      unmatchedCourseCount++
      unmatchedCourseTexts.add(row.courseText)
    }

    const duration = extractDurationMinutes(row.courseText) ?? 60
    const endTime = addMinutesToTime(parsedDate.startTime, duration)
    const status = mapReservationStatus(row.statusId)
    const designation = mapDesignation(row.designationTag)
    const paymentMethod = mapPaymentMethod(row.paymentText)
    const receptionSource = mapReceptionSource(row.routeText)
    const bookingMethod = row.routeText.includes('WEB') ? 'web' : null

    statusBreakdown[row.statusText || row.statusId] = (statusBreakdown[row.statusText || row.statusId] || 0) + 1

    toInsert.push({
      shop_id: shop.supabaseId,
      customer_id: customerId,
      therapist_id: therapistId,
      course_id: courseId,
      room_id: roomId,
      date: parsedDate.date,
      start_time: parsedDate.startTime,
      end_time: endTime,
      business_date: parsedDate.date,
      status,
      designation_type: designation.slug,
      designation_type_id: designationTypeIdBySlug.get(designation.slug) || null,
      total_price: row.salesAmount,
      base_price: row.salesAmount,
      therapist_back_amount: row.backAmount,
      shop_revenue: row.profitAmount,
      back_calculated_at: new Date().toISOString(),
      payment_method: paymentMethod,
      options_payment_method: 'cash',
      extension_payment_method: 'cash',
      reception_source: receptionSource,
      source: receptionSource === 'client' ? 'web' : 'staff',
      booking_method: bookingMethod,
      customer_type_override: mapCustomerTypeOverride(row.customerTypeTag),
      is_handled: true,
      caskan_reservation_id: row.caskanReservationId,
    })
  }

  log(`\n[予約] スクレイピング合計: ${allReservations.length}件\n`)
  log(`  既存(スキップ): ${skipExisting}件\n`)
  log(`  日付パース失敗(スキップ): ${skipBadDate}件\n`)
  log(`  顧客が特定できず本当にスキップ: ${skipNoCustomer}件\n`)
  if (dryRun) {
    log(`  顧客が新規作成予定のため今回未集計(--commit実行後は投入されます): ${pendingNewCustomerCount}件\n`)
  }
  log(`  新規投入対象(dryRunでは既存顧客に紐づくもののみ): ${toInsert.length}件\n`)
  log(`  セラピスト未マッチ(therapist_id=null): ${unmatchedTherapistCount}件 (${[...unmatchedTherapistNames].slice(0, 20).join(', ')}${unmatchedTherapistNames.size > 20 ? ' ...' : ''})\n`)
  log(`  ルーム未マッチ(room_id=null): ${unmatchedRoomCount}件 (${[...unmatchedRoomNames].join(', ')})\n`)
  log(`  コース未マッチ(course_id=null): ${unmatchedCourseCount}件 (${[...unmatchedCourseTexts].join(', ')})\n`)
  log(`  ステータス内訳: ${JSON.stringify(statusBreakdown)}\n\n`)

  if (dryRun) {
    log('[DRY RUN] 実際の書き込みは行いませんでした。内容を確認の上 --commit を付けて再実行してください。\n')
    return
  }

  log(`予約を投入中 (${toInsert.length}件)...\n`)
  const BATCH = 200
  let inserted = 0
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const chunk = toInsert.slice(i, i + BATCH)
    const { error } = await supabase.from('reservations').insert(chunk)
    if (error) {
      log(`[ERROR] 予約作成失敗 (offset ${i}): ${error.message}\n`)
      continue
    }
    inserted += chunk.length
    log(`  予約作成: ${Math.min(i + BATCH, toInsert.length)}/${toInsert.length}\n`)
  }

  log(`\n完了: 予約 ${inserted}件を投入しました。\n`)

  const [{ count: afterCustomers }, { count: afterTherapists }, { count: afterReservations }] = await Promise.all([
    supabase.from('customers').select('id', { count: 'exact', head: true }).eq('shop_id', shop.supabaseId),
    supabase.from('therapists').select('id', { count: 'exact', head: true }).eq('shop_id', shop.supabaseId),
    supabase.from('reservations').select('id', { count: 'exact', head: true }).eq('shop_id', shop.supabaseId),
  ])
  log(`移行後の件数: 顧客=${afterCustomers}(+${(afterCustomers || 0) - backup.counts.customers}) セラピスト=${afterTherapists}(+${(afterTherapists || 0) - backup.counts.therapists}) 予約=${afterReservations}(+${(afterReservations || 0) - backup.counts.reservations})\n`)
}

main().catch((err) => {
  console.error('\n予期しないエラーが発生しました:', err)
  process.exit(1)
})
