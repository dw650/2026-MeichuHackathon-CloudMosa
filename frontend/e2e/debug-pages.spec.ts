import { expectCleanScreen, test } from './checks'

// Debug pages are dev/demo tools (decisions: T06); /debug/viewport shows 10px samples on purpose.
test('debug keys page is clean', async ({ page, errors }) => {
  await page.goto('/debug/keys')
  await page.getByRole('heading').waitFor()
  await expectCleanScreen(page, errors)
})
