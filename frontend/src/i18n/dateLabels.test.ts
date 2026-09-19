import { act, renderHook } from '@testing-library/react'
import { useTranslation } from 'react-i18next'
import { afterEach, describe, expect, it } from 'vitest'

import { describeFreshness, formatDate, formatDateTime, formatDaysAgo } from '@/lib/dates'

import { dateLabels } from './dateLabels'
import { i18n, setLanguage } from './index'

const zh = dateLabels(i18n.getFixedT('zh-TW'))
const en = dateLabels(i18n.getFixedT('en'))

afterEach(() => {
  setLanguage('en')
})

describe('dateLabels', () => {
  it('formats trade dates in each language', () => {
    expect(formatDate('2026-09-19', zh)).toBe('9/19 週六')
    expect(formatDate('2026-09-19', en)).toBe('Sat 19/9')
    expect(formatDate('2026-09-13', zh)).toBe('9/13 週日')
    expect(formatDate('2026-09-13', en)).toBe('Sun 13/9')
  })

  it('formats data times the same way in both languages', () => {
    expect(formatDateTime('2026-09-19T11:40:00+05:30', zh)).toBe('9/19 11:40')
    expect(formatDateTime('2026-09-19T11:40:00+05:30', en)).toBe('9/19 11:40')
  })

  it('labels old data', () => {
    expect(formatDaysAgo(1, zh)).toBe('昨天')
    expect(formatDaysAgo(1, en)).toBe('Yesterday')
    expect(formatDaysAgo(3, zh)).toBe('3 天前')
    expect(formatDaysAgo(3, en)).toBe('3d ago')
  })

  it('labels missing data', () => {
    const none = { days: null, state: 'none' } as const
    expect(describeFreshness(none, null, zh)).toEqual({ text: '無資料', warn: false })
    expect(describeFreshness(none, null, en)).toEqual({ text: 'No data', warn: false })
  })

  it('follows language changes through useTranslation', () => {
    const { result } = renderHook(() => dateLabels(useTranslation().t))
    expect(formatDate('2026-09-19', result.current)).toBe('Sat 19/9')
    act(() => {
      setLanguage('zh-TW')
    })
    expect(formatDate('2026-09-19', result.current)).toBe('9/19 週六')
    act(() => {
      setLanguage('hi')
    })
    expect(formatDaysAgo(2, result.current)).toBe('2d ago')
  })
})
