// ✅ Changed: This file has been updated to correctly handle user invitations
// and link them to organizations in a two-step process to prevent database errors.

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
    const userMetadata: Record<string, unknown> = {
      role: body.role,
      authorized: body.authorized,
      first_name: body.first_name?.trim() || "",
      last_name: body.last_name?.trim() || "",
      job_title: body.job_title?.trim() || null,
      phone: body.phone?.trim() || null,
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
        console.error(`Failed to link user ${newUser.id} to org ${body.organization_id}:`, orgLinkError)
        // Optionally, you could return a partial success message here.
      }
    }

    return NextResponse.json(
      { data: { user: newUser } },
      {
        headers: { "Access-Control-Allow-Origin": "*" },
      }
    )
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred."
    
    // ✅ Added: Log the detailed error on the server for debugging
    console.error("Error in /api/invite:", errorMessage)
    
    return NextResponse.json(
      // ✅ Changed: Provide a clearer error message to the user
      { error: `Failed to invite user: ${errorMessage}` },
      {
        status: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
      }
    )
  }
}