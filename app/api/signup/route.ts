import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

interface SignupRequestBody {
  firstName?: string
  lastName?: string
  email?: string
  password?: string
  organizationName?: string
  jobTitle?: string
}

function jsonResponse(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    headers: { "Access-Control-Allow-Origin": "*" },
    ...init,
  })
}

export async function OPTIONS() {
  return jsonResponse(
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
    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY
    ) {
      console.error("Missing Supabase environment variables for signup handler")
      return jsonResponse({ error: "Server misconfigured" }, { status: 500 })
    }

    const body: SignupRequestBody = await req.json()
    const firstName = body.firstName?.trim()
    const lastName = body.lastName?.trim()
    const email = body.email?.trim().toLowerCase()
    const password = body.password
    const organizationName = body.organizationName?.trim()
    const jobTitle = body.jobTitle?.trim()

    if (!firstName || !lastName || !email || !password || !organizationName) {
      return jsonResponse({ error: "Missing required fields" }, { status: 400 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const { data: existingOrg, error: orgLookupError } = await supabaseAdmin
      .from("organizations")
      .select("id")
      .eq("name", organizationName)
      .maybeSingle()

    if (orgLookupError) {
      console.error("Failed to check organization existence", orgLookupError)
      return jsonResponse({ error: "Failed to check organization" }, { status: 500 })
    }

    if (existingOrg) {
      return jsonResponse(
        {
          error: "organization_exists",
          message: "The organization is already registered.",
        },
        { status: 409 }
      )
    }

    const { data: createdUser, error: createUserError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          first_name: firstName,
          last_name: lastName,
          job_title: jobTitle || null,
        },
      })

    if (createUserError) {
      const normalizedMessage = createUserError.message.toLowerCase()
      if (normalizedMessage.includes("user already registered")) {
        return jsonResponse(
          {
            error: "user_exists",
            message: "A user with this email already exists.",
          },
          { status: 409 }
        )
      }

      console.error("Failed to create user during signup", createUserError)
      return jsonResponse({ error: "Failed to create user" }, { status: 500 })
    }

    const newUser = createdUser.user

    if (!newUser) {
      console.error("Supabase admin createUser returned no user")
      return jsonResponse({ error: "Failed to create user" }, { status: 500 })
    }

    // Note: The Service Role bypasses RLS and base privileges.
    // We are relying on the user to have dropped the conflicting PostgreSQL trigger.

    const profilePayload = {
      id: newUser.id,
      first_name: firstName,
      last_name: lastName,
      job_title: jobTitle || null,
      authorized: false,
      role: "org_admin", // ✅ Added: Aligning profile role with design intent
    }

    // The admin client is used to upsert the profile, ensuring data integrity.
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert(profilePayload, { onConflict: "id" })

    if (profileError) {
      console.error("Failed to upsert profile", profileError)
      // Attempt to clean up the partially created user
      await supabaseAdmin.auth.admin.deleteUser(newUser.id)
      return jsonResponse({ error: "Failed to create profile" }, { status: 500 })
    }

    const { data: organizationData, error: organizationError } = await supabaseAdmin
      .from("organizations")
      .insert({ name: organizationName })
      .select("id")
      .single()

    if (organizationError) {
      console.error("Failed to create organization", organizationError)
      // Attempt to clean up the partially created user
      await supabaseAdmin.auth.admin.deleteUser(newUser.id)
      return jsonResponse({ error: "Failed to create organization" }, { status: 500 })
    }

    const organizationId = organizationData?.id

    if (!organizationId) {
      console.error("Organization insert returned no id")
      await supabaseAdmin.auth.admin.deleteUser(newUser.id)
      return jsonResponse({ error: "Failed to create organization" }, { status: 500 })
    }

    const { error: organizationUserError } = await supabaseAdmin
      .from("organization_users")
      .insert({
        user_id: newUser.id,
        organization_id: organizationId,
        role: "admin",
      })

    if (organizationUserError) {
      console.error("Failed to link user to organization", organizationUserError)
      // Attempt to clean up the partially created user
      await supabaseAdmin.auth.admin.deleteUser(newUser.id)
      // Clean up the organization that was successfully created
      await supabaseAdmin.from("organizations").delete().eq("id", organizationId)
      return jsonResponse({ error: "Failed to link user to organization" }, { status: 500 })
    }

    return jsonResponse({ data: { userId: newUser.id, organizationId } })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    console.error("Unexpected error in signup API", message)
    return jsonResponse({ error: "Unexpected error" }, { status: 500 })
  }
}