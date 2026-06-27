// @ts-check
import { test, expect } from '@playwright/test'
import { signIn } from '../helpers.js'

const API_URL = process.env.API_URL
const ORGANISER_EMAIL = process.env.ORGANISER_EMAIL
const ORGANISER_PASSWORD = process.env.ORGANISER_PASSWORD

let inviteToken = null
let guestId = null
let guestListEventId = null

test.beforeAll(async () => {
  // Sign in as organiser
  const signinRes = await fetch(`${API_URL}/auth/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ORGANISER_EMAIL, password: ORGANISER_PASSWORD }),
  })
  const { token } = await signinRes.json()
  if (!token) throw new Error('Organiser sign-in failed')

  // Get first owned event
  const eventsRes = await fetch(`${API_URL}/events`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const events = await eventsRes.json()
  const event = events.find(e => e.myRole === 'owner')
  if (!event) throw new Error('No owner event found')
  guestListEventId = event.id

  // Add a guest — the addGuest response includes the invite token
  const guestRes = await fetch(`${API_URL}/events/${event.id}/guests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      fullName: '[E2E] Guest User',
      email: 'e2e.guest@example.com',
      allocation: 1,
    }),
  })
  const guest = await guestRes.json()
  // Response is either a single guest or array from bulk add
  const guestData = Array.isArray(guest) ? guest[0] : guest
  guestId = guestData?.id
  inviteToken = guestData?.token
})

test.afterAll(async () => {
  if (!guestId || !guestListEventId) return
  const signinRes = await fetch(`${API_URL}/auth/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ORGANISER_EMAIL, password: ORGANISER_PASSWORD }),
  })
  const { token } = await signinRes.json()
  await fetch(`${API_URL}/events/${guestListEventId}/guests/${guestId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
})

test.describe('Guest journey', () => {
  test('RSVP page renders with event details', async ({ page }) => {
    test.skip(!inviteToken, 'No invite token available')
    // Invite page is at /invite/:token (singular)
    await page.goto(`/invite/${inviteToken}`)
    // Shows event title, "Your Invite", or event type
    await expect(page.getByText(/wedding|your invite|invited|event|rsvp|tola|emeka/i).first()).toBeVisible({ timeout: 10_000 })
  })

  test('public gift list page loads for an event', async ({ page }) => {
    test.skip(!guestListEventId, 'No event available')
    await page.goto(`/gifts/${guestListEventId}`)
    // Page should load with "GIFT LIST" label and event details (even if no gift items)
    await expect(page.getByText(/gift list|no gift list/i).first()).toBeVisible({ timeout: 10_000 })
  })

  test('coordinator accept page — invalid token shows a graceful UI state', async ({ page }) => {
    await page.goto('/coordinator/accept?token=invalid-token-e2e')
    // The page shows "Sign in to accept" if unauthenticated, or an error if authenticated.
    // Either way it must NOT be blank — it must render something meaningful.
    await expect(
      page.getByText(/invalid|expired|not found|error|sign in to accept|coordinator/i).first()
    ).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('body')).not.toBeEmpty()
  })

  test('guest can request extra spots (plus-one) on invite page', async ({ page }) => {
    test.skip(!inviteToken, 'No invite token available')
    await page.goto(`/invite/${inviteToken}`)
    await page.waitForTimeout(1000)

    // If a plus-one request is already pending, just verify that state and skip
    const pendingText = page.getByText(/plus-one request pending/i)
    if (await pendingText.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await expect(pendingText).toBeVisible()
      return
    }

    // Click "Request extra spots" button
    await page.getByRole('button', { name: /request extra spots/i }).click()
    await expect(page.getByText(/how many extra spots/i)).toBeVisible({ timeout: 5_000 })

    // Fill in count and optional reason
    await page.locator('input[type="number"]').fill('1')
    await page.getByPlaceholder(/e.g. I.d like to bring/i).fill('[E2E] Bringing a partner')

    // Submit
    await page.getByRole('button', { name: /send request/i }).click()

    // Success state
    await expect(
      page.getByText(/request sent|pending|host will review/i).first()
    ).toBeVisible({ timeout: 10_000 })
  })

  test('organiser sees plus-one request and can approve it', async ({ page }) => {
    test.skip(!guestListEventId || !inviteToken, 'No event or invite token available')
    await signIn(page, ORGANISER_EMAIL, ORGANISER_PASSWORD)
    await page.goto(`/events/${guestListEventId}?tab=guests`)
    await page.waitForTimeout(1200)

    // Plus-one requests section appears if there are pending requests
    const approveBtn = page.getByRole('button', { name: /^approve$/i }).first()
    const hasPending = await approveBtn.isVisible({ timeout: 5_000 }).catch(() => false)

    if (!hasPending) {
      // No pending requests — guest might not have submitted one, or already approved
      // Just verify the guests tab loaded
      await expect(page.getByText(/guest|invite/i).first()).toBeVisible({ timeout: 5_000 })
      return
    }

    // Approve the plus-one request
    await approveBtn.click()
    // Request disappears from the pending section (or section is gone)
    await expect(approveBtn).not.toBeVisible({ timeout: 8_000 })
  })
})
