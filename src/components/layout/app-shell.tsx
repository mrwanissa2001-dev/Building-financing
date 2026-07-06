"use client"

import { Sidebar } from "./sidebar"
import { useTheme } from "@/hooks/use-theme"
import { StoreProvider } from "@/lib/store"
import { LayoutProvider } from "@/lib/layout"
import { ToastProvider } from "@/components/ui/use-toast"
import { Toaster } from "@/components/ui/toaster"

export function AppShell({ children }: { children: React.ReactNode }) {
  const { theme, toggleTheme } = useTheme()

  return (
    <StoreProvider>
      <LayoutProvider>
      <ToastProvider>
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
      </LayoutProvider>
    </StoreProvider>
  )
}
