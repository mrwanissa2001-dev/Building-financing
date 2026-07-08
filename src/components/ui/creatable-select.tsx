"use client"

import { useState } from "react"
import { Check, Plus, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectSeparator,
} from "@/components/ui/select"

const CREATE = "__create__"

export interface CreatableOption {
  value: string
  label: string
}

/**
 * A Select whose last option is "Add new…". Choosing it swaps the trigger for
 * an inline text box; on confirm the typed value is created (persisted by the
 * parent via onCreate) and selected — so a one-off "Other" becomes a reusable
 * attribute instead of a dead-end.
 */
export function CreatableSelect({
  value,
  onValueChange,
  onCreate,
  options,
  placeholder,
  createLabel = "Add new…",
  inputPlaceholder = "Type a name…",
  id,
  triggerClassName,
  capitalize,
}: {
  value: string
  onValueChange: (value: string) => void
  /** create the attribute; return the value to select (e.g. a new id) or null to cancel */
  onCreate: (label: string) => string | null
  options: CreatableOption[]
  placeholder?: string
  createLabel?: string
  inputPlaceholder?: string
  id?: string
  triggerClassName?: string
  capitalize?: boolean
}) {
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState("")

  function confirm() {
    const name = draft.trim()
    if (!name) return
    const selected = onCreate(name)
    if (selected) onValueChange(selected)
    setDraft("")
    setCreating(false)
  }

  if (creating) {
    return (
      <div className="flex items-center gap-1.5">
        <Input
          autoFocus
          value={draft}
          placeholder={inputPlaceholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              confirm()
            } else if (e.key === "Escape") {
              setCreating(false)
              setDraft("")
            }
          }}
        />
        <Button type="button" size="icon" className="h-9 w-9 shrink-0" onClick={confirm} aria-label="Save">
          <Check className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={() => {
            setCreating(false)
            setDraft("")
          }}
          aria-label="Cancel"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  return (
    <Select
      value={value || undefined}
      onValueChange={(v) => {
        if (v === CREATE) setCreating(true)
        else onValueChange(v)
      }}
    >
      <SelectTrigger id={id} className={triggerClassName}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} className={cn(capitalize && "capitalize")}>
            {o.label}
          </SelectItem>
        ))}
        {options.length > 0 && <SelectSeparator />}
        <SelectItem value={CREATE} className="text-primary">
          <span className="flex items-center gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            {createLabel}
          </span>
        </SelectItem>
      </SelectContent>
    </Select>
  )
}
