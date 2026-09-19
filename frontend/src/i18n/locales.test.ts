import { describe, expect, it } from 'vitest'

import { i18n } from './index'
import en from './locales/en.json'
import zhTW from './locales/zh-TW.json'

/** Every leaf as [path, value]; array items get their index (`date.weekdays.0`). */
function leaves(tree: unknown, path = ''): [string, unknown][] {
  if (tree !== null && typeof tree === 'object') {
    return Object.entries(tree).flatMap(([key, value]) =>
      leaves(value, path ? `${path}.${key}` : key),
    )
  }
  return [[path, tree]]
}

const placeholders = (text: unknown) =>
  [...String(text).matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1]).sort()

const zhLeaves = new Map(leaves(zhTW))
const enLeaves = new Map(leaves(en))
const allLeaves = [...zhLeaves, ...enLeaves]

const zhT = i18n.getFixedT('zh-TW')
const enT = i18n.getFixedT('en')

describe('locale files', () => {
  it('have exactly the same keys', () => {
    expect([...zhLeaves.keys()].sort()).toEqual([...enLeaves.keys()].sort())
  })

  it('hold only non-empty strings', () => {
    for (const [path, value] of allLeaves) {
      expect(typeof value === 'string' && value.trim() !== '', path).toBe(true)
    }
  })

  it('use the same placeholders in both languages', () => {
    for (const [path, value] of zhLeaves) {
      expect(placeholders(value), path).toEqual(placeholders(enLeaves.get(path)))
    }
  })

  it('have no mockup-style {x} placeholders left', () => {
    for (const [path, value] of allLeaves) {
      expect(String(value), path).not.toMatch(/(?:^|[^{])\{\w+\}(?!\})/)
    }
  })

  it('are both loaded, so every key resolves in both languages', () => {
    const lookUp = (t: typeof zhT, key: string) => (t as unknown as (k: string) => string)(key)
    for (const [path, value] of zhLeaves) {
      if (placeholders(value).length === 0) expect(lookUp(zhT, path)).toBe(value)
    }
    for (const [path, value] of enLeaves) {
      if (placeholders(value).length === 0) expect(lookUp(enT, path)).toBe(value)
    }
  })
})

describe('interpolation', () => {
  it('fills variables in Traditional Chinese', () => {
    expect(zhT('home.title', { area: '臺北市' })).toBe('臺北市行情')
    expect(zhT('detail.compare.rank', { area: 'Nashik 縣', rank: 2, total: 11 })).toBe(
      'Nashik 縣 價格排第 2／11',
    )
    expect(zhT('states.lastPrice', { when: '3 天前', price: '2,340' })).toBe(
      '最近一筆（3 天前）：2,340',
    )
    expect(zhT('detail.today.marketsRange', { high: '24.9', low: '22.8' })).toBe(
      '最高 24.9・最低 22.8',
    )
    expect(zhT('setup.step', { step: 1, total: 3 })).toBe('第 1 步，共 3 步')
    expect(zhT('common.page', { page: 1, total: 2 })).toBe('第 1／2 頁')
  })

  it('fills variables in English', () => {
    expect(enT('home.title', { area: 'Nashik' })).toBe('Nashik prices')
    expect(enT('detail.compare.rank', { area: 'Nashik', rank: 2, total: 11 })).toBe(
      'Nashik: price rank 2/11',
    )
    expect(enT('states.lastPrice', { when: '3d ago', price: '2,340' })).toBe('Last (3d ago): 2,340')
    expect(enT('detail.today.marketsRange', { high: '24.9', low: '22.8' })).toBe(
      'High 24.9 · Low 22.8',
    )
    expect(enT('setup.step', { step: 1, total: 3 })).toBe('Step 1 of 3')
    expect(enT('common.page', { page: 1, total: 2 })).toBe('Page 1/2')
  })

  it('leaves escaping to React', () => {
    expect(enT('home.title', { area: 'A & <B>' })).toBe('A & <B> prices')
  })

  it('uses the English singular for one market', () => {
    expect(enT('detail.today.markets', { count: 1 })).toBe('1 market in this area')
    expect(enT('detail.today.markets', { count: 7 })).toBe('7 markets in this area')
    expect(enT('detail.compare.marketCount', { count: 1 })).toBe('1 mkt')
    expect(enT('detail.compare.marketCount', { count: 3 })).toBe('3 mkts')
    expect(zhT('detail.today.markets', { count: 1 })).toBe('本地區 1 個市場')
    expect(zhT('detail.compare.marketCount', { count: 3 })).toBe('3 市場')
  })

  it('returns lists as arrays', () => {
    expect(zhT('date.weekdays', { returnObjects: true })).toEqual([
      '日',
      '一',
      '二',
      '三',
      '四',
      '五',
      '六',
    ])
    expect(enT('date.weekdays', { returnObjects: true })).toEqual([
      'Sun',
      'Mon',
      'Tue',
      'Wed',
      'Thu',
      'Fri',
      'Sat',
    ])
  })
})
