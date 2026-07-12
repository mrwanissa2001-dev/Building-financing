"use client"

import { useEffect } from "react"
import { supabase } from "@/lib/supabase"

const SESSION_KEY = "buildfin.session"
const HEARTBEAT_INTERVAL_MS = 30_000

export function useSessionGuard(): void {
  useEffect(() => {
    if (!supabase) {
      // Supabase not configured — dev / demo mode, do nothing
      return
    }

    const token = sessionStorage.getItem(SESSION_KEY)
    if (!token) {
      // No session token stored — nothing to guard
      return
    }

    const tick = async () => {
      const { data, error } = await supabase!
        .from("active_sessions")
        .select("id")
        .eq("session_token", token)
        .limit(1)

      if (error) {
        // Network / config error — don't boot the user, just skip this tick
        return
      }

      if (!data || data.length === 0) {
        // Row was removed — another device logged in and revoked this session
        await supabase!.auth.signOut()
        sessionStorage.removeItem(SESSION_KEY)
        window.location.replace("/auth/login?reason=revoked")
        return
      }

      // Row still exists — update heartbeat timestamp
      await supabase!
        .from("active_sessions")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("session_token", token)
    }

    const intervalId = setInterval(tick, HEARTBEAT_INTERVAL_MS)

    return () => {
      clearInterval(intervalId)
    }
  }, [])
}
