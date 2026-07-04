import {
  differenceInDays,
  differenceInMonths,
  addMonths,
  startOfMonth,
  endOfMonth,
  isAfter,
  isBefore,
  addDays,
} from 'date-fns'
import { PAYMENT_INTERVALS } from './constants'
import type {
  Apartment,
  Payment,
  Expense,
  PaymentStatus,
  OccupancyBreakdown,
} from './types'

export function computeNextDueDate(
  apartment: Apartment,
  lastPayment: Payment | null
): string | null {
  if (!lastPayment) return null

  const intervalConfig = PAYMENT_INTERVALS.find(
    (i) => i.value === apartment.payment_interval
  )
  if (!intervalConfig) return null

  const periodEnd = new Date(lastPayment.period_end)
  const nextDue = addMonths(periodEnd, intervalConfig.months)
  return nextDue.toISOString()
}

export function computePaymentStatus(nextDueDate: string | null): PaymentStatus {
  if (!nextDueDate) return 'overdue'

  const now = new Date()
  const dueDate = new Date(nextDueDate)

  if (isBefore(dueDate, now)) return 'overdue'

  const sevenDaysFromNow = addDays(now, 7)
  if (isBefore(dueDate, sevenDaysFromNow)) return 'due_soon'

  return 'paid'
}

export function computeDaysOverdue(nextDueDate: string | null): number {
  if (!nextDueDate) return 0

  const now = new Date()
  const dueDate = new Date(nextDueDate)

  if (isAfter(dueDate, now)) return 0

  return differenceInDays(now, dueDate)
}

export function computeAmountOwed(
  apartment: Apartment,
  lastPayment: Payment | null
): number {
  if (!lastPayment) return apartment.monthly_due_amount

  const now = new Date()
  const periodEnd = new Date(lastPayment.period_end)

  if (isAfter(periodEnd, now)) return 0

  const monthsElapsed = differenceInMonths(now, periodEnd)
  return Math.max(apartment.monthly_due_amount * monthsElapsed, 0)
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
