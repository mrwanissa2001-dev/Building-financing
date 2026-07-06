import type { OccupancyStatus, PaymentMethod, PayerRelation } from './types'

// Floors derived from the building setup: mezzanine M1..Mn, then 1..N
export function buildingFloors(mezzanineFloors: number, numFloors: number): string[] {
  const mezz = Math.max(0, Math.min(mezzanineFloors || 0, 5))
  const floors = Math.max(1, Math.min(numFloors || 1, 60))
  return [
    ...Array.from({ length: mezz }, (_, i) => `M${i + 1}`),
    ...Array.from({ length: floors }, (_, i) => String(i + 1)),
  ]
}

// Default building floors: mezzanine M1 and M2, then 1..13
export const FLOORS: string[] = buildingFloors(2, 13)

export const RECURRING_INTERVALS: { value: number; label: string }[] = [
  { value: 1, label: 'Every month' },
  { value: 2, label: 'Every 2 months' },
  { value: 3, label: 'Every 3 months' },
  { value: 6, label: 'Every 6 months' },
  { value: 12, label: 'Every year' },
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
