"use client"

import { useEffect, useState, useCallback } from "react"
import { getSupabaseClient } from "@/lib/supabaseClient"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Trash2, UserPlus } from "lucide-react"
import { Label } from "@/components/ui/label"

interface Role {
  key: string
  description: string
}

interface Organization {
  id: string
  name: string
}

interface UserWithOrg {
  id: string
  email: string
  first_name: string
  last_name: string
  job_title: string | null
  phone: string | null
  authorized: boolean
  last_login: string | null
  role: string | null
  organization_name?: string | null
}

// ✅ Changed: regex for UUID validation
const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export default function AccountManagementPage() {
  const supabase = getSupabaseClient()
  const [users, setUsers] = useState<UserWithOrg[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [organizations, setOrganizations] = useState<Organization[]>([])

  const [loading, setLoading] = useState(true)

  const [openAdd, setOpenAdd] = useState(false)
  const [newEmail, setNewEmail] = useState("")
  const [newRole, setNewRole] = useState("workspace_user")
  const [newFirstName, setNewFirstName] = useState("")
  const [newLastName, setNewLastName] = useState("")
  const [newJobTitle, setNewJobTitle] = useState("")
  const [newPhone, setNewPhone] = useState("")
  const [newAuthorized, setNewAuthorized] = useState(false)
  const [selectedOrgId, setSelectedOrgId] = useState("")

  // ✅ fetch users from the new view
  const fetchUsers = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from("user_accounts").select("*")
    if (!error && data) {
      setUsers(data as UserWithOrg[])
    }
    setLoading(false)
  }, [supabase])

  // ✅ fetch roles
  const fetchRoles = useCallback(async () => {
    const { data, error } = await supabase
      .from("roles")
      .select("key, description")
    if (!error && data) {
      setRoles(data as Role[])
    }
  }, [supabase])

  // ✅ fetch organizations
  const fetchOrganizations = useCallback(async () => {
    const { data, error } = await supabase
      .from("organizations")
      .select("id, name")
    if (!error && data) {
      setOrganizations(data as Organization[])
    }
  }, [supabase])

  useEffect(() => {
    fetchUsers()
    fetchRoles()
    fetchOrganizations()
  }, [fetchUsers, fetchRoles, fetchOrganizations])

  // ✅ Changed: reset orgId if it no longer exists
  useEffect(() => {
    if (
      selectedOrgId &&
      !organizations.some((organization) => organization.id === selectedOrgId)
    ) {
      setSelectedOrgId("")
    }
  }, [organizations, selectedOrgId])

  // ✅ Changed: update state directly instead of re-fetching
  async function toggleField(
    userId: string,
    field: keyof UserWithOrg,
    value: boolean
  ) {
    const { error } = await supabase
      .from("profiles")
      .update({ [field]: value })
      .eq("id", userId)
    if (!error) {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, [field]: value } : u))
      )
    }
  }

  // ✅ Changed: update state directly
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

  // ✅ Changed: add user with normalization
  async function addUser() {
    const email = newEmail.trim()

    if (!email) {
      alert("Email is required.")
      return
    }

    try {
      const organizationId = selectedOrgId.trim()
      const normalizedOrgId =
        organizationId && uuidRegex.test(organizationId) ? organizationId : ""

      const firstName = newFirstName.trim()
      const lastName = newLastName.trim()
      const jobTitle = newJobTitle.trim()
      const phone = newPhone.trim()

      const res = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          first_name: firstName || undefined,
          last_name: lastName || undefined,
          job_title: jobTitle || undefined,
          phone: phone || undefined,
          role: newRole,
          authorized: newAuthorized,
          organization_id: normalizedOrgId || undefined,
          org_role:
            normalizedOrgId
              ? newRole === "arion_admin"
                ? "admin"
                : "member"
              : undefined,
        }),
      })

      const json: unknown = await res.json()
      if (!res.ok) {
        const errorMessage =
          typeof json === "object" &&
          json !== null &&
          "error" in json &&
          typeof (json as any).error === "string"
            ? (json as any).error
            : "An unknown error occurred."
        throw new Error(errorMessage)
      }

      alert("Invitation sent successfully!")

      // ✅ Changed: refresh from backend instead of optimistic local add
      await fetchUsers()
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "An unknown error occurred."
      alert(`Error inviting user: ${message}`)
    } finally {
      setNewEmail("")
      setNewFirstName("")
      setNewLastName("")
      setNewJobTitle("")
      setNewPhone("")
      setNewAuthorized(false)
      setNewRole("workspace_user")
      setOpenAdd(false)
    }
  }

  return (
    <Card className="p-6">
      <CardContent>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Account Management</h2>
          <Dialog open={openAdd} onOpenChange={setOpenAdd}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="mr-2 h-4 w-4" /> Add User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New User</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <Input
                  placeholder="Email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
                <div className="flex space-x-2">
                  <Input
                    placeholder="First Name"
                    value={newFirstName}
                    onChange={(e) => setNewFirstName(e.target.value)}
                  />
                  <Input
                    placeholder="Last Name"
                    value={newLastName}
                    onChange={(e) => setNewLastName(e.target.value)}
                  />
                </div>
                <Input
                  placeholder="Job Title"
                  value={newJobTitle}
                  onChange={(e) => setNewJobTitle(e.target.value)}
                />
                <Input
                  placeholder="Phone (Optional)"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                />

                {/* ✅ Changed: Organization dropdown includes "No organization" */}
                <select
                  className="w-full rounded border px-3 py-2 text-sm"
                  value={selectedOrgId}
                  onChange={(e) => setSelectedOrgId(e.target.value)}
                >
                  <option value="">No organization</option>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>

                {/* Role dropdown */}
                <select
                  className="w-full rounded border px-3 py-2 text-sm"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                >
                  {roles.map((r) => (
                    <option key={r.key} value={r.key}>
                      {r.key}
                    </option>
                  ))}
                </select>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="new-authorized"
                    checked={newAuthorized}
                    onCheckedChange={setNewAuthorized}
                  />
                  <Label htmlFor="new-authorized">Authorized</Label>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={addUser}>Send Invite</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* TODO: render table of users here */}
      </CardContent>
    </Card>
  )
}
