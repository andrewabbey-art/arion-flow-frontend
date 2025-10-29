// Orders (route.ts)
import { NextRequest, NextResponse } from "next/server"
import { getSupabaseClient } from "../../../lib/supabaseClient"

type PodCreateResponse = { id: string; [k: string]: unknown }
type PodStatusResponse = { id: string; desiredStatus: string; [k: string]: unknown }

// ✅ Persistent Model Repo volume
const PERSISTENT_VOLUME_ID = "1unn2ajse8"

const SUPPORTED_DATACENTERS = ["EUR-IS-1", "EU-RO-1", "EU-CZ-1", "US-KS-2", "US-CA-2"]

function normalizeGpuType(input?: string): string {
  if (!input) return "NVIDIA GeForce RTX 4090"
  const trimmed = input.trim()
  const map: Record<string, string> = {
    "Budget — RTX A4000 (16GB)": "NVIDIA RTX A4000",
    "RTX A4000": "NVIDIA RTX A4000",
    "Starter — RTX 3090 / L4 (24GB)": "NVIDIA GeForce RTX 3090",
    "RTX 3090": "NVIDIA GeForce RTX 3090",
    "L4": "NVIDIA L4",
    "Creator — RTX 4090 / L40S (24–48GB)": "NVIDIA GeForce RTX 4090",
    "RTX 4090": "NVIDIA GeForce RTX 4090",
    "L40S": "NVIDIA L40S",
    "Studio — A40 / A6000 / RTX 6000 Ada (48GB)": "NVIDIA A40",
    "A40": "NVIDIA A40",
    "A6000": "NVIDIA RTX A6000",
    "RTX 6000 Ada": "NVIDIA RTX 6000 Ada Generation",
    "Pro — A100 (80GB)": "NVIDIA A100 80GB PCIe",
    "A100": "NVIDIA A100 80GB PCIe",
    "A100 PCIe": "NVIDIA A100 80GB PCIe",
    "A100 SXM": "NVIDIA A100-SXM4-80GB",
    "Enterprise — H100 / H200 (80–141GB)": "NVIDIA H100 PCIe",
    "H100": "NVIDIA H100 PCIe",
    "H100 PCIe": "NVIDIA H100 PCIe",
    "H100 SXM": "NVIDIA H100 80GB HBM3",
    "H100 NVL": "NVIDIA H100 NVL",
    "H200": "NVIDIA H200",
  }
  return map[trimmed] || trimmed
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseClient()

    const authHeader = req.headers.get("authorization")
    if (!authHeader) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 })

    const token = authHeader.match(/^Bearer\s+(.+)$/i)?.[1]?.trim()
    if (!token) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 })

    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 })

    const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY
    const RUNPOD_REGISTRY_AUTH_ID = process.env.RUNPOD_REGISTRY_AUTH_ID
    if (!RUNPOD_API_KEY || !RUNPOD_REGISTRY_AUTH_ID)
      throw new Error("Missing required RUNPOD environment variables.")

    const { datacenter_id, storage_gb, gpu_type, name }: {
      datacenter_id: string
      storage_gb: number
      gpu_type?: string
      name: string
    } = await req.json()

    if (!SUPPORTED_DATACENTERS.includes(datacenter_id)) {
      return NextResponse.json({ ok: false, error: `Region ${datacenter_id} not supported.` }, { status: 400 })
    }

    // 1️⃣ Record order in DB
    const { data: order, error: insertError } = await supabase
      .from("orders")
      .insert({
        user_id: user.id,
        name,
        datacenter_id,
        storage_gb,
        gpu_type: gpu_type || "NVIDIA GeForce RTX 4090",
        status: "pending",
      })
      .select()
      .single()
    if (insertError) throw new Error("Supabase insert error: " + insertError.message)
    if (!order) throw new Error("Supabase insert returned no row.")

    // 2️⃣ Create Pod using persistent volume
    const finalGpuTypeId = normalizeGpuType(gpu_type)
    const podResp = await fetch("https://rest.runpod.io/v1/pods", {
      method: "POST",
      headers: { Authorization: `Bearer ${RUNPOD_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        cloudType: "SECURE",
        computeType: "GPU",
        gpuCount: 1,
        gpuTypeIds: [finalGpuTypeId],
        imageName: "ghcr.io/andrewabbey-art/arion_flow:0.5",
        name,
        ports: ["8080/http", "22/tcp"],
        containerDiskInGb: 20,
        networkVolumeId: PERSISTENT_VOLUME_ID,
        volumeMountPath: "/workspace/models", // ✅ consistent mount path for shared repo
        containerRegistryAuthId: RUNPOD_REGISTRY_AUTH_ID,
      }),
    })

    const podText = await podResp.text()
    if (!podResp.ok) {
      await supabase.from("orders").update({
        status: "failed",
        failure_reason: "Pod creation failed: " + podText,
      }).eq("id", order.id)
      throw new Error("Pod creation failed: " + podText)
    }

    const podJson = JSON.parse(podText) as PodCreateResponse
    const podId = podJson.id
    if (!podId) throw new Error("No pod id in response: " + podText)

    // 3️⃣ Poll for RUNNING state
    let podReady = false
    for (let i = 0; i < 12; i++) {
      await new Promise((r) => setTimeout(r, 5000))
      const statusResp = await fetch(`https://rest.runpod.io/v1/pods/${podId}`, {
        headers: { Authorization: `Bearer ${RUNPOD_API_KEY}` },
      })
      const statusJson = (await statusResp.json()) as PodStatusResponse
      if (statusJson.desiredStatus === "RUNNING") {
        podReady = true
        break
      }
    }

    if (!podReady) {
      await supabase.from("orders").update({
        status: "failed",
        failure_reason: "Pod did not reach RUNNING state",
      }).eq("id", order.id)
      return NextResponse.json({ ok: false, error: "Pod failed to start" }, { status: 500 })
    }

    const workspaceUrl = `https://${podId}.runpod.net`

    // 4️⃣ Update DB
    const { error: updateError } = await supabase
      .from("orders")
      .update({
        status: "running",
        pod_id: podId,
        volume_id: PERSISTENT_VOLUME_ID,
        workspace_url: workspaceUrl,
      })
      .eq("id", order.id)
    if (updateError) throw new Error("Supabase update error: " + updateError.message)

    return NextResponse.json({
      ok: true,
      orderId: order.id,
      podId,
      volumeId: PERSISTENT_VOLUME_ID,
      workspaceUrl,
      podReady,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("Provisioning error:", message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
