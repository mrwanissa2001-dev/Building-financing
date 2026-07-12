// ── Database table types ──

export type PaymentInterval = 'monthly' | 'bimonthly' | 'quarterly' | 'biannual' | 'annual'

export type OccupancyStatus = 'active' | 'mia' | 'traveling_but_paying'

export type PaymentMethod = 'cash' | 'bank'

export type PaymentStatus = 'paid' | 'due_soon' | 'overdue'

// Built-in relations are suggested in the dropdown, but any custom relation
// typed via the "Add relation…" flow is stored verbatim and reused later.
export type PayerRelation = string

// floor is 'M1' | 'M2' (mezzanine) or '1'..'13'
export interface Apartment {
  id: string
  unit_number: string
  building_no: number
  floor: string
  primary_resident_name: string
  secondary_resident_name: string
  phone: string
  phone2: string
  email: string
  payment_interval: PaymentInterval
  monthly_due_amount: number
  occupancy_status: OccupancyStatus
  notes: string
  created_at: string
}

// period_start/period_end carry the covered months: period_start is the
// first day of the first covered month, period_end the last day of the
// last covered month.
// extra marks money that does not advance the month coverage (e.g. a
// resident settling last year's dues); on_dashboard = false keeps a
// payment out of every dashboard number.
export interface Payment {
  id: string
  apartment_id: string
  payer_name: string
  payer_relation: PayerRelation
  amount: number
  method: PaymentMethod
  date_paid: string
  period_start: string
  period_end: string
  recurring: boolean
  extra: boolean
  on_dashboard: boolean
  notes: string
  created_at: string
}

// Money moved between the cash box and the bank account.
// on_dashboard = false records the transfer for reference without
// shifting the dashboard's Cash on Hand / Bank Balance.
export interface Transfer {
  id: string
  amount: number
  from_method: PaymentMethod
  to_method: PaymentMethod
  date: string
  notes: string
  on_dashboard: boolean
  created_at: string
}

// recurring_interval is the number of months between occurrences of a
// recurring expense (1 = monthly, 3 = quarterly, ...); ignored when
// recurring is false.
// paid = false marks a logged-but-unpaid expense (a bill still owed): it
// stays in the log but is kept out of every dashboard money total and
// shows as "not paid" in the recurring grid.
export interface Expense {
  id: string
  category_id: string
  amount: number
  method: PaymentMethod
  date: string
  vendor: string
  recurring: boolean
  recurring_interval: number
  paid: boolean
  notes: string
  created_at: string
}

export interface ExpenseCategory {
  id: string
  name: string
}

// A person who works under an expense category (e.g. the security
// guards) — selectable as the vendor when adding an expense
export interface CategoryPerson {
  id: string
  category_id: string
  name: string
}

// One migrated prior year: totals only, with an optional percentage
// breakdown of the expenditure keyed by category name. The cash/bank
// splits are optional; when set they carry the year's money into the
// dashboard's Cash on Hand / Bank Balance.
// on_dashboard = false keeps the year record-only — its cash/bank splits
// never touch the dashboard balances.
export interface YearlyHistory {
  id: string
  year: number
  income: number
  expenditure: number
  income_cash: number
  income_bank: number
  expenditure_cash: number
  expenditure_bank: number
  on_dashboard: boolean
  expense_breakdown: Record<string, number>
}

// num_floors counts the numbered floors (1..N); mezzanine_floors adds
// M1..Mn before them. apartments_per_floor 0 = no limit enforced.
export interface BuildingSettings {
  id: string
  building_name: string
  total_apartments: number
  expected_yearly_income: number
  expected_yearly_expenditure: number
  num_buildings: number
  num_floors: number
  mezzanine_floors: number
  apartments_per_floor: number
}

// ── Computed types ──

// last_paid_month / next_unpaid_month are 'YYYY-MM' month keys derived
// from money actually received (not from what payments claim to cover)
export interface ApartmentWithStatus extends Apartment {
  last_paid_month: string | null
  next_unpaid_month: string | null
  payment_status: PaymentStatus
  days_overdue: number
  amount_owed: number
  total_paid: number
}

export interface DashboardStats {
  cash_on_hand: number
  bank_balance: number
  total_balance: number
  collected_this_month: number
  spent_this_month: number
}

export interface OccupancyBreakdown {
  active: number
  mia: number
  traveling_but_paying: number
  unregistered: number
}
