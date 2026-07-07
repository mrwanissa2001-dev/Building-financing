'use client'

import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
} from 'react'
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
} from './types'
import {
  fetchAllData,
  DEFAULT_SETTINGS,
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
  insertPerson as sbInsertPerson,
  updatePersonRow as sbUpdatePerson,
  deletePersonRow as sbDeletePerson,
  insertHistory as sbInsertHistory,
  updateHistoryRow as sbUpdateHistory,
  deleteHistoryRow as sbDeleteHistory,
  insertTransfer as sbInsertTransfer,
  deleteTransferRow as sbDeleteTransfer,
  updateSettingsRow as sbUpdateSettings,
} from './supabase-data'
import {
  monthKey,
  currentMonthKey,
  addMonthsToKey,
  monthsBetween,
  firstDayOfMonth,
  lastDayOfMonth,
} from './months'

// ── State ──

interface StoreState {
  apartments: Apartment[]
  payments: Payment[]
  expenses: Expense[]
  categories: ExpenseCategory[]
  people: CategoryPerson[]
  history: YearlyHistory[]
  transfers: Transfer[]
  settings: BuildingSettings
  initialized: boolean
  loaded: boolean
}

const INITIAL_STATE: StoreState = {
  apartments: [],
  payments: [],
  expenses: [],
  categories: [],
  people: [],
  history: [],
  transfers: [],
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
  | { type: 'ADD_PERSON'; payload: CategoryPerson }
  | { type: 'UPDATE_PERSON'; payload: CategoryPerson }
  | { type: 'DELETE_PERSON'; payload: string }
  | { type: 'ADD_HISTORY'; payload: YearlyHistory }
  | { type: 'UPDATE_HISTORY'; payload: YearlyHistory }
  | { type: 'DELETE_HISTORY'; payload: string }
  | { type: 'ADD_TRANSFER'; payload: Transfer }
  | { type: 'DELETE_TRANSFER'; payload: string }
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

    case 'ADD_PERSON':
      return { ...state, people: [...state.people, action.payload] }

    case 'UPDATE_PERSON':
      return {
        ...state,
        people: state.people.map((p) =>
          p.id === action.payload.id ? action.payload : p
        ),
      }

    case 'DELETE_PERSON':
      return {
        ...state,
        people: state.people.filter((p) => p.id !== action.payload),
      }

    case 'ADD_HISTORY':
      return {
        ...state,
        history: [...state.history, action.payload].sort((a, b) => a.year - b.year),
      }

    case 'UPDATE_HISTORY':
      return {
        ...state,
        history: state.history
          .map((h) => (h.id === action.payload.id ? action.payload : h))
          .sort((a, b) => a.year - b.year),
      }

    case 'DELETE_HISTORY':
      return {
        ...state,
        history: state.history.filter((h) => h.id !== action.payload),
      }

    case 'ADD_TRANSFER':
      return {
        ...state,
        transfers: [action.payload, ...state.transfers],
      }

    case 'DELETE_TRANSFER':
      return {
        ...state,
        transfers: state.transfers.filter((t) => t.id !== action.payload),
      }

    case 'UPDATE_SETTINGS':
      return {
        ...state,
        settings: { ...state.settings, ...action.payload },
      }

    default:
      return state
  }
}

// ── Context type ──

interface StoreContextValue {
  state: StoreState

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
  addPerson: (categoryId: string, name: string) => CategoryPerson
  updatePerson: (person: CategoryPerson) => void
  deletePerson: (id: string) => void
  addHistory: (data: Omit<YearlyHistory, 'id'>) => YearlyHistory
  updateHistory: (row: YearlyHistory) => void
  deleteHistory: (id: string) => void
  addTransfer: (data: Omit<Transfer, 'id' | 'created_at'>) => Transfer
  deleteTransfer: (id: string) => void
  updateSettings: (data: Partial<BuildingSettings>) => void

  importPayments: (rows: Omit<Payment, 'id' | 'created_at'>[]) => number
  importExpenses: (
    rows: {
      category_name: string
      amount: number
      method: PaymentMethod
      date: string
      vendor: string
      recurring: boolean
      recurring_interval: number
      notes: string
    }[]
  ) => Promise<number>
}

const StoreContext = createContext<StoreContextValue | null>(null)

// ── Provider ──

// Build the catch-up entries a recurring payment/expense series is
// missing, up to (and including) the current month. Each generated row
// extends the chain, so the next app load continues from it.
function buildRecurringPayments(payments: Payment[]): Omit<Payment, 'id' | 'created_at'>[] {
  const nowKey = currentMonthKey()
  const out: Omit<Payment, 'id' | 'created_at'>[] = []

  const latestByApartment = new Map<string, Payment>()
  for (const p of payments) {
    // extra payments are one-off by nature — never extend them
    if (!p.recurring || p.extra) continue
    const prev = latestByApartment.get(p.apartment_id)
    if (!prev || p.period_start > prev.period_start) latestByApartment.set(p.apartment_id, p)
  }

  for (const latest of latestByApartment.values()) {
    const startK = monthKey(latest.period_start)
    const endK = monthKey(latest.period_end)
    const span = Math.max(1, monthsBetween(startK, endK) + 1)
    let from = addMonthsToKey(startK, span)
    let guard = 0
    while (from <= nowKey && guard < 24) {
      const to = addMonthsToKey(from, span - 1)
      out.push({
        apartment_id: latest.apartment_id,
        payer_name: latest.payer_name,
        payer_relation: latest.payer_relation ?? '',
        amount: latest.amount,
        method: latest.method,
        date_paid: firstDayOfMonth(from),
        period_start: firstDayOfMonth(from),
        period_end: lastDayOfMonth(to),
        recurring: true,
        extra: false,
        on_dashboard: latest.on_dashboard ?? true,
        notes: '(auto recurring)',
      })
      from = addMonthsToKey(from, span)
      guard++
    }
  }
  return out
}

function buildRecurringExpenses(expenses: Expense[]): Omit<Expense, 'id' | 'created_at'>[] {
  const nowKey = currentMonthKey()
  const out: Omit<Expense, 'id' | 'created_at'>[] = []

  const latestBySeries = new Map<string, Expense>()
  for (const e of expenses) {
    if (!e.recurring) continue
    const k = `${e.category_id}|${e.vendor.trim().toLowerCase()}`
    const prev = latestBySeries.get(k)
    if (!prev || e.date > prev.date) latestBySeries.set(k, e)
  }

  for (const latest of latestBySeries.values()) {
    const interval = Math.max(1, latest.recurring_interval ?? 1)
    const dayOfMonth = Number(latest.date.slice(8, 10)) || 1
    let mk = addMonthsToKey(monthKey(latest.date), interval)
    let guard = 0
    while (mk <= nowKey && guard < 24) {
      const [y, m] = mk.split('-').map(Number)
      const lastDay = new Date(y, m, 0).getDate()
      out.push({
        category_id: latest.category_id,
        amount: latest.amount,
        method: latest.method,
        date: `${mk}-${String(Math.min(dayOfMonth, lastDay)).padStart(2, '0')}`,
        vendor: latest.vendor,
        recurring: true,
        recurring_interval: interval,
        notes: '(auto recurring)',
      })
      mk = addMonthsToKey(mk, interval)
      guard++
    }
  }
  return out
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(storeReducer, INITIAL_STATE)

  useEffect(() => {
    async function load() {
      const data = await fetchAllData()
      if (data) {
        dispatch({
          type: 'LOAD',
          payload: {
            apartments: data.apartments,
            payments: data.payments,
            expenses: data.expenses,
            categories: data.categories,
            people: data.people,
            history: data.history,
            transfers: data.transfers,
            settings: data.settings,
            initialized: true,
            loaded: true,
          },
        })

        // catch up recurring series to the current month
        for (const rp of buildRecurringPayments(data.payments)) {
          const p: Payment = { ...rp, id: crypto.randomUUID(), created_at: new Date().toISOString() }
          dispatch({ type: 'ADD_PAYMENT', payload: p })
          sbInsertPayment({ ...rp, id: p.id })
        }
        for (const re of buildRecurringExpenses(data.expenses)) {
          const e: Expense = { ...re, id: crypto.randomUUID(), created_at: new Date().toISOString() }
          dispatch({ type: 'ADD_EXPENSE', payload: e })
          sbInsertExpense({ ...re, id: e.id })
        }
      } else {
        dispatch({
          type: 'LOAD',
          payload: { ...INITIAL_STATE, initialized: true, loaded: true },
        })
      }
    }
    load()
  }, [])

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

  // -- Flat CRUD with Supabase sync --

  const addApartment = useCallback(
    (data: Omit<Apartment, 'id' | 'created_at'>): Apartment => {
      const apt: Apartment = { ...data, id: crypto.randomUUID(), created_at: new Date().toISOString() }
      dispatch({ type: 'ADD_APARTMENT', payload: apt })
      sbInsertApartment({ ...data, id: apt.id }).then((row) => {
        if (row) dispatch({ type: 'UPDATE_APARTMENT', payload: row })
      })
      return apt
    }, []
  )
  const updateApartment = useCallback((apartment: Apartment) => {
    dispatch({ type: 'UPDATE_APARTMENT', payload: apartment })
    sbUpdateApartment(apartment)
  }, [])
  const deleteApartment = useCallback((id: string) => {
    dispatch({ type: 'DELETE_APARTMENT', payload: id })
    sbDeleteApartment(id)
  }, [])
  const addPayment = useCallback(
    (data: Omit<Payment, 'id' | 'created_at'>): Payment => {
      const p: Payment = { ...data, id: crypto.randomUUID(), created_at: new Date().toISOString() }
      dispatch({ type: 'ADD_PAYMENT', payload: p })
      sbInsertPayment({ ...data, id: p.id }).then((row) => {
        if (row) dispatch({ type: 'UPDATE_PAYMENT', payload: row })
      })
      return p
    }, []
  )
  const updatePayment = useCallback((payment: Payment) => {
    dispatch({ type: 'UPDATE_PAYMENT', payload: payment })
    sbUpdatePayment(payment)
  }, [])
  const deletePayment = useCallback((id: string) => {
    dispatch({ type: 'DELETE_PAYMENT', payload: id })
    sbDeletePayment(id)
  }, [])
  const addExpense = useCallback(
    (data: Omit<Expense, 'id' | 'created_at'>): Expense => {
      const e: Expense = { ...data, id: crypto.randomUUID(), created_at: new Date().toISOString() }
      dispatch({ type: 'ADD_EXPENSE', payload: e })
      sbInsertExpense({ ...data, id: e.id }).then((row) => {
        if (row) dispatch({ type: 'UPDATE_EXPENSE', payload: row })
      })
      return e
    }, []
  )
  const updateExpense = useCallback((expense: Expense) => {
    dispatch({ type: 'UPDATE_EXPENSE', payload: expense })
    sbUpdateExpense(expense)
  }, [])
  const deleteExpense = useCallback((id: string) => {
    dispatch({ type: 'DELETE_EXPENSE', payload: id })
    sbDeleteExpense(id)
  }, [])
  const addCategory = useCallback((name: string): ExpenseCategory => {
    const cat: ExpenseCategory = { id: crypto.randomUUID(), name }
    dispatch({ type: 'ADD_CATEGORY', payload: cat })
    sbInsertCategory(cat)
    return cat
  }, [])
  const addPerson = useCallback((categoryId: string, name: string): CategoryPerson => {
    const person: CategoryPerson = { id: crypto.randomUUID(), category_id: categoryId, name }
    dispatch({ type: 'ADD_PERSON', payload: person })
    sbInsertPerson(person)
    return person
  }, [])
  const updatePerson = useCallback((person: CategoryPerson) => {
    dispatch({ type: 'UPDATE_PERSON', payload: person })
    sbUpdatePerson(person)
  }, [])
  const deletePerson = useCallback((id: string) => {
    dispatch({ type: 'DELETE_PERSON', payload: id })
    sbDeletePerson(id)
  }, [])
  const addHistory = useCallback((data: Omit<YearlyHistory, 'id'>): YearlyHistory => {
    const row: YearlyHistory = { ...data, id: crypto.randomUUID() }
    dispatch({ type: 'ADD_HISTORY', payload: row })
    sbInsertHistory(row)
    return row
  }, [])
  const updateHistory = useCallback((row: YearlyHistory) => {
    dispatch({ type: 'UPDATE_HISTORY', payload: row })
    sbUpdateHistory(row)
  }, [])
  const deleteHistory = useCallback((id: string) => {
    dispatch({ type: 'DELETE_HISTORY', payload: id })
    sbDeleteHistory(id)
  }, [])
  const addTransfer = useCallback((data: Omit<Transfer, 'id' | 'created_at'>): Transfer => {
    const t: Transfer = { ...data, id: crypto.randomUUID(), created_at: new Date().toISOString() }
    dispatch({ type: 'ADD_TRANSFER', payload: t })
    sbInsertTransfer({ ...data, id: t.id })
    return t
  }, [])
  const deleteTransfer = useCallback((id: string) => {
    dispatch({ type: 'DELETE_TRANSFER', payload: id })
    sbDeleteTransfer(id)
  }, [])
  const updateSettings = useCallback((data: Partial<BuildingSettings>) => {
    dispatch({ type: 'UPDATE_SETTINGS', payload: data })
    sbUpdateSettings(data)
  }, [])

  // -- CSV bulk import --

  const importPayments = useCallback(
    (rows: Omit<Payment, 'id' | 'created_at'>[]): number => {
      for (const data of rows) {
        const p: Payment = { ...data, id: crypto.randomUUID(), created_at: new Date().toISOString() }
        dispatch({ type: 'ADD_PAYMENT', payload: p })
        sbInsertPayment({ ...data, id: p.id })
      }
      return rows.length
    },
    []
  )

  const importExpenses = useCallback(
    async (
      rows: {
        category_name: string
        amount: number
        method: PaymentMethod
        date: string
        vendor: string
        recurring: boolean
        recurring_interval: number
        notes: string
      }[]
    ): Promise<number> => {
      // resolve category names to ids, creating missing categories in
      // Supabase first (awaited) so expense rows never reference a
      // category id that is not yet in the database
      const byName = new Map<string, string>(
        state.categories.map((c) => [c.name.trim().toLowerCase(), c.id])
      )

      let imported = 0
      for (const r of rows) {
        const key = r.category_name.trim().toLowerCase()
        if (!key) continue

        let categoryId = byName.get(key)
        if (!categoryId) {
          const cat: ExpenseCategory = { id: crypto.randomUUID(), name: r.category_name.trim() }
          await sbInsertCategory(cat)
          dispatch({ type: 'ADD_CATEGORY', payload: cat })
          byName.set(key, cat.id)
          categoryId = cat.id
        }

        const data = {
          category_id: categoryId,
          amount: r.amount,
          method: r.method,
          date: r.date,
          vendor: r.vendor,
          recurring: r.recurring,
          recurring_interval: Math.max(1, r.recurring_interval || 1),
          notes: r.notes,
        }
        const e: Expense = { ...data, id: crypto.randomUUID(), created_at: new Date().toISOString() }
        dispatch({ type: 'ADD_EXPENSE', payload: e })
        sbInsertExpense({ ...data, id: e.id })
        imported++
      }
      return imported
    },
    [state.categories]
  )

  const value: StoreContextValue = {
    state,
    apartments: apartmentOps,
    payments: paymentOps,
    expenses: expenseOps,
    categories: categoryOps,
    settings: settingsOps,
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
    addPerson,
    updatePerson,
    deletePerson,
    addHistory,
    updateHistory,
    deleteHistory,
    addTransfer,
    deleteTransfer,
    updateSettings,
    importPayments,
    importExpenses,
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
