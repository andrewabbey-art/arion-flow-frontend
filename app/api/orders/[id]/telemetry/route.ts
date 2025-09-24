import { NextRequest, NextResponse } from "next/server"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"

type OrderRow = {
  id: string
  pod_id: string | null
  volume_id: string | null
}

export async function GET(
  req: NextRequest,
  context: { params: { id: string } }
) {
  const { id: orderId } = context.params

  try {
    // ✅ Supabase client bound to the logged-in user session
    const supabase = createRouteHandlerClient({ cookies })

    // ✅ Ensure session is valid
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError || !session) {
      return NextResponse.json(
        { ok: false, error: "Not authenticated" },
        { status: 401 }
      )
    }

    // ✅ Query orders as the logged-in user
    const { data: order, error } = await supabase
      .from("orders")
      .select("id, pod_id, volume_id")
      .eq("id", orderId)
      .single() // may throw 406 if row is not visible under RLS

    if (error || !order) {
      return NextResponse.json(
        { ok: false, error: "Order not found or not accessible" },
        { status: 404 }
      )
    }

    const typedOrder = order as OrderRow
    if (!typedOrder.pod_id) {
      return NextResponse.json(
        { ok: false, error: "Order has no pod_id" },
        { status: 400 }
      )
    }

    // ✅ Placeholder telemetry (replace with RunPod API if needed)
    const telemetry = {
      runtime_status: "running",
      uptime_seconds: 1234,
      gpu_type: "NVIDIA A100",
      volume_size_gb: 50,
    }

    return NextResponse.json({ ok: true, telemetry })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    console.error(`Telemetry failed for order ${orderId}:`, message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
