import { describe, expect, it } from 'vitest'

import { pickText } from './text'

const onion = { 'zh-TW': '洋蔥', en: 'Onion' }

describe('pickText', () => {
  it('picks the requested language', () => {
    expect(pickText(onion, 'zh-TW')).toBe('洋蔥')
    expect(pickText(onion, 'en')).toBe('Onion')
  })

  it('falls back to English', () => {
    // Data names are only in zh-TW and en (seed files); Malay and Hindi show English.
    expect(pickText(onion, 'hi')).toBe('Onion')
    expect(pickText(onion, 'ms')).toBe('Onion')
    expect(pickText({ en: 'Onion', 'zh-TW': '' }, 'zh-TW')).toBe('Onion')
  })

  it('falls back to the first value when English is missing too', () => {
    expect(pickText({ 'zh-TW': '洋蔥' }, 'en')).toBe('洋蔥')
    expect(pickText({ hi: '', 'zh-TW': '洋蔥' }, 'en')).toBe('洋蔥')
  })

  it('returns an empty string when there is no text', () => {
    expect(pickText({}, 'en')).toBe('')
    expect(pickText({ en: '' }, 'en')).toBe('')
    expect(pickText(null, 'en')).toBe('')
    expect(pickText(undefined, 'zh-TW')).toBe('')
  })
})
