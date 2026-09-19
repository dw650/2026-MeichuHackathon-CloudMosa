import { screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useSettings } from '@/store/settings'
import { server } from '@/test/msw/server'
import { renderApp } from '@/test/renderApp'

const LIST = '/crop/onion/markets?area=nashik'

const row = (marketId: string) =>
  document.querySelector(`[data-focus-id="market:${marketId}"]`)?.textContent ?? ''

const softKeys = (app: Awaited<ReturnType<typeof renderApp>>) => [
  app.softKey('left'),
  app.softKey('center'),
  app.softKey('right'),
]

const failMarkets = () =>
  server.use(
    http.get('*/api/v1/crops/:crop/markets', () =>
      HttpResponse.json(
        { error: { code: 'upstream_unavailable', message: 'down', request_id: 't' } },
        { status: 503 },
      ),
    ),
  )

describe('MarketsScreen', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('ranks the markets against the median and opens one with OK or its digit', async () => {
    const app = await renderApp(LIST)
    await screen.findByText('Pimpalgaon Baswant')

    expect(screen.getByRole('heading')).toHaveTextContent('洋蔥')
    expect(screen.getByText('Nashik 縣')).toBeInTheDocument()
    expect(screen.getByText('與中位數 3,969 比較')).toBeInTheDocument()
    expect(app.focusedId()).toBe('market:pimpalgaon')
    expect(softKeys(app)).toEqual(['選單', '開啟', '返回'])

    // Rank, price and the difference with the median; freshness only when not today.
    // Agmarknet gives no market coordinates, so no Indian market shows a distance.
    expect(row('pimpalgaon')).toBe('1Pimpalgaon Baswant4,476▲+507')
    expect(row('malegaon')).toContain('昨天')
    expect(row('yeola')).toContain('3 天前')
    // Markets without a price come last, with 「—」 and the reason.
    const items = document.querySelectorAll('[data-focus-id]')
    expect(items[items.length - 1]?.textContent).toContain('無資料')
    expect(row('manmad')).toBe('17Manmad無資料—')

    app.press('ArrowDown')
    expect(app.focusedId()).toBe('market:nashikm')
    app.press('Enter')
    await waitFor(() => expect(app.path()).toBe('/crop/onion/markets/nashikm?area=nashik'))

    await app.back()
    await screen.findByText('Pimpalgaon Baswant')
    expect(app.focusedId()).toBe('market:nashikm')
    app.press('3')
    await waitFor(() => expect(app.path()).toBe('/crop/onion/markets/lasalgaon?area=nashik'))
  })

  it('opens the area panel with #, the menu with the left soft key, and toggles retail with *', async () => {
    const app = await renderApp('/crop/onion/markets')
    await screen.findByText('Pimpalgaon Baswant')

    app.press('#')
    await waitFor(() => expect(app.path()).toBe('/crop/onion/markets?sheet=area'))
    await app.back()
    app.press('Escape')
    await waitFor(() => expect(app.path()).toBe('/crop/onion/markets?sheet=menu'))
    await app.back()

    // Retail has no market detail: a note and a way back to wholesale.
    app.press('*')
    expect(screen.getByText('零售價以地區為單位，沒有市場細項')).toBeInTheDocument()
    expect(screen.queryByText('Pimpalgaon Baswant')).not.toBeInTheDocument()
    expect(app.focusedId()).toBe('wholesale')
    expect(softKeys(app)).toEqual(['選單', '選取', '返回'])

    app.press('Enter')
    expect(useSettings.getState().priceType).toBe('wholesale')
    await screen.findByText('Pimpalgaon Baswant')
    expect(app.focusedId()).toBe('market:pimpalgaon')
  })

  it('shows a static loading state, then the failure with a retry', async () => {
    failMarkets()
    const app = await renderApp(LIST)

    expect(await screen.findByText('正在取得 Nashik 縣 的行情…')).toBeInTheDocument()
    expect(screen.getByText('超過 10 秒會顯示錯誤')).toBeInTheDocument()
    expect(softKeys(app)).toEqual(['選單', '', '返回'])

    expect(await screen.findByText('連線失敗', {}, { timeout: 3000 })).toBeInTheDocument()
    expect(app.focusedId()).toBe('retry')
    expect(softKeys(app)).toEqual(['選單', '重試', '返回'])

    server.resetHandlers()
    app.press('Enter')
    expect(await screen.findByText('Pimpalgaon Baswant')).toBeInTheDocument()
    expect(screen.queryByText('連線失敗')).not.toBeInTheDocument()
  })

  it('keeps the old list when a later refresh fails', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const app = await renderApp(LIST)
    await screen.findByText('Pimpalgaon Baswant')
    app.press('Enter')
    await waitFor(() => expect(app.path()).toBe('/crop/onion/markets/pimpalgaon?area=nashik'))

    // Back after the list went stale, while the connection is down.
    failMarkets()
    vi.setSystemTime(Date.now() + 10 * 60 * 1000)
    await app.back()

    expect(await screen.findByText('連線失敗', {}, { timeout: 3000 })).toBeInTheDocument()
    expect(screen.getByText('先顯示 9/19 週六 的資料')).toBeInTheDocument()
    expect(screen.getByText('Pimpalgaon Baswant')).toBeInTheDocument()
    expect(app.focusedId()).toBe('market:pimpalgaon')
    app.press('ArrowUp')
    expect(app.focusedId()).toBe('retry')
    expect(app.softKey('center')).toBe('重試')

    server.resetHandlers()
    app.press('Enter')
    await waitFor(() => expect(screen.queryByText('連線失敗')).not.toBeInTheDocument())
    expect(screen.getByText('Pimpalgaon Baswant')).toBeInTheDocument()
  })
})
