import { describe, expect, it } from 'vitest'

import {
  conversion,
  currencySymbol,
  formatMoney,
  formatMoneyDiff,
  moneyDiffDirection,
  NO_CONVERSION,
  priceDecimals,
  toMoney,
  type FxRate,
} from './money'
import { UNITS } from './units'

const RATES: FxRate[] = [
  { currency: 'INR', per_usd: 95.989567, rate_date: '2026-09-19' },
  { currency: 'MYR', per_usd: 4.081091, rate_date: '2026-09-19' },
  { currency: 'TWD', per_usd: 31.834145, rate_date: '2026-09-19' },
  { currency: 'USD', per_usd: 1, rate_date: '2026-09-19' },
]

describe('currencySymbol', () => {
  it('writes the symbol of each display currency, or the code when it has none', () => {
    expect([currencySymbol('TWD'), currencySymbol('MYR')]).toEqual(['NT$', 'RM'])
    expect([currencySymbol('INR'), currencySymbol('USD')]).toEqual(['₹', 'US$'])
    expect(currencySymbol('JPY')).toBe('JPY')
  })
})

describe('conversion', () => {
  it('keeps the local currency when that is what the user asked for', () => {
    const fx = conversion('TWD', 'local', RATES)
    expect(fx).toMatchObject({ converted: false, currency: 'TWD', factor: 1, reason: null })
    expect([fx.rateDate, fx.perUsd]).toEqual([null, null])
  })

  it('does not convert a country into its own currency', () => {
    expect(conversion('INR', 'INR', RATES)).toMatchObject({ converted: false, factor: 1 })
  })

  it('converts through the US dollar rates and names the day they are from', () => {
    const fx = conversion('INR', 'TWD', RATES)
    expect(fx.converted).toBe(true)
    expect(fx.currency).toBe('TWD')
    expect(fx.symbol).toBe('NT$')
    expect(fx.factor).toBeCloseTo(31.834145 / 95.989567, 10)
    expect([fx.rateDate, fx.perUsd]).toEqual(['2026-09-19', 31.834145])
  })

  it('takes the older of the two rate days, the conversion being no fresher', () => {
    const older = [{ ...RATES[0]!, rate_date: '2026-09-17' }, RATES[2]!]
    expect(conversion('INR', 'TWD', older).rateDate).toBe('2026-09-17')
    expect(conversion('TWD', 'INR', older).rateDate).toBe('2026-09-17')
  })

  it('takes one US dollar as one US dollar even when the list has no USD row', () => {
    const fx = conversion('INR', 'USD', [RATES[0]!])
    expect(fx.converted).toBe(true)
    expect(fx.factor).toBeCloseTo(1 / 95.989567, 10)
    expect(fx.rateDate).toBe('2026-09-19')
  })

  it('keeps the local currency and says why when a rate is missing', () => {
    const fx = conversion('TWD', 'INR', [RATES[2]!])
    expect(fx).toMatchObject({ converted: false, currency: 'TWD', factor: 1, reason: 'no_rate' })
  })

  it('refuses a rate that is not a positive number', () => {
    const broken = [{ currency: 'TWD', per_usd: 0, rate_date: '2026-09-19' }, RATES[0]!]
    expect(conversion('INR', 'TWD', broken).reason).toBe('no_rate')
  })

  it('shows nothing converted while the country is unknown', () => {
    const fx = conversion(null, 'TWD', RATES)
    expect(fx).toMatchObject({ converted: false, currency: '', reason: null })
    expect(NO_CONVERSION).toMatchObject({ converted: false, factor: 1, currency: '' })
  })
})

describe('priceDecimals', () => {
  it('writes NT$ and ₹ whole, RM and US$ with cents', () => {
    expect([priceDecimals(1919, 'INR'), priceDecimals(726, 'TWD')]).toEqual([0, 0])
    expect([priceDecimals(12.34, 'MYR'), priceDecimals(24.05, 'USD')]).toEqual([2, 2])
  })

  it('keeps digits on small numbers so a real price never reads as 0', () => {
    expect(priceDecimals(6.6, 'TWD')).toBe(1)
    expect(priceDecimals(0.66, 'TWD')).toBe(2)
    expect(priceDecimals(0.0066, 'TWD')).toBe(4)
    expect(priceDecimals(-0.66, 'INR')).toBe(2)
    expect(priceDecimals(0.21, 'USD')).toBe(2)
  })

  it('falls back to cents for a currency it does not know, and for 0 or nothing', () => {
    expect(priceDecimals(1919, 'JPY')).toBe(2)
    expect([priceDecimals(0, 'TWD'), priceDecimals(null, 'TWD')]).toEqual([0, 0])
  })
})

describe('toMoney', () => {
  const fx = conversion('INR', 'TWD', RATES)

  it('converts a per-kg price into the unit and the currency shown', () => {
    // ₹1,919/qtl = ₹19.19/kg ≈ NT$6.36/kg ≈ NT$636/qtl
    expect(toMoney(19.19, UNITS.qtl, fx)!).toBeCloseTo(636.4, 1)
    expect(toMoney(19.19, UNITS.kg, fx)!).toBeCloseTo(6.364, 3)
  })

  it('leaves a missing price missing and a local price untouched', () => {
    expect(toMoney(null, UNITS.kg, fx)).toBeNull()
    expect(toMoney(19.19, UNITS.qtl, conversion('INR', 'local', RATES))).toBeCloseTo(1919, 6)
  })
})

describe('formatMoney', () => {
  it('formats a local price with the digits of its unit', () => {
    const fx = conversion('TWD', 'local', RATES)
    expect(formatMoney(21.5, UNITS.kg, 'zh-TW', fx)).toBe('21.5')
    expect(formatMoney(19.19, UNITS.qtl, 'en-IN', fx)).toBe('1,919')
  })

  it('formats a converted price with the digits of its currency', () => {
    expect(formatMoney(19.19, UNITS.qtl, 'en-IN', conversion('INR', 'TWD', RATES))).toBe('636')
    expect(formatMoney(19.19, UNITS.kg, 'en-IN', conversion('INR', 'USD', RATES))).toBe('0.20')
    expect(formatMoney(21.5, UNITS.kg, 'zh-TW', conversion('TWD', 'MYR', RATES))).toBe('2.76')
  })

  it('shows a missing price as — in both currencies', () => {
    expect(formatMoney(null, UNITS.kg, 'zh-TW', conversion('TWD', 'USD', RATES))).toBe('—')
    expect(formatMoney(undefined, UNITS.kg, 'zh-TW', NO_CONVERSION)).toBe('—')
  })
})

describe('formatMoneyDiff', () => {
  const fx = conversion('INR', 'TWD', RATES)

  it('signs a converted difference and writes a rounded zero as ±0', () => {
    expect(formatMoneyDiff(0.95, UNITS.qtl, 'en-IN', fx)).toBe('+32')
    expect(formatMoneyDiff(-0.95, UNITS.qtl, 'en-IN', fx)).toBe('−32')
    expect(formatMoneyDiff(0, UNITS.qtl, 'en-IN', fx)).toBe('±0')
    expect(formatMoneyDiff(null, UNITS.qtl, 'en-IN', fx)).toBe('—')
  })

  it('keeps the unit digits when nothing is converted', () => {
    expect(formatMoneyDiff(0.95, UNITS.kg, 'zh-TW', NO_CONVERSION)).toBe('+1.0')
  })
})

describe('moneyDiffDirection', () => {
  const fx = conversion('INR', 'TWD', RATES)

  it('follows the number that is shown, converted or not', () => {
    expect(moneyDiffDirection(0.95, UNITS.qtl, fx)).toBe('up')
    expect(moneyDiffDirection(-0.95, UNITS.qtl, fx)).toBe('down')
    expect(moneyDiffDirection(0, UNITS.qtl, fx)).toBe('flat')
    // A difference too small to write with four digits reads as no change at all.
    expect(moneyDiffDirection(1e-9, UNITS.qtl, fx)).toBe('flat')
    expect(moneyDiffDirection(null, UNITS.qtl, fx)).toBeNull()
  })

  it('leaves a local difference to the unit rule', () => {
    expect(moneyDiffDirection(0.95, UNITS.qtl, NO_CONVERSION)).toBe('up')
    expect(moneyDiffDirection(null, UNITS.qtl, NO_CONVERSION)).toBeNull()
  })
})
