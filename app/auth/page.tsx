"use client"

import { useState, FormEvent } from "react"
import { useRouter } from "next/navigation"
import Card from "@/components/card"
import { getSupabaseClient } from "@/lib/supabaseClient"

export default function AuthPage() {
  const router = useRouter()
  const supabase = getSupabaseClient()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function handleLogin(e: FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
    } else if (data?.user) {
      router.push("/dashboard")
    }
    setIsLoading(false)
  }

  async function handleOAuthLogin(provider: "google" | "apple") {
    const { error } = await supabase.auth.signInWithOAuth({ provider })
    if (error) setError(error.message)
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-md p-8">
        <h1 className="text-2xl font-bold text-center mb-6">Login to Arion Flow</h1>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm mb-1" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2"
              required
            />
          </div>

          <div>
            <label className="block text-sm mb-1" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-primary px-4 py-2 text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-70"
          >
            {isLoading ? "Logging in…" : "Login"}
          </button>
        </form>

        {error && <p className="mt-4 text-center text-sm text-red-500">{error}</p>}

        <div className="mt-6 flex flex-col gap-2">
          <button
            onClick={() => handleOAuthLogin("google")}
            className="w-full border border-border rounded-lg px-4 py-2 text-sm font-medium hover:bg-border/10"
          >
            Continue with Google
          </button>
          <button
            onClick={() => handleOAuthLogin("apple")}
            className="w-full border border-border rounded-lg px-4 py-2 text-sm font-medium hover:bg-border/10"
          >
            Continue with Apple
          </button>
        </div>
      </Card>
    </main>
  )
}
