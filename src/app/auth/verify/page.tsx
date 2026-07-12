"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { AuthCard } from "@/components/auth/auth-card"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function VerifyPage() {
  const router = useRouter()
  const [status, setStatus] = useState<"checking" | "success" | "error">("checking")

  useEffect(() => {
    async function verify() {
      if (!supabase) { setStatus("error"); return }
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error || !user) { setStatus("error"); return }

      // Update profile status to pending_approval
      await supabase
        .from("profiles")
        .update({ status: "pending_approval" })
        .eq("id", user.id)
        .eq("status", "pending_email") // only if still pending_email

      setStatus("success")
      // Redirect after 2 seconds
      setTimeout(() => router.push("/auth/pending"), 2000)
    }
    verify()
  }, [router])

  return (
    <AuthCard title="Verifying your email…">
      {status === "checking" && (
        <p className="text-center text-sm text-muted-foreground">Confirming your email address…</p>
      )}
      {status === "success" && (
        <div className="text-center space-y-3">
          <p className="text-sm text-green-700 dark:text-green-400 font-medium">Email verified!</p>
          <p className="text-sm text-muted-foreground">Your account is now under review. Redirecting you…</p>
        </div>
      )}
      {status === "error" && (
        <div className="text-center space-y-3">
          <p className="text-sm text-destructive">Verification failed. The link may have expired.</p>
          <Button variant="outline" className="w-full" asChild>
            <Link href="/auth/signup">Try signing up again</Link>
          </Button>
        </div>
      )}
    </AuthCard>
  )
}
