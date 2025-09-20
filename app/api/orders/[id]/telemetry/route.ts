// app/api/orders/[id]/telemetry/route.ts
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

    // Lookup order to get pod_id and volume_id
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

    // Call RunPod GraphQL API
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
        gqlJson?.errors?.map((e: any) => e.message).join("; ") ||
        `GraphQL error (status ${gqlResp.status})`
      return NextResponse.json({ ok: false, error: errMsg }, { status: 502 })
    }

    const pod = gqlJson?.data?.pod
    if (!pod) {
      return NextResponse.json(
        { ok: false, error: "Pod not found" },
        { status: 404 }
      )
    }

    // Build telemetry object
    const telemetry = {
      pod_id: pod.id,
      name: pod.name,
      image: pod.imageName,
      desired_status: pod.desiredStatus,
      gpu_count: pod.gpuCount,
      uptime_seconds: pod.runtime?.uptimeInSeconds ?? 0,
      gpu_metrics: (pod.runtime?.gpus ?? []).map((g: any) => ({
        id: g.id,
        gpu_util_percent: g.gpuUtilPercent,
        memory_util_percent: g.memoryUtilPercent,
      })),
      container_metrics: {
        cpu_percent: pod.runtime?.container?.cpuPercent ?? null,
        memory_percent: pod.runtime?.container?.memoryPercent ?? null,
      },
      ports: (pod.runtime?.ports ?? []).map((p: any) => ({
        ip: p.ip,
        is_ip_public: p.isIpPublic,
        private_port: p.privatePort,
        public_port: p.publicPort,
        type: p.type,
      })),
      // Assumes you always expose ComfyUI on port 8080
      workspace_url: `https://${order.pod_id}-8080.proxy.runpod.net/`,
    }

    // Persist latest status + uptime to DB (optional)
    await supabase
      .from("orders")
      .update({
        runtime_status: telemetry.desired_status,
        uptime_seconds: telemetry.uptime_seconds,
        last_checked: new Date().toISOString(),
        workspace_url: telemetry.workspace_url,
      })
      .eq("id", order.id)

    return NextResponse.json({ ok: true, telemetry })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("Telemetry error:", message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
