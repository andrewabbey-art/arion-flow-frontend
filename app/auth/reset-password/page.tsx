"use client"

// ✅ Added 'Suspense' to manage dynamic rendering
import { useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { getSupabaseClient } from "@/lib/supabaseClient"

// ✅ Moved all logic that uses searchParams into a new child component
function ResetPasswordForm() {
  const supabase = getSupabaseClient()
  const router = useRouter()
  const searchParams = useSearchParams() // This hook requires the Suspense boundary

  const accessToken = searchParams.get("access_token") || undefined
  const refreshToken = searchParams.get("refresh_token") || undefined

  const [newPassword, setNewPassword] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Set Supabase session if tokens are present
    if (accessToken && refreshToken) {
      supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      })
    }
  }, [accessToken, refreshToken, supabase])

  async function handleReset() {
    if (!newPassword) return
    setLoading(true)

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    })

    setLoading(false)

    if (error) {
      alert(error.message)
    } else {
      alert("Password updated successfully! Please log in.")
      router.push("/login")
    }
  }

  return (
    <div className="max-w-md mx-auto mt-20 space-y-6">
      <h1 className="text-2xl font-bold text-center">Set a New Password</h1>
      <p className="text-sm text-muted-foreground text-center">
        Enter your new password below to complete the reset process.
      </p>
      <input
        type="password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        placeholder="Enter a new password"
        className="w-full border rounded px-3 py-2"
      />
      <button
        onClick={handleReset}
        disabled={loading || !newPassword}
        className="w-full bg-primary text-white px-3 py-2 rounded disabled:opacity-50"
      >
        {loading ? "Updating…" : "Update Password"}
      </button>
    </div>
  )
}

// ✅ The main page component now wraps the dynamic form in Suspense
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="text-center p-8">Loading...</div>}>
      <ResetPasswordForm />
    </Suspense>
  )
}