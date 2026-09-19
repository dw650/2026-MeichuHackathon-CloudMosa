import { describe, expect, it } from 'vitest'

import { locateGuess, setupAreaOrder, setupDepth, setupPath, stepAfterLanguage } from './flow'

describe('setup flow helpers', () => {
  it('keeps how deep the setup screens go in the URL', () => {
    expect(setupDepth('')).toBe(0)
    expect(setupDepth('?depth=2&page=2')).toBe(2)
    expect(setupDepth('?depth=-1')).toBe(0)
    expect(setupDepth('?depth=x')).toBe(0)
    expect(setupPath('lang', 0)).toBe('/setup/lang')
    expect(setupPath('country', 2)).toBe('/setup/country?depth=2')
  })

  it('checks the location first only when there is or may be a guess', () => {
    const guess = { country: 'IN', area_id: 'nashik' }
    const none = { country: null, area_id: null }
    expect(stepAfterLanguage({ isPending: true, data: undefined })).toBe('locate')
    expect(stepAfterLanguage({ isPending: false, data: guess })).toBe('locate')
    expect(stepAfterLanguage({ isPending: false, data: none })).toBe('country')
    // The lookup failed: no data.
    expect(stepAfterLanguage({ isPending: false, data: undefined })).toBe('country')
    expect(locateGuess(guess)).toEqual({ country: 'IN', areaId: 'nashik' })
    expect(locateGuess({ country: 'JP', area_id: 'tokyo' })).toBeNull()
    expect(locateGuess({ country: 'IN', area_id: null })).toBeNull()
  })

  it('lists the default area first, then the others nearest first', () => {
    const areas = [
      { id: 'far', lat: 10, lon: 10 },
      { id: 'home', lat: 0, lon: 0 },
      { id: 'near', lat: 1, lon: 1 },
    ]
    const order = setupAreaOrder(areas, 'home')
    expect(order.map((row) => row.area.id)).toEqual(['home', 'near', 'far'])
    expect(order[0]?.km).toBe(0)
    expect(order[1]?.km).toBeGreaterThan(0)
    expect(setupAreaOrder(areas, 'missing').map((row) => row.area.id)).toEqual([
      'far',
      'near',
      'home',
    ])
    expect(setupAreaOrder([], 'home')).toEqual([])
  })
})
