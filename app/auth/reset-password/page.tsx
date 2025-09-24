"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { getSupabaseClient } from "@/lib/supabaseClient"

export default function ResetPasswordPage() {
  const supabase = getSupabaseClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const accessToken = searchParams.get("access_token")

  const [newPassword, setNewPassword] = useState("")

  useEffect(() => {
    // if Supabase sends a session token, exchange it
    if (accessToken) {
      supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: searchParams.get("refresh_token")!,
      })
    }
  }, [accessToken, supabase, searchParams])

  async function handleReset() {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    })
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
        className="w-full bg-primary text-white px-3 py-2 rounded"
      >
        Update Password
      </button>
    </div>
  )
}
