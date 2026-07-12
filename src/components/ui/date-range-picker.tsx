"use client"

import { useMemo, useState } from "react"
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isWithinInterval,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns"
import { CalendarDays, ChevronLeft, ChevronRight, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"

export interface DateRange {
  /** inclusive 'YYYY-MM-DD', or '' for open (all time) */
  start: string
  end: string
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]

function iso(d: Date): string {
  return format(d, "yyyy-MM-dd")
}
function parse(s: string): Date | null {
  if (!s) return null
  const d = parseISO(s)
  return isNaN(d.getTime()) ? null : d
}

type PresetKey = "all" | "today" | "week" | "month" | "year"

function presetRange(key: PresetKey): DateRange {
  const now = new Date()
  switch (key) {
    case "all":
      return { start: "", end: "" }
    case "today":
      return { start: iso(now), end: iso(now) }
    case "week":
      return { start: iso(startOfWeek(now)), end: iso(endOfWeek(now)) }
    case "month":
      return { start: iso(startOfMonth(now)), end: iso(endOfMonth(now)) }
    case "year":
      return { start: `${now.getFullYear()}-01-01`, end: `${now.getFullYear()}-12-31` }
  }
}

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "all", label: "All time" },
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "year", label: "This year" },
]

/** does this value exactly equal a preset's range? → drives the trigger label */
function matchPreset(v: DateRange): PresetKey | null {
  for (const p of PRESETS) {
    const r = presetRange(p.key)
    if (r.start === v.start && r.end === v.end) return p.key
  }
  return null
}

export function rangeLabel(v: DateRange): string {
  const preset = matchPreset(v)
  if (preset) return PRESETS.find((p) => p.key === preset)!.label
  const s = parse(v.start)
  const e = parse(v.end)
  if (!s && !e) return "All time"
  if (s && e) {
    const sameYear = s.getFullYear() === e.getFullYear()
    if (isSameDay(s, e)) return format(s, "MMM d, yyyy")
    return `${format(s, sameYear ? "MMM d" : "MMM d, yyyy")} – ${format(e, "MMM d, yyyy")}`
  }
  return "Custom"
}

function MonthGrid({
  month,
  start,
  end,
  hovered,
  onPick,
  onHover,
}: {
  month: Date
  start: Date | null
  end: Date | null
  hovered: Date | null
  onPick: (d: Date) => void
  onHover: (d: Date | null) => void
}) {
  const days = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(startOfMonth(month)),
        end: endOfWeek(endOfMonth(month)),
      }),
    [month]
  )

  // provisional end while hovering during selection
  const rangeEnd = end ?? (start && hovered && hovered > start ? hovered : null)

  return (
    <div className="w-[15.5rem]">
      <div className="mb-2 text-center text-sm font-semibold">{format(month, "MMMM yyyy")}</div>
      <div className="mb-1 grid grid-cols-7">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-1 text-center text-[11px] font-medium text-muted-foreground">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {days.map((d) => {
          const inMonth = isSameMonth(d, month)
          const isStart = start && isSameDay(d, start)
          const isEnd = rangeEnd && isSameDay(d, rangeEnd)
          const inRange =
            start && rangeEnd && isWithinInterval(d, { start, end: rangeEnd })
          const isEndpoint = isStart || isEnd
          return (
            <button
              type="button"
              key={d.toISOString()}
              onClick={() => onPick(d)}
              onMouseEnter={() => onHover(d)}
              className={cn(
                "relative h-8 text-sm transition-colors",
                // continuous range wash behind the cells
                inRange && !isEndpoint && "bg-primary/12",
                inRange && isStart && "rounded-l-md bg-primary/12",
                inRange && isEnd && "rounded-r-md bg-primary/12"
              )}
            >
              <span
                className={cn(
                  "mx-auto flex h-8 w-8 items-center justify-center rounded-md",
                  !inMonth && "text-muted-foreground/40",
                  inMonth && !isEndpoint && !inRange && "hover:bg-muted",
                  isEndpoint && "bg-primary font-semibold text-primary-foreground"
                )}
              >
                {format(d, "d")}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function DateRangePicker({
  value,
  onChange,
  className,
  align = "end",
}: {
  value: DateRange
  onChange: (v: DateRange) => void
  className?: string
  align?: "start" | "center" | "end"
}) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [custom, setCustom] = useState(false)
  const [draftStart, setDraftStart] = useState<Date | null>(null)
  const [draftEnd, setDraftEnd] = useState<Date | null>(null)
  const [hovered, setHovered] = useState<Date | null>(null)
  const [viewMonth, setViewMonth] = useState<Date>(startOfMonth(new Date()))

  const activePreset = matchPreset(value)

  function openChange(next: boolean) {
    if (next) {
      // initialise the calendar from the current value
      const s = parse(value.start)
      const e = parse(value.end)
      setDraftStart(s)
      setDraftEnd(e)
      setHovered(null)
      setCustom(!activePreset && !!(s || e))
      setViewMonth(startOfMonth(e ?? s ?? new Date()))
    }
    setOpen(next)
  }

  function applyPreset(key: PresetKey) {
    onChange(presetRange(key))
    setOpen(false)
  }

  function pickDay(d: Date) {
    if (!draftStart || (draftStart && draftEnd)) {
      setDraftStart(d)
      setDraftEnd(null)
    } else if (d < draftStart) {
      // second click before the first → the earlier one becomes the start
      setDraftEnd(draftStart)
      setDraftStart(d)
    } else {
      setDraftEnd(d)
    }
  }

  function applyCustom() {
    if (draftStart && draftEnd) {
      onChange({ start: iso(draftStart), end: iso(draftEnd) })
      setOpen(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={openChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn("gap-2 font-medium", className)}>
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          {rangeLabel(value)}
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-auto max-w-[95vw] p-0">
        {/* preset chip row */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-border p-3">
          {PRESETS.map((p) => {
            const active = !custom && activePreset === p.key
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => applyPreset(p.key)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                  active
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-muted"
                )}
              >
                {active && <Check className="h-3 w-3" />}
                {t(p.label)}
              </button>
            )
          })}
          <button
            type="button"
            onClick={() => {
              setCustom(true)
              setViewMonth(startOfMonth(draftEnd ?? draftStart ?? new Date()))
            }}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
              custom
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-muted"
            )}
          >
            <CalendarDays className="h-3 w-3" />
            {t("Custom")}
          </button>
        </div>

        {custom && (
          <div className="p-3">
            <div className="mb-2 flex items-center justify-between">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setViewMonth((m) => addMonths(m, -1))}
                aria-label={t("Previous month")}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground">
                {draftStart ? format(draftStart, "MMM d, yyyy") : t("Start")} –{" "}
                {draftEnd ? format(draftEnd, "MMM d, yyyy") : t("End")}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setViewMonth((m) => addMonths(m, 1))}
                aria-label={t("Next month")}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div
              className="flex flex-col gap-4 sm:flex-row"
              onMouseLeave={() => setHovered(null)}
            >
              <MonthGrid
                month={viewMonth}
                start={draftStart}
                end={draftEnd}
                hovered={hovered}
                onPick={pickDay}
                onHover={setHovered}
              />
              <div className="hidden sm:block">
                <MonthGrid
                  month={addMonths(viewMonth, 1)}
                  start={draftStart}
                  end={draftEnd}
                  hovered={hovered}
                  onPick={pickDay}
                  onHover={setHovered}
                />
              </div>
            </div>
            <div className="mt-3 flex items-center justify-end gap-2 border-t border-border pt-3">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                {t("Cancel")}
              </Button>
              <Button size="sm" onClick={applyCustom} disabled={!draftStart || !draftEnd}>
                {t("Apply")}
              </Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
