/** Opening the app in a known state for UI checks: storage is written before the app loads. */
import type { Page } from '@playwright/test'

export type Country = 'IN' | 'TW'
export type Lang = 'zh-TW' | 'en'

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
}

export interface AppState {
  country?: Country
  lang?: Lang
  priceType?: 'wholesale' | 'retail'
  /** false = a brand-new user (first-run setup). */
  setupDone?: boolean
  /** Demo switch for the location guess (F18); a new user can have it set too. */
  locate?: 'auto' | 'none' | 'IN:nashik' | 'TW:taipei'
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

/** Waits until the screen has rendered its data (no skeletons left). */
export async function settled(page: Page): Promise<void> {
  await page.locator('h1').first().waitFor()
  await page.waitForLoadState('networkidle')
}
