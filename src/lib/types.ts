// ── Database table types ──

export type PaymentInterval = 'monthly' | 'bimonthly' | 'quarterly' | 'biannual' | 'annual'

export type OccupancyStatus = 'active' | 'mia' | 'traveling_but_paying'

export type PaymentMethod = 'cash' | 'bank'

export type PaymentStatus = 'paid' | 'due_soon' | 'overdue'

export type PayerRelation = '' | 'father' | 'mother' | 'sister' | 'brother' | 'son' | 'daughter' | 'friend' | 'other'

// floor is 'M1' | 'M2' (mezzanine) or '1'..'13'
export interface Apartment {
  id: string
  unit_number: string
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
// last covered month
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
  notes: string
  created_at: string
}

export interface Expense {
  id: string
  category_id: string
  amount: number
  method: PaymentMethod
  date: string
  vendor: string
  recurring: boolean
  notes: string
  created_at: string
}

export interface ExpenseCategory {
  id: string
  name: string
}

export interface BuildingSettings {
  id: string
  total_apartments: number
  expected_yearly_income: number
  expected_yearly_expenditure: number
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
