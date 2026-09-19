import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { useRef } from 'react'
import { createMemoryRouter, RouterProvider, useSearchParams } from 'react-router'
import { describe, expect, it } from 'vitest'

import { useNav } from '@/app/navigation'
import type { AreasFor } from '@/app/paths'
import { AppProviders } from '@/app/providers'
import { buildRoutes, SCREENS } from '@/app/routes'
import { Shell } from '@/components/Shell/Shell'
import { useFocusList } from '@/focus/useFocusList'
import { useKeys } from '@/keys/useKeys'
import { AreaSheet, sheetSoftKeys } from '@/screens/shared/AreaSheet'
import { useCountryData } from '@/screens/shared/useCountryData'
import { areaLabel, useText } from '@/screens/shared/useText'
import { useSettings } from '@/store/settings'
import { resetApp } from '@/test/renderApp'

/** Stands in for a screen with `#` → 換地區, wired the way the real screens are. */
function Harness({ areaFor }: { areaFor: AreasFor }) {
  const nav = useNav()
  const { t, lang } = useText()
  const [params] = useSearchParams()
  const { country, area, myArea } = useCountryData()
  const current = areaFor === 'view' ? (params.get('area') ?? myArea?.id) : myArea?.id
  const root = useRef<HTMLDivElement>(null)
  const list = useFocusList(['item'], { root, active: nav.sheet === null })
  useKeys({ ...list.keys, onHash: () => nav.openSheet('area') })
  const own = { left: t('softkeys.menu'), center: t('softkeys.open'), right: t('softkeys.back') }
  return (
    <Shell
      title={areaLabel(area(current), country, lang)}
      softKeys={nav.sheet ? sheetSoftKeys(t) : own}
      overlay={
        nav.sheet === 'area' && current ? (
          <AreaSheet areaFor={areaFor} currentAreaId={current} />
        ) : null
      }
    >
      <div ref={root}>
        <div data-focus-id="item" tabIndex={-1}>
          item
        </div>
      </div>
    </Shell>
  )
}

const routes = buildRoutes({
  ...SCREENS,
  home: () => <Harness areaFor="home" />,
  'crop-detail': () => <Harness areaFor="view" />,
})

async function renderHarness(path: string, history: string[] = []) {
  resetApp()
  const entries = [...history, path]
  const router = createMemoryRouter(routes, {
    initialEntries: entries,
    initialIndex: entries.length - 1,
  })
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  )
  await screen.findByRole('heading', { name: /Nashik 縣|Kolar 縣/ })
  return {
    press: (key: string) =>
      act(() => {
        fireEvent.keyDown(document.activeElement ?? document.body, { key })
      }),
    back: () => act(() => router.navigate(-1)),
    path: () => router.state.location.pathname + router.state.location.search,
    focusedId: () => document.activeElement?.getAttribute('data-focus-id') ?? null,
    softKeys: () =>
      (['left', 'center', 'right'] as const).map(
        (slot) => document.querySelector(`[data-softkey="${slot}"]`)?.textContent ?? '',
      ),
  }
}

const rowLabels = () =>
  within(screen.getByRole('dialog', { name: '換地區' }))
    .getAllByText(/.+/, { selector: '[data-focus-id] span' })
    .map((el) => el.textContent)

describe('AreaSheet (#, F07)', () => {
  it('opens on # with the recent areas, the current one checked, and panel soft keys', async () => {
    const app = await renderHarness('/')
    app.press('#')
    expect(app.path()).toBe('/?sheet=area')
    expect(rowLabels()).toEqual(['Nashik 縣', 'Pune 縣', 'Ahmednagar 縣', '其他地區…'])
    expect(app.focusedId()).toBe('area:nashik')
    expect(document.querySelector('[aria-current]')?.getAttribute('data-focus-id')).toBe(
      'area:nashik',
    )
    expect(app.softKeys()).toEqual(['', '選取', '關閉'])
    app.press('ArrowDown')
    expect(app.focusedId()).toBe('area:pune')
  })

  it('changes my area on home with a digit and closes the panel', async () => {
    const app = await renderHarness('/')
    app.press('#')
    app.press('2')
    await screen.findByRole('heading', { name: 'Pune 縣' })
    expect(app.path()).toBe('/')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(useSettings.getState().areaId).toBe('pune')
    expect(useSettings.getState().recentAreaIds).toEqual(['pune', 'nashik', 'ahmednagar'])
    expect(app.softKeys()).toEqual(['選單', '開啟', '返回'])
    expect(app.focusedId()).toBe('item')
  })

  it('changes only the viewed area on a detail screen, without adding history', async () => {
    const app = await renderHarness('/crop/onion/today?area=kolar', ['/'])
    app.press('#')
    expect(document.querySelector('[aria-current]')).toBeNull()
    app.press('ArrowDown')
    app.press('Enter')
    await screen.findByRole('heading', { name: 'Pune 縣' })
    expect(app.path()).toBe('/crop/onion/today?area=pune')
    expect(useSettings.getState().areaId).toBe('nashik')
    expect(useSettings.getState().recentAreaIds[0]).toBe('pune')
    await app.back()
    expect(app.path()).toBe('/')
  })
})
