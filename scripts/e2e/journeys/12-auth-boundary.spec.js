// @ts-check
/**
 * Auth boundary tests — verifies the UI enforces access control:
 *  1. Unauthenticated user trying to view an event → redirected to sign-in
 *  2. Vendor (wrong role) trying to view an organiser's event → no access / redirected
 *  3. Organiser trying to access vendor portal pages → redirected or error
 */
import { test, expect } from '@playwright/test'
import { signIn } from '../helpers.js'

const API_URL = process.env.API_URL
const ORGANISER_EMAIL = process.env.ORGANISER_EMAIL
const ORGANISER_PASSWORD = process.env.ORGANISER_PASSWORD
const VENDOR_EMAIL = process.env.VENDOR_EMAIL
const VENDOR_PASSWORD = process.env.VENDOR_PASSWORD

let organiserEventId = null

test.beforeAll(async () => {
  const orgToken = await fetch(`${API_URL}/auth/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ORGANISER_EMAIL, password: ORGANISER_PASSWORD }),
  }).then(r => r.json()).then(d => d.token)
  if (!orgToken) return

  const events = await fetch(`${API_URL}/events`, {
    headers: { Authorization: `Bearer ${orgToken}` },
  }).then(r => r.json()).catch(() => [])

  const event = Array.isArray(events) ? events.find(e => e.myRole === 'owner') : null
  organiserEventId = event?.id ?? null
})

test.describe('Auth boundary & access control', () => {
  test('unauthenticated user viewing an event is redirected to sign-in', async ({ page }) => {
    test.skip(!organiserEventId, 'No event found for organiser')
    // Do NOT sign in — navigate directly to the event page
    await page.goto(`/events/${organiserEventId}`)
    // Should redirect to sign-in (URL changes) or show a sign-in prompt
    await page.waitForURL(/sign.?in|login|auth/i, { timeout: 10_000 })
    await expect(
      page.getByText(/sign in|log in|email|password/i).first()
    ).toBeVisible({ timeout: 5_000 })
  })

  test('unauthenticated access to dashboard redirects to sign-in', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForURL(/sign.?in|login|auth/i, { timeout: 10_000 })
    await expect(
      page.getByText(/sign in|log in|email|password/i).first()
    ).toBeVisible({ timeout: 5_000 })
  })

  test('vendor signed in cannot access organiser event page', async ({ page }) => {
    test.skip(!organiserEventId, 'No event found for organiser')
    await signIn(page, VENDOR_EMAIL, VENDOR_PASSWORD)
    await page.goto(`/events/${organiserEventId}`)
    // Vendor should not see the organiser's event — expect a redirect away from the event
    // URL or an error/access-denied message
    const landed = await Promise.race([
      page.waitForURL(/vendor|dashboard/i, { timeout: 10_000 }).then(() => 'redirected'),
      page.getByText(/not found|access denied|not authorised|forbidden|no permission/i)
        .first()
        .waitFor({ timeout: 10_000 })
        .then(() => 'error'),
    ]).catch(() => 'timeout')

    expect(['redirected', 'error']).toContain(landed)
  })

  test('organiser signed in cannot access vendor portal', async ({ page }) => {
    await signIn(page, ORGANISER_EMAIL, ORGANISER_PASSWORD)
    await page.goto('/vendor/inquiries')
    // Organiser should be redirected away from the vendor portal or see an error
    const landed = await Promise.race([
      page.waitForURL(/dashboard|events|sign.?in|login/i, { timeout: 10_000 }).then(() => 'redirected'),
      page.getByText(/not found|access denied|not authorised|forbidden|no permission/i)
        .first()
        .waitFor({ timeout: 10_000 })
        .then(() => 'error'),
    ]).catch(() => 'timeout')

    expect(['redirected', 'error']).toContain(landed)
  })

  test('API rejects unauthenticated event fetch with 401', async () => {
    const res = await fetch(`${API_URL}/events`, {
      headers: {},
    })
    expect(res.status).toBe(401)
  })

  test('API rejects cross-user event access with 403 or 404', async () => {
    test.skip(!organiserEventId, 'No event found for organiser')
    // Sign in as vendor and try to fetch the organiser's event via API
    const vendorToken = await fetch(`${API_URL}/auth/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: VENDOR_EMAIL, password: VENDOR_PASSWORD }),
    }).then(r => r.json()).then(d => d.token)

    const res = await fetch(`${API_URL}/events/${organiserEventId}`, {
      headers: { Authorization: `Bearer ${vendorToken}` },
    })
    expect([403, 404]).toContain(res.status)
  })
})
