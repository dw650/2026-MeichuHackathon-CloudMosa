import { act, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { renderApp } from '@/test/renderApp'

type App = Awaited<ReturnType<typeof renderApp>>

async function press(app: App, key: string) {
  app.press(key)
  await act(async () => {})
}

const listed = () =>
  Array.from(document.querySelectorAll('[data-focus-id^="area:"]')).map((card) =>
    card.getAttribute('data-focus-id'),
  )
const card = (areaId: string) =>
  document.querySelector<HTMLElement>(`[data-focus-id="area:${areaId}"]`) ?? document.body
const softKeys = (app: App) => [app.softKey('left'), app.softKey('center'), app.softKey('right')]

describe('crop detail · 比價 tab (T29)', () => {
  it('ranks every area by price, marks the viewed one 你 and opens an area on OK', async () => {
    const app = await renderApp('/crop/onion/compare', { history: ['/'] })
    expect(await screen.findByText('Nashik 縣 價格排第 39／63')).toBeInTheDocument()
    expect(screen.getByText('價格 高→低')).toBeInTheDocument()
    expect(listed()).toHaveLength(64)
    expect(listed().slice(0, 3)).toEqual(['area:palghar', 'area:bengaluru', 'area:raigad'])
    expect(listed().at(-1)).toBe('area:dakshinakannada')
    expect(within(card('bengaluru')).getByText('+1,053')).toBeInTheDocument()
    expect(within(card('bengaluru')).getByText('直線 889 km · 2 市場')).toBeInTheDocument()
    expect(within(card('nashik')).getByText('你')).toBeInTheDocument()
    expect(within(card('nashik')).getByText('7 市場')).toBeInTheDocument()
    expect(within(card('kolar')).getByText('3 天前')).toHaveClass('warn')
    // No rank and no price.
    expect(within(card('dakshinakannada')).getAllByText('—')).toHaveLength(2)
    expect(within(card('dakshinakannada')).getByText('無資料')).toBeInTheDocument()
    expect(app.focusedId()).toBe('area:palghar')
    expect(softKeys(app)).toEqual(['選單', '查看', '返回'])

    await press(app, 'ArrowDown')
    expect(app.focusedId()).toBe('area:bengaluru')
    await press(app, 'Enter')
    expect(app.path()).toBe('/crop/onion/today?area=bengaluru')
  })

  it('sorts with the # panel, keeping areas without data last', async () => {
    const app = await renderApp('/crop/onion/compare')
    await screen.findByText('Nashik 縣 價格排第 39／63')
    await press(app, '#')
    expect(app.path()).toBe('/crop/onion/compare?sheet=sort')
    expect(screen.getByRole('dialog', { name: '排序方式' })).toBeInTheDocument()
    expect(softKeys(app)).toEqual(['', '選取', '關閉'])
    expect(app.focusedId()).toBe('sort:price_desc')

    await press(app, '3')
    await waitFor(() => expect(app.path()).toBe('/crop/onion/compare?sort=distance_asc'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('距離 近→遠')).toBeInTheDocument()
    expect(listed().slice(0, 4)).toEqual([
      'area:nashik',
      'area:dhule',
      'area:sambhajinagar',
      'area:palghar',
    ])
    expect(listed().at(-1)).toBe('area:dakshinakannada')
    expect(app.focusedId()).toBe('area:nashik')
    // The number is the price rank, whatever the order.
    expect(within(card('nashik')).getByText('39')).toBeInTheDocument()

    await press(app, '2')
    expect(app.path()).toBe('/crop/onion/today?area=dhule')
  })

  it('returns to the first area when * switches the price type', async () => {
    const app = await renderApp('/crop/onion/compare')
    await screen.findByText('Nashik 縣 價格排第 39／63')
    await press(app, 'ArrowDown')
    await press(app, 'ArrowDown')
    expect(app.focusedId()).toBe('area:raigad')

    await press(app, '*')
    await waitFor(() => expect(app.focusedId()).toBe('area:palghar'))
    expect(screen.getAllByText('零售').length).toBeGreaterThan(0)
    expect(within(card('bengaluru')).getByText('直線 889 km')).toBeInTheDocument()
    expect(app.path()).toBe('/crop/onion/compare')
  })
})
