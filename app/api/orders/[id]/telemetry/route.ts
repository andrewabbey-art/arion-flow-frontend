import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

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
    // ✅ Use service role key so we bypass RLS safely on the server
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: order, error } = await supabase
      .from("orders")
      .select("id, pod_id, volume_id")
      .eq("id", orderId)
      .single()

    const typedOrder = order as OrderRow | null

    if (error || !typedOrder) {
      return NextResponse.json(
        { ok: false, error: "Order not found or missing pod_id" },
        { status: 404 }
      )
    }

    const { pod_id: podId } = typedOrder
    if (!podId) {
      return NextResponse.json(
        { ok: false, error: "Order has no pod_id" },
        { status: 400 }
      )
    }

    // ✅ Example telemetry fetch – replace with your real RunPod / system call
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
