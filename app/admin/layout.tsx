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

  // Get profile
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role, authorized")
    .eq("id", session.user.id)
    .single()

  // If profile missing or query error → deny
  if (error || !profile) {
    redirect("/admin/denied")
  }

  // If not authorized or not admin → deny
  if (!profile.authorized || profile.role !== "arion_admin") {
    redirect("/admin/denied")
  }

  // ✅ Authorized admin → allow children
  return <>{children}</>
}
