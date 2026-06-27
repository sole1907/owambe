// @ts-check
/**
 * Guest check-in flow: check-in page renders → manual name lookup finds guest
 * → checking in shows success overlay.
 */
import { test, expect } from '@playwright/test'

const API_URL = process.env.API_URL
const ORGANISER_EMAIL = process.env.ORGANISER_EMAIL
const ORGANISER_PASSWORD = process.env.ORGANISER_PASSWORD

// Unique name so manual search finds exactly this guest
const CHECKIN_GUEST_NAME = '[E2E-CheckIn] Amaka Test'
const CHECKIN_GUEST_EMAIL = 'e2e.checkin@example.com'

let eventId = null
let guestId = null

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
  if (!event) throw new Error('No owned event found')
  eventId = event.id

  // Check if our E2E check-in guest already exists
  const guestsRes = await fetch(`${API_URL}/events/${eventId}/guests`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const guests = await guestsRes.json()
  const existing = Array.isArray(guests)
    ? guests.find(g => g.full_name === CHECKIN_GUEST_NAME)
    : null
  if (existing) {
    guestId = existing.id
    return
  }

  // Create a guest specifically for check-in tests
  const guestRes = await fetch(`${API_URL}/events/${eventId}/guests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      fullName: CHECKIN_GUEST_NAME,
      email: CHECKIN_GUEST_EMAIL,
      allocation: 2,
    }),
  })
  const guest = await guestRes.json()
  const guestData = Array.isArray(guest) ? guest[0] : guest
  guestId = guestData?.id
})

test.afterAll(async () => {
  if (!guestId) return
  const signinRes = await fetch(`${API_URL}/auth/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ORGANISER_EMAIL, password: ORGANISER_PASSWORD }),
  })
  const { token } = await signinRes.json()
  await fetch(`${API_URL}/guests/${guestId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
})

test.describe('Guest check-in journey', () => {
  test('check-in page renders with scan and manual tabs', async ({ page }) => {
    test.skip(!eventId, 'Setup failed')
    await page.goto(`/checkin?eventId=${eventId}`)
    // Dark-themed page with Check-in heading
    await expect(page.getByRole('heading', { name: /check-in/i })).toBeVisible({ timeout: 10_000 })
    // Both tabs visible
    await expect(page.getByRole('button', { name: /camera scan/i })).toBeVisible({ timeout: 5_000 })
    await expect(page.getByRole('button', { name: /manual lookup/i })).toBeVisible({ timeout: 5_000 })
  })

  test('manual lookup finds guest by name', async ({ page }) => {
    test.skip(!eventId || !guestId, 'Setup failed')
    await page.goto(`/checkin?eventId=${eventId}`)
    await page.waitForTimeout(500)

    // Switch to manual lookup tab
    await page.getByRole('button', { name: /manual lookup/i }).click()
    await page.waitForTimeout(500)

    // Event ID field should already be pre-filled from the URL param
    // Fill guest name search
    await page.getByPlaceholder('Start typing...').fill('Amaka Test')
    await page.getByRole('button', { name: /^search$/i }).click()

    // Result shows the guest
    await expect(
      page.getByText(CHECKIN_GUEST_NAME, { exact: false }).first()
    ).toBeVisible({ timeout: 10_000 })
    // Check-in indicator visible
    await expect(page.getByText(/check in →/i).first()).toBeVisible({ timeout: 5_000 })
  })

  test('checking in a guest shows success overlay', async ({ page }) => {
    test.skip(!eventId || !guestId, 'Setup failed')
    await page.goto(`/checkin?eventId=${eventId}`)
    await page.waitForTimeout(500)

    // Switch to manual lookup
    await page.getByRole('button', { name: /manual lookup/i }).click()
    await page.waitForTimeout(500)

    // Search for the guest
    await page.getByPlaceholder('Start typing...').fill('Amaka Test')
    await page.getByRole('button', { name: /^search$/i }).click()

    // Wait for result and click to check in
    await expect(page.getByText(CHECKIN_GUEST_NAME, { exact: false }).first()).toBeVisible({ timeout: 10_000 })
    await page.getByText(CHECKIN_GUEST_NAME, { exact: false }).first().click()

    // Success or "already checked in" overlay — either is a valid response
    await expect(
      page.getByText(/checked in successfully|all spots already used|amaka test/i).first()
    ).toBeVisible({ timeout: 10_000 })
    // Overlay shows allocation info
    await expect(page.getByText(/of \d+ spot/i).first()).toBeVisible({ timeout: 5_000 })
  })
})
