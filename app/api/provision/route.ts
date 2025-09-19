import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    console.log("Provision request body:", body)

    // TODO: add your provisioning logic here
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
