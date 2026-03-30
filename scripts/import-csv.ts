/**
 * CSV移行スクリプト
 * Google SpreadsheetsからエクスポートしたCSVをSupabaseにインポートします。
 *
 * 使い方:
 *   npx tsx scripts/import-csv.ts
 *
 * 事前準備:
 *   1. .env.local に NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を設定
 *   2. scripts/data/ フォルダに以下のCSVを配置
 *      - customers_export.csv
 *      - therapists_export.csv
 *      - reservations_export.csv
 */

import * as fs from 'fs'
import * as path from 'path'
import { parse } from 'csv-parse/sync'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

// .env.local を読み込む
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

// ─── Supabase Admin クライアント（RLSをバイパス） ────────────────────────────
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ 環境変数が不足しています。.env.local を確認してください。')
  console.error('   必要: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
})

// ─── 型定義 ──────────────────────────────────────────────────────────────────
interface CustomerRow {
  store_name: string
  name: string
}

interface TherapistRow {
  store_name: string
  name: string
}

interface ReservationRow {
  store_name: string
  customer_name: string
  therapist_name: string
  date: string        // YYYY-MM-DD
  start_time: string  // HH:MM:SS
  end_time: string    // HH:MM:SS
  course_name?: string
  designation_type?: string
  note?: string
}

// ─── ユーティリティ ──────────────────────────────────────────────────────────
function readCsv<T>(filePath: string): T[] {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ ファイルが見つかりません: ${filePath}`)
    process.exit(1)
  }
  const content = fs.readFileSync(filePath, 'utf-8')
  return parse(content, {
    columns: true,          // 1行目をヘッダーとして使用
    skip_empty_lines: true,
    trim: true,
    bom: true,              // BOM付きUTF-8に対応
  }) as T[]
}

/** store_name → store_id のマップを構築 */
async function buildStoreMap(): Promise<Map<string, string>> {
  const { data, error } = await supabase.from('stores').select('id, name')
  if (error) throw new Error(`stores の取得に失敗: ${error.message}`)

  const map = new Map<string, string>()
  for (const store of data ?? []) {
    map.set(store.name.trim(), store.id)
  }
  return map
}

/** バッチ処理ヘルパー（大量データを分割して投入） */
async function batchInsert<T extends Record<string, unknown>>(
  tableName: string,
  rows: T[],
  batchSize = 200
): Promise<void> {
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)
    const { error } = await supabase.from(tableName).upsert(batch, { ignoreDuplicates: true })
    if (error) throw new Error(`${tableName} のバッチ挿入に失敗 (offset ${i}): ${error.message}`)
    console.log(`   ${tableName}: ${Math.min(i + batchSize, rows.length)} / ${rows.length} 件処理済み`)
  }
}

// ─── Step 1: 顧客インポート ───────────────────────────────────────────────────
async function importCustomers(
  rows: CustomerRow[],
  storeMap: Map<string, string>
): Promise<Map<string, string>> {
  console.log('\n📋 顧客データをインポート中...')

  const seen = new Set<string>()
  const records: { store_id: string; name: string }[] = []

  for (const row of rows) {
    const storeId = storeMap.get(row.store_name.trim())
    if (!storeId) {
      console.warn(`   ⚠️  店舗が見つかりません: "${row.store_name}" → スキップ`)
      continue
    }
    const key = `${storeId}::${row.name.trim()}`
    if (seen.has(key)) continue  // CSV内の重複をスキップ
    seen.add(key)
    records.push({ store_id: storeId, name: row.name.trim() })
  }

  await batchInsert('customers', records)

  // インポート後に store_id + name → id のマップを再構築
  const { data, error } = await supabase.from('customers').select('id, store_id, name')
  if (error) throw new Error(`customers の再取得に失敗: ${error.message}`)

  const map = new Map<string, string>()
  for (const c of data ?? []) {
    map.set(`${c.store_id}::${c.name}`, c.id)
  }
  console.log(`✅ 顧客: ${records.length} 件投入完了`)
  return map
}

// ─── Step 2: セラピストインポート ─────────────────────────────────────────────
async function importTherapists(
  rows: TherapistRow[],
  storeMap: Map<string, string>
): Promise<Map<string, string>> {
  console.log('\n💆 セラピストデータをインポート中...')

  const seen = new Set<string>()
  const records: { store_id: string; name: string }[] = []

  for (const row of rows) {
    const storeId = storeMap.get(row.store_name.trim())
    if (!storeId) {
      console.warn(`   ⚠️  店舗が見つかりません: "${row.store_name}" → スキップ`)
      continue
    }
    const key = `${storeId}::${row.name.trim()}`
    if (seen.has(key)) continue
    seen.add(key)
    records.push({ store_id: storeId, name: row.name.trim() })
  }

  await batchInsert('therapists', records)

  const { data, error } = await supabase.from('therapists').select('id, store_id, name')
  if (error) throw new Error(`therapists の再取得に失敗: ${error.message}`)

  const map = new Map<string, string>()
  for (const t of data ?? []) {
    map.set(`${t.store_id}::${t.name}`, t.id)
  }
  console.log(`✅ セラピスト: ${records.length} 件投入完了`)
  return map
}

// ─── Step 3: コースマップ構築（任意） ────────────────────────────────────────
async function buildCourseMap(): Promise<Map<string, string>> {
  const { data, error } = await supabase.from('courses').select('id, store_id, name')
  if (error) throw new Error(`courses の取得に失敗: ${error.message}`)

  const map = new Map<string, string>()
  for (const c of data ?? []) {
    map.set(`${c.store_id}::${c.name}`, c.id)
  }
  return map
}

// ─── Step 4: 予約インポート ───────────────────────────────────────────────────
async function importReservations(
  rows: ReservationRow[],
  storeMap: Map<string, string>,
  customerMap: Map<string, string>,
  therapistMap: Map<string, string>,
  courseMap: Map<string, string>
): Promise<void> {
  console.log('\n📅 予約データをインポート中...')

  const VALID_DESIGNATION_TYPES = new Set(['free', 'nomination', 'confirmed', 'princess'])

  const records: Record<string, unknown>[] = []
  let skipCount = 0

  for (const row of rows) {
    const storeId = storeMap.get(row.store_name.trim())
    if (!storeId) {
      console.warn(`   ⚠️  店舗が見つかりません: "${row.store_name}" → スキップ`)
      skipCount++
      continue
    }

    const customerId = customerMap.get(`${storeId}::${row.customer_name.trim()}`)
    if (!customerId) {
      console.warn(`   ⚠️  顧客が見つかりません: "${row.customer_name}" (${row.store_name}) → スキップ`)
      skipCount++
      continue
    }

    const therapistId = therapistMap.get(`${storeId}::${row.therapist_name.trim()}`)
    if (!therapistId) {
      console.warn(`   ⚠️  セラピストが見つかりません: "${row.therapist_name}" (${row.store_name}) → スキップ`)
      skipCount++
      continue
    }

    const courseId = row.course_name?.trim()
      ? courseMap.get(`${storeId}::${row.course_name.trim()}`) ?? null
      : null

    if (row.course_name?.trim() && !courseId) {
      console.warn(`   ⚠️  コースが見つかりません: "${row.course_name}" (${row.store_name}) → course_id=null で続行`)
    }

    const designationType =
      row.designation_type?.trim() &&
      VALID_DESIGNATION_TYPES.has(row.designation_type.trim())
        ? row.designation_type.trim()
        : 'free'

    records.push({
      store_id: storeId,
      customer_id: customerId,
      therapist_id: therapistId,
      course_id: courseId,
      date: row.date.trim(),
      start_time: row.start_time.trim(),
      end_time: row.end_time.trim(),
      designation_type: designationType,
      notes: row.note?.trim() ?? null,
      status: 'confirmed',
    })
  }

  await batchInsert('reservations', records)
  console.log(`✅ 予約: ${records.length} 件投入完了 (スキップ: ${skipCount} 件)`)
}

// ─── メイン処理 ──────────────────────────────────────────────────────────────
async function main() {
  const dataDir = path.resolve(process.cwd(), 'scripts/data')

  console.log('🚀 CSV移行スクリプト開始')
  console.log(`   データフォルダ: ${dataDir}`)

  // CSVを読み込む
  const customerRows = readCsv<CustomerRow>(path.join(dataDir, 'customers_export.csv'))
  const therapistRows = readCsv<TherapistRow>(path.join(dataDir, 'therapists_export.csv'))
  const reservationRows = readCsv<ReservationRow>(path.join(dataDir, 'reservations_export.csv'))

  console.log(`📂 読み込み完了:`)
  console.log(`   顧客: ${customerRows.length} 件`)
  console.log(`   セラピスト: ${therapistRows.length} 件`)
  console.log(`   予約: ${reservationRows.length} 件`)

  // 店舗マップを構築
  console.log('\n🏪 店舗データを取得中...')
  const storeMap = await buildStoreMap()
  console.log(`   ${storeMap.size} 店舗を確認`)
  if (storeMap.size === 0) {
    console.error('❌ storesテーブルに店舗が登録されていません。先に店舗を登録してください。')
    process.exit(1)
  }
  storeMap.forEach((id, name) => console.log(`   - ${name} (${id})`))

  // インポート実行
  const customerMap = await importCustomers(customerRows, storeMap)
  const therapistMap = await importTherapists(therapistRows, storeMap)
  const courseMap = await buildCourseMap()
  await importReservations(reservationRows, storeMap, customerMap, therapistMap, courseMap)

  console.log('\n🎉 移行完了！')
}

main().catch((err) => {
  console.error('\n❌ エラーが発生しました:', err.message)
  process.exit(1)
})
