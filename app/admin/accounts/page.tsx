"use client"

import { useEffect, useState } from "react"
import { getSupabaseClient } from "@/lib/supabaseClient"

export default function AccountManagementPage() {
  const supabase = getSupabaseClient()
  const [users, setUsers] = useState<any[]>([])
  const [organizations, setOrganizations] = useState<any[]>([])
  const [newEmail, setNewEmail] = useState("")
  const [newFirstName, setNewFirstName] = useState("")
  const [newLastName, setNewLastName] = useState("")
  const [newJobTitle, setNewJobTitle] = useState("")
  const [newPhone, setNewPhone] = useState("")
  const [newRole, setNewRole] = useState("user")
  const [newAuthorized, setNewAuthorized] = useState(false)
  const [selectedOrgId, setSelectedOrgId] = useState("")

  useEffect(() => {
    async function fetchUsers() {
      const { data, error } = await supabase.from("profiles").select("*")
      if (!error && data) {
        setUsers(data)
      }
    }

    async function fetchOrgs() {
      const { data, error } = await supabase.from("organizations").select("*")
      if (!error && data) {
        setOrganizations(data)
      }
    }

    fetchUsers()
    fetchOrgs()
  }, [supabase])

  async function updateRole(userId: string, role: string) {
    const { error } = await supabase
      .from("profiles")
      .update({ role })
      .eq("id", userId)

    if (!error) {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role } : u))
      )
    }
  }

  // ✅ Changed: update state directly
  async function deleteUser(userId: string) {
    if (confirm("Are you sure you want to delete this user?")) {
      const { error } = await supabase.from("profiles").delete().eq("id", userId)
      if (!error) {
        setUsers((prev) => prev.filter((u) => u.id !== userId))
      }
    }
  }

  // ✅ Changed: update state directly
  async function addUser() {
    if (!newEmail) {
      alert("Email is required.")
      return
    }

    try {
      // ✅ Changed: trim orgId and handle empty
      const organizationId = selectedOrgId.trim()

      const res = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail,
          first_name: newFirstName,
          last_name: newLastName,
          job_title: newJobTitle,
          phone: newPhone,
          role: newRole,
          authorized: newAuthorized,
          // ✅ Changed: conditional org assignment
          organization_id: organizationId || undefined,
          org_role:
            organizationId
              ? newRole === "arion_admin"
                ? "admin"
                : "member"
              : undefined,
        }),
      })

      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || "An unknown error occurred.")
      }

      alert("Invitation sent successfully!")

      // ✅ Add new user locally
      setUsers((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(), // placeholder until Supabase updates with real ID
          email: newEmail,
          first_name: newFirstName,
          last_name: newLastName,
          job_title: newJobTitle || null,
          phone: newPhone || null,
          authorized: newAuthorized,
          role: newRole,
          last_login: null,
          organization_name:
            organizations.find((org) => org.id === selectedOrgId)?.name || null,
        },
      ])
    } catch (err: any) {
      console.error(err)
      alert(err.message)
    }
  }

  return (
    <div>
      {/* JSX to render accounts table + add form */}
    </div>
  )
}
