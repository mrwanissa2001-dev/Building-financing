"use client"

import { useState, useEffect, useMemo } from "react"
import { useStore } from "@/lib/store"
import { useToast } from "@/components/ui/use-toast"
import { testConnection } from "@/lib/supabase-data"
import { buildingFloors } from "@/lib/constants"
import { formatCurrency } from "@/lib/utils"
import { parseAmount } from "@/lib/csv"
import type { Apartment, CategoryPerson, YearlyHistory } from "@/lib/types"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card"
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
import { useI18n } from "@/lib/i18n"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Plus, Trash2, Check, Pencil, X, Users, History, LayoutGrid } from "lucide-react"

// natural unit sort: "2" before "10"
const unitCompare = (a: string, b: string) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })

export default function SettingsPage() {
  const {
    state,
    updateSettings,
    addPerson,
    updatePerson,
    deletePerson,
    addHistory,
    updateHistory,
    deleteHistory,
    addApartment,
    updateApartment,
    deleteApartment,
  } = useStore()
  const { toast } = useToast()
  const { t } = useI18n()

  const [buildingName, setBuildingName] = useState("")
  const [totalApartments, setTotalApartments] = useState("")
  const [expectedIncome, setExpectedIncome] = useState("")
  const [expectedExpenditure, setExpectedExpenditure] = useState("")
  const [numBuildings, setNumBuildings] = useState("1")
  const [numFloors, setNumFloors] = useState("13")
  const [mezzanineFloors, setMezzanineFloors] = useState("2")
  const [apartmentsPerFloor, setApartmentsPerFloor] = useState("0")

  const [connStatus, setConnStatus] = useState<'checking' | 'connected' | 'error'>('checking')
  const [connMessage, setConnMessage] = useState('')

  // per-category "add person" inputs, keyed by category id
  const [newPersonName, setNewPersonName] = useState<Record<string, string>>({})
  // person being renamed inline
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null)
  const [editingPersonName, setEditingPersonName] = useState("")

  // previous-years form
  const [histYear, setHistYear] = useState("")
  const [histIncome, setHistIncome] = useState("")
  const [histExpenditure, setHistExpenditure] = useState("")
  // optional cash/bank splits — they carry the year into the dashboard balances
  const [histIncomeCash, setHistIncomeCash] = useState("")
  const [histIncomeBank, setHistIncomeBank] = useState("")
  const [histExpCash, setHistExpCash] = useState("")
  const [histExpBank, setHistExpBank] = useState("")
  const [editingHistId, setEditingHistId] = useState<string | null>(null)
  // breakdown editor state: which year row is expanded + its percents
  const [breakdownHistId, setBreakdownHistId] = useState<string | null>(null)
  const [breakdownPercents, setBreakdownPercents] = useState<Record<string, string>>({})

  // floor-plan editor state
  const [planBuilding, setPlanBuilding] = useState("1")
  const [unitDraft, setUnitDraft] = useState<Record<string, string>>({})
  const [deletePlanApt, setDeletePlanApt] = useState<Apartment | null>(null)

  useEffect(() => {
    testConnection().then(({ ok, message }) => {
      setConnStatus(ok ? 'connected' : 'error')
      setConnMessage(message)
    })
  }, [])

  useEffect(() => {
    if (state.loaded) {
      setBuildingName(state.settings.building_name)
      setTotalApartments(state.settings.total_apartments.toString())
      setExpectedIncome(state.settings.expected_yearly_income.toString())
      setExpectedExpenditure(
        state.settings.expected_yearly_expenditure.toString()
      )
      setNumBuildings(state.settings.num_buildings.toString())
      setNumFloors(state.settings.num_floors.toString())
      setMezzanineFloors(state.settings.mezzanine_floors.toString())
      setApartmentsPerFloor(state.settings.apartments_per_floor.toString())
    }
  }, [state.loaded, state.settings])

  // ── Floor plan ──
  const numBuildingsSaved = Math.max(1, state.settings.num_buildings || 1)
  const planFloors = useMemo(
    () => buildingFloors(state.settings.mezzanine_floors, state.settings.num_floors),
    [state.settings.mezzanine_floors, state.settings.num_floors]
  )
  const aptsByFloor = useMemo(() => {
    const m = new Map<string, Apartment[]>()
    for (const a of state.apartments) {
      if (numBuildingsSaved > 1 && String(a.building_no ?? 1) !== planBuilding) continue
      const arr = m.get(a.floor) ?? []
      arr.push(a)
      m.set(a.floor, arr)
    }
    for (const arr of m.values()) arr.sort((x, y) => unitCompare(x.unit_number, y.unit_number))
    return m
  }, [state.apartments, planBuilding, numBuildingsSaved])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const parsedApartments = parseInt(totalApartments, 10)
    const parsedIncome = parseFloat(expectedIncome)
    const parsedExpenditure = parseFloat(expectedExpenditure)
    const parsedBuildings = Math.max(1, parseInt(numBuildings, 10) || 1)
    const parsedFloors = Math.max(1, parseInt(numFloors, 10) || 1)
    const parsedMezzanine = Math.max(0, parseInt(mezzanineFloors, 10) || 0)
    const parsedPerFloor = Math.max(0, parseInt(apartmentsPerFloor, 10) || 0)

    if (isNaN(parsedApartments) || isNaN(parsedIncome) || isNaN(parsedExpenditure)) {
      return
    }

    updateSettings({
      building_name: buildingName.trim(),
      total_apartments: parsedApartments,
      expected_yearly_income: parsedIncome,
      expected_yearly_expenditure: parsedExpenditure,
      num_buildings: parsedBuildings,
      num_floors: parsedFloors,
      mezzanine_floors: parsedMezzanine,
      apartments_per_floor: parsedPerFloor,
    })

    toast({
      title: t("Settings saved!"),
      description: t("Your building settings have been updated."),
      variant: "success",
    })
  }

  // ── Category people ──

  function peopleFor(categoryId: string): CategoryPerson[] {
    return state.people.filter((p) => p.category_id === categoryId)
  }

  function handleAddPerson(categoryId: string) {
    const name = (newPersonName[categoryId] || "").trim()
    if (!name) return
    addPerson(categoryId, name)
    setNewPersonName((m) => ({ ...m, [categoryId]: "" }))
  }

  function startRenamePerson(p: CategoryPerson) {
    setEditingPersonId(p.id)
    setEditingPersonName(p.name)
  }

  function saveRenamePerson(p: CategoryPerson) {
    const name = editingPersonName.trim()
    if (name && name !== p.name) updatePerson({ ...p, name })
    setEditingPersonId(null)
    setEditingPersonName("")
  }

  // ── Previous years ──

  function startEditHistory(h: YearlyHistory) {
    setEditingHistId(h.id)
    setHistYear(String(h.year))
    setHistIncome(String(h.income))
    setHistExpenditure(String(h.expenditure))
    setHistIncomeCash(h.income_cash ? String(h.income_cash) : "")
    setHistIncomeBank(h.income_bank ? String(h.income_bank) : "")
    setHistExpCash(h.expenditure_cash ? String(h.expenditure_cash) : "")
    setHistExpBank(h.expenditure_bank ? String(h.expenditure_bank) : "")
  }

  function resetHistoryForm() {
    setEditingHistId(null)
    setHistYear("")
    setHistIncome("")
    setHistExpenditure("")
    setHistIncomeCash("")
    setHistIncomeBank("")
    setHistExpCash("")
    setHistExpBank("")
  }

  function handleSubmitHistory() {
    const year = parseInt(histYear, 10)
    const income = parseAmount(histIncome)
    const expenditure = parseAmount(histExpenditure)
    const currentYear = new Date().getFullYear()
    if (isNaN(year) || year < 1900 || year > currentYear || isNaN(income) || isNaN(expenditure)) {
      toast({
        title: t("Invalid year data"),
        description: t("Enter a year up to {year} plus its income and expenditure totals.", { year: currentYear }),
        variant: "destructive",
      })
      return
    }
    const duplicate = state.history.find((h) => h.year === year && h.id !== editingHistId)
    if (duplicate) {
      toast({ title: t("Year already exists"), description: t("Edit the existing {year} row instead.", { year }), variant: "destructive" })
      return
    }
    // splits are optional; blank = 0 = the year does not touch the balances
    const splits = {
      income_cash: parseAmount(histIncomeCash) || 0,
      income_bank: parseAmount(histIncomeBank) || 0,
      expenditure_cash: parseAmount(histExpCash) || 0,
      expenditure_bank: parseAmount(histExpBank) || 0,
    }
    if (editingHistId) {
      const existing = state.history.find((h) => h.id === editingHistId)
      if (existing) updateHistory({ ...existing, year, income, expenditure, ...splits })
    } else {
      addHistory({ year, income, expenditure, ...splits, expense_breakdown: {} })
    }
    resetHistoryForm()
  }

  function openBreakdown(h: YearlyHistory) {
    setBreakdownHistId(h.id)
    const percents: Record<string, string> = {}
    for (const cat of state.categories) {
      const v = h.expense_breakdown[cat.name]
      percents[cat.name] = v ? String(v) : ""
    }
    setBreakdownPercents(percents)
  }

  function saveBreakdown(h: YearlyHistory) {
    const breakdown: Record<string, number> = {}
    for (const [name, raw] of Object.entries(breakdownPercents)) {
      const v = parseFloat(raw)
      if (!isNaN(v) && v > 0) breakdown[name] = v
    }
    updateHistory({ ...h, expense_breakdown: breakdown })
    setBreakdownHistId(null)
    toast({ title: t("Breakdown saved"), variant: "success" })
  }

  if (!state.loaded) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">{t("Loading settings...")}</p>
      </div>
    )
  }

  const floors = buildingFloors(
    parseInt(mezzanineFloors, 10) || 0,
    parseInt(numFloors, 10) || 1
  )
  const perFloor = Math.max(0, parseInt(apartmentsPerFloor, 10) || 0)
  const buildings = Math.max(1, parseInt(numBuildings, 10) || 1)
  const capacity = perFloor > 0 ? floors.length * perFloor * buildings : 0

  const breakdownTotal = Object.values(breakdownPercents).reduce((s, v) => {
    const n = parseFloat(v)
    return s + (isNaN(n) ? 0 : n)
  }, 0)

  // ── Floor plan actions ──
  function addUnitToFloor(floor: string) {
    const buildingNo = numBuildingsSaved > 1 ? parseInt(planBuilding, 10) || 1 : 1
    const onFloor = state.apartments.filter(
      (a) => a.floor === floor && (a.building_no ?? 1) === buildingNo
    )
    const isNum = /^\d+$/.test(floor)
    // suggest the next unit name; keep bumping if it collides
    let n = onFloor.length + 1
    const taken = new Set(state.apartments.map((a) => a.unit_number))
    let unit = isNum ? `${floor}${String(n).padStart(2, "0")}` : `${floor}-${n}`
    while (taken.has(unit)) {
      n += 1
      unit = isNum ? `${floor}${String(n).padStart(2, "0")}` : `${floor}-${n}`
    }
    addApartment({
      unit_number: unit,
      building_no: buildingNo,
      floor,
      primary_resident_name: "",
      secondary_resident_name: "",
      phone: "",
      phone2: "",
      email: "",
      payment_interval: "monthly",
      monthly_due_amount: 0,
      occupancy_status: "active",
      notes: "",
    })
  }

  function commitUnitName(apt: Apartment) {
    const next = (unitDraft[apt.id] ?? apt.unit_number).trim()
    setUnitDraft((m) => {
      const { [apt.id]: _drop, ...rest } = m
      void _drop
      return rest
    })
    if (next && next !== apt.unit_number) updateApartment({ ...apt, unit_number: next })
  }

  const planApartmentCount = Array.from(aptsByFloor.values()).reduce((s, a) => s + a.length, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("Building Setup")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("Configure your building's baseline settings")}
        </p>
      </div>

      {/* Supabase connection status */}
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span
              className={
                connStatus === 'connected'
                  ? 'h-2.5 w-2.5 rounded-full bg-green-500 inline-block'
                  : connStatus === 'error'
                  ? 'h-2.5 w-2.5 rounded-full bg-red-500 inline-block'
                  : 'h-2.5 w-2.5 rounded-full bg-yellow-400 inline-block'
              }
            />
            {t("Supabase Connection")}
          </CardTitle>
          <CardDescription>
            {connStatus === 'checking' && t('Checking connection…')}
            {connStatus === 'connected' && t('Connected — data is being saved to Supabase.')}
            {connStatus === 'error' && (
              <span className="text-red-600 dark:text-red-400">
                {t("Not connected:")} {connMessage}
                <br />
                {t("Add")} <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_URL</code> {t("and")}{' '}
                <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> {t("to your Vercel environment variables and redeploy.")}
              </span>
            )}
          </CardDescription>
        </CardHeader>
      </Card>

      <Card className="max-w-2xl">
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>{t("Building Settings")}</CardTitle>
            <CardDescription>
              {t("Set the basic parameters for your building to enable accurate financial tracking and reporting.")}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="building-name">{t("Building Name")}</Label>
              <Input
                id="building-name"
                type="text"
                placeholder={t("e.g. El Nour Tower")}
                value={buildingName}
                onChange={(e) => setBuildingName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {t("The name of the building you live in.")}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="num-buildings">{t("Buildings")}</Label>
                <Input
                  id="num-buildings"
                  type="number"
                  min="1"
                  step="1"
                  value={numBuildings}
                  onChange={(e) => setNumBuildings(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="num-floors">{t("Floors (numbered)")}</Label>
                <Input
                  id="num-floors"
                  type="number"
                  min="1"
                  step="1"
                  value={numFloors}
                  onChange={(e) => setNumFloors(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mezzanine-floors">{t("Mezzanine Floors")}</Label>
                <Input
                  id="mezzanine-floors"
                  type="number"
                  min="0"
                  step="1"
                  value={mezzanineFloors}
                  onChange={(e) => setMezzanineFloors(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="apartments-per-floor">{t("Apartments per Floor")}</Label>
                <Input
                  id="apartments-per-floor"
                  type="number"
                  min="0"
                  step="1"
                  value={apartmentsPerFloor}
                  onChange={(e) => setApartmentsPerFloor(e.target.value)}
                  required
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground -mt-2">
              {t("These set hard limits when adding apartments: only floors {from}–{to} are selectable", { from: floors[0], to: floors[floors.length - 1] })}
              {perFloor > 0
                ? t(", at most {n} apartments per floor (capacity {cap})", { n: perFloor, cap: capacity })
                : t(". Set apartments per floor above 0 to also cap each floor")}
              .
            </p>

            <div className="space-y-2">
              <Label htmlFor="total-apartments">{t("Total Apartments")}</Label>
              <Input
                id="total-apartments"
                type="number"
                min="0"
                step="1"
                placeholder="e.g. 12"
                value={totalApartments}
                onChange={(e) => setTotalApartments(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                {t("The total number of apartments in the building.")}
                {capacity > 0 && ` ${t("Structure above allows up to {n}.", { n: capacity })}`}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="expected-income">
                {t("Expected Yearly Income (LE)")}
              </Label>
              <Input
                id="expected-income"
                type="number"
                min="0"
                step="any"
                placeholder="e.g. 30000"
                value={expectedIncome}
                onChange={(e) => setExpectedIncome(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                {t("The total income you expect to collect from all apartments per year.")}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="expected-expenditure">
                {t("Expected Yearly Expenditure (LE)")}
              </Label>
              <Input
                id="expected-expenditure"
                type="number"
                min="0"
                step="any"
                placeholder="e.g. 24000"
                value={expectedExpenditure}
                onChange={(e) => setExpectedExpenditure(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                {t("The total amount you expect to spend on building expenses per year.")}
              </p>
            </div>
          </CardContent>

          <CardFooter>
            <Button type="submit">{t("Save Settings")}</Button>
          </CardFooter>
        </form>
      </Card>

      {/* Floor plan — per-floor apartments with editable names */}
      <Card className="max-w-2xl">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <LayoutGrid className="h-5 w-5" /> Floor Plan
              </CardTitle>
              <CardDescription>
                Set exactly how many apartments each floor holds and name each one — a
                floor can carry several joined units. Blank details (resident, dues) can be
                filled later on the Apartments page.
              </CardDescription>
            </div>
            {numBuildingsSaved > 1 && (
              <Select value={planBuilding} onValueChange={setPlanBuilding}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: numBuildingsSaved }, (_, i) => String(i + 1)).map((b) => (
                    <SelectItem key={b} value={b}>
                      Building {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <p className="mb-2 text-sm text-muted-foreground">
            {planApartmentCount} apartment{planApartmentCount !== 1 ? "s" : ""}
            {numBuildingsSaved > 1 ? ` in Building ${planBuilding}` : ""} across{" "}
            {planFloors.length} floors
          </p>
          <div className="divide-y divide-border">
            {planFloors.map((floor) => {
              const apts = aptsByFloor.get(floor) ?? []
              return (
                <div key={floor} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start">
                  <div className="w-28 shrink-0 pt-1.5">
                    <span className="text-sm font-semibold">
                      {floor.startsWith("M") ? `Mezzanine ${floor}` : `Floor ${floor}`}
                    </span>
                    <span className="ml-1 text-xs text-muted-foreground">({apts.length})</span>
                  </div>
                  <div className="flex flex-1 flex-wrap items-center gap-2">
                    {apts.map((a) => (
                      <div
                        key={a.id}
                        className="flex items-center gap-0.5 rounded-lg border border-border bg-muted/30 py-1 pl-1.5 pr-0.5"
                      >
                        <Input
                          value={unitDraft[a.id] ?? a.unit_number}
                          onChange={(e) => setUnitDraft((m) => ({ ...m, [a.id]: e.target.value }))}
                          onBlur={() => commitUnitName(a)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault()
                              ;(e.target as HTMLInputElement).blur()
                            }
                          }}
                          aria-label={`Unit name on floor ${floor}`}
                          className="h-7 w-16 border-0 bg-transparent px-1 text-center text-sm font-medium shadow-none focus-visible:ring-1"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          onClick={() => setDeletePlanApt(a)}
                          aria-label={`Remove unit ${a.unit_number}`}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 border-dashed"
                      onClick={() => addUnitToFloor(floor)}
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" /> Add
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* People per expense category (security guards, cleaners, ...) */}
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> {t("Category Staff")}
          </CardTitle>
          <CardDescription>
            {t("The people working under each expense category — e.g. your security guards. They appear as vendor choices when you add an expense of that category, and you can add, rename, or remove them here at any time.")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {state.categories.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("No expense categories yet.")}</p>
          ) : (
            state.categories.map((cat) => {
              const people = peopleFor(cat.id)
              return (
                <div key={cat.id} className="space-y-2 border-b border-border pb-4 last:border-0 last:pb-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium capitalize">{t(cat.name)}</span>
                    <Badge variant="secondary">
                      {t("{n} people", { n: people.length })}
                    </Badge>
                  </div>
                  <div className="space-y-1.5">
                    {people.map((p) => (
                      <div key={p.id} className="flex items-center gap-2">
                        {editingPersonId === p.id ? (
                          <>
                            <Input
                              className="h-8"
                              value={editingPersonName}
                              onChange={(e) => setEditingPersonName(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter") saveRenamePerson(p) }}
                              autoFocus
                            />
                            <Button size="icon" className="h-8 w-8 shrink-0" onClick={() => saveRenamePerson(p)} aria-label={t("Save name")}>
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => setEditingPersonId(null)} aria-label={t("Cancel rename")}>
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <span className="flex-1 text-sm">{p.name}</span>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startRenamePerson(p)} aria-label={t("Rename {name}", { name: p.name })}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deletePerson(p.id)} aria-label={t("Remove {name}", { name: p.name })}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      className="h-8"
                      placeholder={t("Add a person to {category}...", { category: t(cat.name) })}
                      value={newPersonName[cat.id] || ""}
                      onChange={(e) => setNewPersonName((m) => ({ ...m, [cat.id]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddPerson(cat.id) } }}
                    />
                    <Button variant="outline" size="sm" className="h-8 shrink-0" onClick={() => handleAddPerson(cat.id)}>
                      <Plus className="mr-1 h-3.5 w-3.5" /> {t("Add")}
                    </Button>
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      {/* Previous years migration */}
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" /> {t("Previous Years")}
          </CardTitle>
          <CardDescription>
            {t("Migrate earlier records without entering every payment: just the income and expenditure totals per year. Optionally set the percentage each category took of that year's expenditure for a more detailed view.")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {state.history.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("Year")}</TableHead>
                    <TableHead>{t("Income")}</TableHead>
                    <TableHead>{t("Expenditure")}</TableHead>
                    <TableHead>{t("Net")}</TableHead>
                    <TableHead className="w-[130px] text-right">{t("Actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {state.history.map((h) => {
                    const net = h.income - h.expenditure
                    return (
                      <TableRow key={h.id}>
                        <TableCell className="font-medium">{h.year}</TableCell>
                        <TableCell>{formatCurrency(h.income)}</TableCell>
                        <TableCell>{formatCurrency(h.expenditure)}</TableCell>
                        <TableCell className={net < 0 ? "text-destructive font-medium" : "font-medium"}>
                          {formatCurrency(net)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => (breakdownHistId === h.id ? setBreakdownHistId(null) : openBreakdown(h))}
                            >
                              %
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEditHistory(h)} aria-label={t("Edit {year}", { year: h.year })}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteHistory(h.id)} aria-label={t("Delete {year}", { year: h.year })}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Expenditure percentage breakdown editor */}
          {breakdownHistId && (() => {
            const h = state.history.find((x) => x.id === breakdownHistId)
            if (!h) return null
            return (
              <div className="rounded-lg border border-border p-4 space-y-3">
                <p className="text-sm font-medium">
                  {t("{year} expenditure breakdown ({total} total)", { year: h.year, total: formatCurrency(h.expenditure) })}
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {state.categories.map((cat) => {
                    const pct = parseFloat(breakdownPercents[cat.name] || "")
                    return (
                      <div key={cat.id} className="space-y-1">
                        <Label className="text-xs capitalize">{t(cat.name)}</Label>
                        <div className="flex items-center gap-1">
                          <Input
                            className="h-8"
                            type="number"
                            min="0"
                            max="100"
                            step="any"
                            placeholder="0"
                            value={breakdownPercents[cat.name] || ""}
                            onChange={(e) =>
                              setBreakdownPercents((m) => ({ ...m, [cat.name]: e.target.value }))
                            }
                          />
                          <span className="text-xs text-muted-foreground">%</span>
                        </div>
                        {!isNaN(pct) && pct > 0 && (
                          <p className="text-[10px] text-muted-foreground">
                            ≈ {formatCurrency((h.expenditure * pct) / 100)}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
                <p className={`text-xs ${Math.abs(breakdownTotal - 100) > 0.5 && breakdownTotal > 0 ? "text-yellow-600 dark:text-yellow-400" : "text-muted-foreground"}`}>
                  {t("Total:")} {breakdownTotal}%{breakdownTotal > 0 && Math.abs(breakdownTotal - 100) > 0.5 ? ` — ${t("doesn't add up to 100%")}` : ""}
                </p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => saveBreakdown(h)}>{t("Save Breakdown")}</Button>
                  <Button size="sm" variant="outline" onClick={() => setBreakdownHistId(null)}>{t("Cancel")}</Button>
                </div>
              </div>
            )
          })()}

          {/* Add / edit year form */}
          <div className="rounded-lg border border-border p-4 space-y-3">
            <p className="text-sm font-medium">
              {editingHistId ? t("Edit year") : t("Add a previous year")}
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor="hist-year" className="text-xs">{t("Year")}</Label>
                <Input
                  id="hist-year"
                  type="number"
                  placeholder="e.g. 2024"
                  value={histYear}
                  onChange={(e) => setHistYear(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="hist-income" className="text-xs">{t("Income (LE)")}</Label>
                <Input
                  id="hist-income"
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  value={histIncome}
                  onChange={(e) => setHistIncome(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="hist-expenditure" className="text-xs">{t("Expenditure (LE)")}</Label>
                <Input
                  id="hist-expenditure"
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  value={histExpenditure}
                  onChange={(e) => setHistExpenditure(e.target.value)}
                />
              </div>
            </div>

            {/* Optional cash/bank split → carries the year into the dashboard balances */}
            <div className="rounded-md bg-muted/40 p-3 space-y-3">
              <p className="text-xs text-muted-foreground">
                {t("Optional: split the totals between cash and bank to add this year's money to the dashboard's Cash on Hand and Bank Balance. Leave blank to keep the year as record-only.")}
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="space-y-1">
                  <Label htmlFor="hist-income-cash" className="text-xs">{t("Income — Cash")}</Label>
                  <Input
                    id="hist-income-cash"
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    value={histIncomeCash}
                    onChange={(e) => setHistIncomeCash(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="hist-income-bank" className="text-xs">{t("Income — Bank")}</Label>
                  <Input
                    id="hist-income-bank"
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    value={histIncomeBank}
                    onChange={(e) => setHistIncomeBank(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="hist-exp-cash" className="text-xs">{t("Expenditure — Cash")}</Label>
                  <Input
                    id="hist-exp-cash"
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    value={histExpCash}
                    onChange={(e) => setHistExpCash(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="hist-exp-bank" className="text-xs">{t("Expenditure — Bank")}</Label>
                  <Input
                    id="hist-exp-bank"
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    value={histExpBank}
                    onChange={(e) => setHistExpBank(e.target.value)}
                  />
                </div>
              </div>
              {(() => {
                const carriedCash = (parseAmount(histIncomeCash) || 0) - (parseAmount(histExpCash) || 0)
                const carriedBank = (parseAmount(histIncomeBank) || 0) - (parseAmount(histExpBank) || 0)
                if (carriedCash === 0 && carriedBank === 0) return null
                return (
                  <p className="text-xs text-muted-foreground">
                    {t("Carries {cash} to cash and {bank} to bank on the dashboard.", { cash: formatCurrency(carriedCash), bank: formatCurrency(carriedBank) })}
                  </p>
                )
              })()}
            </div>

            <div className="flex gap-2">
              <Button size="sm" onClick={handleSubmitHistory}>
                {editingHistId ? t("Save Year") : <><Plus className="mr-1 h-3.5 w-3.5" /> {t("Add Year")}</>}
              </Button>
              {editingHistId && (
                <Button size="sm" variant="outline" onClick={resetHistoryForm}>{t("Cancel")}</Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Floor-plan delete confirmation */}
      <Dialog open={!!deletePlanApt} onOpenChange={() => setDeletePlanApt(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove apartment {deletePlanApt?.unit_number}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This permanently deletes the apartment and every payment recorded against it.
            This can&apos;t be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletePlanApt(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deletePlanApt) deleteApartment(deletePlanApt.id)
                setDeletePlanApt(null)
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
