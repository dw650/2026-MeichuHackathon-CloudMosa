import { act, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'

import lasalgaon from '@/test/fixtures/crops_onion_markets_lasalgaon__country-IN.json'
import { server } from '@/test/msw/server'
import { renderApp } from '@/test/renderApp'

const MARKET = '/crop/onion/markets/lasalgaon?area=nashik'
const ENDPOINT = '*/api/v1/crops/:crop/markets/:market'

const softKeys = (app: Awaited<ReturnType<typeof renderApp>>) => [
  app.softKey('left'),
  app.softKey('center'),
  app.softKey('right'),
]

const serveMarket = (changes: Record<string, unknown>) =>
  server.use(http.get(ENDPOINT, () => HttpResponse.json({ ...lasalgaon, ...changes })))

const failWith = (status: number, code: string) =>
  server.use(
    http.get(ENDPOINT, () =>
      HttpResponse.json({ error: { code, message: code, request_id: 't' } }, { status }),
    ),
  )

describe('MarketScreen', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the representative price, change, day range and source', async () => {
    const app = await renderApp(MARKET)
    expect(await screen.findByText('2,316')).toBeInTheDocument()

    expect(screen.getByRole('heading')).toHaveTextContent('洋蔥')
    expect(screen.getByText('Lasalgaon')).toBeInTheDocument()
    expect(screen.getByText('常見價 · ₹/公擔')).toBeInTheDocument()
    expect(screen.getByText('3.8%')).toBeInTheDocument()
    expect(screen.getByText('較前一交易日')).toBeInTheDocument()
    expect(screen.getByText('1,872')).toBeInTheDocument()
    expect(screen.getByText('2,572')).toBeInTheDocument()
    expect(screen.getByText('Agmarknet・消費者事務部（印度政府） · 示範資料')).toBeInTheDocument()
    // No menu and nothing to select.
    expect(softKeys(app)).toEqual(['', '', '返回'])
    app.press('Escape')
    expect(app.path()).toBe(MARKET)
  })

  it('names the source once when the price comes from the country source itself', async () => {
    // Real data (tw_moa, …): the quote's source and the country's label are the same words.
    const label = {
      en: 'Agmarknet · Dept of Consumer Affairs',
      'zh-TW': 'Agmarknet・消費者事務部（印度政府）',
    }
    server.use(
      http.get(ENDPOINT, () =>
        HttpResponse.json({ ...lasalgaon, source: { id: 'agmarknet', name: label } }),
      ),
    )
    await renderApp(MARKET)
    const line = await screen.findByText(/Agmarknet・消費者事務部/)
    expect(line.textContent).toBe('Agmarknet・消費者事務部（印度政府）')
  })

  it('marks data that is not from today and shows 「—」 without a price', async () => {
    serveMarket({ staleness: { days: 3, state: 'stale' }, trade_date: '2026-09-16' })
    const stale = await renderApp(MARKET)
    expect(await screen.findByText('3 天前')).toBeInTheDocument()
    stale.unmount()

    serveMarket({
      price_per_kg: null,
      low_per_kg: null,
      high_per_kg: null,
      change: null,
      reason: 'no_data',
      staleness: { days: null, state: 'none' },
      trade_date: null,
    })
    await renderApp('/crop/onion/markets/manmad?area=nashik')
    expect(await screen.findByText('無資料')).toBeInTheDocument()
    expect(screen.queryByText('常見價 · ₹/公擔')).not.toBeInTheDocument()
  })

  it("in retail, returns to the area's retail price in place of the detail it came from", async () => {
    const app = await renderApp('/crop/onion/today?area=pune', { history: ['/'] })
    await act(() => app.router.navigate('/crop/onion/markets?area=pune'))
    await screen.findByText('Pimpalgaon')
    app.press('Enter')
    await screen.findByText('常見價 · ₹/公擔')

    app.press('*')
    expect(screen.getByText('這個市場沒有零售報價')).toBeInTheDocument()
    expect(screen.getByText('零售價以地區為單位，沒有市場細項')).toBeInTheDocument()
    expect(screen.getByText('看 Pune 縣 的零售價')).toBeInTheDocument()
    expect(app.focusedId()).toBe('retail')
    expect(softKeys(app)).toEqual(['', '選取', '返回'])

    app.press('Enter')
    await waitFor(() => expect(app.path()).toBe('/crop/onion/today?area=pune'))
    await app.back()
    expect(app.path()).toBe('/')
  })

  it('in retail, replaces itself when it was opened on its own', async () => {
    const app = await renderApp('/crop/onion/markets/lasalgaon', { history: ['/'] })
    await screen.findByText('Lasalgaon')
    app.press('*')
    expect(screen.getByText('看 Nashik 縣 的零售價')).toBeInTheDocument()

    app.press('Enter')
    await waitFor(() => expect(app.path()).toBe('/crop/onion/today?area=nashik'))
    await app.back()
    expect(app.path()).toBe('/')
  })

  it('shows a static loading state, then the failure with a retry', async () => {
    failWith(503, 'upstream_unavailable')
    const app = await renderApp(MARKET)

    expect(await screen.findByText('正在取得 Nashik 縣 的行情…')).toBeInTheDocument()
    expect(softKeys(app)).toEqual(['', '', '返回'])

    expect(await screen.findByText('連線失敗', {}, { timeout: 3000 })).toBeInTheDocument()
    expect(app.focusedId()).toBe('retry')
    expect(softKeys(app)).toEqual(['', '重試', '返回'])

    server.resetHandlers()
    app.press('Enter')
    expect(await screen.findByText('2,316')).toBeInTheDocument()
    expect(screen.queryByText('連線失敗')).not.toBeInTheDocument()
  })

  it('keeps the old price when a later refresh fails', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const app = await renderApp(MARKET, { history: ['/'] })
    await screen.findByText('2,316')
    await app.back()

    failWith(503, 'upstream_unavailable')
    vi.setSystemTime(Date.now() + 10 * 60 * 1000)
    await act(() => app.router.navigate(1))

    expect(await screen.findByText('連線失敗', {}, { timeout: 3000 })).toBeInTheDocument()
    expect(screen.getByText('先顯示 11:40 的資料')).toBeInTheDocument()
    expect(screen.getByText('2,316')).toBeInTheDocument()
    expect(app.focusedId()).toBe('retry')
    expect(app.softKey('center')).toBe('重試')
  })

  it('goes home when the market does not exist', async () => {
    failWith(404, 'market_not_found')
    const app = await renderApp('/crop/onion/markets/gone', { history: ['/'] })
    await waitFor(() => expect(app.path()).toBe('/'))
  })
})
