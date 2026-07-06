"use client"

import { useState, useMemo, useRef } from "react"
import { useStore } from "@/lib/store"
import { formatCurrency, formatDate } from "@/lib/utils"
import { PAYMENT_METHODS } from "@/lib/constants"
import { buildCsv, csvToObjects, downloadCsv, normalizeDate, parseAmount } from "@/lib/csv"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/components/ui/use-toast"
import type { Expense, PaymentMethod } from "@/lib/types"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
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
import { Plus, Pencil, Trash2, ArrowUpDown, Download, Upload } from "lucide-react"

type SortField = "date" | "amount"
type SortDirection = "asc" | "desc"

interface ExpenseFormData {
  category_id: string
  amount: string
  method: PaymentMethod
  date: string
  vendor: string
  recurring: boolean
  notes: string
}

const emptyForm: ExpenseFormData = {
  category_id: "",
  amount: "",
  method: "cash",
  date: new Date().toISOString().split("T")[0],
  vendor: "",
  recurring: false,
  notes: "",
}

export default function ExpensesPage() {
  const { state, addExpense, updateExpense, deleteExpense, importExpenses } = useStore()
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [form, setForm] = useState<ExpenseFormData>(emptyForm)

  // Delete confirmation state
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // Filter state
  const [filterCategory, setFilterCategory] = useState("all")
  const [filterMethod, setFilterMethod] = useState("all")
  const [filterDateStart, setFilterDateStart] = useState("")
  const [filterDateEnd, setFilterDateEnd] = useState("")

  // Sort state
  const [sortField, setSortField] = useState<SortField>("date")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")

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

  function getCategoryName(categoryId: string): string {
    const cat = state.categories.find((c) => c.id === categoryId)
    return cat ? cat.name : "Unknown"
  }

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
      notes: expense.notes,
    })
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
    const headers = ["category", "amount", "method", "date", "vendor", "recurring", "notes"]
    const rows = state.expenses.map((e) => [
      getCategoryName(e.category_id),
      e.amount,
      e.method,
      e.date,
      e.vendor,
      e.recurring ? "yes" : "",
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
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-end">
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
            Start Date
          </Label>
          <Input
            type="date"
            value={filterDateStart}
            onChange={(e) => setFilterDateStart(e.target.value)}
          />
        </div>

        <div className="min-w-0">
          <Label className="mb-1.5 block text-xs text-muted-foreground">
            End Date
          </Label>
          <Input
            type="date"
            value={filterDateEnd}
            onChange={(e) => setFilterDateEnd(e.target.value)}
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
      </div>

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
                <TableHead>Notes</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredExpenses.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
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
                <Select
                  value={form.category_id}
                  onValueChange={(val) =>
                    setForm((f) => ({ ...f, category_id: val }))
                  }
                >
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {state.categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  min="0"
                  step="any"
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
                <Input
                  id="vendor"
                  placeholder="e.g. ABC Maintenance"
                  value={form.vendor}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, vendor: e.target.value }))
                  }
                  required
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border p-3 sm:col-span-2">
                <div>
                  <Label>Repeat monthly</Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically add this expense again each month
                  </p>
                </div>
                <Switch
                  checked={form.recurring}
                  onCheckedChange={(v) =>
                    setForm((f) => ({ ...f, recurring: v }))
                  }
                />
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
