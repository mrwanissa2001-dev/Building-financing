"use client"

import { useEffect } from "react"
import { Sidebar } from "./sidebar"
import { useTheme } from "@/hooks/use-theme"
import { StoreProvider } from "@/lib/store"
import { ToastProvider, useToast } from "@/components/ui/use-toast"
import { Toaster } from "@/components/ui/toaster"
import { onSyncError } from "@/lib/supabase-data"

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

export function AppShell({ children }: { children: React.ReactNode }) {
  const { theme, toggleTheme } = useTheme()

  return (
    <StoreProvider>
      <ToastProvider>
        <SyncErrorToaster />
        <div className="flex min-h-screen">
          <Sidebar theme={theme} toggleTheme={toggleTheme} />
          <main className="flex-1 lg:pl-64">
            <div className="mx-auto max-w-7xl px-4 py-6 pt-16 sm:px-6 lg:px-8 lg:pt-6">
              {children}
            </div>
          </main>
        </div>
        <Toaster />
      </ToastProvider>
    </StoreProvider>
  )
}
