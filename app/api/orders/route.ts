import { NextRequest, NextResponse } from "next/server"
import { getSupabaseClient } from "../../../lib/supabaseClient"

type NetworkVolumeCreateResponse = { id: string; [k: string]: unknown }
type PodCreateResponse = { id: string; [k: string]: unknown }
type PodStatusResponse = { id: string; desiredStatus: string; [k: string]: unknown }

function normalizeGpuType(input?: string): string {
  if (!input) return "NVIDIA GeForce RTX 4090"
  const trimmed = input.trim()
  const map: Record<string, string> = {
    "RTX 4090": "NVIDIA GeForce RTX 4090",
    "4090": "NVIDIA GeForce RTX 4090",
    "NVIDIA RTX 4090": "NVIDIA GeForce RTX 4090",
  }
  return map[trimmed] || trimmed
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseClient()

    // 🔐 Check for Authorization header
    const authHeader = req.headers.get("authorization")
    if (!authHeader) {
      return NextResponse.json(
        { ok: false, error: "Not authenticated" },
        { status: 401 }
      )
    }

    // Extract Bearer token
    const match = authHeader.match(/^Bearer\s+(.+)$/i)
    const token = match?.[1]?.trim()
    if (!token) {
      return NextResponse.json(
        { ok: false, error: "Not authenticated" },
        { status: 401 }
      )
    }

    // Validate user with the token
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token)
    if (userError || !user) {
      return NextResponse.json(
        { ok: false, error: "Not authenticated" },
        { status: 401 }
      )
    }

    // 🔑 Env vars
    const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY
    const RUNPOD_REGISTRY_AUTH_ID = process.env.RUNPOD_REGISTRY_AUTH_ID
    if (!RUNPOD_API_KEY) throw new Error("Missing RUNPOD_API_KEY env var.")
    if (!RUNPOD_REGISTRY_AUTH_ID) throw new Error("Missing RUNPOD_REGISTRY_AUTH_ID env var.")

    // 📦 Parse body
    const { datacenter_id, storage_gb, gpu_type, name }: {
      datacenter_id: string
      storage_gb: number
      gpu_type?: string
      name: string
    } = await req.json()

    // 1️⃣ Insert order into Supabase
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

    // 2️⃣ Create network volume
    const volResp = await fetch("https://rest.runpod.io/v1/networkvolumes", {
      method: "POST",
      headers: { Authorization: `Bearer ${RUNPOD_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name, size: storage_gb, dataCenterId: datacenter_id }),
    })
    const volText = await volResp.text()
    if (!volResp.ok) throw new Error("Failed to create volume: " + volText)
    const volJson = JSON.parse(volText) as NetworkVolumeCreateResponse
    const volumeId = volJson.id
    if (!volumeId) throw new Error("No volumeId in response: " + volText)

    // 3️⃣ Create pod
    const finalGpuTypeId = normalizeGpuType(gpu_type)
    const podResp = await fetch("https://rest.runpod.io/v1/pods", {
      method: "POST",
      headers: { Authorization: `Bearer ${RUNPOD_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        cloudType: "SECURE",
        computeType: "GPU",
        gpuCount: 1,
        gpuTypeIds: [finalGpuTypeId],
        imageName: "ghcr.io/andrewabbey-art/arion_flow:0.3",
        name,
        ports: ["8080/http", "22/tcp"],
        containerDiskInGb: 20,
        networkVolumeId: volumeId,
        volumeMountPath: "/workspace",
        containerRegistryAuthId: RUNPOD_REGISTRY_AUTH_ID,
      }),
    })
    const podText = await podResp.text()
    if (!podResp.ok) throw new Error("Pod create failed: " + podText)
    const podJson = JSON.parse(podText) as PodCreateResponse
    const podId = podJson.id
    if (!podId) throw new Error("No pod id in response: " + podText)

    // 4️⃣ Poll pod status until RUNNING
    let podReady = false
    for (let i = 0; i < 12; i++) {
      await new Promise((r) => setTimeout(r, 5000))
      const statusResp = await fetch(`https://rest.runpod.io/v1/pods/${podId}`, {
        headers: { Authorization: `Bearer ${RUNPOD_API_KEY}` },
      })
      const statusText = await statusResp.text()
      if (!statusResp.ok) continue
      const statusJson = JSON.parse(statusText) as PodStatusResponse
      if (statusJson.desiredStatus === "RUNNING") {
        podReady = true
        break
      }
    }

    const workspaceUrl = `https://${podId}.runpod.net`

    // 5️⃣ Update Supabase with pod + volume
    const { error: updateError } = await supabase
      .from("orders")
      .update({
        status: podReady ? "running" : "pending",
        pod_id: podId,
        volume_id: volumeId,
        workspace_url: workspaceUrl,
      })
      .eq("id", order.id)
    if (updateError) throw new Error("Supabase update error: " + updateError.message)

    return NextResponse.json({
      ok: true,
      orderId: order.id,
      podId,
      volumeId,
      workspaceUrl,
      podReady,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error occurred"
    console.error("Provisioning error:", message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
