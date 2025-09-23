"use client"

import { useEffect, useState } from "react"
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

interface Profile {
  id: string
  email: string
  first_name: string
  last_name: string
  job_title: string | null
  phone: string | null
  is_active: boolean
  email_verified: boolean
  authorized: boolean
  last_login: string | null
  role: string | null
}

export default function AccountManagementPage() {
  const supabase = getSupabaseClient()
  const [users, setUsers] = useState<Profile[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)

  const [openAdd, setOpenAdd] = useState(false)
  const [newEmail, setNewEmail] = useState("")
  const [newRole, setNewRole] = useState("workspace_user")
  const [newFirstName, setNewFirstName] = useState("")
  const [newLastName, setNewLastName] = useState("")
  const [newJobTitle, setNewJobTitle] = useState("")
  const [newPhone, setNewPhone] = useState("")
  const [newAuthorized, setNewAuthorized] = useState(false)

  async function fetchUsers() {
    setLoading(true)
    const { data, error } = await supabase.from("profiles").select("*")
    if (!error && data) {
      setUsers(data as Profile[])
    }
    setLoading(false)
  }

  async function fetchRoles() {
    const { data, error } = await supabase
      .from("roles")
      .select("key, description")
    if (!error && data) {
      setRoles(data as Role[])
    }
  }

  useEffect(() => {
    fetchUsers()
    fetchRoles()
  }, [])

  async function toggleField(
    userId: string,
    field: keyof Profile,
    value: boolean
  ) {
    await supabase.from("profiles").update({ [field]: value }).eq("id", userId)
    fetchUsers()
  }

  async function updateRole(userId: string, role: string) {
    await supabase.from("profiles").update({ role }).eq("id", userId)
    fetchUsers()
  }

  async function deleteUser(userId: string) {
    if (confirm("Are you sure you want to delete this user?")) {
      await supabase.from("profiles").delete().eq("id", userId)
      fetchUsers()
    }
  }

  // ✅ Updated addUser function
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
        }),
      })

      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || "An unknown error occurred.")
      }

      alert("Invitation sent successfully!")
    } catch (err: any) {
      alert(`Error inviting user: ${err.message}`)
    } finally {
      setNewEmail("")
      setNewFirstName("")
      setNewLastName("")
      setNewJobTitle("")
      setNewPhone("")
      setNewAuthorized(false)
      setNewRole("workspace_user")
      setOpenAdd(false)
      fetchUsers()
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
                  <TableCell>{u.job_title || "—"}</TableCell>
                  <TableCell>
                    <Switch
                      checked={u.authorized}
                      onCheckedChange={(val) =>
                        toggleField(u.id, "authorized", val)
                      }
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
                    {u.last_login
                      ? new Date(u.last_login).toLocaleString()
                      : "—"}
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
