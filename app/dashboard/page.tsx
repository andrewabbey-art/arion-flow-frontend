import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

// ✅ Added: Define more specific types for our data to improve clarity.
interface Profile {
  id: string
  authorized: boolean | null
  role: string | null
  organization_id: string | null
  // Add other profile fields as needed
}

interface Organization {
  id: string
  name: string
  // Add other organization fields as needed
}

export default async function Dashboard() {
  const supabase = createServerComponentClient({ cookies })

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect("/login")
  }

  // ✅ Modified: Step 1 - Fetch only the user's profile first.
  // This query is simple and should always succeed if the user's profile exists
  // and the RLS policy on `profiles` is correct.
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .single<Profile>()

  // If the profile can't be fetched, the user is not properly set up.
  if (profileError || !profile) {
    console.error("Dashboard Error: Could not fetch user profile.", profileError)
    redirect("/access-pending")
  }

  // ✅ Added: Step 2 - Conditionally fetch the organization.
  // Only attempt to fetch the organization if the profile has an `organization_id`.
  // This correctly handles `arion_admin` users who don't have an org.
  let organization: Organization | null = null
  if (profile.organization_id) {
    const { data: orgData, error: orgError } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", profile.organization_id)
      .single<Organization>()

    if (orgError) {
      console.error("Dashboard Error: Could not fetch organization.", orgError)
      // If the org lookup fails, we still have the profile, but we should redirect.
      redirect("/access-pending")
    }
    organization = orgData
  }

  // ✅ Modified: Step 3 - Check for authorization after fetching all data.
  // We can now check the profile directly for the `authorized` flag.
  if (!profile.authorized) {
    redirect("/access-pending")
  }

  // At this point, you have the profile and (optionally) the organization.
  // You can now pass them to a client component to render the dashboard UI.
  // This is a placeholder for your actual dashboard UI component.
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Welcome to your Dashboard</h1>
      <pre className="mt-4 p-4 bg-gray-100 rounded">
        {JSON.stringify({ profile, organization }, null, 2)}
      </pre>
    </div>
  )
}