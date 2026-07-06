// Month-key helpers. A month key is a 'YYYY-MM' string; keys compare
// correctly with plain string comparison.

export function monthKey(date: string | Date): string {
  if (typeof date === 'string') {
    // date-only strings are taken literally to avoid timezone shifts
    const m = date.match(/^(\d{4})-(\d{2})/)
    if (m) return `${m[1]}-${m[2]}`
  }
  const d = typeof date === 'string' ? new Date(date) : date
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

// null instead of garbage for unparseable values
export function monthKeyOrNull(value: string): string | null {
  if (!value) return null
  const m = value.match(/^(\d{4})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}`
  const d = new Date(value)
  return isNaN(d.getTime()) ? null : monthKey(d)
}

export function currentMonthKey(): string {
  return monthKey(new Date())
}

export function addMonthsToKey(key: string, months: number): string {
  const [y, m] = key.split('-').map(Number)
  const total = y * 12 + (m - 1) + months
  const ny = Math.floor(total / 12)
  const nm = (total % 12) + 1
  return `${ny}-${String(nm).padStart(2, '0')}`
}

// number of months from a to b inclusive-exclusive: monthsBetween('2026-01','2026-03') === 2
export function monthsBetween(a: string, b: string): number {
  const [ay, am] = a.split('-').map(Number)
  const [by, bm] = b.split('-').map(Number)
  return (by - ay) * 12 + (bm - am)
}

export function firstDayOfMonth(key: string): string {
  return `${key}-01`
}

export function lastDayOfMonth(key: string): string {
  const [y, m] = key.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  return `${key}-${String(last).padStart(2, '0')}`
}

// 'Jun 2026'
export function monthKeyLabel(key: string): string {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  })
}

// Label for a payment's covered months: 'Jun 2026' or 'Jun – Aug 2026 (3 months)'
export function monthRangeLabel(startKey: string, endKey: string): string {
  if (startKey === endKey) return monthKeyLabel(startKey)
  const n = monthsBetween(startKey, endKey) + 1
  const [sy, sm] = startKey.split('-').map(Number)
  const startShort = new Date(sy, sm - 1, 1).toLocaleDateString('en-US', { month: 'short' })
  const sameYear = startKey.slice(0, 4) === endKey.slice(0, 4)
  const startLabel = sameYear ? startShort : monthKeyLabel(startKey)
  return `${startLabel} – ${monthKeyLabel(endKey)} (${n} months)`
}

export function isValidMonthKey(key: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(key)
}
