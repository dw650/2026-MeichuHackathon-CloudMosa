import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  STALE_WARN_DAYS,
  describeFreshness,
  formatDate,
  formatDateTime,
  formatDaysAgo,
  formatTime,
  parseLocalDate,
  parseLocalDateTime,
  type DateLabels,
} from './dates'
import { MISSING } from './format'

// Mirrors STR in docs/ui-mockup/src/data.js; the real labels come from i18n (T17).
const zh: DateLabels = {
  weekdays: ['日', '一', '二', '三', '四', '五', '六'],
  date: ({ m, d, w }) => `${m}/${d} 週${w}`,
  dateTime: ({ m, d, time }) => `${m}/${d} ${time}`,
  yesterday: '昨天',
  daysAgo: ({ n }) => `${n} 天前`,
  none: '無資料',
}
const en: DateLabels = {
  weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  date: ({ m, d, w }) => `${w} ${d}/${m}`,
  dateTime: ({ m, d, time }) => `${m}/${d} ${time}`,
  yesterday: 'Yesterday',
  daysAgo: ({ n }) => `${n}d ago`,
  none: 'No data',
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('parseLocalDate', () => {
  it('reads a trade date and its weekday', () => {
    expect(parseLocalDate('2026-09-19')).toEqual({ year: 2026, month: 9, day: 19, weekday: 6 })
    expect(parseLocalDate('2026-09-20')?.weekday).toBe(0)
    expect(parseLocalDate('2024-02-29')).toEqual({ year: 2024, month: 2, day: 29, weekday: 4 })
  })

  it('rejects anything that is not a real YYYY-MM-DD date', () => {
    for (const value of [
      '2026-02-29',
      '2026-09-31',
      '2026-13-01',
      '2026-00-10',
      '0026-09-19',
      '2026-9-19',
      '2026-09-19T11:40:00+05:30',
      'soon',
      '',
      null,
      undefined,
    ]) {
      expect(parseLocalDate(value)).toBeNull()
    }
  })
})

describe('parseLocalDateTime', () => {
  it('reads the wall-clock time as written, without converting the offset', () => {
    expect(parseLocalDateTime('2026-09-19T11:40:00+05:30')).toEqual({
      year: 2026,
      month: 9,
      day: 19,
      weekday: 6,
      hour: 11,
      minute: 40,
    })
    expect(parseLocalDateTime('2026-09-19T23:50:00-10:00')).toMatchObject({
      day: 19,
      hour: 23,
      minute: 50,
    })
  })

  it('accepts fractions, Z, a missing offset and missing seconds', () => {
    for (const value of [
      '2026-09-19T09:30:00.123456+08:00',
      '2026-09-19T09:30:00Z',
      '2026-09-19T09:30:00',
      '2026-09-19T09:30+0800',
    ]) {
      expect(parseLocalDateTime(value)).toMatchObject({ month: 9, day: 19, hour: 9, minute: 30 })
    }
  })

  it('rejects invalid timestamps', () => {
    for (const value of [
      '2026-09-19T24:00:00+05:30',
      '2026-09-19T11:60:00+05:30',
      '2026-02-30T11:40:00+05:30',
      '2026-09-19',
      '2026-09-19T11:40:00+05:30 ',
      null,
      undefined,
    ]) {
      expect(parseLocalDateTime(value)).toBeNull()
    }
  })
})

describe('formatDate', () => {
  it('writes zh as "9/19 週六" and en as "Sat 19/9"', () => {
    expect(formatDate('2026-09-19', zh)).toBe('9/19 週六')
    expect(formatDate('2026-09-19', en)).toBe('Sat 19/9')
    expect(formatDate('2027-01-03', zh)).toBe('1/3 週日')
    expect(formatDate('2027-01-03', en)).toBe('Sun 3/1')
  })

  it('shows an invalid date as a dash', () => {
    expect(formatDate('2026-02-30', zh)).toBe(MISSING)
    expect(formatDate(null, en)).toBe(MISSING)
  })

  it('leaves the weekday empty when the labels lack it', () => {
    expect(formatDate('2026-09-19', { ...en, weekdays: [] })).toBe(' 19/9')
  })
})

describe('formatTime', () => {
  it('shows the wall-clock time of a timestamp as HH:mm', () => {
    expect(formatTime('2026-09-19T11:40:00+05:30')).toBe('11:40')
    expect(formatTime('2026-09-19T09:05:00+08:00')).toBe('09:05')
  })

  it('shows an invalid timestamp as a dash', () => {
    expect(formatTime('11:40')).toBe(MISSING)
    expect(formatTime(undefined)).toBe(MISSING)
  })
})

describe('formatDateTime', () => {
  it('writes the data time as "9/19 11:40"', () => {
    expect(formatDateTime('2026-09-19T11:40:00+05:30', zh)).toBe('9/19 11:40')
    expect(formatDateTime('2026-09-19T09:30:00+08:00', en)).toBe('9/19 09:30')
  })

  it('shows an invalid timestamp as a dash', () => {
    expect(formatDateTime('2026-09-19', zh)).toBe(MISSING)
  })
})

describe('time zone independence (docs/08 §9)', () => {
  it('gives the same text whatever the runtime time zone is', () => {
    for (const zone of ['Etc/GMT+12', 'Etc/GMT-14', 'Asia/Kolkata']) {
      vi.stubEnv('TZ', zone)
      expect(formatDate('2026-09-19', zh)).toBe('9/19 週六')
      expect(formatDate('2026-09-19', en)).toBe('Sat 19/9')
      expect(formatDateTime('2026-09-19T23:50:00+08:00', zh)).toBe('9/19 23:50')
      expect(formatDateTime('2026-09-19T00:10:00+05:30', zh)).toBe('9/19 00:10')
    }
  })
})

describe('formatDaysAgo', () => {
  it('has no label for today', () => {
    expect(formatDaysAgo(0, zh)).toBe('')
  })

  it('says yesterday for one day', () => {
    expect(formatDaysAgo(1, zh)).toBe('昨天')
    expect(formatDaysAgo(1, en)).toBe('Yesterday')
  })

  it('counts the days from two days on', () => {
    expect(formatDaysAgo(2, zh)).toBe('2 天前')
    expect(formatDaysAgo(3, zh)).toBe('3 天前')
    expect(formatDaysAgo(3, en)).toBe('3d ago')
  })
})

describe('describeFreshness (docs/06 §3.5)', () => {
  it('adds nothing for today', () => {
    expect(describeFreshness({ days: 0, state: 'today' }, '2026-09-19', zh)).toEqual({
      text: '',
      warn: false,
    })
  })

  it('labels stale data and warns from three days', () => {
    expect(STALE_WARN_DAYS).toBe(3)
    const stale = (days: number, labels: DateLabels) =>
      describeFreshness({ days, state: 'stale' }, '2026-09-10', labels)
    expect(stale(1, zh)).toEqual({ text: '昨天', warn: false })
    expect(stale(2, zh)).toEqual({ text: '2 天前', warn: false })
    expect(stale(3, zh)).toEqual({ text: '3 天前', warn: true })
    expect(stale(9, en)).toEqual({ text: '9d ago', warn: true })
  })

  it('shows the trade date without a warning when only market holidays passed', () => {
    expect(describeFreshness({ days: 1, state: 'closed' }, '2026-09-20', zh)).toEqual({
      text: '9/20 週日',
      warn: false,
    })
    expect(describeFreshness({ days: 1, state: 'closed' }, '2026-09-20', en).text).toBe('Sun 20/9')
  })

  it('says no data when there is no price in 30 days', () => {
    expect(describeFreshness({ days: null, state: 'none' }, null, zh)).toEqual({
      text: '無資料',
      warn: false,
    })
  })

  it('treats a stale state without a day count as today', () => {
    expect(describeFreshness({ days: null, state: 'stale' }, null, en)).toEqual({
      text: '',
      warn: false,
    })
  })
})
