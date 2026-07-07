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
  computeCoverage,
  computeMonthCell,
  computeCashOnHand,
  computeBankBalance,
  computeCollectedThisMonth,
  computeSpentThisMonth,
  computeOccupancyBreakdown,
  type ApartmentCoverage,
  type MonthCellStatus,
} from '@/lib/computations'
import type {
  ApartmentWithStatus,
  DashboardStats,
  OccupancyBreakdown,
} from '@/lib/types'

function isWithinMonth(dateStr: string, monthStart: Date, monthEnd: Date): boolean {
  const d = parseISO(dateStr)
  return (
    (isAfter(d, monthStart) || d.getTime() === monthStart.getTime()) &&
    (isBefore(d, monthEnd) || d.getTime() === monthEnd.getTime())
  )
}

export function useComputed() {
  const { state } = useStore()
  const { apartments, payments, expenses, categories, settings, transfers, history } = state

  // payments flagged off the dashboard stay in the books (apartment
  // history, logs) but out of every dashboard number
  const dashPayments = useMemo(
    () => payments.filter((p) => p.on_dashboard !== false),
    [payments]
  )

  // money-based month coverage per apartment
  const coverageByApartment = useMemo((): Map<string, ApartmentCoverage> => {
    const map = new Map<string, ApartmentCoverage>()
    for (const apt of apartments) {
      const aptPayments = payments.filter((p) => p.apartment_id === apt.id)
      map.set(apt.id, computeCoverage(apt, aptPayments))
    }
    return map
  }, [apartments, payments])

  const getAllApartmentsWithStatus = useMemo((): ApartmentWithStatus[] => {
    return apartments.map((apt) => {
      const cov = coverageByApartment.get(apt.id)!
      return {
        ...apt,
        last_paid_month: cov.lastPaidMonth,
        next_unpaid_month: cov.nextUnpaidMonth,
        payment_status: cov.status,
        days_overdue: cov.daysOverdue,
        amount_owed: cov.amountOwed,
        total_paid: cov.totalPaid,
      }
    })
  }, [apartments, coverageByApartment])

  // 12 cell states (Jan..Dec) for one apartment in one year — drives the
  // visual month grid
  const getMonthCells = useMemo(() => {
    return (apartmentId: string, year: number): MonthCellStatus[] => {
      const cov = coverageByApartment.get(apartmentId)
      if (!cov) return Array(12).fill('na')
      return Array.from({ length: 12 }, (_, i) => {
        const key = `${year}-${String(i + 1).padStart(2, '0')}`
        return computeMonthCell(cov, key)
      })
    }
  }, [coverageByApartment])

  const getCoverage = useMemo(() => {
    return (apartmentId: string): ApartmentCoverage | undefined =>
      coverageByApartment.get(apartmentId)
  }, [coverageByApartment])

  const getApartmentWithStatus = useMemo(() => {
    return (id: string): ApartmentWithStatus | undefined =>
      getAllApartmentsWithStatus.find((a) => a.id === id)
  }, [getAllApartmentsWithStatus])

  const getDashboardStats = useMemo((): DashboardStats => {
    const cashOnHand = computeCashOnHand(dashPayments, expenses, transfers, history)
    const bankBalance = computeBankBalance(dashPayments, expenses, transfers, history)

    return {
      cash_on_hand: cashOnHand,
      bank_balance: bankBalance,
      total_balance: cashOnHand + bankBalance,
      collected_this_month: computeCollectedThisMonth(dashPayments),
      spent_this_month: computeSpentThisMonth(expenses),
    }
  }, [dashPayments, expenses, transfers, history])

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

        const income = dashPayments
          .filter((p) => isWithinMonth(p.date_paid, mStart, mEnd))
          .reduce((s, p) => s + p.amount, 0)

        const expenseTotal = expenses
          .filter((e) => isWithinMonth(e.date, mStart, mEnd))
          .reduce((s, e) => s + e.amount, 0)

        result.push({ month: label, income, expenses: expenseTotal })
      }

      return result
    }
  }, [dashPayments, expenses])

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
    dashPayments.forEach((p) =>
      allEvents.push({ date: p.date_paid, delta: p.amount })
    )
    expenses.forEach((e) =>
      allEvents.push({ date: e.date, delta: -e.amount })
    )
    allEvents.sort((a, b) => a.date.localeCompare(b.date))

    // migrated prior years seed the starting balance through their
    // cash/bank splits — the same amounts the balance cards carry
    let balance = history.reduce(
      (s, h) =>
        s +
        (h.income_cash ?? 0) +
        (h.income_bank ?? 0) -
        (h.expenditure_cash ?? 0) -
        (h.expenditure_bank ?? 0),
      0
    )
    return allEvents.map((event) => {
      balance += event.delta
      return { date: event.date, balance }
    })
  }, [dashPayments, expenses, history])

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

    const actualIncome = dashPayments
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
  }, [dashPayments, expenses, settings])

  const cashVsBankThisMonth = useMemo(() => {
    const now = new Date()
    const mStart = startOfMonth(now)
    const mEnd = endOfMonth(now)

    const thisMonthPayments = dashPayments.filter((p) =>
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
  }, [dashPayments])

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
    dashboardPayments: dashPayments,
    getApartmentWithStatus,
    getAllApartmentsWithStatus,
    apartmentsWithStatus: getAllApartmentsWithStatus,
    getMonthCells,
    getCoverage,
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
