"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { useStore } from "@/lib/store"
import { useI18n, LANGUAGES } from "@/lib/i18n"
import { APP_VERSION } from "@/lib/constants"
import { supabase } from "@/lib/supabase"
import {
  LayoutDashboard,
  Building2,
  Receipt,
  Settings,
  SlidersHorizontal,
  Sun,
  Moon,
  Menu,
  X,
  Globe,
  CalendarDays,
  FileText,
  LogOut,
  ShieldCheck,
} from "lucide-react"
import { useState, useEffect } from "react"

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/apartments", label: "Apartments & Payments", icon: Building2 },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/settings", label: "Building Setup", icon: Settings },
  { href: "/appearance", label: "Settings", icon: SlidersHorizontal },
]

const adminNavItem = { href: "/admin", label: "Admin", icon: ShieldCheck }

interface SidebarProps {
  theme: "light" | "dark"
  toggleTheme: () => void
}

export function Sidebar({ theme, toggleTheme }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const { state } = useStore()
  const { t, lang, setLang } = useI18n()
  const buildingName = state.settings.building_name

  async function handleLogout() {
    if (supabase) {
      await supabase.auth.signOut()
    }
    sessionStorage.removeItem("buildfin.session")
    router.push("/auth/login")
  }

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return
      supabase!
        .from("profiles")
        .select("is_admin")
        .eq("id", session.user.id)
        .single()
        .then(({ data }) => {
          if (data?.is_admin) setIsAdmin(true)
        })
    })
  }, [])

  return (
    <>
      {/* Hamburger — hidden on desktop */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 rtl:left-auto rtl:right-4 z-[50] rounded-lg bg-card p-2 shadow-md lg:hidden"
        aria-label={t("Open menu")}
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-[55] bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          "fixed inset-y-0 start-0 z-[60] w-64 flex-col border-e border-sidebar-border bg-sidebar",
          mobileOpen ? "flex" : "hidden lg:flex"
        )}
      >
        {/* Header */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-sidebar-border px-6">
          <div className="flex items-center gap-2 min-w-0">
            <Building2 className="h-6 w-6 shrink-0 text-primary" />
            <span className="truncate text-lg font-semibold text-sidebar-foreground" title={buildingName || "BuildFin"}>
              {buildingName || "BuildFin"}
            </span>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="rounded-lg p-1 hover:bg-sidebar-accent lg:hidden"
            aria-label={t("Close menu")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto space-y-1 px-3 py-4">
          {[...navItems, ...(isAdmin ? [adminNavItem] : [])].map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {t(item.label)}
              </Link>
            )
          })}
        </nav>

        {/* Footer controls */}
        <div className="shrink-0 border-t border-sidebar-border p-4 space-y-1">
          {/* Language toggle — cycles through the available languages */}
          <button
            onClick={() => {
              const idx = LANGUAGES.findIndex((l) => l.value === lang)
              const next = LANGUAGES[(idx + 1) % LANGUAGES.length]
              setLang(next.value)
            }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
          >
            <Globe className="h-5 w-5 shrink-0" />
            <span className="flex-1 text-start">{t("Language")}</span>
            <span className="text-sidebar-foreground/60">{lang === "ar" ? "العربية" : "English"}</span>
          </button>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
          >
            {theme === "dark" ? <Sun className="h-5 w-5 shrink-0" /> : <Moon className="h-5 w-5 shrink-0" />}
            <span className="flex-1 text-start">{theme === "dark" ? t("Light Mode") : t("Dark Mode")}</span>
          </button>

          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-destructive"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            <span className="flex-1 text-start">Sign out</span>
          </button>

          <p className="px-3 pt-1 text-[10px] text-muted-foreground">BuildFin {APP_VERSION}</p>
        </div>
      </aside>
    </>
  )
}
