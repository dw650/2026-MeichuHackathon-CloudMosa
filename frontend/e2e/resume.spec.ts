/**
 * F13 and F18 on the full stack (T36): reopening the app returns to the same screen and focus
 * with home underneath, and the demo switches travel as request headers.
 */
import { seed, settled } from './app'
import { expect, expectCleanScreen, test } from './checks'

const focusedId = (page: import('@playwright/test').Page) =>
  page.evaluate(() => document.activeElement?.getAttribute('data-focus-id') ?? null)

test('reopening the app returns to the last screen and focus; back goes home', async ({
  page,
  errors,
}) => {
  await seed(page, { country: 'IN' })
  await page.goto('/')
  await settled(page)
  await page.keyboard.press('Enter') // onion
  await settled(page)
  await page.keyboard.press('ArrowRight') // 比價
  await settled(page)
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowDown')
  await settled(page)
  const focused = await focusedId(page)
  const url = new URL(page.url())
  expect(url.pathname).toBe('/crop/onion/compare')
  expect(focused).toBeTruthy()

  // Cloud Phone reopens the widget at its home URL; the session is restored from storage.
  await page.goto('/')
  await settled(page)
  await expect.poll(() => new URL(page.url()).pathname).toBe('/crop/onion/compare')
  await expect.poll(() => focusedId(page)).toBe(focused)
  await expectCleanScreen(page, errors)

  await page.goBack()
  await settled(page)
  await expect.poll(() => new URL(page.url()).pathname).toBe('/')
})

test('the demo switches are sent as request headers', async ({ page }) => {
  await seed(page, { country: 'IN', stale: true, locate: 'TW:taipei' })
  const quote = page.waitForRequest((r) => r.url().includes('/api/v1/crops/onion/quote'))
  await page.goto('/crop/onion/today')
  const headers = (await quote).headers()
  expect(headers['x-demo-stale']).toBe('nashik:3')
  expect(headers['x-demo-locate']).toBe('TW:taipei')
  expect(headers['x-demo-fail']).toBeUndefined()
})
