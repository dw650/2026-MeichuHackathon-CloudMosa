import { describe, expect, it } from 'vitest'

import { type NearbyRow, nearbySlots, nearbyTargets } from './nearbyRows'

const row = (area_id: string, diff: number, is_base = false): NearbyRow => ({
  area_id,
  price_per_kg: 24 + diff,
  diff_per_kg: diff,
  distance_km: is_base ? 0 : 100,
  is_base,
})

const both = { highest: row('pune', 1), lowest: row('ahmednagar', -1) }
const hereHighest = { highest: row('delhi', 0, true), lowest: row('agra', -3) }
const hereLowest = { highest: row('pune', 3), lowest: row('nashik', 0, true) }

describe('nearbySlots', () => {
  it('puts the highest first, then the lowest', () => {
    expect(nearbySlots(both).map((s) => s.side)).toEqual(['highest', 'lowest'])
    expect(nearbySlots(hereHighest).map((s) => s.side)).toEqual(['highest', 'lowest'])
  })

  it('puts the viewed area’s own row first, so the last row takes the focus', () => {
    expect(nearbySlots(hereLowest)).toEqual([
      { focusId: 'nearby-low', side: 'lowest' },
      { focusId: 'nearby-high', side: 'highest' },
    ])
  })
})

describe('nearbyTargets', () => {
  it('lists the highest, then the lowest nearby area', () => {
    expect(nearbyTargets(both)).toEqual([
      { focusId: 'nearby-high', areaId: 'pune' },
      { focusId: 'nearby-low', areaId: 'ahmednagar' },
    ])
  })

  it('leaves out the viewed area, which has nothing to open', () => {
    expect(nearbyTargets(hereHighest)).toEqual([{ focusId: 'nearby-low', areaId: 'agra' }])
    expect(nearbyTargets(hereLowest)).toEqual([{ focusId: 'nearby-high', areaId: 'pune' }])
  })

  it('has nothing without nearby prices', () => {
    expect(nearbyTargets(null)).toEqual([])
    expect(nearbyTargets(undefined)).toEqual([])
  })
})
