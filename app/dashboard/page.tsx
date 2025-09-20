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
  workspace_url: string
}

type Order = {
  id: string
  status: string
  workspace_url: string | null
  telemetry?: Telemetry
}

export default function DashboardPage() {
  const router = useRouter()
  const supabase = getSupabaseClient()

  const [orders, setOrders] = useState<Order[]>([])
  const [status, setStatus] = useState("Loading your orders...")

  useEffect(() => {
    async function loadUserOrders() {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push("/auth")
        return
      }

      // Get all orders for this user
      const { data, error } = await supabase
        .from("orders")
        .select("id, status, workspace_url")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })

      if (error || !data || data.length === 0) {
        setStatus("No orders found. Please create one.")
        return
      }

      // Store orders
      setOrders(data)
      setStatus(`Found ${data.length} order(s).`)
    }

    loadUserOrders()
  }, [router, supabase])

  // Poll telemetry for each order
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
                ? { ...o, telemetry: json.telemetry, workspace_url: json.telemetry.workspace_url }
                : o
            )
          )
        } else {
          console.error("Telemetry error for order", orderId, json.error)
        }
      } catch (err) {
        console.error("Telemetry request failed", err)
      }
    }

    // Kick off telemetry immediately
    orders.forEach((o) => fetchTelemetry(o.id))

    // Then poll every 15s
    const interval = setInterval(() => {
      orders.forEach((o) => fetchTelemetry(o.id))
    }, 15000)

    return () => clearInterval(interval)
  }, [orders])

  // Format uptime nicely
  const formatUptime = (secs: number) => {
    const mins = Math.floor(secs / 60)
    const hrs = Math.floor(mins / 60)
    if (hrs > 0) return `${hrs}h ${mins % 60}m`
    return `${mins}m`
  }

  return (
    <div className="min-h-screen flex flex-col items-center bg-background/50 p-4 pt-20">
      <h2 className="text-3xl font-bold mb-6 text-primary">Dashboard</h2>
      <p className="text-muted-foreground mb-8">{status}</p>

      <div className="grid gap-6 w-full max-w-5xl">
        {orders.map((order) => (
          <Card key={order.id} className="p-6">
            <h3 className="text-xl font-semibold mb-2">Order #{order.id}</h3>
            <p className="text-sm mb-4">Status: {order.status}</p>

            {order.workspace_url && (
              <a
                href={order.workspace_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-accent text-primary font-bold px-4 py-2 rounded-[var(--radius)] hover:opacity-90 transition-opacity mb-4"
              >
                Go to Workspace
              </a>
            )}

            {order.telemetry ? (
              <div className="text-left space-y-2">
                <p><strong>Status:</strong> {order.telemetry.runtime_status}</p>
                <p><strong>GPU:</strong> {order.telemetry.gpu_type}</p>
                <p><strong>Disk:</strong> {order.telemetry.volume_size_gb} GB</p>
                <p><strong>Uptime:</strong> {formatUptime(order.telemetry.uptime_seconds)}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Loading telemetry…</p>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}
