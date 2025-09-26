import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

type InviteRequestBody = {
  email?: string
  first_name?: string
  last_name?: string
  job_title?: string
  phone?: string
  authorized?: boolean
  role?: string
  organization_id?: string
  org_role?: string
}

export async function OPTIONS() {
  return NextResponse.json({}, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  })
}

export async function POST(req: Request) {
  try {
    const body: InviteRequestBody = await req.json()
    const email = body.email?.trim()

    if (!email) {
      return NextResponse.json({ error: "email is required" }, { status: 400 })
    }

    const cookieStore = cookies() // ✅ Added
    const supabase = createRouteHandlerClient({ // ✅ Added
      cookies: () => cookieStore,
    })

    const { // ✅ Added
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError) { // ✅ Added
      throw sessionError
    }

    if (!session?.user) { // ✅ Added
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase // ✅ Added
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .maybeSingle()

    if (profileError) { // ✅ Added
      throw profileError
    }

    const normalizedRole = profile?.role?.trim().toLowerCase() // ✅ Added

    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY
    ) {
      throw new Error("Server misconfigured: missing Supabase env vars")
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // ✅ Changed: We now separate profile metadata from organization details.
    // Only data intended for the 'profiles' table should be in the user's metadata.
    const firstName = body.first_name?.trim() ?? ""
    const lastName = body.last_name?.trim() ?? ""
    const jobTitle = body.job_title?.trim() ?? ""
    const phone = body.phone?.trim() ?? ""
    const authorized = body.authorized ?? false
    const role = body.role ?? "workspace_user"

    const trimmedBodyOrgId = body.organization_id?.trim() // ✅ Added

    let targetOrgId = trimmedBodyOrgId // ✅ Added

    if (normalizedRole === "org_admin") { // ✅ Added: Enforce organization restriction for org_admin
      const { data: memberships, error: membershipsError } = await supabase
        .from("organization_users")
        .select("organization_id")
        .eq("user_id", session.user.id)

      if (membershipsError) {
        throw membershipsError
      }

      const allowedOrgIds = (memberships ?? [])
        .map((record) => record.organization_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0)

      if (allowedOrgIds.length === 0) {
        return NextResponse.json(
          { error: "You are not assigned to any organizations." },
          { status: 403 }
        )
      }

      // If an organization ID is provided in the request, ensure it's one the org_admin belongs to
      if (targetOrgId && !allowedOrgIds.includes(targetOrgId)) {
        return NextResponse.json(
          { error: "You cannot invite users to this organization." },
          { status: 403 }
        )
      }

      // Default to the first allowed organization if none was provided (or if the one provided was validated)
      targetOrgId = targetOrgId ?? allowedOrgIds[0]
    }

    if (!firstName || !lastName) {
      return NextResponse.json(
        { error: "first_name and last_name are required" },
        { status: 400 }
      )
    }

    const userMetadata: Record<string, unknown> = {
      role,
      authorized,
      first_name: firstName,
      last_name: lastName,
      job_title: jobTitle,
      phone,
    }

    // ✅ Step 1: Invite the user with only their profile metadata.
    const { data: inviteData, error: inviteError } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: userMetadata,
      })

    if (inviteError) {
      // ✅ Added: Better error classification for the client
      if (inviteError.message.includes("User already registered")) {
        return NextResponse.json(
          { error: "User is already registered or invited." },
          { status: 409, headers: { "Access-Control-Allow-Origin": "*" } }
        )
      }

      return NextResponse.json(
        { error: inviteError.message },
        { status: 500, headers: { "Access-Control-Allow-Origin": "*" } }
      )
    }

    const newUser = inviteData.user!

    // The rest of the profile fields are created by a database trigger (or should be).
    // We update the profile to ensure all custom fields are set.
    const profilePayload = {
      id: newUser.id,
      first_name: firstName,
      last_name: lastName,
      job_title: jobTitle,
      phone: phone,
      authorized,
      role,
    }

    const { error: profileErrorUpsert } = await supabaseAdmin 
      .from("profiles")
      .upsert(profilePayload, { onConflict: "id" })

    if (profileErrorUpsert) {
      console.error(
        `Failed to create profile for invited user ${newUser.id}:`,
        profileErrorUpsert 
      )
      // Attempt to clean up the invited user from auth
      await supabaseAdmin.auth.admin.deleteUser(newUser.id)

      return NextResponse.json(
        { error: "Failed to create profile for invited user." },
        {
          status: 500,
          headers: { "Access-Control-Allow-Origin": "*" },
        }
      )
    }

    // ✅ Step 2: If an organization ID is available (either provided or defaulted for org_admin), link the new user to it.
    if (targetOrgId) { // ✅ Modified
      const { error: orgLinkError } = await supabaseAdmin
        .from("organization_users")
        .insert({
          user_id: newUser.id,
          organization_id: targetOrgId, // ✅ Modified
          role: body.org_role || "member",
        })

      if (orgLinkError) {
        // This is a secondary error. The user was invited, but linking failed.
        // We should log this but not necessarily fail the whole request,
        // as the admin can link the user manually.
        console.error(
          `Failed to link user ${newUser.id} to org ${targetOrgId}:`, // ✅ Modified
          orgLinkError
        )
        // Optionally, you could return a partial success message here.
      }
    }

    return NextResponse.json(
      { data: { user: newUser } },
      {
        headers: { "Access-Control-Allow-Origin": "*" },
      }
    )
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unexpected error during invite."
    console.error("Invite API error:", message)
    return NextResponse.json(
      { error: message },
      {
        status: 500,
        headers: { "Access-Control-Allow-Origin": "*" },
      }
    )
  }
}