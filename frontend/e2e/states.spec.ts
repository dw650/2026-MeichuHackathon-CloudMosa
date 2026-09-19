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

test('my area not updated today: the detail screen says so, with two exits', async ({
  page,
  errors,
}) => {
  await seed(page, { country: 'IN', stale: true })
  await page.goto('/crop/onion/today')
  await settled(page)
  await expect(page.getByText('今天還沒更新')).toBeVisible()
  await expect(page.getByText('看其他地區')).toBeVisible()
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
  await page.goto('/crop/onion/today?area=kurnool')
  await settled(page)
  await expect(page.getByText('無資料').first()).toBeVisible()
  await expectCleanScreen(page, errors)
})
