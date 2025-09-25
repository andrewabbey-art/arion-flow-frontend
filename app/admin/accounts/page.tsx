// ✅ Changed: The handleSaveEdit function is now more robust. It verifies that
// the database update was successful before updating the UI to prevent silent failures.

"use client"

import { useEffect, useState, useCallback, ChangeEvent } from "react"
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
import { Trash2, UserPlus, Edit, Save, XCircle } from "lucide-react"
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
  organization_id?: string | null
  organization_name?: string | null
}

export default function AccountManagementPage() {
  const supabase = getSupabaseClient()
  const [users, setUsers] = useState<UserWithOrg[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [editedUserData, setEditedUserData] = useState<Partial<UserWithOrg> | null>(null)

  const [openAdd, setOpenAdd] = useState(false)
  const [newEmail, setNewEmail] = useState("")
  const [newRole, setNewRole] = useState("workspace_user")
  const [newFirstName, setNewFirstName] = useState("")
  const [newLastName, setNewLastName] = useState("")
  const [newJobTitle, setNewJobTitle] = useState("")
  const [newPhone, setNewPhone] = useState("")
  const [newAuthorized, setNewAuthorized] = useState(false)
  const [selectedOrgId, setSelectedOrgId] = useState("")

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from("user_accounts").select("*")
    if (!error && data) {
      setUsers(data as UserWithOrg[])
    }
    setLoading(false)
  }, [supabase])

  const fetchRoles = useCallback(async () => {
    const { data, error } = await supabase.from("roles").select("key, description")
    if (!error && data) {
      setRoles(data as Role[])
    }
  }, [supabase])

  const fetchOrganizations = useCallback(async () => {
    const { data, error } = await supabase.from("organizations").select("id, name")
    if (!error && data) {
      setOrganizations(data as Organization[])
      if (data.length > 0 && !selectedOrgId) {
        setSelectedOrgId(data[0].id)
      }
    }
  }, [supabase, selectedOrgId])

  useEffect(() => {
    fetchUsers()
    fetchRoles()
    fetchOrganizations()
  }, [fetchUsers, fetchRoles, fetchOrganizations])

  async function toggleField(userId: string, field: keyof UserWithOrg, value: boolean) {
    const { error } = await supabase.from("profiles").update({ [field]: value }).eq("id", userId)
    if (!error) {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, [field]: value } : u))
      )
    }
  }

  async function updateRole(userId: string, role: string) {
    const { error } = await supabase.from("profiles").update({ role }).eq("id", userId)
    if (!error) {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role } : u))
      )
    }
  }

  async function deleteUser(userId: string) {
    if (confirm("Are you sure you want to delete this user?")) {
      const { data, error } = await supabase.rpc('delete_user_and_profile', { user_id_to_delete: userId });
      if (!error) {
        setUsers((prev) => prev.filter((u) => u.id !== userId))
      } else {
        alert("Error deleting user: " + error.message)
      }
    }
  }

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
      await fetchUsers() 
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

  const handleEdit = (user: UserWithOrg) => {
    setEditingUserId(user.id)
    setEditedUserData({ ...user })
  }

  const handleCancelEdit = () => {
    setEditingUserId(null)
    setEditedUserData(null)
  }

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    if (editedUserData) {
      setEditedUserData({ ...editedUserData, [name]: value })
    }
  }

  // ✅ Changed: This function now verifies the update was successful.
  const handleSaveEdit = async () => {
    if (!editingUserId || !editedUserData) return

    const updateData = {
      first_name: editedUserData.first_name,
      last_name: editedUserData.last_name,
      job_title: editedUserData.job_title,
      phone: editedUserData.phone,
    }

    // Chain .select() to get the updated row back for verification
    const { data, error } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("id", editingUserId)
      .select() // Ask Supabase to return the updated row(s)

    if (error) {
      console.error("Supabase update error:", error)
      alert("Error updating user: " + error.message)
    } else {
      // Check if any rows were actually updated.
      // If data is null or empty, it likely means RLS prevented the update.
      if (!data || data.length === 0) {
        alert(
          "Update failed. The record was not found or you may not have permission to modify it."
        )
        // We do NOT want to optimistically update the UI in this case.
      } else {
        // Only update the UI if the database was successfully updated
        setUsers((prev) =>
          prev.map((user) =>
            user.id === editingUserId ? { ...user, ...editedUserData } : user
          )
        )
        handleCancelEdit() // Exit edit mode
      }
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
                    value={selectedOrgId}
                    onChange={(e) => setSelectedOrgId(e.target.value)}
                  >
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                      </option>
                    ))}
                  </select>
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
              {users.map((u) => {
                const isEditing = editingUserId === u.id

                return (
                  <TableRow key={u.id}>
                    <TableCell>
                      {isEditing ? (
                        <div className="flex gap-2">
                          <Input
                            name="first_name"
                            value={editedUserData?.first_name || ""}
                            onChange={handleInputChange}
                            placeholder="First Name"
                            className="min-w-[100px]"
                          />
                          <Input
                            name="last_name"
                            value={editedUserData?.last_name || ""}
                            onChange={handleInputChange}
                            placeholder="Last Name"
                             className="min-w-[100px]"
                          />
                        </div>
                      ) : (
                        `${u.first_name || ''} ${u.last_name || ''}`.trim() || '—'
                      )}
                    </TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>{u.organization_name || "—"}</TableCell>
                    <TableCell>
                      {isEditing ? (
                        <Input
                          name="job_title"
                          value={editedUserData?.job_title || ""}
                          onChange={handleInputChange}
                          placeholder="Job Title"
                        />
                      ) : (
                        u.job_title || "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={u.authorized}
                        onCheckedChange={(val) => toggleField(u.id, "authorized", val)}
                        disabled={isEditing}
                      />
                    </TableCell>
                    <TableCell>
                      <select
                        className="rounded border bg-background px-2 py-1 text-sm"
                        value={u.role || ""}
                        onChange={(e) => updateRole(u.id, e.target.value)}
                        disabled={isEditing}
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
                    <TableCell className="flex gap-2">
                      {isEditing ? (
                        <>
                          <Button size="sm" onClick={handleSaveEdit} variant="outline">
                            <Save className="h-4 w-4" />
                          </Button>
                          <Button size="sm" onClick={handleCancelEdit} variant="ghost">
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button size="sm" onClick={() => handleEdit(u)} variant="outline">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => deleteUser(u.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}