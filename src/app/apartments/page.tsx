"use client"

import { useState, useMemo, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { useStore } from "@/lib/store"
import { useComputed } from "@/hooks/use-computed"
import { formatCurrency, formatDate, cn } from "@/lib/utils"
import { PAYMENT_INTERVALS, OCCUPANCY_STATUSES, PAYMENT_METHODS } from "@/lib/constants"
import type { Apartment, ApartmentWithStatus, PaymentStatus, OccupancyStatus, PaymentMethod, PaymentInterval } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Plus,
  Search,
  X,
  ChevronUp,
  ChevronDown,
  ArrowLeft,
  Phone,
  Mail,
  Pencil,
  Trash2,
  Calendar,
  DollarSign,
  Building2,
} from "lucide-react"

type SortField = "unit_number" | "amount_owed" | "floor"
type SortDir = "asc" | "desc"

const statusBadgeVariant = (status: PaymentStatus) => {
  switch (status) {
    case "overdue": return "destructive" as const
    case "due_soon": return "warning" as const
    case "paid": return "success" as const
  }
}

const occupancyBadgeVariant = (status: OccupancyStatus) => {
  switch (status) {
    case "active": return "default" as const
    case "mia": return "destructive" as const
    case "traveling_but_paying": return "warning" as const
  }
}

const emptyApartmentForm = {
  unit_number: "",
  floor: "",
  primary_resident_name: "",
  phone: "",
  email: "",
  payment_interval: "monthly" as PaymentInterval,
  monthly_due_amount: "",
  occupancy_status: "active" as OccupancyStatus,
  notes: "",
}

const emptyPaymentForm = {
  apartment_id: "",
  payer_name: "",
  amount: "",
  method: "cash" as PaymentMethod,
  date_paid: new Date().toISOString().split("T")[0],
  period_start: "",
  period_end: "",
  notes: "",
}

export default function ApartmentsPage() {
  return (
    <Suspense fallback={<div className="space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-96 w-full" /></div>}>
      <ApartmentsContent />
    </Suspense>
  )
}

function ApartmentsContent() {
  const { state, addApartment, updateApartment, deleteApartment, addPayment } = useStore()
  const { apartmentsWithStatus, getPaymentsForApartment } = useComputed()

  const searchParams = useSearchParams()

  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState<PaymentStatus | "all">("all")
  const [filterOccupancy, setFilterOccupancy] = useState<OccupancyStatus | "all">("all")
  const [filterMethod, setFilterMethod] = useState<PaymentMethod | "all">("all")

  const [sortField, setSortField] = useState<SortField>("unit_number")
  const [sortDir, setSortDir] = useState<SortDir>("asc")

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState<Apartment | null>(null)

  const [aptDialogOpen, setAptDialogOpen] = useState(false)
  const [aptForm, setAptForm] = useState(emptyApartmentForm)

  const [payDialogOpen, setPayDialogOpen] = useState(false)
  const [payForm, setPayForm] = useState(emptyPaymentForm)

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  useEffect(() => {
    const id = searchParams.get("id")
    if (id) setSelectedId(id)
  }, [searchParams])

  const filtered = useMemo(() => {
    let list = apartmentsWithStatus

    if (search) {
      const q = search.toLowerCase()
      const paymentPayers = state.payments
        .filter((p) => p.payer_name.toLowerCase().includes(q))
        .map((p) => p.apartment_id)

      list = list.filter(
        (a) =>
          a.unit_number.toLowerCase().includes(q) ||
          a.primary_resident_name.toLowerCase().includes(q) ||
          paymentPayers.includes(a.id)
      )
    }

    if (filterStatus !== "all") {
      list = list.filter((a) => a.payment_status === filterStatus)
    }
    if (filterOccupancy !== "all") {
      list = list.filter((a) => a.occupancy_status === filterOccupancy)
    }
    if (filterMethod !== "all") {
      const aptIdsWithMethod = new Set(
        state.payments.filter((p) => p.method === filterMethod).map((p) => p.apartment_id)
      )
      list = list.filter((a) => aptIdsWithMethod.has(a.id))
    }

    list = [...list].sort((a, b) => {
      let cmp = 0
      if (sortField === "unit_number") cmp = a.unit_number.localeCompare(b.unit_number)
      else if (sortField === "amount_owed") cmp = a.amount_owed - b.amount_owed
      else if (sortField === "floor") cmp = a.floor - b.floor
      return sortDir === "asc" ? cmp : -cmp
    })

    return list
  }, [apartmentsWithStatus, search, filterStatus, filterOccupancy, filterMethod, sortField, sortDir, state.payments])

  const selectedApt = useMemo(() => {
    if (!selectedId) return null
    return apartmentsWithStatus.find((a) => a.id === selectedId) || null
  }, [selectedId, apartmentsWithStatus])

  const selectedPayments = useMemo(() => {
    if (!selectedId) return []
    return getPaymentsForApartment(selectedId)
  }, [selectedId, getPaymentsForApartment])

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else { setSortField(field); setSortDir("asc") }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return null
    return sortDir === "asc" ? <ChevronUp className="inline h-3 w-3" /> : <ChevronDown className="inline h-3 w-3" />
  }

  function handleAddApartment() {
    const due = parseFloat(aptForm.monthly_due_amount)
    if (!aptForm.unit_number || !aptForm.primary_resident_name || isNaN(due)) return
    addApartment({
      unit_number: aptForm.unit_number,
      floor: parseInt(aptForm.floor) || 0,
      primary_resident_name: aptForm.primary_resident_name,
      phone: aptForm.phone,
      email: aptForm.email,
      payment_interval: aptForm.payment_interval,
      monthly_due_amount: due,
      occupancy_status: aptForm.occupancy_status,
      notes: aptForm.notes,
    })
    setAptDialogOpen(false)
    setAptForm(emptyApartmentForm)
  }

  function handleAddPayment() {
    const amount = parseFloat(payForm.amount)
    if (!payForm.apartment_id || isNaN(amount) || !payForm.date_paid || !payForm.period_start || !payForm.period_end) return
    addPayment({
      apartment_id: payForm.apartment_id,
      payer_name: payForm.payer_name,
      amount,
      method: payForm.method,
      date_paid: payForm.date_paid,
      period_start: payForm.period_start,
      period_end: payForm.period_end,
      notes: payForm.notes,
    })
    setPayDialogOpen(false)
    setPayForm(emptyPaymentForm)
  }

  function startEdit(apt: ApartmentWithStatus) {
    setEditData({ ...apt })
    setIsEditing(true)
  }

  function saveEdit() {
    if (!editData) return
    updateApartment(editData)
    setIsEditing(false)
    setEditData(null)
  }

  function confirmDelete(id: string) {
    deleteApartment(id)
    setDeleteConfirmId(null)
    if (selectedId === id) setSelectedId(null)
  }

  if (!state.loaded) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  // Apartment Profile Panel
  if (selectedApt) {
    const apt = selectedApt
    const editing = isEditing && editData

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => { setSelectedId(null); setIsEditing(false); setEditData(null) }}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Button>
          <h1 className="text-2xl font-bold">Unit {apt.unit_number}</h1>
          <Badge variant={occupancyBadgeVariant(apt.occupancy_status)}>
            {OCCUPANCY_STATUSES.find((o) => o.value === apt.occupancy_status)?.label}
          </Badge>
          <Badge variant={statusBadgeVariant(apt.payment_status)}>
            {apt.payment_status === "paid" ? "Paid" : apt.payment_status === "due_soon" ? "Due Soon" : "Overdue"}
          </Badge>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Info Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Apartment Details</CardTitle>
              {!isEditing ? (
                <Button variant="outline" size="sm" onClick={() => startEdit(apt)}>
                  <Pencil className="mr-1 h-3 w-3" /> Edit
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button size="sm" onClick={saveEdit}>Save</Button>
                  <Button variant="outline" size="sm" onClick={() => { setIsEditing(false); setEditData(null) }}>Cancel</Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Resident</p>
                  <p className="font-medium">{apt.primary_resident_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Floor</p>
                  <p className="font-medium">{apt.floor}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{apt.phone || "N/A"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{apt.email || "N/A"}</span>
                </div>
              </div>

              <div className="space-y-3 pt-2 border-t">
                <div>
                  <Label className="text-sm text-muted-foreground">Payment Interval</Label>
                  {editing ? (
                    <Select value={editData!.payment_interval} onValueChange={(v) => setEditData({ ...editData!, payment_interval: v as PaymentInterval })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PAYMENT_INTERVALS.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="font-medium">{PAYMENT_INTERVALS.find((i) => i.value === apt.payment_interval)?.label}</p>
                  )}
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Monthly Due Amount</Label>
                  {editing ? (
                    <Input type="number" className="mt-1" value={editData!.monthly_due_amount} onChange={(e) => setEditData({ ...editData!, monthly_due_amount: parseFloat(e.target.value) || 0 })} />
                  ) : (
                    <p className="font-medium">{formatCurrency(apt.monthly_due_amount)}</p>
                  )}
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Occupancy Status</Label>
                  {editing ? (
                    <Select value={editData!.occupancy_status} onValueChange={(v) => setEditData({ ...editData!, occupancy_status: v as OccupancyStatus })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {OCCUPANCY_STATUSES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="font-medium">{OCCUPANCY_STATUSES.find((o) => o.value === apt.occupancy_status)?.label}</p>
                  )}
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Notes</Label>
                  {editing ? (
                    <Textarea className="mt-1" value={editData!.notes} onChange={(e) => setEditData({ ...editData!, notes: e.target.value })} />
                  ) : (
                    <p className="text-sm">{apt.notes || "No notes"}</p>
                  )}
                </div>
              </div>

              <div className="pt-2 border-t">
                <Button variant="destructive" size="sm" onClick={() => setDeleteConfirmId(apt.id)}>
                  <Trash2 className="mr-1 h-3 w-3" /> Delete Apartment
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Balance Card */}
          <Card>
            <CardHeader>
              <CardTitle>Financial Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Amount Owed</p>
                  <p className={cn("text-2xl font-bold", apt.amount_owed > 0 ? "text-destructive" : "text-success")}>
                    {formatCurrency(apt.amount_owed)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Next Due Date</p>
                  <p className="text-lg font-semibold flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {apt.next_due_date ? formatDate(apt.next_due_date) : "No payment yet"}
                  </p>
                </div>
              </div>
              {apt.days_overdue > 0 && (
                <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                  {apt.days_overdue} days overdue
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Payment History */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Payment History</CardTitle>
            <Button size="sm" onClick={() => {
              setPayForm({
                ...emptyPaymentForm,
                apartment_id: apt.id,
                payer_name: apt.primary_resident_name,
              })
              setPayDialogOpen(true)
            }}>
              <Plus className="mr-1 h-3 w-3" /> Add Payment
            </Button>
          </CardHeader>
          <CardContent>
            {selectedPayments.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No payments recorded</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Payer</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedPayments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>{formatDate(p.date_paid)}</TableCell>
                        <TableCell>{p.payer_name}</TableCell>
                        <TableCell className="font-medium">{formatCurrency(p.amount)}</TableCell>
                        <TableCell>
                          <Badge variant={p.method === "cash" ? "outline" : "secondary"}>{p.method}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(p.period_start)} – {formatDate(p.period_end)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{p.notes || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Delete confirmation */}
        <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Apartment</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              This will permanently delete this apartment and all associated payments. This action cannot be undone.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
              <Button variant="destructive" onClick={() => deleteConfirmId && confirmDelete(deleteConfirmId)}>Delete</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Payment Dialog (reused below) */}
        {renderPaymentDialog()}
      </div>
    )
  }

  // Main List View
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Apartments & Payments</h1>
        <div className="flex gap-2">
          <Button onClick={() => { setAptForm(emptyApartmentForm); setAptDialogOpen(true) }}>
            <Building2 className="mr-1 h-4 w-4" /> Add Apartment
          </Button>
          <Button variant="outline" onClick={() => { setPayForm(emptyPaymentForm); setPayDialogOpen(true) }}>
            <DollarSign className="mr-1 h-4 w-4" /> Add Payment
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name, unit, or payer..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as PaymentStatus | "all")}>
                <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="due_soon">Due Soon</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterOccupancy} onValueChange={(v) => setFilterOccupancy(v as OccupancyStatus | "all")}>
                <SelectTrigger className="w-[160px]"><SelectValue placeholder="Occupancy" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Occupancy</SelectItem>
                  {OCCUPANCY_STATUSES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterMethod} onValueChange={(v) => setFilterMethod(v as PaymentMethod | "all")}>
                <SelectTrigger className="w-[120px]"><SelectValue placeholder="Method" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Methods</SelectItem>
                  {PAYMENT_METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("unit_number")}>
                    Unit <SortIcon field="unit_number" />
                  </TableHead>
                  <TableHead>Resident</TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("floor")}>
                    Floor <SortIcon field="floor" />
                  </TableHead>
                  <TableHead>Monthly Due</TableHead>
                  <TableHead>Interval</TableHead>
                  <TableHead>Occupancy</TableHead>
                  <TableHead>Payment Status</TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("amount_owed")}>
                    Amount Owed <SortIcon field="amount_owed" />
                  </TableHead>
                  <TableHead>Next Due</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      No apartments match your search/filters
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((apt) => (
                    <TableRow
                      key={apt.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedId(apt.id)}
                    >
                      <TableCell className="font-medium">{apt.unit_number}</TableCell>
                      <TableCell>{apt.primary_resident_name}</TableCell>
                      <TableCell>{apt.floor}</TableCell>
                      <TableCell>{formatCurrency(apt.monthly_due_amount)}</TableCell>
                      <TableCell>{PAYMENT_INTERVALS.find((i) => i.value === apt.payment_interval)?.label}</TableCell>
                      <TableCell>
                        <Badge variant={occupancyBadgeVariant(apt.occupancy_status)}>
                          {OCCUPANCY_STATUSES.find((o) => o.value === apt.occupancy_status)?.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(apt.payment_status)}>
                          {apt.payment_status === "paid" ? "Paid" : apt.payment_status === "due_soon" ? "Due Soon" : "Overdue"}
                        </Badge>
                      </TableCell>
                      <TableCell className={cn("font-medium", apt.amount_owed > 0 && "text-destructive")}>
                        {formatCurrency(apt.amount_owed)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {apt.next_due_date ? formatDate(apt.next_due_date) : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add Apartment Dialog */}
      <Dialog open={aptDialogOpen} onOpenChange={setAptDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Apartment</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Unit Number *</Label>
                <Input value={aptForm.unit_number} onChange={(e) => setAptForm({ ...aptForm, unit_number: e.target.value })} placeholder="e.g. 3B" />
              </div>
              <div>
                <Label>Floor</Label>
                <Input type="number" value={aptForm.floor} onChange={(e) => setAptForm({ ...aptForm, floor: e.target.value })} placeholder="0" />
              </div>
            </div>
            <div>
              <Label>Primary Resident Name *</Label>
              <Input value={aptForm.primary_resident_name} onChange={(e) => setAptForm({ ...aptForm, primary_resident_name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Phone</Label>
                <Input value={aptForm.phone} onChange={(e) => setAptForm({ ...aptForm, phone: e.target.value })} />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={aptForm.email} onChange={(e) => setAptForm({ ...aptForm, email: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Payment Interval</Label>
                <Select value={aptForm.payment_interval} onValueChange={(v) => setAptForm({ ...aptForm, payment_interval: v as PaymentInterval })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_INTERVALS.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Monthly Due *</Label>
                <Input type="number" value={aptForm.monthly_due_amount} onChange={(e) => setAptForm({ ...aptForm, monthly_due_amount: e.target.value })} placeholder="0" />
              </div>
            </div>
            <div>
              <Label>Occupancy Status</Label>
              <Select value={aptForm.occupancy_status} onValueChange={(v) => setAptForm({ ...aptForm, occupancy_status: v as OccupancyStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {OCCUPANCY_STATUSES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={aptForm.notes} onChange={(e) => setAptForm({ ...aptForm, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAptDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddApartment}>Add Apartment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      {renderPaymentDialog()}
    </div>
  )

  function renderPaymentDialog() {
    return (
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Payment</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label>Apartment *</Label>
              <Select
                value={payForm.apartment_id}
                onValueChange={(v) => {
                  const apt = state.apartments.find((a) => a.id === v)
                  setPayForm({
                    ...payForm,
                    apartment_id: v,
                    payer_name: apt?.primary_resident_name || payForm.payer_name,
                  })
                }}
              >
                <SelectTrigger><SelectValue placeholder="Select apartment" /></SelectTrigger>
                <SelectContent>
                  {state.apartments.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.unit_number} — {a.primary_resident_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Payer Name</Label>
              <Input value={payForm.payer_name} onChange={(e) => setPayForm({ ...payForm, payer_name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Amount *</Label>
                <Input type="number" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} />
              </div>
              <div>
                <Label>Method</Label>
                <Select value={payForm.method} onValueChange={(v) => setPayForm({ ...payForm, method: v as PaymentMethod })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Date Paid *</Label>
              <Input type="date" value={payForm.date_paid} onChange={(e) => setPayForm({ ...payForm, date_paid: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Period Start *</Label>
                <Input type="date" value={payForm.period_start} onChange={(e) => setPayForm({ ...payForm, period_start: e.target.value })} />
              </div>
              <div>
                <Label>Period End *</Label>
                <Input type="date" value={payForm.period_end} onChange={(e) => setPayForm({ ...payForm, period_end: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddPayment}>Add Payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }
}
