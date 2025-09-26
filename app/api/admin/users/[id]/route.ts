import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdminClient } from "@/lib/supabaseAdminClient"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs" // ✅ Added
import { cookies } from "next/headers" // ✅ Added
import type { PostgrestSingleResponse } from "@supabase/supabase-js"

// Define types for strictness to resolve @typescript-eslint/no-explicit-any errors
type ProfileUpdate = { // ✅ Added
  first_name?: string
  last_name?: string
  job_title?: string | null
  phone?: string | null
  authorized?: boolean
  role?: string
}

type ProfileData = { // ✅ Added
  id: string
  first_name: string | null
  last_name: string | null
  job_title: string | null
  phone: string | null
  authorized: boolean
  role: string | null
}

const ALLOWED_FIELDS = new Set([
  "first_name",
  "last_name",
  "job_title",
  "phone",
  "authorized",
  "role",
])

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabaseAdmin = getSupabaseAdminClient()
  const supabase = createRouteHandlerClient({ cookies }) // ✅ Added

  const userId = params.id

  try {
    // 1. Auth check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized. No valid session found." },
        { status: 401 }
      )
    }

    const {
      data: { role: currentUserRole },
    } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    const isOrgAdmin = currentUserRole === "org_admin"

    // 2. Parse incoming updates
    const body = await req.json()
    const updateEntries = Object.entries(body).filter(([field]) =>
      ALLOWED_FIELDS.has(field)
    )

    if (updateEntries.length === 0) {
      return NextResponse.json(
        { error: "No valid fields provided for update." },
        { status: 400 }
      )
    }

    const updates = Object.fromEntries(updateEntries) as ProfileUpdate // ✅ Typed to remove @typescript-eslint/no-explicit-any

    // 2. Security Check: Prevent role elevation to 'arion_admin' by 'org_admin'
    if (isOrgAdmin) { // ✅ Added
      const newRole = updates.role?.trim().toLowerCase()
      
      // If the org_admin is trying to set the role to 'arion_admin', reject it
      if (newRole === "arion_admin") { // ✅ Added
        return NextResponse.json(
          { error: "You do not have permission to assign the 'arion_admin' role." },
          { status: 403 }
        )
      }
    }

    const response: PostgrestSingleResponse<ProfileData> = await supabaseAdmin
      .from("profiles")
      .update(updates)
      .eq("id", userId)
      .select()
      .single()

    const { data, error } = response

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
    console.error(`/api/admin/users/${userId} error:`, message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
