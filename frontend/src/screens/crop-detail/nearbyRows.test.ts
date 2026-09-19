import { describe, expect, it } from 'vitest'

import { type NearbyRow, nearbyTargets } from './nearbyRows'

const row = (area_id: string, diff: number, is_base = false): NearbyRow => ({
  area_id,
  price_per_kg: 24 + diff,
  diff_per_kg: diff,
  distance_km: is_base ? 0 : 100,
  is_base,
})

describe('nearbyTargets', () => {
  it('lists the highest, then the lowest nearby area', () => {
    expect(nearbyTargets({ highest: row('pune', 1), lowest: row('ahmednagar', -1) })).toEqual([
      { focusId: 'nearby-high', areaId: 'pune' },
      { focusId: 'nearby-low', areaId: 'ahmednagar' },
    ])
  })

  it('leaves out the viewed area, which has nothing to open', () => {
    expect(nearbyTargets({ highest: row('delhi', 0, true), lowest: row('agra', -3) })).toEqual([
      { focusId: 'nearby-low', areaId: 'agra' },
    ])
    expect(nearbyTargets({ highest: row('pune', 3), lowest: row('nashik', 0, true) })).toEqual([
      { focusId: 'nearby-high', areaId: 'pune' },
    ])
  })

  it('has nothing without nearby prices', () => {
    expect(nearbyTargets(null)).toEqual([])
    expect(nearbyTargets(undefined)).toEqual([])
  })
})
