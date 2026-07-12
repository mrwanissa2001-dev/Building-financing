"use client"

import { useLayout, REGISTRY, PAGE_LABELS, type PageKey } from "@/lib/layout"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronUp, ChevronDown, Eye, EyeOff, RotateCcw, SlidersHorizontal, GripVertical } from "lucide-react"
import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n"

const PAGES: PageKey[] = ["dashboard", "apartments", "expenses"]

export default function AppearancePage() {
  const { order, toggle, move, reset } = useLayout()
  const { t } = useI18n()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("Settings")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("Choose which widgets appear on each page and the order they show in. Changes apply instantly and are saved on this device.")}
        </p>
      </div>

      {PAGES.map((page) => {
        const items = order(page)
        const labelOf = (key: string) =>
          REGISTRY[page].find((w) => w.key === key)?.label ?? key
        const visibleCount = items.filter((w) => w.visible).length
        return (
          <Card key={page} className="max-w-2xl">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <SlidersHorizontal className="h-5 w-5" /> {t(PAGE_LABELS[page])}
                  </CardTitle>
                  <CardDescription>
                    {visibleCount} / {items.length} {t("widgets shown")}
                  </CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => reset(page)}>
                  <RotateCcw className="mr-1 h-4 w-4" /> {t("Reset")}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-border rounded-lg border border-border">
                {items.map((w, i) => (
                  <li
                    key={w.key}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5",
                      !w.visible && "opacity-55"
                    )}
                  >
                    <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                    <button
                      type="button"
                      onClick={() => toggle(page, w.key)}
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-colors",
                        w.visible
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border text-muted-foreground hover:bg-muted"
                      )}
                      aria-pressed={w.visible}
                      aria-label={w.visible ? `Hide ${labelOf(w.key)}` : `Show ${labelOf(w.key)}`}
                    >
                      {w.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    </button>
                    <span className={cn("flex-1 text-sm font-medium", !w.visible && "line-through")}>
                      {t(labelOf(w.key))}
                    </span>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={i === 0}
                        onClick={() => move(page, w.key, -1)}
                        aria-label={`Move ${labelOf(w.key)} up`}
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={i === items.length - 1}
                        onClick={() => move(page, w.key, 1)}
                        aria-label={`Move ${labelOf(w.key)} down`}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
