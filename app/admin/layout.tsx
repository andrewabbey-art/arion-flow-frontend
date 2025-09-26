import { createServerComponentClient } from "@supabase/auth-helpers-nextjs" // ✅ Added
import { cookies } from "next/headers" // ✅ Added
import { redirect } from "next/navigation" // ✅ Added
import type { ReactNode } from "react" // ✅ Added

// A robust interface that handles nullable return values from the database.
interface UserAccess { // ✅ Added
  authorized: boolean | null // ✅ Added
  role: string | null // ✅ Added
} // ✅ Added

export default async function AdminLayout({ children }: { children: ReactNode }) { // ✅ Modified to be an async Server Component
  const supabase = createServerComponentClient({ cookies })
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.user) {
    redirect("/login")
  }

  // Uses server-side query to get the freshest profile data, bypassing client-side state issues.
  const { data: access, error } = await supabase // ✅ Modified to use from().select() instead of rpc()
    .from("profiles") // ✅ Added
    .select("authorized, role") // ✅ Added
    .eq("id", session.user.id) // ✅ Added
    .maybeSingle<UserAccess>() // ✅ Modified to use maybeSingle with generic type

  // Explicit normalization and checks for role and authorization status.
  // This is safer and prevents runtime errors if 'access' is null.
  const normalizedRole =
    typeof access?.role === "string" ? access.role.trim().toLowerCase() : null

  const isAllowedRole = normalizedRole
    ? ["arion_admin", "org_admin"].includes(normalizedRole)
    : false

  const isAuthorized = Boolean(access?.authorized)

  // Redirect if any core permission or authorization check fails
  if (error || !isAuthorized || !isAllowedRole) {
    redirect("/access-pending")
  }

  return <>{children}</>
}