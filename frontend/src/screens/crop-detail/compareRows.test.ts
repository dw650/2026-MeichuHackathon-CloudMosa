import { describe, expect, it } from 'vitest'

import type { CompareRow } from '@/api/queries'

import { sortRows } from './compareRows'

const row = (area_id: string, price: number | null, km: number): CompareRow => ({
  area_id,
  price_per_kg: price,
  distance_km: km,
  diff_per_kg: null,
  is_base: false,
  n_markets: 1,
  rank: null,
  staleness: { days: 0, state: 'today' },
  trade_date: null,
})

// In the API's order: price high → low, no data last.
const rows = [row('a', 30, 50), row('b', 20, 10), row('c', 20, 5), row('none', null, 1)]
const ids = (sorted: CompareRow[]) => sorted.map((r) => r.area_id)

describe('sortRows', () => {
  it('orders by price either way, ties in the API order, no data last', () => {
    expect(ids(sortRows(rows, 'price_desc'))).toEqual(['a', 'b', 'c', 'none'])
    expect(ids(sortRows(rows, 'price_asc'))).toEqual(['b', 'c', 'a', 'none'])
  })

  it('orders by distance either way, no data last', () => {
    expect(ids(sortRows(rows, 'distance_asc'))).toEqual(['c', 'b', 'a', 'none'])
    expect(ids(sortRows(rows, 'distance_desc'))).toEqual(['a', 'b', 'c', 'none'])
  })
})
