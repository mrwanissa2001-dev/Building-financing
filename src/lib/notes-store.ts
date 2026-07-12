// localStorage-backed notes store for the sticky notes dashboard widget.

export interface Note {
  id: string
  title: string
  content: string
  color: "yellow" | "green" | "blue" | "pink" | "purple"
  created_at: string
  updated_at: string
}

const STORAGE_KEY = "buildfin.notes.v1"

export function loadNotes(): Note[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Note[]) : []
  } catch {
    return []
  }
}

export function saveNotes(notes: Note[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes))
  } catch {
    /* storage may be unavailable */
  }
}

export function createNote(partial?: Partial<Note>): Note {
  const now = new Date().toISOString()
  return {
    id: Math.random().toString(36).slice(2) + Date.now().toString(36),
    title: "",
    content: "",
    color: "yellow",
    created_at: now,
    updated_at: now,
    ...partial,
  }
}
