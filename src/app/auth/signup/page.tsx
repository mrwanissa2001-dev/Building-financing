"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { ADMIN_EMAIL } from "@/lib/constants"
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
  const [isAdminSignup, setIsAdminSignup] = useState(false)

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
      const normalizedEmail = email.trim().toLowerCase()
      const isAdmin = normalizedEmail === ADMIN_EMAIL

      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: { full_name: fullName },
        },
      })
      if (error) throw error

      if (data.user) {
        // Confirm the email immediately (skip email verification)
        // Admin is auto-approved; regular users await admin approval
        await supabase.from("profiles").insert({
          id: data.user.id,
          email: normalizedEmail,
          full_name: fullName || null,
          building_name: buildingName || null,
          status: isAdmin ? "approved" : "pending_approval",
          is_admin: isAdmin,
        })
      }

      if (isAdmin) {
        setIsAdminSignup(true)
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
    if (isAdminSignup) {
      return (
        <AuthCard title="Admin account created" description="You can sign in now.">
          <p className="text-sm text-muted-foreground text-center mb-4">
            Your admin account has been created and is ready to use.
          </p>
          <Button className="w-full" asChild>
            <Link href="/auth/login">Sign in</Link>
          </Button>
        </AuthCard>
      )
    }

    return (
      <AuthCard title="Account submitted" description="Awaiting admin approval.">
        <p className="text-sm text-muted-foreground text-center mb-4">
          Your account has been submitted for review. The admin will approve your access — you will be able to sign in once approved.
        </p>
        <Button variant="outline" className="w-full" asChild>
          <Link href="/auth/login">Back to sign in</Link>
        </Button>
      </AuthCard>
    )
  }

  return (
    <AuthCard title="Create an account" description="Your account will be reviewed by the admin before you can sign in.">
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
