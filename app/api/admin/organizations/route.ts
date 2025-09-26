import { NextResponse } from "next/server"

import { getSupabaseAdminClient } from "@/lib/supabaseAdminClient" // ✅ Added

export async function GET() { // ✅ Added
  try {
    const supabaseAdmin = getSupabaseAdminClient()
    const { data, error } = await supabaseAdmin
      .from("organizations")
      .select("id, name")
      .order("name")

    if (error) {
      throw error
    }

    return NextResponse.json({ data: data ?? [] })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load organizations."
    console.error("/api/admin/organizations error:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}