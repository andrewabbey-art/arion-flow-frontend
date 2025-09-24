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
  last_name: string | null
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
  // ✅ Removed `user_id` from the type definition to match the query
}

// This remains a Server Component for security and initial data fetching.
export default async function Dashboard() {
  const supabase = createServerComponentClient({ cookies: () => cookies() })

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect("/login")
  }

  // Step 1: Fetch the user's profile.
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .single<Profile>()

  if (profileError || !profile) {
    redirect("/access-pending")
  }

  // Step 2: Authorization Check.
  if (profile.authorized !== true) {
    redirect("/access-pending")
  }

  // Step 3: Conditionally fetch the organization.
  let organization: Organization | null = null
  if (profile.organization_id) {
    const { data: orgData } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", profile.organization_id)
      .single<Organization>()
    organization = orgData
  }

  // Step 4: Fetch the user's initial orders.
  const { data: orders } = await supabase
    .from("orders")
    .select("id, status, workspace_url, pod_id") // This query now matches the Order type
    .eq("user_id", session.user.id)
    .neq("status", "deleted")
    .order("created_at", { ascending: false })

  // Step 5: Pass all fetched data to the client component for rendering.
  return (
    <DashboardClient
      profile={profile}
      organization={organization}
      initialOrders={orders ?? []}
      session={session}
    />
  )
}