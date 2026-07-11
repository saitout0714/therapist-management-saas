import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.join(__dirname, '../.env.local') })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(url, key)

async function run() {
  console.log('Fetching a sample reservation code...')
  const { data: codeRow, error: codeErr } = await supabase
    .from('shop_reservation_codes')
    .select('code, shop_id')
    .eq('is_active', true)
    .limit(1)
    .single()

  if (codeErr || !codeRow) {
    console.error('Failed to get a sample reservation code:', codeErr)
    return
  }

  const { code, shop_id: shopId } = codeRow
  console.log(`Using code: "${code}" for shopId: "${shopId}"`)

  console.log('\n--- Measuring shop_reservation_codes lookup ---')
  const startCode = Date.now()
  const { data: lookupRow } = await supabase
    .from('shop_reservation_codes')
    .select('shop_id, is_active')
    .eq('code', code)
    .single()
  console.log(`Code lookup took: ${Date.now() - startCode}ms`)

  console.log('\n--- Measuring parallel queries ---')
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const nextWeek = new Date(today)
  nextWeek.setDate(today.getDate() + 6)
  const nextWeekStr = nextWeek.toISOString().split('T')[0]

  const t1 = Date.now()
  const [shopRes, coursesRes, shiftsRes, reservationsRes, settingsRes] = await Promise.all([
    supabase.from('shops').select('id, name, short_name, description').eq('id', shopId).single().then(r => {
      console.log(`  shops query took: ${Date.now() - t1}ms`)
      return r
    }),
    supabase
      .from('courses')
      .select('id, name, duration, base_price')
      .eq('shop_id', shopId)
      .eq('is_active', true)
      .order('display_order', { ascending: true, nullsFirst: false }).then(r => {
        console.log(`  courses query took: ${Date.now() - t1}ms`)
        return r
      }),
    supabase
      .from('shifts')
      .select(`
        id, date, start_time, end_time,
        therapists (id, name, age, height, bust, bust_cup, waist, hip, comment, photo_url, rank_id, is_active, reservation_interval_minutes,
          therapist_ranks (name))
      `)
      .eq('shop_id', shopId)
      .gte('date', todayStr)
      .lte('date', nextWeekStr)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true }).then(r => {
        console.log(`  shifts query took: ${Date.now() - t1}ms`)
        return r
      }),
    supabase
      .from('reservations')
      .select('therapist_id, date, start_time, end_time, status')
      .eq('shop_id', shopId)
      .gte('date', todayStr)
      .lte('date', nextWeekStr)
      .in('status', ['confirmed', 'blocked']).then(r => {
        console.log(`  reservations query took: ${Date.now() - t1}ms`)
        return r
      }),
    supabase
      .from('system_settings')
      .select('reservation_interval_minutes')
      .eq('shop_id', shopId)
      .maybeSingle().then(r => {
        console.log(`  system_settings query took: ${Date.now() - t1}ms`)
        return r
      }),
  ])

  console.log(`Parallel queries total time: ${Date.now() - t1}ms`)

  const shifts = (shiftsRes.data || []).filter((s: any) => {
    const t = Array.isArray(s.therapists) ? s.therapists[0] : s.therapists
    return t?.is_active !== false
  })

  const therapistIds = [...new Set(shifts.map((s: any) => {
    const t = Array.isArray(s.therapists) ? s.therapists[0] : s.therapists
    return t?.id
  }).filter(Boolean))] as string[]

  console.log(`Found ${therapistIds.length} active therapists in shifts.`)

  if (therapistIds.length > 0) {
    const startPhotos = Date.now()
    const { data: photosData } = await supabase
      .from('therapist_photos')
      .select('therapist_id, photo_url, display_order')
      .in('therapist_id', therapistIds)
      .order('display_order', { ascending: true })
    console.log(`Photos lookup took: ${Date.now() - startPhotos}ms`)
  }
}

run()
