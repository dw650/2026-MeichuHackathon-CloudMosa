import { act, screen } from '@testing-library/react'
import { delay, http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { useSettings } from '@/store/settings'
import { server } from '@/test/msw/server'
import { renderApp } from '@/test/renderApp'

type App = Awaited<ReturnType<typeof renderApp>>

/** Presses a key and lets the router and the queries settle. */
async function press(app: App, key: string) {
  app.press(key)
  await act(async () => {})
}

const QUOTE = '*/api/v1/crops/:crop/quote'

describe('crop detail · 行情 tab (T27)', () => {
  it('shows the median price, three metrics and opens the markets card on OK', async () => {
    const app = await renderApp('/crop/onion/today', { history: ['/'] })
    expect(await screen.findByText('2,395')).toBeInTheDocument()
    expect(screen.getByText('7 個市場中位數 · ₹/公擔')).toBeInTheDocument()
    expect(screen.getByText('+109')).toBeInTheDocument()
    expect(screen.getByText('本地區 10 個市場')).toBeInTheDocument()
    expect(screen.getByText('最高 2,522・最低 2,264')).toBeInTheDocument()
    expect(screen.getByText('+5.5%')).toBeInTheDocument()
    expect(screen.getByText('偏多 ▲18%')).toBeInTheDocument()
    expect(screen.getByText('高檔 100%')).toBeInTheDocument()
    expect(screen.getByText('9/19 11:40')).toBeInTheDocument()
    expect(app.focusedId()).toBe('markets')
    expect([app.softKey('left'), app.softKey('center'), app.softKey('right')]).toEqual([
      '選單',
      '市場',
      '返回',
    ])

    await press(app, 'Enter')
    expect(app.path()).toBe('/crop/onion/markets?area=nashik')
  })

  it('switches tabs with ◀ ▶, opens the area panel with # and the menu with the left key', async () => {
    const app = await renderApp('/crop/onion/today?area=pune')
    await screen.findByText('本地區 10 個市場')
    await press(app, '#')
    expect(app.path()).toBe('/crop/onion/today?area=pune&sheet=area')
    expect(app.softKey('center')).toBe('選取')
    await app.back()
    await press(app, 'Escape')
    expect(app.path()).toBe('/crop/onion/today?area=pune&sheet=menu')
    await app.back()
    await press(app, 'ArrowLeft')
    expect(app.path()).toBe('/crop/onion/trend?area=pune')
    await press(app, 'ArrowLeft')
    expect(app.path()).toBe('/crop/onion/trend?area=pune')
  })

  it('turns every label, number and unit to retail with * and then goes on to 比價', async () => {
    const app = await renderApp('/crop/onion/today')
    await screen.findByText('2,395')
    await press(app, '*')
    expect(useSettings.getState().priceType).toBe('retail')
    expect(await screen.findByText('零售調查價 · ₹/公斤')).toBeInTheDocument()
    expect(screen.getByText('38.1')).toBeInTheDocument()
    expect(screen.getByText('零售價以地區為單位，沒有市場細項')).toBeInTheDocument()
    expect(screen.getByText('波動')).toBeInTheDocument()
    expect(screen.getByText('普通')).toBeInTheDocument()
    expect(screen.queryByText('本地區 10 個市場')).not.toBeInTheDocument()
    expect(app.focusedId()).toBeNull()
    expect(app.softKey('center')).toBe('比價')

    await press(app, 'Enter')
    expect(app.path()).toBe('/crop/onion/compare')
  })

  it('offers other areas and the trend when the area has not updated today', async () => {
    const app = await renderApp('/crop/onion/today?area=kolar')
    expect(await screen.findByText('Kolar 縣 今天還沒更新')).toBeInTheDocument()
    expect(screen.getByText('這個地區通常 14:00 前更新')).toBeInTheDocument()
    expect(screen.getByText('最近一筆（3 天前）：2,420 ₹/公擔')).toBeInTheDocument()
    expect(app.focusedId()).toBe('other-areas')
    expect(app.softKey('center')).toBe('選取')

    await press(app, '2')
    expect(app.path()).toBe('/crop/onion/trend?area=kolar')
  })

  it('explains missing retail prices and switches back to wholesale', async () => {
    const app = await renderApp('/crop/chilli/today')
    await screen.findByText('本地區 10 個市場')
    await press(app, '*')
    expect(await screen.findByText('尚無零售資料')).toBeInTheDocument()
    expect(screen.getByText('這個作物沒有零售回報')).toBeInTheDocument()
    expect(app.focusedId()).toBe('wholesale')
    expect(app.softKey('center')).toBe('選取')

    await press(app, 'Enter')
    expect(useSettings.getState().priceType).toBe('wholesale')
    expect(await screen.findByText('本地區 10 個市場')).toBeInTheDocument()
  })

  it('shows — and 無資料 for an area without any price', async () => {
    await renderApp('/crop/onion/today?area=kurnool')
    expect(await screen.findByText('—')).toBeInTheDocument()
    expect(screen.getByText('無資料')).toBeInTheDocument()
    expect(screen.queryByText('比 7 日均價')).not.toBeInTheDocument()
  })

  it('says what is loading, then offers 重試 when the connection fails', async () => {
    server.use(http.get(QUOTE, () => delay('infinite')))
    const loading = await renderApp('/crop/onion/today')
    expect(await screen.findByText('正在取得 Nashik 縣 的行情')).toBeInTheDocument()
    expect(loading.softKey('center')).toBe('')
    loading.unmount()

    server.use(
      http.get(QUOTE, () =>
        HttpResponse.json(
          { error: { code: 'upstream_unavailable', message: 'down', request_id: 'test' } },
          { status: 503 },
        ),
      ),
    )
    const app = await renderApp('/crop/onion/today')
    expect(await screen.findByText('連線失敗', {}, { timeout: 3000 })).toBeInTheDocument()
    expect(app.focusedId()).toBe('retry')
    expect(app.softKey('center')).toBe('重試')

    server.resetHandlers()
    await press(app, 'Enter')
    expect(await screen.findByText('2,395')).toBeInTheDocument()
  })
})
