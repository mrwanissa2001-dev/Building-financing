"use client"

import { useId } from "react"
import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts"

interface SparklineProps {
  data: number[]
  /** stroke/fill colour — a chart CSS var, e.g. "var(--chart-1)" */
  color?: string
  height?: number
  className?: string
}

/**
 * A bare 12-point trend line for a stat tile — no axes, no grid, a 2px line
 * over a ~12% wash. Identity comes from the tile's label, so no legend.
 */
export function Sparkline({
  data,
  color = "var(--chart-1)",
  height = 44,
  className,
}: SparklineProps) {
  const id = useId().replace(/:/g, "")
  const gradId = `spark-${id}`
  const chartData = data.map((v, i) => ({ i, v }))
  // pad a flat series so the line renders centred rather than clipped
  const min = Math.min(...data)
  const max = Math.max(...data)
  const domain: [number, number] =
    min === max ? [min - 1, max + 1] : [min, max]

  return (
    <div className={className} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.22} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis hide domain={domain} />
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            fill={`url(#${gradId})`}
            isAnimationActive={false}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
