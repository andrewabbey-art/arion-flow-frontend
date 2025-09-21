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

      // 🔐 Register user
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: trimmedData.email,
        password: trimmedData.password,
      })
      if (signUpError) throw new Error(signUpError.message)

      const user = signUpData.user
      if (!user) throw new Error("User registration failed.")

      // ✅ Insert profile with authorized = false
      const { error: profileError } = await supabase.from("profiles").insert({
        id: user.id,
        first_name: trimmedData.firstName,
        last_name: trimmedData.lastName,
        job_title: trimmedData.jobTitle || null,
        authorized: false, // 👈 NEW: default to false
      })
      if (profileError) throw new Error(profileError.message)

      // ✅ Create organization
      const { data: organizationData, error: organizationError } = await supabase
        .from("organizations")
        .insert({ name: trimmedData.organizationName })
        .select("id")
        .single()
      if (organizationError) throw new Error(organizationError.message)

      const organizationId = organizationData?.id
      if (!organizationId) throw new Error("Organization creation failed.")

      // ✅ Link user to org
      const { error: organizationUserError } = await supabase.from("organization_users").insert({
        user_id: user.id,
        organization_id: organizationId,
        role: "admin",
      })
      if (organizationUserError) throw new Error(organizationUserError.message)

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

        {/* 🔧 Form stays unchanged */}
        <form className="space-y-6" onSubmit={handleSubmit} noValidate>
          {/* first/last/email/password/org/jobTitle inputs… */}
          {/* … keep exactly as you had them */}
        </form>

        {errors.general && (
          <p className="mt-6 text-center text-sm text-red-400">{errors.general}</p>
        )}
      </Card>
    </main>
  )
}
