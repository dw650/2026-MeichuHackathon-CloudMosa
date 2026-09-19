/**
 * README screenshots (`make screenshots`): 240×320 screens rendered at 2× into docs/images/.
 * Skipped in normal `make e2e` runs; only runs when SCREENSHOTS=1.
 */
import { seed, settled } from './app'
import { test } from './checks'

const OUT = '../docs/images'

const SHOTS: { file: string; path: string; country: 'IN' | 'TW'; lang: 'zh-TW' | 'en' }[] = [
  { file: 'home.png', path: '/', country: 'TW', lang: 'zh-TW' },
  { file: 'today.png', path: '/crop/onion/today', country: 'IN', lang: 'zh-TW' },
  { file: 'compare.png', path: '/crop/onion/compare', country: 'IN', lang: 'en' },
  { file: 'trend.png', path: '/crop/cabbage/trend?days=30', country: 'TW', lang: 'zh-TW' },
]

test.describe('screenshots', () => {
  test.skip(!process.env.SCREENSHOTS, 'run with make screenshots')
  test.use({ viewport: { width: 240, height: 320 }, deviceScaleFactor: 2 })

  for (const shot of SHOTS) {
    test(shot.file, async ({ page }, info) => {
      test.skip(info.project.name !== 'qvga', 'one size is enough')
      await seed(page, { country: shot.country, lang: shot.lang })
      await page.goto(shot.path)
      await settled(page)
      await page.screenshot({ path: `${OUT}/${shot.file}` })
    })
  }
})
