import { NextRequest, NextResponse } from "next/server"

const RUNPOD_GRAPHQL_ENDPOINT = "https://api.runpod.io/graphql"

const GPU_AVAILABILITY_QUERY = `
  query GpuTypes($dataCenterId: String!) {
    gpuTypes {
      id
      displayName
      memoryInGb
      lowestPrice(input: { dataCenterId: $dataCenterId, gpuCount: 1 }) {
        stockStatus
      }
    }
  }
`

const VISIBLE_STOCK_STATUSES = new Set([
  "AVAILABLE",
  "HIGH",
  "MEDIUM",
  "LOW",
  "VERY_LOW",
  "LIMITED",
  "SPOT",
  "IN_STOCK",
])

type GpuType = {
  id: string
  displayName: string
  memoryInGb: number | null
  stockStatus: string
}

type GraphQLError = { message?: string }
type GraphQLResponse = {
  data?: {
    gpuTypes?: Array<{
      id: string
      displayName: string
      memoryInGb: number | null
      lowestPrice?: { stockStatus?: string } | null
    }>
  }
  errors?: GraphQLError[]
}

function shouldInclude(status: string) {
  const normalized = status.toUpperCase().replace(/\s+/g, "_")
  if (!normalized) return false
  if (VISIBLE_STOCK_STATUSES.has(normalized)) return true
  if (normalized.startsWith("AVAILABLE")) return true
  const keywords = ["SPOT", "LOW", "MEDIUM", "HIGH", "LIMITED", "RESERVE"]
  return keywords.some((keyword) => normalized.includes(keyword))
}

export async function GET(req: NextRequest) {
  const dataCenterId = req.nextUrl.searchParams.get("dataCenterId")
  if (!dataCenterId) {
    return NextResponse.json(
      { ok: false, error: "Missing dataCenterId query parameter" },
      { status: 400 }
    )
  }

  const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY
  if (!RUNPOD_API_KEY) {
    return NextResponse.json(
      { ok: false, error: "RUNPOD_API_KEY is not configured" },
      { status: 500 }
    )
  }

  try {
    const response = await fetch(
      `${RUNPOD_GRAPHQL_ENDPOINT}?api_key=${RUNPOD_API_KEY}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          query: GPU_AVAILABILITY_QUERY,
          variables: { dataCenterId },
        }),
      }
    )

    const json = (await response.json().catch(() => ({}))) as GraphQLResponse

    if (!response.ok || json.errors) {
      const errMsg =
        json?.errors?.map((e) => e.message).filter(Boolean).join("; ") ||
        `RunPod query failed with status ${response.status}`
      return NextResponse.json(
        { ok: false, error: errMsg },
        { status: 502 }
      )
    }

    const gpus: GpuType[] =
      json.data?.gpuTypes?.map((gpu) => ({
        id: gpu.id,
        displayName: gpu.displayName,
        memoryInGb: gpu.memoryInGb,
        stockStatus: gpu.lowestPrice?.stockStatus || "UNKNOWN",
      })) || []

    const filtered = gpus.filter((gpu) => shouldInclude(gpu.stockStatus))

    return NextResponse.json({ ok: true, gpus: filtered })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch RunPod GPU data"
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    )
  }
}
