import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useSession } from '@/store/session'
import { useSettings } from '@/store/settings'
import { renderApp } from '@/test/renderApp'

const card = (id: string) => {
  const found = document.querySelector<HTMLElement>(`[data-focus-id="${id}"]`)
  if (!found) throw new Error(`no item ${id}`)
  return found
}
const focusIds = () =>
  Array.from(document.querySelectorAll('[data-focus-id]')).map((e) =>
    e.getAttribute('data-focus-id'),
  )
const softKeys = (app: Awaited<ReturnType<typeof renderApp>>) =>
  [app.softKey('left'), app.softKey('center'), app.softKey('right')] as const

describe('HomeScreen · watchlist', () => {
  it('lists the watched crops of my area and opens one by its digit', async () => {
    const app = await renderApp('/')
    await screen.findByText('洋蔥')

    expect(screen.getByRole('heading', { name: 'Nashik 縣行情' })).toBeInTheDocument()
    expect(screen.getByText('批發')).toBeInTheDocument()
    expect(screen.getByText('₹/公擔')).toBeInTheDocument()
    expect(screen.getByText('9/19 週六')).toBeInTheDocument()
    expect(focusIds()).toEqual([
      'crop:onion',
      'crop:tomato',
      'crop:potato',
      'crop:chilli',
      'crop:soybean',
      'crop:maize',
      'crop:wheat',
    ])
    expect(card('crop:onion')).toHaveTextContent('2,395')
    expect(card('crop:onion')).toHaveTextContent('▲4.8%')
    expect(card('crop:tomato')).toHaveTextContent('▼12%')

    expect(app.focusedId()).toBe('crop:onion')
    expect(softKeys(app)).toEqual(['選單', '開啟', '離開'])
    app.press('ArrowDown')
    expect(app.focusedId()).toBe('crop:tomato')

    app.press('3')
    await waitFor(() => expect(app.path()).toBe('/crop/potato/today'))
    expect(useSession.getState().recentCrops[0]).toBe('potato')
  })

  it('labels data that is not from today and switches to retail with *', async () => {
    const app = await renderApp('/')
    await screen.findByText('洋蔥')
    expect(card('crop:onion')).toHaveTextContent('紅洋蔥')
    expect(card('crop:onion')).not.toHaveTextContent('·')
    expect(card('crop:potato')).toHaveTextContent('本地種 · 昨天')
    expect(within(card('crop:wheat')).getByText('3 天前').className).toMatch(/warn/)

    app.press('*')
    expect(useSettings.getState().priceType).toBe('retail')
    await waitFor(() => expect(card('crop:onion')).toHaveTextContent('38.1'))
    expect(screen.getByText('零售')).toBeInTheDocument()
    expect(screen.getByText('₹/公斤')).toBeInTheDocument()
    const chilli = card('crop:chilli')
    expect(chilli).toHaveTextContent('—')
    expect(chilli).toHaveTextContent('尚無零售資料')
    expect(chilli.textContent).not.toMatch(/[▲▼＝]/)
    // The 38×16 sparkline is drawn for crops with a price only.
    expect(card('crop:onion').querySelector('svg[width="38"]')).not.toBeNull()
    expect(chilli.querySelector('svg[width="38"]')).toBeNull()
  })

  it('opens the area sheet with # and the menu with the left soft key', async () => {
    const app = await renderApp('/')
    await screen.findByText('洋蔥')
    app.press('#')
    await waitFor(() => expect(app.path()).toBe('/?sheet=area'))
    await app.back()
    app.press('Escape')
    await waitFor(() => expect(app.path()).toBe('/?sheet=menu'))
  })
})
