// @ts-check
/**
 * Vendor decline / "not available" flow:
 *   Organiser shortlists a vendor → vendor declines via UI →
 *   interest status becomes 'unavailable' → organiser sees "Not available" badge.
 *
 * This is the opposite path to 05-inquiry (vendor accepts).
 */
import { test, expect } from '@playwright/test'
import { signIn } from '../helpers.js'

const API_URL = process.env.API_URL
const ORGANISER_EMAIL = process.env.ORGANISER_EMAIL
const ORGANISER_PASSWORD = process.env.ORGANISER_PASSWORD
const VENDOR_EMAIL = process.env.VENDOR_EMAIL
const VENDOR_PASSWORD = process.env.VENDOR_PASSWORD

let eventId = null
let vendorId = null
let interestId = null

test.beforeAll(async () => {
  // ── Sign in as organiser ──────────────────────────────────────────────────
  const orgToken = await fetch(`${API_URL}/auth/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ORGANISER_EMAIL, password: ORGANISER_PASSWORD }),
  }).then(r => r.json()).then(d => d.token)
  if (!orgToken) throw new Error('Organiser sign-in failed')

  // ── Get first owned event ─────────────────────────────────────────────────
  const events = await fetch(`${API_URL}/events`, {
    headers: { Authorization: `Bearer ${orgToken}` },
  }).then(r => r.json())
  const event = Array.isArray(events) ? events.find(e => e.myRole === 'owner') : null
  if (!event) throw new Error('No owned event found')
  eventId = event.id

  // ── Resolve vendor ID ────────────────────────────────────────────────────
  const vendorToken = await fetch(`${API_URL}/auth/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: VENDOR_EMAIL, password: VENDOR_PASSWORD }),
  }).then(r => r.json()).then(d => d.token)
  if (!vendorToken) throw new Error('Vendor sign-in failed')

  const profile = await fetch(`${API_URL}/vendor-portal/profile`, {
    headers: { Authorization: `Bearer ${vendorToken}` },
  }).then(r => r.json())
  vendorId = profile.id
  if (!vendorId) throw new Error('Could not resolve vendor ID')

  // ── Remove any existing interest so we get a fresh pending one ────────────
  const interests = await fetch(`${API_URL}/events/${eventId}/vendor-interests`, {
    headers: { Authorization: `Bearer ${orgToken}` },
  }).then(r => r.json()).catch(() => [])
  const existing = Array.isArray(interests) ? interests.find(i => i.vendors?.id === vendorId) : null
  if (existing) {
    await fetch(`${API_URL}/events/${eventId}/vendor-interests/${existing.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${orgToken}` },
    }).catch(() => null)
  }

  // ── Create a fresh pending interest ──────────────────────────────────────
  const created = await fetch(`${API_URL}/events/${eventId}/vendor-interests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${orgToken}` },
    body: JSON.stringify({ vendorId, preferenceRank: 3, offeredPrice: 450000 }),
  }).then(r => r.json())
  if (!created.id) throw new Error(`Failed to create interest: ${JSON.stringify(created)}`)
  interestId = created.id
})

test.afterAll(async () => {
  if (!eventId || !interestId) return
  const orgToken = await fetch(`${API_URL}/auth/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ORGANISER_EMAIL, password: ORGANISER_PASSWORD }),
  }).then(r => r.json()).then(d => d.token).catch(() => null)
  if (!orgToken) return
  await fetch(`${API_URL}/events/${eventId}/vendor-interests/${interestId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${orgToken}` },
  }).catch(() => null)
})

test.describe('Vendor decline journey', () => {
  test('vendor sees pending inquiry in their portal', async ({ page }) => {
    test.skip(!interestId, 'Setup failed — no interest created')
    await signIn(page, VENDOR_EMAIL, VENDOR_PASSWORD)
    await page.goto('/vendor/inquiries')
    // Should show at least one inquiry with a Respond button
    await expect(
      page.getByRole('button', { name: /respond/i }).first()
    ).toBeVisible({ timeout: 10_000 })
  })

  test('vendor declines inquiry via "Not available"', async ({ page }) => {
    test.skip(!interestId, 'Setup failed — no interest created')
    await signIn(page, VENDOR_EMAIL, VENDOR_PASSWORD)
    await page.goto('/vendor/inquiries')
    await page.waitForTimeout(1000)

    const respondBtn = page.getByRole('button', { name: /respond/i }).first()
    const hasRespond = await respondBtn.isVisible({ timeout: 8_000 }).catch(() => false)
    if (!hasRespond) {
      // Already responded in a previous run — verify unavailable status is shown
      await expect(
        page.getByText(/marked unavailable|not available|unavailable/i).first()
      ).toBeVisible({ timeout: 5_000 })
      return
    }

    await respondBtn.click()

    // Modal opens — click "Not available"
    await expect(page.getByText(/respond to inquiry/i)).toBeVisible({ timeout: 5_000 })
    await page.getByRole('button', { name: /not available/i }).click()

    // Submit response
    await page.getByRole('button', { name: /submit response/i }).click()

    // Modal closes — inquiry shows updated "Marked unavailable" status
    await expect(
      page.getByText(/marked unavailable|not available|unavailable/i).first()
    ).toBeVisible({ timeout: 10_000 })
  })

  test('organiser sees "Not available" badge on the declined vendor', async ({ page }) => {
    test.skip(!eventId || !interestId, 'Setup failed')

    // Ensure interest is in 'unavailable' state via API (guards against test 2 skipping)
    const orgToken = await fetch(`${API_URL}/auth/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ORGANISER_EMAIL, password: ORGANISER_PASSWORD }),
    }).then(r => r.json()).then(d => d.token).catch(() => null)
    const vendorToken = await fetch(`${API_URL}/auth/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: VENDOR_EMAIL, password: VENDOR_PASSWORD }),
    }).then(r => r.json()).then(d => d.token).catch(() => null)

    if (vendorToken) {
      await fetch(`${API_URL}/vendor-portal/inquiries/${interestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${vendorToken}` },
        body: JSON.stringify({ available: false }),
      }).catch(() => null)
    }

    await signIn(page, ORGANISER_EMAIL, ORGANISER_PASSWORD)
    await page.goto(`/events/${eventId}?tab=vendors`)
    await page.waitForTimeout(1500)

    // Organiser's vendor card shows "Not available" status badge
    await expect(
      page.getByText(/not available/i).first()
    ).toBeVisible({ timeout: 12_000 })
  })
})
