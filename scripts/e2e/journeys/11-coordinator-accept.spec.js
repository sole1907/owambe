// @ts-check
/**
 * Coordinator invite accept via UI:
 *
 * The /coordinator/accept?token=... page auto-accepts the invitation
 * when the coordinator is already signed in (no button — purely useEffect-driven).
 *
 * Flow:
 *  1. Organiser invites coordinator (gets invite_token)
 *  2. Coordinator navigates to /coordinator/accept?token=...
 *  3. Page auto-POSTs to /collaborators/accept and shows "You're in!" or "Already accepted"
 *  4. Auto-redirects to the event page after 2 s
 */
import { test, expect } from '@playwright/test'
import { signIn } from '../helpers.js'

const API_URL = process.env.API_URL
const ORGANISER_EMAIL = process.env.ORGANISER_EMAIL
const ORGANISER_PASSWORD = process.env.ORGANISER_PASSWORD
const COORD_EMAIL = process.env.COORD_EMAIL
const COORD_PASSWORD = process.env.COORD_PASSWORD

let eventId = null
let collabId = null
let inviteToken = null

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
  const event = events.find(e => e.myRole === 'owner')
  if (!event) throw new Error('No owned event found')
  eventId = event.id

  // ── Revoke any existing coordinator invite for this email ─────────────────
  // (previous test runs may have left an active or pending collaboration)
  const collabs = await fetch(`${API_URL}/events/${eventId}/collaborators`, {
    headers: { Authorization: `Bearer ${orgToken}` },
  }).then(r => r.json()).catch(() => [])

  if (Array.isArray(collabs)) {
    for (const c of collabs.filter(c => c.invited_email === COORD_EMAIL)) {
      await fetch(`${API_URL}/events/${eventId}/collaborators/${c.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${orgToken}` },
      }).catch(() => null)
    }
  }

  // ── Create a fresh invite — do NOT accept via API ─────────────────────────
  const inviteRes = await fetch(`${API_URL}/events/${eventId}/collaborators`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${orgToken}` },
    body: JSON.stringify({ email: COORD_EMAIL }),
  }).then(r => r.json())

  if (!inviteRes.id) throw new Error(`Invite creation failed: ${JSON.stringify(inviteRes)}`)
  collabId = inviteRes.id
  inviteToken = inviteRes.invite_token
})

test.afterAll(async () => {
  if (!eventId || !collabId) return
  const orgToken = await fetch(`${API_URL}/auth/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ORGANISER_EMAIL, password: ORGANISER_PASSWORD }),
  }).then(r => r.json()).then(d => d.token).catch(() => null)
  if (!orgToken) return
  await fetch(`${API_URL}/events/${eventId}/collaborators/${collabId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${orgToken}` },
  }).catch(() => null)
})

test.describe('Coordinator invite accept via UI', () => {
  test('coordinator accept page auto-accepts when signed in and shows success', async ({ page }) => {
    test.skip(!inviteToken, 'No invite token — setup failed')

    await signIn(page, COORD_EMAIL, COORD_PASSWORD)
    await page.goto(`/coordinator/accept?token=${inviteToken}`)

    // Page auto-POSTs the acceptance — shows "You're in!" (first accept) or
    // "Already accepted" (if the token was already used)
    await expect(
      page.getByText(/you.re in!|already accepted/i).first()
    ).toBeVisible({ timeout: 15_000 })
  })

  test('accepted coordinator is redirected to the event page', async ({ page }) => {
    test.skip(!inviteToken || !eventId, 'No invite token or eventId — setup failed')

    await signIn(page, COORD_EMAIL, COORD_PASSWORD)
    await page.goto(`/coordinator/accept?token=${inviteToken}`)

    // After "You're in!" the page redirects to /events/:id after 2 s
    await page.waitForURL(/events\/[a-f0-9-]{36}/, { timeout: 15_000 })
    expect(page.url()).toMatch(/events\/[a-f0-9-]{36}/)

    // Event page loads — coordinator sees planning content
    await expect(
      page.getByText(/planning checklist|checklist|vendors|guests/i).first()
    ).toBeVisible({ timeout: 10_000 })
  })

  test('coordinator accept page shows error for an invalid token', async ({ page }) => {
    // This is a quick sanity-check independent of setup state
    await signIn(page, COORD_EMAIL, COORD_PASSWORD)
    await page.goto('/coordinator/accept?token=not-a-real-token-e2e')

    await expect(
      page.getByText(/invite not valid|invalid|expired|something went wrong/i).first()
    ).toBeVisible({ timeout: 10_000 })
  })
})
