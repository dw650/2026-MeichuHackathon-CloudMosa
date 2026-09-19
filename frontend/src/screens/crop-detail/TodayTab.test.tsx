import { act, screen, within } from '@testing-library/react'
import { delay, http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { useSettings } from '@/store/settings'
import countries from '@/test/fixtures/countries.json'
import inCrops from '@/test/fixtures/countries_IN_crops.json'
import nashikRetail from '@/test/fixtures/crops_onion_quote__area-nashik_country-IN_days-30_type-retail.json'
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
    expect(await screen.findByText('3,969')).toBeInTheDocument()
    expect(screen.getByText('7 個市場中位數 · ₹/100公斤')).toBeInTheDocument()
    expect(screen.getByText('+93')).toBeInTheDocument()
    expect(screen.getByText('本地區 24 個市場')).toBeInTheDocument()
    expect(screen.getByText('最高 4,476・最低 3,871')).toBeInTheDocument()
    expect(screen.getByText('+3.3%')).toBeInTheDocument()
    expect(screen.getByText('偏多 ▲18%')).toBeInTheDocument()
    expect(screen.getByText('高檔 87%')).toBeInTheDocument()
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
    await screen.findByText('本地區 24 個市場')
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

  it('turns every label, number and unit to retail with *', async () => {
    const app = await renderApp('/crop/onion/today')
    await screen.findByText('3,969')
    await press(app, '*')
    expect(useSettings.getState().priceType).toBe('retail')
    expect(await screen.findByText('零售調查價 · ₹/公斤')).toBeInTheDocument()
    expect(screen.getByText('64.9')).toBeInTheDocument()
    expect(screen.getByText('零售價以地區為單位，沒有市場細項')).toBeInTheDocument()
    expect(screen.getByText('波動')).toBeInTheDocument()
    expect(screen.getByText('普通')).toBeInTheDocument()
    expect(screen.queryByText('本地區 24 個市場')).not.toBeInTheDocument()
  })

  it('goes on to 比價 on OK when retail has nothing to select', async () => {
    server.use(
      http.get(QUOTE, ({ request }) =>
        new URL(request.url).searchParams.get('type') === 'retail'
          ? HttpResponse.json({ ...nashikRetail, nearby: null })
          : undefined,
      ),
    )
    const app = await renderApp('/crop/onion/today')
    await screen.findByText('3,969')
    await press(app, '*')
    expect(await screen.findByText('64.9')).toBeInTheDocument()
    expect(app.focusedId()).toBeNull()
    expect(app.softKey('center')).toBe('比價')

    await press(app, 'Enter')
    expect(app.path()).toBe('/crop/onion/compare')
  })

  it('offers other areas and the trend when the area has not updated today', async () => {
    const app = await renderApp('/crop/onion/today?area=kolar')
    expect(await screen.findByText('Kolar 縣 今天還沒更新')).toBeInTheDocument()
    expect(screen.getByText('這個地區通常 14:00 前更新')).toBeInTheDocument()
    expect(screen.getByText('最近一筆（3 天前）：3,467 ₹/100公斤')).toBeInTheDocument()
    expect(app.focusedId()).toBe('other-areas')
    expect(app.softKey('center')).toBe('選取')

    await press(app, '2')
    expect(app.path()).toBe('/crop/onion/trend?area=kolar')
  })

  it('explains missing retail prices and switches back to wholesale', async () => {
    const app = await renderApp('/crop/chilli/today')
    await screen.findByText('本地區 24 個市場')
    await press(app, '*')
    expect(await screen.findByText('尚無零售資料')).toBeInTheDocument()
    expect(screen.getByText('這個作物沒有零售回報')).toBeInTheDocument()
    expect(app.focusedId()).toBe('wholesale')
    expect(app.softKey('center')).toBe('選取')

    await press(app, 'Enter')
    expect(useSettings.getState().priceType).toBe('wholesale')
    expect(await screen.findByText('本地區 24 個市場')).toBeInTheDocument()
  })

  it('shows — and 無資料 for an area without any price', async () => {
    await renderApp('/crop/onion/today?area=dakshinakannada')
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
    expect(await screen.findByText('3,969')).toBeInTheDocument()
  })
})

/** A nearby card by its focus id, or the viewed area's own (not selectable) row by its label. */
const nearbyCard = (id: string) =>
  document.querySelector<HTMLElement>(`[data-focus-id="${id}"]`) ?? document.body
const ownRow = (label: string) =>
  screen.getByText(label).closest<HTMLElement>('[data-fixed]') ?? document.body

describe('crop detail · 行情 tab · nearby prices', () => {
  it('names the highest and the lowest nearby area and opens one on OK', async () => {
    // Within 150 km of New Taipei: Taipei (11 km) pays most, Changhua (139 km) least.
    const app = await renderApp('/crop/cabbage/today?area=newtaipei', {
      country: 'TW',
      history: ['/'],
    })
    await screen.findByText('附近最高 · 直線 11 km')
    const high = within(nearbyCard('nearby-high'))
    expect(high.getByText('台北市')).toBeInTheDocument()
    expect(high.getByText('32.4')).toBeInTheDocument()
    expect(high.getByText('+0.7')).toBeInTheDocument()
    expect(high.getByText('2')).toBeInTheDocument() // digit key cap
    const low = within(nearbyCard('nearby-low'))
    expect(low.getByText('彰化縣')).toBeInTheDocument()
    expect(low.getByText('附近最低 · 直線 139 km')).toBeInTheDocument()
    expect(low.getByText('28.4')).toBeInTheDocument()
    expect(low.getByText('3')).toBeInTheDocument()

    // The markets card stays first; ↓ reaches the nearby cards.
    expect(app.focusedId()).toBe('markets')
    await press(app, 'ArrowDown')
    expect(app.focusedId()).toBe('nearby-high')
    expect(app.softKey('center')).toBe('查看')
    await press(app, 'ArrowDown')
    await press(app, 'Enter')
    expect(app.path()).toBe('/crop/cabbage/today?area=changhua')

    // Back returns to the same card.
    await app.back()
    expect(app.path()).toBe('/crop/cabbage/today?area=newtaipei')
    expect(app.focusedId()).toBe('nearby-low')
  })

  it('opens a nearby area with its digit key', async () => {
    const app = await renderApp('/crop/cabbage/today?area=newtaipei', { country: 'TW' })
    await screen.findByText('附近最低 · 直線 139 km')
    await press(app, '3')
    expect(app.path()).toBe('/crop/cabbage/today?area=changhua')
  })

  it('says so when the viewed area itself is the highest', async () => {
    const app = await renderApp('/crop/cabbage/today', { country: 'TW' })
    await screen.findByText('32.4')
    const own = within(ownRow('附近最高'))
    expect(own.getByText('台北市')).toBeInTheDocument()
    expect(own.getByText('你')).toBeInTheDocument()
    expect(ownRow('附近最高')).not.toHaveAttribute('data-focus-id')
    const low = within(nearbyCard('nearby-low'))
    expect(low.getByText('彰化縣')).toBeInTheDocument()
    expect(low.getByText('附近最低 · 直線 148 km')).toBeInTheDocument()
    expect(low.getByText('28.4')).toBeInTheDocument()
    expect(low.getByText('−4.0')).toBeInTheDocument()
    // The own row cannot be opened, so the lowest one comes right after the markets card.
    expect(low.getByText('2')).toBeInTheDocument()
    await press(app, 'ArrowDown')
    expect(app.focusedId()).toBe('nearby-low')
    await press(app, 'ArrowDown')
    expect(app.focusedId()).toBe('nearby-low')
  })

  it('follows * to retail prices', async () => {
    const app = await renderApp('/crop/cabbage/today', { country: 'TW' })
    await screen.findByText('32.4')
    await press(app, '*')
    await screen.findByText('54.8')
    expect(within(ownRow('附近最高')).getByText('台北市')).toBeInTheDocument()
    const low = within(nearbyCard('nearby-low'))
    expect(low.getByText('彰化縣')).toBeInTheDocument()
    expect(low.getByText('49.6')).toBeInTheDocument()
    expect(low.getByText('−5.2')).toBeInTheDocument()
    // Retail has no markets card: the nearby card is the only thing to select.
    expect(app.focusedId()).toBe('nearby-low')
    expect(app.softKey('center')).toBe('查看')
    await press(app, '1')
    expect(app.path()).toBe('/crop/cabbage/today?area=changhua')
  })

  it('is left out when no other area is within 150 km', async () => {
    const app = await renderApp('/crop/onion/today?area=delhi')
    await screen.findByText('4,124')
    expect(screen.queryByText(/附近最/)).not.toBeInTheDocument()
    expect(app.focusedId()).toBe('markets')
    await press(app, 'ArrowDown')
    expect(app.focusedId()).toBe('markets')
  })

  it('is left out while the area has not updated today', async () => {
    await renderApp('/crop/onion/today?area=kolar')
    await screen.findByText('Kolar 縣 今天還沒更新')
    expect(screen.queryByText(/附近最/)).not.toBeInTheDocument()
  })

  it('speaks English', async () => {
    const app = await renderApp('/crop/cabbage/today', { country: 'TW', lang: 'en' })
    await screen.findByText('32.4')
    const own = within(ownRow('Highest nearby'))
    expect(own.getByText('Taipei')).toBeInTheDocument()
    expect(own.getByText('You')).toBeInTheDocument()
    const low = within(nearbyCard('nearby-low'))
    expect(low.getByText('Changhua')).toBeInTheDocument()
    expect(low.getByText('Lowest · 148 km (straight)')).toBeInTheDocument()
    expect(low.getByText('28.4')).toBeInTheDocument()
    expect(low.getByText('−4.0')).toBeInTheDocument()
    await press(app, 'ArrowDown')
    expect(app.softKey('center')).toBe('View')
    await press(app, 'Enter')
    expect(app.path()).toBe('/crop/cabbage/today?area=changhua')
  })
})

describe('crop detail · estimated prices (docs/06 §3.6)', () => {
  it('names the crop ratio once, on every tab, and marks the price type', async () => {
    server.use(
      http.get('*/api/v1/countries', () =>
        HttpResponse.json({
          countries: countries.countries.map((c) =>
            c.code === 'IN' ? { ...c, estimated_price_types: ['retail'] } : c,
          ),
        }),
      ),
      http.get('*/api/v1/countries/IN/crops', () =>
        HttpResponse.json({
          country: 'IN',
          crops: inCrops.crops.map((c) => ({ ...c, estimate_ratio: c.id === 'onion' ? 1.5 : 1.7 })),
        }),
      ),
    )
    const app = await renderApp('/crop/onion/today', { history: ['/'] })
    expect(await screen.findByText('3,969')).toBeInTheDocument()
    expect(screen.queryByText(/推估/)).not.toBeInTheDocument()

    await press(app, '*')
    // The info bar holds one tag per screen size (only one is shown, docs/03 §6).
    expect(await screen.findAllByText('≈零售')).toHaveLength(2)
    const note = '零售價由批發價 ×1.5 推估，僅供參考'
    // The note sits with the price, so it arrives with the retail quote.
    expect(await screen.findAllByText(note)).toHaveLength(1)
    // The same note on the 走勢 tab, still only once.
    await press(app, 'ArrowLeft')
    expect(app.path()).toBe('/crop/onion/trend')
    expect(await screen.findAllByText(note)).toHaveLength(1)
  })
})
