// @ts-check
/**
 * Payment pages: organiser payment history + Paystack callback page.
 * We don't test real Paystack transactions — we test the page states
 * (empty history, no-reference callback).
 */
import { test, expect } from '@playwright/test'
import { signIn } from '../helpers.js'

const ORGANISER_EMAIL = process.env.ORGANISER_EMAIL
const ORGANISER_PASSWORD = process.env.ORGANISER_PASSWORD

test.describe('Payment pages', () => {
  test('organiser payment history page renders', async ({ page }) => {
    await signIn(page, ORGANISER_EMAIL, ORGANISER_PASSWORD)
    await page.goto('/dashboard/payments')
    // Page shows heading regardless of whether there are payments
    await expect(page.getByRole('heading', { name: /payment history/i })).toBeVisible({ timeout: 10_000 })
    // Shows either "No payments yet" empty state or a list of payments
    await expect(
      page.getByText(/no payments yet|total paid|commitment/i).first()
    ).toBeVisible({ timeout: 8_000 })
  })

  test('payment callback page — no reference shows graceful error', async ({ page }) => {
    // Navigate directly without a Paystack reference
    await page.goto('/payment/callback')
    await expect(
      page.getByText(/no payment reference|back to dashboard/i).first()
    ).toBeVisible({ timeout: 10_000 })
  })
})
