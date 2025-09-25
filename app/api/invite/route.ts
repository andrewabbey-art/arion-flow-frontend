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

    // ✅ Changed: trim and validate email
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

    // ✅ Changed: build metadata safely
    const metadata: Record<string, string | boolean> = {}

    if (typeof body.role === "string" && body.role.trim()) {
      metadata.role = body.role.trim()
    }

    if (typeof body.authorized === "boolean") {
      metadata.authorized = body.authorized
    }

    if (body.first_name?.trim()) metadata.first_name = body.first_name.trim()
    if (body.last_name?.trim()) metadata.last_name = body.last_name.trim()
    if (body.job_title?.trim()) metadata.job_title = body.job_title.trim()
    if (body.phone?.trim()) metadata.phone = body.phone.trim()

    const organizationId = body.organization_id?.trim()
    if (organizationId) {
      metadata.organization_id = organizationId
      if (body.org_role?.trim()) {
        metadata.org_role = body.org_role.trim()
      } else {
        metadata.org_role = "member"
      }
    } else if (body.org_role?.trim()) {
      metadata.org_role = body.org_role.trim()
    }

    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      { data: metadata }
    )

    if (error) throw error

    return NextResponse.json(
      { data },
      {
        headers: { "Access-Control-Allow-Origin": "*" },
      }
    )
  } catch (error) {
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
