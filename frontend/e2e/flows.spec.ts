/**
 * Main flows by key only (docs/02 §7, T34/T39): the right soft key is `page.goBack()`, the left
 * soft key is `Escape`. Every step is also checked for layout, focus, fonts and errors.
 */
import type { Page } from '@playwright/test'

import { type Country, type Lang, seed, settled } from './app'
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

const combos: [Country, Lang, string][] = [
  ['IN', 'en', 'onion'],
  ['IN', 'zh-TW', 'onion'],
  ['TW', 'zh-TW', 'cabbage'],
  ['TW', 'en', 'cabbage'],
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
    await step(page, errors, new RegExp(`^/crop/${crop}/today\\?area=`))

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
