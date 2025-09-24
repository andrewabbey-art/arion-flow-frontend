import { createClient, SupabaseClient } from "@supabase/supabase-js"

let supabase: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient {
  if (!supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!url || !key) {
      throw new Error("Supabase URL and Anon Key must be set")
    }

    supabase = createClient(url, key)
  }
  return supabase
}
