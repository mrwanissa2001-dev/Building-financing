"use client"
import Link from "next/link"
import { AuthCard } from "@/components/auth/auth-card"
import { Button } from "@/components/ui/button"

export default function PendingPage() {
  return (
    <AuthCard
      title="Awaiting approval"
      description="Your account is pending admin review."
    >
      <div className="space-y-4 text-center">
        <div className="rounded-full w-16 h-16 bg-amber-100 dark:bg-amber-950 flex items-center justify-center mx-auto text-3xl">
          &#9203;
        </div>
        <p className="text-sm text-muted-foreground">
          The admin will review your account and approve your access.
          Once approved, you can sign in with your email and password.
        </p>
        <Button variant="outline" className="w-full" asChild>
          <Link href="/auth/login">Back to sign in</Link>
        </Button>
      </div>
    </AuthCard>
  )
}
