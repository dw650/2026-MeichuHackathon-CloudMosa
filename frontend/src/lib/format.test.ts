import { describe, expect, it } from 'vitest'

import {
  MINUS,
  MISSING,
  formatNumber,
  formatPrice,
  formatPriceDiff,
  formatSignedNumber,
  roundedSign,
} from './format'
import { UNITS } from './units'

describe('constants', () => {
  it('uses an em dash for missing values and U+2212 for minus', () => {
    expect(MISSING).toBe('—')
    expect(MINUS).toBe('−')
  })
})

describe('formatNumber', () => {
  it('groups Indian numbers in lakhs and crores', () => {
    expect(formatNumber(123450, 'en-IN', 0)).toBe('1,23,450')
    expect(formatNumber(12345678.9, 'en-IN', 1)).toBe('1,23,45,678.9')
  })

  it('groups Taiwanese numbers in thousands', () => {
    expect(formatNumber(12345.6, 'zh-TW', 1)).toBe('12,345.6')
  })

  it('always shows exactly the given number of decimals', () => {
    expect(formatNumber(23, 'zh-TW', 1)).toBe('23.0')
    expect(formatNumber(2349.6, 'en-IN', 0)).toBe('2,350')
  })

  it('rounds halves away from zero on the decimal value, not the binary one', () => {
    expect(formatNumber(0.15, 'zh-TW', 1)).toBe('0.2')
    expect(formatNumber(1.15 * 100, 'en-IN', 0)).toBe('115')
  })

  it('shows a missing or invalid number as a dash, never as 0', () => {
    expect(formatNumber(null, 'en-IN', 0)).toBe(MISSING)
    expect(formatNumber(undefined, 'en-IN', 0)).toBe(MISSING)
    expect(formatNumber(Number.NaN, 'en-IN', 0)).toBe(MISSING)
    expect(formatNumber(Number.POSITIVE_INFINITY, 'en-IN', 0)).toBe(MISSING)
  })

  it('writes negatives with U+2212 and never shows a negative zero', () => {
    expect(formatNumber(-3.21, 'zh-TW', 1)).toBe(`${MINUS}3.2`)
    expect(formatNumber(-0.04, 'zh-TW', 1)).toBe('0.0')
    expect(formatNumber(-0, 'en-IN', 0)).toBe('0')
  })
})

describe('formatSignedNumber', () => {
  it('prefixes + or U+2212', () => {
    expect(formatSignedNumber(95, 'en-IN', 0)).toBe('+95')
    expect(formatSignedNumber(-95, 'en-IN', 0)).toBe(`${MINUS}95`)
    expect(formatSignedNumber(-123450, 'en-IN', 0)).toBe(`${MINUS}1,23,450`)
  })

  it('rounds first and marks a zero result with ±', () => {
    expect(formatSignedNumber(0, 'zh-TW', 1)).toBe('±0.0')
    expect(formatSignedNumber(0.04, 'zh-TW', 1)).toBe('±0.0')
    expect(formatSignedNumber(-0.04, 'zh-TW', 1)).toBe('±0.0')
    expect(formatSignedNumber(-0.4, 'en-IN', 0)).toBe('±0')
    expect(formatSignedNumber(0.05, 'zh-TW', 1)).toBe('+0.1')
  })

  it('shows a missing value as a dash', () => {
    expect(formatSignedNumber(null, 'en-IN', 0)).toBe(MISSING)
    expect(formatSignedNumber(Number.NaN, 'en-IN', 0)).toBe(MISSING)
  })
})

describe('roundedSign', () => {
  it('is the sign of the value once rounded to the given decimals', () => {
    expect(roundedSign(0.05, 1)).toBe(1)
    expect(roundedSign(-0.05, 1)).toBe(-1)
    expect(roundedSign(0.04, 1)).toBe(0)
    expect(roundedSign(-0.04, 1)).toBe(0)
    expect(roundedSign(-0, 0)).toBe(0)
  })
})

describe('formatPrice', () => {
  it('converts the per-kg price into the unit and uses its decimals', () => {
    expect(formatPrice(23.5, UNITS.qtl, 'en-IN')).toBe('2,350')
    expect(formatPrice(1234.5, UNITS.qtl, 'en-IN')).toBe('1,23,450')
    expect(formatPrice(23.5, UNITS.kg, 'en-IN')).toBe('23.5')
    expect(formatPrice(38.5, UNITS.kg, 'zh-TW')).toBe('38.5')
    expect(formatPrice(38.5, UNITS.catty, 'zh-TW')).toBe('23.1')
  })

  it('shows a missing price as a dash', () => {
    expect(formatPrice(null, UNITS.qtl, 'en-IN')).toBe(MISSING)
    expect(formatPrice(undefined, UNITS.kg, 'zh-TW')).toBe(MISSING)
  })
})

describe('formatPriceDiff', () => {
  it('converts and signs the difference', () => {
    expect(formatPriceDiff(0.95, UNITS.qtl, 'en-IN')).toBe('+95')
    expect(formatPriceDiff(-0.95, UNITS.qtl, 'en-IN')).toBe(`${MINUS}95`)
    expect(formatPriceDiff(-2.5, UNITS.catty, 'zh-TW')).toBe(`${MINUS}1.5`)
  })

  it('rounds in the chosen unit before picking the sign', () => {
    expect(formatPriceDiff(0.004, UNITS.qtl, 'en-IN')).toBe('±0')
    expect(formatPriceDiff(0.006, UNITS.qtl, 'en-IN')).toBe('+1')
    expect(formatPriceDiff(0.04, UNITS.kg, 'zh-TW')).toBe('±0.0')
  })

  it('shows a missing difference as a dash', () => {
    expect(formatPriceDiff(null, UNITS.qtl, 'en-IN')).toBe(MISSING)
  })
})
