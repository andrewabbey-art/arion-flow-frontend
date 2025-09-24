import { createBrowserClient } from "@supabase/ssr"

// ✅ Added: Create a singleton instance of the Supabase client.
let client: ReturnType<typeof createBrowserClient> | undefined = undefined;

// ✅ Modified: This function now returns the same client instance every time,
// preventing the "Multiple GoTrueClient instances" warning.
export function getSupabaseClient() {
  if (client) {
    return client;
  }

  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  return client;
}