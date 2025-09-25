"use client"

import { useEffect, useState, useCallback } from "react"
import { getSupabaseClient } from "@/lib/supabaseClient"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
    const { data, error } = await supabase.from("roles").select("key, description")
    if (!error && data) {
      setRoles(data as Role[])
    }
  }, [supabase])

  // ✅ fetch organizations
  const fetchOrganizations = useCallback(async () => {
    const { data, error } = await supabase.from("organizations").select("id, name")
    if (!error && data) {
      setOrganizations(data as Organization[])
      if (data.length > 0 && !selectedOrgId) {
        setSelectedOrgId(data[0].id) // default only if none selected
      }
    }
  }, [supabase, selectedOrgId])

  useEffect(() => {
    fetchUsers()
    fetchRoles()
    fetchOrganizations()
  }, [fetchUsers, fetchRoles, fetchOrganizations])

  // ✅ Changed: update state directly instead of re-fetching
  async function toggleField(userId: string, field: keyof UserWithOrg, value: boolean) {
    const { error } = await supabase.from("profiles").update({ [field]: value }).eq("id", userId)
    if (!error) {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, [field]: value } : u))
      )
    }
  }

  // ✅ Changed: update state directly
  async function updateRole(userId: string, role: string) {
    const { error } = await supabase.from("profiles").update({ role }).eq("id", userId)
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
          organization_id: selectedOrgId || undefined,
          org_role: newRole === "arion_admin" ? "admin" : "member",
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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An unknown error occurred."
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
              <div className="space-y-4 mt-4">
                <Input
                  placeholder="Email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
                <div className="grid grid-cols-2 gap-4">
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

                {/* ✅ Organization dropdown */}
                <select
                  className="w-full rounded border px-3 py-2 text-sm"
                  value={selectedOrgId}
                  onChange={(e) => setSelectedOrgId(e.target.value)}
                >
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

                <Button onClick={addUser} className="w-full">
                  Create
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <p>Loading users...</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>Job Title</TableHead>
                <TableHead>Authorized</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    {u.first_name} {u.last_name}
                  </TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>{u.organization_name || "—"}</TableCell>
                  <TableCell>{u.job_title || "—"}</TableCell>
                  <TableCell>
                    <Switch
                      checked={u.authorized}
                      onCheckedChange={(val) => toggleField(u.id, "authorized", val)}
                    />
                  </TableCell>
                  <TableCell>
                    <select
                      className="rounded border px-2 py-1 text-sm"
                      value={u.role || ""}
                      onChange={(e) => updateRole(u.id, e.target.value)}
                    >
                      <option value="">—</option>
                      {roles.map((r) => (
                        <option key={r.key} value={r.key}>
                          {r.key}
                        </option>
                      ))}
                    </select>
                  </TableCell>
                  <TableCell>
                    {u.last_login ? new Date(u.last_login).toLocaleString() : "—"}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteUser(u.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}