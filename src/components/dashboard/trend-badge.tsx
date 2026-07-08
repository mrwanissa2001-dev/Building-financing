"use client"

import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react"
import { cn } from "@/lib/utils"

interface TrendBadgeProps {
  /** signed percentage change, e.g. -12.4 */
  value: number | null
  /** whether an increase is a good thing (income) or bad (spending) */
  goodWhenUp?: boolean
  /** period the delta is measured against, e.g. "vs last month" */
  label?: string
  className?: string
}

/**
 * A small signed-percentage pill (▲/▼ %). Colour encodes direction × whether
 * up is good — never the series colour. Sits beside a stat value.
 */
export function TrendBadge({
  value,
  goodWhenUp = true,
  label,
  className,
}: TrendBadgeProps) {
  if (value === null || !isFinite(value)) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground",
          className
        )}
      >
        <Minus className="h-3 w-3" />
        <span className="nums">—</span>
        {label && <span className="font-normal text-muted-foreground/80">{label}</span>}
      </span>
    )
  }

  const flat = Math.abs(value) < 0.05
  const up = value > 0
  const good = flat ? null : up === goodWhenUp
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
        good === null && "bg-muted text-muted-foreground",
        good === true && "bg-[var(--pos)]/12 text-[var(--pos)]",
        good === false && "bg-[var(--neg)]/12 text-[var(--neg)]",
        className
      )}
    >
      <Icon className="h-3 w-3" />
      <span className="nums">
        {up ? "+" : ""}
        {value.toFixed(1)}%
      </span>
      {label && (
        <span className="font-normal opacity-70">{label}</span>
      )}
    </span>
  )
}
