import { act, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useSettings } from '@/store/settings'
import { renderApp } from '@/test/renderApp'

type App = Awaited<ReturnType<typeof renderApp>>

async function press(app: App, key: string) {
  app.press(key)
  await act(async () => {})
}

/** The value under a metric title. */
const metric = (label: string) => screen.getByText(label).nextElementSibling?.textContent

describe('crop detail · 走勢 tab (T28)', () => {
  it('draws 7 days, switches to 30 days with # and goes to 行情 on OK', async () => {
    const app = await renderApp('/crop/onion/trend')
    expect(await screen.findByText('7 日走勢')).toBeInTheDocument()
    expect(screen.getByText('5.3%')).toBeInTheDocument()
    // Sunday 9/13 has no price: the line breaks there and the axis says 休.
    expect(screen.getByText('休')).toBeInTheDocument()
    expect(screen.getByText('六')).toBeInTheDocument()
    expect(metric('高')).toBe('3,969')
    expect(metric('低')).toBe('3,768')
    expect(metric('波動')).toBe('普通')
    expect(app.focusedId()).toBeNull()
    expect([app.softKey('left'), app.softKey('center'), app.softKey('right')]).toEqual([
      '選單',
      '行情',
      '返回',
    ])

    await press(app, '#')
    expect(app.path()).toBe('/crop/onion/trend?days=30')
    expect(await screen.findByText('30 日走勢')).toBeInTheDocument()
    expect(screen.getByText('8.9%')).toBeInTheDocument()
    expect(metric('低')).toBe('3,644')
    expect(screen.getByText('8/21')).toBeInTheDocument()

    await press(app, 'Enter')
    expect(app.path()).toBe('/crop/onion/today?days=30')
  })

  // Sunday 9/13 (closed) to Saturday 9/19: never a vowel sign cut off its letter (शनि → शन).
  it.each<['hi' | 'ms', string, string[]]>([
    ['hi', '7 दिन का रुझान', ['बंद', 'सो', 'मं', 'बु', 'गु', 'शु', 'श']],
    ['ms', 'Trend 7 hari', ['X', 'Is', 'Se', 'Ra', 'Kh', 'Ju', 'Sa']],
  ])('labels the 7-day axis with whole weekday initials in %s', async (lang, title, ticks) => {
    await renderApp('/crop/onion/trend', { lang })
    expect(await screen.findByText(title)).toBeInTheDocument()
    expect(Array.from(document.querySelectorAll('text.tick'), (tick) => tick.textContent)).toEqual(
      ticks,
    )
  })

  it('offers wholesale when the crop has no retail price', async () => {
    const app = await renderApp('/crop/chilli/trend')
    await screen.findByText('7 日走勢')
    await press(app, '*')
    expect(await screen.findByText('尚無零售資料')).toBeInTheDocument()
    expect(app.focusedId()).toBe('wholesale')
    expect(app.softKey('center')).toBe('選取')

    await press(app, 'Enter')
    expect(useSettings.getState().priceType).toBe('wholesale')
    expect(await screen.findByText('7 日走勢')).toBeInTheDocument()
  })

  it('draws no line for an area without prices', async () => {
    const app = await renderApp('/crop/onion/trend?area=dakshinakannada')
    expect(await screen.findByText('無資料')).toBeInTheDocument()
    expect(screen.queryByText('高')).not.toBeInTheDocument()
    expect(app.softKey('center')).toBe('行情')
  })
})
