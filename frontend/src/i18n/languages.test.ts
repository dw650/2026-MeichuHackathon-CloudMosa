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
    expect(SUPPORTED_LANGUAGES).toEqual(['zh-TW', 'en'])
    expect(resolveLanguage('zh-TW')).toBe('zh-TW')
    expect(resolveLanguage('en')).toBe('en')
  })

  it('uses English for हिन्दी and every language under More', () => {
    expect(resolveLanguage('hi')).toBe('en')
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
    expect(ids(list)).toEqual(['en', 'zh-TW', 'hi'])
    expect(list.map((l) => l.isPhoneLanguage)).toEqual([true, false, false])
  })

  it('keeps the other two in their default order', () => {
    expect(ids(mainLanguages('zh-Hant-TW'))).toEqual(['zh-TW', 'en', 'hi'])
    expect(ids(mainLanguages('hi-IN'))).toEqual(['hi', 'zh-TW', 'en'])
  })

  it('marks हिन्दी as not translated', () => {
    const list = mainLanguages('hi-IN')
    expect(list[0]).toMatchObject({
      id: 'hi',
      name: 'हिन्दी',
      translated: false,
      isPhoneLanguage: true,
    })
    expect(list.filter((l) => l.translated).map((l) => l.id)).toEqual(['zh-TW', 'en'])
  })

  it('carries the tile letter and tone of each language', () => {
    expect(mainLanguages(null).map(({ name, glyph, tone }) => [name, glyph, tone])).toEqual([
      ['繁體中文', '中', 'green'],
      ['English', 'A', 'blue'],
      ['हिन्दी', 'अ', 'orange'],
    ])
  })

  it.each(['tl-TL', 'bn-BD', '', undefined])(
    'uses the default order without a mark for %j',
    (code) => {
      const list = mainLanguages(code)
      expect(ids(list)).toEqual(['zh-TW', 'en', 'hi'])
      expect(list.some((l) => l.isPhoneLanguage)).toBe(false)
    },
  )
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
})

describe('languageName', () => {
  it('returns the name of a listed language in its own script', () => {
    expect(languageName('zh-TW')).toBe('繁體中文')
    expect(languageName('hi')).toBe('हिन्दी')
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
    expect(isLanguageId('id')).toBe(true)
    expect(isLanguageId('zh')).toBe(false)
    expect(isLanguageId(3)).toBe(false)
    expect(isLanguageId(null)).toBe(false)
  })
})
