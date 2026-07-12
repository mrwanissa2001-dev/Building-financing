"use client"

import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react"

// ── Widget registry ──
// The canonical set of customizable widgets per page, in default order.
// Adding an entry here makes it appear (enabled) for existing users on next
// load; removing one drops it from saved configs automatically.

export type PageKey = "dashboard" | "apartments" | "expenses" | "calendar" | "reports"

export interface WidgetDef {
  key: string
  label: string
}

export const REGISTRY: Record<PageKey, WidgetDef[]> = {
  dashboard: [
    { key: "balance", label: "Total balance" },
    { key: "collected", label: "Collected this month" },
    { key: "spent", label: "Spent this month" },
    { key: "net", label: "Net this month" },
    { key: "income_expenses", label: "Income vs expenses chart" },
    { key: "running_balance", label: "Running balance chart" },
    { key: "category", label: "Expenses by category" },
    { key: "occupancy", label: "Occupancy" },
    { key: "budget", label: "Budget vs actual" },
    { key: "collection_grid", label: "Payments collection grid" },
    { key: "expenses_grid", label: "Recurring expenses grid" },
    { key: "overdue", label: "Overdue alerts" },
    { key: "history", label: "Previous years" },
    { key: "tasks", label: "Tasks" },
    { key: "notes", label: "Notes" },
    { key: "calculator", label: "Calculator" },
  ],
  apartments: [
    { key: "summary", label: "Summary table" },
    { key: "collection_grid", label: "Collection grid" },
    { key: "payment_log", label: "Payment log" },
  ],
  expenses: [
    { key: "recurring_grid", label: "Recurring expenses grid" },
    { key: "expenses_table", label: "Expenses table" },
  ],
  calendar: [],
  reports: [],
}

export const PAGE_LABELS: Record<PageKey, string> = {
  dashboard: "Dashboard",
  apartments: "Apartments & Payments",
  expenses: "Expenses",
  calendar: "Calendar",
  reports: "Reports",
}

export interface WidgetState {
  key: string
  visible: boolean
}

type LayoutConfig = Record<PageKey, WidgetState[]>

const STORAGE_KEY = "buildfin.layout.v1"

function defaultsFor(page: PageKey): WidgetState[] {
  return REGISTRY[page].map((w) => ({ key: w.key, visible: true }))
}

function defaultConfig(): LayoutConfig {
  return {
    dashboard: defaultsFor("dashboard"),
    apartments: defaultsFor("apartments"),
    expenses: defaultsFor("expenses"),
    calendar: [],
    reports: [],
  }
}

// Reconcile a saved config with the current registry: keep saved order +
// visibility for keys that still exist, append any newly-added widgets, and
// drop keys that no longer exist.
function reconcile(page: PageKey, saved: WidgetState[] | undefined): WidgetState[] {
  const valid = new Set(REGISTRY[page].map((w) => w.key))
  const savedValid = (saved ?? []).filter((s) => valid.has(s.key))
  const seen = new Set(savedValid.map((s) => s.key))
  const appended = REGISTRY[page]
    .filter((w) => !seen.has(w.key))
    .map((w) => ({ key: w.key, visible: true }))
  return [...savedValid, ...appended]
}

interface LayoutContextValue {
  order: (page: PageKey) => WidgetState[]
  visibleKeys: (page: PageKey) => string[]
  toggle: (page: PageKey, key: string) => void
  move: (page: PageKey, key: string, dir: -1 | 1) => void
  reset: (page: PageKey) => void
}

const LayoutContext = createContext<LayoutContextValue | null>(null)

export function LayoutProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<LayoutConfig>(defaultConfig)

  // hydrate from localStorage after mount (avoids SSR/client mismatch)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      const saved = raw ? (JSON.parse(raw) as Partial<LayoutConfig>) : {}
      // hydrate-after-mount to avoid an SSR/client mismatch (same pattern as use-theme)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setConfig({
        dashboard: reconcile("dashboard", saved.dashboard),
        apartments: reconcile("apartments", saved.apartments),
        expenses: reconcile("expenses", saved.expenses),
        calendar: reconcile("calendar", saved.calendar),
        reports: reconcile("reports", saved.reports),
      })
    } catch {
      /* ignore corrupt storage */
    }
  }, [])

  const persist = useCallback((next: LayoutConfig) => {
    setConfig(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      /* storage may be unavailable */
    }
  }, [])

  const toggle = useCallback(
    (page: PageKey, key: string) => {
      persist({
        ...config,
        [page]: config[page].map((w) => (w.key === key ? { ...w, visible: !w.visible } : w)),
      })
    },
    [config, persist]
  )

  const move = useCallback(
    (page: PageKey, key: string, dir: -1 | 1) => {
      const list = [...config[page]]
      const i = list.findIndex((w) => w.key === key)
      const j = i + dir
      if (i < 0 || j < 0 || j >= list.length) return
      ;[list[i], list[j]] = [list[j], list[i]]
      persist({ ...config, [page]: list })
    },
    [config, persist]
  )

  const reset = useCallback(
    (page: PageKey) => {
      persist({ ...config, [page]: defaultsFor(page) })
    },
    [config, persist]
  )

  const value = useMemo<LayoutContextValue>(
    () => ({
      order: (page) => config[page],
      visibleKeys: (page) => config[page].filter((w) => w.visible).map((w) => w.key),
      toggle,
      move,
      reset,
    }),
    [config, toggle, move, reset]
  )

  return <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>
}

export function useLayout(): LayoutContextValue {
  const ctx = useContext(LayoutContext)
  if (!ctx) throw new Error("useLayout must be used within a LayoutProvider")
  return ctx
}
