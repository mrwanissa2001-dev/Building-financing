// Guest session — stored in sessionStorage (tab-isolated by the browser)

const SESSION_KEY = "buildfin.guest.session"
const DATA_KEY = "buildfin.guest.data"

export interface GuestSession {
  id: string
  startedAt: number
  expiresAt: number
}

export function initGuestSession(): GuestSession {
  const session: GuestSession = {
    id: crypto.randomUUID(),
    startedAt: Date.now(),
    expiresAt: Date.now() + 10 * 60 * 1000,
  }
  if (typeof window !== "undefined") {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
  }
  return session
}

export function getGuestSession(): GuestSession | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const session = JSON.parse(raw) as GuestSession
    if (Date.now() >= session.expiresAt) return null
    return session
  } catch {
    return null
  }
}

export function isGuestActive(): boolean {
  return getGuestSession() !== null
}

export function getRemainingMs(): number {
  const session = getGuestSession()
  if (!session) return 0
  return Math.max(0, session.expiresAt - Date.now())
}

export function clearGuestSession(): void {
  if (typeof window === "undefined") return
  for (const key of Object.keys(sessionStorage)) {
    if (key.startsWith("buildfin.guest.")) {
      sessionStorage.removeItem(key)
    }
  }
}

export { DATA_KEY as GUEST_DATA_KEY }
