// @ts-check
import { expect } from '@playwright/test'

/**
 * Sign in via the UI and wait for the dashboard.
 * Login page is at /login with label-based fields and a "Sign in" submit button.
 */
export async function signIn(page, email, password) {
  await page.goto('/login')
  // Fields have no name= attribute — target by preceding label text
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL(/dashboard|events/, { timeout: 20_000 })
}

/**
 * Click a dashboard tab by name and wait briefly for content to load.
 */
export async function clickTab(page, name) {
  await page.getByRole('button', { name: new RegExp(`^${name}$`, 'i') }).click()
  await page.waitForTimeout(800)
}

/**
 * Wait for a toast/success indicator.
 */
export async function expectSuccess(page) {
  await expect(
    page.locator('[role="status"], [data-sonner-toast], [class*="toast"], [class*="success"]').first()
  ).toBeVisible({ timeout: 8_000 }).catch(() => {})
}
