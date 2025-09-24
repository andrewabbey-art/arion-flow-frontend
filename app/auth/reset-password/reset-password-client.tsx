"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { getSupabaseClient } from "@/lib/supabaseClient"

export default function ResetPasswordClient({
  accessToken,
  refreshToken,
}: {
  accessToken?: string
  refreshToken?: string
}) {
  const supabase = getSupabaseClient()
  const router = useRouter()
  const [newPassword, setNewPassword] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // If Supabase sent a session token, set it
    if (accessToken && refreshToken) {
      supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      })
    }
  }, [accessToken, refreshToken, supabase])

  async function handleReset() {
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setLoading(false)

    if (error) {
      alert(error.message)
    } else {
      alert("Password updated! Please log in.")
      router.push("/login")
    }
  }

  return (
    <div className="max-w-md mx-auto mt-20 space-y-4">
      <h1 className="text-xl font-bold">Set a New Password</h1>
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
        className="w-full bg-primary text-white px-3 py-2 rounded disabled:opacity-60"
      >
        {loading ? "Updating…" : "Update Password"}
      </button>
    </div>
  )
}
