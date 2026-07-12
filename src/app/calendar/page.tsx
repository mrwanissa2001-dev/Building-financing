"use client"

import { useState, useMemo } from "react"
import { useStore } from "@/lib/store"
import { useI18n } from "@/lib/i18n"
import { cn, formatCurrency } from "@/lib/utils"
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  addMonths,
  subMonths,
  isToday,
} from "date-fns"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react"
import type { Payment, Expense, Transfer } from "@/lib/types"

type CalendarEntry =
  | { type: "payment"; data: Payment }
  | { type: "expense"; data: Expense }
  | { type: "transfer"; data: Transfer }

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export default function CalendarPage() {
  const { state } = useStore()
  const { t } = useI18n()

  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [showPayments, setShowPayments] = useState(true)
  const [showExpenses, setShowExpenses] = useState(true)
  const [showTransfers, setShowTransfers] = useState(true)

  // Calendar grid: Sun–Sat rows covering the full displayed month
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(currentDate)
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 })
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
    return eachDayOfInterval({ start: gridStart, end: gridEnd })
  }, [currentDate])

  // Map from "yyyy-MM-dd" → entries (filtered by visible types)
  const entriesByDate = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>()

    const push = (dateStr: string, entry: CalendarEntry) => {
      const list = map.get(dateStr)
      if (list) {
        list.push(entry)
      } else {
        map.set(dateStr, [entry])
      }
    }

    if (showPayments) {
      for (const p of state.payments) push(p.date_paid, { type: "payment", data: p })
    }
    if (showExpenses) {
      for (const e of state.expenses) push(e.date, { type: "expense", data: e })
    }
    if (showTransfers) {
      for (const tr of state.transfers) push(tr.date, { type: "transfer", data: tr })
    }

    return map
  }, [state.payments, state.expenses, state.transfers, showPayments, showExpenses, showTransfers])

  // Entries for the selected day dialog
  const selectedDayEntries = useMemo(() => {
    if (!selectedDay) return []
    return entriesByDate.get(format(selectedDay, "yyyy-MM-dd")) ?? []
  }, [selectedDay, entriesByDate])

  const goToPrevMonth = () => setCurrentDate((d) => subMonths(d, 1))
  const goToNextMonth = () => setCurrentDate((d) => addMonths(d, 1))
  const goToToday = () => setCurrentDate(new Date())

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      {/* Page header + filter toggles */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-semibold">{t("Calendar")}</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={showPayments ? "default" : "outline"}
            size="sm"
            onClick={() => setShowPayments((v) => !v)}
            className="gap-1.5 text-xs"
          >
            <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-green-500" />
            {t("Payments")}
          </Button>
          <Button
            variant={showExpenses ? "default" : "outline"}
            size="sm"
            onClick={() => setShowExpenses((v) => !v)}
            className="gap-1.5 text-xs"
          >
            <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-red-500" />
            {t("Expenses")}
          </Button>
          <Button
            variant={showTransfers ? "default" : "outline"}
            size="sm"
            onClick={() => setShowTransfers((v) => !v)}
            className="gap-1.5 text-xs"
          >
            <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-blue-500" />
            {t("Transfers")}
          </Button>
        </div>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="icon" onClick={goToPrevMonth} aria-label={t("Previous month")}>
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold">{format(currentDate, "MMMM yyyy")}</h2>
          <Button variant="outline" size="sm" onClick={goToToday}>
            {t("Today")}
          </Button>
        </div>

        <Button variant="outline" size="icon" onClick={goToNextMonth} aria-label={t("Next month")}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Calendar grid */}
      <div className="overflow-hidden rounded-lg border border-border">
        {/* Weekday header row */}
        <div className="grid grid-cols-7 bg-muted">
          {DAY_NAMES.map((day) => (
            <div key={day} className="p-2 text-center text-xs font-medium text-muted-foreground">
              {day}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day) => {
            const dateStr = format(day, "yyyy-MM-dd")
            const entries = entriesByDate.get(dateStr) ?? []
            const inCurrentMonth = isSameMonth(day, currentDate)
            const todayCell = isToday(day)
            const hasEntries = entries.length > 0 && inCurrentMonth

            const paymentCount = entries.filter((e) => e.type === "payment").length
            const expenseCount = entries.filter((e) => e.type === "expense").length
            const transferCount = entries.filter((e) => e.type === "transfer").length
            const totalAmount = entries.reduce((sum, e) => sum + e.data.amount, 0)

            return (
              <div
                key={dateStr}
                role={hasEntries ? "button" : undefined}
                tabIndex={hasEntries ? 0 : undefined}
                onClick={() => hasEntries && setSelectedDay(day)}
                onKeyDown={(e) => {
                  if (hasEntries && (e.key === "Enter" || e.key === " ")) setSelectedDay(day)
                }}
                className={cn(
                  "min-h-[76px] border-t border-r border-border p-1.5 transition-colors",
                  inCurrentMonth ? "bg-background" : "bg-muted/30",
                  hasEntries && "cursor-pointer hover:bg-accent",
                  todayCell && "ring-2 ring-inset ring-primary"
                )}
              >
                {/* Day number */}
                <div
                  className={cn(
                    "mb-1 text-sm font-medium leading-none",
                    !inCurrentMonth && "text-muted-foreground",
                    todayCell && "font-bold text-primary"
                  )}
                >
                  {format(day, "d")}
                </div>

                {/* Transaction indicators */}
                {hasEntries && (
                  <div className="space-y-0.5">
                    <div className="flex flex-wrap gap-0.5">
                      {paymentCount > 0 && (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-green-500" />
                      )}
                      {expenseCount > 0 && (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" />
                      )}
                      {transferCount > 0 && (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                      )}
                    </div>
                    <div className="text-[10px] leading-tight text-muted-foreground">
                      {formatCurrency(totalAmount)}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Day detail dialog */}
      <Dialog open={!!selectedDay} onOpenChange={(open) => !open && setSelectedDay(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedDay &&
                t("All transactions on {date}", {
                  date: format(selectedDay, "MMMM d, yyyy"),
                })}
            </DialogTitle>
          </DialogHeader>

          <div className="mt-2 space-y-2">
            {selectedDayEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("No transactions on this day.")}</p>
            ) : (
              selectedDayEntries.map((entry, i) => (
                <div
                  key={i}
                  className="flex items-start justify-between gap-3 rounded-lg border border-border p-3"
                >
                  <div className="min-w-0 space-y-1">
                    {/* Type badge + method */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {entry.type === "payment" && (
                        <Badge className="bg-green-500 text-white hover:bg-green-600">
                          {t("Payment")}
                        </Badge>
                      )}
                      {entry.type === "expense" && (
                        <Badge variant="destructive">{t("Expense")}</Badge>
                      )}
                      {entry.type === "transfer" && (
                        <Badge variant="secondary">{t("Transfers")}</Badge>
                      )}

                      {entry.type !== "transfer" && (
                        <span className="text-xs text-muted-foreground">
                          {t(entry.data.method === "cash" ? "Cash" : "Bank")}
                        </span>
                      )}
                      {entry.type === "transfer" && (
                        <span className="text-xs text-muted-foreground">
                          {t(entry.data.from_method === "cash" ? "Cash" : "Bank")}
                          {" → "}
                          {t(entry.data.to_method === "cash" ? "Cash" : "Bank")}
                        </span>
                      )}
                    </div>

                    {/* Description */}
                    {entry.type === "payment" && entry.data.payer_name && (
                      <p className="truncate text-sm">{entry.data.payer_name}</p>
                    )}
                    {entry.type === "expense" && entry.data.vendor && (
                      <p className="truncate text-sm">{entry.data.vendor}</p>
                    )}

                    {/* Notes */}
                    {entry.data.notes && (
                      <p className="truncate text-xs text-muted-foreground">{entry.data.notes}</p>
                    )}
                  </div>

                  <div className="shrink-0 text-sm font-semibold">
                    {formatCurrency(entry.data.amount)}
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
