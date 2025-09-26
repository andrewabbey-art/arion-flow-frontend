import { createClient } from "@supabase/supabase-js"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server" // ✅ Modified to use NextRequest

// Define types for strictness
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

// Helper function to create the Admin client
const getSupabaseAdminClient = () => {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    throw new Error("Server misconfigured: missing Supabase env vars")
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

// Handler for PATCH /api/admin/users/[id] (used for profile updates)
export async function PATCH( 
  req: NextRequest, // ✅ Modified to use NextRequest
  { params }: { params: { id: string } }
) {
  const targetUserId = params.id

  if (!targetUserId) {
    return NextResponse.json({ error: "User id is required." }, { status: 400 })
  }

  try {
    const cookieStore = cookies()
    const supabaseClient = createRouteHandlerClient({ cookies: () => cookieStore })

    const {
      data: { session },
      error: sessionError,
    } = await supabaseClient.auth.getSession()

    if (sessionError || !session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabaseAdmin = getSupabaseAdminClient()

    // 1. Get invoker's role using the Admin client to bypass RLS
    const { data: invokerProfile, error: invokerError } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .maybeSingle()

    if (invokerError || !invokerProfile) {
      console.error("Failed to retrieve invoker profile:", invokerError)
      return NextResponse.json({ error: "Authentication failed." }, { status: 403 })
    }

    const normalizedInvokerRole = invokerProfile.role?.trim().toLowerCase()
    const isOrgAdmin = normalizedInvokerRole === "org_admin" 

    const body = (await req.json()) as Record<string, unknown>
    const updateEntries = Object.entries(body).filter(([field]) =>
      ALLOWED_FIELDS.has(field)
    )

    if (updateEntries.length === 0) {
      return NextResponse.json(
        { error: "No valid fields provided for update." },
        { status: 400 }
      )
    }

    const updates = Object.fromEntries(updateEntries) as ProfileUpdate

    // 2. Security Check: Prevent role elevation to 'arion_admin' by 'org_admin'
    if (isOrgAdmin) { 
      const newRole = updates.role?.trim().toLowerCase()
      
      // If the org_admin is trying to set the role to 'arion_admin', reject it
      if (newRole === "arion_admin") { 
        return NextResponse.json(
          { error: "You do not have permission to assign the 'arion_admin' role." },
          { status: 403 }
        )
      }
    }
    
    // 3. Perform the update with explicit data type
    const { data, error: updateError } = await supabaseAdmin
      .from("profiles")
      .update(updates)
      .eq("id", targetUserId)
      .select<string, ProfileData>() // ✅ Modified: Explicitly select ProfileData type to resolve 'any' error
      .single()

    if (updateError) { 
      console.error("Supabase Update Error:", updateError)
      throw updateError
    }

    if (!data) {
      return NextResponse.json(
        { error: "User not found or nothing updated." },
        { status: 404 }
      )
    }

    // 4. Return the updated data 
    return NextResponse.json({
      data: data,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update user profile."
    console.error(`PATCH /api/admin/users/[id] error:`, message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}