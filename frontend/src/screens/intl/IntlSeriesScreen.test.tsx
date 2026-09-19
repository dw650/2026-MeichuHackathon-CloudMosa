import { screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import type { IntlSeries } from '@/api/queries'
import riceTW from '@/test/fixtures/intl_rice__country-TW.json'
import { server } from '@/test/msw/server'
import { renderApp } from '@/test/renderApp'

const softKeys = (app: Awaited<ReturnType<typeof renderApp>>) => [
  app.softKey('left'),
  app.softKey('center'),
  app.softKey('right'),
]

/** Taiwan's rice answer with some fields changed. */
function serveRice(change: (data: IntlSeries) => void) {
  const data = structuredClone(riceTW) as IntlSeries
  change(data)
  server.use(http.get('*/api/v1/intl/:series', () => HttpResponse.json(data)))
}

const failure = (status: number, code: string) =>
  HttpResponse.json({ error: { code, message: code, request_id: 't' } }, { status })

const big = () => document.querySelector('.big')?.textContent

const ticks = () =>
  Array.from(document.querySelectorAll('svg text'), (text) => text.textContent ?? '')

describe('IntlSeriesScreen', () => {
  it('shows the latest month, the 12 months and where the numbers come from', async () => {
    const app = await renderApp('/intl/rice', { country: 'TW', history: ['/', '/intl'] })
    await screen.findByText('泰國 5% 碎米')

    expect(screen.getByRole('heading')).toHaveTextContent('稻米')
    expect(screen.getByText('元/公斤')).toBeInTheDocument()
    expect(screen.getByText('以 9/19 匯率換算')).toBeInTheDocument()
    // Price card: local price per kg, the change from July and the month it belongs to.
    expect(big()).toBe('15.0')
    expect(screen.getByText('+0.1')).toBeInTheDocument()
    expect(screen.getByText('較上月')).toBeInTheDocument()
    expect(screen.getByText('2026 年 8 月均價')).toBeInTheDocument()
    // The 12 months, labelled by month, the latest value on the line.
    expect(screen.getByText('近 12 個月')).toBeInTheDocument()
    expect(ticks()).toEqual(expect.arrayContaining(['9 月', '4 月', '8 月', '15.0']))
    // High, low and the latest price against the 12-month average.
    expect(screen.getByText('近一年高').nextSibling).toHaveTextContent('15.7')
    expect(screen.getByText('近一年低').nextSibling).toHaveTextContent('11.3')
    expect(screen.getByText('比一年均價').nextSibling).toHaveTextContent('+13%')
    // The published price, the series as named by the World Bank, the rate and the credits.
    expect(screen.getByText('原始報價 471 美元/公噸')).toBeInTheDocument()
    expect(screen.getByText('系列：Rice, Thai 5%')).toBeInTheDocument()
    expect(screen.getByText('以 9/19 匯率換算：1 美元＝31.83 TWD')).toBeInTheDocument()
    expect(screen.getByText('資料：世界銀行 Pink Sheet（9/2 更新）')).toBeInTheDocument()
    expect(screen.getByText('匯率：Rates By Exchange Rate API')).toBeInTheDocument()

    // Nothing to select: ↑ ↓ scroll the page and the right soft key goes back to the list.
    expect(app.focusedId()).toBeNull()
    expect(softKeys(app)).toEqual(['', '', '返回'])
    app.press('ArrowDown')
    app.press('Escape')
    expect(app.path()).toBe('/intl/rice')
    await app.back()
    expect(app.path()).toBe('/intl')
  })

  it('keeps a per-kg dollar price as published, in English', async () => {
    await renderApp('/intl/sugar', { country: 'IN', lang: 'en' })
    await screen.findByText('World (ISA) raw')
    expect(screen.getByRole('heading')).toHaveTextContent('Sugar')
    expect(big()).toBe('36.5')
    expect(screen.getByText('Aug 2026 average')).toBeInTheDocument()
    expect(screen.getByText('Published US$0.38/kg')).toBeInTheDocument()
    expect(screen.getByText('At the 19/9 rate: US$1 = 95.99 INR')).toBeInTheDocument()
    expect(screen.getByText('Source: World Bank Pink Sheet (updated 2/9)')).toBeInTheDocument()
    expect(screen.getByText('Rates By Exchange Rate API')).toBeInTheDocument()
  })

  it('flags a month that is later than usual', async () => {
    serveRice((data) => {
      data.today = '2026-11-02'
    })
    await renderApp('/intl/rice', { country: 'TW' })
    expect(await screen.findByText('2026 年 8 月均價')).toHaveClass('warn')
  })

  it('shows 「—」 and the reason when there is no month yet', async () => {
    serveRice((data) => {
      Object.assign(data, {
        month: null,
        usd: null,
        price_per_kg: null,
        change: null,
        reason: 'no_data',
        series: [],
        published: null,
      })
      Object.assign(data.stats, { high_per_kg: null, low_per_kg: null, vs_avg_pct: null })
    })
    await renderApp('/intl/rice', { country: 'TW' })
    await screen.findByText('泰國 5% 碎米')
    expect(screen.getAllByText('尚無資料')).toHaveLength(2)
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
    expect(screen.queryByText('近一年高')).not.toBeInTheDocument()
    expect(screen.getByText('資料：世界銀行 Pink Sheet')).toBeInTheDocument()
  })

  it('keeps the dollar price when there is no exchange rate', async () => {
    serveRice((data) => {
      Object.assign(data, { price_per_kg: null, reason: 'no_fx', fx: null })
      data.series = data.series.map((point) => ({ ...point, price_per_kg: null }))
    })
    await renderApp('/intl/rice', { country: 'TW' })
    await screen.findByText('泰國 5% 碎米')
    expect(screen.getAllByText('尚無匯率，無法換算').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('原始報價 471 美元/公噸')).toBeInTheDocument()
    expect(screen.queryByText(/以 .* 匯率換算/)).not.toBeInTheDocument()
  })

  it('offers a retry when the series cannot be loaded', async () => {
    server.use(http.get('*/api/v1/intl/:series', () => failure(503, 'upstream_unavailable')))
    const app = await renderApp('/intl/rice', { country: 'TW' })
    expect(await screen.findByText('連線失敗', {}, { timeout: 3000 })).toBeInTheDocument()
    expect(app.focusedId()).toBe('retry')
    expect(softKeys(app)).toEqual(['', '重試', '返回'])
    server.resetHandlers()
    app.press('Enter')
    await screen.findByText('泰國 5% 碎米')
    expect(big()).toBe('15.0')
  })

  it('goes back to the list for a series that does not exist', async () => {
    const app = await renderApp('/intl/coffee', { country: 'TW' })
    await waitFor(() => expect(app.path()).toBe('/intl'))
    await screen.findByText('稻米')
  })
})
