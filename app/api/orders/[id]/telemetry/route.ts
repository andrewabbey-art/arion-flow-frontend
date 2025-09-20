import { NextRequest, NextResponse } from "next/server"
import { getSupabaseClient } from "../../../../../lib/supabaseClient"

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params

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

    // Fetch pod details
    const podResp = await fetch(`https://rest.runpod.io/v1/pods/${order.pod_id}`, {
      headers: { Authorization: `Bearer ${RUNPOD_API_KEY}` },
    })
    const podJson = await podResp.json()

    // Fetch volume details
    const volResp = await fetch(`https://rest.runpod.io/v1/networkvolumes/${order.volume_id}`, {
      headers: { Authorization: `Bearer ${RUNPOD_API_KEY}` },
    })
    const volJson = await volResp.json()

    // Derive uptime
    let uptimeSeconds = 0
    if (podJson.runtime?.uptimeInSeconds) {
      uptimeSeconds = podJson.runtime.uptimeInSeconds
    } else if (podJson.runtime?.startedAt) {
      uptimeSeconds = Math.floor(
        (Date.now() - new Date(podJson.runtime.startedAt).getTime()) / 1000
      )
    }

    // Construct workspace URL
    const workspaceUrl = `https://${order.pod_id}-8080.proxy.runpod.net/`

    const telemetry = {
      runtime_status: podJson.desiredStatus || "unknown",
      uptime_seconds: uptimeSeconds,
      gpu_type: podJson.gpuName || podJson.gpuTypeId || "N/A",
      volume_size_gb: volJson.size || 0,
      workspace_url: workspaceUrl,
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
