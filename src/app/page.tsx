"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  Wallet,
  Landmark,
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  History,
  ArrowLeftRight,
  Trash2,
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
  LineChart,
  Line,
} from "recharts"
import { useComputed } from "@/hooks/use-computed"
import { useStore } from "@/lib/store"
import { formatCurrency, formatDate } from "@/lib/utils"
import { parseAmount } from "@/lib/csv"
import { monthKey, addMonthsToKey, monthsBetween, monthKeyLabel, firstDayOfMonth, lastDayOfMonth } from "@/lib/months"
import { useToast } from "@/components/ui/use-toast"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-8)",
]

// ── Period filter ──

type PeriodPreset = "this_month" | "last_month" | "this_year" | "last_year" | "all" | "custom"

const PERIOD_OPTIONS: { value: PeriodPreset; label: string }[] = [
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "this_year", label: "This Year" },
  { value: "last_year", label: "Last Year" },
  { value: "all", label: "All Time" },
  { value: "custom", label: "Custom Range" },
]

// inclusive 'YYYY-MM-DD' bounds; null = unbounded
function resolveRange(
  period: PeriodPreset,
  customStart: string,
  customEnd: string
): { start: string | null; end: string | null } {
  const now = new Date()
  const y = now.getFullYear()
  const nowKey = monthKey(now)
  switch (period) {
    case "this_month":
      return { start: firstDayOfMonth(nowKey), end: lastDayOfMonth(nowKey) }
    case "last_month": {
      const prev = addMonthsToKey(nowKey, -1)
      return { start: firstDayOfMonth(prev), end: lastDayOfMonth(prev) }
    }
    case "this_year":
      return { start: `${y}-01-01`, end: `${y}-12-31` }
    case "last_year":
      return { start: `${y - 1}-01-01`, end: `${y - 1}-12-31` }
    case "all":
      return { start: null, end: null }
    case "custom":
      return { start: customStart || null, end: customEnd || null }
  }
}

function inRange(date: string, start: string | null, end: string | null): boolean {
  if (!date) return false
  if (start && date < start) return false
  if (end && date > end) return false
  return true
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-1 h-4 w-56" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-8 rounded-md" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-28" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-56" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-56" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-56" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    </div>
  )
}

export default function DashboardPage() {
  const { state, addTransfer, deleteTransfer } = useStore()
  const { toast } = useToast()
  const {
    dashboardStats,
    dashboardPayments,
    occupancyBreakdown,
    overdueAlerts,
    runningBalance,
    budgetVsActual,
  } = useComputed()

  // ── Period filter state ──
  const [period, setPeriod] = useState<PeriodPreset>("this_month")
  const [customStart, setCustomStart] = useState("")
  const [customEnd, setCustomEnd] = useState("")

  // ── Transfer dialog state ──
  const [transferOpen, setTransferOpen] = useState(false)
  const [transferDirection, setTransferDirection] = useState<"cash_to_bank" | "bank_to_cash">("cash_to_bank")
  const [transferAmount, setTransferAmount] = useState("")
  const [transferDate, setTransferDate] = useState(() => new Date().toISOString().split("T")[0])
  const [transferNotes, setTransferNotes] = useState("")

  const range = resolveRange(period, customStart, customEnd)
  const periodLabel = PERIOD_OPTIONS.find((o) => o.value === period)?.label ?? ""

  // everything the selected period covers, derived from the same
  // dashboard-visible payments the balance cards use
  const periodStats = useMemo(() => {
    const pays = dashboardPayments.filter((p) => inRange(p.date_paid, range.start, range.end))
    const exps = state.expenses.filter((e) => inRange(e.date, range.start, range.end))

    const collected = pays.reduce((s, p) => s + p.amount, 0)
    const spent = exps.reduce((s, e) => s + e.amount, 0)
    const cash = pays.filter((p) => p.method === "cash").reduce((s, p) => s + p.amount, 0)
    const bank = pays.filter((p) => p.method === "bank").reduce((s, p) => s + p.amount, 0)

    // expenses per category within the period
    const byCategory = new Map<string, number>()
    for (const e of exps) {
      const name = state.categories.find((c) => c.id === e.category_id)?.name ?? "other"
      const display = name.charAt(0).toUpperCase() + name.slice(1)
      byCategory.set(display, (byCategory.get(display) ?? 0) + e.amount)
    }

    // month keys the bar chart shows: the period's months (capped at
    // 24), or the last 12 months for open-ended ranges
    let startKey: string
    let endKey: string
    if (range.start && range.end) {
      startKey = monthKey(range.start)
      endKey = monthKey(range.end)
      if (monthsBetween(startKey, endKey) > 23) startKey = addMonthsToKey(endKey, -23)
    } else {
      endKey = monthKey(new Date())
      startKey = addMonthsToKey(endKey, -11)
    }
    const monthly: Array<{ month: string; income: number; expenses: number }> = []
    for (let k = startKey; k <= endKey; k = addMonthsToKey(k, 1)) {
      const income = pays
        .filter((p) => monthKey(p.date_paid) === k)
        .reduce((s, p) => s + p.amount, 0)
      const expTotal = exps
        .filter((e) => monthKey(e.date) === k)
        .reduce((s, e) => s + e.amount, 0)
      monthly.push({ month: monthKeyLabel(k), income, expenses: expTotal })
    }

    return {
      collected,
      spent,
      cash,
      bank,
      expensesByCategory: Array.from(byCategory.entries())
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount),
      monthly,
    }
  }, [dashboardPayments, state.expenses, state.categories, range.start, range.end])

  if (!state.loaded) {
    return <DashboardSkeleton />
  }

  function handleTransfer() {
    const amount = parseAmount(transferAmount)
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Enter a valid amount", description: "The transfer amount must be greater than zero.", variant: "destructive" })
      return
    }
    if (!transferDate) {
      toast({ title: "Pick a date", description: "The transfer needs a date.", variant: "destructive" })
      return
    }
    const fromMethod = transferDirection === "cash_to_bank" ? "cash" : "bank"
    const toMethod = transferDirection === "cash_to_bank" ? "bank" : "cash"
    addTransfer({
      amount,
      from_method: fromMethod,
      to_method: toMethod,
      date: transferDate,
      notes: transferNotes,
    })
    toast({
      title: "Transfer recorded",
      description: `${formatCurrency(amount)} moved from ${fromMethod} to ${toMethod}.`,
      variant: "success",
    })
    setTransferAmount("")
    setTransferNotes("")
  }

  // each card links to the page (with filters preset) that explains its number
  const kpiCards = [
    {
      label: "Cash on Hand",
      value: dashboardStats.cash_on_hand,
      icon: Wallet,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-950",
      href: "/apartments?method=cash",
    },
    {
      label: "Bank Balance",
      value: dashboardStats.bank_balance,
      icon: Landmark,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-950",
      href: "/apartments?method=bank",
    },
    {
      label: "Total Balance",
      value: dashboardStats.total_balance,
      icon: DollarSign,
      color: "text-violet-600 dark:text-violet-400",
      bg: "bg-violet-50 dark:bg-violet-950",
      href: "/apartments",
    },
    {
      label: `Collected — ${periodLabel}`,
      value: periodStats.collected,
      icon: TrendingUp,
      color: "text-green-600 dark:text-green-400",
      bg: "bg-green-50 dark:bg-green-950",
      href: "/apartments",
    },
    {
      label: `Spent — ${periodLabel}`,
      value: periodStats.spent,
      icon: TrendingDown,
      color: "text-red-600 dark:text-red-400",
      bg: "bg-red-50 dark:bg-red-950",
      href: `/expenses${range.start || range.end ? `?start=${range.start ?? ""}&end=${range.end ?? ""}` : ""}`,
    },
  ]

  const occupancyItems = [
    { label: "Active", count: occupancyBreakdown.active, color: "bg-green-500" },
    { label: "MIA", count: occupancyBreakdown.mia, color: "bg-red-500" },
    { label: "Traveling (Paying)", count: occupancyBreakdown.traveling_but_paying, color: "bg-yellow-500" },
    { label: "Unregistered", count: occupancyBreakdown.unregistered, color: "bg-gray-400" },
  ]
  const occupancyTotal = occupancyItems.reduce((s, item) => s + item.count, 0)

  const incomeExpected = budgetVsActual.income.expected || 1
  const incomeActual = budgetVsActual.income.actual
  const incomePercent = Math.min(Math.round((incomeActual / incomeExpected) * 100), 100)
  const incomeOver = incomeActual > incomeExpected

  const expExpected = budgetVsActual.expenditure.expected || 1
  const expActual = budgetVsActual.expenditure.actual
  const expPercent = Math.min(Math.round((expActual / expExpected) * 100), 100)
  const expOver = expActual > expExpected

  const cashBankTotal = periodStats.cash + periodStats.bank
  const cashPct = cashBankTotal > 0 ? Math.round((periodStats.cash / cashBankTotal) * 100) : 0
  const bankPct = cashBankTotal > 0 ? 100 - cashPct : 0

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            {state.settings.building_name
              ? `${state.settings.building_name} — finance overview`
              : "Building finance overview"}
          </p>
        </div>
        <Button variant="outline" onClick={() => setTransferOpen(true)}>
          <ArrowLeftRight className="mr-1 h-4 w-4" /> Transfer Cash ↔ Bank
        </Button>
      </div>

      {/* Period filter — drives the Collected/Spent cards and the charts */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-[180px]">
              <Label className="mb-1.5 block text-xs text-muted-foreground">Period</Label>
              <Select value={period} onValueChange={(v) => setPeriod(v as PeriodPreset)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PERIOD_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {period === "custom" && (
              <>
                <div className="min-w-0">
                  <Label className="mb-1.5 block text-xs text-muted-foreground">From</Label>
                  <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
                </div>
                <div className="min-w-0">
                  <Label className="mb-1.5 block text-xs text-muted-foreground">To</Label>
                  <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
                </div>
              </>
            )}
            <p className="text-xs text-muted-foreground pb-2">
              {range.start || range.end
                ? `Showing ${range.start ? formatDate(range.start) : "the beginning"} – ${range.end ? formatDate(range.end) : "today"}`
                : "Showing all recorded data"}
              . Balance cards always show current totals.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 1. KPI Cards — each links to the relevant page, filters preset */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {kpiCards.map((kpi) => {
          const Icon = kpi.icon
          return (
            <Link key={kpi.label} href={kpi.href} className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Card className="h-full transition-colors hover:border-primary/50 hover:bg-muted/50 cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardDescription className="text-sm font-medium">
                    {kpi.label}
                  </CardDescription>
                  <div className={`rounded-md p-2 ${kpi.bg}`}>
                    <Icon className={`h-4 w-4 ${kpi.color}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(kpi.value)}</div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      {/* 2. Occupancy Breakdown + 3. Budget vs Actual */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Occupancy Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Occupancy Breakdown</CardTitle>
            <CardDescription>
              {occupancyTotal} total apartment{occupancyTotal !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Horizontal stacked bar */}
            {occupancyTotal > 0 ? (
              <div className="flex h-6 w-full overflow-hidden rounded-full">
                {occupancyItems.map((item) =>
                  item.count > 0 ? (
                    <div
                      key={item.label}
                      className={`${item.color} transition-all`}
                      style={{ width: `${(item.count / occupancyTotal) * 100}%` }}
                    />
                  ) : null
                )}
              </div>
            ) : (
              <div className="h-6 w-full rounded-full bg-muted" />
            )}
            {/* Legend */}
            <div className="grid grid-cols-2 gap-3">
              {occupancyItems.map((item) => (
                <div key={item.label} className="flex items-center gap-2">
                  <div className={`h-3 w-3 shrink-0 rounded-full ${item.color}`} />
                  <span className="text-sm text-muted-foreground">{item.label}</span>
                  <span className="ml-auto text-sm font-semibold">{item.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Budget vs Actual */}
        <Card>
          <CardHeader>
            <CardTitle>Budget vs Actual (YTD)</CardTitle>
            <CardDescription>Year-to-date income and expenditure</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Income progress */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Income</span>
                <span className="text-muted-foreground">
                  {formatCurrency(incomeActual)} / {formatCurrency(budgetVsActual.income.expected)}
                </span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-all ${incomeOver ? "bg-green-500" : "bg-blue-500"}`}
                  style={{ width: `${incomePercent}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{incomePercent}% of target</span>
                <Badge variant={incomeOver ? "success" : "secondary"} className="text-xs">
                  {incomeOver ? "Over target" : "Under target"}
                </Badge>
              </div>
            </div>
            {/* Expenditure progress */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Expenditure</span>
                <span className="text-muted-foreground">
                  {formatCurrency(expActual)} / {formatCurrency(budgetVsActual.expenditure.expected)}
                </span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-all ${expOver ? "bg-red-500" : "bg-orange-400"}`}
                  style={{ width: `${expPercent}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{expPercent}% of budget</span>
                <Badge variant={expOver ? "destructive" : "secondary"} className="text-xs">
                  {expOver ? "Over budget" : "Under budget"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 4. Charts Section (2x2 grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Bar Chart: Monthly Income vs Expenses */}
        <Card>
          <CardHeader>
            <CardTitle>Monthly Income vs Expenses</CardTitle>
            <CardDescription>{periodLabel} — month by month</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={periodStats.monthly} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v: string) => v.split(" ")[0]}
                    className="text-muted-foreground"
                  />
                  <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    formatter={(value) => formatCurrency(Number(value))}
                  />
                  <Bar dataKey="income" fill="var(--chart-1)" radius={[4, 4, 0, 0]} name="Income" />
                  <Bar dataKey="expenses" fill="var(--chart-4)" radius={[4, 4, 0, 0]} name="Expenses" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Donut Chart: Expenses by Category */}
        <Card>
          <CardHeader>
            <CardTitle>Expenses by Category</CardTitle>
            <CardDescription>{periodLabel} breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72 flex items-center">
              {periodStats.expensesByCategory.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={periodStats.expensesByCategory}
                      dataKey="amount"
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      label={({ name, percent }: { name?: string; percent?: number }) =>
                        `${name || ''} ${((percent ?? 0) * 100).toFixed(0)}%`
                      }
                    >
                      {periodStats.expensesByCategory.map((_, index) => (
                        <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                      formatter={(value) => formatCurrency(Number(value))}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="w-full text-center text-muted-foreground">No expenses in this period</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Line Chart: Running Balance */}
        <Card>
          <CardHeader>
            <CardTitle>Running Balance</CardTitle>
            <CardDescription>Cumulative balance over time (all data)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              {runningBalance.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={runningBalance} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v: string) => {
                        const d = new Date(v)
                        return `${d.getMonth() + 1}/${d.getDate()}`
                      }}
                      className="text-muted-foreground"
                    />
                    <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                      formatter={(value) => formatCurrency(Number(value))}
                      labelFormatter={(label) => {
                        const d = new Date(String(label))
                        return d.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="balance"
                      stroke="var(--chart-2)"
                      strokeWidth={2}
                      dot={false}
                      name="Balance"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="flex h-full items-center justify-center text-muted-foreground">
                  No data yet
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Cash vs Bank in the selected period */}
        <Card>
          <CardHeader>
            <CardTitle>Cash vs Bank — {periodLabel}</CardTitle>
            <CardDescription>
              Collection method breakdown: {formatCurrency(cashBankTotal)} total
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {cashBankTotal > 0 ? (
              <>
                <div className="flex h-8 w-full overflow-hidden rounded-full">
                  {cashPct > 0 && (
                    <div
                      className="flex items-center justify-center text-xs font-medium text-white transition-all"
                      style={{ width: `${cashPct}%`, backgroundColor: "var(--chart-3)" }}
                    >
                      {cashPct}%
                    </div>
                  )}
                  {bankPct > 0 && (
                    <div
                      className="flex items-center justify-center text-xs font-medium text-white transition-all"
                      style={{ width: `${bankPct}%`, backgroundColor: "var(--chart-5)" }}
                    >
                      {bankPct}%
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: "var(--chart-3)" }}
                    />
                    <span className="text-sm text-muted-foreground">Cash</span>
                    <span className="text-sm font-semibold">
                      {formatCurrency(periodStats.cash)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: "var(--chart-5)" }}
                    />
                    <span className="text-sm text-muted-foreground">Bank</span>
                    <span className="text-sm font-semibold">
                      {formatCurrency(periodStats.bank)}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <p className="py-8 text-center text-muted-foreground">No collections in this period</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 5. Previous Years (migrated totals) */}
      {state.history.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Previous Years</CardTitle>
            </div>
            <CardDescription>
              Migrated yearly totals — edit them in Building Setup. Years with a
              cash/bank split carry into the balance cards above.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-3 pr-4 font-medium">Year</th>
                    <th className="pb-3 pr-4 font-medium">Income</th>
                    <th className="pb-3 pr-4 font-medium">Expenditure</th>
                    <th className="pb-3 pr-4 font-medium">Net</th>
                    <th className="pb-3 pr-4 font-medium">Carried to Balance</th>
                    <th className="pb-3 font-medium">Expenditure Breakdown</th>
                  </tr>
                </thead>
                <tbody>
                  {state.history.map((h) => {
                    const net = h.income - h.expenditure
                    const carriedCash = (h.income_cash ?? 0) - (h.expenditure_cash ?? 0)
                    const carriedBank = (h.income_bank ?? 0) - (h.expenditure_bank ?? 0)
                    const hasCarry = carriedCash !== 0 || carriedBank !== 0
                    const breakdown = Object.entries(h.expense_breakdown).sort((a, b) => b[1] - a[1])
                    return (
                      <tr key={h.id} className="border-b last:border-0">
                        <td className="py-3 pr-4 font-medium">{h.year}</td>
                        <td className="py-3 pr-4">{formatCurrency(h.income)}</td>
                        <td className="py-3 pr-4">{formatCurrency(h.expenditure)}</td>
                        <td className={`py-3 pr-4 font-medium ${net < 0 ? "text-destructive" : "text-green-600 dark:text-green-400"}`}>
                          {formatCurrency(net)}
                        </td>
                        <td className="py-3 pr-4">
                          {hasCarry ? (
                            <span className="whitespace-nowrap">
                              {formatCurrency(carriedCash)} cash · {formatCurrency(carriedBank)} bank
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-3">
                          {breakdown.length === 0 ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {breakdown.map(([name, pct]) => (
                                <Badge key={name} variant="outline" className="font-normal capitalize">
                                  {name} {pct}% · {formatCurrency((h.expenditure * pct) / 100)}
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
          </CardContent>
        </Card>
      )}

      {/* 6. Overdue Alerts */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <CardTitle>Overdue Alerts</CardTitle>
          </div>
          <CardDescription>
            {overdueAlerts.length} apartment{overdueAlerts.length !== 1 ? "s" : ""} requiring
            attention
          </CardDescription>
        </CardHeader>
        <CardContent>
          {overdueAlerts.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-3 pr-4 font-medium">Unit</th>
                    <th className="pb-3 pr-4 font-medium">Resident</th>
                    <th className="pb-3 pr-4 font-medium">Days Overdue</th>
                    <th className="pb-3 pr-4 font-medium">Amount Owed</th>
                    <th className="pb-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {overdueAlerts.map((apt) => (
                    <tr key={apt.id} className="border-b last:border-0">
                      <td className="py-3 pr-4">
                        <Link
                          href={`/apartments?id=${apt.id}`}
                          className="font-medium text-primary underline-offset-4 hover:underline"
                        >
                          {apt.unit_number}
                        </Link>
                      </td>
                      <td className="py-3 pr-4">{apt.primary_resident_name}</td>
                      <td className="py-3 pr-4">
                        <span
                          className={
                            apt.days_overdue > 0 ? "font-semibold text-destructive" : ""
                          }
                        >
                          {apt.days_overdue > 0 ? `${apt.days_overdue} days` : "Due soon"}
                        </span>
                      </td>
                      <td className="py-3 pr-4 font-medium">
                        {formatCurrency(apt.amount_owed)}
                      </td>
                      <td className="py-3">
                        <Badge
                          variant={
                            apt.payment_status === "overdue" ? "destructive" : "warning"
                          }
                        >
                          {apt.payment_status === "overdue" ? "Overdue" : "Due Soon"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-6 text-center text-muted-foreground">
              All apartments are up to date
            </p>
          )}
        </CardContent>
      </Card>

      {/* Transfer dialog */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Transfer Between Cash and Bank</DialogTitle>
            <DialogDescription>
              Move money between the cash box and the bank account — the
              balance cards update immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Direction</Label>
                <Select
                  value={transferDirection}
                  onValueChange={(v) => setTransferDirection(v as "cash_to_bank" | "bank_to_cash")}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash_to_bank">Cash → Bank (deposit)</SelectItem>
                    <SelectItem value="bank_to_cash">Bank → Cash (withdrawal)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Amount (LE)</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={transferDate} onChange={(e) => setTransferDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Input
                placeholder="e.g. monthly bank deposit"
                value={transferNotes}
                onChange={(e) => setTransferNotes(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Current: {formatCurrency(dashboardStats.cash_on_hand)} cash ·{" "}
              {formatCurrency(dashboardStats.bank_balance)} bank
            </p>

            {state.transfers.length > 0 && (
              <div className="space-y-1.5 border-t border-border pt-3">
                <p className="text-sm font-medium">Recent transfers</p>
                {state.transfers.slice(0, 6).map((t) => (
                  <div key={t.id} className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground whitespace-nowrap">{formatDate(t.date)}</span>
                    <span className="font-medium whitespace-nowrap">{formatCurrency(t.amount)}</span>
                    <span className="text-muted-foreground truncate">
                      {t.from_method} → {t.to_method}
                      {t.notes ? ` · ${t.notes}` : ""}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="ml-auto h-7 w-7 shrink-0"
                      onClick={() => deleteTransfer(t.id)}
                      aria-label="Delete transfer"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferOpen(false)}>Close</Button>
            <Button onClick={handleTransfer}>
              <ArrowLeftRight className="mr-1 h-4 w-4" /> Record Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
