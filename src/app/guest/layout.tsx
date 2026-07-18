"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { GuestTimerProvider } from "@/components/guest/guest-timer-provider"
import { GuestBanner } from "@/components/guest/guest-banner"
import { GuestStoreProvider } from "@/lib/guest-store"
import { LanguageProvider } from "@/lib/i18n"
import { LayoutProvider } from "@/lib/layout"
import { ToastProvider } from "@/components/ui/use-toast"
import { Toaster } from "@/components/ui/toaster"
import { Sidebar } from "@/components/layout/sidebar"
import { useTheme } from "@/hooks/use-theme"
import { getGuestSession } from "@/lib/guest-session"

function GuestSessionCheck({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  useEffect(() => {
    if (!getGuestSession()) {
      router.replace("/auth/login")
    }
  }, [router])
  return <>{children}</>
}

function GuestApp({ children }: { children: React.ReactNode }) {
  const { theme, toggleTheme } = useTheme()
  return (
    <div className="flex min-h-screen flex-col">
      <GuestBanner />
      <div className="flex flex-1 pt-10">
        <Sidebar theme={theme} toggleTheme={toggleTheme} basePath="/guest" />
        <main className="flex-1 lg:ps-64">
          <div className="mx-auto max-w-7xl px-4 py-6 pt-16 sm:px-6 lg:px-8 lg:pt-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

export default function GuestLayout({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <GuestStoreProvider>
        <LayoutProvider>
          <GuestTimerProvider>
            <ToastProvider>
              <GuestSessionCheck>
                <GuestApp>{children}</GuestApp>
              </GuestSessionCheck>
              <Toaster />
            </ToastProvider>
          </GuestTimerProvider>
        </LayoutProvider>
      </GuestStoreProvider>
    </LanguageProvider>
  )
}
