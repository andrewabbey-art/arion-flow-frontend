import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import type { ReactNode } from "react"

// ✅ Explicit type for the RPC return
interface UserAccess {
  authorized: boolean
  role: string
}

export default async function AdminLayout({
  children,
}: {
  children: ReactNode
}) {
  const supabase = createServerComponentClient({ cookies })

  // Get session
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.user) {
    redirect("/login")
  }

  // ✅ Call the RPC and unwrap into a single object
  const { data: access, error } = await supabase
    .rpc("get_user_access")
    .maybeSingle<UserAccess>()

  if (error || !access?.authorized) {
    redirect("/access-pending")
  }

  // ✅ Role-based gating
  if (access.role === "arion_admin") {
    // Global admin → unrestricted
    return <>{children}</>
  }

  if (access.role === "org_admin") {
    // Org admin → restricted view
    // If you want to show a scoped admin dashboard instead of the same children,
    // redirect to a separate page:
    redirect("/admin/org")
  }

  // All other roles → deny
  redirect("/access-pending")
}