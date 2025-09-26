"use client"

import { FormEvent, useState } from "react"
import { useRouter } from "next/navigation"

import Card from "@/components/card"
import { getSupabaseClient } from "@/lib/supabaseClient"
//import TerminateModal from "@/components/TerminateModal" // ✅ For styling reference

interface FormData {
  firstName: string
  lastName: string
  email: string
  password: string
  organizationName: string
  jobTitle: string
}

interface FormErrors {
  firstName?: string
  lastName?: string
  email?: string
  password?: string
  organizationName?: string
  jobTitle?: string
  general?: string
}

// ✅ Added: OrgExistsModal
function OrgExistsModal({
  isOpen,
  onClose,
  onRequestAccess,
  orgName,
}: {
  isOpen: boolean
  onClose: () => void
  onRequestAccess: () => void
  orgName: string
}) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-xl p-6 shadow-lg max-w-md w-full">
        <h2 className="text-xl font-bold mb-4 text-primary">Organization Already Exists</h2>
        <p className="text-muted-foreground mb-6">
          The organization <strong>{orgName}</strong> is already registered. Please contact your
          administrator to be invited, or request access below.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary"
          >
            Cancel
          </button>
          <button
            onClick={onRequestAccess}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Request Access
          </button>
        </div>
      </div>
    </div>
  )
}

export default function SignupPage() {
  const router = useRouter()
  const [formData, setFormData] = useState<FormData>({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    organizationName: "",
    jobTitle: "",
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [isLoading, setIsLoading] = useState(false)

  // ✅ Added state for modal
  const [showOrgExistsModal, setShowOrgExistsModal] = useState(false)
  const [conflictingOrg, setConflictingOrg] = useState("")

  const handleChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()

    const validationErrors: FormErrors = {}
    const requiredFields: Array<keyof FormData> = [
      "firstName",
      "lastName",
      "email",
      "password",
      "organizationName",
    ]
    requiredFields.forEach((field) => {
      if (!formData[field].trim()) {
        validationErrors[field] = "This field is required"
      }
    })
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    setIsLoading(true)
    setErrors({})

    try {
      const supabase = getSupabaseClient()
      const trimmedData = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim(),
        password: formData.password,
        organizationName: formData.organizationName.trim(),
        jobTitle: formData.jobTitle.trim(),
      }

      const response = await fetch("/api/signup", { // ✅ Modified: Call new API route
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(trimmedData),
      })

      const result = await response.json()

      if (response.status === 409 && result?.error === "organization_exists") {
        setConflictingOrg(trimmedData.organizationName)
        setShowOrgExistsModal(true)
        return
      }

      if (response.status === 409 && result?.error === "user_exists") {
        setErrors({ general: result?.message ?? "A user with this email already exists." })
        return
      }

      if (!response.ok) {
        throw new Error(result?.error ?? result?.message ?? "Failed to complete signup.")
      }
      
      // ✅ Added: Sign user in after successful server-side creation
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: trimmedData.email,
        password: trimmedData.password,
      })

      if (signInError) {
        throw new Error(signInError.message)
      }

      // 🚦 Redirect to access pending
      router.push("/access-pending")
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "An unexpected error occurred. Please try again."
      setErrors({ general: message })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-xl p-8">
        <h1 className="text-3xl font-bold text-center text-primary mb-2">
          Create your Arion Flow account
        </h1>
        <p className="text-center text-muted-foreground mb-8">
          Start streamlining your team&apos;s operations in just a few steps.
        </p>

        <form className="space-y-6" onSubmit={handleSubmit} noValidate>
          {/* form fields unchanged */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="firstName" className="text-sm font-medium text-muted-foreground">
                First name
              </label>
              <input
                id="firstName"
                type="text"
                value={formData.firstName}
                onChange={(e) => handleChange("firstName", e.target.value)}
                className="w-full rounded-lg border border-border bg-secondary px-4 py-3 text-foreground"
                required
              />
              {errors.firstName && <p className="text-sm text-red-400">{errors.firstName}</p>}
            </div>
            <div>
              <label htmlFor="lastName" className="text-sm font-medium text-muted-foreground">
                Last name
              </label>
              <input
                id="lastName"
                type="text"
                value={formData.lastName}
                onChange={(e) => handleChange("lastName", e.target.value)}
                className="w-full rounded-lg border border-border bg-secondary px-4 py-3 text-foreground"
                required
              />
              {errors.lastName && <p className="text-sm text-red-400">{errors.lastName}</p>}
            </div>
          </div>

          <div>
            <label htmlFor="email" className="text-sm font-medium text-muted-foreground">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleChange("email", e.target.value)}
              className="w-full rounded-lg border border-border bg-secondary px-4 py-3 text-foreground"
              required
            />
            {errors.email && <p className="text-sm text-red-400">{errors.email}</p>}
          </div>

          <div>
            <label htmlFor="password" className="text-sm font-medium text-muted-foreground">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => handleChange("password", e.target.value)}
              className="w-full rounded-lg border border-border bg-secondary px-4 py-3 text-foreground"
              required
            />
            {errors.password && <p className="text-sm text-red-400">{errors.password}</p>}
          </div>

          <div>
            <label htmlFor="organizationName" className="text-sm font-medium text-muted-foreground">
              Organization name
            </label>
            <input
              id="organizationName"
              type="text"
              value={formData.organizationName}
              onChange={(e) => handleChange("organizationName", e.target.value)}
              className="w-full rounded-lg border border-border bg-secondary px-4 py-3 text-foreground"
              required
            />
            {errors.organizationName && (
              <p className="text-sm text-red-400">{errors.organizationName}</p>
            )}
          </div>

          <div>
            <label htmlFor="jobTitle" className="text-sm font-medium text-muted-foreground">
              Job title (optional)
            </label>
            <input
              id="jobTitle"
              type="text"
              value={formData.jobTitle}
              onChange={(e) => handleChange("jobTitle", e.target.value)}
              className="w-full rounded-lg border border-border bg-secondary px-4 py-3 text-foreground"
            />
            {errors.jobTitle && <p className="text-sm text-red-400">{errors.jobTitle}</p>}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-primary px-4 py-3 text-center text-base font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-70"
          >
            {isLoading ? "Creating Account…" : "Create Account"}
          </button>
        </form>

        {errors.general && (
          <p className="mt-6 text-center text-sm text-red-400">{errors.general}</p>
        )}
      </Card>

      {/* ✅ OrgExistsModal */}
      <OrgExistsModal
        isOpen={showOrgExistsModal}
        orgName={conflictingOrg}
        onClose={() => setShowOrgExistsModal(false)}
        onRequestAccess={() => {
          setShowOrgExistsModal(false)
          alert("Access request sent (placeholder).") // Replace with real logic
        }}
      />
    </main>
  )
}