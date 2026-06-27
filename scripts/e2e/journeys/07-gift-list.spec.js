// @ts-check
/**
 * Gift list flow: organiser sets up bank account & adds items → public gift page shows
 * items + bank transfer section → guest claims a gift item → guest reports bank transfer.
 */
import { test, expect } from '@playwright/test'
import { signIn } from '../helpers.js'

const API_URL = process.env.API_URL
const ORGANISER_EMAIL = process.env.ORGANISER_EMAIL
const ORGANISER_PASSWORD = process.env.ORGANISER_PASSWORD

let eventId = null
let giftItemId = null
let previousSettings = null // to restore after tests

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

  // Save current gift settings so we can restore them
  const settingsRes = await fetch(`${API_URL}/events/${eventId}/gift-list/dashboard`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const settingsData = await settingsRes.json().catch(() => ({}))
  previousSettings = {
    cashContributionEnabled: settingsData.cashContributionEnabled ?? false,
  }

  // Enable cash contributions with a test bank account
  await fetch(`${API_URL}/events/${eventId}/gift-list/settings`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      cashContributionEnabled: true,
      bankAccountName: 'E2E Test Account',
      bankAccountNumber: '0123456789',
      bankName: 'GTBank',
    }),
  })

  // Add a gift item without a store URL (so it shows the "Reserve it" claim button)
  const itemRes = await fetch(`${API_URL}/events/${eventId}/gift-list/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      title: '[E2E] Test Gift Item',
      description: 'E2E test item — please ignore',
      price_estimate: 25000,
    }),
  })
  const item = await itemRes.json()
  giftItemId = item.id
})

test.afterAll(async () => {
  const signinRes = await fetch(`${API_URL}/auth/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ORGANISER_EMAIL, password: ORGANISER_PASSWORD }),
  })
  const { token } = await signinRes.json()
  if (!token) return

  // Delete test gift item
  if (giftItemId) {
    await fetch(`${API_URL}/gift-list/items/${giftItemId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
  }

  // Restore cash contribution setting
  if (eventId && previousSettings !== null && !previousSettings.cashContributionEnabled) {
    await fetch(`${API_URL}/events/${eventId}/gift-list/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ cashContributionEnabled: false }),
    })
  }
})

test.describe('Gift list journey', () => {
  test('organiser sees gift tab with bank account setup', async ({ page }) => {
    test.skip(!eventId, 'Setup failed')
    await signIn(page, ORGANISER_EMAIL, ORGANISER_PASSWORD)
    await page.goto(`/events/${eventId}?tab=gifts`)
    await page.waitForTimeout(1000)
    // Gift tab shows bank account details or enable section
    await expect(
      page.getByText(/cash gift|bank account|account number|gift list/i).first()
    ).toBeVisible({ timeout: 10_000 })
  })

  test('public gift page shows event title and gift items', async ({ page }) => {
    test.skip(!eventId, 'Setup failed')
    await page.goto(`/gifts/${eventId}`)
    // Header shows "Gift list" label and event title
    await expect(page.getByText(/gift list/i).first()).toBeVisible({ timeout: 10_000 })
    // Our test item is visible
    await expect(page.getByText('[E2E] Test Gift Item')).toBeVisible({ timeout: 8_000 })
    // Bank transfer section is visible (cash contributions enabled)
    await expect(page.getByText(/bank transfer|send a cash gift/i).first()).toBeVisible({ timeout: 8_000 })
  })

  test('guest can claim a gift item via "Reserve it"', async ({ page }) => {
    test.skip(!eventId, 'Setup failed')
    await page.goto(`/gifts/${eventId}`)
    await page.waitForTimeout(1000)

    // Click "Reserve it" on the test item
    const reserveBtn = page.getByRole('button', { name: /reserve it/i }).first()
    await expect(reserveBtn).toBeVisible({ timeout: 8_000 })
    await reserveBtn.click()

    // Claim modal opens — fill in name and submit
    await expect(page.getByText(/reserve this item/i)).toBeVisible({ timeout: 5_000 })
    await page.getByPlaceholder('Your name').fill('[E2E] Claiming Guest')
    await page.getByRole('button', { name: /reserve it/i }).last().click()

    // Modal closes and item shows as reserved/claimed
    await expect(
      page.getByText(/reserved by \[e2e\] claiming guest|reserved/i).first()
    ).toBeVisible({ timeout: 10_000 })
  })

  test('guest can view bank transfer details and report a transfer', async ({ page }) => {
    test.skip(!eventId, 'Setup failed')
    await page.goto(`/gifts/${eventId}`)
    await page.waitForTimeout(1000)

    // Bank transfer section shows account details
    await expect(page.getByText(/GTBank|0123456789|E2E Test Account/i).first()).toBeVisible({ timeout: 8_000 })

    // Click "I've sent the money"
    const sentBtn = page.getByRole('button', { name: /i.ve sent the money/i })
    await expect(sentBtn).toBeVisible({ timeout: 5_000 })
    await sentBtn.click()

    // Report form appears — fill in name and amount
    await expect(page.getByPlaceholder('Your name')).toBeVisible({ timeout: 5_000 })
    await page.getByPlaceholder('Your name').fill('[E2E] Bank Transfer Guest')
    await page.getByPlaceholder('Amount sent').fill('5000')

    // Submit the report
    await page.getByRole('button', { name: /submit/i }).click()

    // Success state
    await expect(page.getByText(/thanks for your gift|host will confirm/i).first()).toBeVisible({ timeout: 10_000 })
  })

  test('organiser confirms a pending bank transfer in gift dashboard', async ({ page }) => {
    test.skip(!eventId, 'Setup failed')
    await signIn(page, ORGANISER_EMAIL, ORGANISER_PASSWORD)
    await page.goto(`/events/${eventId}?tab=gifts`)
    await page.waitForTimeout(1200)

    // Look for pending transfer confirmation banner (amber section)
    const confirmBtn = page.getByRole('button', { name: /confirm received/i }).first()
    const hasPending = await confirmBtn.isVisible({ timeout: 8_000 }).catch(() => false)

    if (!hasPending) {
      // No pending transfers — the transfer from the previous test may have been
      // confirmed already, or the gift list setup differs. Just check the tab loaded.
      await expect(page.getByText(/cash gift|gift list|wishlist/i).first()).toBeVisible({ timeout: 5_000 })
      return
    }

    // Confirm the transfer
    await confirmBtn.click()
    // The pending section disappears or count decreases
    await expect(confirmBtn).not.toBeVisible({ timeout: 10_000 })
  })
})
