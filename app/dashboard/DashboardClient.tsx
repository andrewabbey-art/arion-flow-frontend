"use client"

import { useEffect, useState, useMemo, useRef } from "react"
import Link from "next/link"
import type { Session } from "@supabase/supabase-js"

import type { Order as InitialOrder } from "./page"
import Card from "@/components/card"
import Metric from "@/components/Metric"
import TerminateModal from "@/components/TerminateModal"
import { getSupabaseClient } from "@/lib/supabaseClient"

type GpuMetric = {
  id: string
  gpu_util_percent: number
  memory_util_percent: number
}
type ContainerMetrics = {
  cpu_percent: number | null
  memory_percent: number | null
}
type Telemetry = {
  pod_id: string
  desired_status: string
  gpu_count: number
  gpu_type: string
  uptime_seconds: number
  workspace_url: string
}

type Order = InitialOrder & {
  telemetry?: Telemetry
  error?: string
  wsOnline?: boolean
}

interface DashboardClientProps {
  profile: {
    id: string
    first_name: string | null
  }
  organization: { name: string } | null
  initialOrders: InitialOrder[]
  session: Session
}

export default function DashboardClient({
  profile,
  initialOrders,
  session,
}: DashboardClientProps) {
  const supabase = getSupabaseClient()

  const filteredInitialOrders = useMemo(
    () => initialOrders.filter((o) => o.pod_id !== null),
    [initialOrders]
  )

  const [orders, setOrders] = useState<Order[]>(filteredInitialOrders)
  const [status, setStatus] = useState("Loading your orders...")
  const [terminateTarget, setTerminateTarget] = useState<string | null>(null)
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null)
  const ordersRef = useRef<Order[]>(filteredInitialOrders)

  useEffect(() => {
    if (orders.length === 0) {
      setStatus("No active workspaces found.")
    } else {
      setStatus(`Displaying ${orders.length} active workspace(s).`)
    }
  }, [orders.length])

  useEffect(() => {
    setOrders((prev) =>
      filteredInitialOrders.map((order) => {
        const existing = prev.find((o) => o.id === order.id)
        return existing ? { ...existing, ...order } : order
      })
    )
  }, [filteredInitialOrders])

  useEffect(() => {
    ordersRef.current = orders
  }, [orders])

  const orderIds = useMemo(
    () => orders.map((o) => o.id).sort().join(","),
    [orders]
  )

  useEffect(() => {
    if (ordersRef.current.length === 0) return

    const fetchTelemetry = async (orderId: string) => {
      try {
        const res = await fetch(`/api/orders/${orderId}/telemetry`)
        const json = await res.json()
        setOrders((prev) =>
          prev.map((o) => {
            if (o.id !== orderId) return o
            if (json.ok) {
              return {
                ...o,
                telemetry: json.telemetry,
                workspace_url: json.telemetry.workspace_url,
                error: undefined,
              }
            } else {
              return {
                ...o,
                error: json.error ?? "Unknown telemetry error",
                telemetry: undefined,
              }
            }
          })
        )
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

    const fetchAllTelemetry = () =>
      ordersRef.current.forEach((o) => fetchTelemetry(o.id))

    fetchAllTelemetry()
    const interval = setInterval(fetchAllTelemetry, 15000)

    return () => clearInterval(interval)
  }, [orderIds])

  useEffect(() => {
    if (ordersRef.current.length === 0) return

    const checkWorkspaceStatus = async (order: Order) => {
      if (!order.workspace_url) {
        setOrders((prev) =>
          prev.map((o) =>
            o.id === order.id ? { ...o, wsOnline: false } : o
          )
        )
        return
      }

      const workspaceUrl = order.workspace_url.replace(/\/$/, "")

      try {
        const res = await fetch(
          `/api/check-workspace?url=${encodeURIComponent(workspaceUrl)}`
        )
        const json = await res.json()
        const ok = json?.status >= 200 && json?.status < 400
        setOrders((prev) =>
          prev.map((o) => (o.id === order.id ? { ...o, wsOnline: ok } : o))
        )
      } catch {
        setOrders((prev) =>
          prev.map((o) =>
            o.id === order.id ? { ...o, wsOnline: false } : o
          )
        )
      }
    }

    const checkAllWorkspaces = () =>
      ordersRef.current.forEach((o) => checkWorkspaceStatus(o))

    checkAllWorkspaces()
    const interval = setInterval(checkAllWorkspaces, 10000)

    return () => clearInterval(interval)
  }, [orderIds])

  const formatUptime = (secs: number) => {
    const mins = Math.floor(secs / 60)
    const hrs = Math.floor(mins / 60)
    if (hrs > 0) return `${hrs}h ${mins % 60}m`
    return `${mins}m`
  }

  const handleAction = async (
    orderId: string,
    action: "stop" | "restart" | "terminate",
    deleteWorkspace?: boolean
  ) => {
    try {
      setBusyOrderId(orderId)

      const { data } = await supabase.auth.getSession()
      const accessToken = data.session?.access_token ?? session.access_token
      if (!accessToken) {
        throw new Error("No access token")
      }

      const hasBody = action === "terminate"
      const body = hasBody
        ? JSON.stringify({ deleteWorkspace: !!deleteWorkspace })
        : undefined

      const res = await fetch(`/api/orders/${orderId}/${action}`, {
        method: "POST",
        headers: {
          ...(hasBody ? { "Content-Type": "application/json" } : {}),
          Authorization: `Bearer ${accessToken}`,
        },
        body,
      })

      const json = await res.json()
      if (!json.ok) throw new Error(json.error || "Unknown error")

      if (action === "terminate") {
        alert(
          json.deletedWorkspace
            ? "Pod terminated and workspace deleted."
            : "Pod terminated, workspace kept."
        )
        setOrders((prev) => prev.filter((o) => o.id !== orderId))
      } else {
        alert(`Instance ${action} command sent successfully.`)
      }
    } catch (err) {
      alert(`Failed to ${action} instance: ${(err as Error).message}`)
    } finally {
      setBusyOrderId(null)
    }
  }

  const getWorkspaceStatus = (order: Order) => {
    if (busyOrderId === order.id) return "Processing..."
    if (order.error) return `Error: ${order.error}`
    if (!order.telemetry) return "Loading telemetry..."
    return order.wsOnline ? "Online" : "Offline"
  }

  return (
    <div>
      <h2 className="text-xl font-bold">
        Welcome back, {profile.first_name || "User"}!
      </h2>
      <p>{status}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
        {orders.map((order) => (
          <Card key={order.id}>
            <h3 className="font-semibold">Workspace {order.id}</h3>
            <p>{getWorkspaceStatus(order)}</p>
            <button
              className="text-red-600 mt-2"
              onClick={() => setTerminateTarget(order.id)}
              disabled={busyOrderId === order.id}
            >
              Terminate
            </button>
          </Card>
        ))}
      </div>

      {terminateTarget && (
        <TerminateModal
          orderId={terminateTarget}
          onClose={() => setTerminateTarget(null)}
          onConfirm={(deleteWorkspace) =>
            handleAction(terminateTarget, "terminate", deleteWorkspace)
          }
        />
      )}
    </div>
  )
}
