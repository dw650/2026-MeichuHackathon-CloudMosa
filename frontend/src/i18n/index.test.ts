import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'

import { i18n, setLanguage } from './index'

afterEach(() => {
  setLanguage('en')
})

describe('i18n setup', () => {
  it('starts in the phone language (jsdom reports en-US)', () => {
    expect(i18n.isInitialized).toBe(true)
    expect(i18n.language).toBe('en')
    expect(document.documentElement.lang).toBe('en')
  })

  it('switches to Traditional Chinese and marks the page zh-Hant', () => {
    expect(setLanguage('zh-TW')).toBe('zh-TW')
    expect(i18n.language).toBe('zh-TW')
    expect(i18n.t('app.name')).toBe('穀價')
    expect(document.documentElement.lang).toBe('zh-Hant')
    expect(document.documentElement.matches(':lang(zh)')).toBe(true)
  })

  it.each([
    ['ms', 'AgriPrice', 'Tetapan', 'ms'],
    ['hi', 'AgriPrice', 'सेटिंग्स', 'hi'],
  ])('switches to %s and marks the page lang', (id, name, settings, lang) => {
    expect(setLanguage(id)).toBe(id)
    expect(i18n.language).toBe(id)
    expect(i18n.t('app.name')).toBe(name)
    expect(i18n.t('settings.title')).toBe(settings)
    expect(document.documentElement.lang).toBe(lang)
    expect(document.documentElement.matches(':lang(zh)')).toBe(false)
  })

  it.each(['bn', 'ur', 'id', 'xx', null])('uses English for %j', (id) => {
    setLanguage('zh-TW')
    expect(setLanguage(id)).toBe('en')
    expect(i18n.language).toBe('en')
    expect(i18n.t('app.name')).toBe('AgriPrice')
    expect(document.documentElement.lang).toBe('en')
  })

  it('falls back to English for a key missing in Chinese', () => {
    i18n.addResource('en', 'translation', 'test.onlyEnglish', 'Only English')
    setLanguage('zh-TW')
    expect(i18n.t('test.onlyEnglish' as 'app.name')).toBe('Only English')
  })
})

describe('initial language', () => {
  afterAll(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('follows a Hindi phone before any language is chosen', async () => {
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('hi-IN')
    vi.resetModules()
    const fresh = await import('./index')
    expect(fresh.i18n.language).toBe('hi')
    expect(document.documentElement.lang).toBe('hi')
    fresh.setLanguage('en')
  })

  it('follows a Chinese phone before any language is chosen', async () => {
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('zh-Hant-TW')
    vi.resetModules()
    const fresh = await import('./index')
    expect(fresh.i18n.language).toBe('zh-TW')
    expect(document.documentElement.lang).toBe('zh-Hant')
    fresh.setLanguage('en')
  })
})
