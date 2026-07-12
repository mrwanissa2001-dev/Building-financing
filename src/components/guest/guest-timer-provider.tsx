"use client"

import React, { createContext, useContext, useEffect, useState, useCallback } from "react"
import { getRemainingMs, clearGuestSession } from "@/lib/guest-session"

interface TimerContextValue {
  remainingMs: number
  isExpired: boolean
}

const TimerContext = createContext<TimerContextValue>({ remainingMs: 10 * 60 * 1000, isExpired: false })

export function GuestTimerProvider({ children }: { children: React.ReactNode }) {
  const [remainingMs, setRemainingMs] = useState(getRemainingMs)
  const [isExpired, setIsExpired] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      const ms = getRemainingMs()
      setRemainingMs(ms)
      if (ms === 0 && !isExpired) {
        clearGuestSession()
        setIsExpired(true)
      }
    }, 200)
    return () => clearInterval(interval)
  }, [isExpired])

  return (
    <TimerContext.Provider value={{ remainingMs, isExpired }}>
      {children}
    </TimerContext.Provider>
  )
}

export function useGuestTimer() {
  return useContext(TimerContext)
}
