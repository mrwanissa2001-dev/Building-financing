"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Plus, Trash2, StickyNote } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/lib/i18n"
import { loadNotes, saveNotes, createNote, type Note } from "@/lib/notes-store"

const COLOR_CLASSES: Record<Note["color"], string> = {
  yellow: "bg-yellow-100 dark:bg-yellow-900/30",
  green: "bg-green-100 dark:bg-green-900/30",
  blue: "bg-blue-100 dark:bg-blue-900/30",
  pink: "bg-pink-100 dark:bg-pink-900/30",
  purple: "bg-purple-100 dark:bg-purple-900/30",
}

const PALETTE_CLASSES: Record<Note["color"], string> = {
  yellow: "bg-yellow-300 dark:bg-yellow-600",
  green: "bg-green-300 dark:bg-green-600",
  blue: "bg-blue-300 dark:bg-blue-600",
  pink: "bg-pink-300 dark:bg-pink-600",
  purple: "bg-purple-300 dark:bg-purple-600",
}

const COLORS: Note["color"][] = ["yellow", "green", "blue", "pink", "purple"]

function NoteCard({
  note,
  onUpdate,
  onDelete,
}: {
  note: Note
  onUpdate: (id: string, changes: Partial<Note>) => void
  onDelete: (id: string) => void
}) {
  const { t } = useI18n()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea when content changes
  useEffect(() => {
    const el = textareaRef.current
    if (el) {
      el.style.height = "auto"
      el.style.height = `${el.scrollHeight}px`
    }
  }, [note.content])

  return (
    <div className={`flex flex-col gap-2 rounded-xl p-3 shadow-sm ${COLOR_CLASSES[note.color]}`}>
      {/* Title */}
      <input
        type="text"
        value={note.title}
        onChange={(e) => onUpdate(note.id, { title: e.target.value })}
        placeholder={t("Note title")}
        aria-label={t("Note title")}
        className="w-full border-b border-transparent bg-transparent pb-0.5 text-sm font-semibold outline-none placeholder:opacity-40 focus:border-black/10 dark:focus:border-white/10"
      />

      {/* Content */}
      <textarea
        ref={textareaRef}
        value={note.content}
        onChange={(e) => {
          onUpdate(note.id, { content: e.target.value })
        }}
        rows={3}
        className="min-h-[60px] w-full resize-none overflow-hidden bg-transparent text-sm outline-none placeholder:opacity-40"
        placeholder="..."
      />

      {/* Footer: color palette + delete */}
      <div className="mt-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onUpdate(note.id, { color: c })}
              className={`h-4 w-4 rounded-full transition-transform hover:scale-110 ${PALETTE_CLASSES[c]} ${
                note.color === c ? "ring-2 ring-black/30 ring-offset-1 dark:ring-white/30" : ""
              }`}
              aria-label={c}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => onDelete(note.id)}
          className="rounded p-1 text-black/40 transition-colors hover:text-destructive dark:text-white/40"
          aria-label={t("Delete note")}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

export function NotesWidget() {
  const { t } = useI18n()
  const [notes, setNotes] = useState<Note[]>(() => loadNotes())

  const addNote = useCallback(() => {
    const note = createNote()
    const updated = [note, ...notes]
    setNotes(updated)
    saveNotes(updated)
  }, [notes])

  const updateNote = useCallback(
    (id: string, changes: Partial<Note>) => {
      const updated = notes.map((n) =>
        n.id === id ? { ...n, ...changes, updated_at: new Date().toISOString() } : n
      )
      setNotes(updated)
      saveNotes(updated)
    },
    [notes]
  )

  const deleteNote = useCallback(
    (id: string) => {
      const updated = notes.filter((n) => n.id !== id)
      setNotes(updated)
      saveNotes(updated)
    },
    [notes]
  )

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 px-5 pb-3 pt-5">
        <CardTitle className="flex items-center gap-2 text-base">
          <StickyNote className="h-4 w-4 text-muted-foreground" />
          {t("Notes")}
        </CardTitle>
        <Button size="sm" variant="outline" onClick={addNote} className="h-7 gap-1 px-2">
          <Plus className="h-3.5 w-3.5" />
          <span className="text-xs">{t("Add Note")}</span>
        </Button>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        {notes.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t("No notes yet. Click + to add one.")}
          </p>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {notes.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  onUpdate={updateNote}
                  onDelete={deleteNote}
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
