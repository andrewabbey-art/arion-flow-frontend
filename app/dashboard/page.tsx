"use client"

import { useEffect, useState } from "react"
import { getSupabaseClient } from "../../lib/supabaseClient"
import { useRouter } from "next/navigation"
import Card from "@/components/card"

type Telemetry = {
  runtime_status: string
  uptime_seconds: number
  gpu_type: string
  volume_size_gb: number
}

export default function DashboardPage() {
  const router = useRouter()
  const supabase = getSupabaseClient()

  const [status, setStatus] = useState("Loading your status...")
  const [workspaceUrl, setWorkspaceUrl] = useState<string | null>(null)
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null)
  const [orderId, setOrderId] = useState<string | null>(null)

  useEffect(() => {
    async function loadUserOrder() {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push("/auth")
        return
      }

      // Get latest order for this user
      const { data, error } = await supabase
        .from("orders")
        .select("id, status, workspace_url")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single()

      if (error || !data) {
        setStatus("No order found. Please create one.")
        return
      }

      setOrderId(data.id)
      setWorkspaceUrl(data.workspace_url)
      setStatus(`Current status: ${data.status}`)
    }

    loadUserOrder()
  }, [router, supabase])

  useEffect(() => {
    if (!orderId) return

    // Poll telemetry every 15s
    const fetchTelemetry = async () => {
      try {
        const res = await fetch(`/api/orders/${orderId}/telemetry`)
        const json = await res.json()
        if (json.ok) {
          setTelemetry(json.telemetry)
          setStatus(`Workspace status: ${json.telemetry.runtime_status}`)
        } else {
          setStatus("Error fetching telemetry: " + json.error)
        }
      } catch (err) {
        setStatus("Telemetry request failed")
      }
    }

    fetchTelemetry()
    const interval = setInterval(fetchTelemetry, 15000)
    return () => clearInterval(interval)
  }, [orderId])

  // Format uptime
  const formatUptime = (secs: number) => {
    const mins = Math.floor(secs / 60)
    const hrs = Math.floor(mins / 60)
    if (hrs > 0) return `${hrs}h ${mins % 60}m`
    return `${mins}m`
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background/50 p-4 pt-20">
      <Card className="p-8 w-full max-w-2xl text-center">
        <h2 className="text-3xl font-bold mb-4 text-primary">Dashboard</h2>
        <p className="text-muted-foreground mb-6">{status}</p>

        {workspaceUrl && (
          <a
            href={workspaceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-accent text-primary font-bold px-6 py-3 rounded-[var(--radius)] hover:opacity-90 transition-opacity mb-6"
          >
            Go to Your Workspace
          </a>
        )}

        {telemetry && (
          <div className="text-left space-y-2">
            <p><strong>Status:</strong> {telemetry.runtime_status}</p>
            <p><strong>GPU:</strong> {telemetry.gpu_type}</p>
            <p><strong>Disk:</strong> {telemetry.volume_size_gb} GB</p>
            <p><strong>Uptime:</strong> {formatUptime(telemetry.uptime_seconds)}</p>
          </div>
        )}
      </Card>
    </div>
  )
}
