import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pumkniqtgjsotsxhyvbq.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_PVxVPbhBIRoEOe1IyRx4zA_ofK5vaar'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)