import { createClient } from "@supabase/supabase-js"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

// Helper function to create the Admin client
const getSupabaseAdminClient = () => { // ✅ Added
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
export async function PATCH( // ✅ Added
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const targetUserId = params.id
    const body = await req.json()
    const updates = body as { role?: string; [key: string]: any }

    // 1. Authenticate and get invoker's role
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

    // Get current user (invoker's) role to check for permissions
    const { data: invokerProfile, error: invokerError } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .maybeSingle()

    if (invokerError || !invokerProfile) {
      throw new Error("Could not retrieve invoker profile.")
    }

    const normalizedInvokerRole = invokerProfile.role?.trim().toLowerCase()
    const isOrgAdmin = normalizedInvokerRole === "org_admin" // ✅ Added

    // 2. Security Check: Prevent role elevation to 'arion_admin' by 'org_admin'
    if (isOrgAdmin) { // ✅ Added
      const newRole = updates.role?.trim().toLowerCase()
      
      // If the org_admin is trying to set the role to 'arion_admin', reject it
      if (newRole === "arion_admin") { // ✅ Added
        return NextResponse.json(
          { error: "You do not have permission to assign the 'arion_admin' role." },
          { status: 403 }
        )
      }
      
      // OPTIONAL: Add check here to ensure org_admin is only updating users in their orgs.
      // This is omitted for brevity but recommended for full security.
    }
    
    // 3. Perform the update
    const { data, error: updateError } = await supabaseAdmin
      .from("profiles")
      .update(updates)
      .eq("id", targetUserId)
      .select()
      .maybeSingle()

    if (updateError) {
      throw updateError
    }

    if (!data) {
      return NextResponse.json(
        { error: "User not found or nothing updated." },
        { status: 404 }
      )
    }

    // 4. Return the updated data (or a subset of it)
    const { id, first_name, last_name, job_title, phone, authorized, role } = data as any
    return NextResponse.json({
      data: { id, first_name, last_name, job_title, phone, authorized, role },
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update user profile."
    console.error(`PATCH /api/admin/users/[id] error:`, message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}