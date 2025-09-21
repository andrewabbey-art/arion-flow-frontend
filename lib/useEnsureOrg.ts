"use client"

import { useEffect } from "react"
import { getSupabaseClient } from "./supabaseClient"

export function useEnsureOrg() {
  useEffect(() => {
    async function ensureOrgLink() {
      const supabase = getSupabaseClient()

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // check if already linked
      const { data: existing } = await supabase
        .from("organization_users")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle()

      if (existing) return

      // find their first org
      const { data: org } = await supabase
        .from("organizations")
        .select("id")
        .order("created_at", { ascending: true })
        .limit(1)
        .single()

      if (org) {
        await supabase.from("organization_users").insert({
          user_id: user.id,
          organization_id: org.id,
          role: "admin",
        })
      }
    }

    ensureOrgLink()
  }, [])
}
