import { NextRequest, NextResponse } from "next/server"
import { getSupabaseClient } from "../../../../../lib/supabaseClient"

const RUNPOD_GRAPHQL_ENDPOINT = "https://api.runpod.io/graphql"

const STOP_MUTATION = `
  mutation podStop($input: PodStopInput!) {
    podStop(input: $input) {
      id
      desiredStatus
    }
  }
`

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const supabase = getSupabaseClient()
    const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY
    if (!RUNPOD_API_KEY) throw new Error("Missing RUNPOD_API_KEY")

    const { data: order, error } = await supabase
      .from("orders")
      .select("id, pod_id")
      .eq("id", id)
      .single()

    if (error || !order?.pod_id) {
      return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 })
    }

    const gqlResp = await fetch(RUNPOD_GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${RUNPOD_API_KEY}`,
      },
      body: JSON.stringify({
        query: STOP_MUTATION,
        variables: { input: { podId: order.pod_id } },
      }),
    })

    const gqlJson = await gqlResp.json()
    if (!gqlResp.ok || gqlJson.errors) {
      const errMsg =
        gqlJson?.errors?.map((e: { message: string }) => e.message).join("; ") ||
        `GraphQL error (status ${gqlResp.status})`
      return NextResponse.json({ ok: false, error: errMsg }, { status: 502 })
    }

    return NextResponse.json({ ok: true, result: gqlJson.data.podStop })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
