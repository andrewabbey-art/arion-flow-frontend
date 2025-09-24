import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createServerComponentClient({ cookies })

  // Get session
  const {
    data: { session },
  } = await supabase.auth.getSession()

  // Not logged in → login page
  if (!session?.user) {
    redirect("/login")
  }

  // ✅ Added: Fetch both authorized + role in one RPC
  const { data: access, error } = await supabase.rpc("get_user_access")

  if (error || !access) {
    redirect("/admin/denied")
  }

  // ✅ If not authorized or not admin → deny
  if (
    !access.authorized ||
    (access.role !== "arion_admin" && access.role !== "org_admin")
  ) {
    redirect("/admin/denied")
  }

  // ✅ Authorized admin → allow children
  return <>{children}</>
}