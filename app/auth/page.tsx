"use client"

import { useState } from "react"
// import { getSupabaseClient } from "../../lib/supabaseClient" 
import { useRouter } from "next/navigation"
import Card from "@/components/card"
import GoogleIcon from "@/components/icons/GoogleIcon"
import AppleIcon from "@/components/icons/AppleIcon"

export default function AuthPage() {
  const router = useRouter()
  // const supabase = getSupabaseClient()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [message, setMessage] = useState("")

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setMessage("✅ Signup successful! Check your email for confirmation.")
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setMessage("✅ Login successful! Redirecting…")
    setTimeout(() => router.push("/dashboard"), 1500)
  }

  async function handleOAuth(provider: 'google' | 'apple') {
    setMessage(`Redirecting to ${provider}...`)
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card>
        <h2 className="text-3xl font-bold mb-6 text-center text-primary">
          Welcome to Arion Flow
        </h2>

        <form className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-3 bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-3 bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
            required
          />

          <div className="flex space-x-4 pt-2">
            <button
              type="button"
              onClick={handleLogin}
              className="flex-1 bg-primary text-primary-foreground font-bold p-3 rounded-lg hover:bg-primary/90 transition-opacity"
            >
              Log In
            </button>
            <button
              type="button"
              onClick={handleSignup}
              className="flex-1 bg-border text-foreground font-bold p-3 rounded-lg hover:opacity-90 transition-opacity"
            >
              Sign Up
            </button>
          </div>
        </form>

        {message && <p className="mt-4 text-center text-sm text-muted-foreground">{message}</p>}

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">
              Or continue with
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => handleOAuth('google')}
            className="w-full flex items-center justify-center gap-3 border border-border rounded-lg p-3 text-sm font-semibold text-foreground hover:bg-border transition-colors"
          >
            {/* FIX: Added size class to the icon */}
            <GoogleIcon className="w-5 h-5" />
            Continue with Google
          </button>
          <button
            type="button"
            onClick={() => handleOAuth('apple')}
            className="w-full flex items-center justify-center gap-3 border border-border rounded-lg p-3 text-sm font-semibold text-foreground hover:bg-border transition-colors"
          >
            {/* FIX: Added size class to the icon */}
            <AppleIcon className="w-5 h-5" />
            Continue with Apple
          </button>
        </div>
      </Card>
    </main>
  )
}