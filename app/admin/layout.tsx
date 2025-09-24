import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import type { ReactNode } from "react"

// ✅ Explicit type for the RPC return
interface UserAccess {
  authorized: boolean | null
  role: string | null
}

export default async function AdminLayout({
  children,
}: {
  children: ReactNode
}) {
  const supabase = createServerComponentClient({ cookies })

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.user) {
    redirect("/login")
  }

  // ✅ Typed RPC call with maybeSingle
  const { data: access, error } = await supabase
    .rpc("get_user_access")
    .maybeSingle<UserAccess>()

  // ✅ Normalize role string
  const normalizedRole =
    typeof access?.role === "string" ? access.role.trim().toLowerCase() : null

  const isAllowedRole = normalizedRole
    ? ["arion_admin", "org_admin"].includes(normalizedRole)
    : false

  const isAuthorized = Boolean(access?.authorized)

  // ✅ Only allow authorized users with allowed roles
  if (error || !isAuthorized || !isAllowedRole) {
    redirect("/access-pending")
  }

  return <>{children}</>
}
