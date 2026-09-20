/**
 * Main flows by key only (docs/02 §7, T34/T39): the right soft key is `page.goBack()`, the left
 * soft key is `Escape`. Every step is also checked for layout, focus, fonts and errors.
 */
import type { Page } from '@playwright/test'

import { type Country, type Lang, seed, settled, waitForNews } from './app'
import { expect, expectCleanScreen, test } from './checks'

async function press(page: Page, key: string) {
  await page.keyboard.press(key)
  await settled(page)
}

function where(page: Page): string {
  const url = new URL(page.url())
  return url.pathname + url.search
}

async function step(page: Page, errors: string[], path: RegExp) {
  await expect.poll(() => where(page)).toMatch(path)
  await settled(page)
  await expectCleanScreen(page, errors)
}

const focusedId = (page: Page) =>
  page.evaluate(() => document.activeElement?.getAttribute('data-focus-id') ?? null)

test('first-run setup with the location guess, then home', async ({ page, errors }) => {
  await seed(page, { setupDone: false, locate: 'IN:nashik' })
  await page.goto('/')
  await step(page, errors, /^\/setup\/lang$/)
  await press(page, 'Enter') // the phone language (zh-TW) is first
  await step(page, errors, /^\/setup\/locate/)
  await press(page, 'Enter') // 是，就是這裡
  await step(page, errors, /^\/(\?.*)?$/)
  await page.goBack()
  // Setup screens are not left behind home: back leaves the app instead.
  expect(where(page)).not.toMatch(/^\/setup/)
})

test('first-run setup without a guess: country and area by hand', async ({ page, errors }) => {
  await seed(page, { setupDone: false, locate: 'none' })
  await page.goto('/')
  await step(page, errors, /^\/setup\/lang$/)
  await press(page, 'Enter')
  await step(page, errors, /^\/setup\/country/)
  await press(page, '2') // 台灣
  await step(page, errors, /^\/setup\/area/)
  await press(page, 'Enter')
  await step(page, errors, /^\/(\?.*)?$/)
})

test('first-run setup of Malaysia in English', async ({ page, errors }) => {
  await seed(page, { setupDone: false, locate: 'none' })
  await page.goto('/')
  await step(page, errors, /^\/setup\/lang$/)
  await press(page, '2') // English
  await step(page, errors, /^\/setup\/country/)
  await press(page, '3') // Malaysia
  await step(page, errors, /^\/setup\/area/)
  await expect(page.getByText('Kuala Lumpur').first()).toBeVisible()
  await press(page, 'Enter')
  await step(page, errors, /^\/(\?.*)?$/)
  await expect(page.getByText('RM/kg').first()).toBeVisible()
  // PriceCatcher has retail prices only, so Malaysia starts on retail.
  await expect(page.getByText('Retail', { exact: true }).first()).toBeVisible()
})

test.describe('on a Hindi phone', () => {
  test.use({ locale: 'hi-IN' })

  test('first-run setup of India in Hindi', async ({ page, errors }) => {
    await seed(page, { setupDone: false, locate: 'none' })
    await page.goto('/')
    await step(page, errors, /^\/setup\/lang$/)
    await expect(page.locator('html')).toHaveAttribute('lang', 'hi')
    await press(page, 'Enter') // हिन्दी, the phone language, is first
    await step(page, errors, /^\/setup\/country/)
    await press(page, '1') // India
    await step(page, errors, /^\/setup\/area/)
    await press(page, 'Enter')
    await step(page, errors, /^\/(\?.*)?$/)
    await expect(page.locator('h1')).toContainText('के भाव')
  })
})

test.describe('on a Malay phone', () => {
  test.use({ locale: 'ms-MY' })

  test('first-run setup of Malaysia in Malay with the location guess', async ({ page, errors }) => {
    await seed(page, { setupDone: false, locate: 'MY:kualalumpur' })
    await page.goto('/')
    await step(page, errors, /^\/setup\/lang$/)
    await expect(page.locator('html')).toHaveAttribute('lang', 'ms')
    await press(page, 'Enter') // Bahasa Melayu, the phone language, is first
    await step(page, errors, /^\/setup\/locate/)
    await press(page, 'Enter') // Ya, betul
    await step(page, errors, /^\/(\?.*)?$/)
    await expect(page.locator('h1')).toHaveText('Harga Kuala Lumpur')
  })
})

const combos: [Country, Lang, string][] = [
  ['IN', 'en', 'onion'],
  ['IN', 'zh-TW', 'onion'],
  ['TW', 'zh-TW', 'cabbage'],
  ['TW', 'en', 'cabbage'],
  ['MY', 'en', 'tomato'],
  ['MY', 'zh-TW', 'tomato'],
  ['IN', 'hi', 'onion'],
  ['MY', 'ms', 'tomato'],
  ['TW', 'hi', 'cabbage'],
]

for (const [country, lang, crop] of combos) {
  test(`main flow ${country} × ${lang}`, async ({ page, errors }) => {
    await seed(page, { country, lang })
    await page.goto('/')
    await step(page, errors, /^\/$/)

    // Home → crop detail (行情 tab)
    await press(page, 'Enter')
    await step(page, errors, new RegExp(`^/crop/${crop}/today`))

    // The three tabs by ◀ ▶
    await press(page, 'ArrowLeft')
    await step(page, errors, new RegExp(`^/crop/${crop}/trend`))
    await press(page, '#') // 7 ⇄ 30 days
    await step(page, errors, new RegExp(`^/crop/${crop}/trend`))
    await press(page, 'ArrowRight')
    await press(page, 'ArrowRight')
    await step(page, errors, new RegExp(`^/crop/${crop}/compare`))
    await press(page, 'ArrowLeft')
    await step(page, errors, new RegExp(`^/crop/${crop}/today`))

    // 行情 → markets of the area → one market, and back
    await press(page, 'Enter')
    await step(page, errors, new RegExp(`^/crop/${crop}/markets`))
    await press(page, 'Enter')
    await step(page, errors, new RegExp(`^/crop/${crop}/markets/[^/?]+`))
    await page.goBack()
    await step(page, errors, new RegExp(`^/crop/${crop}/markets`))
    await page.goBack()
    await step(page, errors, new RegExp(`^/crop/${crop}/today`))

    // Wholesale ⇄ retail changes the whole screen
    await press(page, '*')
    await step(page, errors, new RegExp(`^/crop/${crop}/today`))
    await press(page, '*')

    // Change the viewed area from the # panel (the 2nd recent area)
    await press(page, '#')
    await step(page, errors, /sheet=area/)
    await press(page, '2')
    await step(page, errors, new RegExp(`^/crop/${crop}/today\\?(.*&)?area=`))

    // Back to home, then the menu → settings, and back
    await page.goBack()
    await step(page, errors, /^\/$/)
    await press(page, 'Escape')
    await step(page, errors, /sheet=menu/)
    await press(page, '5') // 設定
    await step(page, errors, /^\/settings$/)
    await page.goBack()
    await step(page, errors, /^\/$/)
  })
}

test('nearby prices: ↓ reaches both cards and a digit opens that area', async ({
  page,
  errors,
}) => {
  // Around New Taipei: Taipei (11 km) pays more, Changhua (139 km, inside 150 km) less.
  await seed(page, { country: 'TW' })
  await page.goto('/crop/cabbage/today?area=newtaipei')
  await step(page, errors, /^\/crop\/cabbage\/today\?area=newtaipei$/)
  expect(await focusedId(page)).toBe('markets')

  // Each nearby card scrolls into view with the focus, fonts and layout intact.
  await press(page, 'ArrowDown')
  expect(await focusedId(page)).toBe('nearby-high')
  await expectCleanScreen(page, errors)
  await press(page, 'ArrowDown')
  expect(await focusedId(page)).toBe('nearby-low')
  await expectCleanScreen(page, errors)

  // 3 opens the lowest nearby area (Changhua) on its 行情 tab, like the compare tab does.
  await press(page, '3')
  await step(page, errors, /^\/crop\/cabbage\/today\?area=changhua$/)
  await page.goBack()
  await step(page, errors, /^\/crop\/cabbage\/today\?area=newtaipei$/)
  await expect.poll(() => focusedId(page)).toBe('nearby-low')
})

test('international prices by key only: grid tile → list → a series → back', async ({
  page,
  errors,
}) => {
  await seed(page, { country: 'TW', lang: 'zh-TW' })
  await page.goto('/')
  await step(page, errors, /^\/$/)
  await press(page, 'ArrowRight') // 全部作物
  await step(page, errors, /tab=all/)
  await press(page, '7') // 國際價, after Taiwan's six categories
  await step(page, errors, /^\/intl$/)
  await press(page, 'Enter') // the first series
  await step(page, errors, /^\/intl\/rice$/)
  await press(page, 'ArrowDown') // nothing to select: scrolls the page
  await step(page, errors, /^\/intl\/rice$/)
  await page.goBack()
  await step(page, errors, /^\/intl$/)
  await expect.poll(() => focusedId(page)).toBe('series:rice')
  await press(page, '5') // 原糖
  await step(page, errors, /^\/intl\/sugar$/)
  await page.goBack()
  await step(page, errors, /^\/intl$/)
  // Back to the grid: switching tabs replaced the home entry, so 關注 is not in the history.
  await page.goBack()
  await step(page, errors, /tab=all/)
})

test('news by key: home tab → an item → 1 (its crop) → back', async ({ page, errors }) => {
  await seed(page, { country: 'TW', lang: 'zh-TW' })
  await waitForNews(page, 'TW', 'taipei')
  await page.goto('/')
  await step(page, errors, /^\/$/)
  await press(page, 'ArrowRight') // 全部作物
  await step(page, errors, /tab=all/)
  await press(page, 'ArrowRight') // 新聞 (the grid's last column)
  await press(page, 'ArrowRight')
  await press(page, 'ArrowRight')
  await step(page, errors, /^\/news$/)
  // The newest item is about guava; the list is chronological, not my area first.
  await press(page, 'Enter')
  await step(page, errors, /^\/news\/\d+$/)
  const item = where(page)
  await press(page, 'ArrowDown') // scrolls the page; nothing to select
  await press(page, '1')
  await step(page, errors, /^\/crop\/guava\/today/)
  await page.goBack()
  await step(page, errors, new RegExp(`^${item}$`))
  await page.goBack()
  await step(page, errors, /^\/news$/)
  await press(page, '2') // the second item by its digit
  await step(page, errors, /^\/news\/\d+$/)
  expect(where(page)).not.toBe(item)
  await page.goBack()
  await step(page, errors, /^\/news$/)
  // ◀ goes back to 全部作物 in place, like the other tabs.
  await press(page, 'ArrowLeft')
  await step(page, errors, /tab=all/)
})
