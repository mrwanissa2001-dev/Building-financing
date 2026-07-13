"use client"

import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  useState,
} from "react"
import { StoreContext } from "./store"
import type {
  Apartment,
  Payment,
  Expense,
  ExpenseCategory,
  CategoryPerson,
  YearlyHistory,
  Transfer,
  BuildingSettings,
  PaymentMethod,
  Task,
} from "./types"
import { GUEST_DATA_KEY } from "./guest-session"
import { useToast } from "@/components/ui/use-toast"

// ── Demo seed data ──

const today = new Date()
const yesterday = new Date(today)
yesterday.setDate(yesterday.getDate() - 1)
const nextWeek = new Date(today)
nextWeek.setDate(nextWeek.getDate() + 7)

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0]
}

const DEMO_DATA = {
  apartments: [
    {
      id: "demo-apt-1",
      unit_number: "A1",
      building_no: 1,
      floor: "1",
      primary_resident_name: "Ahmed Hassan",
      secondary_resident_name: "",
      phone: "",
      phone2: "",
      email: "",
      monthly_due_amount: 1200,
      occupancy_status: "active" as const,
      payment_interval: "monthly" as const,
      notes: "",
      created_at: new Date().toISOString(),
    },
    {
      id: "demo-apt-2",
      unit_number: "A2",
      building_no: 1,
      floor: "1",
      primary_resident_name: "Sara Ibrahim",
      secondary_resident_name: "",
      phone: "",
      phone2: "",
      email: "",
      monthly_due_amount: 1200,
      occupancy_status: "active" as const,
      payment_interval: "monthly" as const,
      notes: "",
      created_at: new Date().toISOString(),
    },
    {
      id: "demo-apt-3",
      unit_number: "A3",
      building_no: 1,
      floor: "2",
      primary_resident_name: "Omar Ali",
      secondary_resident_name: "",
      phone: "",
      phone2: "",
      email: "",
      monthly_due_amount: 1000,
      occupancy_status: "active" as const,
      payment_interval: "monthly" as const,
      notes: "",
      created_at: new Date().toISOString(),
    },
    {
      id: "demo-apt-4",
      unit_number: "B1",
      building_no: 1,
      floor: "2",
      primary_resident_name: "Fatima Nour",
      secondary_resident_name: "",
      phone: "",
      phone2: "",
      email: "",
      monthly_due_amount: 1000,
      occupancy_status: "active" as const,
      payment_interval: "monthly" as const,
      notes: "",
      created_at: new Date().toISOString(),
    },
    {
      id: "demo-apt-5",
      unit_number: "B2",
      building_no: 1,
      floor: "3",
      primary_resident_name: "Khaled Mansour",
      secondary_resident_name: "",
      phone: "",
      phone2: "",
      email: "",
      monthly_due_amount: 1200,
      occupancy_status: "mia" as const,
      payment_interval: "monthly" as const,
      notes: "",
      created_at: new Date().toISOString(),
    },
    {
      id: "demo-apt-6",
      unit_number: "B3",
      building_no: 1,
      floor: "3",
      primary_resident_name: "",
      secondary_resident_name: "",
      phone: "",
      phone2: "",
      email: "",
      monthly_due_amount: 0,
      occupancy_status: "active" as const,
      payment_interval: "monthly" as const,
      notes: "",
      created_at: new Date().toISOString(),
    },
  ] as Apartment[],

  payments: [
    // Last month (4 payments)
    {
      id: "demo-pay-1",
      apartment_id: "demo-apt-1",
      payer_name: "Ahmed Hassan",
      payer_relation: "resident",
      amount: 1200,
      method: "cash" as PaymentMethod,
      date_paid: formatDate(new Date(today.getFullYear(), today.getMonth() - 1, 5)),
      period_start: formatDate(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
      period_end: formatDate(new Date(today.getFullYear(), today.getMonth(), 0)),
      recurring: true,
      extra: false,
      on_dashboard: true,
      notes: "",
      created_at: new Date().toISOString(),
    },
    {
      id: "demo-pay-2",
      apartment_id: "demo-apt-2",
      payer_name: "Sara Ibrahim",
      payer_relation: "resident",
      amount: 1200,
      method: "cash" as PaymentMethod,
      date_paid: formatDate(new Date(today.getFullYear(), today.getMonth() - 1, 6)),
      period_start: formatDate(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
      period_end: formatDate(new Date(today.getFullYear(), today.getMonth(), 0)),
      recurring: true,
      extra: false,
      on_dashboard: true,
      notes: "",
      created_at: new Date().toISOString(),
    },
    {
      id: "demo-pay-3",
      apartment_id: "demo-apt-3",
      payer_name: "Omar Ali",
      payer_relation: "resident",
      amount: 1000,
      method: "cash" as PaymentMethod,
      date_paid: formatDate(new Date(today.getFullYear(), today.getMonth() - 1, 7)),
      period_start: formatDate(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
      period_end: formatDate(new Date(today.getFullYear(), today.getMonth(), 0)),
      recurring: true,
      extra: false,
      on_dashboard: true,
      notes: "",
      created_at: new Date().toISOString(),
    },
    {
      id: "demo-pay-4",
      apartment_id: "demo-apt-4",
      payer_name: "Fatima Nour",
      payer_relation: "resident",
      amount: 1000,
      method: "cash" as PaymentMethod,
      date_paid: formatDate(new Date(today.getFullYear(), today.getMonth() - 1, 8)),
      period_start: formatDate(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
      period_end: formatDate(new Date(today.getFullYear(), today.getMonth(), 0)),
      recurring: true,
      extra: false,
      on_dashboard: true,
      notes: "",
      created_at: new Date().toISOString(),
    },
    // Two months ago (4 payments)
    {
      id: "demo-pay-5",
      apartment_id: "demo-apt-1",
      payer_name: "Ahmed Hassan",
      payer_relation: "resident",
      amount: 1200,
      method: "cash" as PaymentMethod,
      date_paid: formatDate(new Date(today.getFullYear(), today.getMonth() - 2, 5)),
      period_start: formatDate(new Date(today.getFullYear(), today.getMonth() - 2, 1)),
      period_end: formatDate(new Date(today.getFullYear(), today.getMonth() - 1, 0)),
      recurring: true,
      extra: false,
      on_dashboard: true,
      notes: "",
      created_at: new Date().toISOString(),
    },
    {
      id: "demo-pay-6",
      apartment_id: "demo-apt-2",
      payer_name: "Sara Ibrahim",
      payer_relation: "resident",
      amount: 1200,
      method: "cash" as PaymentMethod,
      date_paid: formatDate(new Date(today.getFullYear(), today.getMonth() - 2, 6)),
      period_start: formatDate(new Date(today.getFullYear(), today.getMonth() - 2, 1)),
      period_end: formatDate(new Date(today.getFullYear(), today.getMonth() - 1, 0)),
      recurring: true,
      extra: false,
      on_dashboard: true,
      notes: "",
      created_at: new Date().toISOString(),
    },
    {
      id: "demo-pay-7",
      apartment_id: "demo-apt-3",
      payer_name: "Omar Ali",
      payer_relation: "resident",
      amount: 1000,
      method: "cash" as PaymentMethod,
      date_paid: formatDate(new Date(today.getFullYear(), today.getMonth() - 2, 7)),
      period_start: formatDate(new Date(today.getFullYear(), today.getMonth() - 2, 1)),
      period_end: formatDate(new Date(today.getFullYear(), today.getMonth() - 1, 0)),
      recurring: true,
      extra: false,
      on_dashboard: true,
      notes: "",
      created_at: new Date().toISOString(),
    },
    {
      id: "demo-pay-8",
      apartment_id: "demo-apt-4",
      payer_name: "Fatima Nour",
      payer_relation: "resident",
      amount: 1000,
      method: "cash" as PaymentMethod,
      date_paid: formatDate(new Date(today.getFullYear(), today.getMonth() - 2, 8)),
      period_start: formatDate(new Date(today.getFullYear(), today.getMonth() - 2, 1)),
      period_end: formatDate(new Date(today.getFullYear(), today.getMonth() - 1, 0)),
      recurring: true,
      extra: false,
      on_dashboard: true,
      notes: "",
      created_at: new Date().toISOString(),
    },
  ] as Payment[],

  expenses: [
    {
      id: "demo-exp-1",
      category_id: "demo-cat-1",
      amount: 450,
      method: "bank" as PaymentMethod,
      date: formatDate(new Date(today.getFullYear(), today.getMonth() - 1, 15)),
      vendor: "Electric Company",
      recurring: true,
      recurring_interval: 1,
      paid: true,
      notes: "",
      created_at: new Date().toISOString(),
    },
    {
      id: "demo-exp-2",
      category_id: "demo-cat-1",
      amount: 450,
      method: "bank" as PaymentMethod,
      date: formatDate(new Date(today.getFullYear(), today.getMonth(), 15)),
      vendor: "Electric Company",
      recurring: true,
      recurring_interval: 1,
      paid: true,
      notes: "",
      created_at: new Date().toISOString(),
    },
    {
      id: "demo-exp-3",
      category_id: "demo-cat-1",
      amount: 280,
      method: "bank" as PaymentMethod,
      date: formatDate(new Date(today.getFullYear(), today.getMonth() - 1, 20)),
      vendor: "Water Authority",
      recurring: true,
      recurring_interval: 1,
      paid: true,
      notes: "",
      created_at: new Date().toISOString(),
    },
    {
      id: "demo-exp-4",
      category_id: "demo-cat-1",
      amount: 280,
      method: "bank" as PaymentMethod,
      date: formatDate(new Date(today.getFullYear(), today.getMonth(), 20)),
      vendor: "Water Authority",
      recurring: true,
      recurring_interval: 1,
      paid: true,
      notes: "",
      created_at: new Date().toISOString(),
    },
    {
      id: "demo-exp-5",
      category_id: "demo-cat-2",
      amount: 1500,
      method: "cash" as PaymentMethod,
      date: formatDate(new Date(today.getFullYear(), today.getMonth() - 1, 10)),
      vendor: "Ali's Repairs",
      recurring: false,
      recurring_interval: 0,
      paid: true,
      notes: "Roof maintenance",
      created_at: new Date().toISOString(),
    },
    {
      id: "demo-exp-6",
      category_id: "demo-cat-2",
      amount: 600,
      method: "cash" as PaymentMethod,
      date: formatDate(today),
      vendor: "Cleaning Service",
      recurring: false,
      recurring_interval: 0,
      paid: true,
      notes: "Common areas",
      created_at: new Date().toISOString(),
    },
  ] as Expense[],

  categories: [
    { id: "demo-cat-1", name: "Utilities" },
    { id: "demo-cat-2", name: "Maintenance" },
  ] as ExpenseCategory[],

  people: [] as CategoryPerson[],
  history: [] as YearlyHistory[],
  transfers: [] as Transfer[],

  tasks: [
    {
      id: "demo-task-1",
      title: "Collect rent from B2",
      description: "",
      due_date: formatDate(yesterday),
      status: "todo" as const,
      priority: "high" as const,
      color: "rose" as const,
      created_at: new Date().toISOString(),
    },
    {
      id: "demo-task-2",
      title: "Pay electricity bill",
      description: "",
      due_date: formatDate(today),
      status: "todo" as const,
      priority: "medium" as const,
      color: "amber" as const,
      created_at: new Date().toISOString(),
    },
    {
      id: "demo-task-3",
      title: "Annual inspection",
      description: "",
      due_date: formatDate(nextWeek),
      status: "todo" as const,
      priority: "low" as const,
      color: "sky" as const,
      created_at: new Date().toISOString(),
    },
  ] as Task[],

  settings: {
    id: "demo",
    building_name: "Demo Tower",
    total_apartments: 6,
    num_floors: 3,
    mezzanine_floors: 0,
    apartments_per_floor: 2,
    expected_yearly_income: 86400,
    expected_yearly_expenditure: 36000,
    num_buildings: 1,
  } as BuildingSettings,
}

// ── State ──

interface GuestStoreState {
  apartments: Apartment[]
  payments: Payment[]
  expenses: Expense[]
  categories: ExpenseCategory[]
  people: CategoryPerson[]
  history: YearlyHistory[]
  transfers: Transfer[]
  tasks: Task[]
  settings: BuildingSettings
  initialized: boolean
  loaded: boolean
}

const INITIAL_STATE: GuestStoreState = {
  apartments: [],
  payments: [],
  expenses: [],
  categories: [],
  people: [],
  history: [],
  transfers: [],
  tasks: [],
  settings: DEMO_DATA.settings,
  initialized: false,
  loaded: false,
}

// ── Actions ──

type GuestStoreAction =
  | { type: "LOAD"; payload: GuestStoreState }
  | { type: "ADD_APARTMENT"; payload: Apartment }
  | { type: "UPDATE_APARTMENT"; payload: Apartment }
  | { type: "DELETE_APARTMENT"; payload: string }
  | { type: "ADD_PAYMENT"; payload: Payment }
  | { type: "UPDATE_PAYMENT"; payload: Payment }
  | { type: "DELETE_PAYMENT"; payload: string }
  | { type: "ADD_EXPENSE"; payload: Expense }
  | { type: "UPDATE_EXPENSE"; payload: Expense }
  | { type: "DELETE_EXPENSE"; payload: string }
  | { type: "ADD_CATEGORY"; payload: ExpenseCategory }
  | { type: "DELETE_CATEGORY"; payload: string }
  | { type: "ADD_PERSON"; payload: CategoryPerson }
  | { type: "UPDATE_PERSON"; payload: CategoryPerson }
  | { type: "DELETE_PERSON"; payload: string }
  | { type: "ADD_HISTORY"; payload: YearlyHistory }
  | { type: "UPDATE_HISTORY"; payload: YearlyHistory }
  | { type: "DELETE_HISTORY"; payload: string }
  | { type: "ADD_TRANSFER"; payload: Transfer }
  | { type: "UPDATE_TRANSFER"; payload: Transfer }
  | { type: "DELETE_TRANSFER"; payload: string }
  | { type: "UPDATE_SETTINGS"; payload: Partial<BuildingSettings> }
  | { type: "ADD_TASK"; payload: Task }
  | { type: "UPDATE_TASK"; payload: Task }
  | { type: "DELETE_TASK"; payload: string }
  | { type: "TOGGLE_TASK"; payload: string }

// ── Reducer ──

function guestStoreReducer(state: GuestStoreState, action: GuestStoreAction): GuestStoreState {
  switch (action.type) {
    case "LOAD":
      return { ...action.payload, initialized: true, loaded: true }

    case "ADD_APARTMENT":
      return { ...state, apartments: [...state.apartments, action.payload] }

    case "UPDATE_APARTMENT":
      return {
        ...state,
        apartments: state.apartments.map((a) =>
          a.id === action.payload.id ? action.payload : a
        ),
      }

    case "DELETE_APARTMENT":
      return {
        ...state,
        apartments: state.apartments.filter((a) => a.id !== action.payload),
        payments: state.payments.filter((p) => p.apartment_id !== action.payload),
      }

    case "ADD_PAYMENT":
      return { ...state, payments: [...state.payments, action.payload] }

    case "UPDATE_PAYMENT":
      return {
        ...state,
        payments: state.payments.map((p) =>
          p.id === action.payload.id ? action.payload : p
        ),
      }

    case "DELETE_PAYMENT":
      return {
        ...state,
        payments: state.payments.filter((p) => p.id !== action.payload),
      }

    case "ADD_EXPENSE":
      return { ...state, expenses: [...state.expenses, action.payload] }

    case "UPDATE_EXPENSE":
      return {
        ...state,
        expenses: state.expenses.map((e) =>
          e.id === action.payload.id ? action.payload : e
        ),
      }

    case "DELETE_EXPENSE":
      return {
        ...state,
        expenses: state.expenses.filter((e) => e.id !== action.payload),
      }

    case "ADD_CATEGORY":
      return { ...state, categories: [...state.categories, action.payload] }

    case "DELETE_CATEGORY":
      return {
        ...state,
        categories: state.categories.filter((c) => c.id !== action.payload),
        people: state.people.filter((p) => p.category_id !== action.payload),
        expenses: state.expenses.filter((e) => e.category_id !== action.payload),
      }

    case "ADD_PERSON":
      return { ...state, people: [...state.people, action.payload] }

    case "UPDATE_PERSON":
      return {
        ...state,
        people: state.people.map((p) =>
          p.id === action.payload.id ? action.payload : p
        ),
      }

    case "DELETE_PERSON":
      return {
        ...state,
        people: state.people.filter((p) => p.id !== action.payload),
      }

    case "ADD_HISTORY":
      return {
        ...state,
        history: [...state.history, action.payload].sort((a, b) => a.year - b.year),
      }

    case "UPDATE_HISTORY":
      return {
        ...state,
        history: state.history
          .map((h) => (h.id === action.payload.id ? action.payload : h))
          .sort((a, b) => a.year - b.year),
      }

    case "DELETE_HISTORY":
      return {
        ...state,
        history: state.history.filter((h) => h.id !== action.payload),
      }

    case "ADD_TRANSFER":
      return {
        ...state,
        transfers: [action.payload, ...state.transfers],
      }

    case "UPDATE_TRANSFER":
      return {
        ...state,
        transfers: state.transfers.map((t) =>
          t.id === action.payload.id ? action.payload : t
        ),
      }

    case "DELETE_TRANSFER":
      return {
        ...state,
        transfers: state.transfers.filter((t) => t.id !== action.payload),
      }

    case "UPDATE_SETTINGS":
      return {
        ...state,
        settings: { ...state.settings, ...action.payload },
      }

    case "ADD_TASK":
      return { ...state, tasks: [...state.tasks, action.payload] }

    case "UPDATE_TASK":
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.payload.id ? action.payload : t
        ),
      }

    case "DELETE_TASK":
      return {
        ...state,
        tasks: state.tasks.filter((t) => t.id !== action.payload),
      }

    case "TOGGLE_TASK": {
      return {
        ...state,
        tasks: state.tasks.map((t) => {
          if (t.id === action.payload) {
            return {
              ...t,
              status: t.status === "done" ? "todo" : "done",
            }
          }
          return t
        }),
      }
    }

    default:
      return state
  }
}

// ── Context type ──

interface GuestStoreContextValue {
  state: GuestStoreState

  addApartment: (data: Omit<Apartment, "id" | "created_at">) => Apartment | null
  updateApartment: (apartment: Apartment) => void
  deleteApartment: (id: string) => void
  addPayment: (data: Omit<Payment, "id" | "created_at">) => Payment | null
  updatePayment: (payment: Payment) => void
  deletePayment: (id: string) => void
  addExpense: (data: Omit<Expense, "id" | "created_at">) => Expense | null
  updateExpense: (expense: Expense) => void
  deleteExpense: (id: string) => void
  addCategory: (name: string) => ExpenseCategory
  deleteCategory: (id: string) => void
  addPerson: (categoryId: string, name: string) => CategoryPerson
  updatePerson: (person: CategoryPerson) => void
  deletePerson: (id: string) => void
  addHistory: (data: Omit<YearlyHistory, "id">) => YearlyHistory
  updateHistory: (row: YearlyHistory) => void
  deleteHistory: (id: string) => void
  addTransfer: (data: Omit<Transfer, "id" | "created_at">) => Transfer
  updateTransfer: (transfer: Transfer) => void
  deleteTransfer: (id: string) => void
  updateSettings: (data: Partial<BuildingSettings>) => void
  addTask: (data: Omit<Task, "id" | "created_at">) => Task | null
  updateTask: (task: Task) => void
  deleteTask: (id: string) => void
  toggleTask: (id: string) => void
  importPayments: (rows: Omit<Payment, "id" | "created_at">[]) => number
  importExpenses: (rows: any[]) => Promise<number>
}

const GuestStoreContext = createContext<GuestStoreContextValue | null>(null)

// ── Provider ──

export function GuestStoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(guestStoreReducer, INITIAL_STATE)
  const { toast } = useToast()

  // Load from sessionStorage or use demo data
  useEffect(() => {
    if (typeof window === "undefined") return

    try {
      const stored = sessionStorage.getItem(GUEST_DATA_KEY)
      if (stored) {
        const data = JSON.parse(stored) as GuestStoreState
        dispatch({
          type: "LOAD",
          payload: {
            apartments: data.apartments,
            payments: data.payments,
            expenses: data.expenses,
            categories: data.categories,
            people: data.people,
            history: data.history,
            transfers: data.transfers,
            tasks: data.tasks,
            settings: data.settings,
            initialized: true,
            loaded: true,
          },
        })
      } else {
        dispatch({
          type: "LOAD",
          payload: {
            ...DEMO_DATA,
            initialized: true,
            loaded: true,
          },
        })
      }
    } catch (e) {
      // Fall back to demo data on error
      dispatch({
        type: "LOAD",
        payload: {
          ...DEMO_DATA,
          initialized: true,
          loaded: true,
        },
      })
    }
  }, [])

  // Persist to sessionStorage on every state change
  useEffect(() => {
    if (typeof window === "undefined" || !state.loaded) return
    try {
      sessionStorage.setItem(GUEST_DATA_KEY, JSON.stringify(state))
    } catch (e) {
      console.error("Failed to save guest data to sessionStorage", e)
    }
  }, [state])

  const addApartment = useCallback(
    (data: Omit<Apartment, "id" | "created_at">): Apartment | null => {
      if (state.apartments.length >= 6) {
        toast({
          title: "Demo limit reached",
          description: "Maximum 6 apartments in demo mode.",
          variant: "destructive",
        })
        return null
      }
      const apt: Apartment = { ...data, id: crypto.randomUUID(), created_at: new Date().toISOString() }
      dispatch({ type: "ADD_APARTMENT", payload: apt })
      return apt
    },
    [state.apartments.length, toast]
  )

  const updateApartment = useCallback((apartment: Apartment) => {
    dispatch({ type: "UPDATE_APARTMENT", payload: apartment })
  }, [])

  const deleteApartment = useCallback((id: string) => {
    dispatch({ type: "DELETE_APARTMENT", payload: id })
  }, [])

  const addPayment = useCallback(
    (data: Omit<Payment, "id" | "created_at">): Payment | null => {
      if (state.payments.length >= 30) {
        toast({
          title: "Demo limit reached",
          description: "Maximum 30 payments in demo mode.",
          variant: "destructive",
        })
        return null
      }
      const p: Payment = { ...data, id: crypto.randomUUID(), created_at: new Date().toISOString() }
      dispatch({ type: "ADD_PAYMENT", payload: p })
      return p
    },
    [state.payments.length, toast]
  )

  const updatePayment = useCallback((payment: Payment) => {
    dispatch({ type: "UPDATE_PAYMENT", payload: payment })
  }, [])

  const deletePayment = useCallback((id: string) => {
    dispatch({ type: "DELETE_PAYMENT", payload: id })
  }, [])

  const addExpense = useCallback(
    (data: Omit<Expense, "id" | "created_at">): Expense | null => {
      if (state.expenses.length >= 20) {
        toast({
          title: "Demo limit reached",
          description: "Maximum 20 expenses in demo mode.",
          variant: "destructive",
        })
        return null
      }
      const e: Expense = { ...data, id: crypto.randomUUID(), created_at: new Date().toISOString() }
      dispatch({ type: "ADD_EXPENSE", payload: e })
      return e
    },
    [state.expenses.length, toast]
  )

  const updateExpense = useCallback((expense: Expense) => {
    dispatch({ type: "UPDATE_EXPENSE", payload: expense })
  }, [])

  const deleteExpense = useCallback((id: string) => {
    dispatch({ type: "DELETE_EXPENSE", payload: id })
  }, [])

  const addCategory = useCallback((name: string): ExpenseCategory => {
    const cat: ExpenseCategory = { id: crypto.randomUUID(), name }
    dispatch({ type: "ADD_CATEGORY", payload: cat })
    return cat
  }, [])

  const deleteCategory = useCallback((id: string) => {
    dispatch({ type: "DELETE_CATEGORY", payload: id })
  }, [])

  const addPerson = useCallback((categoryId: string, name: string): CategoryPerson => {
    const person: CategoryPerson = { id: crypto.randomUUID(), category_id: categoryId, name }
    dispatch({ type: "ADD_PERSON", payload: person })
    return person
  }, [])

  const updatePerson = useCallback((person: CategoryPerson) => {
    dispatch({ type: "UPDATE_PERSON", payload: person })
  }, [])

  const deletePerson = useCallback((id: string) => {
    dispatch({ type: "DELETE_PERSON", payload: id })
  }, [])

  const addHistory = useCallback((data: Omit<YearlyHistory, "id">): YearlyHistory => {
    const row: YearlyHistory = { ...data, id: crypto.randomUUID() }
    dispatch({ type: "ADD_HISTORY", payload: row })
    return row
  }, [])

  const updateHistory = useCallback((row: YearlyHistory) => {
    dispatch({ type: "UPDATE_HISTORY", payload: row })
  }, [])

  const deleteHistory = useCallback((id: string) => {
    dispatch({ type: "DELETE_HISTORY", payload: id })
  }, [])

  const addTransfer = useCallback((data: Omit<Transfer, "id" | "created_at">): Transfer => {
    const t: Transfer = { ...data, id: crypto.randomUUID(), created_at: new Date().toISOString() }
    dispatch({ type: "ADD_TRANSFER", payload: t })
    return t
  }, [])

  const updateTransfer = useCallback((transfer: Transfer) => {
    dispatch({ type: "UPDATE_TRANSFER", payload: transfer })
  }, [])

  const deleteTransfer = useCallback((id: string) => {
    dispatch({ type: "DELETE_TRANSFER", payload: id })
  }, [])

  const updateSettings = useCallback((data: Partial<BuildingSettings>) => {
    dispatch({ type: "UPDATE_SETTINGS", payload: data })
  }, [])

  const addTask = useCallback(
    (data: Omit<Task, "id" | "created_at">): Task | null => {
      if (state.tasks.length >= 10) {
        toast({
          title: "Demo limit reached",
          description: "Maximum 10 tasks in demo mode.",
          variant: "destructive",
        })
        return null
      }
      const task: Task = { ...data, id: crypto.randomUUID(), created_at: new Date().toISOString() }
      dispatch({ type: "ADD_TASK", payload: task })
      return task
    },
    [state.tasks.length, toast]
  )

  const updateTask = useCallback((task: Task) => {
    dispatch({ type: "UPDATE_TASK", payload: task })
  }, [])

  const deleteTask = useCallback((id: string) => {
    dispatch({ type: "DELETE_TASK", payload: id })
  }, [])

  const toggleTask = useCallback((id: string) => {
    dispatch({ type: "TOGGLE_TASK", payload: id })
  }, [])

  const importPayments = useCallback(
    (rows: Omit<Payment, "id" | "created_at">[]): number => {
      toast({
        title: "Import disabled",
        description: "CSV import is not available in demo mode.",
      })
      return 0
    },
    [toast]
  )

  const importExpenses = useCallback(
    async (rows: any[]): Promise<number> => {
      toast({
        title: "Import disabled",
        description: "CSV import is not available in demo mode.",
      })
      return 0
    },
    [toast]
  )

  const importApartments = useCallback(
    (rows: Omit<import("./types").Apartment, "id" | "created_at">[]): number => {
      let imported = 0
      for (const data of rows) {
        if (state.apartments.length + imported >= 6) break
        dispatch({ type: "ADD_APARTMENT", payload: { ...data, id: crypto.randomUUID(), created_at: new Date().toISOString() } })
        imported++
      }
      return imported
    },
    [state.apartments.length]
  )

  // Nested ops objects — mirror what StoreProvider builds so the real
  // page components work unchanged when provided via StoreContext.
  const apartmentOps = {
    list: useCallback(() => state.apartments, [state.apartments]),
    get: useCallback((id: string) => state.apartments.find((a) => a.id === id), [state.apartments]),
    create: useCallback((data: Omit<import("./types").Apartment, "id" | "created_at">) => {
      const apt: import("./types").Apartment = { ...data, id: crypto.randomUUID(), created_at: new Date().toISOString() }
      dispatch({ type: "ADD_APARTMENT", payload: apt })
      return apt
    }, []),
    update: useCallback((id: string, data: Partial<import("./types").Apartment>) => {
      dispatch({ type: "UPDATE_APARTMENT", payload: { id, ...data } as import("./types").Apartment })
    }, []),
    delete: useCallback((id: string) => dispatch({ type: "DELETE_APARTMENT", payload: id }), []),
  }

  const paymentOps = {
    list: useCallback(() => state.payments, [state.payments]),
    listByApartment: useCallback((aptId: string) => state.payments.filter((p) => p.apartment_id === aptId), [state.payments]),
    create: useCallback((data: Omit<import("./types").Payment, "id" | "created_at">) => {
      const p: import("./types").Payment = { ...data, id: crypto.randomUUID(), created_at: new Date().toISOString() }
      dispatch({ type: "ADD_PAYMENT", payload: p })
      return p
    }, []),
    update: useCallback((id: string, data: Partial<import("./types").Payment>) => {
      dispatch({ type: "UPDATE_PAYMENT", payload: { id, ...data } as import("./types").Payment })
    }, []),
    delete: useCallback((id: string) => dispatch({ type: "DELETE_PAYMENT", payload: id }), []),
  }

  const expenseOps = {
    list: useCallback(() => state.expenses, [state.expenses]),
    create: useCallback((data: Omit<import("./types").Expense, "id" | "created_at">) => {
      const e: import("./types").Expense = { ...data, id: crypto.randomUUID(), created_at: new Date().toISOString() }
      dispatch({ type: "ADD_EXPENSE", payload: e })
      return e
    }, []),
    update: useCallback((id: string, data: Partial<import("./types").Expense>) => {
      dispatch({ type: "UPDATE_EXPENSE", payload: { id, ...data } as import("./types").Expense })
    }, []),
    delete: useCallback((id: string) => dispatch({ type: "DELETE_EXPENSE", payload: id }), []),
  }

  const categoryOps = {
    list: useCallback(() => state.categories, [state.categories]),
    create: useCallback((name: string): import("./types").ExpenseCategory => {
      const cat: import("./types").ExpenseCategory = { id: crypto.randomUUID(), name }
      dispatch({ type: "ADD_CATEGORY", payload: cat })
      return cat
    }, []),
  }

  const settingsOps = {
    get: useCallback(() => state.settings, [state.settings]),
    update: useCallback((data: Partial<import("./types").BuildingSettings>) => {
      dispatch({ type: "UPDATE_SETTINGS", payload: data })
    }, []),
  }

  const value: GuestStoreContextValue = {
    state,
    addApartment,
    updateApartment,
    deleteApartment,
    addPayment,
    updatePayment,
    deletePayment,
    addExpense,
    updateExpense,
    deleteExpense,
    addCategory,
    deleteCategory,
    addPerson,
    updatePerson,
    deletePerson,
    addHistory,
    updateHistory,
    deleteHistory,
    addTransfer,
    updateTransfer,
    deleteTransfer,
    updateSettings,
    addTask,
    updateTask,
    deleteTask,
    toggleTask,
    importPayments,
    importExpenses,
  }

  // Full StoreContextValue shape so real page components work unchanged
  // when this provider is in the tree instead of StoreProvider.
  const storeValue = {
    state,
    apartments: apartmentOps,
    payments: paymentOps,
    expenses: expenseOps,
    categories: categoryOps,
    settings: settingsOps,
    addApartment: (data: Omit<import("./types").Apartment, "id" | "created_at">) => addApartment(data) as import("./types").Apartment,
    updateApartment,
    deleteApartment,
    addPayment: (data: Omit<import("./types").Payment, "id" | "created_at">) => addPayment(data) as import("./types").Payment,
    updatePayment,
    deletePayment,
    addExpense: (data: Omit<import("./types").Expense, "id" | "created_at">) => addExpense(data) as import("./types").Expense,
    updateExpense,
    deleteExpense,
    addCategory,
    deleteCategory,
    addPerson,
    updatePerson,
    deletePerson,
    addHistory,
    updateHistory,
    deleteHistory,
    addTransfer,
    updateTransfer,
    deleteTransfer,
    updateSettings,
    addTask: (data: Omit<import("./types").Task, "id" | "created_at">) => addTask(data) as import("./types").Task,
    updateTask,
    deleteTask,
    importApartments,
    importPayments,
    importExpenses,
  }

  return (
    <GuestStoreContext.Provider value={value}>
      <StoreContext.Provider value={storeValue as any}>
        {children}
      </StoreContext.Provider>
    </GuestStoreContext.Provider>
  )
}

// ── Hook ──

export function useGuestStore(): GuestStoreContextValue {
  const context = useContext(GuestStoreContext)
  if (!context) {
    throw new Error("useGuestStore must be used within a GuestStoreProvider")
  }
  return context
}
