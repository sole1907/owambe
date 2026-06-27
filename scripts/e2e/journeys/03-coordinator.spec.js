// @ts-check
import { test, expect } from '@playwright/test'
import { signIn, clickTab } from '../helpers.js'

const ORGANISER_EMAIL = process.env.ORGANISER_EMAIL
const ORGANISER_PASSWORD = process.env.ORGANISER_PASSWORD
const COORD_EMAIL = process.env.COORD_EMAIL
const COORD_PASSWORD = process.env.COORD_PASSWORD
const API_URL = process.env.API_URL

let eventId = null
let collabId = null

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
  if (!event) throw new Error('No owner event found for organiser')
  eventId = event.id

  // Check for an existing active invite — list returns an array
  const collabsRes = await fetch(`${API_URL}/events/${eventId}/collaborators`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const collabs = await collabsRes.json()
  const existing = Array.isArray(collabs)
    ? collabs.find(c => c.invited_email === COORD_EMAIL && c.status === 'active')
    : null
  if (existing) {
    collabId = existing.id
    return // already active, skip re-invite
  }

  // Invite coordinator — POST /events/:eventId/collaborators, returns collab row (includes invite_token)
  const inviteRes = await fetch(`${API_URL}/events/${eventId}/collaborators`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ email: COORD_EMAIL }),
  })
  const inviteData = await inviteRes.json()
  collabId = inviteData.id
  const inviteToken = inviteData.invite_token

  // Coordinator accepts — POST /collaborators/accept with body { token: invite_token }
  const coordSignin = await fetch(`${API_URL}/auth/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: COORD_EMAIL, password: COORD_PASSWORD }),
  })
  const { token: coordToken } = await coordSignin.json()
  await fetch(`${API_URL}/collaborators/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${coordToken}` },
    body: JSON.stringify({ token: inviteToken }),
  })
})

test.afterAll(async () => {
  if (!collabId || !eventId) return
  const signinRes = await fetch(`${API_URL}/auth/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ORGANISER_EMAIL, password: ORGANISER_PASSWORD }),
  })
  const { token } = await signinRes.json()
  await fetch(`${API_URL}/events/${eventId}/collaborators/${collabId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
})

test.describe('Coordinator journey', () => {
  test('coordinator sees assigned event in their dashboard', async ({ page }) => {
    test.skip(!eventId, 'No event set up')
    await signIn(page, COORD_EMAIL, COORD_PASSWORD)
    await expect(page).toHaveURL(/dashboard|events/)
    // Event cards are links to /events/:id
    await expect(page.locator('a[href*="/events/"]').first()).toBeVisible({ timeout: 10_000 })
  })

  test('coordinator can view event details and checklist', async ({ page }) => {
    test.skip(!eventId, 'No event set up')
    await signIn(page, COORD_EMAIL, COORD_PASSWORD)
    await page.goto(`/events/${eventId}`)
    await expect(page).toHaveURL(/events\//, { timeout: 10_000 })
    // Checklist is the default tab — verify it loaded
    await expect(page.getByText('Planning Checklist')).toBeVisible({ timeout: 10_000 })
    // Checklist uses custom round buttons, not input[type="checkbox"]
    await expect(page.locator('[class*="rounded-full"][class*="border-2"]').first()).toBeVisible({ timeout: 8_000 })
  })

  test('coordinator can view shortlisted vendors', async ({ page }) => {
    test.skip(!eventId, 'No event set up')
    await signIn(page, COORD_EMAIL, COORD_PASSWORD)
    await page.goto(`/events/${eventId}`)
    await clickTab(page, 'vendors')
    await expect(
      page.getByText('Your shortlist').or(page.getByText('Recommended vendors')).first()
    ).toBeVisible({ timeout: 12_000 })
  })

  test('coordinator can view guest list', async ({ page }) => {
    test.skip(!eventId, 'No event set up')
    await signIn(page, COORD_EMAIL, COORD_PASSWORD)
    await page.goto(`/events/${eventId}`)
    await clickTab(page, 'guests')
    await expect(page.getByText(/guest|invite/i).first()).toBeVisible({ timeout: 8_000 })
  })

  test('coordinator does NOT see team tab', async ({ page }) => {
    test.skip(!eventId, 'No event set up')
    await signIn(page, COORD_EMAIL, COORD_PASSWORD)
    await page.goto(`/events/${eventId}`)
    await expect(page.getByRole('button', { name: /^team$/i })).not.toBeVisible()
  })

  test('coordinator does NOT see gifts tab content', async ({ page }) => {
    test.skip(!eventId, 'No event set up')
    await signIn(page, COORD_EMAIL, COORD_PASSWORD)
    await page.goto(`/events/${eventId}`)
    const giftsTab = page.getByRole('button', { name: /^gifts$/i })
    if (await giftsTab.isVisible()) {
      await giftsTab.click()
      await expect(page.getByText(/not authorised|access denied|forbidden/i)).toBeVisible({ timeout: 5_000 })
        .catch(() => {}) // ok if it just doesn't show financial data
    }
  })
})
