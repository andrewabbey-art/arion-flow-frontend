import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import DashboardClient from "./DashboardClient"

// Define the shape of the data being fetched
interface Profile {
  id: string
  authorized: boolean | null
  role: string | null
  organization_id: string | null
  first_name: string | null
}

interface Organization {
  id: string
  name: string
}

export interface Order {
  id: string
  status: string
  workspace_url: string | null
  pod_id: string | null
  gpu_type: string
  name: string | null // ✅ Added: Include 'name' in the type definition.
}

export default async function Dashboard() {
  const supabase = createServerComponentClient({ cookies: () => cookies() })

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect("/login")

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, authorized, role, organization_id, first_name")
    .eq("id", session.user.id)
    .single<Profile>()

  if (profileError || !profile || profile.authorized !== true) {
    redirect("/access-pending")
  }

  let organization: Organization | null = null
  if (profile.organization_id) {
    const { data: orgData } = await supabase
      .from("organizations")
      .select("id, name")
      .eq("id", profile.organization_id)
      .single<Organization>()
    organization = orgData
  }

  // ✅ Modified: Added `name` to the select query.
  const { data: orders } = await supabase
    .from("orders")
    .select("id, status, workspace_url, pod_id, gpu_type, name")
    .eq("user_id", session.user.id)
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