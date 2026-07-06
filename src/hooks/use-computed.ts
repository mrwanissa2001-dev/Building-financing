'use client'

import { useMemo } from 'react'
import {
  subMonths,
  startOfMonth,
  endOfMonth,
  format,
  parseISO,
  isAfter,
  isBefore,
} from 'date-fns'
import { useStore } from '@/lib/store'
import {
  computeNextDueDate,
  computePaymentStatus,
  computeDaysOverdue,
  computeAmountOwed,
  computeCashOnHand,
  computeBankBalance,
  computeCollectedThisMonth,
  computeSpentThisMonth,
  computeOccupancyBreakdown,
} from '@/lib/computations'
import type {
  ApartmentWithStatus,
  DashboardStats,
  OccupancyBreakdown,
  Payment,
} from '@/lib/types'

function getLastPayment(
  apartmentId: string,
  payments: Payment[]
): Payment | null {
  const aptPayments = payments
    .filter((p) => p.apartment_id === apartmentId)
    .sort(
      (a, b) =>
        new Date(b.period_end).getTime() - new Date(a.period_end).getTime()
    )
  return aptPayments[0] || null
}

function isWithinMonth(dateStr: string, monthStart: Date, monthEnd: Date): boolean {
  const d = parseISO(dateStr)
  return (
    (isAfter(d, monthStart) || d.getTime() === monthStart.getTime()) &&
    (isBefore(d, monthEnd) || d.getTime() === monthEnd.getTime())
  )
}

export function useComputed() {
  const { state } = useStore()
  const { apartments, payments, expenses, categories, settings } = state

  const getAllApartmentsWithStatus = useMemo((): ApartmentWithStatus[] => {
    return apartments.map((apt) => {
      const lastPayment = getLastPayment(apt.id, payments)
      const nextDueDate = computeNextDueDate(apt, lastPayment)
      const paymentStatus = computePaymentStatus(nextDueDate)
      const daysOverdue = computeDaysOverdue(nextDueDate)
      const amountOwed = computeAmountOwed(apt, lastPayment)

      // most recent date_paid across this apartment's payments
      const lastPaidDate = payments
        .filter((p) => p.apartment_id === apt.id)
        .reduce<string | null>(
          (max, p) => (max === null || p.date_paid > max ? p.date_paid : max),
          null
        )

      return {
        ...apt,
        next_due_date: nextDueDate,
        last_payment_date: lastPaidDate,
        payment_status: paymentStatus,
        days_overdue: daysOverdue,
        amount_owed: amountOwed,
      }
    })
  }, [apartments, payments])

  const getApartmentWithStatus = useMemo(() => {
    return (id: string): ApartmentWithStatus | undefined =>
      getAllApartmentsWithStatus.find((a) => a.id === id)
  }, [getAllApartmentsWithStatus])

  const getDashboardStats = useMemo((): DashboardStats => {
    const cashOnHand = computeCashOnHand(payments, expenses)
    const bankBalance = computeBankBalance(payments, expenses)

    return {
      cash_on_hand: cashOnHand,
      bank_balance: bankBalance,
      total_balance: cashOnHand + bankBalance,
      collected_this_month: computeCollectedThisMonth(payments),
      spent_this_month: computeSpentThisMonth(expenses),
    }
  }, [payments, expenses])

  const getOccupancyBreakdown = useMemo((): OccupancyBreakdown => {
    return computeOccupancyBreakdown(apartments, settings.total_apartments)
  }, [apartments, settings.total_apartments])

  const getOverdueAlerts = useMemo((): ApartmentWithStatus[] => {
    return getAllApartmentsWithStatus
      .filter(
        (a) => a.payment_status === 'overdue' || a.payment_status === 'due_soon'
      )
      .sort((a, b) => {
        const priorityA = a.days_overdue * a.amount_owed
        const priorityB = b.days_overdue * b.amount_owed
        return priorityB - priorityA
      })
  }, [getAllApartmentsWithStatus])

  const getMonthlyIncomeExpenses = useMemo(() => {
    return (
      months: number
    ): Array<{ month: string; income: number; expenses: number }> => {
      const now = new Date()
      const result: Array<{
        month: string
        income: number
        expenses: number
      }> = []

      for (let i = months - 1; i >= 0; i--) {
        const monthDate = subMonths(now, i)
        const mStart = startOfMonth(monthDate)
        const mEnd = endOfMonth(monthDate)
        const label = format(monthDate, 'MMM yyyy')

        const income = payments
          .filter((p) => isWithinMonth(p.date_paid, mStart, mEnd))
          .reduce((s, p) => s + p.amount, 0)

        const expenseTotal = expenses
          .filter((e) => isWithinMonth(e.date, mStart, mEnd))
          .reduce((s, e) => s + e.amount, 0)

        result.push({ month: label, income, expenses: expenseTotal })
      }

      return result
    }
  }, [payments, expenses])

  const getExpensesByCategory = useMemo((): Array<{
    category: string
    amount: number
  }> => {
    const categoryMap = new Map<string, number>()

    for (const e of expenses) {
      const cat = categories.find((c) => c.id === e.category_id)
      const name = cat?.name ?? 'other'
      const displayName = name.charAt(0).toUpperCase() + name.slice(1)
      categoryMap.set(
        displayName,
        (categoryMap.get(displayName) ?? 0) + e.amount
      )
    }

    return Array.from(categoryMap.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
  }, [expenses, categories])

  const getRunningBalance = useMemo((): Array<{
    date: string
    balance: number
  }> => {
    const allEvents: Array<{ date: string; delta: number }> = []
    payments.forEach((p) =>
      allEvents.push({ date: p.date_paid, delta: p.amount })
    )
    expenses.forEach((e) =>
      allEvents.push({ date: e.date, delta: -e.amount })
    )
    allEvents.sort((a, b) => a.date.localeCompare(b.date))

    let balance = 0
    return allEvents.map((event) => {
      balance += event.delta
      return { date: event.date, balance }
    })
  }, [payments, expenses])

  const getBudgetVsActual = useMemo((): {
    income: { expected: number; actual: number }
    expenditure: { expected: number; actual: number }
  } => {
    const now = new Date()
    const yearStart = new Date(now.getFullYear(), 0, 1)

    const currentMonth = now.getMonth() + 1
    const proratedIncome =
      (settings.expected_yearly_income / 12) * currentMonth
    const proratedExpenditure =
      (settings.expected_yearly_expenditure / 12) * currentMonth

    const actualIncome = payments
      .filter((p) => {
        const d = parseISO(p.date_paid)
        return (
          isAfter(d, yearStart) || d.getTime() === yearStart.getTime()
        )
      })
      .reduce((s, p) => s + p.amount, 0)

    const actualExpenditure = expenses
      .filter((e) => {
        const d = parseISO(e.date)
        return (
          isAfter(d, yearStart) || d.getTime() === yearStart.getTime()
        )
      })
      .reduce((s, e) => s + e.amount, 0)

    return {
      income: { expected: proratedIncome, actual: actualIncome },
      expenditure: {
        expected: proratedExpenditure,
        actual: actualExpenditure,
      },
    }
  }, [payments, expenses, settings])

  const cashVsBankThisMonth = useMemo(() => {
    const now = new Date()
    const mStart = startOfMonth(now)
    const mEnd = endOfMonth(now)

    const thisMonthPayments = payments.filter((p) =>
      isWithinMonth(p.date_paid, mStart, mEnd)
    )

    return {
      cash: thisMonthPayments
        .filter((p) => p.method === 'cash')
        .reduce((s, p) => s + p.amount, 0),
      bank: thisMonthPayments
        .filter((p) => p.method === 'bank')
        .reduce((s, p) => s + p.amount, 0),
    }
  }, [payments])

  const getPaymentsForApartment = useMemo(() => {
    return (id: string) =>
      payments
        .filter((p) => p.apartment_id === id)
        .sort(
          (a, b) =>
            new Date(b.date_paid).getTime() - new Date(a.date_paid).getTime()
        )
  }, [payments])

  return {
    getApartmentWithStatus,
    getAllApartmentsWithStatus,
    apartmentsWithStatus: getAllApartmentsWithStatus,
    getDashboardStats,
    dashboardStats: getDashboardStats,
    getOccupancyBreakdown,
    occupancyBreakdown: getOccupancyBreakdown,
    getOverdueAlerts,
    overdueAlerts: getOverdueAlerts,
    getMonthlyIncomeExpenses,
    monthlyIncomeExpenses: getMonthlyIncomeExpenses(12),
    getExpensesByCategory,
    expensesByCategory: getExpensesByCategory,
    getRunningBalance,
    runningBalance: getRunningBalance,
    getBudgetVsActual,
    budgetVsActual: getBudgetVsActual,
    cashVsBankThisMonth,
    getPaymentsForApartment,
  }
}
