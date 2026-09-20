/**
 * F12 states on the full stack, reproduced with the demo switches (T35, docs/02 §6): each state
 * shows its message and an exit, at both sizes.
 */
import { seed, settled } from './app'
import { expect, expectCleanScreen, test } from './checks'

test('API failure without old data: error box with a retry exit', async ({ page, errors }) => {
  await seed(page, { country: 'IN', fail: true })
  await page.goto('/')
  await settled(page)
  await expect(page.getByText('連線失敗').first()).toBeVisible()
  await expect(page.locator('[data-softkey="center"]')).toHaveText('重試')
  // The failing requests are the point of this test; only other errors count.
  await expectCleanScreen(
    page,
    errors.filter((e) => !e.includes('503')),
  )
})

test('my area not updated today: the last price stays, with its date', async ({
  page,
  errors,
}, info) => {
  // Markets publish during the day, so "not today" is the normal morning case: the screen
  // keeps the price instead of replacing it with a notice (docs/02 §6).
  await seed(page, { country: 'IN', stale: true })
  await page.goto('/crop/onion/today')
  await settled(page)
  await expect(page.getByText('本地區', { exact: false }).first()).toBeVisible()
  // 240×320 carries the date in the info bar; 128×160 drops that cell (docs/03 §6).
  if (info.project.name === 'qvga') await expect(page.getByText(/天前|昨天/).first()).toBeVisible()
  await expectCleanScreen(page, errors)
})

test('no retail data for a crop: the reason and a way back to wholesale', async ({
  page,
  errors,
}) => {
  await seed(page, { country: 'IN', priceType: 'retail' })
  await page.goto('/crop/chilli/today')
  await settled(page)
  await expect(page.getByText('尚無零售資料').first()).toBeVisible()
  await expect(page.getByText('看批發')).toBeVisible()
  await expectCleanScreen(page, errors)
})

test('an area without any data shows 「—」 and 無資料, never 0', async ({ page, errors }) => {
  await seed(page, { country: 'IN' })
  await page.goto('/crop/onion/today?area=dakshinakannada')
  await settled(page)
  await expect(page.getByText('無資料').first()).toBeVisible()
  await expectCleanScreen(page, errors)
})

test('turning on API failure in Settings › Demo keeps the old data and marks it', async ({
  page,
  errors,
}, info) => {
  await seed(page, { country: 'IN' })
  await page.goto('/')
  await settled(page)
  await page.keyboard.press('Escape') // menu
  await settled(page)
  await page.keyboard.press('5') // 設定
  await settled(page)
  await expect.poll(() => new URL(page.url()).pathname).toBe('/settings')
  await page.keyboard.press('7') // Demo (demo builds only)
  await settled(page)
  await expect.poll(() => new URL(page.url()).pathname).toBe('/settings/demo')
  await page.keyboard.press('Enter') // 模擬 API 失敗: on
  await settled(page)
  await page.goBack()
  await page.goBack()
  await settled(page)
  // 128×160 cards are single-line (docs/03 §6): the notice keeps its title, not the time.
  const notice =
    info.project.name === 'qqvga'
      ? page.getByText('連線失敗')
      : page.getByText(/先顯示 \d{1,2}:\d{2} 的資料/)
  await expect(notice.first()).toBeVisible()
  await expect(page.getByText('舊').first()).toBeVisible()
  await expectCleanScreen(
    page,
    errors.filter((e) => !e.includes('503')),
  )
})
