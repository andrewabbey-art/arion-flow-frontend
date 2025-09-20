"use client"

import { useEffect, useState } from "react"
import { getSupabaseClient } from "../../lib/supabaseClient"
import { useRouter } from "next/navigation"
import Card from "@/components/card" // Using the Card component for consistency

export default function DashboardPage() {
  const router = useRouter()
  const supabase = getSupabaseClient() // ✅ use new client getter
  const [status, setStatus] = useState("Loading your status...")
  const [workspaceUrl, setWorkspaceUrl] = useState<string | null>(null)

  useEffect(() => {
    async function checkStatus() {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push("/auth")
        return
      }

      const { data, error } = await supabase
        .from("users")
        .select("status, workspace_url")
        .eq("id", user.id)
        .single()

      if (error) {
        setStatus("Error: Could not retrieve your user status.")
        return
      }

      if (!data) {
        setStatus("No user record found. Please contact support.")
        return
      }

      // Update status based on the data from Supabase
      switch (data.status) {
        case "pending":
          setStatus("Your account is pending approval. Please wait for admin review.")
          break
        case "denied":
          setStatus("Sorry, your signup was not approved.")
          break
        case "approved":
          setStatus("Approved! Your workspace is being provisioned. Please check back soon.")
          break
        case "active":
          if (data.workspace_url) {
            setStatus("Your workspace is ready!")
            setWorkspaceUrl(data.workspace_url)
            // 🚫 removed router.push(data.workspace_url) to avoid blank screen
          } else {
            setStatus("Your account is active but the workspace URL is missing. Please contact support.")
          }
          break
        default:
          setStatus("Unknown account status. Please contact support.")
          break
      }
    }

    checkStatus()
  }, [router, supabase])

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
            className="inline-block bg-accent text-primary font-bold px-6 py-3 rounded-[var(--radius)] hover:opacity-90 transition-opacity"
          >
            Go to Your Workspace
          </a>
        )}
      </Card>
    </div>
  )
}
