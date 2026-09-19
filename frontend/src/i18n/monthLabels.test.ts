import { describe, expect, it } from 'vitest'

import { formatDay, formatMonth } from '@/lib/monthly'

import { i18n } from './index'
import { monthLabels } from './monthLabels'

const zh = monthLabels(i18n.getFixedT('zh-TW'))
const en = monthLabels(i18n.getFixedT('en'))
const ms = monthLabels(i18n.getFixedT('ms'))
const hi = monthLabels(i18n.getFixedT('hi'))

describe('monthLabels', () => {
  it('names months in each language', () => {
    expect(formatMonth('2026-08-01', '2026-09-19', zh)).toBe('8 月')
    expect(formatMonth('2026-08-01', '2026-09-19', en)).toBe('Aug')
    expect(formatMonth('2025-12-01', '2026-01-19', zh)).toBe('2025 年 12 月')
    expect(formatMonth('2025-12-01', '2026-01-19', en)).toBe('Dec 2025')
    expect(formatMonth('2026-08-01', '2026-09-19', ms)).toBe('Ogo')
    expect(formatMonth('2025-12-01', '2026-01-19', ms)).toBe('Dis 2025')
    expect(formatMonth('2026-08-01', '2026-09-19', hi)).toBe('अग॰')
    expect(formatMonth('2025-12-01', '2026-01-19', hi)).toBe('दिस॰ 2025')
  })

  it('writes days the way each language reads them', () => {
    expect(formatDay('2026-09-19', zh)).toBe('9/19')
    expect(formatDay('2026-09-19', en)).toBe('19/9')
    expect(formatDay('2026-09-19', ms)).toBe('19/9')
    expect(formatDay('2026-09-19', hi)).toBe('19/9')
  })
})
