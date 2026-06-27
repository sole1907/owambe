// @ts-check
import { defineConfig, devices } from '@playwright/test'
import { config } from 'dotenv'

config({ path: './scripts/e2e/.env.e2e' })

export default defineConfig({
  testDir: './scripts/e2e/journeys',
  timeout: 60_000,
  retries: 1,
  workers: 1, // run journeys sequentially — they share state (same user account)
  reporter: [
    ['list'],
    ['html', { outputFolder: 'scripts/e2e/reports', open: 'never' }],
  ],
  use: {
    baseURL: process.env.WEB_URL,
    headless: false, // visible browser so you can watch
    viewport: { width: 1280, height: 800 },
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
})
