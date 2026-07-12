// PDF report generation for BuildFin.
//
// jsPDF is loaded dynamically (client-side only) — it depends on the DOM
// and must never run during SSR. The whole build therefore happens inside
// an `import('jspdf').then(...)` callback; generateReport itself returns
// void and fires the download when the module resolves.
//
// jsPDF's default Helvetica font has no Arabic glyphs, so every label in
// the PDF is English regardless of the app language. Numbers already use
// Western digits via formatCurrency, so they carry over unchanged.

import type { DateRange } from "@/components/ui/date-range-picker"
import type {
  Apartment,
  Expense,
  ExpenseCategory,
  Payment,
  Transfer,
} from "@/lib/types"
import { formatCurrency, formatDate } from "@/lib/utils"
import { monthKey, monthKeyLabel } from "@/lib/months"
import {
  filterExpensesByRange,
  filterPaymentsByRange,
  filterTransfersByRange,
} from "@/lib/date-filters"
import { computeBankBalance, computeCashOnHand } from "@/lib/computations"

export interface GenerateReportOptions {
  type: "income" | "expense" | "balance" | "collections"
  title: string
  dateRange: DateRange
  payments: Payment[]
  expenses: Expense[]
  transfers: Transfer[]
  categories: ExpenseCategory[]
  /** optional lookup so per-unit rows show real unit numbers, not ids */
  apartments?: Apartment[]
  buildingName?: string
  lang?: "en" | "ar"
}

// Page geometry (jsPDF defaults: portrait, mm, A4 → ~210 x 297mm)
const MARGIN = 14
const TOP = 20
const PAGE_BREAK_Y = 270

function rangeString(r: DateRange): string {
  if (!r.start && !r.end) return "All time"
  const s = r.start ? formatDate(r.start) : "Beginning"
  const e = r.end ? formatDate(r.end) : "Today"
  return `${s} - ${e}`
}

function apartmentLabel(apt: Apartment | undefined): string {
  if (!apt) return "Unknown unit"
  const unit = apt.unit_number || "?"
  return apt.building_no ? `Unit ${unit} (Bldg ${apt.building_no})` : `Unit ${unit}`
}

export function generateReport(options: GenerateReportOptions): void {
  const {
    type,
    title,
    dateRange,
    payments,
    expenses,
    transfers,
    categories,
    apartments = [],
    buildingName,
  } = options

  import("jspdf").then(({ jsPDF }) => {
    const doc = new jsPDF()
    const pageW = doc.internal.pageSize.getWidth()
    const contentRight = pageW - MARGIN
    let y = TOP

    // ── low-level primitives ───────────────────────────────────────────
    // returns true when it started a fresh page (callers reprint headers)
    const ensure = (needed = 8): boolean => {
      if (y + needed > PAGE_BREAK_Y) {
        doc.addPage()
        y = TOP
        return true
      }
      return false
    }

    const rule = (shade = 200) => {
      doc.setDrawColor(shade)
      doc.line(MARGIN, y, contentRight, y)
    }

    const sectionTitle = (label: string) => {
      ensure(14)
      y += 2
      doc.setFont("helvetica", "bold")
      doc.setFontSize(12)
      doc.setTextColor(30)
      doc.text(label, MARGIN, y)
      y += 2
      rule(190)
      y += 6
      doc.setFont("helvetica", "normal")
      doc.setFontSize(10)
      doc.setTextColor(60)
    }

    // label left, value right — the summary "2-column table"
    const summaryRow = (label: string, value: string) => {
      ensure()
      doc.setFontSize(10)
      doc.setTextColor(90)
      doc.text(label, MARGIN, y)
      doc.setTextColor(20)
      doc.text(value, contentRight, y, { align: "right" })
      y += 7
    }

    type Col = { header: string; x: number; align?: "left" | "right" }

    const tableHead = (cols: Col[]) => {
      doc.setFont("helvetica", "bold")
      doc.setFontSize(9)
      doc.setTextColor(90)
      for (const c of cols) {
        doc.text(c.header, c.x, y, { align: c.align === "right" ? "right" : "left" })
      }
      y += 2
      rule(210)
      y += 5
      doc.setFont("helvetica", "normal")
      doc.setTextColor(40)
    }

    const tableRows = (cols: Col[], rows: string[][]) => {
      tableHead(cols)
      if (rows.length === 0) {
        ensure()
        doc.setTextColor(140)
        doc.setFontSize(9)
        doc.text("No records in this period.", MARGIN, y)
        y += 6
        doc.setTextColor(40)
        return
      }
      doc.setFontSize(9)
      for (const cells of rows) {
        if (ensure(7)) tableHead(cols) // reprint header after a page break
        cols.forEach((c, i) => {
          doc.text(cells[i] ?? "", c.x, y, {
            align: c.align === "right" ? "right" : "left",
          })
        })
        y += 6
      }
    }

    // ── header (every report) ──────────────────────────────────────────
    doc.setFont("helvetica", "bold")
    doc.setFontSize(18)
    doc.setTextColor(20)
    doc.text(buildingName || "BuildFin Report", MARGIN, y)
    y += 8

    doc.setFont("helvetica", "normal")
    doc.setFontSize(13)
    doc.setTextColor(70)
    doc.text(title, MARGIN, y)
    y += 7

    doc.setFontSize(10)
    doc.setTextColor(110)
    doc.text(`Period: ${rangeString(dateRange)}`, MARGIN, y)
    y += 5
    doc.text(`Generated: ${formatDate(new Date())}`, MARGIN, y)
    y += 4
    rule(150)
    y += 6

    // shared lookups
    const catName = (id: string) =>
      categories.find((c) => c.id === id)?.name ?? "other"
    const aptById = new Map(apartments.map((a) => [a.id, a]))

    // ── report bodies ──────────────────────────────────────────────────
    if (type === "income") {
      const rows = filterPaymentsByRange(payments, dateRange)
      const total = rows.reduce((s, p) => s + p.amount, 0)
      const cash = rows.filter((p) => p.method === "cash").reduce((s, p) => s + p.amount, 0)
      const bank = rows.filter((p) => p.method === "bank").reduce((s, p) => s + p.amount, 0)

      sectionTitle("Summary")
      summaryRow("Total collected", formatCurrency(total))
      summaryRow("Payments recorded", String(rows.length))
      summaryRow("Collected in cash", formatCurrency(cash))
      summaryRow("Collected via bank", formatCurrency(bank))

      // breakdown by month
      const byMonth = new Map<string, number>()
      for (const p of rows) {
        const k = monthKey(p.date_paid)
        byMonth.set(k, (byMonth.get(k) ?? 0) + p.amount)
      }
      sectionTitle("Breakdown by month")
      tableRows(
        [
          { header: "Month", x: MARGIN },
          { header: "Collected", x: contentRight, align: "right" },
        ],
        [...byMonth.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([k, amt]) => [monthKeyLabel(k), formatCurrency(amt)])
      )

      sectionTitle("Payments")
      tableRows(
        [
          { header: "Date", x: MARGIN },
          { header: "Unit", x: MARGIN + 32 },
          { header: "Payer", x: MARGIN + 78 },
          { header: "Method", x: MARGIN + 128 },
          { header: "Amount", x: contentRight, align: "right" },
        ],
        [...rows]
          .sort((a, b) => a.date_paid.localeCompare(b.date_paid))
          .map((p) => [
            formatDate(p.date_paid),
            apartmentLabel(aptById.get(p.apartment_id)),
            p.payer_name || "-",
            p.method === "bank" ? "Bank" : "Cash",
            formatCurrency(p.amount),
          ])
      )
    } else if (type === "expense") {
      const all = filterExpensesByRange(expenses, dateRange)
      const paid = all.filter((e) => e.paid !== false)
      const total = paid.reduce((s, e) => s + e.amount, 0)
      const owed = all.filter((e) => e.paid === false).reduce((s, e) => s + e.amount, 0)

      sectionTitle("Summary")
      summaryRow("Total spent", formatCurrency(total))
      summaryRow("Expenses recorded", String(all.length))
      summaryRow("Unpaid / still owed", formatCurrency(owed))

      // breakdown by category (paid only)
      const byCat = new Map<string, number>()
      for (const e of paid) {
        const name = catName(e.category_id)
        byCat.set(name, (byCat.get(name) ?? 0) + e.amount)
      }
      sectionTitle("Breakdown by category")
      tableRows(
        [
          { header: "Category", x: MARGIN },
          { header: "Spent", x: contentRight, align: "right" },
        ],
        [...byCat.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([name, amt]) => [
            name.charAt(0).toUpperCase() + name.slice(1),
            formatCurrency(amt),
          ])
      )

      sectionTitle("Expenses")
      tableRows(
        [
          { header: "Date", x: MARGIN },
          { header: "Category", x: MARGIN + 30 },
          { header: "Vendor", x: MARGIN + 70 },
          { header: "Status", x: MARGIN + 120 },
          { header: "Amount", x: contentRight, align: "right" },
        ],
        [...all]
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((e) => {
            const name = catName(e.category_id)
            return [
              formatDate(e.date),
              name.charAt(0).toUpperCase() + name.slice(1),
              e.vendor || "-",
              e.paid === false ? "Not paid" : "Paid",
              formatCurrency(e.amount),
            ]
          })
      )
    } else if (type === "balance") {
      // balances are current snapshots (all recorded, on-dashboard only);
      // history carry-over is not part of the report inputs
      const dashPay = payments.filter((p) => p.on_dashboard !== false)
      const cash = computeCashOnHand(dashPay, expenses, transfers)
      const bank = computeBankBalance(dashPay, expenses, transfers)

      // net for the selected period
      const periodPay = filterPaymentsByRange(dashPay, dateRange)
      const periodExp = filterExpensesByRange(expenses, dateRange).filter(
        (e) => e.paid !== false
      )
      const income = periodPay.reduce((s, p) => s + p.amount, 0)
      const spent = periodExp.reduce((s, e) => s + e.amount, 0)

      sectionTitle("Balances (current)")
      summaryRow("Cash on hand", formatCurrency(cash))
      summaryRow("Bank balance", formatCurrency(bank))
      summaryRow("Total balance", formatCurrency(cash + bank))

      sectionTitle("Net position (selected period)")
      summaryRow("Income collected", formatCurrency(income))
      summaryRow("Expenses paid", formatCurrency(spent))
      summaryRow("Net (income - expense)", formatCurrency(income - spent))

      const periodTransfers = filterTransfersByRange(transfers, dateRange)
      const toBank = periodTransfers
        .filter((tr) => tr.from_method === "cash" && tr.to_method === "bank")
        .reduce((s, tr) => s + tr.amount, 0)
      const toCash = periodTransfers
        .filter((tr) => tr.from_method === "bank" && tr.to_method === "cash")
        .reduce((s, tr) => s + tr.amount, 0)

      sectionTitle("Transfer summary (selected period)")
      summaryRow("Transfers recorded", String(periodTransfers.length))
      summaryRow("Cash to bank (deposits)", formatCurrency(toBank))
      summaryRow("Bank to cash (withdrawals)", formatCurrency(toCash))

      sectionTitle("Transfers")
      tableRows(
        [
          { header: "Date", x: MARGIN },
          { header: "Direction", x: MARGIN + 40 },
          { header: "Amount", x: contentRight, align: "right" },
        ],
        [...periodTransfers]
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((tr) => [
            formatDate(tr.date),
            `${tr.from_method === "bank" ? "Bank" : "Cash"} to ${
              tr.to_method === "bank" ? "Bank" : "Cash"
            }`,
            formatCurrency(tr.amount),
          ])
      )
    } else {
      // collections — per-unit payment counts and totals
      const rows = filterPaymentsByRange(payments, dateRange)
      const total = rows.reduce((s, p) => s + p.amount, 0)

      const perUnit = new Map<string, { label: string; count: number; total: number }>()
      for (const p of rows) {
        const key = p.apartment_id || `payer:${p.payer_name}`
        const existing = perUnit.get(key)
        if (existing) {
          existing.count += 1
          existing.total += p.amount
        } else {
          const apt = aptById.get(p.apartment_id)
          perUnit.set(key, {
            label: apt ? apartmentLabel(apt) : p.payer_name || "Unknown unit",
            count: 1,
            total: p.amount,
          })
        }
      }

      sectionTitle("Summary")
      summaryRow("Total collected", formatCurrency(total))
      summaryRow("Payments recorded", String(rows.length))
      summaryRow("Units with payments", String(perUnit.size))

      sectionTitle("Collections per unit")
      tableRows(
        [
          { header: "Unit", x: MARGIN },
          { header: "Payments", x: MARGIN + 110, align: "right" },
          { header: "Total", x: contentRight, align: "right" },
        ],
        [...perUnit.values()]
          .sort((a, b) => b.total - a.total)
          .map((u) => [u.label, String(u.count), formatCurrency(u.total)])
      )
    }

    // ── page footer numbers ────────────────────────────────────────────
    const pages = doc.getNumberOfPages()
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i)
      doc.setFont("helvetica", "normal")
      doc.setFontSize(8)
      doc.setTextColor(150)
      doc.text(
        `Page ${i} of ${pages}`,
        contentRight,
        doc.internal.pageSize.getHeight() - 8,
        { align: "right" }
      )
      doc.text("BuildFin", MARGIN, doc.internal.pageSize.getHeight() - 8)
    }

    doc.save(`buildfin-${type}-${new Date().toISOString().slice(0, 10)}.pdf`)
  })
}
