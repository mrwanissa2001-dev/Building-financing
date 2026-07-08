"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useStore } from "@/lib/store"
import { useI18n } from "@/lib/i18n"
import { APP_VERSION } from "@/lib/constants"
import {
  LayoutDashboard,
  Building2,
  Receipt,
  Settings,
  Sun,
  Moon,
  Menu,
  X,
} from "lucide-react"
import { useState } from "react"

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/apartments", label: "Apartments & Payments", icon: Building2 },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "/settings", label: "Building Setup", icon: Settings },
]

interface SidebarProps {
  theme: "light" | "dark"
  toggleTheme: () => void
}

export function Sidebar({ theme, toggleTheme }: SidebarProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { state } = useStore()
  const { t } = useI18n()
  const buildingName = state.settings.building_name

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 rtl:left-auto rtl:right-4 z-50 rounded-lg bg-card p-2 shadow-md lg:hidden"
        aria-label={t("Open menu")}
      >
        <Menu className="h-5 w-5" />
      </button>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          // hidden/flex instead of translate so the RTL variant can't
          // fight the lg: breakpoint and strand the sidebar off-screen
          "fixed inset-y-0 left-0 rtl:left-auto rtl:right-0 z-50 w-64 flex-col border-r rtl:border-r-0 rtl:border-l border-sidebar-border bg-sidebar",
          mobileOpen ? "flex" : "hidden lg:flex"
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-6">
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

        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => {
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
                <item.icon className="h-5 w-5" />
                {t(item.label)}
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-sidebar-border p-4 space-y-2">
          <button
            onClick={toggleTheme}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
          >
            {theme === "dark" ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
            {theme === "dark" ? t("Light Mode") : t("Dark Mode")}
          </button>
          {/* version stamp so it's obvious which build is deployed */}
          <p className="px-3 text-[10px] text-muted-foreground">BuildFin {APP_VERSION}</p>
        </div>
      </aside>
    </>
  )
}
