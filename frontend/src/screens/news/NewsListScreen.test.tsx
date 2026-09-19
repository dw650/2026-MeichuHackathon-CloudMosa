import { screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { server } from '@/test/msw/server'
import { renderApp } from '@/test/renderApp'

const focusIds = () =>
  Array.from(document.querySelectorAll('[data-focus-id]')).map((e) =>
    e.getAttribute('data-focus-id'),
  )
const card = (id: string) => {
  const found = document.querySelector<HTMLElement>(`[data-focus-id="${id}"]`)
  if (!found) throw new Error(`no item ${id}`)
  return found
}
const failNews = http.get('*/api/v1/news', () =>
  HttpResponse.json(
    { error: { code: 'upstream_unavailable', message: 'down', request_id: 't' } },
    { status: 503 },
  ),
)
// A failed request is retried once after 1 s (api/queryClient.ts) before the error shows.
const AFTER_RETRY = { timeout: 3000 }

describe('NewsListScreen', () => {
  it('lists my area first with summaries, dates and sources; digits open an item', async () => {
    const app = await renderApp('/news', { country: 'TW', history: ['/'] })
    await screen.findByText('芭樂盛產 屏東產地價格回落', { exact: false })

    expect(screen.getByRole('heading', { name: '新聞' })).toBeInTheDocument()
    expect(screen.getByText('台北市')).toBeInTheDocument()
    expect(screen.getByText('9/19 14:10')).toBeInTheDocument()
    expect(focusIds()).toEqual(['news:1', 'news:2', 'news:3', 'news:4', 'news:5', 'news:6'])
    // Item 1 mentions 台北 and comes first although item 2 is newer.
    expect(card('news:1')).toHaveTextContent('颱風前搶收 台北市場甘藍到貨減少')
    expect(card('news:1')).toHaveTextContent('甘藍 · 今天')
    expect(card('news:1')).toHaveTextContent('示範資料')
    expect(card('news:3')).toHaveTextContent('香蕉 · 昨天')
    expect(card('news:6')).toHaveTextContent('青蔥 · 9/16 週三')
    // No summary: title, crop, date and source only.
    expect(card('news:3').querySelectorAll('[lang]')).toHaveLength(1)
    expect(card('news:1').querySelector('kbd')).toHaveTextContent('1')

    expect(app.focusedId()).toBe('news:1')
    expect([app.softKey('left'), app.softKey('center'), app.softKey('right')]).toEqual([
      '',
      '開啟',
      '返回',
    ])
    app.press('ArrowDown')
    expect(app.focusedId()).toBe('news:2')
    app.press('Enter')
    await waitFor(() => expect(app.path()).toBe('/news/2'))
    await app.back()
    expect(app.path()).toBe('/news')
    app.press('4')
    await waitFor(() => expect(app.path()).toBe('/news/4'))
  })

  it('shows English titles in an English interface for India', async () => {
    await renderApp('/news', { country: 'IN', lang: 'en' })
    await screen.findByText('Onion prices ease at Lasalgaon as arrivals rise', { exact: false })
    expect(screen.getByRole('heading', { name: 'News' })).toBeInTheDocument()
    expect(card('news:7')).toHaveTextContent('Onion · Yesterday')
    expect(card('news:8')).toHaveTextContent('Tomato · Today')
    expect(focusIds()[0]).toBe('news:7') // Lasalgaon is in Nashik
  })

  it('says when there is no news yet', async () => {
    server.use(
      http.get('*/api/v1/news', () =>
        HttpResponse.json({
          country: 'IN',
          area_id: 'nashik',
          today: '2026-09-19',
          fetched_at: null,
          items: [],
        }),
      ),
    )
    const app = await renderApp('/news')
    await screen.findByText('目前沒有新聞')
    expect(screen.getByText('每天 00:00 更新')).toBeInTheDocument()
    expect(app.softKey('center')).toBe('')
    expect(focusIds()).toEqual([])
  })

  it('offers a retry when nothing could be loaded', async () => {
    server.use(failNews)
    const app = await renderApp('/news')
    await screen.findByText('連線失敗', {}, AFTER_RETRY)
    expect(focusIds()).toEqual(['action:retry'])
    expect(app.softKey('center')).toBe('重試')
    server.resetHandlers()
    app.press('Enter')
    await screen.findByText('Onion prices ease at Lasalgaon as arrivals rise', { exact: false })
  })
})
