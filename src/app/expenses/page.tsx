"use client"

import { useState, useMemo, useRef, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { useStore } from "@/lib/store"
import { useLayout } from "@/lib/layout"
import { formatCurrency, formatDate, cn } from "@/lib/utils"
import { PAYMENT_METHODS, RECURRING_INTERVALS } from "@/lib/constants"
import { buildCsv, csvToObjects, downloadCsv, normalizeDate, parseAmount } from "@/lib/csv"
import { monthKey, currentMonthKey, monthsBetween, addMonthsToKey } from "@/lib/months"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/components/ui/use-toast"
import { useI18n } from "@/lib/i18n"
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
  ClipboardCopy,
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
  months_already_paid: number
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
  months_already_paid: 0,
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
  const { visibleKeys } = useLayout()
  const expOrder = visibleKeys("expenses")
  const { toast } = useToast()
  const { t } = useI18n()
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
  // Built from the filtered expenses, so the page filters shape the
  // grid too.
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
        methodByMonth: Map<string, "C" | "B" | "C/B">
        totalByYear: Map<number, number>
      }
    >()

    for (const e of filteredExpenses) {
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
          methodByMonth: new Map(),
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
      const letter = e.method === "bank" ? "B" : "C"
      const prev = s.methodByMonth.get(mk)
      s.methodByMonth.set(mk, prev && prev !== letter ? "C/B" : letter)
      const y = Number(mk.slice(0, 4))
      s.totalByYear.set(y, (s.totalByYear.get(y) ?? 0) + e.amount)
    }

    const catName = (id: string) =>
      state.categories.find((c) => c.id === id)?.name ?? "unknown"

    return Array.from(byKey.values())
      .map((s) => ({ ...s, categoryName: catName(s.categoryId) }))
      .sort((a, b) => a.categoryName.localeCompare(b.categoryName) || a.vendor.localeCompare(b.vendor))
  }, [filteredExpenses, state.categories])

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
      months_already_paid: 0,
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
    // say exactly what's missing instead of silently doing nothing
    if (!form.category_id) {
      toast({ title: t("Select a category"), description: t("The expense needs a category."), variant: "destructive" })
      return
    }
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast({ title: t("Enter a valid amount"), description: t("The amount must be a number greater than zero."), variant: "destructive" })
      return
    }
    if (!form.date) {
      toast({ title: t("Pick a date"), description: t("The expense date is required."), variant: "destructive" })
      return
    }
    if (!form.vendor) {
      toast({ title: t("Enter a vendor"), description: t("Say who was paid — pick a person or type a name."), variant: "destructive" })
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
      // Save the primary entry (month 0 = the date entered)
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

      // If recurring and "already paid" > 0, create one entry per additional paid month
      if (form.recurring && form.months_already_paid > 0) {
        const interval = form.recurring_interval || 1
        const baseKey = monthKey(form.date)
        const dayPart = form.date.slice(8) // DD
        for (let i = 1; i <= form.months_already_paid; i++) {
          const nextKey = addMonthsToKey(baseKey, i * interval)
          const [y, m] = nextKey.split("-")
          // clamp day to end of that month
          const maxDay = new Date(Number(y), Number(m), 0).getDate()
          const day = String(Math.min(Number(dayPart), maxDay)).padStart(2, "0")
          addExpense({
            category_id: form.category_id,
            amount: parsedAmount,
            method: form.method,
            date: `${nextKey}-${day}`,
            vendor: form.vendor,
            recurring: true,
            recurring_interval: interval,
            notes: form.notes,
          })
        }
      }
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

  // the exact instructions to hand an AI (or a colleague) so any raw
  // data comes back as a CSV this page imports cleanly
  const EXPENSES_CSV_PROMPT = `Convert my expense records into a CSV file with EXACTLY this header row (lowercase, comma-separated, in this order):

category,amount,method,date,vendor,recurring,recurring_interval,notes

Rules for each column:
- category: the expense category name, e.g. maintenance, water, electricity, internet, security, cleaning, extras, other (required)
- amount: a plain number, no currency symbol or thousands separators (e.g. 350) (required)
- method: cash or bank
- date: the day it was paid, formatted YYYY-MM-DD (e.g. 2026-07-03) (required)
- vendor: who was paid (person or company)
- recurring: yes if this expense repeats on a schedule, otherwise leave empty
- recurring_interval: months between repeats when recurring (1 = monthly, 3 = quarterly, 12 = yearly); leave empty when not recurring
- notes: free text, or empty

Wrap any value containing a comma in double quotes. Output only the CSV content, no explanations, no markdown code fences.`

  function copyExpensesCsvPrompt() {
    navigator.clipboard
      .writeText(EXPENSES_CSV_PROMPT)
      .then(() =>
        toast({
          title: t("Prompt copied"),
          description: t("Paste it to an AI with your raw data to get an import-ready CSV."),
          variant: "success",
        })
      )
      .catch(() =>
        toast({ title: t("Copy failed"), description: t("Your browser blocked clipboard access."), variant: "destructive" })
      )
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
        recurring: boolean
        recurring_interval: number
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
          recurring: ["yes", "true", "1"].includes((o.recurring || "").toLowerCase()),
          recurring_interval: Math.max(1, parseInt(o.recurring_interval || "1", 10) || 1),
          notes: o.notes || "",
        })
      }
      const n = await importExpenses(rows)
      toast({
        title: t("Import complete"),
        description: t("{n} expenses imported", { n }) + (skipped ? t(", {n} rows skipped", { n: skipped }) : ""),
        variant: skipped && !n ? "destructive" : "success",
      })
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
    reader.readAsText(file)
  }

  if (!state.loaded) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">{t("Loading expenses...")}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("Expenses")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("Track and manage building expenses")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={openAddDialog}>
            <Plus className="h-4 w-4" />
            {t("Add Expense")}
          </Button>
          <Button variant="outline" onClick={exportExpensesCsv}>
            <Download className="h-4 w-4" />
            {t("Export CSV")}
          </Button>
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4" />
            {t("Import CSV")}
          </Button>
          <Button variant="outline" onClick={copyExpensesCsvPrompt} title={t("Copy an AI prompt that converts your raw data into an import-ready CSV")}>
            <ClipboardCopy className="h-4 w-4" />
            {t("Copy CSV Prompt")}
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
              {t("Category")}
            </Label>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger>
                <SelectValue placeholder={t("All Categories")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("All Categories")}</SelectItem>
                {state.categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {t(cat.name)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-0">
            <Label className="mb-1.5 block text-xs text-muted-foreground">
              {t("Date Range")}
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
              {t("Method")}
            </Label>
            <Select value={filterMethod} onValueChange={setFilterMethod}>
              <SelectTrigger>
                <SelectValue placeholder={t("All Methods")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("All")}</SelectItem>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {t(m.label)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filtersActive && (
            <Button variant="ghost" onClick={resetFilters} className="shrink-0">
              <RotateCcw className="mr-1 h-4 w-4" /> {t("Reset Filters")}
            </Button>
          )}
        </div>

        {/* staff working under the selected category */}
        {filterCategoryPeople.length > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            {t("{n} staff under", { n: filterCategoryPeople.length })}{" "}
            <span className="capitalize font-medium text-foreground">
              {t(getCategoryName(filterCategory))}
            </span>
            : {filterCategoryPeople.map((p) => p.name).join(", ")} — {t("manage them in Building Setup.")}
          </p>
        )}
      </div>

      {/* Customisable widgets — order & visibility from Settings */}
      <div className="flex flex-col gap-6">
      {expOrder.includes("recurring_grid") && (
      <div style={{ order: expOrder.indexOf("recurring_grid") }}>
      {/* Recurring expenses month grid */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Repeat className="h-4 w-4" /> {t("Recurring Expenses")}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {t("One row per recurring expense — it follows the filters above. Non-monthly schedules skip the months in between; edit the first entry's date to shift the starting month. C = paid in cash, B = by bank.")}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setGridYear((y) => y - 1)} aria-label={t("Previous year")}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-semibold tabular-nums">{gridYear}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setGridYear((y) => y + 1)} aria-label={t("Next year")}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-card">{t("Expense")}</TableHead>
                  {MONTH_LABELS.map((m) => (
                    <TableHead key={m} className="text-center px-1">{m}</TableHead>
                  ))}
                  <TableHead className="text-right">{t("Spent")} {gridYear}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recurringSeries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={14} className="text-center py-8 text-muted-foreground">
                      {t("No recurring expenses yet — switch on \u201cRecurring\u201d when adding an expense")}
                    </TableCell>
                  </TableRow>
                ) : (
                  recurringSeries.map((s) => (
                    <TableRow key={`${s.categoryId}|${s.vendor}`}>
                      <TableCell className="sticky left-0 bg-card whitespace-nowrap">
                        <div className="font-medium capitalize">{t(s.categoryName)}</div>
                        <div className="text-xs text-muted-foreground">
                          {s.vendor} · {formatCurrency(s.amount)} ·{" "}
                          {t(RECURRING_INTERVALS.find((r) => r.value === s.interval)?.label ?? `Every ${s.interval} months`).toLowerCase()}
                        </div>
                      </TableCell>
                      {Array.from({ length: 12 }, (_, i) => {
                        const key = `${gridYear}-${String(i + 1).padStart(2, "0")}`
                        const status = recurringCell(s, key)
                        const letter = status === "paid" ? s.methodByMonth.get(key) : undefined
                        return (
                          <TableCell key={i} className="px-1 py-2 text-center">
                            <div
                              className={cn("mx-auto flex h-5 w-7 items-center justify-center rounded-sm text-[9px] font-bold text-white", recurringCellClass(status))}
                              title={`${s.categoryName} (${s.vendor}) — ${MONTH_LABELS[i]} ${gridYear}: ${recurringCellTitle(status)}${letter ? ` (${letter === "C/B" ? "cash + bank" : letter === "C" ? "cash" : "bank"})` : ""}`}
                            >
                              {letter ?? ""}
                            </div>
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
            <span className="flex items-center gap-1"><span className="inline-block h-3 w-4 rounded-sm bg-emerald-500" /> {t("Paid")}</span>
            <span className="flex items-center gap-1"><span className="inline-block h-3 w-4 rounded-sm bg-red-500" /> {t("Not paid")}</span>
            <span className="flex items-center gap-1"><span className="inline-block h-3 w-4 rounded-sm bg-muted border border-border" /> {t("Not due yet")}</span>
            <span className="flex items-center gap-1"><span className="inline-block h-3 w-4 rounded-sm bg-muted/30" /> {t("Not scheduled")}</span>
          </div>
        </CardContent>
      </Card>

      </div>
      )}
      {expOrder.includes("expenses_table") && (
      <div style={{ order: expOrder.indexOf("expenses_table") }}>
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
                    {t("Date")}
                    <ArrowUpDown className="h-3.5 w-3.5" />
                  </button>
                </TableHead>
                <TableHead>{t("Category")}</TableHead>
                <TableHead>{t("Vendor")}</TableHead>
                <TableHead>
                  <button
                    className="inline-flex items-center gap-1 hover:text-foreground"
                    onClick={() => toggleSort("amount")}
                  >
                    {t("Amount")}
                    <ArrowUpDown className="h-3.5 w-3.5" />
                  </button>
                </TableHead>
                <TableHead>{t("Method")}</TableHead>
                <TableHead>{t("Recurring")}</TableHead>
                <TableHead>{t("Notes")}</TableHead>
                <TableHead className="w-[80px]">{t("Actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredExpenses.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="py-10 text-center text-muted-foreground"
                  >
                    {t("No expenses found")}
                  </TableCell>
                </TableRow>
              ) : (
                filteredExpenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(expense.date)}
                    </TableCell>
                    <TableCell className="capitalize">
                      {t(getCategoryName(expense.category_id))}
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
                        {expense.method === "cash" ? t("Cash") : t("Bank")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {expense.recurring ? (
                        <Badge variant="secondary" className="whitespace-nowrap">
                          <Repeat className="mr-1 h-3 w-3" />
                          {(expense.recurring_interval ?? 1) === 1
                            ? t("Monthly")
                            : (expense.recurring_interval ?? 1) === 12
                            ? t("Yearly")
                            : t("Every {n} mo", { n: expense.recurring_interval ?? 1 })}
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
                          aria-label={t("Edit expense")}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(expense.id)}
                          aria-label={t("Delete expense")}
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
      </div>
      )}
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingExpense ? t("Edit Expense") : t("Add Expense")}
            </DialogTitle>
            <DialogDescription>
              {editingExpense
                ? t("Update the expense details below.")
                : t("Fill in the details to record a new expense.")}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="category">{t("Category")}</Label>
                <CreatableSelect
                  id="category"
                  capitalize
                  placeholder={t("Select category")}
                  createLabel={t("Add category…")}
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
                    {t("{n} staff under this category", { n: formPeople.length })}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">{t("Amount")}</Label>
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
                <Label htmlFor="method">{t("Method")}</Label>
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
                    <SelectValue placeholder={t("Select method")} />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {t(m.label)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="date">{t("Date")}</Label>
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
                <Label htmlFor="vendor">{t("Vendor")}</Label>
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
                        <SelectValue placeholder={t("Pick from {category} staff", { category: t(getCategoryName(form.category_id)) })} />
                      </SelectTrigger>
                      <SelectContent>
                        {formPeople.map((p) => (
                          <SelectItem key={p.id} value={p.name}>
                            {p.name}
                          </SelectItem>
                        ))}
                        <SelectItem value={CUSTOM_VENDOR}>{t("Other (type manually)")}</SelectItem>
                      </SelectContent>
                    </Select>
                    {customVendor && (
                      <Input
                        placeholder={t("e.g. ABC Maintenance")}
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
                    placeholder={t("e.g. ABC Maintenance")}
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
                    <Label>{t("Recurring")}</Label>
                    <p className="text-xs text-muted-foreground">
                      {t("Automatically add this expense again on a schedule")}
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
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-xs">{t("Repeats")}</Label>
                      <Select
                        value={String(form.recurring_interval)}
                        onValueChange={(v) =>
                          setForm((f) => ({ ...f, recurring_interval: parseInt(v, 10) || 1 }))
                        }
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {RECURRING_INTERVALS.map((r) => (
                            <SelectItem key={r.value} value={String(r.value)}>{t(r.label)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        {t("Starts from this expense's date and shows in the Recurring Expenses grid above.")}
                      </p>
                    </div>
                    {!editingExpense && (
                      <div className="space-y-1">
                        <Label className="text-xs">{t("Additional months already paid")}</Label>
                        <Input
                          type="number"
                          min={0}
                          max={60}
                          placeholder="0"
                          value={form.months_already_paid || ""}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, months_already_paid: Math.max(0, parseInt(e.target.value, 10) || 0) }))
                          }
                        />
                        <p className="text-xs text-muted-foreground">
                          {t("Creates a separate log entry for each additional paid month after the date above.")}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="notes">{t("Notes (optional)")}</Label>
                <Textarea
                  id="notes"
                  placeholder={t("Additional details...")}
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
                {t("Cancel")}
              </Button>
              <Button type="submit">
                {editingExpense ? t("Save Changes") : t("Add Expense")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("Delete Expense")}</DialogTitle>
            <DialogDescription>
              {t("Are you sure you want to delete this expense? This action cannot be undone.")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              {t("Cancel")}
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              {t("Delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
