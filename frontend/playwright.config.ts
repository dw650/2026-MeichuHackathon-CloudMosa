/**
 * Playwright UI checks, run only at milestones (docs/07 §4) with `make e2e`, against the full
 * compose stack in demo mode. Output: one JSON summary; screenshots only for failures.
 */
import { defineConfig } from '@playwright/test'

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:8080'

export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e/artifacts',
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  retries: 0,
  timeout: 30_000,
  reporter: [['./e2e/summary-reporter.ts']],
  use: {
    baseURL,
    screenshot: 'only-on-failure',
    trace: 'off',
    video: 'off',
    deviceScaleFactor: 1,
    locale: 'zh-TW',
  },
  projects: [
    { name: 'qvga', use: { browserName: 'chromium', viewport: { width: 240, height: 320 } } },
    { name: 'qqvga', use: { browserName: 'chromium', viewport: { width: 128, height: 160 } } },
  ],
})
