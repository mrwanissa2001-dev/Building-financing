import { supabase } from './supabase'
import type {
  Apartment,
  Payment,
  Expense,
  ExpenseCategory,
  CategoryPerson,
  YearlyHistory,
  Transfer,
  BuildingSettings,
} from './types'

export const DEFAULT_SETTINGS: BuildingSettings = {
  id: '',
  building_name: '',
  total_apartments: 0,
  expected_yearly_income: 0,
  expected_yearly_expenditure: 0,
  num_buildings: 1,
  num_floors: 13,
  mezzanine_floors: 2,
  apartments_per_floor: 0,
}

// ── Sync error reporting ──
//
// Writes happen in the background after the UI has already updated, so
// a failed insert used to disappear into the console — the payment
// "registered" on screen but was gone after a reload. Every failure now
// flows through this handler; the app shell shows it as a toast.

type SyncErrorHandler = (title: string, message: string) => void
let syncErrorHandler: SyncErrorHandler | null = null

export function onSyncError(handler: SyncErrorHandler | null) {
  syncErrorHandler = handler
}

function reportSyncError(title: string, message: string) {
  console.error(`${title}:`, message)
  syncErrorHandler?.(title, message)
}

// ── Missing-column fallback ──
//
// When the app is newer than the database (a migration hasn't been run
// yet), PostgREST rejects the whole row because of one unknown column.
// Strip that column and retry so the rest of the data still saves.

function missingColumn(message: string): string | null {
  const m =
    message.match(/Could not find the '([^']+)' column/i) ||
    message.match(/column "([^"]+)"[^"]*does not exist/i) ||
    message.match(/column ([a-zA-Z0-9_.]+) does not exist/i)
  if (!m) return null
  const col = m[1]
  return col.includes('.') ? col.split('.').pop()! : col
}

async function insertRow(
  table: string,
  data: object,
  label: string
): Promise<unknown> {
  if (!supabase) return null
  const payload: Record<string, unknown> = { ...data }
  for (let attempt = 0; attempt < 6; attempt++) {
    const { data: row, error } = await supabase.from(table).insert(payload).select().single()
    if (!error) return row
    const col = missingColumn(error.message)
    if (col && col in payload) {
      delete payload[col]
      continue
    }
    reportSyncError(`${label} was not saved to the database`, error.message)
    return null
  }
  reportSyncError(`${label} was not saved to the database`, 'too many unknown columns — run the latest supabase migrations')
  return null
}

async function updateRow(
  table: string,
  id: string,
  data: object,
  label: string
): Promise<boolean> {
  if (!supabase) return false
  const payload: Record<string, unknown> = { ...data }
  for (let attempt = 0; attempt < 6; attempt++) {
    const { error } = await supabase.from(table).update(payload).eq('id', id)
    if (!error) return true
    const col = missingColumn(error.message)
    if (col && col in payload) {
      delete payload[col]
      continue
    }
    reportSyncError(`${label} changes were not saved to the database`, error.message)
    return false
  }
  reportSyncError(`${label} changes were not saved to the database`, 'too many unknown columns — run the latest supabase migrations')
  return false
}

async function deleteRow(table: string, id: string, label: string): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.from(table).delete().eq('id', id)
  if (error) {
    reportSyncError(`${label} was not deleted from the database`, error.message)
    return false
  }
  return true
}

// ── Row normalizers ──
//
// Rows from a database that predates the newest migration are missing
// the newer columns — fill them with defaults so the UI never sees
// undefined

function normalizeSettings(row: Partial<BuildingSettings> | null): BuildingSettings {
  return { ...DEFAULT_SETTINGS, ...(row ?? {}) }
}

function normalizeApartment(row: Apartment): Apartment {
  return { ...row, building_no: row.building_no ?? 1 }
}

function normalizePayment(row: Payment): Payment {
  return {
    ...row,
    recurring: row.recurring ?? false,
    extra: row.extra ?? false,
    on_dashboard: row.on_dashboard ?? true,
  }
}

function normalizeExpense(row: Expense): Expense {
  return {
    ...row,
    recurring: row.recurring ?? false,
    recurring_interval: row.recurring_interval ?? 1,
    paid: row.paid ?? true,
  }
}

function normalizeHistory(row: YearlyHistory): YearlyHistory {
  return {
    ...row,
    income_cash: row.income_cash ?? 0,
    income_bank: row.income_bank ?? 0,
    expenditure_cash: row.expenditure_cash ?? 0,
    expenditure_bank: row.expenditure_bank ?? 0,
    on_dashboard: row.on_dashboard ?? true,
    expense_breakdown: row.expense_breakdown ?? {},
  }
}

function normalizeTransfer(row: Transfer): Transfer {
  return { ...row, on_dashboard: row.on_dashboard ?? true }
}

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

  // these tables arrive with migrations 3 and 4 — fall back to empty
  // lists so the app keeps working on a database that hasn't run them yet
  const [people, history, transfers] = await Promise.all([
    supabase.from('category_people').select('*').order('name'),
    supabase.from('yearly_history').select('*').order('year'),
    supabase.from('transfers').select('*').order('date', { ascending: false }),
  ])
  if (people.error) console.warn('category_people not available (run supabase-migration-3.sql):', people.error.message)
  if (history.error) console.warn('yearly_history not available (run supabase-migration-3.sql):', history.error.message)
  if (transfers.error) console.warn('transfers not available (run supabase-migration-4.sql):', transfers.error.message)

  return {
    apartments: (apartments.data as Apartment[]).map(normalizeApartment),
    payments: (payments.data as Payment[]).map(normalizePayment),
    expenses: (expenses.data as Expense[]).map(normalizeExpense),
    categories: categories.data as ExpenseCategory[],
    people: people.error ? [] : (people.data as CategoryPerson[]),
    history: history.error ? [] : (history.data as YearlyHistory[]).map(normalizeHistory),
    transfers: transfers.error ? [] : (transfers.data as Transfer[]).map(normalizeTransfer),
    settings: normalizeSettings(settings.data as BuildingSettings),
  }
}

// ── Apartments ──

// inserts include the client-generated id so local state and the
// database always agree on row identity
export async function insertApartment(data: Omit<Apartment, 'created_at'>) {
  const row = await insertRow('apartments', data, `Apartment ${data.unit_number}`)
  return row ? normalizeApartment(row as Apartment) : null
}

export async function updateApartmentRow(apartment: Apartment) {
  const { id, created_at, ...rest } = apartment
  void created_at
  return updateRow('apartments', id, rest, `Apartment ${apartment.unit_number}`)
}

export async function deleteApartmentRow(id: string) {
  return deleteRow('apartments', id, 'Apartment')
}

// ── Payments ──

export async function insertPayment(data: Omit<Payment, 'created_at'>) {
  const row = await insertRow('payments', data, 'Payment')
  return row ? normalizePayment(row as Payment) : null
}

export async function updatePaymentRow(payment: Payment) {
  const { id, created_at, ...rest } = payment
  void created_at
  return updateRow('payments', id, rest, 'Payment')
}

export async function deletePaymentRow(id: string) {
  return deleteRow('payments', id, 'Payment')
}

// ── Expenses ──

export async function insertExpense(data: Omit<Expense, 'created_at'>) {
  const row = await insertRow('expenses', data, 'Expense')
  return row ? normalizeExpense(row as Expense) : null
}

export async function updateExpenseRow(expense: Expense) {
  const { id, created_at, ...rest } = expense
  void created_at
  return updateRow('expenses', id, rest, 'Expense')
}

export async function deleteExpenseRow(id: string) {
  return deleteRow('expenses', id, 'Expense')
}

// ── Categories ──

export async function insertCategory(cat: ExpenseCategory) {
  const row = await insertRow('expense_categories', cat, `Category ${cat.name}`)
  return row ? (row as ExpenseCategory) : null
}

// ── Category people ──

export async function insertPerson(person: CategoryPerson) {
  const row = await insertRow('category_people', person, person.name)
  return row ? (row as CategoryPerson) : null
}

export async function updatePersonRow(person: CategoryPerson) {
  const { id, ...rest } = person
  return updateRow('category_people', id, rest, person.name)
}

export async function deletePersonRow(id: string) {
  return deleteRow('category_people', id, 'Person')
}

// ── Yearly history ──

export async function insertHistory(row: YearlyHistory) {
  const data = await insertRow('yearly_history', row, `Year ${row.year}`)
  return data ? normalizeHistory(data as YearlyHistory) : null
}

export async function updateHistoryRow(row: YearlyHistory) {
  const { id, ...rest } = row
  return updateRow('yearly_history', id, rest, `Year ${row.year}`)
}

export async function deleteHistoryRow(id: string) {
  return deleteRow('yearly_history', id, 'Year')
}

// ── Transfers ──

export async function insertTransfer(data: Omit<Transfer, 'created_at'>) {
  const row = await insertRow('transfers', data, 'Transfer')
  return row ? normalizeTransfer(row as Transfer) : null
}

export async function deleteTransferRow(id: string) {
  return deleteRow('transfers', id, 'Transfer')
}

// ── Settings ──

export async function updateSettingsRow(data: Partial<BuildingSettings>) {
  if (!supabase) return false
  const { id, ...rest } = data
  void id
  const payload: Record<string, unknown> = { ...rest }
  for (let attempt = 0; attempt < 8; attempt++) {
    const { error } = await supabase
      .from('building_settings')
      .update(payload)
      .not('id', 'is', null)
    if (!error) return true
    const col = missingColumn(error.message)
    if (col && col in payload) {
      delete payload[col]
      continue
    }
    reportSyncError('Settings were not saved to the database', error.message)
    return false
  }
  reportSyncError('Settings were not saved to the database', 'too many unknown columns — run the latest supabase migrations')
  return false
}
