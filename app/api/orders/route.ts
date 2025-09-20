import { NextResponse } from "next/server"
import { getSupabaseClient } from "../../../lib/supabaseClient"

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

export async function POST(req: Request) {
  try {
    const supabase = getSupabaseClient()
    const { userId, datacenter_id, storage_gb, gpu_type, name } = await req.json()

    // 1) Insert order
    const { data: order, error: insertError } = await supabase
      .from("orders")
      .insert({
        user_id: userId,
        name,
        datacenter_id,
        storage_gb,
        gpu_type,
        status: "provisioning",
      })
      .select()
      .single()
    if (insertError) throw new Error("Supabase insert error: " + insertError.message)

    // 2) Create network volume
    const createVolBody = { name, size: storage_gb, dataCenterId: datacenter_id }
    const volResp = await fetch("https://rest.runpod.io/v1/networkvolumes", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RUNPOD_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(createVolBody),
    })

    if (!volResp.ok) {
      const body = await volResp.text()
      throw new Error("Failed to create volume: " + body)
    }

    const volJson = await volResp.json()
    const volumeId = volJson?.id
    if (!volumeId) throw new Error("No volumeId in response: " + JSON.stringify(volJson))

    // 3) Deploy pod
    const finalGpuTypeId = normalizeGpuType(gpu_type)
    const query = `
      mutation podFindAndDeployOnDemand($input: PodFindAndDeployOnDemandInput) {
        podFindAndDeployOnDemand(input: $input) {
          id
          desiredStatus
        }
      }
    `
    const variables = {
      input: {
        cloudType: "ALL",
        gpuCount: 1,
        gpuTypeId: finalGpuTypeId,
        name,
        imageName: "ghcr.io/andrewabbey-art/arion_flow:0.3",
        ports: "8888/http,22/tcp",
        networkVolumeId: volumeId,
        volumeMountPath: "/workspace",
        containerDiskInGb: 20,
      },
    }

    const podResp = await fetch("https://api.runpod.io/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RUNPOD_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables }),
    })

    const podJson = await podResp.json()
    if (podJson?.errors?.length) {
      throw new Error("GraphQL error: " + JSON.stringify(podJson.errors))
    }

    const podId = podJson?.data?.podFindAndDeployOnDemand?.id
    if (!podId) throw new Error("Failed to create pod: " + JSON.stringify(podJson))

    const workspaceUrl = `https://${podId}.runpod.net`

    // 4) Update Supabase
    const { error: updateError } = await supabase
      .from("orders")
      .update({
        status: "active",
        pod_id: podId,
        volume_id: volumeId,
        workspace_url: workspaceUrl,
      })
      .eq("id", order.id)
    if (updateError) throw new Error("Supabase update error: " + updateError.message)

    // 5) Return response
    return NextResponse.json({
      ok: true,
      orderId: order.id,
      podId,
      volumeId,
      workspaceUrl,
    })
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error("Provisioning error:", err.message)
      return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
    }
    console.error("Unknown provisioning error:", err)
    return NextResponse.json({ ok: false, error: "Unknown error occurred" }, { status: 500 })
  }
}