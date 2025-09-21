"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Card from "@/components/card"
import { getSupabaseClient } from "@/lib/supabaseClient"

export default function AccountPage() {
  const router = useRouter()
  const supabase = getSupabaseClient()

  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [jobTitle, setJobTitle] = useState("")
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push("/auth")
        return
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("first_name, last_name, job_title")
        .eq("id", user.id)
        .single()

      if (!error && data) {
        setFirstName(data.first_name || "")
        setLastName(data.last_name || "")
        setJobTitle(data.job_title || "")
      }
      setLoading(false)
    }

    loadProfile()
  }, [supabase, router])

  async function handleSave() {
    setMessage(null)
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.from("profiles").update({
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      job_title: jobTitle.trim() || null,
    }).eq("id", user.id)

    setLoading(false)
    if (error) {
      setMessage("Failed to update profile.")
    } else {
      setMessage("Profile updated successfully!")
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p>Loading profile…</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-lg p-8 space-y-6">
        <h1 className="text-2xl font-bold">My Account</h1>

        <div className="space-y-4">
          <div>
            <label className="block text-sm mb-1">First Name</label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full rounded-lg border border-border px-4 py-2"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Last Name</label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full rounded-lg border border-border px-4 py-2"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Job Title</label>
            <input
              type="text"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              className="w-full rounded-lg border border-border px-4 py-2"
            />
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={loading}
          className="w-full rounded-lg bg-primary px-4 py-2 text-white font-semibold hover:bg-primary/90 disabled:opacity-50"
        >
          Save Changes
        </button>

        {message && (
          <p className="text-center text-sm mt-4 text-muted-foreground">{message}</p>
        )}
      </Card>
    </main>
  )
}
