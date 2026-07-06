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
import { formatCurrency } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { StatCard } from "@/components/dashboard/stat-card"
import { TrendBadge } from "@/components/dashboard/trend-badge"
import { Sparkline } from "@/components/dashboard/sparkline"
import { ChartTooltip } from "@/components/dashboard/chart-tooltip"
import { RangeToggle, type RangeKey } from "@/components/dashboard/range-toggle"

const RANGE_MONTHS: Record<RangeKey, number> = { "3M": 3, "6M": 6, "12M": 12 }

// emerald sequential ramp — magnitude-ordered slices of the category donut
const SEQ = ["var(--seq-1)", "var(--seq-2)", "var(--seq-3)", "var(--seq-4)", "var(--seq-5)"]

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

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Skeleton className="h-44 rounded-2xl lg:col-span-5" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:col-span-7">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-2xl" />
          ))}
        </div>
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
      <Skeleton className="h-48 rounded-2xl" />
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
    expensesByCategory,
    runningBalance,
    budgetVsActual,
  } = useComputed()

  const [range, setRange] = useState<RangeKey>("12M")

  // Always 12 months of series for the sparklines + deltas, regardless of range.
  const months12 = useMemo(() => getMonthlyIncomeExpenses(12), [getMonthlyIncomeExpenses])
  const incomeSeries = months12.map((m) => m.income)
  const expenseSeries = months12.map((m) => m.expenses)
  const netSeries = months12.map((m) => m.income - m.expenses)

  const last = months12.length - 1
  const collectedDelta = last > 0 ? pctDelta(incomeSeries[last], incomeSeries[last - 1]) : null
  const spentDelta = last > 0 ? pctDelta(expenseSeries[last], expenseSeries[last - 1]) : null
  const netDelta = last > 0 ? pctDelta(netSeries[last], netSeries[last - 1]) : null
  const netThisMonth = dashboardStats.collected_this_month - dashboardStats.spent_this_month

  // Month-end balance for the last 12 months → hero sparkline + balance delta.
  const balanceSeries = useMemo(() => {
    const now = new Date()
    const out: number[] = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i + 1, 0)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
      ).padStart(2, "0")}`
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
    balanceSeries.length > 1
      ? pctDelta(balanceSeries[balanceSeries.length - 1], balanceSeries[balanceSeries.length - 2])
      : null

  // Range-driven series for the time-series charts.
  const monthsInRange = useMemo(
    () => getMonthlyIncomeExpenses(RANGE_MONTHS[range]),
    [getMonthlyIncomeExpenses, range]
  )
  const balanceInRange = useMemo(() => {
    if (runningBalance.length === 0) return []
    const cutoff = new Date()
    cutoff.setMonth(cutoff.getMonth() - RANGE_MONTHS[range])
    const cutKey = cutoff.toISOString().slice(0, 10)
    const filtered = runningBalance.filter((e) => e.date >= cutKey)
    return filtered.length > 0 ? filtered : runningBalance.slice(-2)
  }, [runningBalance, range])

  // Category donut: top 5 slices, remainder folded into "Other".
  const donutData = useMemo(() => {
    const sorted = [...expensesByCategory]
    if (sorted.length <= 5) return sorted
    const top = sorted.slice(0, 4)
    const rest = sorted.slice(4).reduce((s, c) => s + c.amount, 0)
    return [...top, { category: "Other", amount: rest }]
  }, [expensesByCategory])
  const donutTotal = donutData.reduce((s, d) => s + d.amount, 0)

  // Cash vs bank split of the standing balance (where the money sits).
  const cash = dashboardStats.cash_on_hand
  const bank = dashboardStats.bank_balance
  const splitTotal = Math.max(cash + bank, 0)
  const cashPct = splitTotal > 0 ? (cash / splitTotal) * 100 : 0

  // Occupancy — status-coloured, always with labels.
  const occupancyItems = [
    { label: "Active", count: occupancyBreakdown.active, color: "var(--chart-1)" },
    { label: "MIA", count: occupancyBreakdown.mia, color: "var(--chart-2)" },
    { label: "Traveling (paying)", count: occupancyBreakdown.traveling_but_paying, color: "var(--chart-4)" },
    { label: "Unregistered", count: occupancyBreakdown.unregistered, color: "var(--muted-foreground)" },
  ]
  const occupancyTotal = occupancyItems.reduce((s, i) => s + i.count, 0)

  // Budget vs actual meters (YTD, prorated).
  const incExpected = budgetVsActual.income.expected || 1
  const incPct = Math.min(Math.round((budgetVsActual.income.actual / incExpected) * 100), 100)
  const incOver = budgetVsActual.income.actual > budgetVsActual.income.expected
  const expExpected = budgetVsActual.expenditure.expected || 1
  const expPct = Math.min(Math.round((budgetVsActual.expenditure.actual / expExpected) * 100), 100)
  const expOver = budgetVsActual.expenditure.actual > budgetVsActual.expenditure.expected

  if (!state.loaded) return <DashboardSkeleton />

  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  const monthStart = `${y}-${m}-01`
  const monthEnd = `${y}-${m}-${String(new Date(y, now.getMonth() + 1, 0).getDate()).padStart(2, "0")}`

  const heroDeltaUp = balanceDelta !== null && balanceDelta >= 0
  const HeroArrow =
    balanceDelta === null || Math.abs(balanceDelta) < 0.05
      ? Minus
      : heroDeltaUp
      ? ArrowUpRight
      : ArrowDownRight

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{greeting()}</p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">
            {state.settings.building_name || "Building"} overview
          </h1>
        </div>
        <RangeToggle value={range} onChange={setRange} />
      </div>

      {/* ── Hero balance + primary stat tiles ──────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Hero — the one big number of the view */}
        <Link
          href="/apartments"
          className="group rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background lg:col-span-5"
        >
          <div
            className="relative flex h-full flex-col justify-between overflow-hidden rounded-2xl p-6 text-white shadow-card"
            style={{
              backgroundImage:
                "radial-gradient(120% 120% at 100% 0%, color-mix(in oklch, var(--hero-from) 82%, white) 0%, var(--hero-from) 42%, var(--hero-to) 100%)",
            }}
          >
            {/* subtle balance sparkline bleeding across the bottom */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 opacity-30">
              <Sparkline data={balanceSeries} color="#ffffff" height={64} />
            </div>

            <div className="relative">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-white/80">Total balance</p>
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
                  <Scale className="h-[18px] w-[18px]" />
                </span>
              </div>
              <p className="mt-2 text-[2.75rem] font-semibold leading-none tracking-tight">
                {formatCurrency(dashboardStats.total_balance)}
              </p>
              <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-xs font-semibold">
                <HeroArrow className="h-3 w-3" />
                <span className="nums">
                  {balanceDelta === null
                    ? "—"
                    : `${balanceDelta >= 0 ? "+" : ""}${balanceDelta.toFixed(1)}%`}
                </span>
                <span className="font-normal text-white/70">vs last month</span>
              </span>
            </div>

            {/* cash / bank split */}
            <div className="relative mt-6">
              <div className="flex h-2 w-full overflow-hidden rounded-full bg-white/20">
                <div className="h-full bg-white" style={{ width: `${cashPct}%` }} />
              </div>
              <div className="mt-3 flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-white/80" />
                  <span className="text-white/80">Cash</span>
                  <span className="nums font-semibold">{formatCurrency(cash)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Landmark className="h-4 w-4 text-white/80" />
                  <span className="text-white/80">Bank</span>
                  <span className="nums font-semibold">{formatCurrency(bank)}</span>
                </div>
              </div>
            </div>
          </div>
        </Link>

        {/* Primary tiles */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:col-span-7">
          <StatCard
            label="Collected this month"
            value={formatCurrency(dashboardStats.collected_this_month)}
            icon={TrendingUp}
            accent="var(--chart-1)"
            delta={collectedDelta}
            deltaLabel="vs last mo"
            goodWhenUp
            spark={incomeSeries}
            href="/apartments"
          />
          <StatCard
            label="Spent this month"
            value={formatCurrency(dashboardStats.spent_this_month)}
            icon={TrendingDown}
            accent="var(--chart-2)"
            delta={spentDelta}
            deltaLabel="vs last mo"
            goodWhenUp={false}
            spark={expenseSeries}
            href={`/expenses?start=${monthStart}&end=${monthEnd}`}
          />
          <StatCard
            label="Net this month"
            value={formatCurrency(netThisMonth)}
            icon={Scale}
            accent="var(--chart-4)"
            delta={netDelta}
            deltaLabel="vs last mo"
            goodWhenUp
            spark={netSeries}
          />
        </div>
      </div>

      {/* ── Time-series charts (driven by the range toggle) ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Income vs Expenses */}
        <Card className="p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold tracking-tight">Income vs expenses</h2>
              <p className="text-sm text-muted-foreground">Monthly, trailing {RANGE_MONTHS[range]} months</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--chart-1)" }} />
                <span className="text-muted-foreground">Income</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--chart-2)" }} />
                <span className="text-muted-foreground">Expenses</span>
              </span>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthsInRange} margin={{ top: 4, right: 4, left: -8, bottom: 0 }} barGap={4} barCategoryGap="26%">
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickFormatter={(v: string) => v.split(" ")[0]}
                  className="nums"
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={44}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickFormatter={compact}
                  className="nums"
                />
                <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.5 }} content={<ChartTooltip />} />
                <Bar dataKey="income" name="Income" fill="var(--chart-1)" radius={[5, 5, 0, 0]} maxBarSize={22} />
                <Bar dataKey="expenses" name="Expenses" fill="var(--chart-2)" radius={[5, 5, 0, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Running balance */}
        <Card className="p-5">
          <div className="mb-4">
            <h2 className="font-semibold tracking-tight">Running balance</h2>
            <p className="text-sm text-muted-foreground">Cumulative cash position</p>
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
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    minTickGap={28}
                    tickFormatter={(v: string) => {
                      const d = new Date(v)
                      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
                    }}
                    className="nums"
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={44}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickFormatter={compact}
                    className="nums"
                  />
                  <Tooltip
                    cursor={{ stroke: "var(--muted-foreground)", strokeOpacity: 0.4 }}
                    content={
                      <ChartTooltip
                        labelFormatter={(l) =>
                          new Date(l).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        }
                      />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="balance"
                    name="Balance"
                    stroke="var(--chart-1)"
                    strokeWidth={2}
                    fill="url(#balFill)"
                    activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="flex h-full items-center justify-center text-muted-foreground">No data yet</p>
            )}
          </div>
        </Card>
      </div>

      {/* ── Category donut · Occupancy · Budget ────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Expenses by category */}
        <Card className="p-5">
          <div className="mb-2">
            <h2 className="font-semibold tracking-tight">Expenses by category</h2>
            <p className="text-sm text-muted-foreground">Year to date</p>
          </div>
          {donutData.length > 0 ? (
            <>
              <div className="relative mx-auto h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      dataKey="amount"
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      innerRadius={58}
                      outerRadius={82}
                      paddingAngle={2}
                      stroke="var(--card)"
                      strokeWidth={2}
                    >
                      {donutData.map((_, i) => (
                        <Cell key={i} fill={SEQ[i % SEQ.length]} />
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
                  <div key={d.category} className="flex items-center gap-2 text-sm">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SEQ[i % SEQ.length] }} />
                    <span className="truncate text-muted-foreground">{d.category}</span>
                    <span className="nums ml-auto font-medium">{formatCurrency(d.amount)}</span>
                    <span className="nums w-9 text-right text-xs text-muted-foreground">
                      {donutTotal > 0 ? Math.round((d.amount / donutTotal) * 100) : 0}%
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="py-16 text-center text-muted-foreground">No expense data</p>
          )}
        </Card>

        {/* Occupancy */}
        <Card className="p-5">
          <div className="mb-4">
            <h2 className="font-semibold tracking-tight">Occupancy</h2>
            <p className="text-sm text-muted-foreground">
              {occupancyTotal} apartment{occupancyTotal !== 1 ? "s" : ""}
            </p>
          </div>
          {occupancyTotal > 0 ? (
            <div className="flex h-1.5 w-full gap-0.5 overflow-hidden rounded-full">
              {occupancyItems.map((it) =>
                it.count > 0 ? (
                  <div key={it.label} style={{ width: `${(it.count / occupancyTotal) * 100}%`, background: it.color }} />
                ) : null
              )}
            </div>
          ) : (
            <div className="h-1.5 w-full rounded-full bg-muted" />
          )}
          <div className="mt-4 space-y-3">
            {occupancyItems.map((it) => (
              <div key={it.label} className="flex items-center gap-2.5">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: it.color }} />
                <span className="text-sm text-muted-foreground">{it.label}</span>
                <span className="nums ml-auto text-sm font-semibold">{it.count}</span>
                <span className="nums w-9 text-right text-xs text-muted-foreground">
                  {occupancyTotal > 0 ? Math.round((it.count / occupancyTotal) * 100) : 0}%
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* Budget vs actual */}
        <Card className="p-5">
          <div className="mb-4">
            <h2 className="font-semibold tracking-tight">Budget vs actual</h2>
            <p className="text-sm text-muted-foreground">Year to date, prorated</p>
          </div>
          <div className="space-y-5">
            <Meter
              label="Income"
              actual={budgetVsActual.income.actual}
              expected={budgetVsActual.income.expected}
              pct={incPct}
              over={incOver}
              fill="var(--chart-1)"
              goodWhenOver
            />
            <Meter
              label="Expenditure"
              actual={budgetVsActual.expenditure.actual}
              expected={budgetVsActual.expenditure.expected}
              pct={expPct}
              over={expOver}
              fill="var(--chart-4)"
              goodWhenOver={false}
            />
          </div>
        </Card>
      </div>

      {/* ── Overdue alerts ─────────────────────────────────── */}
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[color-mix(in_oklch,var(--chart-2)_14%,transparent)]">
              <AlertTriangle className="h-4 w-4" style={{ color: "var(--chart-2)" }} />
            </span>
            <div>
              <h2 className="font-semibold tracking-tight">Overdue alerts</h2>
              <p className="text-sm text-muted-foreground">
                {overdueAlerts.length} apartment{overdueAlerts.length !== 1 ? "s" : ""} need attention
              </p>
            </div>
          </div>
          <Link
            href="/apartments"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
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
                    <td className="py-2.5 pr-4">
                      <Link
                        href={`/apartments?id=${apt.id}`}
                        className="font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {apt.unit_number}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{apt.primary_resident_name}</td>
                    <td className="py-2.5 pr-4">
                      <span className={apt.days_overdue > 0 ? "font-semibold text-[var(--neg)]" : "text-muted-foreground"}>
                        {apt.days_overdue > 0 ? `${apt.days_overdue} days` : "Due soon"}
                      </span>
                    </td>
                    <td className="nums py-2.5 pr-4 text-right font-medium">{formatCurrency(apt.amount_owed)}</td>
                    <td className="py-2.5">
                      <Badge variant={apt.payment_status === "overdue" ? "destructive" : "warning"}>
                        {apt.payment_status === "overdue" ? "Overdue" : "Due soon"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[color-mix(in_oklch,var(--chart-1)_14%,transparent)]">
              <TrendingUp className="h-5 w-5" style={{ color: "var(--chart-1)" }} />
            </span>
            <p className="text-muted-foreground">All apartments are up to date</p>
          </div>
        )}
      </Card>

      {/* ── Previous years ─────────────────────────────────── */}
      {state.history.length > 0 && (
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <History className="h-5 w-5 text-muted-foreground" />
            <div>
              <h2 className="font-semibold tracking-tight">Previous years</h2>
              <p className="text-sm text-muted-foreground">Migrated yearly totals</p>
            </div>
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
                      <td
                        className={`nums py-2.5 pr-4 text-right font-medium ${
                          net < 0 ? "text-[var(--neg)]" : "text-[var(--pos)]"
                        }`}
                      >
                        {formatCurrency(net)}
                      </td>
                      <td className="py-2.5">
                        {breakdown.length === 0 ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {breakdown.map(([name, pct]) => (
                              <Badge key={name} variant="outline" className="font-normal capitalize">
                                {name} {pct}%
                              </Badge>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}

/** Budget meter — fill carries the accent, track is a quiet wash of it. */
function Meter({
  label,
  actual,
  expected,
  pct,
  over,
  fill,
  goodWhenOver,
}: {
  label: string
  actual: number
  expected: number
  pct: number
  over: boolean
  fill: string
  goodWhenOver: boolean
}) {
  const onTrack = goodWhenOver ? over : !over
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="nums text-muted-foreground">
          {formatCurrency(actual)} <span className="opacity-60">/ {formatCurrency(expected)}</span>
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full" style={{ background: `color-mix(in oklch, ${fill} 16%, transparent)` }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: fill }} />
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="nums">{pct}% of target</span>
        <TrendBadge
          value={expected ? ((actual - expected) / Math.abs(expected)) * 100 : null}
          goodWhenUp={goodWhenOver}
          label={onTrack ? "on track" : "off target"}
        />
      </div>
    </div>
  )
}
