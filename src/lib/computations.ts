import { startOfMonth, endOfMonth, isAfter, isBefore } from 'date-fns'
import {
  monthKey,
  monthKeyOrNull,
  addMonthsToKey,
  monthsBetween,
  firstDayOfMonth,
} from './months'
import type {
  Apartment,
  Payment,
  Expense,
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
  payments: Payment[],
  now: Date = new Date()
): ApartmentCoverage {
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

export function computeCashOnHand(
  payments: Payment[],
  expenses: Expense[]
): number {
  const cashIn = payments
    .filter((p) => p.method === 'cash')
    .reduce((sum, p) => sum + p.amount, 0)

  const cashOut = expenses
    .filter((e) => e.method === 'cash')
    .reduce((sum, e) => sum + e.amount, 0)

  return cashIn - cashOut
}

export function computeBankBalance(
  payments: Payment[],
  expenses: Expense[]
): number {
  const bankIn = payments
    .filter((p) => p.method === 'bank')
    .reduce((sum, p) => sum + p.amount, 0)

  const bankOut = expenses
    .filter((e) => e.method === 'bank')
    .reduce((sum, e) => sum + e.amount, 0)

  return bankIn - bankOut
}

export function computeCollectedThisMonth(payments: Payment[]): number {
  const now = new Date()
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)

  return payments
    .filter((p) => {
      const datePaid = new Date(p.date_paid)
      return (
        (isAfter(datePaid, monthStart) || datePaid.getTime() === monthStart.getTime()) &&
        (isBefore(datePaid, monthEnd) || datePaid.getTime() === monthEnd.getTime())
      )
    })
    .reduce((sum, p) => sum + p.amount, 0)
}

export function computeSpentThisMonth(expenses: Expense[]): number {
  const now = new Date()
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)

  return expenses
    .filter((e) => {
      const expenseDate = new Date(e.date)
      return (
        (isAfter(expenseDate, monthStart) || expenseDate.getTime() === monthStart.getTime()) &&
        (isBefore(expenseDate, monthEnd) || expenseDate.getTime() === monthEnd.getTime())
      )
    })
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
