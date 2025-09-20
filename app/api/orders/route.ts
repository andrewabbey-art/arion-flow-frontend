import { NextResponse } from "next/server";
import { getSupabaseClient } from "../../../lib/supabaseClient";

// Minimal types for responses to avoid `any`
type NetworkVolumeCreateResponse = {
  id: string;
  [k: string]: unknown;
};

type PodCreateResponse = {
  id: string;
  [k: string]: unknown;
};

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
    // 0) Env validation
    const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
    const RUNPOD_REGISTRY_AUTH_ID = process.env.RUNPOD_REGISTRY_AUTH_ID;

    if (!RUNPOD_API_KEY) {
      throw new Error("Missing RUNPOD_API_KEY env var.");
    }
    if (!RUNPOD_REGISTRY_AUTH_ID) {
      throw new Error("Missing RUNPOD_REGISTRY_AUTH_ID env var.");
    }

    // 1) Parse request body
    const {
      userId,
      datacenter_id, // e.g., "US-IL-1"
      storage_gb,    // e.g., 40
      gpu_type,      // e.g., "NVIDIA GeForce RTX 4090"
      name,          // Resource name
    }: {
      userId: string;
      datacenter_id: string;
      storage_gb: number;
      gpu_type?: string;
      name: string;
    } = await req.json();

    // 2) Insert order (Supabase)
    const supabase = getSupabaseClient();
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
    if (!order) {
      throw new Error("Supabase insert returned no row.");
    }

    // 3) Create network volume via REST
    // POST /v1/networkvolumes: name, size, dataCenterId. [[RunPod REST](https://rest.runpod.io/v1/openapi.json)]
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

    const volText = await volResp.text();
    if (!volResp.ok) {
      throw new Error("Failed to create volume: " + volText);
    }

    let volJson: NetworkVolumeCreateResponse;
    try {
      volJson = JSON.parse(volText) as NetworkVolumeCreateResponse;
    } catch {
      throw new Error("Invalid JSON from volume create: " + volText);
    }

    const volumeId = volJson.id;
    if (!volumeId) {
      throw new Error("No volumeId in response: " + volText);
    }

    // 4) Create Pod via REST (supports containerRegistryAuthId). [[RunPod REST](https://rest.runpod.io/v1/openapi.json)]
    const finalGpuTypeId = normalizeGpuType(gpu_type);
    const podCreateBody = {
      cloudType: "SECURE",
      computeType: "GPU",
      gpuCount: 1,
      gpuTypeIds: [finalGpuTypeId],
      imageName: "ghcr.io/andrewabbey-art/arion_flow:0.3",
      name,
      ports: ["8888/http", "22/tcp"],
      containerDiskInGb: 20,
      networkVolumeId: volumeId,
      volumeMountPath: "/workspace",
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
      throw new Error("Pod create failed: " + podText);
    }

    let podJson: PodCreateResponse;
    try {
      podJson = JSON.parse(podText) as PodCreateResponse;
    } catch {
      throw new Error("Invalid JSON from Pod create: " + podText);
    }

    const podId = podJson.id;
    if (!podId) {
      throw new Error("No pod id in response: " + podText);
    }

    // Public proxy URL format for exposed services on Pods. [[Pods overview](https://docs.runpod.io/pods/overview#connecting-to-your-pod)]
    const workspaceUrl = `https://${podId}.runpod.net`;

    // 5) Update order (Supabase)
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

    // 6) Return success
    return NextResponse.json({
      ok: true,
      orderId: order.id,
      podId,
      volumeId,
      workspaceUrl,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown error occurred";
    console.error("Provisioning error:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
