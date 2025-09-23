// app/api/invite/route.ts (Next.js App Router, Vercel)

import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

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
    const user = await req.json()

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
    )

    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      user.email,
      {
        data: {
          first_name: user.first_name,
          last_name: user.last_name,
          job_title: user.job_title,
          phone: user.phone,
          role: user.role,
          authorized: user.authorized,
        },
      }
    )

    if (error) throw error

    return NextResponse.json({ data }, {
      headers: { "Access-Control-Allow-Origin": "*" },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, {
      status: 400,
      headers: { "Access-Control-Allow-Origin": "*" },
    })
  }
}
