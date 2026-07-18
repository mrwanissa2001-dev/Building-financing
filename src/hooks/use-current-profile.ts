"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

export type CurrentProfile = {
  id: string
  email: string | null
  full_name: string | null
  is_admin: boolean
  status: string
  access_until: string | null
}

/** True when the access period has ended (admin/unlimited never expires) */
export function isAccessExpired(p: { is_admin?: boolean; access_until: string | null }): boolean {
  if (p.is_admin) return false
  if (!p.access_until) return false
  return new Date(p.access_until).getTime() < Date.now()
}

/** Fetches the signed-in user's profile once. */
export function useCurrentProfile(): { profile: CurrentProfile | null; loading: boolean } {
  const [profile, setProfile] = useState<CurrentProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    if (!supabase) {
      setLoading(false)
      return
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        if (active) setLoading(false)
        return
      }
      supabase!
        .from("profiles")
        .select("id, email, full_name, is_admin, status, access_until")
        .eq("id", session.user.id)
        .single()
        .then(({ data }) => {
          if (!active) return
          setProfile((data as CurrentProfile) ?? null)
          setLoading(false)
        })
    })
    return () => {
      active = false
    }
  }, [])

  return { profile, loading }
}
