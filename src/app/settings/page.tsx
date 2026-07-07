"use client"

import { useState, useEffect } from "react"
import { useStore } from "@/lib/store"
import { useToast } from "@/components/ui/use-toast"
import { testConnection } from "@/lib/supabase-data"
import { buildingFloors } from "@/lib/constants"
import { formatCurrency } from "@/lib/utils"
import { parseAmount } from "@/lib/csv"
import type { CategoryPerson, YearlyHistory } from "@/lib/types"

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
import { Plus, Trash2, Check, Pencil, X, Users, History } from "lucide-react"

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
  } = useStore()
  const { toast } = useToast()

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
      title: "Settings saved!",
      description: "Your building settings have been updated.",
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
        title: "Invalid year data",
        description: `Enter a year up to ${currentYear} plus its income and expenditure totals.`,
        variant: "destructive",
      })
      return
    }
    const duplicate = state.history.find((h) => h.year === year && h.id !== editingHistId)
    if (duplicate) {
      toast({ title: "Year already exists", description: `Edit the existing ${year} row instead.`, variant: "destructive" })
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
    toast({ title: "Breakdown saved", variant: "success" })
  }

  if (!state.loaded) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Loading settings...</p>
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Building Setup</h1>
        <p className="text-sm text-muted-foreground">
          Configure your building&apos;s baseline settings
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
            Supabase Connection
          </CardTitle>
          <CardDescription>
            {connStatus === 'checking' && 'Checking connection…'}
            {connStatus === 'connected' && 'Connected — data is being saved to Supabase.'}
            {connStatus === 'error' && (
              <span className="text-red-600 dark:text-red-400">
                Not connected: {connMessage}
                <br />
                Add <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
                <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to your Vercel environment variables and redeploy.
              </span>
            )}
          </CardDescription>
        </CardHeader>
      </Card>

      <Card className="max-w-2xl">
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>Building Settings</CardTitle>
            <CardDescription>
              Set the basic parameters for your building to enable accurate
              financial tracking and reporting.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="building-name">Building Name</Label>
              <Input
                id="building-name"
                type="text"
                placeholder="e.g. El Nour Tower"
                value={buildingName}
                onChange={(e) => setBuildingName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                The name of the building you live in.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="num-buildings">Buildings</Label>
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
                <Label htmlFor="num-floors">Floors (numbered)</Label>
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
                <Label htmlFor="mezzanine-floors">Mezzanine Floors</Label>
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
                <Label htmlFor="apartments-per-floor">Apartments per Floor</Label>
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
              These set hard limits when adding apartments: only floors{" "}
              {floors[0]}–{floors[floors.length - 1]} are selectable
              {perFloor > 0
                ? `, at most ${perFloor} apartment${perFloor !== 1 ? "s" : ""} per floor (capacity ${capacity})`
                : ". Set apartments per floor above 0 to also cap each floor"}
              .
            </p>

            <div className="space-y-2">
              <Label htmlFor="total-apartments">Total Apartments</Label>
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
                The total number of apartments in the building.
                {capacity > 0 && ` Structure above allows up to ${capacity}.`}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="expected-income">
                Expected Yearly Income (LE)
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
                The total income you expect to collect from all apartments per
                year.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="expected-expenditure">
                Expected Yearly Expenditure (LE)
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
                The total amount you expect to spend on building expenses per
                year.
              </p>
            </div>
          </CardContent>

          <CardFooter>
            <Button type="submit">Save Settings</Button>
          </CardFooter>
        </form>
      </Card>

      {/* People per expense category (security guards, cleaners, ...) */}
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> Category Staff
          </CardTitle>
          <CardDescription>
            The people working under each expense category — e.g. your
            security guards. They appear as vendor choices when you add an
            expense of that category, and you can add, rename, or remove them
            here at any time.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {state.categories.length === 0 ? (
            <p className="text-sm text-muted-foreground">No expense categories yet.</p>
          ) : (
            state.categories.map((cat) => {
              const people = peopleFor(cat.id)
              return (
                <div key={cat.id} className="space-y-2 border-b border-border pb-4 last:border-0 last:pb-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium capitalize">{cat.name}</span>
                    <Badge variant="secondary">
                      {people.length} {people.length === 1 ? "person" : "people"}
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
                            <Button size="icon" className="h-8 w-8 shrink-0" onClick={() => saveRenamePerson(p)} aria-label="Save name">
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => setEditingPersonId(null)} aria-label="Cancel rename">
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <span className="flex-1 text-sm">{p.name}</span>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startRenamePerson(p)} aria-label={`Rename ${p.name}`}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deletePerson(p.id)} aria-label={`Remove ${p.name}`}>
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
                      placeholder={`Add a person to ${cat.name}...`}
                      value={newPersonName[cat.id] || ""}
                      onChange={(e) => setNewPersonName((m) => ({ ...m, [cat.id]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddPerson(cat.id) } }}
                    />
                    <Button variant="outline" size="sm" className="h-8 shrink-0" onClick={() => handleAddPerson(cat.id)}>
                      <Plus className="mr-1 h-3.5 w-3.5" /> Add
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
            <History className="h-5 w-5" /> Previous Years
          </CardTitle>
          <CardDescription>
            Migrate earlier records without entering every payment: just the
            income and expenditure totals per year. Optionally set the
            percentage each category took of that year&apos;s expenditure for a
            more detailed view.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {state.history.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Year</TableHead>
                    <TableHead>Income</TableHead>
                    <TableHead>Expenditure</TableHead>
                    <TableHead>Net</TableHead>
                    <TableHead className="w-[130px] text-right">Actions</TableHead>
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
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEditHistory(h)} aria-label={`Edit ${h.year}`}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteHistory(h.id)} aria-label={`Delete ${h.year}`}>
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
                  {h.year} expenditure breakdown ({formatCurrency(h.expenditure)} total)
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {state.categories.map((cat) => {
                    const pct = parseFloat(breakdownPercents[cat.name] || "")
                    return (
                      <div key={cat.id} className="space-y-1">
                        <Label className="text-xs capitalize">{cat.name}</Label>
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
                  Total: {breakdownTotal}%{breakdownTotal > 0 && Math.abs(breakdownTotal - 100) > 0.5 ? " — doesn't add up to 100%" : ""}
                </p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => saveBreakdown(h)}>Save Breakdown</Button>
                  <Button size="sm" variant="outline" onClick={() => setBreakdownHistId(null)}>Cancel</Button>
                </div>
              </div>
            )
          })()}

          {/* Add / edit year form */}
          <div className="rounded-lg border border-border p-4 space-y-3">
            <p className="text-sm font-medium">
              {editingHistId ? "Edit year" : "Add a previous year"}
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor="hist-year" className="text-xs">Year</Label>
                <Input
                  id="hist-year"
                  type="number"
                  placeholder="e.g. 2024"
                  value={histYear}
                  onChange={(e) => setHistYear(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="hist-income" className="text-xs">Income (LE)</Label>
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
                <Label htmlFor="hist-expenditure" className="text-xs">Expenditure (LE)</Label>
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
                Optional: split the totals between cash and bank to add this
                year&apos;s money to the dashboard&apos;s Cash on Hand and Bank
                Balance. Leave blank to keep the year as record-only.
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="space-y-1">
                  <Label htmlFor="hist-income-cash" className="text-xs">Income — Cash</Label>
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
                  <Label htmlFor="hist-income-bank" className="text-xs">Income — Bank</Label>
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
                  <Label htmlFor="hist-exp-cash" className="text-xs">Expenditure — Cash</Label>
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
                  <Label htmlFor="hist-exp-bank" className="text-xs">Expenditure — Bank</Label>
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
                    Carries {formatCurrency(carriedCash)} to cash and{" "}
                    {formatCurrency(carriedBank)} to bank on the dashboard.
                  </p>
                )
              })()}
            </div>

            <div className="flex gap-2">
              <Button size="sm" onClick={handleSubmitHistory}>
                {editingHistId ? "Save Year" : <><Plus className="mr-1 h-3.5 w-3.5" /> Add Year</>}
              </Button>
              {editingHistId && (
                <Button size="sm" variant="outline" onClick={resetHistoryForm}>Cancel</Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
