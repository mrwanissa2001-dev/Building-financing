import type { PaymentInterval, OccupancyStatus, PaymentMethod } from './types'

export const PAYMENT_INTERVALS: { value: PaymentInterval; label: string; months: number }[] = [
  { value: 'monthly', label: 'Monthly', months: 1 },
  { value: 'bimonthly', label: 'Bimonthly', months: 2 },
  { value: 'quarterly', label: 'Quarterly', months: 3 },
  { value: 'biannual', label: 'Biannual', months: 6 },
  { value: 'annual', label: 'Annual', months: 12 },
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
