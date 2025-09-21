import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "../../../../../lib/supabaseClient";

const RUNPOD_GRAPHQL_ENDPOINT = "https://api.runpod.io/graphql";
const RUNPOD_API_URL = "https://rest.runpod.io/v1"; // ✅ fixed to REST endpoint

const TERMINATE_MUTATION = `
  mutation podTerminate($input: PodTerminateInput!) {
    podTerminate(input: $input)
  }
`;

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { deleteWorkspace } = await req.json().catch(() => ({ deleteWorkspace: false }));

    const supabase = getSupabaseClient();
    const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
    if (!RUNPOD_API_KEY) throw new Error("Missing RUNPOD_API_KEY");

    // 1) Load order
    const { data: order, error } = await supabase
      .from("orders")
      .select("id, pod_id, volume_id")
      .eq("id", id)
      .single();

    if (error || !order?.pod_id) {
      return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });
    }

    // 2) Terminate Pod (GraphQL)
    const gqlResp = await fetch(RUNPOD_GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${RUNPOD_API_KEY}`,
      },
      body: JSON.stringify({
        query: TERMINATE_MUTATION,
        variables: { input: { podId: order.pod_id } },
      }),
    });

    const gqlJson = await gqlResp.json();
    if (!gqlResp.ok || gqlJson.errors) {
      const errMsg =
        gqlJson?.errors?.map((e: { message: string }) => e.message).join("; ") ||
        `GraphQL error (status ${gqlResp.status})`;
      return NextResponse.json({ ok: false, error: errMsg }, { status: 502 });
    }

    // 3) Optionally delete workspace volume
    let workspaceDeleted = false;
    if (deleteWorkspace && order.volume_id) {
      const vResp = await fetch(`${RUNPOD_API_URL}/networkvolumes/${order.volume_id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${RUNPOD_API_KEY}`,
          "Content-Type": "application/json",
        },
      });

      // ✅ accept both 200 + 204
      if ([200, 204].includes(vResp.status)) {
        workspaceDeleted = true;
      } else {
        const vText = await vResp.text();
        console.warn(`Failed to delete volume: ${vResp.status} - ${vText}`);
      }
    }

    // 4) Update DB lifecycle flags
    const { error: updateErr } = await supabase
      .from("orders")
      .update({
        status: "deleted",
        workspace_deleted: workspaceDeleted,
        volume_id: workspaceDeleted ? null : order.volume_id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateErr) {
      console.error("DB update error:", updateErr);
    }

    // 5) Return result
    return NextResponse.json({
      ok: true,
      deletedWorkspace: workspaceDeleted,
      result: gqlJson.data.podTerminate,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
