// app/api/provision/route.ts (Next.js 13+ Route Handler)
import { NextResponse } from "next/server";
import { getSupabaseClient } from "../../../lib/supabaseClient";

function normalizeGpuType(input?: string): string {
  if (!input) return "NVIDIA GeForce RTX 4090";
  const trimmed = input.trim();
  const map: Record<string, string> = {
    "RTX 4090": "NVIDIA GeForce RTX 4090",
    "4090": "NVIDIA GeForce RTX 4090",
    "NVIDIA RTX 4090": "NVIDIA GeForce RTX 4090",
  };
  return map[trimmed] || trimmed;
}

export async function POST(req: Request) {
  try {
    // Validate required env vars
    const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
    const RUNPOD_REGISTRY_AUTH_ID = process.env.RUNPOD_REGISTRY_AUTH_ID;

    if (!RUNPOD_API_KEY) {
      throw new Error("Missing RUNPOD_API_KEY env var.");
    }
    if (!RUNPOD_REGISTRY_AUTH_ID) {
      throw new Error("Missing RUNPOD_REGISTRY_AUTH_ID env var.");
    }

    const supabase = getSupabaseClient();
    const {
      userId,
      datacenter_id, // e.g., "US-IL-1"
      storage_gb,    // e.g., 40
      gpu_type,      // e.g., "NVIDIA GeForce RTX 4090"
      name,          // Pod/volume name
    } = await req.json();

    // 1) Insert order row
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
      .single();
    if (insertError) {
      throw new Error("Supabase insert error: " + insertError.message);
    }

    // 2) Create network volume via REST
    // POST /v1/networkvolumes requires name, size, dataCenterId [[Network volumes](https://rest.runpod.io/v1/openapi.json)]
    const createVolBody = {
      name,
      size: storage_gb,
      dataCenterId: datacenter_id,
    };

    const volResp = await fetch("https://rest.runpod.io/v1/networkvolumes", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RUNPOD_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(createVolBody),
    });

    if (!volResp.ok) {
      const body = await volResp.text();
      throw new Error("Failed to create volume: " + body);
    }

    const volJson = await volResp.json();
    const volumeId = volJson?.id;
    if (!volumeId) {
      throw new Error("No volumeId in response: " + JSON.stringify(volJson));
    }

    // 3) Create Pod via REST (supports containerRegistryAuthId) [[Create Pod body](https://rest.runpod.io/v1/openapi.json)]
    const finalGpuTypeId = normalizeGpuType(gpu_type);

    const podCreateBody = {
      // Choose SECURE or COMMUNITY; SECURE is default in REST spec
      cloudType: "SECURE",
      computeType: "GPU",
      gpuCount: 1,
      gpuTypeIds: [finalGpuTypeId],
      imageName: "ghcr.io/andrewabbey-art/arion_flow:0.3",
      name,
      // Ports must be an array of strings in REST
      ports: ["8888/http", "22/tcp"],
      containerDiskInGb: 20,
      // Mount the volume we just created
      networkVolumeId: volumeId,
      volumeMountPath: "/workspace",
      // Pass your saved registry auth id so image pulls from GHCR are authenticated
      containerRegistryAuthId: RUNPOD_REGISTRY_AUTH_ID,
    };

    const podResp = await fetch("https://rest.runpod.io/v1/pods", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RUNPOD_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(podCreateBody),
    });

    const podText = await podResp.text();
    if (!podResp.ok) {
      // Surface full body for easier debugging (common when auth to registry fails)
      throw new Error("Pod create failed: " + podText);
    }

    let podJson: any;
    try {
      podJson = JSON.parse(podText);
    } catch {
      throw new Error("Invalid JSON from Pod create: " + podText);
    }

    const podId = podJson?.id;
    if (!podId) {
      throw new Error("No pod id in response: " + JSON.stringify(podJson));
    }

    const workspaceUrl = `https://${podId}.runpod.net`;

    // 4) Update Supabase with success details
    const { error: updateError } = await supabase
      .from("orders")
      .update({
        status: "active",
        pod_id: podId,
        volume_id: volumeId,
        workspace_url: workspaceUrl,
      })
      .eq("id", order.id);

    if (updateError) {
      throw new Error("Supabase update error: " + updateError.message);
    }

    // 5) Return success
    return NextResponse.json({
      ok: true,
      orderId: order.id,
      podId,
      volumeId,
      workspaceUrl,
    });
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error("Provisioning error:", err.message);
      return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
    }
    console.error("Unknown provisioning error:", err);
    return NextResponse.json({ ok: false, error: "Unknown error occurred" }, { status: 500 });
  }
}