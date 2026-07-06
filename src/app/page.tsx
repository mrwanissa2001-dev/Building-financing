"use client"

import Link from "next/link"
import { Wallet, Landmark, DollarSign, TrendingUp, TrendingDown, AlertTriangle, History } from "lucide-react"
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
import { formatCurrency } from "@/lib/utils"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"

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
  const { state } = useStore()
  const {
    dashboardStats,
    occupancyBreakdown,
    overdueAlerts,
    monthlyIncomeExpenses,
    expensesByCategory,
    runningBalance,
    budgetVsActual,
    cashVsBankThisMonth,
  } = useComputed()

  if (!state.loaded) {
    return <DashboardSkeleton />
  }

  // this-month range for the "Spent This Month" card link
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  const monthStart = `${y}-${m}-01`
  const monthEnd = `${y}-${m}-${String(new Date(y, now.getMonth() + 1, 0).getDate()).padStart(2, "0")}`

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
      label: "Collected This Month",
      value: dashboardStats.collected_this_month,
      icon: TrendingUp,
      color: "text-green-600 dark:text-green-400",
      bg: "bg-green-50 dark:bg-green-950",
      href: "/apartments",
    },
    {
      label: "Spent This Month",
      value: dashboardStats.spent_this_month,
      icon: TrendingDown,
      color: "text-red-600 dark:text-red-400",
      bg: "bg-red-50 dark:bg-red-950",
      href: `/expenses?start=${monthStart}&end=${monthEnd}`,
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

  const cashBankTotal = cashVsBankThisMonth.cash + cashVsBankThisMonth.bank
  const cashPct = cashBankTotal > 0 ? Math.round((cashVsBankThisMonth.cash / cashBankTotal) * 100) : 0
  const bankPct = cashBankTotal > 0 ? 100 - cashPct : 0

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          {state.settings.building_name
            ? `${state.settings.building_name} — finance overview`
            : "Building finance overview"}
        </p>
      </div>

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
            <CardDescription>Last 12 months comparison</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyIncomeExpenses} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
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
            <CardDescription>Year-to-date breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72 flex items-center">
              {expensesByCategory.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={expensesByCategory}
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
                      {expensesByCategory.map((_, index) => (
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
                <p className="w-full text-center text-muted-foreground">No expense data</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Line Chart: Running Balance */}
        <Card>
          <CardHeader>
            <CardTitle>Running Balance</CardTitle>
            <CardDescription>Cumulative balance over time</CardDescription>
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

        {/* Cash vs Bank This Month */}
        <Card>
          <CardHeader>
            <CardTitle>Cash vs Bank (This Month)</CardTitle>
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
                      {formatCurrency(cashVsBankThisMonth.cash)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: "var(--chart-5)" }}
                    />
                    <span className="text-sm text-muted-foreground">Bank</span>
                    <span className="text-sm font-semibold">
                      {formatCurrency(cashVsBankThisMonth.bank)}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <p className="py-8 text-center text-muted-foreground">No collections this month</p>
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
              Migrated yearly totals — edit them in Building Setup
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
                    <th className="pb-3 font-medium">Expenditure Breakdown</th>
                  </tr>
                </thead>
                <tbody>
                  {state.history.map((h) => {
                    const net = h.income - h.expenditure
                    const breakdown = Object.entries(h.expense_breakdown).sort((a, b) => b[1] - a[1])
                    return (
                      <tr key={h.id} className="border-b last:border-0">
                        <td className="py-3 pr-4 font-medium">{h.year}</td>
                        <td className="py-3 pr-4">{formatCurrency(h.income)}</td>
                        <td className="py-3 pr-4">{formatCurrency(h.expenditure)}</td>
                        <td className={`py-3 pr-4 font-medium ${net < 0 ? "text-destructive" : "text-green-600 dark:text-green-400"}`}>
                          {formatCurrency(net)}
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
    </div>
  )
}
