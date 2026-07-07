import {
  monthKey,
  monthKeyOrNull,
  currentMonthKey,
  addMonthsToKey,
  monthsBetween,
  firstDayOfMonth,
} from './months'
import type {
  Apartment,
  Payment,
  Expense,
  Transfer,
  YearlyHistory,
  PaymentStatus,
  OccupancyBreakdown,
} from './types'

// ── Month coverage engine ──
//
// Everything is derived from money actually received, never from what a
// payment claims to cover. Coverage starts at the earliest month any
// payment refers to (fallback: the month the apartment was added) and
// advances one month for every full monthly_due_amount received. A
// payment of 500 against a due of 1000 covers nothing until the other
// 500 arrives — partial payments can never mark a month as paid.

export interface ApartmentCoverage {
  // first tracked month, null when no monthly due is configured
  startKey: string | null
  totalPaid: number
  // whole months covered by the money received
  fullMonthsPaid: number
  // last fully covered month (can be in the future when paid in advance)
  lastPaidMonth: string | null
  // the month the next payment refers to
  nextUnpaidMonth: string | null
  amountOwed: number
  status: PaymentStatus
  daysOverdue: number
}

export function computeCoverage(
  apartment: Apartment,
  allPayments: Payment[],
  now: Date = new Date()
): ApartmentCoverage {
  // extra payments (settling old, untracked dues) never advance the
  // month coverage
  const payments = allPayments.filter((p) => !p.extra)
  const due = apartment.monthly_due_amount
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0)

  if (!due || due <= 0) {
    // no monthly due configured — nothing is owed, nothing is tracked
    return {
      startKey: null,
      totalPaid,
      fullMonthsPaid: 0,
      lastPaidMonth: null,
      nextUnpaidMonth: null,
      amountOwed: 0,
      status: 'paid',
      daysOverdue: 0,
    }
  }

  // earliest month any payment refers to; fallback to the month the
  // apartment was registered
  let startKey: string | null = null
  for (const p of payments) {
    const k = monthKeyOrNull(p.period_start)
    if (k !== null && (startKey === null || k < startKey)) startKey = k
  }
  if (startKey === null) {
    startKey = monthKeyOrNull(apartment.created_at) ?? monthKey(now)
  }

  const currentKey = monthKey(now)
  const fullMonthsPaid = Math.floor(totalPaid / due)
  // months owed so far: start month through the current month
  const monthsDueSoFar = Math.max(0, monthsBetween(startKey, currentKey) + 1)
  const amountOwed = Math.max(0, monthsDueSoFar * due - totalPaid)

  const lastPaidMonth =
    fullMonthsPaid > 0 ? addMonthsToKey(startKey, fullMonthsPaid - 1) : null
  const nextUnpaidMonth = addMonthsToKey(startKey, fullMonthsPaid)

  let status: PaymentStatus
  if (amountOwed <= 0) {
    status = 'paid'
  } else if (fullMonthsPaid >= monthsDueSoFar - 1) {
    // only the current month is outstanding (fully or partially)
    status = 'due_soon'
  } else {
    status = 'overdue'
  }

  let daysOverdue = 0
  if (status === 'overdue') {
    const firstUnpaid = new Date(firstDayOfMonth(nextUnpaidMonth))
    daysOverdue = Math.max(
      0,
      Math.floor((now.getTime() - firstUnpaid.getTime()) / 86_400_000)
    )
  }

  return {
    startKey,
    totalPaid,
    fullMonthsPaid,
    lastPaidMonth,
    nextUnpaidMonth,
    amountOwed,
    status,
    daysOverdue,
  }
}

// Cell state for the visual month grid
export type MonthCellStatus = 'paid' | 'due' | 'future' | 'na'

export function computeMonthCell(
  coverage: ApartmentCoverage,
  key: string,
  now: Date = new Date()
): MonthCellStatus {
  if (!coverage.startKey) return 'na'
  if (key < coverage.startKey) return 'na'
  if (coverage.lastPaidMonth && key <= coverage.lastPaidMonth) return 'paid'
  if (key <= monthKey(now)) return 'due'
  return 'future'
}

// Cash and bank balances: everything received minus everything spent
// per method, moved by transfers, plus what migrated prior years carry
// in via their cash/bank splits
export function computeBalance(
  method: 'cash' | 'bank',
  payments: Payment[],
  expenses: Expense[],
  transfers: Transfer[] = [],
  history: YearlyHistory[] = []
): number {
  const moneyIn = payments
    .filter((p) => p.method === method)
    .reduce((sum, p) => sum + p.amount, 0)

  const moneyOut = expenses
    .filter((e) => e.method === method)
    .reduce((sum, e) => sum + e.amount, 0)

  const transferred = transfers.reduce((sum, t) => {
    if (t.to_method === method && t.from_method !== method) return sum + t.amount
    if (t.from_method === method && t.to_method !== method) return sum - t.amount
    return sum
  }, 0)

  const carried = history.reduce(
    (sum, h) =>
      method === 'cash'
        ? sum + (h.income_cash ?? 0) - (h.expenditure_cash ?? 0)
        : sum + (h.income_bank ?? 0) - (h.expenditure_bank ?? 0),
    0
  )

  return moneyIn - moneyOut + transferred + carried
}

export function computeCashOnHand(
  payments: Payment[],
  expenses: Expense[],
  transfers: Transfer[] = [],
  history: YearlyHistory[] = []
): number {
  return computeBalance('cash', payments, expenses, transfers, history)
}

export function computeBankBalance(
  payments: Payment[],
  expenses: Expense[],
  transfers: Transfer[] = [],
  history: YearlyHistory[] = []
): number {
  return computeBalance('bank', payments, expenses, transfers, history)
}

// month checks compare the date strings directly ('YYYY-MM-DD') so a
// payment logged on the 1st never slips into the previous month through
// timezone conversion
export function computeCollectedThisMonth(payments: Payment[]): number {
  const nowKey = currentMonthKey()
  return payments
    .filter((p) => monthKeyOrNull(p.date_paid) === nowKey)
    .reduce((sum, p) => sum + p.amount, 0)
}

export function computeSpentThisMonth(expenses: Expense[]): number {
  const nowKey = currentMonthKey()
  return expenses
    .filter((e) => monthKeyOrNull(e.date) === nowKey)
    .reduce((sum, e) => sum + e.amount, 0)
}

export function computeOccupancyBreakdown(
  apartments: Apartment[],
  totalApartments: number
): OccupancyBreakdown {
  const active = apartments.filter((a) => a.occupancy_status === 'active').length
  const mia = apartments.filter((a) => a.occupancy_status === 'mia').length
  const travelingButPaying = apartments.filter(
    (a) => a.occupancy_status === 'traveling_but_paying'
  ).length

  const registeredCount = apartments.length
  const unregistered = Math.max(totalApartments - registeredCount, 0)

  return {
    active,
    mia,
    traveling_but_paying: travelingButPaying,
    unregistered,
  }
}
