/**
 * Renders the whole app (routes, providers, msw fixtures) at a path, for screen tests:
 *
 *   const app = await renderApp('/')                    // India, Nashik, 繁中, setup done
 *   app.press('ArrowDown'); app.press('Enter')          // keys go through the real dispatcher
 *   expect(app.focusedId()).toBe('crop:tomato')
 *   expect(app.softKey('center')).toBe('開啟')
 *   expect(app.path()).toBe('/crop/tomato/today')
 */
import { act, fireEvent, render } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'

import { AppProviders } from '@/app/providers'
import { appRoutes } from '@/app/routes'
import { setLanguage } from '@/i18n'
import type { LanguageId } from '@/i18n/languages'
import { useSession } from '@/store/session'
import type { PriceType } from '@/lib/units'
import { type CountryCode, useSettings } from '@/store/settings'

interface Defaults {
  area: string
  recent: string[]
  watch: string[]
  priceType: PriceType
}

const DEFAULTS: Record<CountryCode, Defaults> = {
  IN: {
    area: 'nashik',
    recent: ['nashik', 'pune', 'ahmednagar'],
    watch: ['onion', 'tomato', 'potato', 'chilli', 'chickpea', 'maize', 'wheat'],
    priceType: 'wholesale',
  },
  TW: {
    area: 'taipei',
    recent: ['taipei', 'newtaipei', 'taichung'],
    watch: ['cabbage', 'bokchoy', 'banana', 'sweetpotato', 'scallion', 'cauliflower'],
    priceType: 'wholesale',
  },
  MY: {
    area: 'kualalumpur',
    recent: ['kualalumpur', 'klang', 'seremban'],
    watch: ['tomato', 'cabbage', 'chilli', 'onion', 'cucumber', 'bokchoy', 'garlic'],
    priceType: 'retail',
  },
}

export interface RenderAppOptions {
  /** Country chosen during setup; `null` leaves first-run setup undone. Default `IN`. */
  country?: CountryCode | null
  /** My area; default the country's default area. */
  area?: string
  /** UI language; default `zh-TW`. */
  lang?: LanguageId
  /** Earlier history entries below `path` (e.g. `['/']` so back returns home). */
  history?: string[]
}

/** Clears storage and both stores, then applies the given setup. */
export function resetApp(options: RenderAppOptions = {}): void {
  localStorage.clear()
  useSettings.setState(useSettings.getInitialState(), true)
  useSession.setState(useSession.getInitialState(), true)
  const lang = options.lang ?? 'zh-TW'
  useSettings.getState().chooseLanguage(lang)
  setLanguage(lang)
  const country = options.country === undefined ? 'IN' : options.country
  if (country) {
    const d = DEFAULTS[country]
    useSettings.getState().chooseCountry(country, {
      default_area_id: d.area,
      default_recent_area_ids: d.recent,
      default_watch: d.watch,
      default_price_type: d.priceType,
    })
    useSettings.getState().chooseArea(options.area ?? d.area)
  }
}

export async function renderApp(path: string, options: RenderAppOptions = {}) {
  resetApp(options)
  const entries = [...(options.history ?? []), path]
  const router = createMemoryRouter(appRoutes, {
    initialEntries: entries,
    initialIndex: entries.length - 1,
  })
  const view = render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  )
  await act(async () => {})
  return {
    ...view,
    router,
    /** Presses a key the way the phone sends it (keydown on the page). */
    press(key: string, init: { repeat?: boolean } = {}) {
      act(() => {
        fireEvent.keyDown(document.activeElement ?? document.body, { key, ...init })
      })
    },
    /** The right soft key: history back. */
    async back() {
      await act(() => router.navigate(-1))
    },
    path: () => router.state.location.pathname + router.state.location.search,
    focusedId: () => document.activeElement?.getAttribute('data-focus-id') ?? null,
    softKey: (slot: 'left' | 'center' | 'right') =>
      document.querySelector(`[data-softkey="${slot}"]`)?.textContent ?? '',
  }
}
