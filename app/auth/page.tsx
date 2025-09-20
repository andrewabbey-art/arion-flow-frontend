"use client"

import { useState } from "react"
import { getSupabaseClient } from "../../lib/supabaseClient"
import { useRouter } from "next/navigation"
import Card from "@/components/card"
import GoogleIcon from "@/components/icons/GoogleIcon"
import AppleIcon from "@/components/icons/AppleIcon"

export default function AuthPage() {
  const router = useRouter()
  const supabase = getSupabaseClient() // ✅ create client
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [message, setMessage] = useState("")

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setMessage("Signing up...")

    const { error } = await supabase.auth.signUp({ email, password })
    if (error) {
      setMessage(`❌ ${error.message}`)
    } else {
      setMessage("✅ Signup successful! Check your email for confirmation.")
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setMessage("Logging in...")

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setMessage(`❌ ${error.message}`)
    } else {
      setMessage("✅ Login successful! Redirecting…")
      router.push("/dashboard")
    }
  }

  return (
    <Card>
      <h2 className="text-xl font-bold mb-4">Welcome to Arion Flow</h2>

      <form onSubmit={handleLogin} className="flex flex-col gap-2 mb-4">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border rounded px-3 py-2"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border rounded px-3 py-2"
          required
        />
        <div className="flex gap-2">
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded"
          >
            Log In
          </button>
          <button
            type="button"
            onClick={handleSignup}
            className="bg-gray-600 text-white px-4 py-2 rounded"
          >
            Sign Up
          </button>
        </div>
      </form>

      <div className="flex items-center gap-4">
        <button className="flex items-center gap-2 border px-4 py-2 rounded">
          <GoogleIcon /> Sign in with Google
        </button>
        <button className="flex items-center gap-2 border px-4 py-2 rounded">
          <AppleIcon /> Sign in with Apple
        </button>
      </div>

      {message && <p className="mt-4">{message}</p>}
    </Card>
  )
}
