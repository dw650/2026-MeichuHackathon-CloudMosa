import { describe, expect, it } from 'vitest'

import {
  DIRECTION_GLYPH,
  FLAT_RATIO,
  directionOf,
  formatPercent,
  formatSignedPercent,
  priceDiffDirection,
} from './change'
import { MINUS, MISSING } from './format'
import { UNITS } from './units'

describe('directionOf', () => {
  it('is up or down from a 0.05% change', () => {
    expect(directionOf(0.042)).toBe('up')
    expect(directionOf(-0.12)).toBe('down')
    expect(directionOf(0.0005)).toBe('up')
    expect(directionOf(-0.0005)).toBe('down')
  })

  it('is flat under 0.05%', () => {
    expect(FLAT_RATIO).toBe(0.0005)
    expect(directionOf(0)).toBe('flat')
    expect(directionOf(0.00049)).toBe('flat')
    expect(directionOf(-0.00049)).toBe('flat')
  })

  it('has no direction for a missing ratio', () => {
    expect(directionOf(null)).toBeNull()
    expect(directionOf(undefined)).toBeNull()
  })
})

describe('DIRECTION_GLYPH', () => {
  it('maps the directions to ▲ ▼ ＝', () => {
    expect(DIRECTION_GLYPH).toEqual({ up: '▲', down: '▼', flat: '＝' })
  })
})

describe('formatPercent', () => {
  it('shows one decimal under 10%', () => {
    expect(formatPercent(0.042, 'en-IN')).toBe('4.2%')
    expect(formatPercent(0.042, 'zh-TW')).toBe('4.2%')
    expect(formatPercent(0.0005, 'en-IN')).toBe('0.1%')
  })

  it('shows whole percentages from 10%', () => {
    expect(formatPercent(0.1, 'en-IN')).toBe('10%')
    expect(formatPercent(0.12, 'zh-TW')).toBe('12%')
    expect(formatPercent(0.145, 'zh-TW')).toBe('15%')
    expect(formatPercent(12.5, 'en-IN')).toBe('1,250%')
  })

  it('shows only the size; the glyph carries the direction', () => {
    expect(formatPercent(-0.12, 'en-IN')).toBe('12%')
    expect(formatPercent(-0.031, 'zh-TW')).toBe('3.1%')
  })

  it('shows a flat change as 0%', () => {
    expect(formatPercent(0, 'en-IN')).toBe('0%')
    expect(formatPercent(0.00049, 'zh-TW')).toBe('0%')
    expect(formatPercent(-0.0004, 'zh-TW')).toBe('0%')
  })

  it('shows a missing ratio as a dash', () => {
    expect(formatPercent(null, 'en-IN')).toBe(MISSING)
    expect(formatPercent(undefined, 'en-IN')).toBe(MISSING)
    expect(formatPercent(Number.NaN, 'en-IN')).toBe(MISSING)
  })
})

describe('formatSignedPercent', () => {
  it('signs the percentage like a signed amount', () => {
    expect(formatSignedPercent(0.031, 'en-IN')).toBe('+3.1%')
    expect(formatSignedPercent(-0.031, 'en-IN')).toBe(`${MINUS}3.1%`)
    expect(formatSignedPercent(-0.12, 'zh-TW')).toBe(`${MINUS}12%`)
    expect(formatSignedPercent(0.0002, 'zh-TW')).toBe('±0%')
  })

  it('shows a missing ratio as a dash', () => {
    expect(formatSignedPercent(null, 'en-IN')).toBe(MISSING)
    expect(formatSignedPercent(Number.NaN, 'en-IN')).toBe(MISSING)
  })
})

describe('priceDiffDirection', () => {
  it('follows the sign the difference shows in the chosen unit', () => {
    expect(priceDiffDirection(0.95, UNITS.qtl)).toBe('up')
    expect(priceDiffDirection(-0.95, UNITS.kg)).toBe('down')
    expect(priceDiffDirection(0.006, UNITS.qtl)).toBe('up')
  })

  it('is flat when the difference rounds to zero', () => {
    expect(priceDiffDirection(0, UNITS.kg)).toBe('flat')
    expect(priceDiffDirection(0.004, UNITS.qtl)).toBe('flat')
    expect(priceDiffDirection(-0.04, UNITS.catty)).toBe('flat')
  })

  it('has no direction for a missing difference', () => {
    expect(priceDiffDirection(null, UNITS.kg)).toBeNull()
    expect(priceDiffDirection(undefined, UNITS.qtl)).toBeNull()
  })
})
