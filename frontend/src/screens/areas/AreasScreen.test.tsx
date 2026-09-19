import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { useSettings } from '@/store/settings'
import { server } from '@/test/msw/server'
import { renderApp } from '@/test/renderApp'

const ids = () =>
  Array.from(document.querySelectorAll('[data-focus-id]')).map((el) =>
    el.getAttribute('data-focus-id'),
  )
const row = (id: string) => document.querySelector(`[data-focus-id="${id}"]`)?.textContent ?? ''
const softKeys = (app: Awaited<ReturnType<typeof renderApp>>) =>
  (['left', 'center', 'right'] as const).map((slot) => app.softKey(slot))

describe('AreasScreen (選擇地區, F07)', () => {
  it('lists recent areas, then all areas by distance, then 「更改國家…」', async () => {
    const app = await renderApp('/areas?for=home', { history: ['/settings'] })
    await screen.findByText('Nashik 縣 ✓')
    expect(screen.getByRole('heading', { name: '選擇地區' })).toBeInTheDocument()
    expect(screen.getByText('最近使用')).toBeInTheDocument()
    expect(screen.getByText('全部地區')).toBeInTheDocument()
    expect(ids()).toEqual(
      [
        ...['nashik', 'pune', 'ahmednagar'],
        ...['jalgaon', 'solapur', 'indore', 'kurnool', 'bengaluru', 'kolar', 'agra', 'delhi'],
      ]
        .map((id) => `area:${id}`)
        .concat('country'),
    )
    expect(app.focusedId()).toBe('area:nashik')
    expect(softKeys(app)).toEqual(['', '選取', '返回'])
    // Region and straight-line distance from my area; status text only for exceptions.
    expect(row('area:nashik')).toBe('1Nashik 縣 ✓Maharashtra')
    expect(row('area:pune')).toBe('2Pune 縣Maharashtra · 直線 165 km')
    expect(row('area:jalgaon')).toContain('昨天')
    expect(row('area:kolar')).toContain('3 天前')
    expect(row('area:kurnool')).toContain('無資料')
    expect(row('country')).toBe('更改國家…')
  })

  it('changes my area and goes back (for=home)', async () => {
    const app = await renderApp('/areas?for=home', { history: ['/settings'] })
    await screen.findByText('Nashik 縣 ✓')
    app.press('4')
    expect(app.path()).toBe('/settings')
    expect(useSettings.getState().areaId).toBe('jalgaon')
    expect(useSettings.getState().recentAreaIds).toEqual(['jalgaon', 'nashik', 'pune'])
  })

  it('opens country setup from the last row and restores the focus on return', async () => {
    const app = await renderApp('/areas?for=home', { history: ['/'] })
    await screen.findByText('Nashik 縣 ✓')
    for (let i = 0; i < 11; i++) app.press('ArrowDown')
    expect(app.focusedId()).toBe('country')
    app.press('Enter')
    expect(app.path()).toBe('/setup/country')
    await app.back()
    await screen.findByText('Nashik 縣 ✓')
    expect(app.focusedId()).toBe('country')
  })

  it('shows the failure with 重試 and loads the list on retry', async () => {
    server.use(
      http.get('*/api/v1/countries/IN/areas', () =>
        HttpResponse.json(
          { error: { code: 'upstream_unavailable', message: 'down', request_id: 't' } },
          { status: 503 },
        ),
      ),
    )
    const app = await renderApp('/areas?for=home', { history: ['/'] })
    await screen.findByText('連線失敗', {}, { timeout: 3000 })
    expect(app.focusedId()).toBe('retry')
    expect(softKeys(app)).toEqual(['', '重試', '返回'])
    server.resetHandlers()
    app.press('Enter')
    await screen.findByText('Nashik 縣 ✓')
    expect(app.focusedId()).toBe('area:nashik')
  })
})
