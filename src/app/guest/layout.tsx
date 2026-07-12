"use client"
import { GuestTimerProvider } from "@/components/guest/guest-timer-provider"
import { GuestBanner } from "@/components/guest/guest-banner"
import { GuestStoreProvider } from "@/lib/guest-store"
import { LanguageProvider } from "@/lib/i18n"
import { ToastProvider } from "@/components/ui/use-toast"
import { Toaster } from "@/components/ui/toaster"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { getGuestSession } from "@/lib/guest-session"

function GuestSessionCheck({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  useEffect(() => {
    if (!getGuestSession()) {
      // No valid session — redirect to login
      router.replace("/auth/login")
    }
  }, [router])
  return <>{children}</>
}

export default function GuestLayout({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <GuestStoreProvider>
        <GuestTimerProvider>
          <ToastProvider>
            <GuestSessionCheck>
              <div className="flex min-h-screen flex-col">
                <GuestBanner />
                <div className="pt-10 flex flex-1">
                  <main className="flex-1 mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
                    {children}
                  </main>
                </div>
              </div>
            </GuestSessionCheck>
            <Toaster />
          </ToastProvider>
        </GuestTimerProvider>
      </GuestStoreProvider>
    </LanguageProvider>
  )
}
