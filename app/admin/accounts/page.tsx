"use client"

import { useEffect, useState, useCallback, ChangeEvent } from "react" // ✅ Added ChangeEvent
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
import { Trash2, UserPlus, Save, X, Edit2 } from "lucide-react" // ✅ Added Save, X, Edit2
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
  const [isOrgSelectionLocked, setIsOrgSelectionLocked] = useState(false) // ✅ Added
    
  // ✅ Added state for editing
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [editedUserData, setEditedUserData] = useState<Partial<UserWithOrg> | null>(null)

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

  // ✅ Modified to fetch organizations from API route to handle filtering
  const fetchOrganizations = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/organizations")
      const payload = (await response.json().catch(() => ({}))) as {
        data?: Organization[]
        error?: string
        meta?: { selectionLocked?: boolean } // ✅ Added
      }

      if (!response.ok) {
        throw new Error(payload.error || "Unable to load organizations.")
      }

      const organizationsData = payload.data ?? []
      setOrganizations(organizationsData)
      setIsOrgSelectionLocked(Boolean(payload.meta?.selectionLocked)) // ✅ Added
      setSelectedOrgId((current) => {
        if (!current || !organizationsData.some((org) => org.id === current)) {
          return organizationsData[0]?.id ?? ""
        }
        return current
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load organizations."
      console.error(message)
      alert(message)
    }
  }, []) // Dependencies removed as API handles user context internally

  const updateProfile = useCallback(
    async (userId: string, updates: Partial<UserWithOrg>) => { // ✅ Added
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      })

      const payload = (await response.json().catch(() => ({}))) as {
        data?: Partial<UserWithOrg>
        error?: string
      }

      if (!response.ok) {
        throw new Error(payload.error || "Failed to update user.")
      }
      return payload.data
    },
    []
  )

  useEffect(() => {
    fetchUsers()
    fetchRoles()
    fetchOrganizations()
  }, [fetchUsers, fetchRoles, fetchOrganizations]) 

  async function toggleField(
    userId: string,
    field: keyof UserWithOrg,
    value: boolean
  ) {
    try {
      const data = await updateProfile(userId, { [field]: value })
      setUsers((prev) =>
        prev.map((user) =>
          user.id === userId ? { ...user, ...data } : user
        )
      )
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "An unknown error occurred."
      alert(`Error updating user status: ${message}`)
    }
  }

  async function updateRole(userId: string, role: string) {
    try {
      const data = await updateProfile(userId, { role })
      setUsers((prev) =>
        prev.map((user) =>
          user.id === userId ? { ...user, ...data } : user
        )
      )
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "An unknown error occurred."
      alert(`Error updating user role: ${message}`)
    }
  }

  async function deleteUser(userId: string) {
    if (confirm("Are you sure you want to delete this user?")) {
      const { error } = await supabase.rpc("delete_user_and_profile", {
        user_id_to_delete: userId,
      })
      
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

    if (!selectedOrgId) { // ✅ Added
      alert("Organization selection is required.") // ✅ Modified
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
          organization_id: selectedOrgId,
          org_role: newRole === "arion_admin" ? "admin" : "member",
        }),
      })

      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || "An unknown error occurred.")
      }

      alert("Invitation sent successfully!")
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
      fetchUsers()
    }
  }

  // ✅ Added logic to filter roles based on current user's privileges
  const restrictedRoles = ["arion_admin"] 

  const availableNewRoles = roles.filter((r) => 
    isOrgSelectionLocked ? !restrictedRoles.includes(r.key) : true
  ) // ✅ Added: Filtered roles for org_admin

  // Enforce default role update if the previous one is restricted
  useEffect(() => { // ✅ Added
    if (isOrgSelectionLocked && newRole === "arion_admin") {
      setNewRole("workspace_user")
    }
  }, [isOrgSelectionLocked, newRole])

  // ✅ Added edit functionality handlers
  const handleEdit = (user: UserWithOrg) => {
    setEditingUserId(user.id)
    setEditedUserData(user)
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

  const handleSaveEdit = async () => {
    if (!editingUserId || !editedUserData) return

    try {
      const updates = Object.fromEntries(
        Object.entries({
          first_name: editedUserData.first_name,
          last_name: editedUserData.last_name,
          job_title: editedUserData.job_title,
          phone: editedUserData.phone,
          authorized: editedUserData.authorized,
          role: editedUserData.role,
        }).filter(([, value]) => value !== undefined)
      ) as Partial<UserWithOrg>

      const data = await updateProfile(editingUserId, updates)

      setUsers((prev) =>
        prev.map((user) =>
          user.id === editingUserId ? { ...user, ...data } : user
        )
      )
      handleCancelEdit()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "An unknown error occurred."
      alert(`Error updating user: ${message}`)
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
                    name="first_name"
                    placeholder="First Name"
                    value={newFirstName}
                    onChange={(e) => setNewFirstName(e.target.value)}
                  />
                  <Input
                    name="last_name"
                    placeholder="Last Name"
                    value={newLastName}
                    onChange={(e) => setNewLastName(e.target.value)}
                  />
                </div>
                <Input
                  name="job_title"
                  placeholder="Job Title"
                  value={newJobTitle}
                  onChange={(e) => setNewJobTitle(e.target.value)}
                />
                <Input
                  name="phone"
                  placeholder="Phone (Optional)"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                />

                {/* ✅ Organization dropdown */}
                <select
                  className="w-full rounded border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60" // ✅ Modified
                  value={selectedOrgId}
                  onChange={(e) => setSelectedOrgId(e.target.value)}
                  disabled={isOrgSelectionLocked || organizations.length <= 1} // ✅ Modified: Disable if locked or only one option
                >
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>

                {/* Role dropdown: Use filtered roles (availableNewRoles) */}
                <select
                  className="w-full rounded border px-3 py-2 text-sm"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                >
                  <option value="">—</option>
                  {availableNewRoles.map((r) => ( // ✅ Modified
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

                <Button onClick={addUser} className="w-full" disabled={!selectedOrgId}>
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
                  {/* ✅ Modified: Render inputs if editing */}
                  {editingUserId === u.id && editedUserData ? (
                    <>
                      <TableCell>
                        <Input
                          name="first_name"
                          value={editedUserData.first_name || ""}
                          onChange={handleInputChange}
                          className="mb-1"
                        />
                        <Input
                          name="last_name"
                          value={editedUserData.last_name || ""}
                          onChange={handleInputChange}
                        />
                      </TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>{u.organization_name || "—"}</TableCell>
                      <TableCell>
                        <Input
                          name="job_title"
                          value={editedUserData.job_title || ""}
                          onChange={handleInputChange}
                        />
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={Boolean(editedUserData.authorized)} // ✅ Modified
                          onCheckedChange={(val) =>
                            setEditedUserData((prev) =>
                              prev ? { ...prev, authorized: val } : prev // ✅ Modified
                            )
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <select
                          className="rounded border px-2 py-1 text-sm"
                          value={editedUserData.role || ""}
                          onChange={(e) =>
                            setEditedUserData((prev) =>
                              prev ? { ...prev, role: e.target.value } : prev // ✅ Modified
                            )
                          }
                        >
                          <option value="">—</option>
                          {/* Use filtered roles for editing */}
                          {availableNewRoles.map((r) => ( // ✅ Modified
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
                        <div className="flex gap-2">
                          <Button size="sm" onClick={handleSaveEdit}>
                            <Save className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="secondary" onClick={handleCancelEdit}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell>
                        {u.first_name} {u.last_name}
                      </TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>{u.organization_name || "—"}</TableCell>
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
                          {/* Use filtered roles for quick update */}
                          {availableNewRoles.map((r) => ( // ✅ Modified
                            <option 
                                key={r.key} 
                                value={r.key}
                            >
                              {r.key}
                            </option>
                          ))}
                           {/* If the current user has a restricted role, show it as selected value but don't include it in options (options are restricted) */}
                          {u.role && restrictedRoles.includes(u.role) && !availableNewRoles.some(r => r.key === u.role) && (
                              <option key={u.role} value={u.role} disabled>
                                  {u.role} (Current)
                              </option>
                          )}
                        </select>
                      </TableCell>
                      <TableCell>
                        {u.last_login
                          ? new Date(u.last_login).toLocaleString()
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleEdit(u)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => deleteUser(u.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}