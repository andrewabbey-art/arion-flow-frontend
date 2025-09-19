import { NextResponse } from "next/server"
import { supabase } from "../../../lib/supabaseClient"

export async function POST(req: Request) {
  try {
    const { userId } = await req.json()

    // 1. Call RunPod API to deploy a pod
    const deployResp = await fetch("https://api.runpod.io/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RUNPOD_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `
          mutation {
            podFindAndDeployOnDemand(
              input: {
                cloudType: ALL,
                gpuCount: 1,
                gpuTypeId: "NVIDIA-RTX4090",
                name: "arion-flow-${userId}",
                imageName: "ghcr.io/andrewabbey-art/arion_flow:0.3",
                ports: [ { port: 3000, isUdp: false } ]
              }
            ) {
              id
              desiredStatus
            }
          }
        `,
      }),
    }).then((r) => r.json())

    const podId = deployResp.data?.podFindAndDeployOnDemand?.id
    if (!podId) {
      throw new Error("Failed to create pod: " + JSON.stringify(deployResp))
    }

    // 2. Construct workspace URL (RunPod proxy)
    const workspaceUrl = `https://${podId}-3000.proxy.runpod.net`

    // 3. Update Supabase user record
    const { error: dbError } = await supabase
      .from("users")
      .update({ status: "active", workspace_url: workspaceUrl })
      .eq("id", userId)

    if (dbError) {
      throw new Error("Supabase update error: " + dbError.message)
    }

    return NextResponse.json({ ok: true, podId, workspaceUrl })
  } catch (err: any) {
    console.error(err)
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
