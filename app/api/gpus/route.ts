import { NextRequest, NextResponse } from "next/server"

const RUNPOD_GRAPHQL_ENDPOINT = "https://api.runpod.io/graphql"

const GPU_AVAILABILITY_QUERY = `
  query AvailableGpuTypes($dataCenterId: String!) {
    availableGpuTypes(input: { dataCenterId: $dataCenterId }) {
      id
      displayName
      memoryInGb
      stockStatus
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
  data?: unknown
  errors?: GraphQLError[]
}

function extractGpuTypes(payload: unknown): GpuType[] {
  if (!payload) return []
  if (Array.isArray(payload)) {
    const typed = payload.filter((item): item is GpuType => {
      if (!item || typeof item !== "object") return false
      const maybe = item as Record<string, unknown>
      return typeof maybe.id === "string" && typeof maybe.displayName === "string"
    })
    if (typed.length > 0) {
      return typed.map((gpu) => ({
        id: gpu.id,
        displayName: gpu.displayName,
        memoryInGb: typeof gpu.memoryInGb === "number" ? gpu.memoryInGb : null,
        stockStatus:
          typeof gpu.stockStatus === "string" ? gpu.stockStatus : "UNKNOWN",
      }))
    }
    return []
  }

  if (typeof payload === "object") {
    for (const value of Object.values(payload)) {
      const result = extractGpuTypes(value)
      if (result.length > 0) return result
    }
  }

  return []
}

function shouldInclude(status: string) {
  const normalized = status.toUpperCase().replace(/\s+/g, "_")
  if (!normalized) return false
  if (VISIBLE_STOCK_STATUSES.has(normalized)) return true
  if (normalized.startsWith("AVAILABLE")) return true
  const keywords = ["SPOT", "LOW", "MEDIUM", "HIGH", "LIMITED", "RESERVE"]
  if (keywords.some((keyword) => normalized.includes(keyword))) return true
  return false
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
    const response = await fetch(RUNPOD_GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${RUNPOD_API_KEY}`,
      },
      body: JSON.stringify({
        query: GPU_AVAILABILITY_QUERY,
        variables: { dataCenterId },
      }),
    })

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

    const rawGpus = extractGpuTypes(json.data)
    const filtered = rawGpus.filter((gpu) => shouldInclude(gpu.stockStatus))
    const normalized = filtered.map((gpu) => ({
      id: gpu.id,
      displayName: gpu.displayName,
      memoryInGb: gpu.memoryInGb,
      stockStatus: gpu.stockStatus,
    }))

    return NextResponse.json({ ok: true, gpus: normalized })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch RunPod GPU data"
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    )
  }
}
