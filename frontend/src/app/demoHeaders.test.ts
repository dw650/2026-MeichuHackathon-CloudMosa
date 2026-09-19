import { describe, expect, it } from 'vitest'

import { DEFAULT_SETTINGS } from '@/store/settings'

import { demoHeaders } from './demoHeaders'

const base = { ...DEFAULT_SETTINGS, country: 'IN' as const, areaId: 'nashik', setupDone: true }

describe('demoHeaders', () => {
  it('sends nothing while every switch is off', () => {
    expect(demoHeaders(base)).toEqual({})
  })

  it('maps each switch to its header (docs/04 §6.2)', () => {
    const demo = { fail: true, stale: true, locate: 'TW:taipei' as const }
    expect(demoHeaders({ ...base, demo })).toEqual({
      'X-Demo-Fail': '1',
      'X-Demo-Stale': 'nashik:3',
      'X-Demo-Locate': 'TW:taipei',
    })
    expect(
      demoHeaders({ ...base, demo: { ...demo, fail: false, stale: false, locate: 'none' } }),
    ).toEqual({ 'X-Demo-Locate': 'none' })
  })

  it('cannot mark an area stale before one is chosen', () => {
    const demo = { fail: false, stale: true, locate: 'auto' as const }
    expect(demoHeaders({ ...base, areaId: null, demo })).toEqual({})
  })
})
