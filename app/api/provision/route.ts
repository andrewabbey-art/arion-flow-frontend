import { NextResponse } from "next/server"
import { getSupabaseClient } from "../../../lib/supabaseClient"

export async function POST(req: Request) {
  try {
    const supabase = getSupabaseClient()
    const body = await req.json()
    console.log("Provision request body:", body)

    // Example: log to Supabase (optional)
    // await supabase.from("provision_logs").insert({ body })

    return NextResponse.json({ ok: true, received: body })
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error("Provision error:", err.message)
      return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
    }
    console.error("Unknown provision error:", err)
    return NextResponse.json({ ok: false, error: "Unknown error occurred" }, { status: 500 })
  }
}

