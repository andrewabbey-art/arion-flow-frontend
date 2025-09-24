"use client"

import { useEffect, useState, useMemo } from "react"
import Link from "next/link"
import type { Session } from "@supabase/supabase-js"

import type { Order as InitialOrder, Profile, Organization } from "./page"
import Card from "@/components/card"
import Metric from "@/components/Metric"
import TerminateModal from "@/components/TerminateModal"
import { getSupabaseClient } from "@/lib/supabaseClient"

// Using the exact, proven type definitions from your original dashboard
type GpuMetric = {
  gpu_util_percent: number
  memory_util_percent: number
}
type ContainerMetrics = {
  cpu_percent: number | null
  memory_percent: number | null
}
type Telemetry = {
  desired_status: string
  gpu_count: number
  gpu_type: string
  uptime_seconds: number
  gpu_metrics: GpuMetric[]
  container_metrics: ContainerMetrics
  workspace_url: string
}
type Order = InitialOrder & {
  telemetry?: Telemetry
  error?: string
  wsOnline?: boolean
}

interface DashboardClientProps {
  profile: Profile
  organization: Organization | null
  initialOrders: InitialOrder[]
  session: Session
}

export default function DashboardClient({
  profile,
  initialOrders,
}: DashboardClientProps) {
  const supabase = getSupabaseClient()

  const [orders, setOrders] = useState<Order[]>(initialOrders)
  const [status, setStatus] = useState("Loading your orders...")
  const [terminateTarget, setTerminateTarget] = useState<string | null>(null)
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null)

  useEffect(() => {
    const activeCount = initialOrders.filter((o) => o.pod_id !== null).length
    setStatus(
      activeCount > 0
        ? `Displaying ${activeCount} active workspace(s).`
        : "No active workspaces found."
    )
  }, [initialOrders])

  const orderIds = useMemo(() => orders.map((o) => o.id).sort().join(","), [orders])

  useEffect(() => {
    if (!orderIds) return

    const fetchTelemetry = async (orderId: string) => {
      try {
        const res = await fetch(`/api/orders/${orderId}/telemetry`)
        const json = await res.json()
        setOrders((prev) =>
          prev.map((o) => {
            if (o.id !== orderId) return o
            // ✅ This logic correctly merges telemetry data, fixing the flashing button.
            if (json.ok) {
              return { ...o, telemetry: json.telemetry, workspace_url: json.telemetry.workspace_url, error: undefined }
            } else {
              return { ...o, error: json.error ?? "Unknown telemetry error" }
            }
          })
        )
      } catch (err) {
        setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, error: "Telemetry request failed" } : o)))
      }
    }

    const fetchAllTelemetry = () => orders.forEach((o) => fetchTelemetry(o.id))
    fetchAllTelemetry()
    const interval = setInterval(fetchAllTelemetry, 15000)
    return () => clearInterval(interval)
  }, [orderIds])
  
  const formatUptime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const hrs = Math.floor(mins / 60);
    if (hrs > 0) return `${hrs}h ${mins % 60}m`;
    return `${mins}m`;
  };

  const handleAction = async (
    orderId: string,
    action: "stop" | "restart" | "terminate"
  ) => {
    try {
      setBusyOrderId(orderId)
      const res = await fetch(`/api/orders/${orderId}/${action}`, { method: "POST" })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error || "Unknown error")
      alert(`Instance ${action} command sent successfully.`)
      if (action === "terminate") {
        setOrders((prev) => prev.filter((o) => o.id !== orderId))
      }
    } catch (err) {
      alert(`Failed to ${action} instance: ${(err as Error).message}`)
    } finally {
      setBusyOrderId(null)
    }
  }

  const getWorkspaceStatus = (order: Order) => {
    if (!order.telemetry || order.telemetry.desired_status !== "RUNNING") {
      return { label: "Offline", color: "bg-red-500", pulse: false };
    }
    return { label: "Online", color: "bg-green-500", pulse: false };
  };

  return (
    <main className="min-h-screen w-full pt-24">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-10 flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-4xl font-bold font-heading">
              {profile.first_name ? `Welcome back, ${profile.first_name}` : "Dashboard"}
            </h1>
            <p className="text-muted-foreground mt-2">{status}</p>
          </div>
          <Link
            href="/order"
            className="mt-4 sm:mt-0 px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            + Create New Instance
          </Link>
        </div>

        <div className="grid gap-8 w-full">
          {orders.map((order) => {
            const disabled = busyOrderId === order.id;
            const disabledCls = disabled ? "opacity-50 pointer-events-none" : "";
            const wsStatus = getWorkspaceStatus(order);

            return (
              <Card key={order.id} className="p-0 overflow-hidden">
                <div className="p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-card/50 border-b border-border">
                  <div>
                    <h3 className="text-xl font-bold font-heading">{order.name || `Workspace ID #${order.id}`}</h3>
                    <div className="flex items-center gap-2 mt-2 text-sm">
                      <span className={`h-2 w-2 rounded-full ${wsStatus.color}`}></span>
                      <span className="text-muted-foreground">
                        Status: {order.telemetry?.desired_status ?? order.status}
                      </span>
                    </div>
                  </div>
                  {order.workspace_url && (
                    <a href={order.workspace_url} target="_blank" rel="noopener noreferrer" className={`mt-4 sm:mt-0 px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors ${disabledCls}`}>
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
                        <hr className="border-border/50 my-3" />
                        {order.telemetry.container_metrics && (
                          <>
                            <Metric label="CPU Utilization" value={`${order.telemetry.container_metrics.cpu_percent ?? "N/A"}%`} />
                            <Metric label="RAM Utilization" value={`${order.telemetry.container_metrics.memory_percent ?? "N/A"}%`} />
                          </>
                        )}
                        {Array.isArray(order.telemetry.gpu_metrics) && order.telemetry.gpu_metrics.map((g, i) => (
                          <div key={i}>
                            <hr className="border-border/50 my-3" />
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
                      <button onClick={() => handleAction(order.id, "restart")} disabled={disabled} className={`flex-1 text-center border border-border bg-transparent text-muted-foreground px-4 py-2 text-sm font-semibold rounded-lg hover:bg-border hover:text-foreground transition-colors ${disabledCls}`}>
                        Restart
                      </button>
                      <button onClick={() => handleAction(order.id, "stop")} disabled={disabled} className={`flex-1 text-center border border-yellow-500/50 bg-transparent text-yellow-500 px-4 py-2 text-sm font-semibold rounded-lg hover:bg-yellow-500/10 transition-colors ${disabledCls}`}>
                        Stop
                      </button>
                      <button onClick={() => setTerminateTarget(order.id)} disabled={disabled} className={`flex-1 text-center border border-red-500/50 bg-transparent text-red-500 px-4 py-2 text-sm font-semibold rounded-lg hover:bg-red-500/10 transition-colors ${disabledCls}`}>
                        Terminate
                      </button>
                    </div>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      </div>
      <TerminateModal open={terminateTarget !== null} onClose={() => setTerminateTarget(null)} onConfirm={() => { if (terminateTarget) { handleAction(terminateTarget, "terminate"); setTerminateTarget(null); } }} />
    </main>
  )
}