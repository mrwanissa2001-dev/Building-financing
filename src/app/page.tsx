"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  Wallet,
  Landmark,
  TrendingUp,
  TrendingDown,
  Scale,
  AlertTriangle,
  History,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  ArrowRight,
  Repeat,
} from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts"
import { useComputed } from "@/hooks/use-computed"
import { useStore } from "@/lib/store"
import { useLayout } from "@/lib/layout"
import { formatCurrency, formatDate, cn } from "@/lib/utils"
import { monthKey, currentMonthKey, monthsBetween, monthKeyLabel } from "@/lib/months"
import type { MonthCellStatus } from "@/lib/computations"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { StatCard } from "@/components/dashboard/stat-card"
import { TrendBadge } from "@/components/dashboard/trend-badge"
import { Sparkline } from "@/components/dashboard/sparkline"
import { ChartTooltip } from "@/components/dashboard/chart-tooltip"
import { DateRangePicker, rangeLabel, type DateRange } from "@/components/ui/date-range-picker"

// distinct categorical hues so each expense category reads apart in the donut
const CAT = ["var(--cat-1)", "var(--cat-2)", "var(--cat-3)", "var(--cat-4)", "var(--cat-5)", "var(--cat-6)"]

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

// column span per widget in the 12-col dashboard grid
const SPAN: Record<string, string> = {
  balance: "lg:col-span-3",
  collected: "lg:col-span-3",
  spent: "lg:col-span-3",
  net: "lg:col-span-3",
  income_expenses: "lg:col-span-6",
  running_balance: "lg:col-span-6",
  category: "lg:col-span-4",
  occupancy: "lg:col-span-4",
  budget: "lg:col-span-4",
  collection_grid: "lg:col-span-12",
  expenses_grid: "lg:col-span-12",
  overdue: "lg:col-span-12",
  history: "lg:col-span-12",
}

const unitCompare = (a: string, b: string) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })

const cellClass = (s: MonthCellStatus) =>
  s === "paid" ? "bg-[var(--pos)]" : s === "due" ? "bg-[var(--neg)]" : s === "future" ? "bg-muted border border-border" : "bg-muted/40"
const cellTitle = (s: MonthCellStatus) =>
  s === "paid" ? "Paid" : s === "due" ? "Not paid" : s === "future" ? "Not due yet" : "Not tracked"

/** signed percent change; null when there's no baseline to compare against */
function pctDelta(curr: number, prev: number): number | null {
  if (!prev) return null
  return ((curr - prev) / Math.abs(prev)) * 100
}

/** short axis ticks: 12,400 → "12k", 1,200,000 → "1.2M" */
function compact(n: number): string {
  const a = Math.abs(n)
  if (a >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
  if (a >= 1_000) return `${Math.round(n / 1_000)}k`
  return String(n)
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return "Good morning"
  if (h < 18) return "Good afternoon"
  return "Good evening"
}

/** small "View →" affordance shared by widget headers */
function ViewLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline"
    >
      View <ArrowRight className="h-3.5 w-3.5" />
    </Link>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-40 rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-80 rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-72 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  )
}

export default function DashboardPage() {
  const { state } = useStore()
  const {
    dashboardStats,
    occupancyBreakdown,
    overdueAlerts,
    getMonthlyIncomeExpenses,
    runningBalance,
    budgetVsActual,
    apartmentsWithStatus,
    getMonthCells,
  } = useComputed()
  const { visibleKeys } = useLayout()

  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const y = new Date().getFullYear()
    return { start: `${y}-01-01`, end: `${y}-12-31` }
  })
  const rangeStart = dateRange.start
  const rangeEnd = dateRange.end
  const inRange = useMemo(
    () => (d: string) => (!rangeStart || d >= rangeStart) && (!rangeEnd || d <= rangeEnd),
    [rangeStart, rangeEnd]
  )

  // 12 months of series for sparklines + deltas (independent of the range)
  const months12 = useMemo(() => getMonthlyIncomeExpenses(12), [getMonthlyIncomeExpenses])
  const incomeSeries = months12.map((m) => m.income)
  const expenseSeries = months12.map((m) => m.expenses)
  const netSeries = months12.map((m) => m.income - m.expenses)
  const last = months12.length - 1
  const collectedDelta = last > 0 ? pctDelta(incomeSeries[last], incomeSeries[last - 1]) : null
  const spentDelta = last > 0 ? pctDelta(expenseSeries[last], expenseSeries[last - 1]) : null
  const netDelta = last > 0 ? pctDelta(netSeries[last], netSeries[last - 1]) : null
  const netThisMonth = dashboardStats.collected_this_month - dashboardStats.spent_this_month

  const balanceSeries = useMemo(() => {
    const now = new Date()
    const out: number[] = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i + 1, 0)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
      let bal = 0
      for (const ev of runningBalance) {
        if (ev.date <= key) bal = ev.balance
        else break
      }
      out.push(bal)
    }
    return out
  }, [runningBalance])
  const balanceDelta =
    balanceSeries.length > 1 ? pctDelta(balanceSeries[balanceSeries.length - 1], balanceSeries[balanceSeries.length - 2]) : null

  const catName = useMemo(() => {
    const m = new Map(state.categories.map((c) => [c.id, c.name]))
    return (id: string) => {
      const n = m.get(id) ?? "other"
      return n.charAt(0).toUpperCase() + n.slice(1)
    }
  }, [state.categories])

  const monthsInRange = useMemo(() => {
    const endKey = rangeEnd ? monthKey(rangeEnd) : currentMonthKey()
    let startKey = rangeStart ? monthKey(rangeStart) : ""
    if (!startKey) {
      const dates = [...state.payments.map((p) => p.date_paid), ...state.expenses.map((e) => e.date)].filter(Boolean).sort()
      startKey = dates.length ? monthKey(dates[0]) : monthKey(new Date())
    }
    if (monthsBetween(startKey, endKey) > 23) {
      const [ey, em] = endKey.split("-").map(Number)
      const t = ey * 12 + (em - 1) - 23
      startKey = `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`
    }
    const keys: string[] = []
    for (let k = startKey; k <= endKey && keys.length < 36; ) {
      keys.push(k)
      const [ky, km] = k.split("-").map(Number)
      const t = ky * 12 + (km - 1) + 1
      k = `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`
    }
    const income = new Map<string, number>()
    const expense = new Map<string, number>()
    for (const p of state.payments) if (inRange(p.date_paid)) income.set(monthKey(p.date_paid), (income.get(monthKey(p.date_paid)) ?? 0) + p.amount)
    for (const e of state.expenses) if (inRange(e.date)) expense.set(monthKey(e.date), (expense.get(monthKey(e.date)) ?? 0) + e.amount)
    return keys.map((k) => ({ month: monthKeyLabel(k), income: income.get(k) ?? 0, expenses: expense.get(k) ?? 0 }))
  }, [state.payments, state.expenses, rangeStart, rangeEnd, inRange])

  const balanceInRange = useMemo(() => {
    const filtered = runningBalance.filter((e) => inRange(e.date))
    return filtered.length > 0 ? filtered : runningBalance.slice(-2)
  }, [runningBalance, inRange])

  // category donut within the range — carries the category id for clickthrough
  const donutData = useMemo(() => {
    const map = new Map<string, { id: string; category: string; amount: number }>()
    for (const e of state.expenses) {
      if (!inRange(e.date)) continue
      const cur = map.get(e.category_id) ?? { id: e.category_id, category: catName(e.category_id), amount: 0 }
      cur.amount += e.amount
      map.set(e.category_id, cur)
    }
    const sorted = [...map.values()].sort((a, b) => b.amount - a.amount)
    if (sorted.length <= 6) return sorted
    const top = sorted.slice(0, 5)
    const rest = sorted.slice(5).reduce((s, c) => s + c.amount, 0)
    return [...top, { id: "", category: "Other", amount: rest }]
  }, [state.expenses, inRange, catName])
  const donutTotal = donutData.reduce((s, d) => s + d.amount, 0)

  // ── Collection grid (units × months) ──
  const gridYear = new Date().getFullYear()
  const gridUnits = useMemo(
    () => [...apartmentsWithStatus].sort((a, b) => unitCompare(a.unit_number, b.unit_number)),
    [apartmentsWithStatus]
  )
  const collectedByUnit = useMemo(() => {
    const map = new Map<string, number>()
    const yy = String(gridYear)
    for (const p of state.payments) {
      if (p.date_paid?.slice(0, 4) !== yy) continue
      map.set(p.apartment_id, (map.get(p.apartment_id) ?? 0) + p.amount)
    }
    return map
  }, [state.payments, gridYear])

  // ── Recurring expenses grid ──
  const recurringSeries = useMemo(() => {
    const byKey = new Map<string, { categoryId: string; vendor: string; startKey: string; interval: number; amount: number; paidMonths: Set<string>; totalByYear: Map<number, number> }>()
    for (const e of state.expenses) {
      if (!e.recurring) continue
      const key = `${e.category_id}|${e.vendor.trim().toLowerCase()}`
      const mk = monthKey(e.date)
      let s = byKey.get(key)
      if (!s) {
        s = { categoryId: e.category_id, vendor: e.vendor, startKey: mk, interval: Math.max(1, e.recurring_interval ?? 1), amount: e.amount, paidMonths: new Set(), totalByYear: new Map() }
        byKey.set(key, s)
      }
      if (mk < s.startKey) s.startKey = mk
      s.paidMonths.add(mk)
      const yr = Number(mk.slice(0, 4))
      s.totalByYear.set(yr, (s.totalByYear.get(yr) ?? 0) + e.amount)
    }
    return [...byKey.values()]
      .map((s) => ({ ...s, categoryName: catName(s.categoryId) }))
      .sort((a, b) => a.categoryName.localeCompare(b.categoryName) || a.vendor.localeCompare(b.vendor))
  }, [state.expenses, catName])

  function recurringCell(s: { startKey: string; interval: number; paidMonths: Set<string> }, key: string): MonthCellStatus {
    if (key < s.startKey) return "na"
    if (monthsBetween(s.startKey, key) % s.interval !== 0) return "na"
    if (s.paidMonths.has(key)) return "paid"
    if (key <= currentMonthKey()) return "due"
    return "future"
  }

  const cash = dashboardStats.cash_on_hand
  const bank = dashboardStats.bank_balance
  const splitTotal = Math.max(cash + bank, 0)
  const cashPct = splitTotal > 0 ? (cash / splitTotal) * 100 : 0

  const occupancyItems = [
    { label: "Active", count: occupancyBreakdown.active, color: "var(--chart-1)", href: "/apartments?occupancy=active" },
    { label: "MIA", count: occupancyBreakdown.mia, color: "var(--chart-2)", href: "/apartments?occupancy=mia" },
    { label: "Traveling (paying)", count: occupancyBreakdown.traveling_but_paying, color: "var(--chart-4)", href: "/apartments?occupancy=traveling_but_paying" },
    { label: "Unregistered", count: occupancyBreakdown.unregistered, color: "var(--muted-foreground)", href: "/apartments" },
  ]
  const occupancyTotal = occupancyItems.reduce((s, i) => s + i.count, 0)

  const incExpected = budgetVsActual.income.expected || 1
  const incPct = Math.min(Math.round((budgetVsActual.income.actual / incExpected) * 100), 100)
  const incOver = budgetVsActual.income.actual > budgetVsActual.income.expected
  const expExpected = budgetVsActual.expenditure.expected || 1
  const expPct = Math.min(Math.round((budgetVsActual.expenditure.actual / expExpected) * 100), 100)
  const expOver = budgetVsActual.expenditure.actual > budgetVsActual.expenditure.expected

  if (!state.loaded) return <DashboardSkeleton />

  const now = new Date()
  const yy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, "0")
  const monthStart = `${yy}-${mm}-01`
  const monthEnd = `${yy}-${mm}-${String(new Date(yy, now.getMonth() + 1, 0).getDate()).padStart(2, "0")}`
  const rangeQuery = `start=${rangeStart}&end=${rangeEnd}`

  const heroDeltaUp = balanceDelta !== null && balanceDelta >= 0
  const HeroArrow = balanceDelta === null || Math.abs(balanceDelta) < 0.05 ? Minus : heroDeltaUp ? ArrowUpRight : ArrowDownRight

  // ── Widget nodes, keyed for the layout system ──
  const widgets: Record<string, React.ReactNode> = {
    balance: (
      <Link
        href="/apartments"
        className="group block h-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <div
          className="relative flex h-full flex-col justify-between overflow-hidden rounded-2xl p-5 text-white shadow-card"
          style={{ backgroundImage: "radial-gradient(120% 120% at 100% 0%, color-mix(in oklch, var(--hero-from) 82%, white) 0%, var(--hero-from) 42%, var(--hero-to) 100%)" }}
        >
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 opacity-25">
            <Sparkline data={balanceSeries} color="#ffffff" height={56} />
          </div>
          <div className="relative">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-white/80">Total balance</p>
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/15">
                <Scale className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-2 text-4xl font-semibold leading-none tracking-tight">{formatCurrency(dashboardStats.total_balance)}</p>
            <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-xs font-semibold">
              <HeroArrow className="h-3 w-3" />
              <span className="nums">{balanceDelta === null ? "—" : `${balanceDelta >= 0 ? "+" : ""}${balanceDelta.toFixed(1)}%`}</span>
            </span>
          </div>
          <div className="relative mt-5">
            <div className="flex h-2 w-full overflow-hidden rounded-full bg-white/20">
              <div className="h-full bg-white" style={{ width: `${cashPct}%` }} />
            </div>
            <div className="mt-3 space-y-1.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-white/80"><Wallet className="h-3.5 w-3.5" /> Cash</span>
                <span className="nums font-semibold">{formatCurrency(cash)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-white/80"><Landmark className="h-3.5 w-3.5" /> Bank</span>
                <span className="nums font-semibold">{formatCurrency(bank)}</span>
              </div>
            </div>
          </div>
        </div>
      </Link>
    ),
    collected: (
      <StatCard label="Collected this month" value={formatCurrency(dashboardStats.collected_this_month)} icon={TrendingUp} accent="var(--chart-1)" delta={collectedDelta} deltaLabel="vs last mo" goodWhenUp spark={incomeSeries} href={`/apartments?${rangeQuery}`} />
    ),
    spent: (
      <StatCard label="Spent this month" value={formatCurrency(dashboardStats.spent_this_month)} icon={TrendingDown} accent="var(--chart-2)" delta={spentDelta} deltaLabel="vs last mo" goodWhenUp={false} spark={expenseSeries} href={`/expenses?start=${monthStart}&end=${monthEnd}`} />
    ),
    net: (
      <StatCard label="Net this month" value={formatCurrency(netThisMonth)} icon={Scale} accent="var(--chart-4)" delta={netDelta} deltaLabel="vs last mo" goodWhenUp spark={netSeries} href={`/expenses?start=${monthStart}&end=${monthEnd}`} />
    ),
    income_expenses: (
      <Card className="p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold tracking-tight">Income vs expenses</h2>
            <p className="text-sm text-muted-foreground">Monthly · {rangeLabel(dateRange)}</p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--chart-1)" }} /><span className="text-muted-foreground">Income</span></span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--chart-2)" }} /><span className="text-muted-foreground">Expenses</span></span>
            <ViewLink href={`/expenses?${rangeQuery}`} />
          </div>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthsInRange} margin={{ top: 4, right: 4, left: -8, bottom: 0 }} barGap={4} barCategoryGap="26%">
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={(v: string) => v.split(" ")[0]} className="nums" />
              <YAxis tickLine={false} axisLine={false} width={44} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={compact} className="nums" />
              <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.5 }} content={<ChartTooltip />} />
              <Bar dataKey="income" name="Income" fill="var(--chart-1)" radius={[5, 5, 0, 0]} maxBarSize={22} />
              <Bar dataKey="expenses" name="Expenses" fill="var(--chart-2)" radius={[5, 5, 0, 0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    ),
    running_balance: (
      <Card className="p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold tracking-tight">Running balance</h2>
            <p className="text-sm text-muted-foreground">Cumulative cash position</p>
          </div>
          <ViewLink href={`/apartments?${rangeQuery}`} />
        </div>
        <div className="h-64">
          {balanceInRange.length > 1 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={balanceInRange} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="balFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} minTickGap={28} tickFormatter={(v: string) => new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric" })} className="nums" />
                <YAxis tickLine={false} axisLine={false} width={44} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={compact} className="nums" />
                <Tooltip cursor={{ stroke: "var(--muted-foreground)", strokeOpacity: 0.4 }} content={<ChartTooltip labelFormatter={(l) => new Date(l).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} />} />
                <Area type="monotone" dataKey="balance" name="Balance" stroke="var(--chart-1)" strokeWidth={2} fill="url(#balFill)" activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="flex h-full items-center justify-center text-muted-foreground">No data yet</p>
          )}
        </div>
      </Card>
    ),
    category: (
      <Card className="p-5">
        <div className="mb-2 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold tracking-tight">Expenses by category</h2>
            <p className="text-sm text-muted-foreground">{rangeLabel(dateRange)}</p>
          </div>
          <ViewLink href={`/expenses?${rangeQuery}`} />
        </div>
        {donutData.length > 0 ? (
          <>
            <div className="relative mx-auto h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={donutData} dataKey="amount" nameKey="category" cx="50%" cy="50%" innerRadius={58} outerRadius={82} paddingAngle={2} stroke="var(--card)" strokeWidth={2}>
                    {donutData.map((_, i) => (
                      <Cell key={i} fill={CAT[i % CAT.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xs text-muted-foreground">Total</span>
                <span className="nums text-lg font-semibold">{formatCurrency(donutTotal)}</span>
              </div>
            </div>
            <div className="mt-3 space-y-1.5">
              {donutData.map((d, i) => (
                <Link key={d.category} href={d.id ? `/expenses?category=${d.id}&${rangeQuery}` : `/expenses?${rangeQuery}`} className="flex items-center gap-2 rounded-md px-1 py-0.5 text-sm transition-colors hover:bg-muted/50">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: CAT[i % CAT.length] }} />
                  <span className="truncate text-muted-foreground">{d.category}</span>
                  <span className="nums ml-auto font-medium">{formatCurrency(d.amount)}</span>
                  <span className="nums w-9 text-right text-xs text-muted-foreground">{donutTotal > 0 ? Math.round((d.amount / donutTotal) * 100) : 0}%</span>
                </Link>
              ))}
            </div>
          </>
        ) : (
          <p className="py-16 text-center text-muted-foreground">No expense data</p>
        )}
      </Card>
    ),
    occupancy: (
      <Card className="p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold tracking-tight">Occupancy</h2>
            <p className="text-sm text-muted-foreground">{occupancyTotal} apartment{occupancyTotal !== 1 ? "s" : ""}</p>
          </div>
          <ViewLink href="/apartments" />
        </div>
        {occupancyTotal > 0 ? (
          <div className="flex h-1.5 w-full gap-0.5 overflow-hidden rounded-full">
            {occupancyItems.map((it) => (it.count > 0 ? <div key={it.label} style={{ width: `${(it.count / occupancyTotal) * 100}%`, background: it.color }} /> : null))}
          </div>
        ) : (
          <div className="h-1.5 w-full rounded-full bg-muted" />
        )}
        <div className="mt-4 space-y-1">
          {occupancyItems.map((it) => (
            <Link key={it.label} href={it.href} className="flex items-center gap-2.5 rounded-md px-1 py-1 transition-colors hover:bg-muted/50">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: it.color }} />
              <span className="text-sm text-muted-foreground">{it.label}</span>
              <span className="nums ml-auto text-sm font-semibold">{it.count}</span>
              <span className="nums w-9 text-right text-xs text-muted-foreground">{occupancyTotal > 0 ? Math.round((it.count / occupancyTotal) * 100) : 0}%</span>
            </Link>
          ))}
        </div>
      </Card>
    ),
    budget: (
      <Card className="p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold tracking-tight">Budget vs actual</h2>
            <p className="text-sm text-muted-foreground">Year to date, prorated</p>
          </div>
        </div>
        <div className="space-y-5">
          <Meter label="Income" actual={budgetVsActual.income.actual} expected={budgetVsActual.income.expected} pct={incPct} over={incOver} fill="var(--chart-1)" goodWhenOver href={`/apartments?${rangeQuery}`} />
          <Meter label="Expenditure" actual={budgetVsActual.expenditure.actual} expected={budgetVsActual.expenditure.expected} pct={expPct} over={expOver} fill="var(--chart-4)" goodWhenOver={false} href={`/expenses?${rangeQuery}`} />
        </div>
      </Card>
    ),
    collection_grid: (
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[color-mix(in_oklch,var(--chart-1)_14%,transparent)]"><Wallet className="h-4 w-4" style={{ color: "var(--chart-1)" }} /></span>
            <div>
              <h2 className="font-semibold tracking-tight">Payments collection grid</h2>
              <p className="text-sm text-muted-foreground">Paid months per unit · {gridYear}</p>
            </div>
          </div>
          <ViewLink href="/apartments" />
        </div>
        {gridUnits.length > 0 ? (
          <>
            <div className="max-h-80 overflow-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-card">
                  <tr className="text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="sticky left-0 z-10 bg-card px-3 py-2 text-left font-medium">Unit</th>
                    {MONTH_LABELS.map((m) => (<th key={m} className="px-1 py-2 text-center font-medium">{m}</th>))}
                    <th className="px-3 py-2 text-right font-medium">Collected</th>
                  </tr>
                </thead>
                <tbody>
                  {gridUnits.map((apt) => {
                    const cells = getMonthCells(apt.id, gridYear)
                    return (
                      <tr key={apt.id} className="border-t border-border hover:bg-muted/40">
                        <td className="sticky left-0 z-10 bg-card px-3 py-2 font-medium">
                          <Link href={`/apartments?id=${apt.id}`} className="text-primary underline-offset-4 hover:underline">{apt.unit_number}</Link>
                        </td>
                        {cells.map((s, i) => (
                          <td key={i} className="px-1 py-2 text-center">
                            <div className={cn("mx-auto h-4 w-6 rounded-sm", cellClass(s))} title={`${MONTH_LABELS[i]} ${gridYear}: ${cellTitle(s)}`} />
                          </td>
                        ))}
                        <td className="nums whitespace-nowrap px-3 py-2 text-right font-medium">{formatCurrency(collectedByUnit.get(apt.id) ?? 0)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="inline-block h-3 w-4 rounded-sm bg-[var(--pos)]" /> Paid</span>
              <span className="flex items-center gap-1"><span className="inline-block h-3 w-4 rounded-sm bg-[var(--neg)]" /> Not paid</span>
              <span className="flex items-center gap-1"><span className="inline-block h-3 w-4 rounded-sm border border-border bg-muted" /> Not due yet</span>
            </div>
          </>
        ) : (
          <p className="py-10 text-center text-muted-foreground">No apartments yet</p>
        )}
      </Card>
    ),
    expenses_grid: (
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[color-mix(in_oklch,var(--chart-5)_14%,transparent)]"><Repeat className="h-4 w-4" style={{ color: "var(--chart-5)" }} /></span>
            <div>
              <h2 className="font-semibold tracking-tight">Recurring expenses grid</h2>
              <p className="text-sm text-muted-foreground">Paid months per recurring expense · {gridYear}</p>
            </div>
          </div>
          <ViewLink href="/expenses" />
        </div>
        {recurringSeries.length > 0 ? (
          <>
            <div className="max-h-80 overflow-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-card">
                  <tr className="text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="sticky left-0 z-10 bg-card px-3 py-2 text-left font-medium">Expense</th>
                    {MONTH_LABELS.map((m) => (<th key={m} className="px-1 py-2 text-center font-medium">{m}</th>))}
                    <th className="px-3 py-2 text-right font-medium">Spent</th>
                  </tr>
                </thead>
                <tbody>
                  {recurringSeries.map((s) => (
                    <tr key={`${s.categoryId}|${s.vendor}`} className="border-t border-border hover:bg-muted/40">
                      <td className="sticky left-0 z-10 whitespace-nowrap bg-card px-3 py-2">
                        <Link href={`/expenses?category=${s.categoryId}`} className="font-medium capitalize text-primary underline-offset-4 hover:underline">{s.categoryName}</Link>
                        {s.vendor && <span className="text-xs text-muted-foreground"> · {s.vendor}</span>}
                      </td>
                      {Array.from({ length: 12 }, (_, i) => {
                        const key = `${gridYear}-${String(i + 1).padStart(2, "0")}`
                        const st = recurringCell(s, key)
                        return (<td key={i} className="px-1 py-2 text-center"><div className={cn("mx-auto h-4 w-6 rounded-sm", cellClass(st))} title={`${MONTH_LABELS[i]} ${gridYear}: ${cellTitle(st)}`} /></td>)
                      })}
                      <td className="nums whitespace-nowrap px-3 py-2 text-right font-medium">{formatCurrency(s.totalByYear.get(gridYear) ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="inline-block h-3 w-4 rounded-sm bg-[var(--pos)]" /> Paid</span>
              <span className="flex items-center gap-1"><span className="inline-block h-3 w-4 rounded-sm bg-[var(--neg)]" /> Not paid</span>
              <span className="flex items-center gap-1"><span className="inline-block h-3 w-4 rounded-sm border border-border bg-muted" /> Not due yet</span>
            </div>
          </>
        ) : (
          <p className="py-10 text-center text-muted-foreground">No recurring expenses yet</p>
        )}
      </Card>
    ),
    overdue: (
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[color-mix(in_oklch,var(--chart-2)_14%,transparent)]"><AlertTriangle className="h-4 w-4" style={{ color: "var(--chart-2)" }} /></span>
            <div>
              <h2 className="font-semibold tracking-tight">Overdue alerts</h2>
              <p className="text-sm text-muted-foreground">{overdueAlerts.length} apartment{overdueAlerts.length !== 1 ? "s" : ""} need attention</p>
            </div>
          </div>
          <ViewLink href="/apartments?status=overdue" />
        </div>
        {overdueAlerts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2.5 pr-4 font-medium">Unit</th>
                  <th className="pb-2.5 pr-4 font-medium">Resident</th>
                  <th className="pb-2.5 pr-4 font-medium">Overdue</th>
                  <th className="pb-2.5 pr-4 text-right font-medium">Owed</th>
                  <th className="pb-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {overdueAlerts.map((apt) => (
                  <tr key={apt.id} className="border-b transition-colors last:border-0 hover:bg-muted/40">
                    <td className="py-2.5 pr-4"><Link href={`/apartments?id=${apt.id}`} className="font-medium text-primary underline-offset-4 hover:underline">{apt.unit_number}</Link></td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{apt.primary_resident_name}</td>
                    <td className="py-2.5 pr-4"><span className={apt.days_overdue > 0 ? "font-semibold text-[var(--neg)]" : "text-muted-foreground"}>{apt.days_overdue > 0 ? `${apt.days_overdue} days` : "Due soon"}</span></td>
                    <td className="nums py-2.5 pr-4 text-right font-medium">{formatCurrency(apt.amount_owed)}</td>
                    <td className="py-2.5"><Badge variant={apt.payment_status === "overdue" ? "destructive" : "warning"}>{apt.payment_status === "overdue" ? "Overdue" : "Due soon"}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[color-mix(in_oklch,var(--chart-1)_14%,transparent)]"><TrendingUp className="h-5 w-5" style={{ color: "var(--chart-1)" }} /></span>
            <p className="text-muted-foreground">All apartments are up to date</p>
          </div>
        )}
      </Card>
    ),
    history:
      state.history.length > 0 ? (
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-muted-foreground" />
              <div>
                <h2 className="font-semibold tracking-tight">Previous years</h2>
                <p className="text-sm text-muted-foreground">Migrated yearly totals</p>
              </div>
            </div>
            <ViewLink href="/settings" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2.5 pr-4 font-medium">Year</th>
                  <th className="pb-2.5 pr-4 text-right font-medium">Income</th>
                  <th className="pb-2.5 pr-4 text-right font-medium">Expenditure</th>
                  <th className="pb-2.5 pr-4 text-right font-medium">Net</th>
                  <th className="pb-2.5 font-medium">Breakdown</th>
                </tr>
              </thead>
              <tbody>
                {state.history.map((h) => {
                  const net = h.income - h.expenditure
                  const breakdown = Object.entries(h.expense_breakdown).sort((a, b) => b[1] - a[1])
                  return (
                    <tr key={h.id} className="border-b transition-colors last:border-0 hover:bg-muted/40">
                      <td className="py-2.5 pr-4 font-medium">{h.year}</td>
                      <td className="nums py-2.5 pr-4 text-right">{formatCurrency(h.income)}</td>
                      <td className="nums py-2.5 pr-4 text-right">{formatCurrency(h.expenditure)}</td>
                      <td className={`nums py-2.5 pr-4 text-right font-medium ${net < 0 ? "text-[var(--neg)]" : "text-[var(--pos)]"}`}>{formatCurrency(net)}</td>
                      <td className="py-2.5">
                        {breakdown.length === 0 ? (<span className="text-muted-foreground">—</span>) : (
                          <div className="flex flex-wrap gap-1.5">{breakdown.map(([name, pct]) => (<Badge key={name} variant="outline" className="font-normal capitalize">{name} {pct}%</Badge>))}</div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null,
  }

  const keys = visibleKeys("dashboard").filter((k) => widgets[k] != null)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{greeting()}</p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">{state.settings.building_name || "Building"} overview</h1>
        </div>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {keys.map((k) => (
          <div key={k} className={cn("min-w-0", SPAN[k])}>
            {widgets[k]}
          </div>
        ))}
      </div>
    </div>
  )
}

/** Budget meter — fill carries the accent, track is a quiet wash of it. Links through when href is set. */
function Meter({
  label,
  actual,
  expected,
  pct,
  over,
  fill,
  goodWhenOver,
  href,
}: {
  label: string
  actual: number
  expected: number
  pct: number
  over: boolean
  fill: string
  goodWhenOver: boolean
  href?: string
}) {
  const onTrack = goodWhenOver ? over : !over
  const body = (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="nums text-muted-foreground">{formatCurrency(actual)} <span className="opacity-60">/ {formatCurrency(expected)}</span></span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full" style={{ background: `color-mix(in oklch, ${fill} 16%, transparent)` }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: fill }} />
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="nums">{pct}% of target</span>
        <TrendBadge value={expected ? ((actual - expected) / Math.abs(expected)) * 100 : null} goodWhenUp={goodWhenOver} label={onTrack ? "on track" : "off target"} />
      </div>
    </div>
  )
  return href ? (
    <Link href={href} className="block rounded-lg transition-colors hover:bg-muted/40">
      {body}
    </Link>
  ) : (
    body
  )
}
