import { describe, expect, it } from 'vitest'

import { byDistance, distanceKm } from './geo'

const nashik = { lat: 20.0, lon: 73.79 }
const pune = { lat: 18.52, lon: 73.86 }
const delhi = { lat: 28.7, lon: 77.1 }

describe('distanceKm', () => {
  it('is the straight-line distance between centres, rounded to whole km', () => {
    expect(distanceKm(nashik, pune)).toBe(165)
    expect(distanceKm(nashik, nashik)).toBe(0)
  })
})

describe('byDistance', () => {
  it('orders places from the nearest to the farthest', () => {
    const places = [
      { id: 'delhi', ...delhi },
      { id: 'pune', ...pune },
      { id: 'nashik', ...nashik },
    ]
    expect(byDistance(places, nashik).map((p) => p.id)).toEqual(['nashik', 'pune', 'delhi'])
  })
})
