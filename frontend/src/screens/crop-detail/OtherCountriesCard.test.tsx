import { screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import taipeiCabbage from '@/test/fixtures/crops_cabbage_compare__area-taipei_country-TW_type-wholesale.json'
import { server } from '@/test/msw/server'
import { renderApp } from '@/test/renderApp'

const COMPARE = '*/api/v1/crops/:crop/compare'

/** The section of the 比價 tab under the area ranking. */
const section = () => {
  const head = screen.getByText('各國參考價').closest('div')
  return head?.parentElement ?? document.body
}
/** A card by the name on it. */
const row = (name: string) => screen.getByText(name).closest('[class*="card"]') ?? document.body

function serve(others: unknown) {
  server.use(
    http.get(COMPARE, () => HttpResponse.json({ ...taipeiCabbage, other_countries: others })),
  )
}

describe('crop detail · 比價 tab · 各國參考價', () => {
  it('lists the other countries with their price type, areas and trade date', async () => {
    const app = await renderApp('/crop/cabbage/compare', { country: 'TW' })
    await screen.findByText('台北市 價格排第 1／9')
    expect(screen.getByText('各國參考價')).toBeInTheDocument()
    // Converted into the viewer's currency and unit (TWD per kg), never the country's own.
    expect(within(row('印度')).getByText('4.3')).toBeInTheDocument()
    expect(within(row('印度')).getByText('批發 · 8 個地區中位數 · 9/19')).toBeInTheDocument()
    expect(within(row('馬來西亞')).getByText('26.6')).toBeInTheDocument()
    expect(screen.getByText('以 9/19 匯率換算')).toBeInTheDocument()
    expect(
      screen.getByText('批發與零售不能直接比，品種與品質也不同，匯率僅供參考'),
    ).toBeInTheDocument()
    // Informational: the card adds nothing to the focus list, which stays on the areas.
    expect(app.focusedId()).toBe('area:taipei')
    expect(within(section()).queryByRole('button')).not.toBeInTheDocument()
  })

  it('shows the same card in English', async () => {
    await renderApp('/crop/onion/compare', { lang: 'en' })
    await screen.findByText('Nashik district: price rank 7/10')
    expect(screen.getByText('Other countries')).toBeInTheDocument()
    expect(
      within(row('Malaysia')).getByText('Wholesale · median of 6 areas · 19/9'),
    ).toBeInTheDocument()
    expect(screen.getByText('At the 19/9 rate')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Wholesale and retail are not comparable, varieties and quality differ, and the rate is a reference',
      ),
    ).toBeInTheDocument()
  })

  it('says so when no other country reports the crop', async () => {
    serve({ currency: 'TWD', fx_date: null, rows: [], world: null })
    await renderApp('/crop/cabbage/compare', { country: 'TW' })
    expect(await screen.findByText('其他國家沒有這項作物的報價')).toBeInTheDocument()
    expect(screen.queryByText(/匯率換算/)).not.toBeInTheDocument()
  })

  it('shows 「—」 with the reason for a country without a price or without a rate', async () => {
    serve({
      currency: 'TWD',
      fx_date: '2026-09-19',
      world: null,
      rows: [
        {
          country: 'IN',
          currency: 'INR',
          type: null,
          local_per_kg: null,
          price_per_kg: null,
          n_areas: 0,
          trade_date: null,
          reason: 'no_data',
        },
        {
          country: 'MY',
          currency: 'MYR',
          type: 'retail',
          local_per_kg: 3.41,
          price_per_kg: null,
          n_areas: 6,
          trade_date: '2026-09-19',
          reason: 'no_fx',
        },
      ],
    })
    await renderApp('/crop/cabbage/compare', { country: 'TW' })
    expect(await screen.findByText('尚無資料')).toBeInTheDocument()
    expect(within(row('印度')).getByText('—')).toBeInTheDocument()
    expect(within(row('馬來西亞')).getByText('尚無匯率，無法換算')).toBeInTheDocument()
    expect(within(row('馬來西亞')).getByText('—')).toBeInTheDocument()
  })

  it('adds the World Bank world price for a crop with a published series', async () => {
    serve({
      currency: 'TWD',
      fx_date: '2026-09-19',
      rows: [],
      world: {
        series_id: 'wheat',
        month: '2026-08-01',
        usd: 240,
        usd_unit: 'mt',
        price_per_kg: 7.6392,
        reason: null,
      },
    })
    await renderApp('/crop/wheat/compare', { country: 'TW' })
    expect(await screen.findByText('世界銀行')).toBeInTheDocument()
    expect(within(row('世界銀行')).getByText('8 月世界價格')).toBeInTheDocument()
    expect(within(row('世界銀行')).getByText('7.6')).toBeInTheDocument()
  })
})
