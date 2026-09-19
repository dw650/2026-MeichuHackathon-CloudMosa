/** T24: the component showcase at both sizes and in both languages (docs/07 §4). */
import { seed, settled } from './app'
import { expectCleanScreen, test } from './checks'

for (const lang of ['zh-TW', 'en'] as const) {
  test(`components page (${lang})`, async ({ page, errors }) => {
    await seed(page, { country: 'TW', lang })
    await page.goto('/debug/components')
    await settled(page)
    await expectCleanScreen(page, errors)
  })
}
