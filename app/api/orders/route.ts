import { NextResponse } from "next/server";
import { getSupabaseClient } from "../../../lib/supabaseClient";

// Minimal types for responses
type NetworkVolumeCreateResponse = { id: string; [k: string]: unknown };
type PodCreateResponse = { id: string; [k: string]: unknown };
type PodStatusResponse = { id: string; desiredStatus: string; [k: string]: unknown };

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
    if (!RUNPOD_API_KEY) throw new Error("Missing RUNPOD_API_KEY env var.");
    if (!RUNPOD_REGISTRY_AUTH_ID) throw new Error("Missing RUNPOD_REGISTRY_AUTH_ID env var.");

    // 1) Parse request
    const { userId, datacenter_id, storage_gb, gpu_type, name }: {
      userId: string;
      datacenter_id: string;
      storage_gb: number;
      gpu_type?: string;
      name: string;
    } = await req.json();

    // 2) Insert order in Supabase
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
    if (insertError) throw new Error("Supabase insert error: " + insertError.message);
    if (!order) throw new Error("Supabase insert returned no row.");

    // 3) Create network volume
    const createVolBody = { name, size: storage_gb, dataCenterId: datacenter_id };
    const volResp = await fetch("https://rest.runpod.io/v1/networkvolumes", {
      method: "POST",
      headers: { Authorization: `Bearer ${RUNPOD_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(createVolBody),
    });
    const volText = await volResp.text();
    if (!volResp.ok) throw new Error("Failed to create volume: " + volText);

    const volJson = JSON.parse(volText) as NetworkVolumeCreateResponse;
    const volumeId = volJson.id;
    if (!volumeId) throw new Error("No volumeId in response: " + volText);

    // 4) Create pod
    const finalGpuTypeId = normalizeGpuType(gpu_type);
    const podCreateBody = {
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
    };

    const podResp = await fetch("https://rest.runpod.io/v1/pods", {
      method: "POST",
      headers: { Authorization: `Bearer ${RUNPOD_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(podCreateBody),
    });
    const podText = await podResp.text();
    if (!podResp.ok) throw new Error("Pod create failed: " + podText);

    const podJson = JSON.parse(podText) as PodCreateResponse;
    const podId = podJson.id;
    if (!podId) throw new Error("No pod id in response: " + podText);

    // 5) Poll for pod readiness (up to 60s)
    let podReady = false;
    for (let i = 0; i < 12; i++) { // 12 x 5s = 60s
      await new Promise((r) => setTimeout(r, 5000));

      const statusResp = await fetch(`https://rest.runpod.io/v1/pods/${podId}`, {
        headers: { Authorization: `Bearer ${RUNPOD_API_KEY}` },
      });
      const statusText = await statusResp.text();
      if (!statusResp.ok) continue;

      const statusJson = JSON.parse(statusText) as PodStatusResponse;
      if (statusJson.desiredStatus === "RUNNING") {
        podReady = true;
        break;
      }
    }

    const workspaceUrl = `https://${podId}.runpod.net`;

    // 6) Update Supabase
    const { error: updateError } = await supabase
      .from("orders")
      .update({
        status: podReady ? "active" : "provisioning",
        pod_id: podId,
        volume_id: volumeId,
        workspace_url: workspaceUrl,
      })
      .eq("id", order.id);
    if (updateError) throw new Error("Supabase update error: " + updateError.message);

    // 7) Return
    return NextResponse.json({ ok: true, orderId: order.id, podId, volumeId, workspaceUrl, podReady });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error occurred";
    console.error("Provisioning error:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
