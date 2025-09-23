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
import { Trash2, UserPlus, CheckCircle } from "lucide-react"

interface RoleRecord {
  name: string
}

interface Profile {
  id: string
  email: string
  first_name: string
  last_name: string
  is_active: boolean
  email_verified: boolean
  last_login: string | null
  roles: RoleRecord[] | null
}

export default function AccountManagementPage() {
  const supabase = getSupabaseClient()
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  // New user modal state
  const [openAdd, setOpenAdd] = useState(false)
  const [newEmail, setNewEmail] = useState("")
  const [newRole, setNewRole] = useState("user")

  async function fetchUsers() {
    setLoading(true)
    const { data, error } = await supabase.from("profiles").select(`
      id, email, first_name, last_name, is_active, email_verified, last_login,
      roles:roles(name)
    `)
    if (!error && data) {
      setUsers(
        (data as Profile[]).map((u) => ({
          ...u,
          roles: u.roles?.map((r) => ({ name: r.name })) || [],
        }))
      )
    }
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchUsers()
  }, [])

  async function toggleField(
    userId: string,
    field: keyof Profile,
    value: boolean
  ) {
    await supabase.from("profiles").update({ [field]: value }).eq("id", userId)
    fetchUsers()
  }

  async function deleteUser(userId: string) {
    if (confirm("Are you sure you want to delete this user?")) {
      await supabase.from("profiles").delete().eq("id", userId)
      fetchUsers()
    }
  }

  async function addUser() {
    await supabase
      .from("profiles")
      .insert([{ email: newEmail, is_active: false, email_verified: false }])
    if (newRole) {
      // optional: insert into roles table
      await supabase
        .from("roles")
        .insert([{ user_id: newEmail, role: newRole }])
    }
    setNewEmail("")
    setNewRole("user")
    setOpenAdd(false)
    fetchUsers()
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
                <Input
                  placeholder="Role"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                />
                <Button onClick={addUser}>Create</Button>
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
                <TableHead>Roles</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Verified</TableHead>
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
                  <TableCell>
                    {u.roles?.map((r) => r.name).join(", ") || "—"}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={u.is_active}
                      onCheckedChange={(val) =>
                        toggleField(u.id, "is_active", val)
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={u.email_verified}
                      onCheckedChange={(val) =>
                        toggleField(u.id, "email_verified", val)
                      }
                    />
                  </TableCell>
                  <TableCell>{u.last_login || "—"}</TableCell>
                  <TableCell className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleField(u.id, "is_active", true)}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" /> Authorize
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteUser(u.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-1" /> Delete
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
