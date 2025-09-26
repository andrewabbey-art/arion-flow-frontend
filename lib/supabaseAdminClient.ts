import { createClient, SupabaseClient } from "@supabase/supabase-js"

let supabaseAdmin: SupabaseClient | null = null

export function getSupabaseAdminClient(): SupabaseClient { // ✅ Added
  if (!supabaseAdmin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!url || !serviceKey) {
      throw new Error("Supabase admin client misconfigured: missing URL or service role key")
    }

    supabaseAdmin = createClient(url, serviceKey, {
      auth: {
        persistSession: false,
      },
    })
  }

  return supabaseAdmin
}