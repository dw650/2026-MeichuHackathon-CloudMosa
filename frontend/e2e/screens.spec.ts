/**
 * Every screen × both sizes (docs/07 §4, T34/T39): no overflow, visible focus, font floor,
 * no console errors. The main flows by key are in flows.spec.ts.
 */
import { type AppState, seed, settled } from './app'
import { expectCleanScreen, test } from './checks'

const IN_SCREENS = [
  '/',
  '/?tab=all',
  '/?sheet=menu',
  '/?sheet=area',
  '/cat/veg',
  '/cat/all',
  '/crop/onion/today',
  '/crop/onion/trend',
  '/crop/onion/trend?days=30',
  '/crop/onion/compare',
  '/crop/onion/compare?sheet=sort',
  '/crop/onion/today?area=kolar',
  '/crop/onion/today?area=kurnool',
  '/crop/onion/markets',
  '/crop/onion/markets/lasalgaon',
  '/areas?for=home',
  '/watch',
  '/settings',
  '/settings/language',
  '/settings/demo',
  '/about',
  '/cat/recent',
  '/crop/onion/today?area=jalgaon',
  '/crop/onion/compare?sort=distance_asc',
  '/crop/onion/markets?area=kurnool',
]

const cases: { name: string; state: AppState; paths: string[] }[] = [
  { name: 'IN zh-TW', state: { country: 'IN', lang: 'zh-TW' }, paths: IN_SCREENS },
  {
    name: 'IN retail',
    state: { country: 'IN', lang: 'zh-TW', priceType: 'retail' },
    paths: [
      '/',
      '/crop/onion/today',
      '/crop/chilli/today',
      '/crop/onion/today?area=ahmednagar',
      '/crop/onion/markets',
      '/crop/onion/markets/lasalgaon',
    ],
  },
  {
    name: 'TW en',
    state: { country: 'TW', lang: 'en' },
    paths: [
      '/',
      '/?tab=all',
      '/crop/cabbage/today',
      '/crop/cabbage/trend',
      '/crop/cabbage/compare',
      '/crop/cabbage/markets',
      '/crop/cabbage/markets/tp1',
      '/areas?for=home',
      '/settings',
    ],
  },
  {
    name: 'first run',
    state: { setupDone: false },
    paths: ['/setup/lang', '/setup/langs', '/setup/country', '/setup/area'],
  },
]

for (const c of cases) {
  test.describe(c.name, () => {
    for (const path of c.paths) {
      test(path, async ({ page, errors }) => {
        await seed(page, c.state)
        await page.goto(path)
        await settled(page)
        await expectCleanScreen(page, errors)
      })
    }
  })
}
