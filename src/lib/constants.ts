import type { OccupancyStatus, PaymentMethod, PayerRelation } from './types'

// Building floors: mezzanine M1 and M2, then 1..13
export const FLOORS: string[] = [
  'M1',
  'M2',
  ...Array.from({ length: 13 }, (_, i) => String(i + 1)),
]

// Sort order for floors (M1 first, then M2, then 1..13; unknown values last)
export function floorIndex(floor: string): number {
  const idx = FLOORS.indexOf(floor)
  return idx === -1 ? FLOORS.length : idx
}

export const PAYER_RELATIONS: { value: PayerRelation; label: string }[] = [
  { value: 'father', label: 'Father' },
  { value: 'mother', label: 'Mother' },
  { value: 'sister', label: 'Sister' },
  { value: 'brother', label: 'Brother' },
  { value: 'son', label: 'Son' },
  { value: 'daughter', label: 'Daughter' },
  { value: 'friend', label: 'Friend' },
  { value: 'other', label: 'Other' },
]

export const OCCUPANCY_STATUSES: { value: OccupancyStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'mia', label: 'MIA' },
  { value: 'traveling_but_paying', label: 'Traveling but Paying' },
]

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank' },
]

export const DEFAULT_EXPENSE_CATEGORIES: string[] = [
  'maintenance',
  'water',
  'electricity',
  'internet',
  'security',
  'cleaning',
  'extras',
  'other',
]
