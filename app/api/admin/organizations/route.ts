import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { getSupabaseAdminClient } from "@/lib/supabaseAdminClient" 

export async function GET() {
  try {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({
      cookies: () => cookieStore,
    })

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError) {
      throw sessionError
    }

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .maybeSingle()

    if (profileError) {
      throw profileError
    }

    const normalizedRole = profile?.role?.trim().toLowerCase()
    const isOrgAdmin = normalizedRole === "org_admin" // ✅ Added

    let organizationFilter: string[] | null = null

    if (isOrgAdmin) { // ✅ Added: Filter organizations for org_admin
      const { data: memberships, error: membershipsError } = await supabase
        .from("organization_users")
        .select("organization_id")
        .eq("user_id", session.user.id)

      if (membershipsError) {
        throw membershipsError
      }

      const memberOrgIds = (memberships ?? [])
        .map((record) => record.organization_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0)

      organizationFilter = memberOrgIds

      if (memberOrgIds.length === 0) {
        return NextResponse.json({
          data: [],
          meta: { selectionLocked: true },
        })
      }
    }

    const supabaseAdmin = getSupabaseAdminClient()

    let query = supabaseAdmin.from("organizations").select("id, name")

    if (organizationFilter) {
      query = query.in("id", organizationFilter) // ✅ Added: Apply filter
    }

    const { data, error } = await query.order("name")

    if (error) {
      throw error
    }

    return NextResponse.json({
      data: data ?? [],
      meta: { selectionLocked: isOrgAdmin }, // ✅ Added: Pass lock status to client
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load organizations."
    console.error("/api/admin/organizations error:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}