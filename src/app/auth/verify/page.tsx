"use client"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { AuthCard } from "@/components/auth/auth-card"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function VerifyPage() {
  const router = useRouter()

  useEffect(() => {
    const timer = setTimeout(() => router.replace("/auth/login"), 3000)
    return () => clearTimeout(timer)
  }, [router])

  return (
    <AuthCard title="Email verified" description="Redirecting you to sign in...">
      <div className="text-center space-y-3">
        <p className="text-sm text-muted-foreground">
          Your account is pending admin approval. You can sign in once the admin approves your access.
        </p>
        <Button variant="outline" className="w-full" asChild>
          <Link href="/auth/login">Go to sign in</Link>
        </Button>
      </div>
    </AuthCard>
  )
}
