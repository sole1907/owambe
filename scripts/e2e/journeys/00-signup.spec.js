// @ts-check
/**
 * New user onboarding journey:
 *   Sign-up form → verify-email gate → email confirmed (dev API) →
 *   sign in → event creation wizard (8 steps) → land on event checklist.
 *
 * Uses POST /auth/dev-confirm-email (dev/staging only) to bypass the real
 * email delivery gate so the full flow is testable in CI / feedback loops.
 */
import { test, expect } from '@playwright/test'

const API_URL = process.env.API_URL
const ORGANISER_EMAIL = process.env.ORGANISER_EMAIL // e.g. sola.akanmu@gmail.com

// @owambe.test is rejected by Supabase's email validator (non-existent TLD).
// Use Gmail plus-addressing: routes to the organiser's real inbox but creates
// a distinct Supabase identity. dev-confirm-email bypasses actual email delivery.
const [localPart, domain] = (ORGANISER_EMAIL ?? 'test@gmail.com').split('@')
const TEST_EMAIL = `${localPart}+e2e.signup.${Date.now()}@${domain}`
const TEST_PASSWORD = 'E2eTest2025!'
const TEST_NAME = '[E2E] Signup Test User'

let userToken = null
let eventId = null

test.beforeAll(async () => {
  // Render free tier may be sleeping — ping once and wait for it to wake
  // before the first UI test submits a form and needs an immediate response.
  await fetch(`${API_URL}/health`).catch(() =>
    // /health may 404; that's fine — the point is to wake the server
    fetch(`${API_URL}/auth/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'warmup@example.com', password: 'warmup' }),
    }),
  )
})

test.afterAll(async () => {
  if (!userToken) return

  // Delete the test event first (if created)
  if (eventId) {
    await fetch(`${API_URL}/events/${eventId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${userToken}` },
    }).catch(() => null)
  }

  // Delete the test account
  await fetch(`${API_URL}/auth/dev-delete-account`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${userToken}` },
  }).catch(() => null)
})

test.describe('New user onboarding', () => {
  test('sign-up form submits and redirects to verify-email page', async ({ page }) => {
    await page.goto('/signup')

    await page.locator('input[type="text"]').fill(TEST_NAME)
    await page.locator('input[type="email"]').fill(TEST_EMAIL)
    await page.locator('input[type="password"]').fill(TEST_PASSWORD)
    await page.getByRole('button', { name: /create account/i }).click()

    // After submission the app redirects to the verify-email holding page
    // (allow extra time — the deployed API on Render may take a moment)
    await page.waitForURL(/verify-email/, { timeout: 30_000 })
    await expect(page.getByText(/check your email/i)).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText(/confirmation link|activate your account/i)).toBeVisible()
  })

  test('verify-email page has a "Sign in" link back to login', async ({ page }) => {
    await page.goto('/verify-email')
    await expect(page.getByRole('link', { name: /sign in/i })).toBeVisible({ timeout: 5_000 })
  })

  test('unverified user cannot sign in and sees the right error', async ({ page }) => {
    await page.goto('/login')
    await page.locator('input[type="email"]').fill(TEST_EMAIL)
    await page.locator('input[type="password"]').fill(TEST_PASSWORD)
    await page.getByRole('button', { name: /sign in|log in/i }).click()
    await expect(
      page.getByText(/verify your email|email not confirmed|check your inbox/i).first()
    ).toBeVisible({ timeout: 10_000 })
  })

  test('after email confirmation the user can sign in and reach the dashboard', async ({ page }) => {
    // Confirm via dev-only API endpoint (bypasses real email delivery)
    const confirmRes = await fetch(`${API_URL}/auth/dev-confirm-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_EMAIL }),
    })
    expect(confirmRes.ok).toBeTruthy()

    // Sign in via API to capture token for afterAll cleanup
    const signinData = await fetch(`${API_URL}/auth/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
    }).then(r => r.json())
    userToken = signinData.token

    // Sign in via UI
    await page.goto('/login')
    await page.locator('input[type="email"]').fill(TEST_EMAIL)
    await page.locator('input[type="password"]').fill(TEST_PASSWORD)
    await page.getByRole('button', { name: /sign in|log in/i }).click()

    await page.waitForURL(/dashboard/, { timeout: 20_000 })
    await expect(
      page.getByText(/my events|events|plan|no events/i).first()
    ).toBeVisible({ timeout: 8_000 })
  })

  test('new user can create a first event via the wizard', async ({ page }) => {
    test.skip(!userToken, 'Sign-in test failed — skipping wizard')

    // Sign in as the new user
    const signinData = await fetch(`${API_URL}/auth/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
    }).then(r => r.json())
    userToken = signinData.token

    await page.goto('/events/new')

    // Step 1: Event type
    await page.getByRole('button', { name: /wedding/i }).click()
    await page.getByRole('button', { name: /continue/i }).click()

    // Step 2: Event details
    await page.waitForSelector('input[placeholder*="Tunde"]', { timeout: 10_000 })
    await page.locator('input[placeholder*="Tunde"]').fill('[E2E] Signup Test Wedding')
    await page.locator('input[placeholder*="December"]').fill('December 2026').catch(() => {})
    await page.getByRole('button', { name: /continue/i }).click()

    // Step 3: Location
    await page.waitForSelector('input[placeholder*="Lagos"]', { timeout: 10_000 })
    await page.locator('input[placeholder*="Lagos"]').fill('Lagos')
    await page.getByRole('button', { name: /continue/i }).click()

    // Step 4: Guest count
    await page.waitForTimeout(500)
    await page.getByRole('button', { name: /100.*(–|-).*200/i }).click()
    await page.getByRole('button', { name: /continue/i }).click()

    // Step 5: Budget
    await page.waitForTimeout(500)
    await page.getByRole('button', { name: /1M.*(–|-).*3M/i }).click()
    await page.getByRole('button', { name: /continue/i }).click()

    // Step 6: Style (optional)
    await page.waitForTimeout(500)
    await page.getByRole('button', { name: /continue/i }).click()

    // Step 7: Existing vendors
    await page.waitForTimeout(500)
    await page.getByRole('button', { name: 'Starting from scratch' }).click()
    await page.getByRole('button', { name: /continue/i }).click()

    // Step 8: Coordinator → generate plan
    await page.waitForTimeout(500)
    await page.getByRole('button', { name: /No.*manage it myself/i }).click()
    await page.waitForTimeout(300)
    await page.getByRole('button', { name: /generate my plan/i }).click()

    // Redirects to the new event page
    await page.waitForURL(/events\/[a-f0-9-]{36}/, { timeout: 30_000 })
    const url = page.url()
    const match = url.match(/events\/([a-f0-9-]{36})/)
    if (match) eventId = match[1]

    // Event page loads with the planning checklist
    await expect(page.getByText('Planning Checklist')).toBeVisible({ timeout: 15_000 })
  })

  test('new event appears in the dashboard event list', async ({ page }) => {
    test.skip(!userToken || !eventId, 'Wizard test failed — skipping dashboard check')

    // Sign in as new user and check dashboard
    await page.goto('/login')
    await page.locator('input[type="email"]').fill(TEST_EMAIL)
    await page.locator('input[type="password"]').fill(TEST_PASSWORD)
    await page.getByRole('button', { name: /sign in|log in/i }).click()
    await page.waitForURL(/dashboard/, { timeout: 15_000 })

    // The event they just created should appear as a card
    await expect(
      page.getByText(/\[E2E\] Signup Test Wedding/i).first()
    ).toBeVisible({ timeout: 10_000 })
  })
})
