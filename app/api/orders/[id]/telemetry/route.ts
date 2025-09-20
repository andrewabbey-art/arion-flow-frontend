import { NextRequest, NextResponse } from "next/server"
import { getSupabaseClient } from "../../../../../lib/supabaseClient"

type PodStatusResponse = {
  id: string
  desiredStatus: string
  gpuTypeId?: string
  runtime?: { uptimeInSeconds?: number }
}

type VolumeResponse = {
  id: string
  size: number
}

export async function GET(
  _req: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const { id } = context.params
    const supabase = getSupabaseClient()
    const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY
    if (!RUNPOD_API_KEY) {
      throw new Error("Missing RUNPOD_API_KEY env var.")
    }

    // 1) Lookup order
    const { data: order, error } = await supabase
      .from("orders")
      .select("id, pod_id, volume_id")
      .eq("id", id)
      .single()

    if (error || !order) {
      return NextResponse.json(
        { ok: false, error: "Order not found" },
        { status: 404 }
      )
    }

    // 2) Fetch pod info
    const podResp = await fetch(
      `https://rest.runpod.io/v1/pods/${order.pod_id}`,
      { headers: { Authorization: `Bearer ${RUNPOD_API_KEY}` } }
    )
    const podJson = (await podResp.json()) as PodStatusResponse

    // 3) Fetch volume info
    const volResp = await fetch(
      `https://rest.runpod.io/v1/networkvolumes/${order.volume_id}`,
      { headers: { Authorization: `Bearer ${RUNPOD_API_KEY}` } }
    )
    const volJson = (await volResp.json()) as VolumeResponse

    const telemetry = {
      runtime_status: podJson.desiredStatus || "unknown",
      uptime_seconds: podJson.runtime?.uptimeInSeconds || 0,
      gpu_type: podJson.gpuTypeId || "N/A",
      volume_size_gb: volJson.size || 0,
    }

    // 4) Update Supabase with latest telemetry
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
    const message =
      err instanceof Error ? err.message : "Unknown error occurred"
    console.error("Telemetry error:", message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
