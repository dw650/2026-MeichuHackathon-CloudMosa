import { describe, expect, it } from 'vitest'

import { isCropIconId } from '@/icons/names'

import { CATEGORY_ICON, CATEGORY_IDS, CATEGORY_TONE, toneOf } from './categories'

describe('categories', () => {
  it('lists the categories in keypad order 1–9 (docs/02 §5.2)', () => {
    expect(CATEGORY_IDS).toEqual([
      'cereal',
      'veg',
      'fruit',
      'pulse',
      'spice',
      'oil',
      'other',
      'all',
      'recent',
    ])
  })

  it('gives every category its tone from docs/03 §3.1', () => {
    expect(CATEGORY_TONE).toEqual({
      cereal: 'amber',
      veg: 'green',
      fruit: 'orange',
      pulse: 'olive',
      spice: 'red',
      oil: 'yellow',
      other: 'slate',
      all: 'blue',
      recent: 'purple',
    })
  })

  it('draws every category with an existing crop illustration', () => {
    for (const id of CATEGORY_IDS) expect(isCropIconId(CATEGORY_ICON[id])).toBe(true)
  })

  it('uses the "other" tone for unknown or missing categories', () => {
    expect(toneOf('veg')).toBe('green')
    expect(toneOf('mushroom')).toBe('slate')
    expect(toneOf('toString')).toBe('slate')
    expect(toneOf(null)).toBe('slate')
  })
})
