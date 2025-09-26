import { NextResponse } from "next/server"

import { getSupabaseAdminClient } from "@/lib/supabaseAdminClient"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { email, userMetadata } = body

    if (!email || !userMetadata) {
      return NextResponse.json(
        { error: "Email and user metadata are required." },
        {
          status: 400,
          headers: { "Access-Control-Allow-Origin": "*" },
        }
      )
    }

    const supabaseAdmin = getSupabaseAdminClient()

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
      first_name: userMetadata.first_name,
      last_name: userMetadata.last_name,
      job_title: (userMetadata.job_title as string | null) ?? null,
      phone: (userMetadata.phone as string | null) ?? null,
      authorized: typeof body.authorized === "boolean" ? body.authorized : false,
      role: body.role ?? "workspace_user",
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
