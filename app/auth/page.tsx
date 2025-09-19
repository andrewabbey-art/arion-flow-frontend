"use client"

import { useState } from "react"
import { supabase } from "../../lib/supabaseClient"
import { useRouter } from "next/navigation"
import Card from "@/components/card"
import GoogleIcon from "@/components/icons/GoogleIcon" // Import Google icon
import AppleIcon from "@/components/icons/AppleIcon"   // Import Apple icon

export default function AuthPage() {
  const router = useRouter()
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
  
  async function handleOAuth(provider: 'google' | 'apple') {
    setMessage(`Redirecting to ${provider}...`)
    const { error } = await supabase.auth.signInWithOAuth({ provider })
    if (error) {
      setMessage(`❌ ${error.message}`)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background/50 p-4 pt-20">
      <Card className="p-8 w-full max-w-md">
        <h2 className="text-3xl font-bold mb-6 text-center text-primary">
          Welcome to Arion Flow
        </h2>

        <form className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-3 bg-background border border-border rounded-[var(--radius)] focus:outline-none focus:ring-2 focus:ring-secondary"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-3 bg-background border border-border rounded-[var(--radius)] focus:outline-none focus:ring-2 focus:ring-secondary"
          />

          <div className="flex space-x-4">
            <button
              onClick={handleLogin}
              className="flex-1 bg-secondary text-primary font-bold p-3 rounded-[var(--radius)] hover:opacity-90 transition-opacity"
            >
              Login
            </button>
            <button
              onClick={handleSignup}
              className="flex-1 bg-accent text-primary font-bold p-3 rounded-[var(--radius)] hover:opacity-90 transition-opacity"
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
            <span className="bg-background px-2 text-muted-foreground">
              Or continue with
            </span>
          </div>
        </div>

        <div className="space-y-3">
           <button
            type="button"
            onClick={() => handleOAuth('google')}
            className="w-full flex items-center justify-center gap-3 border border-border rounded-[var(--radius)] p-3 text-sm font-semibold text-foreground hover:bg-accent/20 transition-colors"
          >
            <GoogleIcon className="w-5 h-5" />
            Continue with Google
          </button>
          <button
            type="button"
            onClick={() => handleOAuth('apple')}
            className="w-full flex items-center justify-center gap-3 border border-border rounded-[var(--radius)] p-3 text-sm font-semibold text-foreground hover:bg-accent/20 transition-colors"
          >
            <AppleIcon className="w-5 h-5" />
            Continue with Apple
          </button>
        </div>
      </Card>
    </div>
  )
}