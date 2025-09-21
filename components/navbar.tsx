"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { getSupabaseClient } from "@/lib/supabaseClient"
import Image from "next/image"

interface Profile {
  first_name: string
  last_name: string
}

export default function NavBar() {
  const router = useRouter()
  const supabase = getSupabaseClient()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setProfile(null)
        setUserEmail(null)
        return
      }

      setUserEmail(user.email ?? null)

      const { data, error } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", user.id)
        .single()

      if (!error && data) {
        setProfile(data)
      } else {
        setProfile(null)
      }
    }

    loadUser()

    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      loadUser()
    })

    return () => {
      listener?.subscription.unsubscribe()
    }
  }, [supabase])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push("/auth")
  }

  return (
    <nav className="w-full bg-card border-b border-border p-4 flex justify-between items-center">
      {/* 🔹 Logo + Brand */}
      <Link href="/" className="flex items-center gap-2">
        <Image
          src="/arion-wave-icon.svg"
          alt="Arion Flow Logo"
          width={80}
          height={80}
          priority
        />
        <span className="text-lg font-bold text-primary">Arion Flow</span>
      </Link>

      <div className="flex items-center gap-4">
        {profile || userEmail ? (
          <>
            <span className="text-sm text-muted-foreground">
              Welcome,{" "}
              {profile?.first_name || profile?.last_name
                ? `${profile.first_name} ${profile.last_name}`
                : userEmail}
            </span>

            <Link
              href="/dashboard"
              className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-border/10 transition-colors"
            >
              Dashboard
            </Link>

            <Link
              href="/account"
              className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-border/10 transition-colors"
            >
              My Account
            </Link>

            <button
              onClick={handleLogout}
              className="px-4 py-2 rounded-lg bg-secondary text-sm font-medium hover:bg-border transition-colors"
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <Link
              href="/auth"
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Login
            </Link>
            <Link
              href="/account/signup"
              className="px-4 py-2 rounded-lg border border-primary text-primary text-sm font-medium hover:bg-primary/10 transition-colors"
            >
              Create Account
            </Link>
          </>
        )}
      </div>
    </nav>
  )
}
