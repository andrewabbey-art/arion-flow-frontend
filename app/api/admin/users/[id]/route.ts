import { NextResponse } from "next/server"

import { getSupabaseAdminClient } from "@/lib/supabaseAdminClient"

// ❌ Removed: The conflicting RouteContext type definition

const ALLOWED_FIELDS = new Set([
  "first_name",
  "last_name",
  "job_title",
  "phone",
  "authorized",
  "role",
])

// ✅ Modified signature to use inline type for context
export async function PATCH(request: Request, context: { params: { id: string } }) {
  const userId = context.params.id // ✅ Modified

  if (!userId) {
    return NextResponse.json({ error: "User id is required." }, { status: 400 })
  }

  try {
    const body = (await request.json()) as Record<string, unknown>
    const updateEntries = Object.entries(body).filter(([field]) =>
      ALLOWED_FIELDS.has(field)
    )

    if (updateEntries.length === 0) {
      return NextResponse.json(
        { error: "No valid fields provided for update." },
        { status: 400 }
      )
    }

    const updates = Object.fromEntries(updateEntries)

    const supabaseAdmin = getSupabaseAdminClient()
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .update(updates)
      .eq("id", userId)
      .select()
      .single()

    if (error) {
      throw error
    }

    if (!data) {
      return NextResponse.json(
        {
          error:
            "Update failed. The record may not exist or could not be modified.",
        },
        { status: 404 }
      )
    }

    return NextResponse.json({ data })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update the user."
    console.error(`/api/admin/users/${context.params.id} error:`, message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}