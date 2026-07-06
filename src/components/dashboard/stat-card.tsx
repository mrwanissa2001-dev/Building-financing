"use client"

import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { TrendBadge } from "./trend-badge"
import { Sparkline } from "./sparkline"

interface StatCardProps {
  label: string
  value: string
  icon: LucideIcon
  /** chart CSS var used for the icon tint + sparkline, e.g. "var(--chart-1)" */
  accent?: string
  delta?: number | null
  deltaLabel?: string
  goodWhenUp?: boolean
  spark?: number[]
  href?: string
}

/**
 * Stat tile: label · value (semibold, proportional figures) · optional delta
 * pill · optional 12-point sparkline in the accent hue. The whole tile is an
 * optional link to the page that explains the number.
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  accent = "var(--chart-1)",
  delta,
  deltaLabel,
  goodWhenUp = true,
  spark,
  href,
}: StatCardProps) {
  const inner = (
    <Card
      className={cn(
        "group relative flex h-full flex-col overflow-hidden p-5 transition-all duration-200",
        href && "hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-card-hover"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: `color-mix(in oklch, ${accent} 14%, transparent)` }}
        >
          <Icon className="h-[18px] w-[18px]" style={{ color: accent }} />
        </span>
      </div>

      <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
        {value}
      </p>

      {delta !== undefined && (
        <div className="mt-2 whitespace-nowrap">
          <TrendBadge value={delta} goodWhenUp={goodWhenUp} label={deltaLabel} />
        </div>
      )}

      {spark && spark.length > 1 && (
        <div className="-mx-1 mt-auto pt-3">
          <Sparkline data={spark} color={accent} height={34} />
        </div>
      )}
    </Card>
  )

  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {inner}
      </Link>
    )
  }
  return inner
}
