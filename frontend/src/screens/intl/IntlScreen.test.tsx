import { screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { IntlPrices } from '@/api/queries'
import fixtureTW from '@/test/fixtures/intl__country-TW.json'
import { server } from '@/test/msw/server'
import { renderApp } from '@/test/renderApp'

const card = (id: string) =>
  document.querySelector(`[data-focus-id="series:${id}"]`)?.textContent ?? ''

const softKeys = (app: Awaited<ReturnType<typeof renderApp>>) => [
  app.softKey('left'),
  app.softKey('center'),
  app.softKey('right'),
]

/** The Taiwan answer with some of its items changed. */
function serveTW(change: (data: IntlPrices) => void) {
  const data = structuredClone(fixtureTW) as IntlPrices
  change(data)
  server.use(http.get('*/api/v1/intl', () => HttpResponse.json(data)))
}

const failure = (status: number, code: string) =>
  HttpResponse.json({ error: { code, message: code, request_id: 't' } }, { status })

describe('IntlScreen', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('lists the six series in rupees per kg and opens one with OK or its number', async () => {
    const app = await renderApp('/intl', { history: ['/'] })
    await screen.findByText('稻米')

    expect(screen.getByRole('heading')).toHaveTextContent('國際參考價')
    expect(screen.getByText('₹/公斤')).toBeInTheDocument()
    expect(screen.getByText('以 9/19 匯率換算')).toBeInTheDocument()
    expect(screen.getByText('匯率：Rates By Exchange Rate API')).toBeInTheDocument()
    expect(app.focusedId()).toBe('series:rice')
    expect(softKeys(app)).toEqual(['', '查看', '返回'])

    // Number key, name, grade and month, local price per kg, change from the month before.
    expect(card('rice')).toBe('1稻米泰國 5% 碎米 · 8 月45.2▲0.9%')
    expect(card('sugar')).toBe('5原糖國際糖協定價格 · 8 月36.5▲12%')
    expect(card('palm_oil')).toContain('6棕櫚油')

    app.press('ArrowDown')
    expect(app.focusedId()).toBe('series:wheat')
    app.press('Enter')
    await waitFor(() => expect(app.path()).toBe('/intl/wheat'))
    await app.back()
    await screen.findByText('稻米')
    expect(app.focusedId()).toBe('series:wheat')

    app.press('5')
    await waitFor(() => expect(app.path()).toBe('/intl/sugar'))
  })

  it('has no menu, price type or area keys, and goes back with the right soft key', async () => {
    const app = await renderApp('/intl', { history: ['/'] })
    await screen.findByText('稻米')
    for (const key of ['Escape', '*', '#', '9']) app.press(key)
    expect(app.path()).toBe('/intl')
    await app.back()
    expect(app.path()).toBe('/')
  })

  it('shows Taiwan in English with its own currency', async () => {
    await renderApp('/intl', { country: 'TW', lang: 'en' })
    await screen.findByText('Rice')
    expect(screen.getByRole('heading')).toHaveTextContent('International prices')
    expect(screen.getByText('NT$/kg')).toBeInTheDocument()
    expect(screen.getByText('At the 19/9 rate')).toBeInTheDocument()
    expect(card('rice')).toBe('1RiceThai 5% broken · Aug15.0▲0.9%')
  })

  it('names the year of an older month and flags one that is late', async () => {
    serveTW((data) => {
      const [rice, wheat] = data.items
      rice!.month = '2025-12-01'
      data.today = '2026-01-20'
      wheat!.month = '2025-10-01'
    })
    await renderApp('/intl', { country: 'TW' })
    await screen.findByText('稻米')
    const month = screen.getByText('2025 年 12 月')
    expect(month).not.toHaveClass('warn')
    expect(screen.getByText('2025 年 10 月')).toHaveClass('warn')
  })

  it('says why a price is missing and never shows 0', async () => {
    serveTW((data) => {
      const [rice, wheat] = data.items
      Object.assign(rice!, { price_per_kg: null, reason: 'no_fx' })
      Object.assign(wheat!, { price_per_kg: null, reason: 'no_data', month: null, change: null })
      data.fx = null
    })
    await renderApp('/intl', { country: 'TW' })
    await screen.findByText('稻米')
    expect(card('rice')).toBe('1稻米尚無匯率，無法換算—')
    expect(card('wheat')).toBe('2小麥尚無資料—')
    expect(screen.queryByText(/匯率換算/)).not.toBeInTheDocument()
  })

  it('shows a static loading state, then the failure with a retry', async () => {
    server.use(http.get('*/api/v1/intl', () => failure(503, 'upstream_unavailable')))
    const app = await renderApp('/intl')
    expect(await screen.findByText('正在取得國際參考價')).toBeInTheDocument()
    expect(screen.getByText('超過 10 秒會顯示錯誤')).toBeInTheDocument()

    expect(await screen.findByText('連線失敗', {}, { timeout: 3000 })).toBeInTheDocument()
    expect(app.focusedId()).toBe('retry')
    expect(softKeys(app)).toEqual(['', '重試', '返回'])

    server.resetHandlers()
    app.press('Enter')
    await screen.findByText('稻米')
    expect(app.focusedId()).toBe('series:rice')
  })

  it('keeps the earlier prices, marked old, when a later refresh fails', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const app = await renderApp('/intl')
    await screen.findByText('稻米')
    app.press('Enter')
    await waitFor(() => expect(app.path()).toBe('/intl/rice'))

    // Back after the list went stale, while the connection is down.
    server.use(http.get('*/api/v1/intl', () => failure(503, 'upstream_unavailable')))
    vi.setSystemTime(Date.now() + 10 * 60 * 1000)
    await app.back()

    expect(await screen.findByText('連線失敗', {}, { timeout: 3000 })).toBeInTheDocument()
    expect(screen.getByText('先顯示之前取得的價格')).toBeInTheDocument()
    expect(card('rice')).toBe('1稻米泰國 5% 碎米 · 8 月45.2舊')
    expect(app.focusedId()).toBe('series:rice')
    app.press('ArrowUp')
    expect(app.softKey('center')).toBe('重試')
    // The digits still open the series, after the connection-failed card.
    app.press('2')
    await waitFor(() => expect(app.path()).toBe('/intl/wheat'))
  })

  it('goes home when the country no longer exists', async () => {
    server.use(http.get('*/api/v1/intl', () => failure(404, 'country_not_found')))
    const app = await renderApp('/intl')
    await waitFor(() => expect(app.path()).toBe('/'))
  })
})
