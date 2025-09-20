import { NextRequest, NextResponse } from "next/server"
import { getSupabaseClient } from "../../../../../lib/supabaseClient"

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params   // ✅ await the promise

    const supabase = getSupabaseClient()
    const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY
    if (!RUNPOD_API_KEY) throw new Error("Missing RUNPOD_API_KEY env var.")

    // Lookup order
    const { data: order, error } = await supabase
      .from("orders")
      .select("id, pod_id, volume_id")
      .eq("id", id)
      .single()

    if (error || !order) {
      return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 })
    }

    // Fetch pod
    const podResp = await fetch(`https://rest.runpod.io/v1/pods/${order.pod_id}`, {
      headers: { Authorization: `Bearer ${RUNPOD_API_KEY}` },
    })
    const podJson = await podResp.json()

    // Fetch volume
    const volResp = await fetch(`https://rest.runpod.io/v1/networkvolumes/${order.volume_id}`, {
      headers: { Authorization: `Bearer ${RUNPOD_API_KEY}` },
    })
    const volJson = await volResp.json()

    const telemetry = {
      runtime_status: podJson.desiredStatus || "unknown",
      uptime_seconds: podJson.runtime?.uptimeInSeconds || 0,
      gpu_type: podJson.gpuTypeId || "N/A",
      volume_size_gb: volJson.size || 0,
    }

    // Update Supabase
    await supabase
      .from("orders")
      .update({
        runtime_status: telemetry.runtime_status,
        uptime_seconds: telemetry.uptime_seconds,
        volume_size_gb: telemetry.volume_size_gb,
        last_checked: new Date().toISOString(),
      })
      .eq("id", order.id)

    return NextResponse.json({ ok: true, telemetry })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("Telemetry error:", message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
