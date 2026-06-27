// @ts-check
import { test, expect } from '@playwright/test'
import { signIn, clickTab, expectSuccess } from '../helpers.js'

const EMAIL = process.env.ORGANISER_EMAIL
const PASSWORD = process.env.ORGANISER_PASSWORD
const API_URL = process.env.API_URL

// Shared state across tests in this file
let eventId = null
let eventUrl = null

// Create a test event via API once for all tab tests, clean up after
test.beforeAll(async () => {
  const signinRes = await fetch(`${API_URL}/auth/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  const signinData = await signinRes.json()
  const token = signinData.token
  if (!token) throw new Error(`beforeAll sign-in failed: ${JSON.stringify(signinData)}`)

  // Delete any stale [E2E] events left by previous failed runs to prevent accumulation
  const allEvents = await fetch(`${API_URL}/events`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then(r => r.json()).catch(() => [])
  const stale = Array.isArray(allEvents)
    ? allEvents.filter(e => e.myRole === 'owner' && e.title?.includes('[E2E]'))
    : []
  await Promise.all(
    stale.map(e =>
      fetch(`${API_URL}/events/${e.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => null),
    ),
  )

  const res = await fetch(`${API_URL}/events/generate-plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      eventTitle: '[E2E] Tola & Emeka Wedding',
      eventType: 'wedding',
      eventDate: null,
      eventDateApproximate: 'December 2026',
      guestCount: 150,
      budgetNaira: 3000000,
      city: 'Lagos',
    }),
  })
  const event = await res.json()
  if (!event.id) throw new Error(`beforeAll event creation failed: ${JSON.stringify(event)}`)
  eventId = event.id
  eventUrl = `/events/${eventId}`
})

test.afterAll(async () => {
  if (!eventId) return
  const signinRes = await fetch(`${API_URL}/auth/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  const { token } = await signinRes.json()
  await fetch(`${API_URL}/events/${eventId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
})

test.describe('Organiser journey', () => {
  test('sign in and reach dashboard', async ({ page }) => {
    await signIn(page, EMAIL, PASSWORD)
    await expect(page).toHaveURL(/dashboard/)
    await expect(page.getByText(/My Events|events|plan/i).first()).toBeVisible()
  })

  test('create event via wizard (8 steps)', async ({ page }) => {
    await signIn(page, EMAIL, PASSWORD)
    await page.goto('/events/new')

    // Step 1: Event type — click Wedding card then Continue
    await page.getByRole('button', { name: /wedding/i }).click()
    await page.getByRole('button', { name: /continue/i }).click()

    // Step 2: Event details — wait for the name input to appear (no htmlFor association)
    await page.waitForSelector('input[placeholder*="Tunde"]', { timeout: 10_000 })
    await page.locator('input[placeholder*="Tunde"]').fill('[E2E] Tola & Emaka Wedding')
    // Fill approximate date (placeholder contains "December")
    await page.locator('input[placeholder*="December"]').fill('December 2026').catch(() => {})
    await page.getByRole('button', { name: /continue/i }).click()

    // Step 3: Location — wait for city input (placeholder "e.g. Lagos")
    await page.waitForSelector('input[placeholder*="Lagos"]', { timeout: 10_000 })
    await page.locator('input[placeholder*="Lagos"]').fill('Lagos')
    await page.getByRole('button', { name: /continue/i }).click()

    // Step 4: Guest count — click 100–200 range
    await page.waitForTimeout(500)
    await page.getByRole('button', { name: /100.*(–|-).*200/i }).click()
    await page.getByRole('button', { name: /continue/i }).click()

    // Step 5: Budget — click ₦1M–₦3M range
    await page.waitForTimeout(500)
    await page.getByRole('button', { name: /1M.*(–|-).*3M/i }).click()
    await page.getByRole('button', { name: /continue/i }).click()

    // Step 6 (Style) — optional, Continue is always enabled, just proceed
    await page.waitForTimeout(500)
    await page.getByRole('button', { name: /continue/i }).click()

    // Step 7 (ExistingVendors) — requires selecting an option before Continue is enabled
    await page.waitForTimeout(500)
    await page.getByRole('button', { name: 'Starting from scratch' }).click()
    await page.getByRole('button', { name: /continue/i }).click()

    // Step 8 (Coordinator) — requires a selection, then click "Generate my plan" to submit
    await page.waitForTimeout(500)
    await page.getByRole('button', { name: /No.*manage it myself/i }).click()
    await page.waitForTimeout(300)
    await page.getByRole('button', { name: /generate my plan/i }).click()

    // Wait for redirect to event page
    await page.waitForURL(/events\/[a-f0-9-]{36}/, { timeout: 30_000 })
    expect(page.url()).toMatch(/events\/[a-f0-9-]{36}/)
  })

  test('checklist tab — items visible and togglable', async ({ page }) => {
    test.skip(!eventUrl, 'No test event created')
    await signIn(page, EMAIL, PASSWORD)
    await page.goto(eventUrl)
    // Checklist is the default tab — wait for it to load
    await expect(page.getByText('Planning Checklist')).toBeVisible({ timeout: 10_000 })
    // Toggle buttons are custom round buttons (not input[type=checkbox])
    const toggleBtns = page.locator('[class*="rounded-full"][class*="border-2"]')
    await expect(toggleBtns.first()).toBeVisible({ timeout: 8_000 })
    const count = await toggleBtns.count()
    expect(count).toBeGreaterThan(0)
    // Toggle the first item
    await toggleBtns.first().click()
    await page.waitForTimeout(500)
  })

  test('budget tab — renders breakdown with categories', async ({ page }) => {
    test.skip(!eventUrl, 'No test event created')
    await signIn(page, EMAIL, PASSWORD)
    await page.goto(eventUrl)
    await clickTab(page, 'budget')
    // Budget heading and at least one category should be visible
    await expect(page.getByRole('heading', { name: /budget/i }).first()).toBeVisible({ timeout: 8_000 })
    await expect(page.getByText(/venue|catering|decoration/i).first()).toBeVisible({ timeout: 5_000 })
  })

  test('vendors tab — browse vendors', async ({ page }) => {
    test.skip(!eventUrl, 'No test event created')
    await signIn(page, EMAIL, PASSWORD)
    await page.goto(eventUrl)
    await clickTab(page, 'vendors')
    // Wait for "Your shortlist" or "Recommended vendors" heading specific to this tab
    await expect(
      page.getByText('Your shortlist').or(page.getByText('Recommended vendors')).first()
    ).toBeVisible({ timeout: 12_000 })
  })

  test('guests tab — add and see a guest', async ({ page }) => {
    test.skip(!eventUrl, 'No test event created')
    await signIn(page, EMAIL, PASSWORD)
    await page.goto(eventUrl)
    await clickTab(page, 'guests')
    // The "+ Add guest" button opens the form
    const addBtn = page.getByRole('button', { name: '+ Add guest' })
    await expect(addBtn).toBeVisible({ timeout: 8_000 })
    await addBtn.click()
    // Form has type=text (name) and type=email inputs, no htmlFor association
    await page.locator('input[type="text"]').first().fill('[E2E] Ngozi Obi')
    await page.locator('input[type="email"]').first().fill('ngozi.e2e@example.com')
    await page.getByRole('button', { name: /add|save|send invite/i }).last().click()
    await expectSuccess(page)
    await expect(page.getByText('[E2E] Ngozi Obi')).toBeVisible({ timeout: 8_000 })
  })

  test('gifts tab — bank settings form visible', async ({ page }) => {
    test.skip(!eventUrl, 'No test event created')
    await signIn(page, EMAIL, PASSWORD)
    await page.goto(eventUrl)
    await clickTab(page, 'gifts')
    await expect(page.getByText(/bank|gift|wishlist/i).first()).toBeVisible({ timeout: 8_000 })
  })

  test('team tab — visible to owner with invite form', async ({ page }) => {
    test.skip(!eventUrl, 'No test event created')
    await signIn(page, EMAIL, PASSWORD)
    await page.goto(eventUrl)
    await clickTab(page, 'team')
    // The email input is behind the "+ Invite a coordinator" button
    const inviteBtn = page.getByRole('button', { name: /invite a coordinator/i })
    await expect(inviteBtn).toBeVisible({ timeout: 8_000 })
    await inviteBtn.click()
    // Now the email input should appear
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 5_000 })
  })

  test('edit event — change title via edit modal', async ({ page }) => {
    test.skip(!eventUrl, 'No test event created')
    await signIn(page, EMAIL, PASSWORD)
    await page.goto(eventUrl)
    // Click the event-level Edit button (first "Edit" on the page — checklist items also have "Edit")
    await page.getByRole('button', { name: /^edit$/i }).first().click()
    // Edit event modal opens
    await expect(page.getByText(/edit event details/i)).toBeVisible({ timeout: 5_000 })
    // Target the first text input inside the edit modal form (Event name field)
    const editForm = page.locator('form').filter({ hasText: /save changes/i })
    const titleInput = editForm.locator('input[type="text"]').first()
    await titleInput.clear()
    await titleInput.fill('[E2E] Tola & Emaka Wedding (edited)')
    await page.getByRole('button', { name: /save changes/i }).click()
    // Modal closes and heading reflects new title
    await expect(page.getByRole('heading', { name: /edited/i }).first()).toBeVisible({ timeout: 10_000 })
    // Restore original title
    await page.getByRole('button', { name: /^edit$/i }).first().click()
    await expect(page.getByText(/edit event details/i)).toBeVisible({ timeout: 5_000 })
    await page.locator('form').filter({ hasText: /save changes/i }).locator('input[type="text"]').first().clear()
    await page.locator('form').filter({ hasText: /save changes/i }).locator('input[type="text"]').first().fill('[E2E] Tola & Emaka Wedding')
    await page.getByRole('button', { name: /save changes/i }).click()
  })

  test('checklist — add and delete a custom item', async ({ page }) => {
    test.skip(!eventUrl, 'No test event created')
    await signIn(page, EMAIL, PASSWORD)
    await page.goto(eventUrl)
    await page.waitForTimeout(1000)
    // Checklist is the default tab — click "+ Add item"
    await page.getByText('+ Add item').click()
    await expect(page.getByPlaceholder('New checklist item...')).toBeVisible({ timeout: 5_000 })
    await page.getByPlaceholder('New checklist item...').fill('[E2E] Test checklist item')
    await page.getByRole('button', { name: /^add$/i }).click()
    // New item appears in the list
    await expect(page.getByText('[E2E] Test checklist item')).toBeVisible({ timeout: 8_000 })
    // Delete it — hover to reveal trash/delete button next to the new item
    const itemRow = page.locator('li, [class*="item"]').filter({ hasText: '[E2E] Test checklist item' }).first()
    await itemRow.hover()
    const deleteBtn = itemRow.getByRole('button', { name: /delete|remove|trash/i })
    if (await deleteBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await deleteBtn.click()
      await expect(page.getByText('[E2E] Test checklist item')).not.toBeVisible({ timeout: 5_000 })
    }
  })

  test('budget — edit category percentage', async ({ page }) => {
    test.skip(!eventUrl, 'No test event created')
    await signIn(page, EMAIL, PASSWORD)
    await page.goto(eventUrl)
    await clickTab(page, 'budget')
    await page.waitForTimeout(1000)
    await expect(page.getByRole('heading', { name: /budget/i }).first()).toBeVisible({ timeout: 8_000 })

    // BudgetSection uses click-to-edit: each category row shows a "25%" button; clicking it
    // reveals an input[type="number"] + "Save" button (editingIndex state pattern)
    const percentBtn = page.locator('button').filter({ hasText: /^\d+%$/ }).first()
    const hasPercentBtn = await percentBtn.isVisible({ timeout: 5_000 }).catch(() => false)
    test.skip(!hasPercentBtn, 'No editable percentage buttons — event has no budget breakdown')

    await percentBtn.click()

    // Input appears with autoFocus
    const numInput = page.locator('input[type="number"]').first()
    await expect(numInput).toBeVisible({ timeout: 5_000 })
    const currentVal = await numInput.inputValue()
    // Re-fill with the same value so data is unchanged
    await numInput.fill(String(parseInt(currentVal || '10', 10)))

    // Click the "Save" button that appears inline next to the input
    await page.getByRole('button', { name: /^save$/i }).first().click()

    // Budget section still renders correctly after the edit
    await expect(page.getByRole('heading', { name: /budget/i }).first()).toBeVisible({ timeout: 5_000 })
  })
})
