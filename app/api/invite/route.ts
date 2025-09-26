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
          { error: "A user with this email address already exists." },
          { status: 409 } // 409 Conflict is more appropriate here
        )
      }
      throw inviteError
    }

    const newUser = inviteData.user

    if (!newUser) {
      throw new Error("User invitation did not return a user object.")
    }

    const profilePayload = {
      id: newUser.id,
      first_name: firstName,
      last_name: lastName,
      job_title: jobTitle || null,
      phone: phone || null,
      authorized,
      role,
    }

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert(profilePayload, { onConflict: "id" })

    if (profileError) {
      console.error(
        `Failed to create profile for invited user ${newUser.id}:`,
        profileError
      )
      await supabaseAdmin.auth.admin.deleteUser(newUser.id)

      return NextResponse.json(
        { error: "Failed to create profile for invited user." },
        {
          status: 500,
          headers: { "Access-Control-Allow-Origin": "*" },
        }
      )
    }

    // ✅ Step 2: If an organization ID is provided, link the new user to it.
    if (body.organization_id) {
      const { error: orgLinkError } = await supabaseAdmin
        .from("organization_users")
        .insert({
          user_id: newUser.id,
          organization_id: body.organization_id,
          role: body.org_role || "member",
        })

      if (orgLinkError) {
        // This is a secondary error. The user was invited, but linking failed.
        // We should log this but not necessarily fail the whole request,
        // as the admin can link the user manually.
        console.error(
          `Failed to link user ${newUser.id} to org ${body.organization_id}:`,
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
