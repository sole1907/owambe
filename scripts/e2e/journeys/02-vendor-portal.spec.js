// @ts-check
import { test, expect } from '@playwright/test'
import { signIn, expectSuccess } from '../helpers.js'

const EMAIL = process.env.VENDOR_EMAIL
const PASSWORD = process.env.VENDOR_PASSWORD

test.describe('Vendor portal journey', () => {
  test('sign in and reach vendor dashboard', async ({ page }) => {
    await signIn(page, EMAIL, PASSWORD)
    await expect(page).toHaveURL(/vendor|dashboard/)
  })

  test('inquiries page — renders inquiry list', async ({ page }) => {
    await signIn(page, EMAIL, PASSWORD)
    await page.goto('/vendor/inquiries')
    await expect(page.getByText(/inquiry|inquiries|request/i).first()).toBeVisible({ timeout: 10_000 })
  })

  test('profile page — update bio', async ({ page }) => {
    await signIn(page, EMAIL, PASSWORD)
    await page.goto('/vendor/profile')
    // "About / Bio" label has no htmlFor — target the only textarea on the page
    await expect(page.locator('textarea').first()).toBeVisible({ timeout: 8_000 })
    await page.locator('textarea').first().fill('[E2E] Premier event venue in Lagos with world-class facilities.')
    await page.getByRole('button', { name: /save|update/i }).first().click()
    await expectSuccess(page)
  })

  test('availability page — renders calendar', async ({ page }) => {
    await signIn(page, EMAIL, PASSWORD)
    await page.goto('/vendor/availability')
    await expect(page.getByText(/available|calendar|block/i).first()).toBeVisible({ timeout: 8_000 })
  })

  test('payments page — renders payment structure form', async ({ page }) => {
    await signIn(page, EMAIL, PASSWORD)
    await page.goto('/vendor/payments')
    await expect(page.getByText(/commitment|payment|structure/i).first()).toBeVisible({ timeout: 8_000 })
  })

  test('bank account page — renders bank account form', async ({ page }) => {
    await signIn(page, EMAIL, PASSWORD)
    await page.goto('/vendor/bank')
    await expect(page.getByText(/bank account|account number|account name/i).first()).toBeVisible({ timeout: 8_000 })
  })

  test('earnings page — renders earnings schedule', async ({ page }) => {
    await signIn(page, EMAIL, PASSWORD)
    await page.goto('/vendor/earnings')
    // Shows earnings heading or empty state
    await expect(page.getByText(/earnings|payout|no.*earning|scheduled/i).first()).toBeVisible({ timeout: 8_000 })
  })
})
