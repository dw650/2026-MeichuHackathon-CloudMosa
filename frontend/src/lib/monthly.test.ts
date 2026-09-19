import { describe, expect, it } from 'vitest'

import { MISSING } from './format'
import {
  describeMonth,
  formatDay,
  formatMonth,
  formatUsd,
  monthName,
  monthsBetween,
  parseMonth,
  STALE_MONTHS,
  type MonthLabels,
} from './monthly'

const zh: MonthLabels = {
  names: Array.from({ length: 12 }, (_, i) => `${i + 1} 月`),
  withYear: ({ month, y }) => `${y} 年 ${month}`,
  day: ({ m, d }) => `${m}/${d}`,
}
const en: MonthLabels = {
  names: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  withYear: ({ month, y }) => `${month} ${y}`,
  day: ({ m, d }) => `${d}/${m}`,
}

describe('parseMonth', () => {
  it('reads the first day of a month, a plain month or a date', () => {
    expect(parseMonth('2026-08-01')).toEqual({ year: 2026, month: 8 })
    expect(parseMonth('2026-08')).toEqual({ year: 2026, month: 8 })
    expect(parseMonth('2026-09-20')).toEqual({ year: 2026, month: 9 })
  })

  it('refuses anything else', () => {
    for (const value of [null, undefined, '', '2026M08', '2026-13-01', '2026-00-01', '26-08-01']) {
      expect(parseMonth(value)).toBeNull()
    }
  })
})

describe('monthsBetween', () => {
  it('counts across years, positive towards the future', () => {
    expect(monthsBetween({ year: 2025, month: 12 }, { year: 2026, month: 2 })).toBe(2)
    expect(monthsBetween({ year: 2026, month: 8 }, { year: 2026, month: 8 })).toBe(0)
    expect(monthsBetween({ year: 2026, month: 9 }, { year: 2026, month: 8 })).toBe(-1)
  })
})

describe('formatMonth', () => {
  it('names a month of the current year alone', () => {
    expect(formatMonth('2026-08-01', '2026-09-20', zh)).toBe('8 月')
    expect(formatMonth('2026-08-01', '2026-09-20', en)).toBe('Aug')
  })

  it('adds the year for another year, or when asked', () => {
    expect(formatMonth('2025-12-01', '2026-01-05', zh)).toBe('2025 年 12 月')
    expect(formatMonth('2025-12-01', '2026-01-05', en)).toBe('Dec 2025')
    expect(formatMonth('2026-08-01', '2026-09-20', zh, { withYear: true })).toBe('2026 年 8 月')
    expect(formatMonth('2026-08-01', null, en)).toBe('Aug 2026')
  })

  it('shows MISSING for no month', () => {
    expect(formatMonth(null, '2026-09-20', zh)).toBe(MISSING)
    expect(monthName('nope', en)).toBe(MISSING)
    expect(monthName('2026-03-01', en)).toBe('Mar')
  })
})

describe('describeMonth', () => {
  it('flags months far behind today only', () => {
    expect(describeMonth('2026-08-01', '2026-09-20', zh)).toEqual({ text: '8 月', warn: false })
    expect(describeMonth('2026-07-01', '2026-09-01', zh).warn).toBe(false)
    expect(STALE_MONTHS).toBe(3)
    expect(describeMonth('2026-06-01', '2026-09-20', zh)).toEqual({ text: '6 月', warn: true })
    expect(describeMonth('2025-11-01', '2026-01-10', en)).toEqual({
      text: 'Nov 2025',
      warn: false,
    })
  })

  it('never flags without both months', () => {
    expect(describeMonth(null, '2026-09-20', zh)).toEqual({ text: MISSING, warn: false })
    expect(describeMonth('2020-01-01', undefined, en).warn).toBe(false)
  })
})

describe('formatDay', () => {
  it('writes the day in each language, without a weekday', () => {
    expect(formatDay('2026-09-19', zh)).toBe('9/19')
    expect(formatDay('2026-09-02', en)).toBe('2/9')
    expect(formatDay(null, en)).toBe(MISSING)
  })
})

describe('formatUsd', () => {
  it('keeps the published decimals, at most two, in the country locale', () => {
    expect(formatUsd(471, 'en-IN')).toBe('471')
    expect(formatUsd(233.8, 'zh-TW')).toBe('233.8')
    expect(formatUsd(0.38, 'en-IN')).toBe('0.38')
    expect(formatUsd(1117, 'zh-TW')).toBe('1,117')
    expect(formatUsd(123456.789, 'en-IN')).toBe('1,23,456.79')
  })

  it('shows MISSING for no price', () => {
    expect(formatUsd(null, 'en-IN')).toBe(MISSING)
    expect(formatUsd(Number.NaN, 'en-IN')).toBe(MISSING)
  })
})
