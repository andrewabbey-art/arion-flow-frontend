"use client"

import { FormEvent, useState } from "react"
import { useRouter } from "next/navigation"
import Card from "@/components/card"
import { getSupabaseClient } from "@/lib/supabaseClient"

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

  const handleChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }))
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
      const trimmed = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim(),
        password: formData.password,
        organizationName: formData.organizationName.trim(),
        jobTitle: formData.jobTitle.trim(),
      }

      // 1. Sign up user
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: trimmed.email,
        password: trimmed.password,
      })
      if (signUpError) throw new Error(signUpError.message)

      const user = signUpData.user
      if (!user) throw new Error("User registration failed.")

      // 2. Update profile row created by trigger
      await supabase.from("profiles").update({
        first_name: trimmed.firstName,
        last_name: trimmed.lastName,
        job_title: trimmed.jobTitle || null,
      }).eq("id", user.id)

      // 3. Create organization
      const { error: orgError } = await supabase
        .from("organizations")
        .insert({ name: trimmed.organizationName })
      if (orgError) throw new Error(orgError.message)

      // ✅ Done
      router.push("/auth")
    } catch (err) {
      setErrors({
        general: err instanceof Error ? err.message : "Unexpected error occurred",
      })
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
          {/* First + Last name */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="firstName" className="text-sm mb-1">First name</label>
              <input
                id="firstName"
                type="text"
                value={formData.firstName}
                onChange={(e) => handleChange("firstName", e.target.value)}
                className="w-full rounded-lg border border-border px-4 py-2"
              />
              {errors.firstName && <p className="text-sm text-red-400">{errors.firstName}</p>}
            </div>
            <div>
              <label htmlFor="lastName" className="text-sm mb-1">Last name</label>
              <input
                id="lastName"
                type="text"
                value={formData.lastName}
                onChange={(e) => handleChange("lastName", e.target.value)}
                className="w-full rounded-lg border border-border px-4 py-2"
              />
              {errors.lastName && <p className="text-sm text-red-400">{errors.lastName}</p>}
            </div>
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="text-sm mb-1">Work email</label>
            <input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleChange("email", e.target.value)}
              className="w-full rounded-lg border border-border px-4 py-2"
            />
            {errors.email && <p className="text-sm text-red-400">{errors.email}</p>}
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="text-sm mb-1">Password</label>
            <input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => handleChange("password", e.target.value)}
              className="w-full rounded-lg border border-border px-4 py-2"
            />
            {errors.password && <p className="text-sm text-red-400">{errors.password}</p>}
          </div>

          {/* Organization */}
          <div>
            <label htmlFor="organizationName" className="text-sm mb-1">Organization name</label>
            <input
              id="organizationName"
              type="text"
              value={formData.organizationName}
              onChange={(e) => handleChange("organizationName", e.target.value)}
              className="w-full rounded-lg border border-border px-4 py-2"
            />
            {errors.organizationName && (
              <p className="text-sm text-red-400">{errors.organizationName}</p>
            )}
          </div>

          {/* Job title (optional) */}
          <div>
            <label htmlFor="jobTitle" className="text-sm mb-1">Job title (optional)</label>
            <input
              id="jobTitle"
              type="text"
              value={formData.jobTitle}
              onChange={(e) => handleChange("jobTitle", e.target.value)}
              className="w-full rounded-lg border border-border px-4 py-2"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-primary px-4 py-2 text-white font-semibold hover:bg-primary/90 disabled:opacity-50"
          >
            {isLoading ? "Creating Account…" : "Create Account"}
          </button>

          {errors.general && (
            <p className="mt-4 text-center text-sm text-red-500">{errors.general}</p>
          )}
        </form>
      </Card>
    </main>
  )
}
