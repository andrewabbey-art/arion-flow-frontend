import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import type { ReactNode } from "react"

// ✅ Added: A more robust interface that handles nullable return values from the RPC.
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

  // ✅ Modified: Uses maybeSingle<UserAccess>() for better type inference with potentially null data.
  const { data: access, error } = await supabase
    .rpc("get_user_access")
    .maybeSingle<UserAccess>()

  // ✅ Added: Explicit normalization and checks for role and authorization status.
  // This is safer and prevents runtime errors if 'access' is null.
  const normalizedRole =
    typeof access?.role === "string" ? access.role.trim().toLowerCase() : null

  const isAllowedRole = normalizedRole
    ? ["arion_admin", "org_admin"].includes(normalizedRole)
    : false

  const isAuthorized = Boolean(access?.authorized)

  if (error || !isAuthorized || !isAllowedRole) {
    redirect("/access-pending")
  }

  return <>{children}</>
}