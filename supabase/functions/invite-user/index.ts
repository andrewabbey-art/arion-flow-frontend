import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

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

    return NextResponse.json(
      { data },
      {
        headers: { "Access-Control-Allow-Origin": "*" },
      }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      { error: message },
      {
        status: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
      }
    )
  }
}
