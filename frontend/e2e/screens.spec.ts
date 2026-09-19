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
  // Nearby prices: no area within 100 km has today's price (Kolar is 3 days old).
  '/crop/onion/today?area=bengaluru',
  '/crop/onion/compare?sort=distance_asc',
  // 各國參考價: wheat also carries the World Bank world price row.
  '/crop/wheat/compare',
  '/crop/onion/markets?area=kurnool',
  '/intl',
  '/intl/rice',
  '/intl/sugar',
]

const MY_SCREENS = [
  '/',
  '/?tab=all',
  '/?sheet=menu',
  '/?sheet=area',
  '/cat/fruit',
  '/cat/other',
  '/crop/tomato/today',
  '/crop/tomato/trend',
  '/crop/tomato/trend?days=30',
  '/crop/tomato/compare',
  '/crop/tomato/compare?sheet=sort',
  '/crop/tomato/markets',
  '/crop/tomato/markets/klborong',
  '/crop/tomato/today?area=timurlaut',
  '/areas?for=home',
  '/watch',
  '/settings',
  '/settings/language',
  '/settings/demo',
  '/about',
  '/intl',
  '/intl/palm_oil',
]

/** `locale` is the phone language (navigator.language), which a new user's setup follows. */
const cases: { name: string; state: AppState; paths: string[]; locale?: string }[] = [
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
      '/cat/leafy',
      '/cat/fruitveg',
      '/crop/cabbage/today',
      // Nearby prices on both sides (Taipei higher, Taoyuan lower).
      '/crop/cabbage/today?area=newtaipei',
      '/crop/cabbage/trend',
      '/crop/cabbage/compare',
      '/crop/cabbage/markets',
      '/crop/cabbage/markets/tp1',
      '/areas?for=home',
      '/settings',
      '/intl',
      '/intl/palm_oil',
    ],
  },
  {
    // Taiwan's own categories (docs/02 §5.2) and a crop of the new markets.
    name: 'TW zh-TW',
    state: { country: 'TW', lang: 'zh-TW' },
    paths: [
      '/?tab=all',
      '/cat/root',
      '/cat/gourd',
      '/crop/napacabbage/today',
      '/crop/napacabbage/today?area=changhua',
      '/crop/napacabbage/markets?area=taichung',
    ],
  },
  {
    name: 'MY en',
    state: { country: 'MY', lang: 'en' },
    paths: [
      '/',
      '/?tab=all',
      '/cat/fruit',
      '/cat/other',
      '/crop/tomato/today',
      '/crop/tomato/trend?days=30',
      '/crop/tomato/compare',
      '/crop/tomato/markets',
      '/crop/tomato/markets/klborong',
      '/crop/tomato/today?area=timurlaut',
      '/areas?for=home',
      '/settings',
      '/about',
    ],
  },
  {
    name: 'MY zh-TW retail',
    state: { country: 'MY', lang: 'zh-TW', priceType: 'retail' },
    paths: ['/', '/?tab=all', '/crop/calamansi/today', '/crop/tomato/compare', '/areas?for=home'],
  },
  {
    name: 'first run',
    state: { setupDone: false },
    paths: ['/setup/lang', '/setup/langs', '/setup/country', '/setup/area'],
  },
  // Bahasa Melayu and हिन्दी (machine translations): Devanagari is the tightest fit.
  { name: 'IN hi', state: { country: 'IN', lang: 'hi' }, paths: IN_SCREENS },
  {
    name: 'IN hi retail',
    state: { country: 'IN', lang: 'hi', priceType: 'retail' },
    paths: ['/', '/crop/onion/today', '/crop/chilli/today', '/crop/onion/markets/lasalgaon'],
  },
  { name: 'MY ms', state: { country: 'MY', lang: 'ms' }, paths: MY_SCREENS },
  {
    name: 'MY ms retail',
    state: { country: 'MY', lang: 'ms', priceType: 'retail' },
    paths: ['/', '/crop/calamansi/today', '/crop/tomato/compare', '/crop/tomato/markets'],
  },
  {
    name: 'TW ms',
    state: { country: 'TW', lang: 'ms' },
    paths: ['/', '/crop/cabbage/today', '/crop/cabbage/trend', '/intl/rice'],
  },
  {
    name: 'first run on a Hindi phone',
    state: { setupDone: false },
    locale: 'hi-IN',
    paths: ['/setup/lang', '/setup/langs', '/setup/country', '/setup/area'],
  },
  {
    name: 'first run on a Malay phone',
    state: { setupDone: false },
    locale: 'ms-MY',
    paths: ['/setup/lang', '/setup/langs', '/setup/country', '/setup/area'],
  },
]

for (const c of cases) {
  test.describe(c.name, () => {
    if (c.locale) test.use({ locale: c.locale })
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
