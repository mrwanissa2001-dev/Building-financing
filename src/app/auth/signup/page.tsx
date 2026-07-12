"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { AuthCard } from "@/components/auth/auth-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"

export default function SignupPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [buildingName, setBuildingName] = useState("")
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      toast({ title: "Passwords do not match", variant: "destructive" })
      return
    }
    if (password.length < 8) {
      toast({ title: "Password must be at least 8 characters", variant: "destructive" })
      return
    }
    if (!supabase) {
      toast({ title: "Database not configured", variant: "destructive" })
      return
    }
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/verify`,
          data: { full_name: fullName },
        },
      })
      if (error) throw error
      if (data.user) {
        // Insert profile row
        await supabase.from("profiles").insert({
          id: data.user.id,
          email,
          full_name: fullName || null,
          building_name: buildingName || null,
          status: "pending_email",
        })
      }
      setDone(true)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Sign up failed"
      toast({ title: "Sign up failed", description: msg, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <AuthCard title="Check your email" description="We sent a verification link to your inbox.">
        <p className="text-sm text-muted-foreground text-center mb-4">
          Click the link in the email to verify your address. After verification your account will be reviewed before you can sign in.
        </p>
        <Button variant="outline" className="w-full" asChild>
          <Link href="/auth/login">Back to sign in</Link>
        </Button>
      </AuthCard>
    )
  }

  return (
    <AuthCard title="Create an account" description="Your account will be reviewed before you can sign in.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="fullName">Full name</Label>
          <Input id="fullName" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your name" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="confirm">Confirm password</Label>
          <Input id="confirm" type="password" required value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repeat password" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="building">Building name <span className="text-muted-foreground">(optional)</span></Label>
          <Input id="building" value={buildingName} onChange={e => setBuildingName(e.target.value)} placeholder="e.g. Nile Tower" />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Creating account…" : "Create account"}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/auth/login" className="text-primary hover:underline">Sign in</Link>
        </p>
      </form>
    </AuthCard>
  )
}
