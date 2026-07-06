"use client"

import { cn } from "@/lib/utils"

export type RangeKey = "3M" | "6M" | "12M"

const OPTIONS: { key: RangeKey; label: string }[] = [
  { key: "3M", label: "3M" },
  { key: "6M", label: "6M" },
  { key: "12M", label: "12M" },
]

/**
 * A compact segmented control (3M · 6M · 12M) that drives the trailing window
 * of the time-series charts. The selected pill rides on a card surface so the
 * track reads as a single quiet element.
 */
export function RangeToggle({
  value,
  onChange,
}: {
  value: RangeKey
  onChange: (v: RangeKey) => void
}) {
  return (
    <div
      role="tablist"
      aria-label="Time range"
      className="inline-flex items-center gap-0.5 rounded-full border border-border/70 bg-muted/60 p-0.5"
    >
      {OPTIONS.map((o) => {
        const active = o.key === value
        return (
          <button
            key={o.key}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.key)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
              active
                ? "bg-card text-foreground shadow-card"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
