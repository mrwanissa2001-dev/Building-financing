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
  BuildingSettings,
} from './types'
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

const INITIAL_STATE: StoreState = {
  apartments: [],
  payments: [],
  expenses: [],
  categories: [],
  settings: { id: '', total_apartments: 0, expected_yearly_income: 0, expected_yearly_expenditure: 0 },
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
  | { type: 'UPDATE_CATEGORY'; payload: { tempId: string; row: ExpenseCategory } }
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

    case 'UPDATE_CATEGORY':
      return {
        ...state,
        categories: state.categories.map((c) =>
          c.id === action.payload.tempId ? action.payload.row : c
        ),
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
  updateSettings: (data: Partial<BuildingSettings>) => void
}

const StoreContext = createContext<StoreContextValue | null>(null)

// ── Provider ──

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
            settings: data.settings,
            initialized: true,
            loaded: true,
          },
        })
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
      sbInsertApartment(data).then((row) => {
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
      sbInsertPayment(data).then((row) => {
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
      sbInsertExpense(data).then((row) => {
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
    sbInsertCategory(name).then((row) => {
      if (row) dispatch({ type: 'UPDATE_CATEGORY', payload: { tempId: cat.id, row } })
    })
    return cat
  }, [])
  const updateSettings = useCallback((data: Partial<BuildingSettings>) => {
    dispatch({ type: 'UPDATE_SETTINGS', payload: data })
    sbUpdateSettings(data)
  }, [])

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
