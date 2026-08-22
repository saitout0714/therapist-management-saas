import { createClient } from '@supabase/supabase-js'

if (!process.env.SUPABASE_SERVICE_ROLE_KEY && typeof window === 'undefined') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('dotenv').config({ path: '.env.local' })
  } catch (e) {}
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pumkniqtgjsotsxhyvbq.supabase.co'
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
if (!supabaseServiceRoleKey && typeof window === 'undefined') {
  console.warn('[supabaseAdmin] Warning: SUPABASE_SERVICE_ROLE_KEY is not defined in environment variables.')
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
})
