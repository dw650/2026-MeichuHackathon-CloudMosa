/**
 * The 新聞 list and detail × both sizes × both countries and languages (demo news, no
 * network): no overflow, visible focus, font floor (Chinese titles in an English interface
 * too), no console errors. Item ids come from the API, since they depend on the database.
 */
import type { Page } from '@playwright/test'

import { type AppState, seed, settled, waitForNews } from './app'
import { expect, expectCleanScreen, test } from './checks'

interface NewsList {
  items: { id: number; summary: string | null }[]
}

async function newsIds(page: Page, country: string, area: string): Promise<number[]> {
  const res = await page.request.get(`/api/v1/news?country=${country}&area=${area}`)
  expect(res.ok()).toBe(true)
  const body = (await res.json()) as NewsList
  // The first item (my area, with a summary) and one without a summary.
  const plain = body.items.find((item) => item.summary === null)
  return [body.items[0]?.id, plain?.id].filter((id): id is number => id !== undefined)
}

const cases: { name: string; state: AppState; area: string }[] = [
  { name: 'TW zh-TW', state: { country: 'TW', lang: 'zh-TW' }, area: 'taipei' },
  { name: 'TW en', state: { country: 'TW', lang: 'en' }, area: 'taipei' },
  { name: 'IN zh-TW', state: { country: 'IN', lang: 'zh-TW' }, area: 'nashik' },
  { name: 'IN en', state: { country: 'IN', lang: 'en' }, area: 'nashik' },
  { name: 'MY en', state: { country: 'MY', lang: 'en' }, area: 'kualalumpur' },
  { name: 'MY zh-TW', state: { country: 'MY', lang: 'zh-TW' }, area: 'kualalumpur' },
]

for (const c of cases) {
  test.describe(`news ${c.name}`, () => {
    test('/news', async ({ page, errors }) => {
      await seed(page, c.state)
      await waitForNews(page, c.state.country ?? 'IN', c.area)
      await page.goto('/news')
      await settled(page)
      await expect(page.locator('[data-focus-id^="news:"]').first()).toBeFocused()
      await expectCleanScreen(page, errors)
    })

    test('/news/:id', async ({ page, errors }) => {
      await seed(page, c.state)
      await waitForNews(page, c.state.country ?? 'IN', c.area)
      const ids = await newsIds(page, c.state.country ?? 'IN', c.area)
      expect(ids.length).toBeGreaterThan(1)
      for (const id of ids) {
        await page.goto(`/news/${id}`)
        await settled(page)
        await expect(page.locator('main h2')).toBeVisible()
        await expectCleanScreen(page, errors)
      }
    })
  })
}
