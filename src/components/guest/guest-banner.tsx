"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useGuestTimer } from "./guest-timer-provider"
import { Button } from "@/components/ui/button"
import { clearGuestSession, initGuestSession } from "@/lib/guest-session"

function formatTime(ms: number) {
  const totalSeconds = Math.ceil(ms / 1000)
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0")
  const s = (totalSeconds % 60).toString().padStart(2, "0")
  return `${m}:${s}`
}

export function GuestBanner() {
  const router = useRouter()
  const { remainingMs, isExpired } = useGuestTimer()
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    if (isExpired) setShowModal(true)
  }, [isExpired])

  const timerColor =
    remainingMs <= 60_000 ? "text-red-500" :
    remainingMs <= 180_000 ? "text-amber-500" :
    "text-foreground"

  function handleNewDemo() {
    initGuestSession()
    setShowModal(false)
    router.push("/guest")
    window.location.reload()
  }

  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-50 h-10 flex items-center justify-between px-4 bg-amber-50 dark:bg-amber-950 border-b border-amber-200 dark:border-amber-800">
        <span className="text-xs font-semibold tracking-widest uppercase text-amber-700 dark:text-amber-300">
          Demo mode
        </span>
        <span className={`text-sm font-mono font-bold tabular-nums ${timerColor}`}>
          {isExpired ? "00:00" : formatTime(remainingMs)}
        </span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => router.push("/auth/login")}>
            Sign in
          </Button>
          <Button size="sm" className="h-7 text-xs" onClick={() => router.push("/auth/signup")}>
            Create account
          </Button>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background border rounded-lg shadow-xl max-w-sm w-full mx-4 p-6">
            <h2 className="text-lg font-bold mb-2">Demo session ended</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Your 10-minute demo has expired. Your data has been cleared.
            </p>
            <div className="flex flex-col gap-2">
              <Button onClick={handleNewDemo} className="w-full">Start new demo</Button>
              <Button variant="outline" className="w-full" onClick={() => router.push("/auth/signup")}>Create account</Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
