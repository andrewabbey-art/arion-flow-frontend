import { NextRequest, NextResponse } from "next/server"
import { getSupabaseClient } from "../../../../../lib/supabaseClient"

const RUNPOD_GRAPHQL_ENDPOINT = "https://api.runpod.io/graphql"

const POD_QUERY = `
  query Pod($podId: String!) {
    pod(input: { podId: $podId }) {
      id
      gpuCount
      desiredStatus
      machine {
        gpuType
      }
      runtime {
        uptimeInSeconds
        gpus {
          id
          gpuUtilPercent
          memoryUtilPercent
        }
        container {
          cpuPercent
          memoryPercent
        }
        ports {
          ip
          isIpPublic
          privatePort
          publicPort
          type
        }
      }
    }
  }
`

// Strong types for schema objects
type RunpodGpu = {
  id: string
  gpuUtilPercent: number
  memoryUtilPercent: number
}

type RunpodPort = {
  ip: string
  isIpPublic: boolean
  privatePort: number
  publicPort: number
  type: string
}

type RunpodContainer = {
  cpuPercent: number | null
  memoryPercent: number | null
}

type RunpodPod = {
  id: string
  gpuCount: number
  desiredStatus: string
  machine?: { gpuType: string }
  runtime?: {
    uptimeInSeconds?: number
    gpus?: RunpodGpu[]
    container?: RunpodContainer
    ports?: RunpodPort[]
  }
}

// Utility to enforce timeout
function withTimeout<T>(p: Promise<T>, ms: number) {
  return Promise.race([
    p,
    new Promise<never>((_, rej) =>
      setTimeout(() => rej(new Error(`Request timed out after ${ms} ms`)), ms)
    ),
  ])
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const supabase = getSupabaseClient()

    const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY
    if (!RUNPOD_API_KEY) throw new Error("Missing RUNPOD_API_KEY env var.")

    // Look up order
    const { data: order, error } = await supabase
      .from("orders")
      .select("id, pod_id, volume_id")
      .eq("id", id)
      .single()

    if (error || !order?.pod_id) {
      return NextResponse.json(
        { ok: false, error: "Order not found or missing pod_id" },
        { status: 404 }
      )
    }

    // Call RunPod GraphQL
    const gqlResp = await withTimeout(
      fetch(RUNPOD_GRAPHQL_ENDPOINT, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${RUNPOD_API_KEY}`,
        },
        body: JSON.stringify({
          query: POD_QUERY,
          variables: { podId: order.pod_id },
        }),
      }),
      15000
    )

    const gqlJson = await gqlResp.json().catch(() => ({}))
    if (!gqlResp.ok || gqlJson.errors) {
      const errMsg =
        gqlJson?.errors?.map((e: { message: string }) => e.message).join("; ") ||
        `GraphQL error (status ${gqlResp.status})`
      console.error("GraphQL telemetry error:", errMsg, "resp:", JSON.stringify(gqlJson))
      return NextResponse.json({ ok: false, error: errMsg }, { status: 502 })
    }

    const pod: RunpodPod | null = gqlJson?.data?.pod
    if (!pod) {
      return NextResponse.json(
        { ok: false, error: "Pod not found" },
        { status: 404 }
      )
    }

    // Build telemetry response
    const telemetry = {
      pod_id: pod.id,
      desired_status: pod.desiredStatus,
      gpu_count: pod.gpuCount,
      gpu_type: pod.machine?.gpuType ?? "Unknown",
      uptime_seconds: pod.runtime?.uptimeInSeconds ?? 0,
      gpu_metrics: (pod.runtime?.gpus ?? []).map((g: RunpodGpu) => ({
        id: g.id,
        gpu_util_percent: g.gpuUtilPercent,
        memory_util_percent: g.memoryUtilPercent,
      })),
      container_metrics: {
        cpu_percent: pod.runtime?.container?.cpuPercent ?? null,
        memory_percent: pod.runtime?.container?.memoryPercent ?? null,
      },
      ports: (pod.runtime?.ports ?? []).map((p: RunpodPort) => ({
        ip: p.ip,
        is_ip_public: p.isIpPublic,
        private_port: p.privatePort,
        public_port: p.publicPort,
        type: p.type,
      })),
      workspace_url: `https://${order.pod_id}-8080.proxy.runpod.net/`,
    }

    // Persist status back to Supabase
    await supabase
      .from("orders")
      .update({
        runtime_status: telemetry.desired_status,
        uptime_seconds: telemetry.uptime_seconds,
        workspace_url: telemetry.workspace_url,
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
