import { screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { useSession } from '@/store/session'
import { server } from '@/test/msw/server'
import { renderApp } from '@/test/renderApp'

const softKeys = (app: Awaited<ReturnType<typeof renderApp>>) => [
  app.softKey('left'),
  app.softKey('center'),
  app.softKey('right'),
]
const AFTER_RETRY = { timeout: 3000 }

describe('NewsDetailScreen', () => {
  it('shows the headline, date, source, AI summary and related crops; 1 opens its prices', async () => {
    const app = await renderApp('/news/1', { country: 'TW', history: ['/', '/news'] })
    await screen.findByRole('heading', { name: '颱風前搶收 台北市場甘藍到貨減少 批發價走高' })

    expect(screen.getByText('今天 02:10')).toBeInTheDocument()
    expect(screen.getByText('示範資料 · demo.example')).toBeInTheDocument()
    expect(screen.getByText(/颱風接近，產地提前搶收/)).toHaveAttribute('lang', 'zh-TW')
    expect(screen.getByText('AI 依原文摘要，可能有誤')).toBeInTheDocument()
    expect(screen.getByText('相關作物')).toBeInTheDocument()
    expect(screen.getByText('甘藍')).toBeInTheDocument()
    // Nothing to select: the page scrolls; the crop is opened by its digit.
    expect(document.querySelector('[data-focus-id]')).toBeNull()
    expect(softKeys(app)).toEqual(['', '看行情', '返回'])

    app.press('1')
    await waitFor(() => expect(app.path()).toBe('/crop/cabbage/today'))
    expect(useSession.getState().recentCrops[0]).toBe('cabbage')
    await app.back()
    expect(app.path()).toBe('/news/1')
  })

  it('OK opens the first related crop; other digits do nothing', async () => {
    const app = await renderApp('/news/4', { country: 'TW' })
    await screen.findByText('小白菜')
    expect(screen.getByText('空心菜')).toBeInTheDocument()
    app.press('7')
    expect(app.path()).toBe('/news/4')
    app.press('2')
    await waitFor(() => expect(app.path()).toBe('/crop/waterspinach/today'))
    await app.back()
    app.press('Enter')
    await waitFor(() => expect(app.path()).toBe('/crop/bokchoy/today'))
  })

  it('has no summary box when there is no summary', async () => {
    await renderApp('/news/3', { country: 'TW' })
    await screen.findByRole('heading', { name: '香蕉外銷訂單增加 高雄產地價上揚' })
    expect(screen.queryByText('AI 依原文摘要，可能有誤')).toBeNull()
    expect(screen.getByText('昨天 18:10')).toBeInTheDocument()
    expect(screen.getByText('香蕉')).toBeInTheDocument()
  })

  it('reads in English and names the summary\u2019s language', async () => {
    const app = await renderApp('/news/7', { country: 'IN', lang: 'en' })
    await screen.findByRole('heading', { name: 'Onion prices ease at Lasalgaon as arrivals rise' })
    expect(screen.getByText('Yesterday 23:40')).toBeInTheDocument()
    // India's news is summarised in Hindi, so an English reader is told once.
    expect(
      screen.getByText('Summary in Hindi \u00b7 AI summary of the article; may contain errors'),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'News' })).toBeInTheDocument()
    expect(softKeys(app)).toEqual(['', 'Prices', 'Back'])
  })

  it('leaves the language line out when the summary is in the interface language', async () => {
    await renderApp('/news/7', { country: 'IN', lang: 'hi' })
    await screen.findByRole('heading', { name: 'Onion prices ease at Lasalgaon as arrivals rise' })
    expect(
      screen.getByText(
        '\u0932\u0947\u0916 \u0915\u093e AI \u0938\u093e\u0930\u093e\u0902\u0936; \u0907\u0938\u092e\u0947\u0902 \u0917\u0932\u0924\u0940 \u0939\u094b \u0938\u0915\u0924\u0940 \u0939\u0948',
      ),
    ).toBeInTheDocument()
    expect(
      screen.queryByText(
        /\u0938\u093e\u0930\u093e\u0902\u0936 \u0939\u093f\u0928\u094d\u0926\u0940 \u092e\u0947\u0902/,
      ),
    ).toBeNull()
  })

  it('opens a Malaysian crop from a Malay headline', async () => {
    const app = await renderApp('/news/14', { country: 'MY', lang: 'en' })
    await screen.findByRole('heading', { name: 'Harga kubis dan sawi turun di Pahang' })
    expect(
      screen.getByRole('heading', { name: 'Harga kubis dan sawi turun di Pahang' }),
    ).toHaveAttribute('lang', 'ms')
    expect(screen.getByText('Cabbage')).toBeInTheDocument()
    expect(screen.getByText('Pak choy')).toBeInTheDocument()
    app.press('2')
    await waitFor(() => expect(app.path()).toBe('/crop/bokchoy/today'))
  })

  it('says when the item is gone, and sends bad ids back to the list', async () => {
    const app = await renderApp('/news/99', { country: 'TW' })
    await screen.findByText('這則新聞已經不在列表中')
    expect(screen.getByText('新聞只保留 7 天')).toBeInTheDocument()
    expect(softKeys(app)).toEqual(['', '', '返回'])
    app.press('1')
    expect(app.path()).toBe('/news/99')

    const bad = await renderApp('/news/abc', { country: 'TW' })
    await waitFor(() => expect(bad.path()).toBe('/news'))
  })

  it('offers a retry when the item cannot be loaded', async () => {
    server.use(
      http.get('*/api/v1/news/:id', () =>
        HttpResponse.json(
          { error: { code: 'upstream_unavailable', message: 'down', request_id: 't' } },
          { status: 503 },
        ),
      ),
    )
    const app = await renderApp('/news/1', { country: 'TW' })
    await screen.findByText('連線失敗', {}, AFTER_RETRY)
    expect(app.focusedId()).toBe('action:retry')
    expect(app.softKey('center')).toBe('重試')
    server.resetHandlers()
    app.press('Enter')
    await screen.findByText('相關作物')
  })
})
