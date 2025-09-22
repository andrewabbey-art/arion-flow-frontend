"use client"

import { useEffect, useState } from "react"
import { getSupabaseClient } from "../../lib/supabaseClient"
import Card from "@/components/card"
import Link from "next/link"

type Order = {
  id: string
  name: string
  status: string
  workspace_url: string | null
  pod_id: string | null
  created_at: string
}

export default function DashboardPage() {
  const supabase = getSupabaseClient()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchOrders() {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false })

      if (!error && data) {
        // ✅ Added: filter out entries with no pod_id
        const filtered = data.filter((o: Order) => o.pod_id !== null)
        setOrders(filtered)
      }
      setLoading(false)
    }
    fetchOrders()
  }, [supabase])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading your workspaces...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background/50 p-6 pt-20">
      <h1 className="text-3xl font-bold mb-8 text-primary text-center">
        Welcome Back to Your Workspaces
      </h1>

      {orders.length === 0 ? (
        <p className="text-center text-muted-foreground">
          No active workspaces. <Link href="/order" className="text-accent">Create one here</Link>.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {orders.map((order) => (
            <Card key={order.id} className="p-6">
              <h2 className="text-xl font-bold mb-2">{order.name}</h2>
              <p className="text-sm mb-2">Status: {order.status}</p>
              {order.workspace_url ? (
                <a
                  href={order.workspace_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent font-semibold"
                >
                  Open Workspace
                </a>
              ) : (
                <p className="text-muted-foreground">No workspace URL</p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
