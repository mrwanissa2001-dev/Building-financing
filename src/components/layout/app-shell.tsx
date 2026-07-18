"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Sidebar } from "./sidebar"
import { useTheme } from "@/hooks/use-theme"
import { StoreProvider } from "@/lib/store"
import { LanguageProvider } from "@/lib/i18n"
import { LayoutProvider } from "@/lib/layout"
import { ToastProvider, useToast } from "@/components/ui/use-toast"
import { Toaster } from "@/components/ui/toaster"
import { onSyncError } from "@/lib/supabase-data"
import { supabase } from "@/lib/supabase"
import { useSessionGuard } from "@/lib/session-guard"

// Database writes happen in the background — surface any failure as a
// toast so data never silently vanishes on the next reload
function SyncErrorToaster() {
  const { toast } = useToast()

  useEffect(() => {
    onSyncError((title, message) => {
      toast({ title, description: message, variant: "destructive", duration: 10000 })
    })
    return () => onSyncError(null)
  }, [toast])

  return null
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [checked, setChecked] = useState(false)
  useSessionGuard()

  useEffect(() => {
    if (!supabase) {
      // No supabase configured — allow access (dev mode / demo)
      setChecked(true)
      return
    }

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.replace("/auth/login")
        return
      }

      // Check profile approval status
      const { data: profile } = await supabase!
        .from("profiles")
        .select("status, is_admin, access_until")
        .eq("id", session.user.id)
        .single()

      if (profile && profile.status !== "approved") {
        await supabase!.auth.signOut()
        router.replace("/auth/pending")
        return
      }

      // Enforce the access period (admin/unlimited never expires)
      if (
        profile &&
        !profile.is_admin &&
        profile.access_until &&
        new Date(profile.access_until).getTime() < Date.now()
      ) {
        await supabase!.auth.signOut()
        sessionStorage.removeItem("buildfin.session")
        router.replace("/auth/login?reason=expired")
        return
      }

      setChecked(true)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        router.replace("/auth/login")
      }
    })

    return () => subscription.unsubscribe()
  }, [router])

  if (!checked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground text-sm">Loading…</div>
      </div>
    )
  }

  return <>{children}</>
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { theme, toggleTheme } = useTheme()
  const pathname = usePathname()

  const isPublicRoute =
    pathname.startsWith("/auth") || pathname.startsWith("/guest")

  if (isPublicRoute) {
    return (
      <LanguageProvider>
        <ToastProvider>
          {children}
          <Toaster />
        </ToastProvider>
      </LanguageProvider>
    )
  }

  return (
    <LanguageProvider>
      <StoreProvider>
        <LayoutProvider>
          <ToastProvider>
            <AuthGuard>
              <SyncErrorToaster />
              <div className="flex min-h-screen">
                <Sidebar theme={theme} toggleTheme={toggleTheme} />
                <main className="flex-1 lg:ps-64">
                  <div className="mx-auto max-w-7xl px-4 py-6 pt-16 sm:px-6 lg:px-8 lg:pt-6">
                    {children}
                  </div>
                </main>
              </div>
              <Toaster />
            </AuthGuard>
          </ToastProvider>
        </LayoutProvider>
      </StoreProvider>
    </LanguageProvider>
  )
}
