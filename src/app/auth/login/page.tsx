"use client"
import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { ADMIN_EMAIL } from "@/lib/constants"
import { AuthCard } from "@/components/auth/auth-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  const reason = searchParams.get("reason")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!supabase) {
      toast({ title: "Database not configured", variant: "destructive" })
      return
    }
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error

      const { data: profile } = await supabase
        .from("profiles")
        .select("status, is_admin, access_until")
        .eq("id", data.user.id)
        .single()

      if (!profile) {
        // No profile yet — auto-create for the admin email
        const isAdmin = data.user.email?.toLowerCase() === ADMIN_EMAIL
        await supabase.from("profiles").insert({
          id: data.user.id,
          email: data.user.email,
          status: isAdmin ? "approved" : "pending_approval",
          is_admin: isAdmin,
        })
        if (!isAdmin) {
          await supabase.auth.signOut()
          router.push("/auth/pending")
          return
        }
      } else {
        if (profile.status === "pending_approval") {
          await supabase.auth.signOut()
          router.push("/auth/pending")
          return
        }
        if (profile.status === "rejected") {
          toast({ title: "Account not approved", description: "Your account application was not approved. Contact the admin.", variant: "destructive" })
          await supabase.auth.signOut()
          return
        }
        if (profile.status === "pending_email") {
          // Legacy status — auto-promote to pending_approval or approved for admin
          const isAdmin = data.user.email?.toLowerCase() === ADMIN_EMAIL
          await supabase.from("profiles").update({
            status: isAdmin ? "approved" : "pending_approval",
            is_admin: isAdmin || profile.is_admin,
          }).eq("id", data.user.id)
          if (!isAdmin) {
            await supabase.auth.signOut()
            router.push("/auth/pending")
            return
          }
        }
        // Enforce the access period (admin/unlimited never expires)
        if (!profile.is_admin && profile.access_until && new Date(profile.access_until).getTime() < Date.now()) {
          toast({
            title: "Access period ended",
            description: "Your access has expired. Contact the admin to renew your access.",
            variant: "destructive",
          })
          await supabase.auth.signOut()
          return
        }
      }

      const sessionToken = crypto.randomUUID()
      await supabase.from("active_sessions").delete().eq("user_id", data.user.id)
      await supabase.from("active_sessions").insert({
        user_id: data.user.id,
        session_token: sessionToken,
        device_hint: navigator.userAgent.slice(0, 200),
      })
      sessionStorage.setItem("buildfin.session", sessionToken)
      router.push("/")
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Sign in failed"
      toast({ title: "Sign in failed", description: msg, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  function handleGuestDemo() {
    const session = {
      id: crypto.randomUUID(),
      startedAt: Date.now(),
      expiresAt: Date.now() + 10 * 60 * 1000,
    }
    sessionStorage.setItem("buildfin.guest.session", JSON.stringify(session))
    router.push("/guest")
  }

  return (
    <AuthCard title="Sign in to BuildFin">
      {reason === "revoked" && (
        <div className="mb-4 rounded-md bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
          You were signed in on another device. You have been signed out here.
        </div>
      )}
      {reason === "expired" && (
        <div className="mb-4 rounded-md bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-3 py-2 text-sm text-red-800 dark:text-red-200">
          Your access period has ended. Contact the admin to renew your access.
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Your password" autoComplete="current-password" />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <div className="mt-4 space-y-2">
        <Button variant="outline" className="w-full" onClick={handleGuestDemo}>
          Try a 10-minute demo — no sign-up needed
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          No account?{" "}
          <Link href="/auth/signup" className="text-primary hover:underline">Create one</Link>
        </p>
      </div>
    </AuthCard>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
