"use client"

import { useMemo, useState } from "react"
import { useStore } from "@/lib/store"
import { useI18n } from "@/lib/i18n"
import { formatCurrency } from "@/lib/utils"
import {
  filterPaymentsByRange,
  filterExpensesByRange,
  filterTransfersByRange,
} from "@/lib/date-filters"
import {
  DateRangePicker,
  type DateRange,
} from "@/components/ui/date-range-picker"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  FileText,
  TrendingUp,
  TrendingDown,
  Scale,
  LayoutGrid,
  type LucideIcon,
} from "lucide-react"
import type { GenerateReportOptions } from "@/lib/report-generation"

type ReportType = GenerateReportOptions["type"]

interface ReportCardDef {
  type: ReportType
  // English base string — passed verbatim to the PDF so its labels stay in
  // a font-safe script, and run through t() for the on-screen card
  title: string
  description: string
  icon: LucideIcon
}

const REPORT_CARDS: ReportCardDef[] = [
  {
    type: "income",
    title: "Income Summary",
    description: "Total collected in the selected period",
    icon: TrendingUp,
  },
  {
    type: "expense",
    title: "Expense Summary",
    description: "All expenses by category",
    icon: TrendingDown,
  },
  {
    type: "balance",
    title: "Balance Statement",
    description: "Cash vs bank, net position",
    icon: Scale,
  },
  {
    type: "collections",
    title: "Collections Overview",
    description: "Payment status per apartment",
    icon: LayoutGrid,
  },
]

export default function ReportsPage() {
  const { state } = useStore()
  const { t, lang } = useI18n()

  const [range, setRange] = useState<DateRange>({ start: "", end: "" })

  // preview stats for the selected range — totals only, no full tables
  const stats = useMemo(() => {
    const payments = filterPaymentsByRange(state.payments, range)
    const expenses = filterExpensesByRange(state.expenses, range)
    const transfers = filterTransfersByRange(state.transfers, range)

    const collected = payments.reduce((s, p) => s + p.amount, 0)
    const spent = expenses
      .filter((e) => e.paid !== false)
      .reduce((s, e) => s + e.amount, 0)
    const units = new Set(payments.map((p) => p.apartment_id)).size

    return {
      collected,
      spent,
      net: collected - spent,
      paymentsCount: payments.length,
      expensesCount: expenses.length,
      transfersCount: transfers.length,
      units,
    }
  }, [state.payments, state.expenses, state.transfers, range])

  function handleGenerate(card: ReportCardDef) {
    // jsPDF is browser-only: import the generator (which itself lazy-loads
    // jsPDF) on click so nothing PDF-related lands in the initial bundle
    import("@/lib/report-generation").then(({ generateReport }) => {
      generateReport({
        type: card.type,
        title: card.title, // English label — safe for jsPDF's default font
        dateRange: range,
        payments: state.payments,
        expenses: state.expenses,
        transfers: state.transfers,
        categories: state.categories,
        apartments: state.apartments,
        buildingName: state.settings.building_name,
        lang,
      })
    })
  }

  if (!state.loaded) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">{t("Loading...")}</p>
      </div>
    )
  }

  const previewTiles: { label: string; value: string; className?: string }[] = [
    { label: t("Total collected"), value: formatCurrency(stats.collected), className: "text-emerald-600 dark:text-emerald-400" },
    { label: t("Total spent"), value: formatCurrency(stats.spent), className: "text-red-600 dark:text-red-400" },
    { label: t("Net"), value: formatCurrency(stats.net) },
    { label: t("Payments"), value: String(stats.paymentsCount) },
    { label: t("Expenses"), value: String(stats.expensesCount) },
    { label: t("Transfers"), value: String(stats.transfersCount) },
  ]

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <FileText className="h-6 w-6 text-primary" />
            {t("Reports")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("Generate PDF reports for any date range.")}
          </p>
        </div>
        <div className="flex flex-col items-start gap-1 sm:items-end">
          <DateRangePicker value={range} onChange={setRange} />
          <p className="text-xs text-muted-foreground">
            {t("Select a date range to generate a report.")}
          </p>
        </div>
      </div>

      {/* Report type cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {REPORT_CARDS.map((card) => {
          const Icon = card.icon
          return (
            <Card key={card.type} className="flex flex-col">
              <CardHeader className="flex-1">
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <CardTitle>{t(card.title)}</CardTitle>
                <CardDescription>{t(card.description)}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" onClick={() => handleGenerate(card)}>
                  <FileText className="h-4 w-4" />
                  {t("Generate PDF")}
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Preview — key stats for the selected range */}
      <Card>
        <CardHeader>
          <CardTitle>{t("Preview")}</CardTitle>
          <CardDescription>
            {t("Key totals for the selected range — {units} units paid.", {
              units: stats.units,
            })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {previewTiles.map((tile) => (
              <div
                key={tile.label}
                className="rounded-xl border border-border/70 p-4"
              >
                <p className="text-xs text-muted-foreground">{tile.label}</p>
                <p
                  className={`mt-1 text-lg font-bold tabular-nums ${
                    tile.className ?? ""
                  }`}
                >
                  {tile.value}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
