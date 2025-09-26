import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { getSupabaseAdminClient } from "@/lib/supabaseAdminClient" 

export async function GET() {
  try {
    const cookieStore = cookies()
    // Use RLS-aware client to get the session only
    const supabaseClient = createRouteHandlerClient({
      cookies: () => cookieStore,
    })

    const {
      data: { session },
      error: sessionError,
    } = await supabaseClient.auth.getSession()

    if (sessionError) {
      throw sessionError
    }

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabaseAdmin = getSupabaseAdminClient() // ✅ Get Admin client here

    // Use Admin client to bypass RLS and reliably get the current user's role
    const { data: profile, error: profileError } = await supabaseAdmin // ✅ Modified
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .maybeSingle()

    if (profileError) {
      throw profileError
    }

    const normalizedRole = profile?.role?.trim().toLowerCase()
    const isOrgAdmin = normalizedRole === "org_admin"

    let organizationFilter: string[] | null = null

    if (isOrgAdmin) {
      // Use Admin client to bypass RLS and reliably get the current user's organization memberships
      const { data: memberships, error: membershipsError } = await supabaseAdmin // ✅ Modified
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

    // Final query already uses Admin client
    let query = supabaseAdmin.from("organizations").select("id, name")

    if (organizationFilter) {
      query = query.in("id", organizationFilter)
    }

    const { data, error } = await query.order("name")

    if (error) {
      throw error
    }

    return NextResponse.json({
      data: data ?? [],
      meta: { selectionLocked: isOrgAdmin },
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load organizations."
    console.error("/api/admin/organizations error:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}