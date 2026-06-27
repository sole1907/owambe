// @ts-check
/**
 * Vendor inquiry flow: organiser shortlists a vendor → vendor sees inquiry →
 * vendor accepts via UI → organiser sees accepted status.
 */
import { test, expect } from '@playwright/test'
import { signIn, clickTab } from '../helpers.js'

const API_URL = process.env.API_URL
const ORGANISER_EMAIL = process.env.ORGANISER_EMAIL
const ORGANISER_PASSWORD = process.env.ORGANISER_PASSWORD
const VENDOR_EMAIL = process.env.VENDOR_EMAIL
const VENDOR_PASSWORD = process.env.VENDOR_PASSWORD

let eventId = null
let vendorId = null
let vendorName = null
let interestId = null
let createdInterest = false // track whether we created so afterAll can clean up

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

  // Find the E2E vendor (VENDOR_EMAIL = landmark@owambe.test → Landmark Event Centre)
  // by signing in as them and getting their vendor profile
  const vendorSigninRes = await fetch(`${API_URL}/auth/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: VENDOR_EMAIL, password: VENDOR_PASSWORD }),
  })
  const { token: vendorToken } = await vendorSigninRes.json()
  if (!vendorToken) throw new Error('Vendor sign-in failed')

  const profileRes = await fetch(`${API_URL}/vendor-portal/profile`, {
    headers: { Authorization: `Bearer ${vendorToken}` },
  })
  const profile = await profileRes.json()
  vendorId = profile.id
  vendorName = profile.name

  if (!vendorId) throw new Error(`Could not resolve vendor ID for ${VENDOR_EMAIL}`)

  // Check if interest already exists for this vendor+event
  const interestsRes = await fetch(`${API_URL}/events/${eventId}/vendor-interests`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const interests = await interestsRes.json()
  const existing = Array.isArray(interests)
    ? interests.find(i => i.vendors?.id === vendorId)
    : null
  if (existing) {
    interestId = existing.id
    return
  }

  // Create vendor interest at preference rank 3 (C) with a placeholder offer
  const interestRes = await fetch(`${API_URL}/events/${eventId}/vendor-interests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ vendorId, preferenceRank: 3, offeredPrice: 500000 }),
  })
  const interest = await interestRes.json()
  if (!interest.id) throw new Error(`Failed to create vendor interest: ${JSON.stringify(interest)}`)
  interestId = interest.id
  createdInterest = true
})

test.afterAll(async () => {
  if (!createdInterest || !interestId || !eventId) return
  const signinRes = await fetch(`${API_URL}/auth/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ORGANISER_EMAIL, password: ORGANISER_PASSWORD }),
  })
  const { token } = await signinRes.json()
  await fetch(`${API_URL}/events/${eventId}/vendor-interests/${interestId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
})

test.describe('Vendor inquiry journey', () => {
  test('organiser sees vendor in shortlist', async ({ page }) => {
    test.skip(!eventId || !vendorName, 'Setup failed')
    await signIn(page, ORGANISER_EMAIL, ORGANISER_PASSWORD)
    await page.goto(`/events/${eventId}?tab=vendors`)
    await page.waitForTimeout(1000)
    // Vendors tab shows shortlist section with the vendor name
    await expect(page.getByText('Your shortlist')).toBeVisible({ timeout: 12_000 })
    await expect(page.getByText(vendorName, { exact: false }).first()).toBeVisible({ timeout: 8_000 })
  })

  test('vendor sees the inquiry in their portal', async ({ page }) => {
    test.skip(!eventId, 'Setup failed')
    await signIn(page, VENDOR_EMAIL, VENDOR_PASSWORD)
    await page.goto('/vendor/inquiries')
    // The inquiry list shows at least one pending inquiry
    await expect(
      page.getByText(/pending|respond|inquiry/i).first()
    ).toBeVisible({ timeout: 10_000 })
  })

  test('vendor accepts the inquiry via UI', async ({ page }) => {
    test.skip(!eventId || !interestId, 'Setup failed')
    await signIn(page, VENDOR_EMAIL, VENDOR_PASSWORD)
    await page.goto('/vendor/inquiries')
    await page.waitForTimeout(1000)

    // If already accepted there will be no Respond button — skip gracefully
    const respondBtn = page.getByRole('button', { name: /respond/i }).first()
    const alreadyAccepted = !(await respondBtn.isVisible({ timeout: 5_000 }).catch(() => false))
    if (alreadyAccepted) {
      // Verify accepted status shown instead
      await expect(page.getByText(/accepted|available|committed/i).first()).toBeVisible({ timeout: 5_000 })
      return
    }

    await respondBtn.click()
    // Modal opens — click "Yes, available"
    await page.getByRole('button', { name: /yes.*available|accept offer/i }).click()
    // Submit the response
    await page.getByRole('button', { name: /submit response/i }).click()
    // Modal closes — inquiry list shows updated status
    await expect(
      page.getByText(/accepted|available|committed/i).first()
    ).toBeVisible({ timeout: 10_000 })
  })

  test('organiser sees vendor as available after acceptance', async ({ page }) => {
    test.skip(!eventId || !vendorName, 'Setup failed')
    await signIn(page, ORGANISER_EMAIL, ORGANISER_PASSWORD)
    await page.goto(`/events/${eventId}?tab=vendors`)
    await page.waitForTimeout(1000)
    // Status badge should reflect that vendor accepted
    await expect(
      page.getByText(/accepted at offered price|committed|available/i).first()
    ).toBeVisible({ timeout: 12_000 })
  })
})
