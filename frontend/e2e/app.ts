/** Opening the app in a known state for UI checks: storage is written before the app loads. */
import { expect, type Page } from '@playwright/test'

export type Country = 'IN' | 'TW' | 'MY'
export type Lang = 'zh-TW' | 'en' | 'ms' | 'hi'

const DEFAULTS: Record<Country, { area: string; recent: string[]; watch: string[] }> = {
  IN: {
    area: 'nashik',
    recent: ['nashik', 'pune', 'ahmednagar'],
    watch: ['onion', 'tomato', 'potato', 'chilli', 'soybean', 'maize', 'wheat'],
  },
  TW: {
    area: 'taipei',
    recent: ['taipei', 'newtaipei', 'taichung'],
    watch: ['cabbage', 'bokchoy', 'banana', 'sweetpotato', 'scallion', 'cauliflower'],
  },
  MY: {
    area: 'kualalumpur',
    recent: ['kualalumpur', 'klang', 'seremban'],
    watch: ['tomato', 'cabbage', 'chilli', 'onion', 'cucumber', 'bokchoy', 'garlic'],
  },
}

export interface AppState {
  country?: Country
  lang?: Lang
  priceType?: 'wholesale' | 'retail'
  /** false = a brand-new user (first-run setup). */
  setupDone?: boolean
  /** Demo switch for the location guess (F18); a new user can have it set too. */
  locate?: 'auto' | 'none' | 'IN:nashik' | 'TW:taipei' | 'MY:kualalumpur'
  /** Demo switches (F18): price APIs fail / my area's data is 3 days old. */
  fail?: boolean
  stale?: boolean
}

/** Seeds the stores (same format as src/store) so the next navigation starts in that state. */
export async function seed(page: Page, state: AppState = {}): Promise<void> {
  const country = state.country ?? 'IN'
  const d = DEFAULTS[country]
  const demo = {
    fail: state.fail ?? false,
    stale: state.stale ?? false,
    locate: state.locate ?? 'auto',
  }
  const fresh = {
    state: {
      language: null,
      country: null,
      areaId: null,
      recentAreaIds: [],
      watchlist: [],
      priceType: 'wholesale',
      units: { wholesale: null, retail: null },
      setupDone: false,
      demo,
    },
    version: 1,
  }
  const settings =
    state.setupDone === false
      ? fresh
      : {
          state: {
            language: state.lang ?? 'zh-TW',
            country,
            areaId: d.area,
            recentAreaIds: d.recent,
            watchlist: d.watch,
            priceType: state.priceType ?? 'wholesale',
            units: { wholesale: null, retail: null },
            setupDone: true,
            demo,
          },
          version: 1,
        }
  // Counts API requests in flight so `settled` can wait for client-side navigations too.
  // Plain JavaScript: injected as-is into every document before the app runs.
  await page.addInitScript({
    content: `(() => {
      window.__inflight = 0
      const original = window.fetch.bind(window)
      window.fetch = (...args) => {
        window.__inflight += 1
        return original(...args).finally(() => { window.__inflight -= 1 })
      }
    })()`,
  })
  await page.addInitScript(
    (value) => {
      if (sessionStorage.getItem('e2e-seeded')) return
      sessionStorage.setItem('e2e-seeded', '1')
      localStorage.clear()
      if (value) localStorage.setItem('agriprice.settings', value)
    },
    settings && JSON.stringify(settings),
  )
}

/**
 * Waits until the screen has rendered its data: a title, no API request in flight and no
 * skeleton left (client-side navigations never reset Playwright's `networkidle`).
 */
export async function settled(page: Page, options: { skeletons?: boolean } = {}): Promise<void> {
  await page.locator('h1').first().waitFor()
  await page.waitForFunction(
    (skeletonsAllowed) =>
      (window as unknown as { __inflight?: number }).__inflight === 0 &&
      (skeletonsAllowed || !document.querySelector('[data-skeleton]')),
    options.skeletons ?? false,
    { polling: 50, timeout: 15_000 },
  )
  await page.evaluate(
    () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
  )
}

/**
 * Waits until the worker has stored the demo news of a country: `make e2e` starts the tests as
 * soon as the api is healthy, while the worker may still be writing its start-up data.
 */
export async function waitForNews(page: Page, country: Country, area: string): Promise<void> {
  await expect
    .poll(
      async () => {
        const res = await page.request.get(`/api/v1/news?country=${country}&area=${area}`)
        if (!res.ok()) return 0
        const body = (await res.json()) as { items: unknown[] }
        return body.items.length
      },
      { timeout: 60_000, intervals: [500, 1000, 2000] },
    )
    .toBeGreaterThan(1)
}
