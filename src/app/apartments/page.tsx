"use client"

import { useState, useMemo, useEffect, useRef, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { useStore } from "@/lib/store"
import { useComputed } from "@/hooks/use-computed"
import { formatCurrency, formatDate, cn } from "@/lib/utils"
import { OCCUPANCY_STATUSES, PAYMENT_METHODS, buildingFloors, PAYER_RELATIONS } from "@/lib/constants"
import { buildCsv, csvToObjects, downloadCsv, normalizeDate, parseAmount } from "@/lib/csv"
import {
  monthKey,
  monthKeyOrNull,
  currentMonthKey,
  addMonthsToKey,
  monthsBetween,
  firstDayOfMonth,
  lastDayOfMonth,
  monthKeyLabel,
  monthRangeLabel,
  isValidMonthKey,
} from "@/lib/months"
import type { MonthCellStatus } from "@/lib/computations"
import type { Apartment, ApartmentWithStatus, Payment, PaymentStatus, OccupancyStatus, PaymentMethod, PayerRelation } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/components/ui/use-toast"
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
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Phone,
  Mail,
  Pencil,
  Trash2,
  DollarSign,
  Building2,
  Download,
  Upload,
  Users,
  RotateCcw,
} from "lucide-react"

type SortField = "unit_number" | "amount_owed"
type SortDir = "asc" | "desc"

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

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

const relationLabel = (value: PayerRelation) =>
  PAYER_RELATIONS.find((r) => r.value === value)?.label ?? "—"

// natural sort: unit "2" before unit "10"
const unitCompare = (a: string, b: string) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })

const monthCellClass = (s: MonthCellStatus) =>
  s === "paid"
    ? "bg-emerald-500"
    : s === "due"
    ? "bg-red-500"
    : s === "future"
    ? "bg-muted border border-border"
    : "bg-muted/30"

const monthCellTitle = (s: MonthCellStatus) =>
  s === "paid" ? "Paid" : s === "due" ? "Not paid" : s === "future" ? "Not due yet" : "Not tracked"

const emptyApartmentForm = {
  unit_number: "",
  building_no: "1",
  floor: "1",
  primary_resident_name: "",
  secondary_resident_name: "",
  phone: "",
  phone2: "",
  email: "",
  monthly_due_amount: "",
  occupancy_status: "active" as OccupancyStatus,
  notes: "",
}

const emptyPaymentForm = {
  apartment_id: "",
  payer_name: "",
  payer_relation: "" as PayerRelation,
  amount: "",
  method: "cash" as PaymentMethod,
  date_paid: new Date().toISOString().split("T")[0],
  from_month: currentMonthKey(),
  months_count: "1",
  recurring: false,
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
  const { state, addApartment, updateApartment, deleteApartment, addPayment, updatePayment, deletePayment, importPayments } = useStore()
  const { apartmentsWithStatus, getPaymentsForApartment, getMonthCells, getCoverage } = useComputed()
  const { toast } = useToast()

  const searchParams = useSearchParams()

  const [search, setSearch] = useState("")
  // filters start from the URL so dashboard cards can link here preset
  const [filterStatus, setFilterStatus] = useState<PaymentStatus | "all">(() => {
    const v = searchParams.get("status")
    return v === "paid" || v === "due_soon" || v === "overdue" ? v : "all"
  })
  const [filterOccupancy, setFilterOccupancy] = useState<OccupancyStatus | "all">(() => {
    const v = searchParams.get("occupancy")
    return v === "active" || v === "mia" || v === "traveling_but_paying" ? v : "all"
  })
  const [filterMethod, setFilterMethod] = useState<PaymentMethod | "all">(() => {
    const v = searchParams.get("method")
    return v === "cash" || v === "bank" ? v : "all"
  })
  const [filterFloor, setFilterFloor] = useState<string>(() => searchParams.get("floor") ?? "all")
  const [filterBuilding, setFilterBuilding] = useState<string>("all")

  const [sortField, setSortField] = useState<SortField>("unit_number")
  const [sortDir, setSortDir] = useState<SortDir>("asc")

  const [gridYear, setGridYear] = useState(() => new Date().getFullYear())

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState<Apartment | null>(null)

  const [aptDialogOpen, setAptDialogOpen] = useState(false)
  const [aptForm, setAptForm] = useState(emptyApartmentForm)

  const [payDialogOpen, setPayDialogOpen] = useState(false)
  const [payForm, setPayForm] = useState(emptyPaymentForm)
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null)

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deletePaymentId, setDeletePaymentId] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const id = searchParams.get("id")
    if (id) setSelectedId(id)
  }, [searchParams])

  // floors come from the building setup so the app can't hold
  // apartments on floors that don't exist
  const floors = useMemo(
    () => buildingFloors(state.settings.mezzanine_floors, state.settings.num_floors),
    [state.settings.mezzanine_floors, state.settings.num_floors]
  )
  const numBuildings = Math.max(1, state.settings.num_buildings || 1)

  const filtersActive =
    search !== "" ||
    filterStatus !== "all" ||
    filterOccupancy !== "all" ||
    filterMethod !== "all" ||
    filterFloor !== "all" ||
    filterBuilding !== "all"

  function resetFilters() {
    setSearch("")
    setFilterStatus("all")
    setFilterOccupancy("all")
    setFilterMethod("all")
    setFilterFloor("all")
    setFilterBuilding("all")
  }

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
          a.secondary_resident_name.toLowerCase().includes(q) ||
          paymentPayers.includes(a.id)
      )
    }

    if (filterStatus !== "all") {
      list = list.filter((a) => a.payment_status === filterStatus)
    }
    if (filterOccupancy !== "all") {
      list = list.filter((a) => a.occupancy_status === filterOccupancy)
    }
    if (filterFloor !== "all") {
      list = list.filter((a) => a.floor === filterFloor)
    }
    if (filterBuilding !== "all") {
      list = list.filter((a) => String(a.building_no ?? 1) === filterBuilding)
    }
    if (filterMethod !== "all") {
      const aptIdsWithMethod = new Set(
        state.payments.filter((p) => p.method === filterMethod).map((p) => p.apartment_id)
      )
      list = list.filter((a) => aptIdsWithMethod.has(a.id))
    }

    list = [...list].sort((a, b) => {
      let cmp = 0
      if (sortField === "unit_number") cmp = unitCompare(a.unit_number, b.unit_number)
      else if (sortField === "amount_owed") cmp = a.amount_owed - b.amount_owed
      return sortDir === "asc" ? cmp : -cmp
    })

    return list
  }, [apartmentsWithStatus, search, filterStatus, filterOccupancy, filterFloor, filterBuilding, filterMethod, sortField, sortDir, state.payments])

  // apartments in ascending unit order for the collection grid
  const gridApartments = useMemo(
    () => [...apartmentsWithStatus].sort((a, b) => unitCompare(a.unit_number, b.unit_number)),
    [apartmentsWithStatus]
  )

  // money collected per apartment within the grid year
  const collectedByApartment = useMemo(() => {
    const map = new Map<string, number>()
    const y = String(gridYear)
    for (const p of state.payments) {
      if (p.date_paid?.slice(0, 4) !== y) continue
      map.set(p.apartment_id, (map.get(p.apartment_id) ?? 0) + p.amount)
    }
    return map
  }, [state.payments, gridYear])

  // every payment entry, newest payment date first — the payment log
  const paymentLog = useMemo(() => {
    const aptById = new Map(state.apartments.map((a) => [a.id, a]))
    return [...state.payments]
      .sort((a, b) =>
        b.date_paid.localeCompare(a.date_paid) ||
        (b.created_at || "").localeCompare(a.created_at || "")
      )
      .map((p) => ({
        ...p,
        unit_number: aptById.get(p.apartment_id)?.unit_number ?? "?",
      }))
  }, [state.payments, state.apartments])

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
    const due = parseAmount(aptForm.monthly_due_amount)
    if (!aptForm.unit_number || !aptForm.primary_resident_name || isNaN(due)) return

    // hard limits from the building setup — no mishaps
    const buildingNo = Math.max(1, parseInt(aptForm.building_no, 10) || 1)
    if (!floors.includes(aptForm.floor)) {
      toast({
        title: "Floor not available",
        description: `Floor ${aptForm.floor} is outside the building structure configured in Building Setup.`,
        variant: "destructive",
      })
      return
    }
    const perFloor = state.settings.apartments_per_floor
    if (perFloor > 0) {
      const onFloor = state.apartments.filter(
        (a) => a.floor === aptForm.floor && (a.building_no ?? 1) === buildingNo
      ).length
      if (onFloor >= perFloor) {
        toast({
          title: "Floor is full",
          description: `Floor ${aptForm.floor} already has ${onFloor} of ${perFloor} apartments allowed per floor (see Building Setup).`,
          variant: "destructive",
        })
        return
      }
    }
    if (state.settings.total_apartments > 0 && state.apartments.length >= state.settings.total_apartments) {
      toast({
        title: "Building is full",
        description: `All ${state.settings.total_apartments} apartments are already registered (see Building Setup).`,
        variant: "destructive",
      })
      return
    }

    addApartment({
      unit_number: aptForm.unit_number,
      building_no: buildingNo,
      floor: aptForm.floor,
      primary_resident_name: aptForm.primary_resident_name,
      secondary_resident_name: aptForm.secondary_resident_name,
      phone: aptForm.phone,
      phone2: aptForm.phone2,
      email: aptForm.email,
      payment_interval: "monthly",
      monthly_due_amount: due,
      occupancy_status: aptForm.occupancy_status,
      notes: aptForm.notes,
    })
    setAptDialogOpen(false)
    setAptForm(emptyApartmentForm)
  }

  // opens the payment dialog prefilled for one apartment: the from-month
  // defaults to the month after the last fully paid month
  function openAddPaymentFor(apt: Apartment | null) {
    const cov = apt ? getCoverage(apt.id) : undefined
    const from = cov?.nextUnpaidMonth ?? currentMonthKey()
    const due = apt?.monthly_due_amount ?? 0
    setEditingPayment(null)
    setPayForm({
      ...emptyPaymentForm,
      apartment_id: apt?.id ?? "",
      payer_name: apt?.primary_resident_name ?? "",
      from_month: from,
      months_count: "1",
      amount: due > 0 ? String(due) : "",
      date_paid: new Date().toISOString().split("T")[0],
    })
    setPayDialogOpen(true)
  }

  function openEditPayment(p: Payment) {
    const fromKey = monthKeyOrNull(p.period_start) ?? monthKey(p.date_paid)
    const endKey = monthKeyOrNull(p.period_end) ?? fromKey
    setEditingPayment(p)
    setPayForm({
      apartment_id: p.apartment_id,
      payer_name: p.payer_name,
      payer_relation: p.payer_relation ?? "",
      amount: String(p.amount),
      method: p.method,
      date_paid: p.date_paid,
      from_month: fromKey,
      months_count: String(Math.max(1, monthsBetween(fromKey, endKey) + 1)),
      recurring: p.recurring ?? false,
      notes: p.notes,
    })
    setPayDialogOpen(true)
  }

  function handleSubmitPayment() {
    const amount = parseAmount(payForm.amount)
    const count = Math.max(1, parseInt(payForm.months_count) || 1)
    if (!payForm.apartment_id || isNaN(amount) || !payForm.date_paid || !isValidMonthKey(payForm.from_month)) return

    const endMonth = addMonthsToKey(payForm.from_month, count - 1)
    const fields = {
      apartment_id: payForm.apartment_id,
      payer_name: payForm.payer_name,
      payer_relation: payForm.payer_relation,
      amount,
      method: payForm.method,
      date_paid: payForm.date_paid,
      period_start: firstDayOfMonth(payForm.from_month),
      period_end: lastDayOfMonth(endMonth),
      recurring: payForm.recurring,
      notes: payForm.notes,
    }

    if (editingPayment) {
      updatePayment({ ...editingPayment, ...fields })
    } else {
      addPayment(fields)
    }
    setPayDialogOpen(false)
    setEditingPayment(null)
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

  // ── CSV export / import ──

  function exportPaymentsCsv() {
    const aptById = new Map(state.apartments.map((a) => [a.id, a]))
    const headers = ["unit_number", "payer_name", "payer_relation", "amount", "method", "date_paid", "first_month", "last_month", "recurring", "notes"]
    const rows = state.payments.map((p) => [
      aptById.get(p.apartment_id)?.unit_number ?? "",
      p.payer_name,
      p.payer_relation,
      p.amount,
      p.method,
      p.date_paid,
      monthKeyOrNull(p.period_start) ?? "",
      monthKeyOrNull(p.period_end) ?? "",
      p.recurring ? "yes" : "",
      p.notes,
    ])
    downloadCsv(`payments-${new Date().toISOString().slice(0, 10)}.csv`, buildCsv(headers, rows))
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const objs = csvToObjects(String(reader.result || ""))
      const aptByUnit = new Map(
        state.apartments.map((a) => [a.unit_number.trim().toLowerCase(), a])
      )
      let skipped = 0
      const rows: Omit<Payment, "id" | "created_at">[] = []
      for (const o of objs) {
        const apt = aptByUnit.get((o.unit_number || "").toLowerCase())
        const amount = parseAmount(o.amount || "")
        const datePaid = normalizeDate(o.date_paid || "")
        if (!apt || isNaN(amount) || !datePaid) { skipped++; continue }

        // months covered: first_month/last_month, else legacy period
        // dates, else the month of the payment date
        const firstKey =
          monthKeyOrNull(o.first_month || "") ??
          monthKeyOrNull(o.period_start || "") ??
          monthKey(datePaid)
        const lastKey =
          monthKeyOrNull(o.last_month || "") ??
          monthKeyOrNull(o.period_end || "") ??
          firstKey

        const relRaw = (o.payer_relation || "").toLowerCase()
        rows.push({
          apartment_id: apt.id,
          payer_name: o.payer_name || apt.primary_resident_name,
          payer_relation: PAYER_RELATIONS.some((r) => r.value === relRaw) ? (relRaw as PayerRelation) : "",
          amount,
          method: (o.method || "").toLowerCase() === "bank" ? "bank" : "cash",
          date_paid: datePaid,
          period_start: firstDayOfMonth(firstKey),
          period_end: lastDayOfMonth(lastKey >= firstKey ? lastKey : firstKey),
          recurring: ["yes", "true", "1"].includes((o.recurring || "").toLowerCase()),
          notes: o.notes || "",
        })
      }
      const n = importPayments(rows)
      toast({
        title: "Import complete",
        description: `${n} payments imported${skipped ? `, ${skipped} rows skipped` : ""}`,
        variant: skipped && !n ? "destructive" : "success",
      })
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
    reader.readAsText(file)
  }

  if (!state.loaded) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  const yearNav = (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setGridYear((y) => y - 1)} aria-label="Previous year">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="text-sm font-semibold tabular-nums">{gridYear}</span>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setGridYear((y) => y + 1)} aria-label="Next year">
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )

  const gridLegend = (
    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      <span className="flex items-center gap-1"><span className="inline-block h-3 w-4 rounded-sm bg-emerald-500" /> Paid</span>
      <span className="flex items-center gap-1"><span className="inline-block h-3 w-4 rounded-sm bg-red-500" /> Not paid</span>
      <span className="flex items-center gap-1"><span className="inline-block h-3 w-4 rounded-sm bg-muted border border-border" /> Not due yet</span>
    </div>
  )

  // Apartment Profile Panel
  if (selectedApt) {
    const apt = selectedApt
    const editing = isEditing && editData
    const cells = getMonthCells(apt.id, gridYear)

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => { setSelectedId(null); setIsEditing(false); setEditData(null) }}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Button>
          <h1 className="text-2xl font-bold">Unit {apt.unit_number}</h1>
          {numBuildings > 1 && <Badge variant="outline">Building {apt.building_no ?? 1}</Badge>}
          <Badge variant="outline">Floor {apt.floor}</Badge>
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
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Users className="h-3 w-3" /> Second Inhabitant
                  </p>
                  {editing ? (
                    <Input className="mt-1" value={editData!.secondary_resident_name} onChange={(e) => setEditData({ ...editData!, secondary_resident_name: e.target.value })} placeholder="Name" />
                  ) : (
                    <p className="font-medium">{apt.secondary_resident_name || "—"}</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3" /> Phone 1
                  </p>
                  {editing ? (
                    <Input className="mt-1" value={editData!.phone} onChange={(e) => setEditData({ ...editData!, phone: e.target.value })} />
                  ) : (
                    <p className="font-medium">{apt.phone || "N/A"}</p>
                  )}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3" /> Phone 2
                  </p>
                  {editing ? (
                    <Input className="mt-1" value={editData!.phone2} onChange={(e) => setEditData({ ...editData!, phone2: e.target.value })} />
                  ) : (
                    <p className="font-medium">{apt.phone2 || "—"}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{apt.email || "N/A"}</span>
              </div>

              <div className="space-y-3 pt-2 border-t">
                <div>
                  <Label className="text-sm text-muted-foreground">Monthly Due Amount</Label>
                  {editing ? (
                    <Input type="number" className="mt-1" value={editData!.monthly_due_amount} onChange={(e) => setEditData({ ...editData!, monthly_due_amount: parseAmount(e.target.value) || 0 })} />
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
                  <p className="text-sm text-muted-foreground">Paid Through</p>
                  <p className="text-lg font-semibold">
                    {apt.last_paid_month ? monthKeyLabel(apt.last_paid_month) : "No month paid yet"}
                  </p>
                </div>
              </div>
              {apt.next_unpaid_month && (
                <p className="text-sm text-muted-foreground">
                  Next payment covers <span className="font-medium text-foreground">{monthKeyLabel(apt.next_unpaid_month)}</span>
                </p>
              )}
              {apt.days_overdue > 0 && (
                <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                  {apt.days_overdue} days overdue
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Month grid for this apartment */}
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle>Paid Months</CardTitle>
            {yearNav}
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="overflow-x-auto">
              <div className="flex gap-1.5 min-w-max">
                {cells.map((s, i) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <span className="text-[10px] text-muted-foreground">{MONTH_LABELS[i]}</span>
                    <div
                      className={cn("h-7 w-10 rounded-sm", monthCellClass(s))}
                      title={`${MONTH_LABELS[i]} ${gridYear}: ${monthCellTitle(s)}`}
                    />
                  </div>
                ))}
              </div>
            </div>
            {gridLegend}
          </CardContent>
        </Card>

        {/* Payment History */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Payment History</CardTitle>
            <Button size="sm" onClick={() => openAddPaymentFor(apt)}>
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
                      <TableHead>Date Paid</TableHead>
                      <TableHead>Payer</TableHead>
                      <TableHead>Relation</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Months</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead className="w-[80px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedPayments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="whitespace-nowrap">{formatDate(p.date_paid)}</TableCell>
                        <TableCell>{p.payer_name}</TableCell>
                        <TableCell>{p.payer_relation ? relationLabel(p.payer_relation) : "—"}</TableCell>
                        <TableCell className="font-medium">{formatCurrency(p.amount)}</TableCell>
                        <TableCell>
                          <Badge variant={p.method === "cash" ? "outline" : "secondary"}>{p.method}</Badge>
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          {monthRangeLabel(monthKeyOrNull(p.period_start) ?? monthKey(p.date_paid), monthKeyOrNull(p.period_end) ?? monthKey(p.date_paid))}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[160px] truncate">{p.notes || "—"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditPayment(p)} aria-label="Edit payment">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeletePaymentId(p.id)} aria-label="Delete payment">
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Delete apartment confirmation */}
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

        {renderDeletePaymentDialog()}
        {renderPaymentDialog()}
      </div>
    )
  }

  // Main List View
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Apartments & Payments</h1>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => { setAptForm(emptyApartmentForm); setAptDialogOpen(true) }}>
            <Building2 className="mr-1 h-4 w-4" /> Add Apartment
          </Button>
          <Button variant="outline" onClick={() => openAddPaymentFor(null)}>
            <DollarSign className="mr-1 h-4 w-4" /> Add Payment
          </Button>
          <Button variant="outline" onClick={exportPaymentsCsv}>
            <Download className="mr-1 h-4 w-4" /> Export CSV
          </Button>
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="mr-1 h-4 w-4" /> Import CSV
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
              {numBuildings > 1 && (
                <Select value={filterBuilding} onValueChange={setFilterBuilding}>
                  <SelectTrigger className="w-[140px]"><SelectValue placeholder="Building" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Buildings</SelectItem>
                    {Array.from({ length: numBuildings }, (_, i) => String(i + 1)).map((b) => (
                      <SelectItem key={b} value={b}>Building {b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Select value={filterFloor} onValueChange={setFilterFloor}>
                <SelectTrigger className="w-[130px]"><SelectValue placeholder="Floor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Floors</SelectItem>
                  {floors.map((f) => (
                    <SelectItem key={f} value={f}>{f.startsWith("M") ? `Mezzanine ${f}` : `Floor ${f}`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              {filtersActive && (
                <Button variant="ghost" onClick={resetFilters}>
                  <RotateCcw className="mr-1 h-4 w-4" /> Reset Filters
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Table */}
      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("unit_number")}>
                    Unit <SortIcon field="unit_number" />
                  </TableHead>
                  <TableHead>Resident</TableHead>
                  <TableHead>Monthly Due</TableHead>
                  <TableHead>Occupancy</TableHead>
                  <TableHead>Payment Status</TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("amount_owed")}>
                    Amount Owed <SortIcon field="amount_owed" />
                  </TableHead>
                  <TableHead className="text-right">Last Paid Month</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
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
                      <TableCell>{formatCurrency(apt.monthly_due_amount)}</TableCell>
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
                      <TableCell className="text-right text-sm">
                        {apt.last_paid_month ? monthKeyLabel(apt.last_paid_month) : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Collection Grid */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>Collection Grid</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Paid months per apartment at a glance, lowest unit first.
            </p>
          </div>
          {yearNav}
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-card">Unit</TableHead>
                  {MONTH_LABELS.map((m) => (
                    <TableHead key={m} className="text-center px-1">{m}</TableHead>
                  ))}
                  <TableHead className="text-right">Collected {gridYear}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gridApartments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={14} className="text-center py-8 text-muted-foreground">
                      No apartments yet
                    </TableCell>
                  </TableRow>
                ) : (
                  gridApartments.map((apt) => {
                    const cells = getMonthCells(apt.id, gridYear)
                    return (
                      <TableRow
                        key={apt.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelectedId(apt.id)}
                      >
                        <TableCell className="font-medium sticky left-0 bg-card whitespace-nowrap">
                          {apt.unit_number}
                        </TableCell>
                        {cells.map((s, i) => (
                          <TableCell key={i} className="px-1 py-2 text-center">
                            <div
                              className={cn("mx-auto h-5 w-7 rounded-sm", monthCellClass(s))}
                              title={`Unit ${apt.unit_number} — ${MONTH_LABELS[i]} ${gridYear}: ${monthCellTitle(s)}`}
                            />
                          </TableCell>
                        ))}
                        <TableCell className="text-right font-medium whitespace-nowrap">
                          {formatCurrency(collectedByApartment.get(apt.id) ?? 0)}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
          {gridLegend}
        </CardContent>
      </Card>

      {/* Payment Log */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Log</CardTitle>
          <p className="text-sm text-muted-foreground">
            Every payment entry. Use the pencil to fix a wrong entry.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date Paid</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Payer</TableHead>
                  <TableHead>Relation</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Months</TableHead>
                  <TableHead className="w-[90px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paymentLog.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No payments entered yet
                    </TableCell>
                  </TableRow>
                ) : (
                  paymentLog.map((p) => (
                    <TableRow
                      key={p.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedId(p.apartment_id)}
                    >
                      <TableCell className="whitespace-nowrap">{formatDate(p.date_paid)}</TableCell>
                      <TableCell className="font-medium">{p.unit_number}</TableCell>
                      <TableCell>{p.payer_name}</TableCell>
                      <TableCell>{p.payer_relation ? relationLabel(p.payer_relation) : "—"}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(p.amount)}</TableCell>
                      <TableCell>
                        <Badge variant={p.method === "cash" ? "outline" : "secondary"}>{p.method}</Badge>
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {monthRangeLabel(monthKeyOrNull(p.period_start) ?? monthKey(p.date_paid), monthKeyOrNull(p.period_end) ?? monthKey(p.date_paid))}
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditPayment(p)} aria-label="Edit payment">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeletePaymentId(p.id)} aria-label="Delete payment">
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Apartment</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Unit Number *</Label>
                <Input value={aptForm.unit_number} onChange={(e) => setAptForm({ ...aptForm, unit_number: e.target.value })} placeholder="e.g. 3" />
              </div>
              <div>
                <Label>Floor</Label>
                <Select value={aptForm.floor} onValueChange={(v) => setAptForm({ ...aptForm, floor: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {floors.map((f) => (
                      <SelectItem key={f} value={f}>{f.startsWith("M") ? `Mezzanine ${f}` : `Floor ${f}`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {numBuildings > 1 && (
              <div>
                <Label>Building</Label>
                <Select value={aptForm.building_no} onValueChange={(v) => setAptForm({ ...aptForm, building_no: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: numBuildings }, (_, i) => String(i + 1)).map((b) => (
                      <SelectItem key={b} value={b}>Building {b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Primary Resident Name *</Label>
              <Input value={aptForm.primary_resident_name} onChange={(e) => setAptForm({ ...aptForm, primary_resident_name: e.target.value })} />
            </div>
            <div>
              <Label>Second Inhabitant</Label>
              <Input value={aptForm.secondary_resident_name} onChange={(e) => setAptForm({ ...aptForm, secondary_resident_name: e.target.value })} placeholder="Optional" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Phone 1</Label>
                <Input value={aptForm.phone} onChange={(e) => setAptForm({ ...aptForm, phone: e.target.value })} />
              </div>
              <div>
                <Label>Phone 2</Label>
                <Input value={aptForm.phone2} onChange={(e) => setAptForm({ ...aptForm, phone2: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Email</Label>
                <Input type="email" value={aptForm.email} onChange={(e) => setAptForm({ ...aptForm, email: e.target.value })} />
              </div>
              <div>
                <Label>Monthly Due *</Label>
                <Input type="text" inputMode="decimal" value={aptForm.monthly_due_amount} onChange={(e) => setAptForm({ ...aptForm, monthly_due_amount: e.target.value })} placeholder="0" />
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

      {renderDeletePaymentDialog()}
      {renderPaymentDialog()}
    </div>
  )

  function renderDeletePaymentDialog() {
    return (
      <Dialog open={!!deletePaymentId} onOpenChange={() => setDeletePaymentId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Payment</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently remove this payment entry. This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletePaymentId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deletePaymentId) deletePayment(deletePaymentId)
                setDeletePaymentId(null)
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  function renderPaymentDialog() {
    const selApt = state.apartments.find((a) => a.id === payForm.apartment_id)
    const due = selApt?.monthly_due_amount ?? 0
    const count = Math.max(1, parseInt(payForm.months_count) || 1)
    const endMonth = isValidMonthKey(payForm.from_month)
      ? addMonthsToKey(payForm.from_month, count - 1)
      : payForm.from_month

    return (
      <Dialog
        open={payDialogOpen}
        onOpenChange={(open) => {
          setPayDialogOpen(open)
          if (!open) setEditingPayment(null)
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPayment ? "Edit Payment" : "Add Payment"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label>Apartment *</Label>
              <Select
                value={payForm.apartment_id}
                onValueChange={(v) => {
                  const apt = state.apartments.find((a) => a.id === v)
                  const cov = getCoverage(v)
                  const aptDue = apt?.monthly_due_amount ?? 0
                  setPayForm({
                    ...payForm,
                    apartment_id: v,
                    payer_name: apt?.primary_resident_name || payForm.payer_name,
                    // default the months to continue after the last paid month
                    from_month: editingPayment ? payForm.from_month : (cov?.nextUnpaidMonth ?? currentMonthKey()),
                    amount: editingPayment ? payForm.amount : (aptDue > 0 ? String(aptDue * count) : payForm.amount),
                  })
                }}
              >
                <SelectTrigger><SelectValue placeholder="Select apartment" /></SelectTrigger>
                <SelectContent>
                  {[...state.apartments].sort((a, b) => unitCompare(a.unit_number, b.unit_number)).map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.unit_number} — {a.primary_resident_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Payer Name</Label>
                <Input value={payForm.payer_name} onChange={(e) => setPayForm({ ...payForm, payer_name: e.target.value })} />
              </div>
              <div>
                <Label>Relation to Resident</Label>
                <Select
                  value={payForm.payer_relation || undefined}
                  onValueChange={(v) => setPayForm({ ...payForm, payer_relation: v as PayerRelation })}
                >
                  <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                  <SelectContent>
                    {PAYER_RELATIONS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>First Month Paid *</Label>
                <Input
                  type="month"
                  value={payForm.from_month}
                  onChange={(e) => setPayForm({ ...payForm, from_month: e.target.value })}
                />
              </div>
              <div>
                <Label>Number of Months</Label>
                <Input
                  type="number"
                  min="1"
                  max="24"
                  value={payForm.months_count}
                  onChange={(e) => {
                    const c = Math.max(1, parseInt(e.target.value) || 1)
                    setPayForm({
                      ...payForm,
                      months_count: e.target.value,
                      amount: !editingPayment && due > 0 ? String(due * c) : payForm.amount,
                    })
                  }}
                />
              </div>
            </div>
            {isValidMonthKey(payForm.from_month) && (
              <p className="text-xs text-muted-foreground -mt-2">
                Covers: {monthRangeLabel(payForm.from_month, endMonth)}
                {due > 0 && ` · expected ${formatCurrency(due * count)}`}
              </p>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Amount *</Label>
                {/* free-typing text input (numeric keypad on mobile) — the
                    number spinner made data entry painful */}
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  value={payForm.amount}
                  onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
                />
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
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <Label>Repeat monthly</Label>
                <p className="text-xs text-muted-foreground">
                  Automatically add this payment again each month
                </p>
              </div>
              <Switch
                checked={payForm.recurring}
                onCheckedChange={(v) => setPayForm({ ...payForm, recurring: v })}
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPayDialogOpen(false); setEditingPayment(null) }}>Cancel</Button>
            <Button onClick={handleSubmitPayment}>{editingPayment ? "Save Changes" : "Add Payment"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }
}
