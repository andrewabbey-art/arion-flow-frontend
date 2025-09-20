import { NextRequest, NextResponse } from "next/server"
import { getSupabaseClient } from "../../../../../lib/supabaseClient"

const RUNPOD_GRAPHQL_ENDPOINT = "https://api.runpod.io/graphql"

const POD_QUERY = `
  query Pod($podId: String!) {
    pod(input: { podId: $podId }) {
      id
      name
      gpuCount
      imageName
      desiredStatus
      machine {
        gpuName
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

type RunpodGpu = {
  id: string
  gpuUtilPercent: number
  memoryUtilPercent: number
}

type RunpodContainer = {
  cpuPercent: number | null
  memoryPercent: number | null
}

type RunpodPort = {
  ip: string
  isIpPublic: boolean
  privatePort: number
  publicPort: number
  type: string
}

type RunpodPod = {
  id: string
  name: string
  imageName: string
  desiredStatus: string
  gpuCount: number
  machine?: { gpuName: string }
  runtime: {
    uptimeInSeconds: number
    gpus: RunpodGpu[]
    container: RunpodContainer
    ports: RunpodPort[]
  }
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const supabase = getSupabaseClient()

    const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY
    if (!RUNPOD_API_KEY) {
      throw new Error("Missing RUNPOD_API_KEY env var.")
    }

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

    const gqlResp = await fetch(RUNPOD_GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${RUNPOD_API_KEY}`,
      },
      body: JSON.stringify({
        query: POD_QUERY,
        variables: { podId: order.pod_id },
      }),
    })

    const gqlJson = await gqlResp.json()
    if (!gqlResp.ok || gqlJson.errors) {
      const errMsg =
        gqlJson?.errors?.map((e: { message: string }) => e.message).join("; ") ||
        `GraphQL error (status ${gqlResp.status})`
      return NextResponse.json({ ok: false, error: errMsg }, { status: 502 })
    }

    const pod: RunpodPod | null = gqlJson?.data?.pod
    if (!pod) {
      return NextResponse.json(
        { ok: false, error: "Pod not found" },
        { status: 404 }
      )
    }

    const telemetry = {
      pod_id: pod.id,
      desired_status: pod.desiredStatus,
      gpu_count: pod.gpuCount,
      gpu_type: pod.machine?.gpuName ?? "Unknown",
      uptime_seconds: pod.runtime?.uptimeInSeconds ?? 0,
      gpu_metrics:
        pod.runtime?.gpus.map((g) => ({
          id: g.id,
          gpu_util_percent: g.gpuUtilPercent,
          memory_util_percent: g.memoryUtilPercent,
        })) ?? [],
      container_metrics: {
        cpu_percent: pod.runtime?.container?.cpuPercent ?? null,
        memory_percent: pod.runtime?.container?.memoryPercent ?? null,
      },
      ports:
        pod.runtime?.ports.map((p) => ({
          ip: p.ip,
          is_ip_public: p.isIpPublic,
          private_port: p.privatePort,
          public_port: p.publicPort,
          type: p.type,
        })) ?? [],
      workspace_url: `https://${order.pod_id}-8080.proxy.runpod.net/`,
    }

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
