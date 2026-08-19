/*
 * このSupabaseプロジェクトは AWS ap-northeast-1(東京) にある。
 * Vercelの関数リージョンを東京に揃えておかないと（vercel.json の "regions"）、
 * デフォルトの iad1(米国東部) で実行され、クエリ1回ごとに太平洋を往復して
 * 約170msかかる。ページ表示までに数回問い合わせるため、そのままだと
 * TTFBが1〜2秒に膨らむ。vercel.json はコメントを持てないのでここに残す。
 */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pumkniqtgjsotsxhyvbq.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_PVxVPbhBIRoEOe1IyRx4zA_ofK5vaar'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)