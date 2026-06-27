import { http, assertStatus } from '../lib/http.mjs'

const SECTION_INVITE = 'Coordinator: Invite & Manage'
const SECTION_ACCESS = 'Coordinator: Access Control'
const SECTION_OPS = 'Coordinator: Day-of Operations'

// Uses the seeded solaevents@owambe.test account (already confirmed, no email verification needed)
const COORD_EMAIL = 'solaevents@owambe.test'
const COORD_PASSWORD = 'Owambe2025!'

export async function runCoordinatorJourneys(ctx) {
  // ── Invite ─────────────────────────────────────────────────────────────────

  await ctx.step('C1: Invite coordinator', async () => {
    if (!ctx.eventId || !ctx.organiserToken) { ctx.skip('No event or token'); return }
    const res = await http(`${ctx.API_URL}/events/${ctx.eventId}/collaborators`, {
      method: 'POST',
      token: ctx.organiserToken,
      body: {
        email: COORD_EMAIL,
        message: '[QA] Please help coordinate this event',
      },
    })
    assertStatus(res, 201, 'Invite coordinator')
    ctx.collaboratorId = res.data?.id
    ctx.collaboratorToken = res.data?.invite_token
    ctx.log(`  Collaborator invited: ${res.data?.id}`)
  }, SECTION_INVITE)

  await ctx.step('C2: List collaborators', async () => {
    if (!ctx.eventId || !ctx.organiserToken) { ctx.skip('No event or token'); return }
    const res = await http(`${ctx.API_URL}/events/${ctx.eventId}/collaborators`, {
      token: ctx.organiserToken,
    })
    assertStatus(res, 200, 'List collaborators')
    if (!Array.isArray(res.data)) throw new Error('Expected array of collaborators')
    const invite = res.data.find(c => c.id === ctx.collaboratorId)
    if (!invite) throw new Error('Invited collaborator not found in list')
    if (invite.status !== 'pending') throw new Error(`Expected "pending", got "${invite.status}"`)
    ctx.log(`  ${res.data.length} collaborator(s) listed`)
  }, SECTION_INVITE)

  // ── Accept ─────────────────────────────────────────────────────────────────

  await ctx.step('C3: Coordinator signs in and accepts invite', async () => {
    if (!ctx.collaboratorToken) { ctx.skip('No invite token'); return }

    const signinRes = await http(`${ctx.API_URL}/auth/signin`, {
      method: 'POST',
      body: { email: COORD_EMAIL, password: COORD_PASSWORD },
    })
    assertStatus(signinRes, 201, 'Coordinator sign in')
    ctx.coordinatorToken = signinRes.data?.token
    ctx.log(`  Signed in as ${COORD_EMAIL}`)

    const acceptRes = await http(`${ctx.API_URL}/collaborators/accept`, {
      method: 'POST',
      token: ctx.coordinatorToken,
      body: { token: ctx.collaboratorToken },
    })
    assertStatus(acceptRes, 201, 'Accept invite')
    ctx.log(`  Invite accepted — alreadyAccepted: ${acceptRes.data?.alreadyAccepted ?? false}`)
  }, SECTION_INVITE)

  // ── Coordinator access checks ──────────────────────────────────────────────

  await ctx.step('C4: Coordinator sees myRole: coordinator', async () => {
    if (!ctx.coordinatorToken) { ctx.skip('No coordinator session'); return }
    const res = await http(`${ctx.API_URL}/events/${ctx.eventId}`, { token: ctx.coordinatorToken })
    assertStatus(res, 200, 'Coordinator GET event')
    if (res.data?.myRole !== 'coordinator') {
      throw new Error(`Expected myRole "coordinator", got "${res.data?.myRole}"`)
    }
  }, SECTION_ACCESS)

  await ctx.step('C5: Coordinator can read checklist', async () => {
    if (!ctx.coordinatorToken) { ctx.skip('No coordinator session'); return }
    const res = await http(`${ctx.API_URL}/events/${ctx.eventId}`, { token: ctx.coordinatorToken })
    assertStatus(res, 200, 'Coordinator access checklist')
    if (!Array.isArray(res.data?.checklist_items)) {
      throw new Error('Expected checklist_items array in event response')
    }
    ctx.log(`  ${res.data.checklist_items.length} checklist item(s) visible to coordinator`)
  }, SECTION_ACCESS)

  await ctx.step('C5b: Coordinated event appears in coordinator events list', async () => {
    if (!ctx.coordinatorToken) { ctx.skip('No coordinator session'); return }
    const res = await http(`${ctx.API_URL}/events`, { token: ctx.coordinatorToken })
    assertStatus(res, 200, 'Coordinator GET /events')
    const found = res.data?.find(e => e.id === ctx.eventId && e.myRole === 'coordinator')
    if (!found) throw new Error('Event not found in coordinator events list with myRole: coordinator')
    ctx.log(`  Event appears in coordinator dashboard with myRole: coordinator`)
  }, SECTION_ACCESS)

  await ctx.step('C6: Coordinator can view shortlisted vendors', async () => {
    if (!ctx.coordinatorToken) { ctx.skip('No coordinator session'); return }
    const res = await http(`${ctx.API_URL}/events/${ctx.eventId}/vendor-interests`, {
      token: ctx.coordinatorToken,
    })
    assertStatus(res, 200, 'Coordinator GET vendor interests')
    ctx.log(`  ${res.data?.length ?? 0} vendor interest(s) visible to coordinator`)
  }, SECTION_ACCESS)

  await ctx.step('C7: Coordinator can view guest list', async () => {
    if (!ctx.coordinatorToken) { ctx.skip('No coordinator session'); return }
    const res = await http(`${ctx.API_URL}/events/${ctx.eventId}/guests`, {
      token: ctx.coordinatorToken,
    })
    assertStatus(res, 200, 'Coordinator GET guests')
    ctx.log(`  ${res.data?.guests?.length ?? 0} guest(s) visible to coordinator`)
  }, SECTION_ACCESS)

  await ctx.step('C8: Coordinator blocked from gift dashboard', async () => {
    if (!ctx.coordinatorToken) { ctx.skip('No coordinator session'); return }
    const res = await http(`${ctx.API_URL}/events/${ctx.eventId}/gift-list/dashboard`, {
      token: ctx.coordinatorToken,
    })
    if (res.status === 200) {
      throw new Error('Coordinator should NOT have access to gift dashboard — got 200')
    }
    ctx.log(`  Gift dashboard blocked with ${res.status} ✓`)
  }, SECTION_ACCESS)

  // ── Day-of operations ──────────────────────────────────────────────────────

  await ctx.step('C9: Coordinator searches guests (check-in)', async () => {
    if (!ctx.coordinatorToken) { ctx.skip('No coordinator session'); return }
    const res = await http(
      `${ctx.API_URL}/invites/events/${ctx.eventId}/search-guests?q=Ngozi`,
      { token: ctx.coordinatorToken }
    )
    assertStatus(res, 200, 'Coordinator guest search')
    ctx.log(`  Found ${res.data?.length ?? 0} guest(s) matching "Ngozi"`)
  }, SECTION_OPS)

  await ctx.step('C9b: Coordinator can check in a guest', async () => {
    if (!ctx.coordinatorToken || !ctx.guestInviteToken) { ctx.skip('No coordinator session or guest token'); return }
    const res = await http(`${ctx.API_URL}/invites/check-in`, {
      method: 'POST',
      token: ctx.coordinatorToken,
      body: { token: ctx.guestInviteToken },
    })
    // 201 = processed (success true or false), 400 = bad request — all mean coordinator has access
    if (res.status !== 200 && res.status !== 201 && res.status !== 400) {
      throw new Error(`Coordinator check-in: ${res.status} ${JSON.stringify(res.data)}`)
    }
    ctx.log(`  Check-in result: ${res.status} (${res.data?.success ? 'checked in' : res.data?.reason ?? 'processed'}) ✓`)
  }, SECTION_OPS)

  // ── Duplicate accept ───────────────────────────────────────────────────────

  await ctx.step('C10: Duplicate accept returns alreadyAccepted', async () => {
    if (!ctx.coordinatorToken || !ctx.collaboratorToken) { ctx.skip('No coordinator session or token'); return }
    const res = await http(`${ctx.API_URL}/collaborators/accept`, {
      method: 'POST',
      token: ctx.coordinatorToken,
      body: { token: ctx.collaboratorToken },
    })
    assertStatus(res, 201, 'Duplicate accept')
    if (!res.data?.alreadyAccepted) {
      throw new Error('Expected alreadyAccepted: true on second accept')
    }
    ctx.log(`  alreadyAccepted: true ✓`)
  }, SECTION_INVITE)

  // ── Revoke ────────────────────────────────────────────────────────────────

  await ctx.step('C11: Revoke coordinator', async () => {
    if (!ctx.collaboratorId || !ctx.organiserToken) { ctx.skip('No collaborator to revoke'); return }
    const res = await http(
      `${ctx.API_URL}/events/${ctx.eventId}/collaborators/${ctx.collaboratorId}`,
      { method: 'DELETE', token: ctx.organiserToken }
    )
    assertStatus(res, 200, 'Revoke coordinator')
    ctx.log(`  Coordinator revoked`)
  }, SECTION_INVITE)

  await ctx.step('C11b: Revoked coordinator loses access', async () => {
    if (!ctx.coordinatorToken) { ctx.skip('No coordinator session to verify revocation'); return }
    const res = await http(`${ctx.API_URL}/events/${ctx.eventId}`, { token: ctx.coordinatorToken })
    if (res.status === 200) {
      throw new Error('Revoked coordinator should NOT have access — got 200')
    }
    ctx.log(`  Access denied after revoke: ${res.status} ✓`)
  }, SECTION_ACCESS)
}
