"use client"

// Lightweight i18n: the English string itself is the dictionary key, so
// untranslated strings simply fall back to English. Adding a language
// means adding one dictionary to src/lib/translations.ts and one entry
// to LANGUAGES below.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import { DICTIONARIES, type Lang } from "./translations"

export type { Lang }

export const LANGUAGES: { value: Lang; label: string; dir: "ltr" | "rtl" }[] = [
  { value: "en", label: "English", dir: "ltr" },
  { value: "ar", label: "العربية (Arabic)", dir: "rtl" },
]

const STORAGE_KEY = "app-language"

type Vars = Record<string, string | number>

interface I18nContextValue {
  lang: Lang
  dir: "ltr" | "rtl"
  setLang: (lang: Lang) => void
  t: (text: string, vars?: Vars) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

function interpolate(text: string, vars?: Vars): string {
  if (!vars) return text
  return text.replace(/\{(\w+)\}/g, (m, k) =>
    k in vars ? String(vars[k]) : m
  )
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en")

  // read the saved choice after mount so server and client render alike
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && LANGUAGES.some((l) => l.value === saved)) {
      setLangState(saved as Lang)
    }
  }, [])

  const dir = LANGUAGES.find((l) => l.value === lang)?.dir ?? "ltr"

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = dir
  }, [lang, dir])

  const setLang = useCallback((next: Lang) => {
    setLangState(next)
    localStorage.setItem(STORAGE_KEY, next)
  }, [])

  const t = useCallback(
    (text: string, vars?: Vars) => {
      const dict = DICTIONARIES[lang]
      const translated = dict?.[text] ?? text
      return interpolate(translated, vars)
    },
    [lang]
  )

  return (
    <I18nContext.Provider value={{ lang, dir, setLang, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error("useI18n must be used within LanguageProvider")
  return ctx
}
