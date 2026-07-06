"use client"

import { useState, useMemo, useRef, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { useStore } from "@/lib/store"
import { formatCurrency, formatDate, cn } from "@/lib/utils"
import { PAYMENT_METHODS, RECURRING_INTERVALS } from "@/lib/constants"
import { buildCsv, csvToObjects, downloadCsv, normalizeDate, parseAmount } from "@/lib/csv"
import { monthKey, currentMonthKey, monthsBetween } from "@/lib/months"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/components/ui/use-toast"
import type { Expense, PaymentMethod } from "@/lib/types"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select"
import { CreatableSelect } from "@/components/ui/creatable-select"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import {
  Plus,
  Pencil,
  Trash2,
  ArrowUpDown,
  Download,
  Upload,
  RotateCcw,
  Repeat,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"

type SortField = "date" | "amount"
type SortDirection = "asc" | "desc"

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

// sentinel for "type the vendor manually" in the vendor select
const CUSTOM_VENDOR = "__custom__"

type RecurringCellStatus = "paid" | "due" | "future" | "na"

const recurringCellClass = (s: RecurringCellStatus) =>
  s === "paid"
    ? "bg-emerald-500"
    : s === "due"
    ? "bg-red-500"
    : s === "future"
    ? "bg-muted border border-border"
    : "bg-muted/30"

const recurringCellTitle = (s: RecurringCellStatus) =>
  s === "paid" ? "Paid" : s === "due" ? "Not paid" : s === "future" ? "Not due yet" : "Not scheduled"

interface ExpenseFormData {
  category_id: string
  amount: string
  method: PaymentMethod
  date: string
  vendor: string
  recurring: boolean
  recurring_interval: number
  notes: string
}

const emptyForm: ExpenseFormData = {
  category_id: "",
  amount: "",
  method: "cash",
  date: new Date().toISOString().split("T")[0],
  vendor: "",
  recurring: false,
  recurring_interval: 1,
  notes: "",
}

export default function ExpensesPage() {
  return (
    <Suspense fallback={<div className="space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-96 w-full" /></div>}>
      <ExpensesContent />
    </Suspense>
  )
}

function ExpensesContent() {
  const { state, addExpense, updateExpense, deleteExpense, importExpenses, addCategory } = useStore()
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const searchParams = useSearchParams()

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [form, setForm] = useState<ExpenseFormData>(emptyForm)
  // whether the vendor is being typed manually instead of picked from
  // the category's people
  const [customVendor, setCustomVendor] = useState(false)

  // Delete confirmation state
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // Filter state — starts from the URL so dashboard cards can link
  // here with filters preset
  const [filterCategory, setFilterCategory] = useState(() => searchParams.get("category") ?? "all")
  const [filterMethod, setFilterMethod] = useState(() => {
    const v = searchParams.get("method")
    return v === "cash" || v === "bank" ? v : "all"
  })
  const [filterDateStart, setFilterDateStart] = useState(() => searchParams.get("start") ?? "")
  const [filterDateEnd, setFilterDateEnd] = useState(() => searchParams.get("end") ?? "")

  // Sort state
  const [sortField, setSortField] = useState<SortField>("date")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")

  // Recurring grid year
  const [gridYear, setGridYear] = useState(() => new Date().getFullYear())

  const filtersActive =
    filterCategory !== "all" || filterMethod !== "all" || filterDateStart !== "" || filterDateEnd !== ""

  function resetFilters() {
    setFilterCategory("all")
    setFilterMethod("all")
    setFilterDateStart("")
    setFilterDateEnd("")
  }

  // Filtered and sorted expenses
  const filteredExpenses = useMemo(() => {
    let result = [...state.expenses]

    if (filterCategory !== "all") {
      result = result.filter((e) => e.category_id === filterCategory)
    }

    if (filterMethod !== "all") {
      result = result.filter((e) => e.method === filterMethod)
    }

    if (filterDateStart) {
      result = result.filter((e) => e.date >= filterDateStart)
    }

    if (filterDateEnd) {
      result = result.filter((e) => e.date <= filterDateEnd)
    }

    result.sort((a, b) => {
      let comparison = 0
      if (sortField === "date") {
        comparison = a.date.localeCompare(b.date)
      } else {
        comparison = a.amount - b.amount
      }
      return sortDirection === "asc" ? comparison : -comparison
    })

    return result
  }, [
    state.expenses,
    filterCategory,
    filterMethod,
    filterDateStart,
    filterDateEnd,
    sortField,
    sortDirection,
  ])

  // ── Recurring series for the month grid ──
  //
  // A series is one recurring expense chain: same category + vendor.
  // Its start month is the earliest recurring entry (edit that entry's
  // date to shift the whole schedule) and its interval comes from the
  // latest entry, so switching an expense to quarterly reshapes the row.
  const recurringSeries = useMemo(() => {
    const byKey = new Map<
      string,
      {
        categoryId: string
        vendor: string
        startKey: string
        interval: number
        latestDate: string
        amount: number
        paidMonths: Set<string>
        totalByYear: Map<number, number>
      }
    >()

    for (const e of state.expenses) {
      if (!e.recurring) continue
      const key = `${e.category_id}|${e.vendor.trim().toLowerCase()}`
      const mk = monthKey(e.date)
      let s = byKey.get(key)
      if (!s) {
        s = {
          categoryId: e.category_id,
          vendor: e.vendor,
          startKey: mk,
          interval: Math.max(1, e.recurring_interval ?? 1),
          latestDate: e.date,
          amount: e.amount,
          paidMonths: new Set(),
          totalByYear: new Map(),
        }
        byKey.set(key, s)
      }
      if (mk < s.startKey) s.startKey = mk
      if (e.date >= s.latestDate) {
        s.latestDate = e.date
        s.interval = Math.max(1, e.recurring_interval ?? 1)
        s.amount = e.amount
        s.vendor = e.vendor
      }
      s.paidMonths.add(mk)
      const y = Number(mk.slice(0, 4))
      s.totalByYear.set(y, (s.totalByYear.get(y) ?? 0) + e.amount)
    }

    const catName = (id: string) =>
      state.categories.find((c) => c.id === id)?.name ?? "unknown"

    return Array.from(byKey.values())
      .map((s) => ({ ...s, categoryName: catName(s.categoryId) }))
      .sort((a, b) => a.categoryName.localeCompare(b.categoryName) || a.vendor.localeCompare(b.vendor))
  }, [state.expenses, state.categories])

  function recurringCell(
    series: { startKey: string; interval: number; paidMonths: Set<string> },
    key: string
  ): RecurringCellStatus {
    if (key < series.startKey) return "na"
    if (monthsBetween(series.startKey, key) % series.interval !== 0) return "na"
    if (series.paidMonths.has(key)) return "paid"
    if (key <= currentMonthKey()) return "due"
    return "future"
  }

  function getCategoryName(categoryId: string): string {
    const cat = state.categories.find((c) => c.id === categoryId)
    return cat ? cat.name : "Unknown"
  }

  // people working under a category — offered as vendor choices
  function peopleFor(categoryId: string) {
    return state.people.filter((p) => p.category_id === categoryId)
  }

  const formPeople = peopleFor(form.category_id)
  const filterCategoryPeople = filterCategory !== "all" ? peopleFor(filterCategory) : []

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortField(field)
      setSortDirection("desc")
    }
  }

  function openAddDialog() {
    setEditingExpense(null)
    setForm(emptyForm)
    setCustomVendor(false)
    setDialogOpen(true)
  }

  function openEditDialog(expense: Expense) {
    setEditingExpense(expense)
    setForm({
      category_id: expense.category_id,
      amount: expense.amount.toString(),
      method: expense.method,
      date: expense.date,
      vendor: expense.vendor,
      recurring: expense.recurring ?? false,
      recurring_interval: Math.max(1, expense.recurring_interval ?? 1),
      notes: expense.notes,
    })
    const people = peopleFor(expense.category_id)
    setCustomVendor(
      people.length === 0 || !people.some((p) => p.name === expense.vendor)
    )
    setDialogOpen(true)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const parsedAmount = parseAmount(form.amount)
    if (!form.category_id || isNaN(parsedAmount) || parsedAmount <= 0 || !form.date || !form.vendor) {
      return
    }

    if (editingExpense) {
      updateExpense({
        ...editingExpense,
        category_id: form.category_id,
        amount: parsedAmount,
        method: form.method,
        date: form.date,
        vendor: form.vendor,
        recurring: form.recurring,
        recurring_interval: form.recurring_interval,
        notes: form.notes,
      })
    } else {
      addExpense({
        category_id: form.category_id,
        amount: parsedAmount,
        method: form.method,
        date: form.date,
        vendor: form.vendor,
        recurring: form.recurring,
        recurring_interval: form.recurring_interval,
        notes: form.notes,
      })
    }

    setDialogOpen(false)
    setEditingExpense(null)
    setForm(emptyForm)
  }

  function handleDelete() {
    if (deleteId) {
      deleteExpense(deleteId)
      setDeleteId(null)
    }
  }

  // ── CSV export / import ──

  function exportExpensesCsv() {
    const headers = ["category", "amount", "method", "date", "vendor", "recurring", "recurring_interval", "notes"]
    const rows = state.expenses.map((e) => [
      getCategoryName(e.category_id),
      e.amount,
      e.method,
      e.date,
      e.vendor,
      e.recurring ? "yes" : "",
      e.recurring ? e.recurring_interval ?? 1 : "",
      e.notes,
    ])
    downloadCsv(`expenses-${new Date().toISOString().slice(0, 10)}.csv`, buildCsv(headers, rows))
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async () => {
      const objs = csvToObjects(String(reader.result || ""))
      let skipped = 0
      const rows: {
        category_name: string
        amount: number
        method: PaymentMethod
        date: string
        vendor: string
        notes: string
      }[] = []
      for (const o of objs) {
        const amount = parseAmount(o.amount || "")
        const date = normalizeDate(o.date || "")
        if (!o.category || isNaN(amount) || !date) { skipped++; continue }
        rows.push({
          category_name: o.category,
          amount,
          method: (o.method || "").toLowerCase() === "bank" ? "bank" : "cash",
          date,
          vendor: o.vendor || "",
          notes: o.notes || "",
        })
      }
      const n = await importExpenses(rows)
      toast({
        title: "Import complete",
        description: `${n} expenses imported${skipped ? `, ${skipped} rows skipped` : ""}`,
        variant: skipped && !n ? "destructive" : "success",
      })
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
    reader.readAsText(file)
  }

  if (!state.loaded) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Loading expenses...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Expenses</h1>
          <p className="text-sm text-muted-foreground">
            Track and manage building expenses
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={openAddDialog}>
            <Plus className="h-4 w-4" />
            Add Expense
          </Button>
          <Button variant="outline" onClick={exportExpensesCsv}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4" />
            Import CSV
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleImportFile}
          />
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 min-w-0">
            <Label className="mb-1.5 block text-xs text-muted-foreground">
              Category
            </Label>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger>
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {state.categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-0">
            <Label className="mb-1.5 block text-xs text-muted-foreground">
              Date Range
            </Label>
            <DateRangePicker
              align="start"
              className="h-9 w-full justify-start font-normal"
              value={{ start: filterDateStart, end: filterDateEnd }}
              onChange={(r) => {
                setFilterDateStart(r.start)
                setFilterDateEnd(r.end)
              }}
            />
          </div>

          <div className="min-w-0">
            <Label className="mb-1.5 block text-xs text-muted-foreground">
              Method
            </Label>
            <Select value={filterMethod} onValueChange={setFilterMethod}>
              <SelectTrigger>
                <SelectValue placeholder="All Methods" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filtersActive && (
            <Button variant="ghost" onClick={resetFilters} className="shrink-0">
              <RotateCcw className="mr-1 h-4 w-4" /> Reset Filters
            </Button>
          )}
        </div>

        {/* staff working under the selected category */}
        {filterCategoryPeople.length > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            {filterCategoryPeople.length}{" "}
            {filterCategoryPeople.length === 1 ? "person works" : "people work"} under{" "}
            <span className="capitalize font-medium text-foreground">
              {getCategoryName(filterCategory)}
            </span>
            : {filterCategoryPeople.map((p) => p.name).join(", ")} — manage them in Building Setup.
          </p>
        )}
      </div>

      {/* Recurring expenses month grid */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Repeat className="h-4 w-4" /> Recurring Expenses
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              One row per recurring expense. Non-monthly schedules skip the
              months in between — edit the first entry&apos;s date to shift the
              starting month.
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setGridYear((y) => y - 1)} aria-label="Previous year">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-semibold tabular-nums">{gridYear}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setGridYear((y) => y + 1)} aria-label="Next year">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-card">Expense</TableHead>
                  {MONTH_LABELS.map((m) => (
                    <TableHead key={m} className="text-center px-1">{m}</TableHead>
                  ))}
                  <TableHead className="text-right">Spent {gridYear}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recurringSeries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={14} className="text-center py-8 text-muted-foreground">
                      No recurring expenses yet — switch on &quot;Recurring&quot; when adding an expense
                    </TableCell>
                  </TableRow>
                ) : (
                  recurringSeries.map((s) => (
                    <TableRow key={`${s.categoryId}|${s.vendor}`}>
                      <TableCell className="sticky left-0 bg-card whitespace-nowrap">
                        <div className="font-medium capitalize">{s.categoryName}</div>
                        <div className="text-xs text-muted-foreground">
                          {s.vendor} · {formatCurrency(s.amount)} ·{" "}
                          {RECURRING_INTERVALS.find((r) => r.value === s.interval)?.label.toLowerCase() ?? `every ${s.interval} months`}
                        </div>
                      </TableCell>
                      {Array.from({ length: 12 }, (_, i) => {
                        const key = `${gridYear}-${String(i + 1).padStart(2, "0")}`
                        const status = recurringCell(s, key)
                        return (
                          <TableCell key={i} className="px-1 py-2 text-center">
                            <div
                              className={cn("mx-auto h-5 w-7 rounded-sm", recurringCellClass(status))}
                              title={`${s.categoryName} (${s.vendor}) — ${MONTH_LABELS[i]} ${gridYear}: ${recurringCellTitle(status)}`}
                            />
                          </TableCell>
                        )
                      })}
                      <TableCell className="text-right font-medium whitespace-nowrap">
                        {formatCurrency(s.totalByYear.get(gridYear) ?? 0)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="inline-block h-3 w-4 rounded-sm bg-emerald-500" /> Paid</span>
            <span className="flex items-center gap-1"><span className="inline-block h-3 w-4 rounded-sm bg-red-500" /> Not paid</span>
            <span className="flex items-center gap-1"><span className="inline-block h-3 w-4 rounded-sm bg-muted border border-border" /> Not due yet</span>
            <span className="flex items-center gap-1"><span className="inline-block h-3 w-4 rounded-sm bg-muted/30" /> Not scheduled</span>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <div className="rounded-lg border border-border">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <button
                    className="inline-flex items-center gap-1 hover:text-foreground"
                    onClick={() => toggleSort("date")}
                  >
                    Date
                    <ArrowUpDown className="h-3.5 w-3.5" />
                  </button>
                </TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>
                  <button
                    className="inline-flex items-center gap-1 hover:text-foreground"
                    onClick={() => toggleSort("amount")}
                  >
                    Amount
                    <ArrowUpDown className="h-3.5 w-3.5" />
                  </button>
                </TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Recurring</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredExpenses.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="py-10 text-center text-muted-foreground"
                  >
                    No expenses found
                  </TableCell>
                </TableRow>
              ) : (
                filteredExpenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(expense.date)}
                    </TableCell>
                    <TableCell className="capitalize">
                      {getCategoryName(expense.category_id)}
                    </TableCell>
                    <TableCell>{expense.vendor}</TableCell>
                    <TableCell className="whitespace-nowrap font-medium">
                      {formatCurrency(expense.amount)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          expense.method === "cash" ? "outline" : "secondary"
                        }
                      >
                        {expense.method === "cash" ? "Cash" : "Bank"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {expense.recurring ? (
                        <Badge variant="secondary" className="whitespace-nowrap">
                          <Repeat className="mr-1 h-3 w-3" />
                          {(expense.recurring_interval ?? 1) === 1
                            ? "Monthly"
                            : (expense.recurring_interval ?? 1) === 12
                            ? "Yearly"
                            : `Every ${expense.recurring_interval} mo`}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-muted-foreground">
                      {expense.notes || "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(expense)}
                          aria-label="Edit expense"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(expense.id)}
                          aria-label="Delete expense"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingExpense ? "Edit Expense" : "Add Expense"}
            </DialogTitle>
            <DialogDescription>
              {editingExpense
                ? "Update the expense details below."
                : "Fill in the details to record a new expense."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <CreatableSelect
                  id="category"
                  capitalize
                  placeholder="Select category"
                  createLabel="Add category…"
                  inputPlaceholder="New category name…"
                  value={form.category_id}
                  options={state.categories.map((cat) => ({ value: cat.id, label: cat.name }))}
                  onCreate={(name) => addCategory(name).id}
                  onValueChange={(val) => {
                    const people = peopleFor(val)
                    setForm((f) => ({
                      ...f,
                      category_id: val,
                      // drop a vendor that doesn't belong to the new category
                      vendor: people.some((p) => p.name === f.vendor) ? f.vendor : "",
                    }))
                    setCustomVendor(people.length === 0)
                  }}
                />
                {formPeople.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {formPeople.length} {formPeople.length === 1 ? "person works" : "people work"} under this category
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, amount: e.target.value }))
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="method">Method</Label>
                <Select
                  value={form.method}
                  onValueChange={(val) =>
                    setForm((f) => ({
                      ...f,
                      method: val as PaymentMethod,
                    }))
                  }
                >
                  <SelectTrigger id="method">
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={form.date}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, date: e.target.value }))
                  }
                  required
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="vendor">Vendor</Label>
                {formPeople.length > 0 ? (
                  <>
                    <Select
                      value={customVendor ? CUSTOM_VENDOR : form.vendor || undefined}
                      onValueChange={(val) => {
                        if (val === CUSTOM_VENDOR) {
                          setCustomVendor(true)
                          setForm((f) => ({ ...f, vendor: "" }))
                        } else {
                          setCustomVendor(false)
                          setForm((f) => ({ ...f, vendor: val }))
                        }
                      }}
                    >
                      <SelectTrigger id="vendor">
                        <SelectValue placeholder={`Pick from ${getCategoryName(form.category_id)} staff`} />
                      </SelectTrigger>
                      <SelectContent>
                        {formPeople.map((p) => (
                          <SelectItem key={p.id} value={p.name}>
                            {p.name}
                          </SelectItem>
                        ))}
                        <SelectItem value={CUSTOM_VENDOR}>Other (type manually)</SelectItem>
                      </SelectContent>
                    </Select>
                    {customVendor && (
                      <Input
                        placeholder="e.g. ABC Maintenance"
                        value={form.vendor}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, vendor: e.target.value }))
                        }
                        required
                      />
                    )}
                  </>
                ) : (
                  <Input
                    id="vendor"
                    placeholder="e.g. ABC Maintenance"
                    value={form.vendor}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, vendor: e.target.value }))
                    }
                    required
                  />
                )}
              </div>

              <div className="space-y-3 rounded-lg border border-border p-3 sm:col-span-2">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Recurring</Label>
                    <p className="text-xs text-muted-foreground">
                      Automatically add this expense again on a schedule
                    </p>
                  </div>
                  <Switch
                    checked={form.recurring}
                    onCheckedChange={(v) =>
                      setForm((f) => ({ ...f, recurring: v }))
                    }
                  />
                </div>
                {form.recurring && (
                  <div className="space-y-1">
                    <Label className="text-xs">Repeats</Label>
                    <Select
                      value={String(form.recurring_interval)}
                      onValueChange={(v) =>
                        setForm((f) => ({ ...f, recurring_interval: parseInt(v, 10) || 1 }))
                      }
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {RECURRING_INTERVALS.map((r) => (
                          <SelectItem key={r.value} value={String(r.value)}>{r.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Starts from this expense&apos;s date and shows in the Recurring Expenses grid above.
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Additional details..."
                  value={form.notes}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, notes: e.target.value }))
                  }
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">
                {editingExpense ? "Save Changes" : "Add Expense"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Expense</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this expense? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
