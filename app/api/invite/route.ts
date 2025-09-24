// app/api/invite/route.ts
import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// ✅ Extended type to include org info
interface InviteRequestBody {
  email: string
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

    if (!body.email) {
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

    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      body.email,
      {
        data: {
          first_name: body.first_name,
          last_name: body.last_name,
          job_title: body.job_title,
          phone: body.phone,
          role: body.role,
          authorized: body.authorized,
          organization_id: body.organization_id, // ✅ added
          org_role: body.org_role || "member",   // ✅ default
        },
      }
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
