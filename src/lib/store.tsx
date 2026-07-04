'use client'

import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
} from 'react'
import {
  subMonths,
  startOfMonth,
  endOfMonth,
  format,
  addMonths,
  subDays,
} from 'date-fns'
import type {
  Apartment,
  Payment,
  Expense,
  ExpenseCategory,
  BuildingSettings,
  PaymentMethod,
} from './types'
import { DEFAULT_EXPENSE_CATEGORIES } from './constants'
import { isSupabaseConfigured } from './supabase'
import {
  fetchAllData,
  insertApartment as sbInsertApartment,
  updateApartmentRow as sbUpdateApartment,
  deleteApartmentRow as sbDeleteApartment,
  insertPayment as sbInsertPayment,
  updatePaymentRow as sbUpdatePayment,
  deletePaymentRow as sbDeletePayment,
  insertExpense as sbInsertExpense,
  updateExpenseRow as sbUpdateExpense,
  deleteExpenseRow as sbDeleteExpense,
  insertCategory as sbInsertCategory,
  updateSettingsRow as sbUpdateSettings,
} from './supabase-data'

// ── Storage ──

const STORAGE_KEY = 'buildfin_store'

// ── State ──

interface StoreState {
  apartments: Apartment[]
  payments: Payment[]
  expenses: Expense[]
  categories: ExpenseCategory[]
  settings: BuildingSettings
  initialized: boolean
  loaded: boolean
}

const DEFAULT_SETTINGS: BuildingSettings = {
  id: 'default',
  total_apartments: 12,
  expected_yearly_income: 72000,
  expected_yearly_expenditure: 36000,
}

function createDefaultCategories(): ExpenseCategory[] {
  return DEFAULT_EXPENSE_CATEGORIES.map((name) => ({
    id: crypto.randomUUID(),
    name,
  }))
}

const INITIAL_STATE: StoreState = {
  apartments: [],
  payments: [],
  expenses: [],
  categories: [],
  settings: DEFAULT_SETTINGS,
  initialized: false,
  loaded: false,
}

// ── Actions ──

type StoreAction =
  | { type: 'LOAD'; payload: StoreState }
  | { type: 'ADD_APARTMENT'; payload: Apartment }
  | { type: 'UPDATE_APARTMENT'; payload: Apartment }
  | { type: 'DELETE_APARTMENT'; payload: string }
  | { type: 'ADD_PAYMENT'; payload: Payment }
  | { type: 'UPDATE_PAYMENT'; payload: Payment }
  | { type: 'DELETE_PAYMENT'; payload: string }
  | { type: 'ADD_EXPENSE'; payload: Expense }
  | { type: 'UPDATE_EXPENSE'; payload: Expense }
  | { type: 'DELETE_EXPENSE'; payload: string }
  | { type: 'ADD_CATEGORY'; payload: ExpenseCategory }
  | { type: 'UPDATE_SETTINGS'; payload: Partial<BuildingSettings> }

// ── Reducer ──

function storeReducer(state: StoreState, action: StoreAction): StoreState {
  switch (action.type) {
    case 'LOAD':
      return { ...action.payload, initialized: true, loaded: true }

    case 'ADD_APARTMENT':
      return { ...state, apartments: [...state.apartments, action.payload] }

    case 'UPDATE_APARTMENT':
      return {
        ...state,
        apartments: state.apartments.map((a) =>
          a.id === action.payload.id ? action.payload : a
        ),
      }

    case 'DELETE_APARTMENT':
      return {
        ...state,
        apartments: state.apartments.filter((a) => a.id !== action.payload),
        payments: state.payments.filter(
          (p) => p.apartment_id !== action.payload
        ),
      }

    case 'ADD_PAYMENT':
      return { ...state, payments: [...state.payments, action.payload] }

    case 'UPDATE_PAYMENT':
      return {
        ...state,
        payments: state.payments.map((p) =>
          p.id === action.payload.id ? action.payload : p
        ),
      }

    case 'DELETE_PAYMENT':
      return {
        ...state,
        payments: state.payments.filter((p) => p.id !== action.payload),
      }

    case 'ADD_EXPENSE':
      return { ...state, expenses: [...state.expenses, action.payload] }

    case 'UPDATE_EXPENSE':
      return {
        ...state,
        expenses: state.expenses.map((e) =>
          e.id === action.payload.id ? action.payload : e
        ),
      }

    case 'DELETE_EXPENSE':
      return {
        ...state,
        expenses: state.expenses.filter((e) => e.id !== action.payload),
      }

    case 'ADD_CATEGORY':
      return { ...state, categories: [...state.categories, action.payload] }

    case 'UPDATE_SETTINGS':
      return {
        ...state,
        settings: { ...state.settings, ...action.payload },
      }

    default:
      return state
  }
}

// ── localStorage helpers ──

function loadFromStorage(): StoreState | null {
  if (typeof window === 'undefined') return null

  try {
    const data = localStorage.getItem(STORAGE_KEY)
    if (data) {
      const parsed = JSON.parse(data)
      return { ...parsed, initialized: true, loaded: true }
    }
  } catch {
    // Corrupt or unavailable -- treat as first run
  }

  return null
}

function saveToStorage(state: StoreState): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage full or unavailable
  }
}

// ── Seed data generator ──

function generateSeedData(): StoreState {
  const now = new Date()
  const categories = createDefaultCategories()
  const methods: PaymentMethod[] = ['cash', 'bank']

  const catId = (name: string) =>
    categories.find((c) => c.name === name)?.id ?? categories[0].id

  // -- Apartments (6 with varied intervals and statuses) --

  const apartments: Apartment[] = [
    {
      id: crypto.randomUUID(),
      unit_number: '1A',
      floor: 1,
      primary_resident_name: 'Ahmad Khoury',
      phone: '+961 71 123 456',
      email: 'ahmad@email.com',
      payment_interval: 'monthly',
      monthly_due_amount: 500,
      occupancy_status: 'active',
      notes: '',
      created_at: subMonths(now, 8).toISOString(),
    },
    {
      id: crypto.randomUUID(),
      unit_number: '1B',
      floor: 1,
      primary_resident_name: 'Sara Haddad',
      phone: '+961 70 234 567',
      email: 'sara@email.com',
      payment_interval: 'quarterly',
      monthly_due_amount: 450,
      occupancy_status: 'active',
      notes: 'Prefers bank transfer',
      created_at: subMonths(now, 10).toISOString(),
    },
    {
      id: crypto.randomUUID(),
      unit_number: '2A',
      floor: 2,
      primary_resident_name: 'Michel Aoun',
      phone: '+961 76 345 678',
      email: 'michel@email.com',
      payment_interval: 'monthly',
      monthly_due_amount: 550,
      occupancy_status: 'mia',
      notes: 'Has not responded since March',
      created_at: subMonths(now, 7).toISOString(),
    },
    {
      id: crypto.randomUUID(),
      unit_number: '2B',
      floor: 2,
      primary_resident_name: 'Nadia Fares',
      phone: '+961 03 456 789',
      email: 'nadia@email.com',
      payment_interval: 'bimonthly',
      monthly_due_amount: 500,
      occupancy_status: 'traveling_but_paying',
      notes: 'Currently abroad, mother pays via bank',
      created_at: subMonths(now, 9).toISOString(),
    },
    {
      id: crypto.randomUUID(),
      unit_number: '3A',
      floor: 3,
      primary_resident_name: 'Rami Saleh',
      phone: '+961 71 567 890',
      email: 'rami@email.com',
      payment_interval: 'annual',
      monthly_due_amount: 600,
      occupancy_status: 'active',
      notes: 'Pays full year in advance',
      created_at: subMonths(now, 12).toISOString(),
    },
    {
      id: crypto.randomUUID(),
      unit_number: '3B',
      floor: 3,
      primary_resident_name: 'Lina Mansour',
      phone: '+961 70 678 901',
      email: 'lina@email.com',
      payment_interval: 'monthly',
      monthly_due_amount: 500,
      occupancy_status: 'active',
      notes: '',
      created_at: subMonths(now, 6).toISOString(),
    },
  ]

  // -- Payments (~20, spread over past 6 months) --

  const payments: Payment[] = []

  // Ahmad (monthly, active) -- paid all 6 months
  for (let i = 6; i >= 1; i--) {
    const ms = startOfMonth(subMonths(now, i))
    const me = endOfMonth(subMonths(now, i))
    payments.push({
      id: crypto.randomUUID(),
      apartment_id: apartments[0].id,
      payer_name: 'Ahmad Khoury',
      amount: 500,
      method: methods[i % 2],
      date_paid: format(subDays(me, i % 5), 'yyyy-MM-dd'),
      period_start: format(ms, 'yyyy-MM-dd'),
      period_end: format(me, 'yyyy-MM-dd'),
      notes: '',
      created_at: me.toISOString(),
    })
  }

  // Sara (quarterly, active) -- paid Q1 and Q2
  const q1Start = startOfMonth(subMonths(now, 6))
  const q1End = endOfMonth(subMonths(now, 4))
  payments.push({
    id: crypto.randomUUID(),
    apartment_id: apartments[1].id,
    payer_name: 'Sara Haddad',
    amount: 1350,
    method: 'bank',
    date_paid: format(q1Start, 'yyyy-MM-dd'),
    period_start: format(q1Start, 'yyyy-MM-dd'),
    period_end: format(q1End, 'yyyy-MM-dd'),
    notes: 'Q1 payment',
    created_at: q1Start.toISOString(),
  })
  const q2Start = startOfMonth(subMonths(now, 3))
  const q2End = endOfMonth(subMonths(now, 1))
  payments.push({
    id: crypto.randomUUID(),
    apartment_id: apartments[1].id,
    payer_name: 'Sara Haddad',
    amount: 1350,
    method: 'bank',
    date_paid: format(q2Start, 'yyyy-MM-dd'),
    period_start: format(q2Start, 'yyyy-MM-dd'),
    period_end: format(q2End, 'yyyy-MM-dd'),
    notes: 'Q2 payment',
    created_at: q2Start.toISOString(),
  })

  // Michel (monthly, MIA) -- paid only first 2 months, then stopped
  for (let i = 6; i >= 5; i--) {
    const ms = startOfMonth(subMonths(now, i))
    const me = endOfMonth(subMonths(now, i))
    payments.push({
      id: crypto.randomUUID(),
      apartment_id: apartments[2].id,
      payer_name: 'Michel Aoun',
      amount: 550,
      method: 'cash',
      date_paid: format(me, 'yyyy-MM-dd'),
      period_start: format(ms, 'yyyy-MM-dd'),
      period_end: format(me, 'yyyy-MM-dd'),
      notes: '',
      created_at: me.toISOString(),
    })
  }

  // Nadia (bimonthly, traveling) -- 3 bimonthly payments
  for (let i = 3; i >= 1; i--) {
    const pStart = startOfMonth(subMonths(now, i * 2))
    const pEnd = endOfMonth(subMonths(now, i * 2 - 1))
    payments.push({
      id: crypto.randomUUID(),
      apartment_id: apartments[3].id,
      payer_name: 'Nadia Fares',
      amount: 1000,
      method: 'bank',
      date_paid: format(pStart, 'yyyy-MM-dd'),
      period_start: format(pStart, 'yyyy-MM-dd'),
      period_end: format(pEnd, 'yyyy-MM-dd'),
      notes: 'Bank transfer from abroad',
      created_at: pStart.toISOString(),
    })
  }

  // Rami (annual, active) -- paid full year starting 6 months ago
  const yearStart = startOfMonth(subMonths(now, 6))
  const yearEnd = endOfMonth(addMonths(yearStart, 11))
  payments.push({
    id: crypto.randomUUID(),
    apartment_id: apartments[4].id,
    payer_name: 'Rami Saleh',
    amount: 7200,
    method: 'bank',
    date_paid: format(yearStart, 'yyyy-MM-dd'),
    period_start: format(yearStart, 'yyyy-MM-dd'),
    period_end: format(yearEnd, 'yyyy-MM-dd'),
    notes: 'Annual payment - full year',
    created_at: yearStart.toISOString(),
  })

  // Lina (monthly, active) -- paid months 5 through 2, missed last month
  for (let i = 5; i >= 2; i--) {
    const ms = startOfMonth(subMonths(now, i))
    const me = endOfMonth(subMonths(now, i))
    payments.push({
      id: crypto.randomUUID(),
      apartment_id: apartments[5].id,
      payer_name: 'Lina Mansour',
      amount: 500,
      method: methods[i % 2],
      date_paid: format(subDays(me, i % 3), 'yyyy-MM-dd'),
      period_start: format(ms, 'yyyy-MM-dd'),
      period_end: format(me, 'yyyy-MM-dd'),
      notes: '',
      created_at: me.toISOString(),
    })
  }

  // -- Expenses (~15 across categories) --

  const expenses: Expense[] = [
    {
      id: crypto.randomUUID(),
      category_id: catId('maintenance'),
      amount: 800,
      method: 'cash',
      date: format(subMonths(now, 5), 'yyyy-MM-dd'),
      vendor: 'ABC Maintenance',
      notes: 'Fixed leak in 2A bathroom',
      created_at: subMonths(now, 5).toISOString(),
    },
    {
      id: crypto.randomUUID(),
      category_id: catId('maintenance'),
      amount: 1200,
      method: 'bank',
      date: format(subMonths(now, 3), 'yyyy-MM-dd'),
      vendor: 'Paint Supplier',
      notes: 'Stairwell repainting',
      created_at: subMonths(now, 3).toISOString(),
    },
    {
      id: crypto.randomUUID(),
      category_id: catId('water'),
      amount: 350,
      method: 'bank',
      date: format(subMonths(now, 4), 'yyyy-MM-dd'),
      vendor: 'Water Co.',
      notes: 'Monthly water bill',
      created_at: subMonths(now, 4).toISOString(),
    },
    {
      id: crypto.randomUUID(),
      category_id: catId('water'),
      amount: 380,
      method: 'bank',
      date: format(subMonths(now, 2), 'yyyy-MM-dd'),
      vendor: 'Water Co.',
      notes: 'Monthly water bill',
      created_at: subMonths(now, 2).toISOString(),
    },
    {
      id: crypto.randomUUID(),
      category_id: catId('electricity'),
      amount: 620,
      method: 'bank',
      date: format(subMonths(now, 5), 'yyyy-MM-dd'),
      vendor: 'EDL',
      notes: 'Building common areas',
      created_at: subMonths(now, 5).toISOString(),
    },
    {
      id: crypto.randomUUID(),
      category_id: catId('electricity'),
      amount: 580,
      method: 'bank',
      date: format(subMonths(now, 3), 'yyyy-MM-dd'),
      vendor: 'EDL',
      notes: 'Building common areas',
      created_at: subMonths(now, 3).toISOString(),
    },
    {
      id: crypto.randomUUID(),
      category_id: catId('electricity'),
      amount: 650,
      method: 'bank',
      date: format(subMonths(now, 1), 'yyyy-MM-dd'),
      vendor: 'EDL',
      notes: 'Summer rates higher',
      created_at: subMonths(now, 1).toISOString(),
    },
    {
      id: crypto.randomUUID(),
      category_id: catId('internet'),
      amount: 450,
      method: 'bank',
      date: format(subMonths(now, 4), 'yyyy-MM-dd'),
      vendor: 'ISP Provider',
      notes: 'Building internet service',
      created_at: subMonths(now, 4).toISOString(),
    },
    {
      id: crypto.randomUUID(),
      category_id: catId('internet'),
      amount: 450,
      method: 'bank',
      date: format(subMonths(now, 1), 'yyyy-MM-dd'),
      vendor: 'ISP Provider',
      notes: 'Building internet service',
      created_at: subMonths(now, 1).toISOString(),
    },
    {
      id: crypto.randomUUID(),
      category_id: catId('security'),
      amount: 1500,
      method: 'cash',
      date: format(subMonths(now, 4), 'yyyy-MM-dd'),
      vendor: 'Guard Service',
      notes: 'Night guard - monthly',
      created_at: subMonths(now, 4).toISOString(),
    },
    {
      id: crypto.randomUUID(),
      category_id: catId('security'),
      amount: 1500,
      method: 'cash',
      date: format(subMonths(now, 2), 'yyyy-MM-dd'),
      vendor: 'Guard Service',
      notes: 'Night guard - monthly',
      created_at: subMonths(now, 2).toISOString(),
    },
    {
      id: crypto.randomUUID(),
      category_id: catId('cleaning'),
      amount: 600,
      method: 'cash',
      date: format(subMonths(now, 3), 'yyyy-MM-dd'),
      vendor: 'CleanCo',
      notes: 'Monthly deep clean',
      created_at: subMonths(now, 3).toISOString(),
    },
    {
      id: crypto.randomUUID(),
      category_id: catId('cleaning'),
      amount: 600,
      method: 'cash',
      date: format(subMonths(now, 1), 'yyyy-MM-dd'),
      vendor: 'CleanCo',
      notes: 'Monthly deep clean',
      created_at: subMonths(now, 1).toISOString(),
    },
    {
      id: crypto.randomUUID(),
      category_id: catId('extras'),
      amount: 3500,
      method: 'bank',
      date: format(subMonths(now, 2), 'yyyy-MM-dd'),
      vendor: 'Elevator Repair',
      notes: 'Elevator motor repair',
      created_at: subMonths(now, 2).toISOString(),
    },
    {
      id: crypto.randomUUID(),
      category_id: catId('other'),
      amount: 250,
      method: 'cash',
      date: format(subMonths(now, 5), 'yyyy-MM-dd'),
      vendor: 'Office Supplies',
      notes: 'Ledger books and receipts',
      created_at: subMonths(now, 5).toISOString(),
    },
  ]

  return {
    apartments,
    payments,
    expenses,
    categories,
    settings: DEFAULT_SETTINGS,
    initialized: true,
    loaded: true,
  }
}

// ── Context type ──

interface StoreContextValue {
  state: StoreState

  // Namespaced CRUD operations
  apartments: {
    list: () => Apartment[]
    get: (id: string) => Apartment | undefined
    create: (data: Omit<Apartment, 'id' | 'created_at'>) => Apartment
    update: (id: string, data: Partial<Apartment>) => void
    delete: (id: string) => void
  }
  payments: {
    list: () => Payment[]
    listByApartment: (apartmentId: string) => Payment[]
    create: (data: Omit<Payment, 'id' | 'created_at'>) => Payment
    update: (id: string, data: Partial<Payment>) => void
    delete: (id: string) => void
  }
  expenses: {
    list: () => Expense[]
    create: (data: Omit<Expense, 'id' | 'created_at'>) => Expense
    update: (id: string, data: Partial<Expense>) => void
    delete: (id: string) => void
  }
  categories: {
    list: () => ExpenseCategory[]
    create: (name: string) => ExpenseCategory
  }
  settings: {
    get: () => BuildingSettings
    update: (data: Partial<BuildingSettings>) => void
  }

  seedData: () => void

  // Flat method aliases (used by pages)
  addApartment: (data: Omit<Apartment, 'id' | 'created_at'>) => Apartment
  updateApartment: (apartment: Apartment) => void
  deleteApartment: (id: string) => void
  addPayment: (data: Omit<Payment, 'id' | 'created_at'>) => Payment
  updatePayment: (payment: Payment) => void
  deletePayment: (id: string) => void
  addExpense: (data: Omit<Expense, 'id' | 'created_at'>) => Expense
  updateExpense: (expense: Expense) => void
  deleteExpense: (id: string) => void
  addCategory: (name: string) => ExpenseCategory
  updateSettings: (data: Partial<BuildingSettings>) => void
}

const StoreContext = createContext<StoreContextValue | null>(null)

// ── Provider ──

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(storeReducer, INITIAL_STATE)

  // Load from Supabase (or localStorage fallback) on mount
  useEffect(() => {
    async function load() {
      if (isSupabaseConfigured()) {
        const data = await fetchAllData()
        if (data) {
          dispatch({
            type: 'LOAD',
            payload: {
              apartments: data.apartments,
              payments: data.payments,
              expenses: data.expenses,
              categories: data.categories,
              settings: data.settings,
              initialized: true,
              loaded: true,
            },
          })
          return
        }
      }
      const stored = loadFromStorage()
      if (stored) {
        dispatch({ type: 'LOAD', payload: stored })
      } else {
        const seeded = generateSeedData()
        dispatch({ type: 'LOAD', payload: seeded })
      }
    }
    load()
  }, [])

  // Persist to localStorage on every state change (only when not using Supabase)
  useEffect(() => {
    if (state.initialized && !isSupabaseConfigured()) {
      saveToStorage(state)
    }
  }, [state])

  // -- Apartment CRUD --

  const apartmentOps = {
    list: useCallback(() => state.apartments, [state.apartments]),

    get: useCallback(
      (id: string) => state.apartments.find((a) => a.id === id),
      [state.apartments]
    ),

    create: useCallback(
      (data: Omit<Apartment, 'id' | 'created_at'>): Apartment => {
        const apartment: Apartment = {
          ...data,
          id: crypto.randomUUID(),
          created_at: new Date().toISOString(),
        }
        dispatch({ type: 'ADD_APARTMENT', payload: apartment })
        return apartment
      },
      []
    ),

    update: useCallback((id: string, data: Partial<Apartment>) => {
      // Merge partial data into the existing apartment
      dispatch({
        type: 'UPDATE_APARTMENT',
        payload: { id, ...data } as Apartment,
      })
    }, []),

    delete: useCallback((id: string) => {
      dispatch({ type: 'DELETE_APARTMENT', payload: id })
    }, []),
  }

  // -- Payment CRUD --

  const paymentOps = {
    list: useCallback(() => state.payments, [state.payments]),

    listByApartment: useCallback(
      (apartmentId: string) =>
        state.payments.filter((p) => p.apartment_id === apartmentId),
      [state.payments]
    ),

    create: useCallback(
      (data: Omit<Payment, 'id' | 'created_at'>): Payment => {
        const payment: Payment = {
          ...data,
          id: crypto.randomUUID(),
          created_at: new Date().toISOString(),
        }
        dispatch({ type: 'ADD_PAYMENT', payload: payment })
        return payment
      },
      []
    ),

    update: useCallback((id: string, data: Partial<Payment>) => {
      dispatch({
        type: 'UPDATE_PAYMENT',
        payload: { id, ...data } as Payment,
      })
    }, []),

    delete: useCallback((id: string) => {
      dispatch({ type: 'DELETE_PAYMENT', payload: id })
    }, []),
  }

  // -- Expense CRUD --

  const expenseOps = {
    list: useCallback(() => state.expenses, [state.expenses]),

    create: useCallback(
      (data: Omit<Expense, 'id' | 'created_at'>): Expense => {
        const expense: Expense = {
          ...data,
          id: crypto.randomUUID(),
          created_at: new Date().toISOString(),
        }
        dispatch({ type: 'ADD_EXPENSE', payload: expense })
        return expense
      },
      []
    ),

    update: useCallback((id: string, data: Partial<Expense>) => {
      dispatch({
        type: 'UPDATE_EXPENSE',
        payload: { id, ...data } as Expense,
      })
    }, []),

    delete: useCallback((id: string) => {
      dispatch({ type: 'DELETE_EXPENSE', payload: id })
    }, []),
  }

  // -- Category operations --

  const categoryOps = {
    list: useCallback(() => state.categories, [state.categories]),

    create: useCallback((name: string): ExpenseCategory => {
      const category: ExpenseCategory = {
        id: crypto.randomUUID(),
        name,
      }
      dispatch({ type: 'ADD_CATEGORY', payload: category })
      return category
    }, []),
  }

  // -- Settings operations --

  const settingsOps = {
    get: useCallback(() => state.settings, [state.settings]),

    update: useCallback((data: Partial<BuildingSettings>) => {
      dispatch({ type: 'UPDATE_SETTINGS', payload: data })
    }, []),
  }

  // -- Seed --

  const seedData = useCallback(() => {
    const seeded = generateSeedData()
    dispatch({ type: 'LOAD', payload: seeded })
  }, [])

  // -- Context value --

  const useSupabase = isSupabaseConfigured()

  const addApartment = useCallback(
    (data: Omit<Apartment, 'id' | 'created_at'>): Apartment => {
      const apt: Apartment = { ...data, id: crypto.randomUUID(), created_at: new Date().toISOString() }
      dispatch({ type: 'ADD_APARTMENT', payload: apt })
      if (useSupabase) {
        sbInsertApartment(data).then((row) => {
          if (row) dispatch({ type: 'UPDATE_APARTMENT', payload: row })
        })
      }
      return apt
    }, [useSupabase]
  )
  const updateApartment = useCallback((apartment: Apartment) => {
    dispatch({ type: 'UPDATE_APARTMENT', payload: apartment })
    if (useSupabase) sbUpdateApartment(apartment)
  }, [useSupabase])
  const deleteApartment = useCallback((id: string) => {
    dispatch({ type: 'DELETE_APARTMENT', payload: id })
    if (useSupabase) sbDeleteApartment(id)
  }, [useSupabase])
  const addPayment = useCallback(
    (data: Omit<Payment, 'id' | 'created_at'>): Payment => {
      const p: Payment = { ...data, id: crypto.randomUUID(), created_at: new Date().toISOString() }
      dispatch({ type: 'ADD_PAYMENT', payload: p })
      if (useSupabase) {
        sbInsertPayment(data).then((row) => {
          if (row) dispatch({ type: 'UPDATE_PAYMENT', payload: row })
        })
      }
      return p
    }, [useSupabase]
  )
  const updatePayment = useCallback((payment: Payment) => {
    dispatch({ type: 'UPDATE_PAYMENT', payload: payment })
    if (useSupabase) sbUpdatePayment(payment)
  }, [useSupabase])
  const deletePayment = useCallback((id: string) => {
    dispatch({ type: 'DELETE_PAYMENT', payload: id })
    if (useSupabase) sbDeletePayment(id)
  }, [useSupabase])
  const addExpense = useCallback(
    (data: Omit<Expense, 'id' | 'created_at'>): Expense => {
      const e: Expense = { ...data, id: crypto.randomUUID(), created_at: new Date().toISOString() }
      dispatch({ type: 'ADD_EXPENSE', payload: e })
      if (useSupabase) {
        sbInsertExpense(data).then((row) => {
          if (row) dispatch({ type: 'UPDATE_EXPENSE', payload: row })
        })
      }
      return e
    }, [useSupabase]
  )
  const updateExpense = useCallback((expense: Expense) => {
    dispatch({ type: 'UPDATE_EXPENSE', payload: expense })
    if (useSupabase) sbUpdateExpense(expense)
  }, [useSupabase])
  const deleteExpense = useCallback((id: string) => {
    dispatch({ type: 'DELETE_EXPENSE', payload: id })
    if (useSupabase) sbDeleteExpense(id)
  }, [useSupabase])
  const addCategory = useCallback((name: string): ExpenseCategory => {
    const cat: ExpenseCategory = { id: crypto.randomUUID(), name }
    dispatch({ type: 'ADD_CATEGORY', payload: cat })
    if (useSupabase) {
      sbInsertCategory(name).then((row) => {
        if (row) dispatch({ type: 'ADD_CATEGORY', payload: row })
      })
    }
    return cat
  }, [useSupabase])
  const updateSettings = useCallback((data: Partial<BuildingSettings>) => {
    dispatch({ type: 'UPDATE_SETTINGS', payload: data })
    if (useSupabase) sbUpdateSettings(data)
  }, [useSupabase])

  const value: StoreContextValue = {
    state,
    apartments: apartmentOps,
    payments: paymentOps,
    expenses: expenseOps,
    categories: categoryOps,
    settings: settingsOps,
    seedData,
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
    updateSettings,
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

// ── Hook ──

export function useStore(): StoreContextValue {
  const context = useContext(StoreContext)
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider')
  }
  return context
}
