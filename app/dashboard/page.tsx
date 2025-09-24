import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import DashboardClient from "./DashboardClient"

// Define the shape of the data being fetched from the database
export interface Order {
  id: string
  name: string | null
  status: string
  workspace_url: string | null
  pod_id: string | null
  gpu_type: string
}

export interface Profile {
  id: string
  authorized: boolean | null
  first_name: string | null
  organization_id: string | null
}

export interface Organization {
  id: string
  name: string
}

// This Server Component handles security and the initial data load.
export default async function Dashboard() {
  const supabase = createServerComponentClient({ cookies: () => cookies() })

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect("/login")

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, authorized, first_name, organization_id")
    .eq("id", session.user.id)
    .single<Profile>()

  // The main redirect check
  if (profileError || !profile || profile.authorized !== true) {
    redirect("/access-pending")
  }

  // Fetch the user's organization if they have one
  let organization: Organization | null = null
  if (profile.organization_id) {
    const { data: orgData } = await supabase
      .from("organizations")
      .select("id, name")
      .eq("id", profile.organization_id)
      .single<Organization>()
    organization = orgData
  }

  // Fetch the initial list of orders. RLS handles the filtering automatically.
  const { data: orders } = await supabase
    .from("orders")
    .select("id, name, status, workspace_url, pod_id, gpu_type")
    .neq("status", "deleted")
    .order("created_at", { ascending: false })

  return (
    <DashboardClient
      profile={profile}
      organization={organization}
      initialOrders={orders ?? []}
      session={session}
    />
  )
}