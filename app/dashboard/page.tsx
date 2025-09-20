"use client"

import { useEffect, useState } from "react"
import { getSupabaseClient } from "../../lib/supabaseClient"
import { useRouter } from "next/navigation"
import Card from "@/components/card"
import Metric from "@/components/Metric"
import Link from "next/link" 

// --- Type definitions remain unchanged ---
type GpuMetric = {
  id: string
  gpu_util_percent: number
  memory_util_percent: number
}
type ContainerMetrics = {
  cpu_percent: number | null
  memory_percent: number | null
}
type Port = {
  ip: string
  is_ip_public: boolean
  private_port: number
  public_port: number
  type: string
}
type Telemetry = {
  pod_id: string
  desired_status: string
  gpu_count: number
  gpu_type: string
  gpu_type_id?: string
  uptime_seconds: number
  gpu_metrics: GpuMetric[]
  container_metrics: ContainerMetrics
  ports: Port[]
  workspace_url: string
}
type Order = {
  id: string
  status: string
  workspace_url: string | null
  telemetry?: Telemetry
  error?: string
}

export default function DashboardPage() {
  const router = useRouter()
  const supabase = getSupabaseClient()

  const [orders, setOrders] = useState<Order[]>([])
  const [status, setStatus] = useState("Loading your orders...")

  // --- All your data fetching and handler logic remains here ---
  useEffect(() => {
    async function loadUserOrders() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push("/auth")
        return
      }

      const { data, error } = await supabase
        .from("orders")
        .select("id, status, workspace_url")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })

      if (error || !data || data.length === 0) {
        setStatus("No active workspaces found.")
        return
      }

      setOrders(data)
      setStatus(`Displaying ${data.length} active workspace(s).`)
    }

    loadUserOrders()
  }, [router, supabase])

  useEffect(() => {
    if (orders.length === 0) return

    const fetchTelemetry = async (orderId: string) => {
      try {
        const res = await fetch(`/api/orders/${orderId}/telemetry`)
        const json = await res.json()
        if (json.ok) {
          setOrders((prev) =>
            prev.map((o) =>
              o.id === orderId
                ? {
                    ...o,
                    telemetry: json.telemetry,
                    workspace_url: json.telemetry.workspace_url,
                    error: undefined,
                  }
                : o
            )
          )
        } else {
          setOrders((prev) =>
            prev.map((o) =>
              o.id === orderId
                ? { ...o, error: json.error ?? "Unknown telemetry error", telemetry: undefined }
                : o
            )
          )
        }
      } catch {
        setOrders((prev) =>
          prev.map((o) =>
            o.id === orderId
              ? { ...o, error: "Telemetry request failed", telemetry: undefined }
              : o
          )
        )
      }
    }

    orders.forEach((o) => fetchTelemetry(o.id))
    const interval = setInterval(() => {
      orders.forEach((o) => fetchTelemetry(o.id))
    }, 15000)

    return () => clearInterval(interval)
  }, [orders])

  const formatUptime = (secs: number) => {
    const mins = Math.floor(secs / 60)
    const hrs = Math.floor(mins / 60)
    if (hrs > 0) return `${hrs}h ${mins % 60}m`
    return `${mins}m`
  }

  const handleAction = async (orderId: string, action: "stop" | "restart" | "terminate") => {
    try {
      const res = await fetch(`/api/orders/${orderId}/${action}`, { method: "POST" })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error || "Unknown error")
      alert(`Instance ${action} command sent successfully.`)
    } catch (err) {
      alert(`Failed to ${action} instance: ${(err as Error).message}`)
    }
  }

  return (
    <main className="min-h-screen w-full pt-24">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-10 flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
                <h1 className="text-4xl font-bold font-heading">Dashboard</h1>
                <p className="text-muted-foreground mt-2">{status}</p>
            </div>
            {/* --- LINK UPDATED --- */}
            <Link 
                href="/order" 
                className="mt-4 sm:mt-0 px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
                + Create New Instance
            </Link>
            {/* --- END LINK UPDATE --- */}
        </div>

        <div className="grid gap-8 w-full">
          {orders.map((order) => (
            <Card key={order.id} className="p-0 overflow-hidden">
              <div className="p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-card/50 border-b border-border">
                <div>
                  <h3 className="text-xl font-bold font-heading">Workspace ID #{order.id}</h3>
                  <div className="flex items-center gap-2 mt-2 text-sm">
                    <span className={`h-2 w-2 rounded-full ${order.telemetry?.desired_status === 'RUNNING' ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
                    <span className="text-muted-foreground">
                      Status: {order.telemetry?.desired_status ?? order.status}
                    </span>
                  </div>
                </div>
                {order.workspace_url && (
                  <a
                    href={order.workspace_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 sm:mt-0 px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                  >
                    Go to Workspace
                  </a>
                )}
              </div>
              
              <div className="p-6 grid md:grid-cols-2 gap-8">
                <div>
                  <h4 className="font-semibold mb-4 text-foreground">Telemetry</h4>
                  {order.error && <p className="text-red-400 text-sm">Error: {order.error}</p>}
                  {!order.error && !order.telemetry && <p className="text-sm text-muted-foreground">Loading telemetry…</p>}
                  
                  {order.telemetry && (
                    <div className="space-y-3">
                      <Metric label="GPU Type" value={`${order.telemetry.gpu_count}x ${order.telemetry.gpu_type}`} />
                      <Metric label="Uptime" value={formatUptime(order.telemetry.uptime_seconds)} />
                      <hr className="border-border/50 my-3"/>
                      {order.telemetry.container_metrics && (
                        <>
                          <Metric label="CPU Utilization" value={`${order.telemetry.container_metrics.cpu_percent ?? "N/A"}%`} />
                          <Metric label="RAM Utilization" value={`${order.telemetry.container_metrics.memory_percent ?? "N/A"}%`} />
                        </>
                      )}
                      {order.telemetry.gpu_metrics.map((g, i) => (
                        <div key={i}>
                          <hr className="border-border/50 my-3"/>
                          <Metric label={`GPU ${i + 1} Utilization`} value={`${g.gpu_util_percent}%`} />
                          <Metric label={`GPU ${i + 1} Memory`} value={`${g.memory_util_percent}%`} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="font-semibold mb-4 text-foreground">Instance Actions</h4>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={() => handleAction(order.id, "restart")}
                      className="flex-1 text-center border border-border bg-transparent text-muted-foreground px-4 py-2 text-sm font-semibold rounded-lg hover:bg-border hover:text-foreground transition-colors"
                    >
                      Restart
                    </button>
                    <button
                      onClick={() => handleAction(order.id, "stop")}
                      className="flex-1 text-center border border-yellow-500/50 bg-transparent text-yellow-500 px-4 py-2 text-sm font-semibold rounded-lg hover:bg-yellow-500/10 transition-colors"
                    >
                      Stop
                    </button>
                    <button
                      onClick={() => handleAction(order.id, "terminate")}
                      className="flex-1 text-center border border-red-500/50 bg-transparent text-red-500 px-4 py-2 text-sm font-semibold rounded-lg hover:bg-red-500/10 transition-colors"
                    >
                      Terminate
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </main>
  )
}