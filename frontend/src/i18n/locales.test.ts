import { describe, expect, it } from 'vitest'

import { i18n } from './index'
import en from './locales/en.json'
import hi from './locales/hi.json'
import ms from './locales/ms.json'
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
/** Machine translations pending native review; they may miss keys added to zh-TW and en. */
const partial = { ms: new Map(leaves(ms)), hi: new Map(leaves(hi)) }
const allLeaves = [...zhLeaves, ...enLeaves, ...partial.ms, ...partial.hi]

const zhT = i18n.getFixedT('zh-TW')
const enT = i18n.getFixedT('en')
const msT = i18n.getFixedT('ms')
const hiT = i18n.getFixedT('hi')

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

  it('are all loaded, so every key resolves in every language', () => {
    const lookUp = (t: typeof zhT, key: string) => (t as unknown as (k: string) => string)(key)
    for (const [path, value] of zhLeaves) {
      if (placeholders(value).length === 0) expect(lookUp(zhT, path)).toBe(value)
    }
    for (const [path, value] of enLeaves) {
      if (placeholders(value).length === 0) expect(lookUp(enT, path)).toBe(value)
    }
    for (const [t, tree] of [
      [msT, partial.ms],
      [hiT, partial.hi],
    ] as const) {
      for (const [path, value] of tree) {
        if (placeholders(value).length === 0) expect(lookUp(t, path)).toBe(value)
      }
    }
  })
})

// Other work adds keys to zh-TW and en first; ms and hi catch up later, so a missing key is
// reported (and shown in English at runtime) instead of failing the build.
describe.each(Object.entries(partial))('%s locale file', (language, tree) => {
  it('reports its coverage of the English keys', () => {
    const missing = [...enLeaves.keys()].filter((path) => !tree.has(path))
    const covered = enLeaves.size - missing.length
    const percent = ((covered / enLeaves.size) * 100).toFixed(1)
    console.info(
      `${language}.json: ${covered}/${enLeaves.size} keys (${percent}%)` +
        (missing.length ? `; English is shown for: ${missing.join(', ')}` : ''),
    )
    expect(covered).toBeGreaterThan(0)
  })

  it('has no key that English does not have', () => {
    expect([...tree.keys()].filter((path) => !enLeaves.has(path))).toEqual([])
  })

  it('uses the same placeholders as English', () => {
    for (const [path, value] of tree) {
      expect(placeholders(value), path).toEqual(placeholders(enLeaves.get(path)))
    }
  })
})

describe('fallback to English', () => {
  it('shows English for a key that Malay or Hindi does not have yet', () => {
    i18n.addResource('en', 'translation', 'test.onlyInEnglish', 'Only English')
    const lookUp = (t: typeof msT) => (t as unknown as (k: string) => string)('test.onlyInEnglish')
    expect(lookUp(msT)).toBe('Only English')
    expect(lookUp(hiT)).toBe('Only English')
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

  it('fills variables in Malay', () => {
    expect(msT('home.title', { area: 'Klang' })).toBe('Harga Klang')
    expect(msT('detail.compare.rank', { area: 'Klang', rank: 2, total: 11 })).toBe(
      'Klang: kedudukan harga 2/11',
    )
    expect(msT('setup.step', { step: 1, total: 3 })).toBe('Langkah 1 daripada 3')
    expect(msT('common.page', { page: 1, total: 2 })).toBe('Halaman 1/2')
  })

  it('fills variables in Hindi', () => {
    expect(hiT('home.title', { area: 'Nashik district' })).toBe('Nashik district के भाव')
    expect(hiT('detail.compare.rank', { area: 'Nashik', rank: 2, total: 11 })).toBe(
      'Nashik: भाव में 2/11 स्थान',
    )
    expect(hiT('states.lastPrice', { when: '3 दिन पहले', price: '2,340' })).toBe(
      'पिछला (3 दिन पहले): 2,340',
    )
    expect(hiT('setup.step', { step: 1, total: 3 })).toBe('चरण 1/3')
  })

  it('follows the plural rules of Malay and Hindi', () => {
    // Malay has no singular form; Hindi uses it for 0 and 1.
    expect(msT('detail.today.markets', { count: 1 })).toBe('1 pasar di kawasan ini')
    expect(msT('detail.compare.marketCount', { count: 3 })).toBe('3 pasar')
    expect(hiT('detail.today.markets', { count: 1 })).toBe('इस क्षेत्र में 1 मंडी')
    expect(hiT('detail.today.markets', { count: 7 })).toBe('इस क्षेत्र में 7 मंडियाँ')
    expect(hiT('detail.compare.marketCount', { count: 0 })).toBe('0 मंडी')
    expect(hiT('detail.compare.marketCount', { count: 3 })).toBe('3 मंडियाँ')
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
    expect(msT('date.weekdays', { returnObjects: true })).toHaveLength(7)
    expect(hiT('date.months', { returnObjects: true })).toHaveLength(12)
  })
})
