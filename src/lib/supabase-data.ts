import { supabase } from './supabase'
import type {
  Apartment,
  Payment,
  Expense,
  ExpenseCategory,
  BuildingSettings,
} from './types'

export async function testConnection(): Promise<{ ok: boolean; message: string }> {
  if (!supabase) return { ok: false, message: 'Supabase env vars not configured (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY missing)' }
  const { error } = await supabase.from('building_settings').select('id').limit(1)
  if (error) return { ok: false, message: error.message }
  return { ok: true, message: 'Connected' }
}

export async function fetchAllData() {
  if (!supabase) return null

  const [apartments, payments, expenses, categories, settings] =
    await Promise.all([
      supabase.from('apartments').select('*').order('unit_number'),
      supabase.from('payments').select('*').order('date_paid', { ascending: false }),
      supabase.from('expenses').select('*').order('date', { ascending: false }),
      supabase.from('expense_categories').select('*').order('name'),
      supabase.from('building_settings').select('*').limit(1).single(),
    ])

  if (apartments.error || payments.error || expenses.error || categories.error || settings.error) {
    console.error('Supabase fetch errors:', {
      apartments: apartments.error,
      payments: payments.error,
      expenses: expenses.error,
      categories: categories.error,
      settings: settings.error,
    })
    return null
  }

  return {
    apartments: apartments.data as Apartment[],
    payments: payments.data as Payment[],
    expenses: expenses.data as Expense[],
    categories: categories.data as ExpenseCategory[],
    settings: settings.data as BuildingSettings,
  }
}

// ── Apartments ──

// inserts include the client-generated id so local state and the
// database always agree on row identity
export async function insertApartment(data: Omit<Apartment, 'created_at'>) {
  if (!supabase) return null
  const { data: row, error } = await supabase
    .from('apartments')
    .insert(data)
    .select()
    .single()
  if (error) { console.error('Insert apartment error:', error); return null }
  return row as Apartment
}

export async function updateApartmentRow(apartment: Apartment) {
  if (!supabase) return false
  const { id, created_at, ...rest } = apartment
  const { error } = await supabase.from('apartments').update(rest).eq('id', id)
  if (error) { console.error('Update apartment error:', error); return false }
  return true
}

export async function deleteApartmentRow(id: string) {
  if (!supabase) return false
  const { error } = await supabase.from('apartments').delete().eq('id', id)
  if (error) { console.error('Delete apartment error:', error); return false }
  return true
}

// ── Payments ──

export async function insertPayment(data: Omit<Payment, 'created_at'>) {
  if (!supabase) return null
  const { data: row, error } = await supabase
    .from('payments')
    .insert(data)
    .select()
    .single()
  if (error) { console.error('Insert payment error:', error); return null }
  return row as Payment
}

export async function updatePaymentRow(payment: Payment) {
  if (!supabase) return false
  const { id, created_at, ...rest } = payment
  const { error } = await supabase.from('payments').update(rest).eq('id', id)
  if (error) { console.error('Update payment error:', error); return false }
  return true
}

export async function deletePaymentRow(id: string) {
  if (!supabase) return false
  const { error } = await supabase.from('payments').delete().eq('id', id)
  if (error) { console.error('Delete payment error:', error); return false }
  return true
}

// ── Expenses ──

export async function insertExpense(data: Omit<Expense, 'created_at'>) {
  if (!supabase) return null
  const { data: row, error } = await supabase
    .from('expenses')
    .insert(data)
    .select()
    .single()
  if (error) { console.error('Insert expense error:', error); return null }
  return row as Expense
}

export async function updateExpenseRow(expense: Expense) {
  if (!supabase) return false
  const { id, created_at, ...rest } = expense
  const { error } = await supabase.from('expenses').update(rest).eq('id', id)
  if (error) { console.error('Update expense error:', error); return false }
  return true
}

export async function deleteExpenseRow(id: string) {
  if (!supabase) return false
  const { error } = await supabase.from('expenses').delete().eq('id', id)
  if (error) { console.error('Delete expense error:', error); return false }
  return true
}

// ── Categories ──

export async function insertCategory(cat: ExpenseCategory) {
  if (!supabase) return null
  const { data: row, error } = await supabase
    .from('expense_categories')
    .insert(cat)
    .select()
    .single()
  if (error) { console.error('Insert category error:', error); return null }
  return row as ExpenseCategory
}

// ── Settings ──

export async function updateSettingsRow(data: Partial<BuildingSettings>) {
  if (!supabase) return false
  const { id, ...rest } = data
  const { error } = await supabase
    .from('building_settings')
    .update(rest)
    .not('id', 'is', null)
  if (error) { console.error('Update settings error:', error); return false }
  return true
}
