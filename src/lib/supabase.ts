import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** Env vars na ho to null — app bina login ke demo mode me chalti rahegi. */
export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null

export const isSupabaseConfigured = (): boolean => supabase !== null
