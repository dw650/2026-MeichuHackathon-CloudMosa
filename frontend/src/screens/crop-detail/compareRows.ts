import type { CompareRow } from '@/api/queries'

import type { SortId } from './useDetail'

/** i18n key of each order under `detail.compare.sorts`. */
export const SORT_LABEL = {
  price_desc: 'priceDesc',
  price_asc: 'priceAsc',
  distance_asc: 'distanceAsc',
  distance_desc: 'distanceDesc',
} as const satisfies Record<SortId, string>

const byOrder: Record<SortId, (a: CompareRow, b: CompareRow) => number> = {
  price_desc: (a, b) => (b.price_per_kg ?? 0) - (a.price_per_kg ?? 0),
  price_asc: (a, b) => (a.price_per_kg ?? 0) - (b.price_per_kg ?? 0),
  distance_asc: (a, b) => a.distance_km - b.distance_km,
  distance_desc: (a, b) => b.distance_km - a.distance_km,
}

/**
 * The compare rows in the chosen order (docs/02 §5.4). Areas without a price always come last;
 * ties keep the API's order. The rank shown on each row is the API's and never changes.
 */
export function sortRows(rows: readonly CompareRow[], sort: SortId): CompareRow[] {
  const byDistance = sort === 'distance_asc' || sort === 'distance_desc'
  return [...rows].sort((a, b) => {
    const aMissing = a.price_per_kg === null
    const bMissing = b.price_per_kg === null
    if (aMissing !== bMissing) return aMissing ? 1 : -1
    return aMissing && !byDistance ? 0 : byOrder[sort](a, b)
  })
}
