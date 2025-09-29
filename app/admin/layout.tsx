import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import type { ReactNode } from "react"
import { getSupabaseAdminClient } from "@/lib/supabaseAdminClient"

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

  console.log('🔍 Checking admin access for user:', session.user.id) // ✅ Added

  const supabaseAdmin = getSupabaseAdminClient()
  const { data: access, error } = await supabaseAdmin
    .from("profiles")
    .select("authorized, role")
    .eq("id", session.user.id)
    .maybeSingle<UserAccess>()

  console.log('📊 Profile query result:', { access, error }) // ✅ Added
  console.log('✅ Authorized:', access?.authorized) // ✅ Added
  console.log('👤 Role:', access?.role) // ✅ Added

  if (error) {
    console.error('❌ Profile query error:', error) // ✅ Added
    throw new Error(`Failed to load admin access: ${error.message}`)
  }

  const normalizedRole =
    typeof access?.role === "string" ? access.role.trim().toLowerCase() : null

  const isAllowedRole = normalizedRole
    ? ["arion_admin", "org_admin"].includes(normalizedRole)
    : false

  const isAuthorized = Boolean(access?.authorized)

  console.log('🔐 Auth check:', { isAuthorized, isAllowedRole, normalizedRole }) // ✅ Added

  if (!isAuthorized || !isAllowedRole) {
    console.log('🚫 Access denied - redirecting to /access-pending') // ✅ Added
    redirect("/access-pending")
  }

  console.log('✅ Access granted') // ✅ Added
  return <>{children}</>
}