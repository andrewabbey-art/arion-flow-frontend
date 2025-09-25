import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

interface InviteRequestBody {
  email?: string
  first_name?: string
  last_name?: string
  job_title?: string
  phone?: string
  role?: string
  authorized?: boolean
  organization_id?: string
  org_role?: string
}

export async function OPTIONS() {
  return NextResponse.json(
    { ok: true },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers":
          "authorization, x-client-info, apikey, content-type",
      },
    }
  )
}

export async function POST(req: Request) {
  try {
    const body: InviteRequestBody = await req.json()

    // ✅ Changed: normalize and validate email
    const email = body.email?.trim().toLowerCase()
    if (!email) {
      return NextResponse.json({ error: "email is required" }, { status: 400 })
    }

    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY
    ) {
      throw new Error("Server misconfigured: missing Supabase env vars")
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: { persistSession: false }, // ✅ Changed
      }
    )

    // ✅ Changed: trim fields
    const trimmedFirstName = body.first_name?.trim()
    const trimmedLastName = body.last_name?.trim()
    const trimmedJobTitle = body.job_title?.trim()
    const trimmedPhone = body.phone?.trim()

    const inviteMetadata: Record<string, string> = {}
    if (trimmedFirstName) inviteMetadata.first_name = trimmedFirstName
    if (trimmedLastName) inviteMetadata.last_name = trimmedLastName
    if (trimmedJobTitle) inviteMetadata.job_title = trimmedJobTitle
    if (trimmedPhone) inviteMetadata.phone = trimmedPhone

    const organizationId = body.organization_id?.trim()
    const orgIdRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

    if (organizationId && !orgIdRegex.test(organizationId)) {
      return NextResponse.json(
        { error: "organization_id must be a valid UUID" },
        { status: 400 }
      )
    }

    const inviteOptions =
      Object.keys(inviteMetadata).length > 0
        ? { data: inviteMetadata }
        : undefined

    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      inviteOptions
    )

    if (error) throw error

    const invitedUser = data?.user
    if (!invitedUser) {
      throw new Error("Invite succeeded but no user information was returned")
    }

    // ✅ Changed: build profile payload
    const role =
      typeof body.role === "string" && body.role.trim()
        ? body.role.trim()
        : "workspace_user"
    const authorized =
      typeof body.authorized === "boolean" ? body.authorized : false

    const profilePayload: {
      id: string
      authorized: boolean
      role: string
      first_name?: string | null
      last_name?: string | null
      job_title?: string | null
      phone?: string | null
    } = {
      id: invitedUser.id,
      authorized,
      role,
    }

    if (trimmedFirstName !== undefined) {
      profilePayload.first_name = trimmedFirstName || null
    }
    if (trimmedLastName !== undefined) {
      profilePayload.last_name = trimmedLastName || null
    }
    if (trimmedJobTitle !== undefined) {
      profilePayload.job_title = trimmedJobTitle || null
    }
    if (trimmedPhone !== undefined) {
      profilePayload.phone = trimmedPhone || null
    }

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert(profilePayload, { onConflict: "id" })

    if (profileError) {
      console.error("Failed to upsert profile for invited user", profileError)
      throw new Error(profileError.message)
    }

    // ✅ Changed: link user to organization
    if (organizationId) {
      const organizationRole =
        typeof body.org_role === "string" && body.org_role.trim()
          ? body.org_role.trim()
          : role === "arion_admin"
          ? "admin"
          : "member"

      const { error: orgLinkError } = await supabaseAdmin
        .from("organization_users")
        .upsert(
          {
            organization_id: organizationId,
            user_id: invitedUser.id,
            role: organizationRole,
          },
          { onConflict: "user_id,organization_id" }
        )

      if (orgLinkError) {
        console.error("Failed to link invited user to organization", orgLinkError)
        throw new Error(orgLinkError.message)
      }
    }

    return NextResponse.json(
      { data },
      {
        headers: { "Access-Control-Allow-Origin": "*" },
      }
    )
  } catch (error) {
    console.error("Invite API error:", error) // ✅ Changed
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred."
    return NextResponse.json(
      { error: errorMessage },
      {
        status: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
      }
    )
  }
}
