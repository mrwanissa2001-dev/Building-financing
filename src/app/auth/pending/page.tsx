"use client"
import Link from "next/link"
import { AuthCard } from "@/components/auth/auth-card"
import { Button } from "@/components/ui/button"

export default function PendingPage() {
  return (
    <AuthCard
      title="Awaiting approval"
      description="Your account has been submitted and is under review."
    >
      <div className="space-y-4 text-center">
        <div className="rounded-full w-16 h-16 bg-amber-100 dark:bg-amber-950 flex items-center justify-center mx-auto text-3xl">
          ⏳
        </div>
        <p className="text-sm text-muted-foreground">
          You will receive an email notification once your account is approved.
          This typically takes less than 24 hours.
        </p>
        <div className="space-y-2">
          <Button variant="outline" className="w-full" asChild>
            <Link href="/auth/login">Back to sign in</Link>
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => {
            const a = document.createElement('a')
            a.href = 'mailto:support@example.com'
            a.click()
          }}>
            Contact support
          </Button>
        </div>
      </div>
    </AuthCard>
  )
}
