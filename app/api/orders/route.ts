import { NextResponse } from "next/server";
import { supabase } from "../../../lib/supabaseClient";

function normalizeGpuType(input?: string): string {
  if (!input) return "NVIDIA GeForce RTX 4090";
  const trimmed = input.trim();

  // Map common shorthands to official display names used by RunPod APIs
  const map: Record<string, string> = {
    "RTX 4090": "NVIDIA GeForce RTX 4090",
    "4090": "NVIDIA GeForce RTX 4090",
    "NVIDIA RTX 4090": "NVIDIA GeForce RTX 4090",
  };

  return map[trimmed] || trimmed;
}

export async function POST(req: Request) {
  try {
    const { userId, datacenter_id, storage_gb, gpu_type, name } = await req.json();

    // 1) Insert order (Supabase)
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

    // 2) Create Network Volume (REST) — required fields: { name, size, dataCenterId }
    const createVolBody = {
      name,
      size: storage_gb,           // integer GB
      dataCenterId: datacenter_id // e.g., "EU-RO-1" or "EUR-IS-1"
    };
    console.log("REST Create Volume ->", JSON.stringify(createVolBody));

    const volResp = await fetch("https://rest.runpod.io/v1/networkvolumes", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RUNPOD_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(createVolBody),
    });

    const volRaw = await volResp.text();
    console.log("REST Create Volume <-", volResp.status, volRaw);
    if (!volResp.ok) throw new Error("Failed to create volume: " + volRaw);

    const volJson = JSON.parse(volRaw);
    const volumeId = volJson?.id;
    if (!volumeId) throw new Error("No volumeId in response: " + JSON.stringify(volJson));

    // (Optional) 2b) Confirm volume DC for logs
    const volInfoRes = await fetch(`https://rest.runpod.io/v1/networkvolumes/${volumeId}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${process.env.RUNPOD_API_KEY}` },
    });
    const volInfoRaw = await volInfoRes.text();
    console.log("REST Get Volume <-", volInfoRes.status, volInfoRaw);

    // 3) Deploy Pod (GraphQL) — image-only; attach volume
    // Normalize GPU name to the exact display name required by the API.
    const finalGpuTypeId = normalizeGpuType(gpu_type);

    // GraphQL mutation with variables (no string interpolation)
    const query = `
      mutation podFindAndDeployOnDemand($input: PodFindAndDeployOnDemandInput) {
        podFindAndDeployOnDemand(input: $input) {
          id
          desiredStatus
        }
      }
    `;

    const variables = {
      input: {
        cloudType: "ALL",               // or "SECURE" if you want to limit
        gpuCount: 1,
        gpuTypeId: finalGpuTypeId,      // must match display name, e.g., "NVIDIA GeForce RTX 4090"
        name,
        imageName: "ghcr.io/andrewabbey-art/arion_flow:0.3",
        ports: "8888/http,22/tcp",      // ports is a single comma-separated string
        networkVolumeId: volumeId,
        volumeMountPath: "/workspace",
        containerDiskInGb: 20           // modest local container disk to reduce disk-fit failures
      },
    };

    console.log("GraphQL -> Headers:", {
      Authorization: `Bearer ${process.env.RUNPOD_API_KEY ? "****" : "(missing)"}`,
      "Content-Type": "application/json",
    });
    console.log("GraphQL -> Payload:", JSON.stringify({ query, variables }));

    const podResp = await fetch("https://api.runpod.io/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RUNPOD_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables }),
    });

    const podRaw = await podResp.text();
    console.log("GraphQL <-", podResp.status, podRaw);

    let podJson: any;
    try {
      podJson = JSON.parse(podRaw);
    } catch {
      throw new Error("Non-JSON GraphQL response: " + podRaw);
    }

    if (podJson?.errors?.length) {
      // Most common cause: gpuTypeId string not matching the official display name
      throw new Error("GraphQL error: " + JSON.stringify(podJson.errors));
    }

    const podId = podJson?.data?.podFindAndDeployOnDemand?.id;
    if (!podId) {
      throw new Error("Failed to create pod: " + JSON.stringify(podJson));
    }

    const workspaceUrl = `https://${podId}.runpod.net`;

    // 4) Update order (Supabase)
    const { error: updateError } = await supabase
      .from("orders")
      .update({
        status: "active",
        pod_id: podId,
        volume_id: volumeId,
        workspace_url: workspaceUrl,
      })
      .eq("id", order.id);
    if (updateError) throw new Error("Supabase update error: " + updateError.message);

    // 5) Return result
    return NextResponse.json({
      ok: true,
      orderId: order.id,
      podId,
      volumeId,
      workspaceUrl,
    });
  } catch (err: any) {
    console.error("Provisioning error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}