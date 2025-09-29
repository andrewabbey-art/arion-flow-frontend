import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import type { ReactNode } from "react"
import { getSupabaseAdminClient } from "@/lib/supabaseAdminClient"

// A robust interface that handles nullable return values from the database.
interface UserAccess {
  authorized: boolean | null
  role: string | null
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = createServerComponentClient({ cookies })
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.user) {
    redirect("/login")
  }

  const supabaseAdmin = getSupabaseAdminClient()
  const { data: access, error } = await supabaseAdmin
    .from("profiles")
    .select("authorized, role")
    .eq("id", session.user.id)
    .maybeSingle<UserAccess>()

  if (error) {
    throw new Error(`Failed to load admin access: ${error.message}`)
  }

  // Explicit normalization and checks for role and authorization status.
  const normalizedRole =
    typeof access?.role === "string" ? access.role.trim().toLowerCase() : null

  const isAllowedRole = normalizedRole
    ? ["arion_admin", "org_admin"].includes(normalizedRole)
    : false

  const isAuthorized = Boolean(access?.authorized)

  // Redirect if any core permission or authorization check fails
  if (!isAuthorized || !isAllowedRole) {
    redirect("/access-pending")
  }

  return <>{children}</>
}
