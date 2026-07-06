// Minimal CSV build/parse helpers (quote-aware, no dependencies)

function escapeCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function buildCsv(headers: string[], rows: (string | number)[][]): string {
  const lines = [headers.map(escapeCell).join(',')]
  for (const row of rows) {
    lines.push(row.map((c) => escapeCell(String(c ?? ''))).join(','))
  }
  return lines.join('\r\n')
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cell += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      cell = ''
      rows.push(row)
      row = []
    } else {
      cell += ch
    }
  }
  // last cell/row (no trailing newline)
  if (cell !== '' || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }

  // drop fully empty rows
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

// Cells that are only '#' characters are Excel's "column too narrow"
// artifact — treat them as empty
export function cleanCell(value: string): string {
  const t = value.trim()
  return /^#+$/.test(t) ? '' : t
}

// Tolerant amount parser: strips currency text, spaces, and thousands
// separators so "1,500", "1 500 LE", "LE 1500" all become 1500
export function parseAmount(value: string): number {
  const cleaned = cleanCell(value).replace(/[^0-9.\-]/g, '')
  if (!cleaned) return NaN
  return parseFloat(cleaned)
}

// Map data rows to objects using the header row (case-insensitive header match)
export function csvToObjects(text: string): Record<string, string>[] {
  const rows = parseCsv(text)
  if (rows.length < 2) return []
  const headers = rows[0].map((h) => h.trim().toLowerCase())
  return rows.slice(1).map((r) => {
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => {
      obj[h] = cleanCell(r[i] ?? '')
    })
    return obj
  })
}

export function downloadCsv(filename: string, csv: string) {
  // prepend BOM so Excel opens UTF-8 correctly
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Normalize a date cell to yyyy-mm-dd; returns null if unparseable
export function normalizeDate(value: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const d = new Date(value)
  if (isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}
