import { describe, expect, it } from 'vitest'

import { isCropIconId } from '@/icons/names'

import { DEFAULT_CATEGORY_TONE, RECENT_CATEGORY, toneOf } from './categories'

describe('categories', () => {
  it('keeps the tones of the default seven categories (docs/03 §3.1)', () => {
    expect(DEFAULT_CATEGORY_TONE).toEqual({
      cereal: 'amber',
      veg: 'green',
      fruit: 'orange',
      pulse: 'olive',
      spice: 'red',
      oil: 'yellow',
      other: 'slate',
    })
  })

  it('draws the 「最近」 tile with its own illustration and colour', () => {
    expect(RECENT_CATEGORY).toEqual({ id: 'recent', icon: 'clockc', tone: 'purple' })
    expect(isCropIconId(RECENT_CATEGORY.icon)).toBe(true)
  })

  it("takes a category's tone from the country's list first", () => {
    const taiwan = [
      { id: 'leafy', tone: 'green' as const },
      { id: 'spice', tone: 'blue' as const },
    ]
    expect(toneOf('leafy', taiwan)).toBe('green')
    expect(toneOf('spice', taiwan)).toBe('blue')
    // Outside the list (the international series): the default seven.
    expect(toneOf('cereal', taiwan)).toBe('amber')
    expect(toneOf('veg')).toBe('green')
  })

  it('uses the "other" tone for unknown or missing categories', () => {
    expect(toneOf('mushroom')).toBe('slate')
    expect(toneOf('toString')).toBe('slate')
    expect(toneOf(null)).toBe('slate')
    expect(toneOf(undefined, [{ id: 'leafy', tone: 'green' }])).toBe('slate')
  })
})
