import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import DashboardClient from "./DashboardClient"

// Define the shape of the data being fetched
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
  // ✅ Removed organization_id from here, as it's not in the profiles table.
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

  // Step 1: Fetch the user's profile.
  // ✅ Corrected: Removed the non-existent 'organization_id' from the select statement.
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, authorized, first_name")
    .eq("id", session.user.id)
    .single<Profile>()

  if (profileError || !profile || profile.authorized !== true) {
    redirect("/access-pending")
  }

  // Step 2: Fetch the user's organization link from the correct table.
  const { data: orgLink } = await supabase
    .from("organization_users")
    .select("organization_id")
    .eq("user_id", session.user.id)
    .single() // We assume a user belongs to one org for now.

  // Step 3: Use the organization link to fetch the organization's details.
  let organization: Organization | null = null
  if (orgLink?.organization_id) {
    const { data: orgData } = await supabase
      .from("organizations")
      .select("id, name")
      .eq("id", orgLink.organization_id)
      .single<Organization>()
    organization = orgData
  }

  // Step 4: Fetch the initial list of orders. RLS will handle filtering.
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