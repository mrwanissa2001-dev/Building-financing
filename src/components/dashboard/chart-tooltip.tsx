"use client"

import { formatCurrency } from "@/lib/utils"

interface TooltipEntry {
  name?: string | number
  value?: number | string
  color?: string
}

interface ChartTooltipProps {
  active?: boolean
  payload?: TooltipEntry[]
  label?: string | number
  labelFormatter?: (label: string) => string
  valueFormatter?: (value: number) => string
}

/**
 * A quiet card-surface tooltip shared by every dashboard chart: hairline
 * border, rounded, tabular figures, a colour key dot beside each series so
 * identity never rests on the text colour.
 */
export function ChartTooltip({
  active,
  payload,
  label,
  labelFormatter,
  valueFormatter = formatCurrency,
}: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null

  const heading =
    labelFormatter && label != null ? labelFormatter(String(label)) : label

  return (
    <div className="min-w-36 rounded-xl border border-border/70 bg-popover/95 px-3 py-2 shadow-card backdrop-blur">
      {heading != null && (
        <div className="mb-1.5 text-xs font-medium text-muted-foreground">
          {heading}
        </div>
      )}
      <div className="space-y-1">
        {payload.map((entry: TooltipEntry, i: number) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-muted-foreground">{entry.name}</span>
            <span className="nums ml-auto font-semibold text-foreground">
              {valueFormatter(Number(entry.value))}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
