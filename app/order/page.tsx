"use client"

import { useEffect, useState } from "react"
import { getSupabaseClient } from "../../lib/supabaseClient"
import { useRouter } from "next/navigation"
import Card from "@/components/card"

// helper: generate 3 random words
function generateName() {
  const words = [
    "football", "pig", "house", "river", "cloud", "sky",
    "mountain", "banana", "train", "wolf", "rocket", "garden"
  ]
  const pick = () => words[Math.floor(Math.random() * words.length)]
  return `${pick()}-${pick()}-${pick()}`
}

type RunpodGpu = {
  id: string
  displayName: string
  memoryInGb: number | null
  stockStatus: string
}

function formatStockStatus(status: string) {
  if (!status) return "Unknown availability"
  return status
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export default function OrderPage() {
  const router = useRouter()
  const supabase = getSupabaseClient() // ✅ instantiate Supabase client
  const [datacenter, setDatacenter] = useState("EU-CZ-1")
  const [storage, setStorage] = useState(50)
  const [gpu, setGpu] = useState("")
  const [gpuOptions, setGpuOptions] = useState<RunpodGpu[]>([])
  const [isGpuLoading, setIsGpuLoading] = useState(false)
  const [gpuError, setGpuError] = useState<string | null>(null)
  const [message, setMessage] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    let isCurrent = true
    const controller = new AbortController()

    async function loadGpuOptions() {
      setIsGpuLoading(true)
      setGpuError(null)

      try {
        const resp = await fetch(
          `/api/runpod/gpus?dataCenterId=${encodeURIComponent(datacenter)}`,
          { signal: controller.signal }
        )

        type GpuApiResponse =
          | { ok: true; gpus: RunpodGpu[] }
          | { ok: false; error?: string }

        const payload = (await resp.json().catch(() => null)) as GpuApiResponse | null

        if (!isCurrent) return

        if (!resp.ok || !payload || payload.ok !== true) {
          const errorMessage =
            (payload && "error" in payload && payload.error) ||
            `Unable to load GPU options (status ${resp.status})`
          console.error("GPU availability fetch failed:", errorMessage)
          setGpuOptions([])
          setGpuError(errorMessage)
          return
        }

        setGpuOptions(payload.gpus)
      } catch (err) {
        if (!isCurrent) return
        if (err instanceof Error && err.name === "AbortError") return
        const message =
          err instanceof Error ? err.message : "Unexpected error fetching GPU availability"
        console.error("GPU availability error:", message)
        setGpuOptions([])
        setGpuError(message)
      } finally {
        if (isCurrent) setIsGpuLoading(false)
      }
    }

    loadGpuOptions()

    return () => {
      isCurrent = false
      controller.abort()
    }
  }, [datacenter])

  useEffect(() => {
    if (gpuOptions.length > 0) {
      setGpu(gpuOptions[0].id)
    } else {
      setGpu("")
    }
  }, [gpuOptions])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    setMessage("Submitting your order...")

    // 🔐 Ensure logged in
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      setMessage("You must be logged in to place an order.")
      router.push("/auth")
      setIsSubmitting(false)
      return
    }

    // 🔑 Get access token
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    const accessToken = session?.access_token
    if (sessionError || !accessToken) {
      setMessage("Unable to verify your session. Please sign in again.")
      router.push("/auth")
      setIsSubmitting(false)
      return
    }

    // 🚀 Call API
    const resp = await fetch("/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        name: generateName(),
        datacenter_id: datacenter,
        storage_gb: storage,
        gpu_type: gpu,
      }),
    })

    const data = await resp.json()
    if (!data.ok) {
      setMessage("❌ " + data.error)
      setIsSubmitting(false)
    } else {
      setMessage("✅ Order submitted successfully! Redirecting...")
      setTimeout(() => {
        router.push("/dashboard")
      }, 2000)
    }
  }

  const selectStyles =
    "w-full p-3 bg-background border border-border rounded-[var(--radius)] focus:outline-none focus:ring-2 focus:ring-secondary appearance-none"
  const labelStyles =
    "block text-sm font-semibold mb-2 text-foreground text-left"

  return (
    <div className="min-h-screen flex items-center justify-center bg-background/50 p-4 pt-20">
      <Card className="p-8 w-full max-w-lg">
        <h2 className="text-3xl font-bold mb-6 text-center text-primary">
          Configure Your Workspace
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Datacenter */}
          <div>
            <label htmlFor="datacenter" className={labelStyles}>
              Storage Location
            </label>
            <select
              id="datacenter"
              value={datacenter}
              onChange={(e) => setDatacenter(e.target.value)}
              className={selectStyles}
            >
              <option value="AP-JP-1">Japan (AP-JP-1)</option>
              <option value="CA-MTL-3">Canada (CA-MTL-3)</option>
              <option value="CA-MTL-4">Canada (CA-MTL-4)</option>
              <option value="EU-CZ-1">Europe (EU-CZ-1)</option>
              <option value="EU-RO-1">Europe (EU-RO-1, S3)</option>
              <option value="EU-SE-1">Europe (EU-SE-1)</option>
              <option value="EUR-IS-1">Europe (EUR-IS-1, S3)</option>
              <option value="EUR-NO-1">Europe (EUR-NO-1)</option>
              <option value="US-CA-2">United States (US-CA-2, S3)</option>
              <option value="US-GA-2">United States (US-GA-2)</option>
              <option value="US-IL-1">United States (US-IL-1)</option>
              <option value="US-KS-2">United States (US-KS-2, S3)</option>
              <option value="US-MO-1">United States (US-MO-1)</option>
              <option value="US-NC-1">United States (US-NC-1)</option>
              <option value="US-TX-3">United States (US-TX-3)</option>
              <option value="US-WA-1">United States (US-WA-1)</option>
            </select>
          </div>

          {/* Storage */}
          <div>
            <label htmlFor="storage" className={labelStyles}>
              Workspace Size (GB)
            </label>
            <select
              id="storage"
              value={storage}
              onChange={(e) => setStorage(parseInt(e.target.value))}
              className={selectStyles}
            >
              <option value={50}>50 GB</option>
              <option value={100}>100 GB</option>
              <option value={250}>250 GB</option>
              <option value={500}>500 GB</option>
            </select>
          </div>

          {/* GPU */}
          <div>
            <label htmlFor="gpu" className={labelStyles}>
              GPU Model
            </label>
            <select
              id="gpu"
              value={gpu}
              onChange={(e) => setGpu(e.target.value)}
              className={selectStyles}
              disabled={isGpuLoading || gpuOptions.length === 0}
            >
              {isGpuLoading ? (
                <option value="">Loading GPU availability...</option>
              ) : gpuOptions.length > 0 ? (
                gpuOptions.map((option) => {
                  const showId = option.id !== option.displayName
                  const memoryLabel =
                    typeof option.memoryInGb === "number"
                      ? `${option.memoryInGb} GB`
                      : null
                  const stockLabel = formatStockStatus(option.stockStatus)
                  const parts = [stockLabel]
                  if (memoryLabel) parts.unshift(memoryLabel)
                  const meta = parts.length > 0 ? ` • ${parts.join(" • ")}` : ""

                  return (
                    <option key={option.id} value={option.id}>
                      {option.displayName}
                      {showId ? ` (${option.id})` : ""}
                      {meta}
                    </option>
                  )
                })
              ) : (
                <option value="">No GPUs available</option>
              )}
            </select>
            {gpuError && (
              <p className="mt-2 text-xs text-destructive">
                Unable to load GPU list. {gpuError}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-accent text-primary font-bold p-3 rounded-[var(--radius)] hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Processing..." : "Submit Order"}
          </button>
        </form>
        {message && (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {message}
          </p>
        )}
      </Card>
    </div>
  )
}
