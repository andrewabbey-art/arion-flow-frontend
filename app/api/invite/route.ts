// app/api/invite/route.ts
import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function OPTIONS() {
  return NextResponse.json({ ok: true }, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    },
  })
}

export async function POST(req: Request) {
  try {
    // ✅ Added: safer JSON parsing
    let body: any
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: "Invalid or empty JSON body" }, { status: 400 })
    }

    const {
      email,
      first_name,
      last_name,
      job_title,
      phone,
      role,
      authorized,
    } = body // ✅ Added (was inline before)

    if (!email) {
      return NextResponse.json({ error: "email is required" }, { status: 400 })
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "Server misconfigured: missing Supabase env vars" },
        { status: 500 }
      )
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY // server-only secret
    )

    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: {
        first_name,
        last_name,
        job_title,
        phone,
        role,
        authorized,
      },
      // redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/auth/callback`,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true, data }, {
      headers: { "Access-Control-Allow-Origin": "*" },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Unknown error" }, {
      status: 500, // ✅ Added: make sure unexpected errors are treated as server errors
      headers: { "Access-Control-Allow-Origin": "*" },
    })
  }
}
