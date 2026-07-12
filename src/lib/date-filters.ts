import { parseISO, isWithinInterval, startOfDay, endOfDay } from "date-fns"
import type { DateRange } from "@/components/ui/date-range-picker"
import type { Payment, Transfer, Expense } from "@/lib/types"

/**
 * Returns true if dateStr (YYYY-MM-DD) falls within the range (inclusive).
 * Empty start/end = open (all time).
 */
export function dateInRange(dateStr: string, range: DateRange): boolean {
  // If no date string, exclude it
  if (!dateStr) return false

  // If both range boundaries are empty, include all
  if (!range.start && !range.end) return true

  // Parse the date string
  const date = parseISO(dateStr)
  if (isNaN(date.getTime())) return false

  // Only start is set: date must be on or after start
  if (range.start && !range.end) {
    const start = parseISO(range.start)
    return isNaN(start.getTime()) ? false : dateStr >= range.start
  }

  // Only end is set: date must be on or before end
  if (!range.start && range.end) {
    const end = parseISO(range.end)
    return isNaN(end.getTime()) ? false : dateStr <= range.end
  }

  // Both are set: date must be within the interval (inclusive)
  if (range.start && range.end) {
    const start = parseISO(range.start)
    const end = parseISO(range.end)

    if (isNaN(start.getTime()) || isNaN(end.getTime())) return false

    return isWithinInterval(date, {
      start: startOfDay(start),
      end: endOfDay(end),
    })
  }

  return false
}

/**
 * Filter any array of objects where obj[dateField] is a "YYYY-MM-DD" string
 */
export function filterByDateRange<T>(
  items: T[],
  dateField: keyof T,
  range: DateRange
): T[] {
  return items.filter((item) => {
    const dateValue = item[dateField]
    if (typeof dateValue !== "string") return false
    return dateInRange(dateValue, range)
  })
}

/**
 * Convenience wrapper for filtering payments by date_paid
 */
export function filterPaymentsByRange(
  payments: Payment[],
  range: DateRange
): Payment[] {
  return filterByDateRange(payments, "date_paid" as keyof Payment, range)
}

/**
 * Convenience wrapper for filtering expenses by date
 */
export function filterExpensesByRange(
  expenses: Expense[],
  range: DateRange
): Expense[] {
  return filterByDateRange(expenses, "date" as keyof Expense, range)
}

/**
 * Convenience wrapper for filtering transfers by date
 */
export function filterTransfersByRange(
  transfers: Transfer[],
  range: DateRange
): Transfer[] {
  return filterByDateRange(transfers, "date" as keyof Transfer, range)
}
