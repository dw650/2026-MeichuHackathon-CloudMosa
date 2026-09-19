import { describe, expect, it } from 'vitest'

import {
  htmlLang,
  isLanguageId,
  languageName,
  mainLanguages,
  MORE_LANGUAGES,
  MORE_LANGUAGES_PER_PAGE,
  moreLanguagesPage,
  phoneLanguage,
  resolveLanguage,
  SUPPORTED_LANGUAGES,
} from './languages'

const ids = (list: readonly { id: string }[]) => list.map((l) => l.id)

describe('phoneLanguage', () => {
  it.each([
    ['zh-TW', 'zh-TW'],
    ['zh-Hant-TW', 'zh-TW'],
    ['zh_CN', 'zh-TW'],
    ['zh', 'zh-TW'],
    ['en-US', 'en'],
    ['EN_in', 'en'],
    ['hi-IN', 'hi'],
    ['ms-MY', 'ms'],
    ['ms', 'ms'],
    ['bn-BD', 'bn'],
    [' ur-PK ', 'ur'],
    ['vi', 'vi'],
  ])('maps %j to %s', (code, id) => {
    expect(phoneLanguage(code)).toBe(id)
  })

  it.each(['tl-TL', 'fr-FR', '', '-', undefined, null])('returns null for %j', (code) => {
    expect(phoneLanguage(code)).toBeNull()
  })
})

describe('resolveLanguage', () => {
  it('keeps the translated languages', () => {
    expect(SUPPORTED_LANGUAGES).toEqual(['zh-TW', 'en', 'ms', 'hi'])
    for (const id of SUPPORTED_LANGUAGES) expect(resolveLanguage(id)).toBe(id)
  })

  it('uses English for every language under More', () => {
    for (const id of ids(MORE_LANGUAGES)) expect(resolveLanguage(id)).toBe('en')
  })

  it('uses English for unknown or missing ids', () => {
    expect(resolveLanguage('zh')).toBe('en')
    expect(resolveLanguage('xx')).toBe('en')
    expect(resolveLanguage('')).toBe('en')
    expect(resolveLanguage(null)).toBe('en')
    expect(resolveLanguage(undefined)).toBe('en')
  })
})

describe('mainLanguages', () => {
  it('puts the phone language first and marks it', () => {
    const list = mainLanguages('en-IN')
    expect(ids(list)).toEqual(['en', 'zh-TW', 'hi', 'ms'])
    expect(list.map((l) => l.isPhoneLanguage)).toEqual([true, false, false, false])
  })

  it('keeps the others in their default order', () => {
    expect(ids(mainLanguages('zh-Hant-TW'))).toEqual(['zh-TW', 'en', 'hi', 'ms'])
    expect(ids(mainLanguages('hi-IN'))).toEqual(['hi', 'zh-TW', 'en', 'ms'])
    expect(ids(mainLanguages('ms-MY'))).toEqual(['ms', 'zh-TW', 'en', 'hi'])
  })

  it('offers हिन्दी and Bahasa Melayu as translated languages', () => {
    const list = mainLanguages('hi-IN')
    expect(list[0]).toMatchObject({
      id: 'hi',
      name: 'हिन्दी',
      translated: true,
      isPhoneLanguage: true,
    })
    expect(list.every((l) => l.translated)).toBe(true)
  })

  it('carries the tile letter and tone of each language', () => {
    expect(mainLanguages(null).map(({ name, glyph, tone }) => [name, glyph, tone])).toEqual([
      ['繁體中文', '中', 'green'],
      ['English', 'A', 'blue'],
      ['हिन्दी', 'अ', 'orange'],
      ['Bahasa Melayu', 'M', 'purple'],
    ])
  })

  it.each(['tl-TL', 'bn-BD', '', undefined])(
    'uses the default order without a mark for %j',
    (code) => {
      const list = mainLanguages(code)
      expect(ids(list)).toEqual(['zh-TW', 'en', 'hi', 'ms'])
      expect(list.some((l) => l.isPhoneLanguage)).toBe(false)
    },
  )

  it.each([
    ['IN', ['en', 'hi', 'zh-TW', 'ms']],
    ['MY', ['ms', 'en', 'zh-TW', 'hi']],
    ['TW', ['zh-TW', 'en', 'hi', 'ms']],
  ])('lists the languages of %s next, once the country is known', (country, order) => {
    expect(ids(mainLanguages('tl-TL', country))).toEqual(order)
  })

  it('still puts the phone language before the languages of the country', () => {
    const list = mainLanguages('zh-TW', 'IN')
    expect(ids(list)).toEqual(['zh-TW', 'en', 'hi', 'ms'])
    expect(list[0]?.isPhoneLanguage).toBe(true)
    expect(ids(mainLanguages('hi-IN', 'MY'))).toEqual(['hi', 'ms', 'en', 'zh-TW'])
    expect(ids(mainLanguages('en-MY', 'MY'))).toEqual(['en', 'ms', 'zh-TW', 'hi'])
  })

  it.each([null, undefined, '', 'XX'])('uses the default order for the country %j', (country) => {
    expect(ids(mainLanguages(null, country))).toEqual(['zh-TW', 'en', 'hi', 'ms'])
  })
})

describe('moreLanguagesPage', () => {
  it('lists the other languages, 4 per page', () => {
    expect(MORE_LANGUAGES_PER_PAGE).toBe(4)
    const first = moreLanguagesPage(0)
    expect(first).toMatchObject({ page: 0, pages: 2 })
    expect(first.items.map((l) => l.name)).toEqual(['বাংলা', 'मराठी', 'Tiếng Việt', 'Kiswahili'])
    expect(moreLanguagesPage(1).items.map((l) => l.name)).toEqual([
      'اردو',
      'தமிழ்',
      'తెలుగు',
      'Bahasa Indonesia',
    ])
  })

  it('clamps the page number', () => {
    expect(moreLanguagesPage(-1).page).toBe(0)
    expect(moreLanguagesPage(9).page).toBe(1)
    expect(moreLanguagesPage(Number.NaN).page).toBe(0)
    expect(moreLanguagesPage(1.7).page).toBe(1)
  })

  it('marks every language under More as not translated', () => {
    expect(MORE_LANGUAGES).toHaveLength(8)
    expect(MORE_LANGUAGES.every((l) => !l.translated)).toBe(true)
  })
})

describe('htmlLang', () => {
  it('uses zh-Hant for Chinese so :lang(zh) styles apply', () => {
    expect(htmlLang('zh-TW')).toBe('zh-Hant')
    expect(htmlLang('en')).toBe('en')
  })

  it('uses the language code for Malay and Hindi so :lang(hi) styles apply', () => {
    expect(htmlLang('ms')).toBe('ms')
    expect(htmlLang('hi')).toBe('hi')
  })
})

describe('languageName', () => {
  it('returns the name of a listed language in its own script', () => {
    expect(languageName('zh-TW')).toBe('繁體中文')
    expect(languageName('hi')).toBe('हिन्दी')
    expect(languageName('ms')).toBe('Bahasa Melayu')
    expect(languageName('ta')).toBe('தமிழ்')
  })

  it('returns English for unknown ids', () => {
    expect(languageName('xx')).toBe('English')
    expect(languageName(null)).toBe('English')
  })
})

describe('isLanguageId', () => {
  it('accepts only listed ids', () => {
    expect(isLanguageId('zh-TW')).toBe(true)
    expect(isLanguageId('hi')).toBe(true)
    expect(isLanguageId('ms')).toBe(true)
    expect(isLanguageId('id')).toBe(true)
    expect(isLanguageId('zh')).toBe(false)
    expect(isLanguageId(3)).toBe(false)
    expect(isLanguageId(null)).toBe(false)
  })
})
