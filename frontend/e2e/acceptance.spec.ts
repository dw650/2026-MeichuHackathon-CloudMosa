/**
 * Baseline acceptance checks that are not screen layout (docs/02 §7, T39): wholesale/retail
 * switches every number together, and switching language never changes country or area.
 */
import type { Page } from '@playwright/test'

import { seed, settled } from './app'
import { expect, expectCleanScreen, test } from './checks'

const text = (page: Page, selector: string) =>
  page.locator(selector).first().innerText({ timeout: 5_000 })

test('* switches price, tag, unit and indicators together on the detail screen', async ({
  page,
  errors,
}, info) => {
  await seed(page, { country: 'IN', lang: 'zh-TW' })
  await page.goto('/crop/onion/today')
  await settled(page)
  const before = await page.locator('main').innerText()
  expect(before).toContain('批發')
  expect(before).toContain('市場中位數')
  if (info.project.name === 'qvga') expect(before).toContain('₹/公擔')

  await page.keyboard.press('*')
  await settled(page)
  const after = await page.locator('main').innerText()
  expect(after).toContain('零售')
  expect(after).toContain('零售調查價')
  expect(after).not.toContain('市場中位數')
  if (info.project.name === 'qvga') {
    expect(after).toContain('₹/公斤')
    expect(after).toContain('波動') // retail shows swing instead of arrivals
    expect(after).not.toContain('到貨量')
  }
  await expectCleanScreen(page, errors)
})

test('* switches every card on home, and the choice is kept', async ({ page, errors }) => {
  await seed(page, { country: 'TW', lang: 'zh-TW' })
  await page.goto('/')
  await settled(page)
  const wholesale = await text(page, '[data-focus-id="crop:cabbage"]')
  await page.keyboard.press('*')
  await settled(page)
  const retail = await text(page, '[data-focus-id="crop:cabbage"]')
  expect(retail).not.toEqual(wholesale)
  expect(await page.locator('main').innerText()).toContain('零售')
  const stored = await page.evaluate(() => localStorage.getItem('agriprice.settings') ?? '')
  expect(stored).toContain('"priceType":"retail"')
  await expectCleanScreen(page, errors)
})

test('switching language keeps the country, the area and the currency', async ({
  page,
  errors,
}) => {
  await seed(page, { country: 'IN', lang: 'zh-TW' })
  await page.goto('/')
  await settled(page)
  await page.keyboard.press('Escape') // menu
  await settled(page)
  await page.keyboard.press('5') // 設定
  await settled(page)
  await page.keyboard.press('1') // 語言
  await settled(page)
  await page.keyboard.press('2') // English (the phone language, zh-TW, is first)
  await settled(page)
  await page.goBack() // settings → home
  await settled(page)
  await expect(page.locator('h1')).toHaveText('Nashik district prices')
  const stored = JSON.parse(
    (await page.evaluate(() => localStorage.getItem('agriprice.settings'))) ?? '{}',
  ) as { state: { language: string; country: string; areaId: string } }
  expect(stored.state).toMatchObject({ language: 'en', country: 'IN', areaId: 'nashik' })
  await expectCleanScreen(page, errors)
})
