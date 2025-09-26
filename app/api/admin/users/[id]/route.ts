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

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  const { params } = context
  const { id: userId } = await params

  if (!userId) {
    return NextResponse.json({ error: "User id is required." }, { status: 400 })
  }

  try {
    const cookieStore = cookies() // ✅ Added
    // Use RLS-aware client to check session
    const supabaseClient = createRouteHandlerClient({ cookies: () => cookieStore }) // ✅ Added

    const {
      data: { session },
      error: sessionError,
    } = await supabaseClient.auth.getSession()

    if (sessionError || !session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabaseAdmin = getSupabaseAdminClient()

    // 1. Get invoker's role using the Admin client to bypass RLS
    const { data: invokerProfile, error: invokerError } = await supabaseAdmin // ✅ Added
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single()

    if (invokerError || !invokerProfile) {
      return NextResponse.json(
        { error: "Unable to verify invoker role." },
        { status: 403 }
      )
    }

    const isOrgAdmin = invokerProfile.role === "org_admin"

    // 2. Parse and validate fields
    const body = await request.json()
    const updateEntries = Object.entries(body).filter(([field]) =>
      ALLOWED_FIELDS.has(field)
    )

    if (updateEntries.length === 0) {
      return NextResponse.json(
        { error: "No valid fields provided for update." },
        { status: 400 }
      )
    }

    const updates = Object.fromEntries(updateEntries) as ProfileUpdate // ✅ Typed

    // 3. Security Check: Prevent role elevation to 'arion_admin' by 'org_admin'
    if (isOrgAdmin) { // ✅ Added
      const newRole = updates.role?.trim().toLowerCase()

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
