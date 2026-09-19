import { act, screen, waitFor, within } from '@testing-library/react'
import { delay, http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'

import { useSession } from '@/store/session'
import { useSettings } from '@/store/settings'
import { server } from '@/test/msw/server'
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
const failPrices = http.get('*/api/v1/prices', () =>
  HttpResponse.json(
    { error: { code: 'upstream_unavailable', message: 'down', request_id: 't' } },
    { status: 503 },
  ),
)
// A failed request is retried once after 1 s (api/queryClient.ts) before the error shows.
const AFTER_RETRY = { timeout: 3000 }

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

  it('switches to the category grid with ▶ and back with ◀ on its left column', async () => {
    const app = await renderApp('/')
    await screen.findByText('洋蔥')
    app.press('ArrowRight')
    await waitFor(() => expect(app.path()).toBe('/?tab=all'))
    expect(app.router.state.historyAction).toBe('REPLACE')
    expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('全部作物')
    expect(focusIds()).toEqual([
      'cat:cereal',
      'cat:veg',
      'cat:fruit',
      'cat:pulse',
      'cat:spice',
      'cat:oil',
      'cat:other',
      'cat:recent',
    ])
    expect(app.focusedId()).toBe('cat:cereal')
    expect(softKeys(app)).toEqual(['選單', '開啟', '離開'])

    app.press('ArrowDown')
    expect(app.focusedId()).toBe('cat:pulse')
    app.press('ArrowRight')
    expect(app.focusedId()).toBe('cat:spice')
    app.press('ArrowLeft')
    app.press('ArrowLeft')
    await waitFor(() => expect(app.path()).toBe('/'))
    await waitFor(() => expect(app.focusedId()).toBe('crop:onion'))
  })

  it('opens a category from the grid by its digit', async () => {
    const app = await renderApp('/?tab=all')
    await screen.findByText('其他')
    app.press('8')
    await waitFor(() => expect(app.path()).toBe('/cat/recent'))
  })

  it("shows the country's own categories, named by the API, then 最近", async () => {
    await renderApp('/?tab=all', { country: 'TW' })
    await screen.findByText('葉菜類')
    expect(focusIds()).toEqual([
      'cat:leafy',
      'cat:root',
      'cat:gourd',
      'cat:fruitveg',
      'cat:spice',
      'cat:fruit',
      'cat:recent',
    ])
    expect(screen.getByText('花果菜類')).toBeInTheDocument()
    expect(screen.getByText('最近')).toBeInTheDocument()
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

describe('HomeScreen · states (F12)', () => {
  it('shows static skeleton cards and the loading text, with nothing to open', async () => {
    server.use(http.get('*/api/v1/prices', () => delay('infinite')))
    const app = await renderApp('/')
    expect(await screen.findByText('正在取得 Nashik 縣 的行情…')).toBeInTheDocument()
    expect(screen.getByText('超過 10 秒會顯示錯誤')).toBeInTheDocument()
    expect(screen.getByText('洋蔥')).toBeInTheDocument()
    expect(focusIds()).toEqual([])
    expect(softKeys(app)).toEqual(['選單', '', '離開'])
  })

  it('shows the error with a retry exit when there is nothing to show', async () => {
    server.use(failPrices)
    const app = await renderApp('/')
    expect(await screen.findByText('你的設定都還在', {}, AFTER_RETRY)).toBeInTheDocument()
    expect(screen.getByText('連線失敗')).toBeInTheDocument()
    expect(focusIds()).toEqual(['action:retry'])
    expect(app.focusedId()).toBe('action:retry')
    expect(softKeys(app)).toEqual(['選單', '重試', '離開'])
    app.press('1')
    expect(app.path()).toBe('/')

    server.resetHandlers()
    app.press('Enter')
    expect(await screen.findByText('洋蔥')).toBeInTheDocument()
    await waitFor(() => expect(app.focusedId()).toBe('crop:onion'))
  })

  it('keeps the old prices behind a connection-failed card when a refresh fails', async () => {
    const app = await renderApp('/')
    await screen.findByText('洋蔥')
    await act(() => app.router.navigate('/about'))
    // Back home after the prices went stale (5 min), with the connection down.
    server.use(failPrices)
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      vi.setSystemTime(Date.now() + 6 * 60 * 1000)
      await app.back()
      expect(await screen.findByText('先顯示 11:40 的資料', {}, AFTER_RETRY)).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }

    expect(focusIds().slice(0, 2)).toEqual(['action:retry', 'crop:onion'])
    expect(card('action:retry')).toHaveTextContent('連線失敗')
    expect(card('crop:onion')).toHaveTextContent('2,395')
    expect(card('crop:onion')).toHaveTextContent('舊')
    expect(card('crop:onion').textContent).not.toMatch(/[▲▼＝]/)
    expect(card('crop:potato')).not.toHaveTextContent('昨天')

    expect(app.focusedId()).toBe('crop:onion')
    expect(app.softKey('center')).toBe('開啟')
    app.press('ArrowUp')
    expect(app.focusedId()).toBe('action:retry')
    expect(app.softKey('center')).toBe('重試')
    // Digits still match the key caps drawn on the crop cards.
    app.press('1')
    await waitFor(() => expect(app.path()).toBe('/crop/onion/today'))
  })
})
