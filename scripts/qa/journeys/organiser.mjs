import { http, assertStatus, assertField } from '../lib/http.mjs'

// Full wedding journey: auth → event → checklist → budget → guests →
// vendor shortlist → negotiate → commit → gifts → thank-you

export async function runOrganiserJourneys(ctx) {
  // ── Auth ──────────────────────────────────────────────────────────────────

  await ctx.step('O1: Sign in as organiser', async () => {
    const res = await http(`${ctx.API_URL}/auth/signin`, {
      method: 'POST',
      body: { email: ctx.ORGANISER_EMAIL, password: ctx.ORGANISER_PASSWORD },
    })
    assertStatus(res, 201, 'Sign in')
    assertField(res.data, 'token', 'Sign in')
    ctx.organiserToken = res.data.token
  }, 'Organiser: Auth')

  await ctx.step('O1b: GET /auth/me', async () => {
    const res = await http(`${ctx.API_URL}/auth/me`, { token: ctx.organiserToken })
    assertStatus(res, 200, 'GET /auth/me')
    assertField(res.data, 'id', 'GET /auth/me')
    ctx.organiserId = res.data.id
  }, 'Organiser: Auth')

  // ── Cleanup previous QA runs ───────────────────────────────────────────────

  await ctx.step('O1c: Clean up old QA test events', async () => {
    const res = await http(`${ctx.API_URL}/events`, { token: ctx.organiserToken })
    assertStatus(res, 200, 'GET /events')
    const qaEvents = (res.data || []).filter(e => e.title?.startsWith('[QA]'))
    for (const e of qaEvents) {
      await http(`${ctx.API_URL}/events/${e.id}`, { method: 'DELETE', token: ctx.organiserToken })
      ctx.log(`  Deleted old QA event: ${e.title}`)
    }
  }, 'Organiser: Auth')

  // ── Event Creation ─────────────────────────────────────────────────────────

  await ctx.step('O2: Generate AI event plan (wedding)', async () => {
    const res = await http(`${ctx.API_URL}/events/generate-plan`, {
      method: 'POST',
      token: ctx.organiserToken,
      body: {
        eventTitle: '[QA] Ada & Emeka Wedding',
        eventType: 'wedding',
        eventDate: new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10),
        city: 'Lagos',
        guestCount: 300,
        budgetEstimate: 10000000,
        styleTheme: 'Elegant Afro-Luxe',
      },
    })
    assertStatus(res, 201, 'Generate plan')
    assertField(res.data, 'id', 'Event')
    ctx.eventId = res.data.id
    ctx.inviteToken = res.data.invite_token
    ctx.log(`  Event created: ${res.data.id}`)
  }, 'Organiser: Event')

  await ctx.step('O3: GET /events/:id', async () => {
    const res = await http(`${ctx.API_URL}/events/${ctx.eventId}`, { token: ctx.organiserToken })
    assertStatus(res, 200, 'GET event')
    assertField(res.data, 'myRole', 'GET event')
    if (res.data.myRole !== 'owner') throw new Error(`Expected myRole "owner", got "${res.data.myRole}"`)
  }, 'Organiser: Event')

  await ctx.step('O3b: PATCH /events/:id', async () => {
    const res = await http(`${ctx.API_URL}/events/${ctx.eventId}`, {
      method: 'PATCH',
      token: ctx.organiserToken,
      body: { city: 'Lagos', styleTheme: 'Black Tie Afro Luxe' },
    })
    assertStatus(res, 200, 'PATCH event')
  }, 'Organiser: Event')

  // ── Checklist ─────────────────────────────────────────────────────────────

  await ctx.step('O4: Add checklist item', async () => {
    const res = await http(`${ctx.API_URL}/events/${ctx.eventId}/checklist`, {
      method: 'POST',
      token: ctx.organiserToken,
      body: { title: '[QA] Book the venue', sortOrder: 99 },
    })
    assertStatus(res, 201, 'Add checklist item')
    assertField(res.data, 'id', 'Checklist item')
    ctx.checklistItemId = res.data.id
  }, 'Organiser: Checklist')

  await ctx.step('O4b: Complete checklist item', async () => {
    const res = await http(`${ctx.API_URL}/events/checklist/${ctx.checklistItemId}`, {
      method: 'PATCH',
      token: ctx.organiserToken,
      body: { isCompleted: true },
    })
    assertStatus(res, 200, 'Complete checklist item')
  }, 'Organiser: Checklist')

  await ctx.step('O4c: Delete checklist item', async () => {
    const res = await http(`${ctx.API_URL}/events/checklist/${ctx.checklistItemId}`, {
      method: 'DELETE',
      token: ctx.organiserToken,
    })
    assertStatus(res, 200, 'Delete checklist item')
  }, 'Organiser: Checklist')

  // ── Budget ─────────────────────────────────────────────────────────────────

  await ctx.step('O5: GET /events/:id/budget-summary', async () => {
    const res = await http(`${ctx.API_URL}/events/${ctx.eventId}/budget-summary`, {
      token: ctx.organiserToken,
    })
    assertStatus(res, 200, 'Budget summary')
  }, 'Organiser: Budget')

  await ctx.step('O5b: PATCH /events/:id/budget', async () => {
    const res = await http(`${ctx.API_URL}/events/${ctx.eventId}/budget`, {
      method: 'PATCH',
      token: ctx.organiserToken,
      body: {
        budgetBreakdown: [
          { category: 'Venue', percentage: 30, amount: 3000000 },
          { category: 'Catering', percentage: 25, amount: 2500000 },
          { category: 'Photography', percentage: 10, amount: 1000000 },
          { category: 'Decoration', percentage: 15, amount: 1500000 },
          { category: 'Other', percentage: 20, amount: 2000000 },
        ],
      },
    })
    assertStatus(res, 200, 'Update budget')
  }, 'Organiser: Budget')

  // ── Guests ────────────────────────────────────────────────────────────────

  await ctx.step('O6: Add guests', async () => {
    const guests = [
      { fullName: '[QA] Ngozi Obi', email: 'ngozi.obi.qa@example.com', plusOneAllowed: true },
      { fullName: '[QA] Tunde Adesanya', email: 'tunde.qa@example.com', plusOneAllowed: false },
      { fullName: '[QA] Amaka Eze', email: 'amaka.qa@example.com', plusOneAllowed: true },
    ]
    ctx.guestIds = []
    for (const g of guests) {
      const res = await http(`${ctx.API_URL}/events/${ctx.eventId}/guests`, {
        method: 'POST',
        token: ctx.organiserToken,
        body: g,
      })
      assertStatus(res, 201, `Add guest ${g.fullName}`)
      ctx.guestIds.push(res.data.id)
      if (res.data.token) ctx.guestInviteToken = res.data.token
    }
    ctx.log(`  Added ${guests.length} guests`)
  }, 'Organiser: Guests')

  await ctx.step('O6b: GET /events/:id/guests', async () => {
    const res = await http(`${ctx.API_URL}/events/${ctx.eventId}/guests`, {
      token: ctx.organiserToken,
    })
    assertStatus(res, 200, 'GET guests')
    if (!Array.isArray(res.data) || res.data.length < 3) {
      throw new Error(`Expected at least 3 guests, got ${res.data?.length}`)
    }
    // Grab an invite token from the list if we don't have one
    if (!ctx.guestInviteToken) {
      const withToken = res.data.find(g => g.token)
      if (withToken) ctx.guestInviteToken = withToken.token
    }
  }, 'Organiser: Guests')

  await ctx.step('O6c: GET /events/:id/guests/stats', async () => {
    const res = await http(`${ctx.API_URL}/events/${ctx.eventId}/guests/stats`, {
      token: ctx.organiserToken,
    })
    assertStatus(res, 200, 'Guest stats')
  }, 'Organiser: Guests')

  await ctx.step('O6d: PATCH guest', async () => {
    if (!ctx.guestIds?.[0]) { ctx.skip(); return }
    const res = await http(`${ctx.API_URL}/guests/${ctx.guestIds[0]}`, {
      method: 'PATCH',
      token: ctx.organiserToken,
      body: { fullName: '[QA] Ngozi Obi Updated' },
    })
    assertStatus(res, 200, 'PATCH guest')
  }, 'Organiser: Guests')

  // ── Guest RSVP & Check-in (public flows) ─────────────────────────────────

  await ctx.step('G1: GET /invites/:token (RSVP page)', async () => {
    if (!ctx.guestInviteToken) { ctx.skip('No invite token available'); return }
    const res = await http(`${ctx.API_URL}/invites/${ctx.guestInviteToken}`)
    assertStatus(res, 200, 'GET invite')
    assertField(res.data, 'event', 'Invite response')
  }, 'Guest: RSVP')

  await ctx.step('G2: POST /invites/:token/request-plus-one', async () => {
    if (!ctx.guestInviteToken) { ctx.skip('No invite token available'); return }
    const res = await http(`${ctx.API_URL}/invites/${ctx.guestInviteToken}/request-plus-one`, {
      method: 'POST',
      body: { requestedCount: 1 },
    })
    // 201 = created, 400 = not allowed for this guest — both valid depending on config
    if (res.status !== 201 && res.status !== 400) {
      throw new Error(`Unexpected status ${res.status}: ${JSON.stringify(res.data)}`)
    }
    if (res.status === 201) ctx.plusOneRequestId = res.data?.id
  }, 'Guest: RSVP')

  await ctx.step('G3: GET plus-one requests', async () => {
    const res = await http(`${ctx.API_URL}/events/${ctx.eventId}/plus-one-requests`, {
      token: ctx.organiserToken,
    })
    assertStatus(res, 200, 'GET plus-one requests')
  }, 'Organiser: Guests')

  await ctx.step('G3b: Approve plus-one request', async () => {
    if (!ctx.plusOneRequestId) { ctx.skip('No plus-one request to approve'); return }
    const res = await http(`${ctx.API_URL}/plus-one-requests/${ctx.plusOneRequestId}`, {
      method: 'PATCH',
      token: ctx.organiserToken,
      body: { status: 'approved' },
    })
    assertStatus(res, 200, 'Approve plus-one')
  }, 'Organiser: Guests')

  await ctx.step('G4: Search guests (check-in)', async () => {
    const res = await http(
      `${ctx.API_URL}/invites/events/${ctx.eventId}/search-guests?q=QA`,
      { token: ctx.organiserToken }
    )
    assertStatus(res, 200, 'Search guests')
  }, 'Guest: Check-in')

  await ctx.step('G5: Check in a guest', async () => {
    if (!ctx.guestInviteToken) { ctx.skip('No invite token for check-in'); return }
    const res = await http(`${ctx.API_URL}/invites/check-in`, {
      method: 'POST',
      token: ctx.organiserToken,
      body: { token: ctx.guestInviteToken },
    })
    if (res.status !== 200 && res.status !== 201) {
      throw new Error(`Check-in failed: ${res.status} ${JSON.stringify(res.data)}`)
    }
  }, 'Guest: Check-in')

  // ── Vendor Discovery ──────────────────────────────────────────────────────

  await ctx.step('O8: GET /vendors/categories', async () => {
    const res = await http(`${ctx.API_URL}/vendors/categories`, { token: ctx.organiserToken })
    assertStatus(res, 200, 'GET categories')
    if (!Array.isArray(res.data) || res.data.length === 0) {
      throw new Error('No vendor categories returned')
    }
    ctx.vendorCategories = res.data
    ctx.log(`  Found ${res.data.length} categories: ${res.data.map(c => c.slug).join(', ')}`)
  }, 'Organiser: Vendor Discovery')

  await ctx.step('O8b: GET /vendors (browse)', async () => {
    const res = await http(`${ctx.API_URL}/vendors`, { token: ctx.organiserToken })
    assertStatus(res, 200, 'GET vendors')
    if (!Array.isArray(res.data) || res.data.length === 0) {
      throw new Error('No vendors returned')
    }
    ctx.allVendors = res.data
    ctx.log(`  Found ${res.data.length} vendors`)
  }, 'Organiser: Vendor Discovery')

  await ctx.step('O8c: GET /events/:id/recommended-vendors', async () => {
    const res = await http(`${ctx.API_URL}/events/${ctx.eventId}/recommended-vendors`, {
      token: ctx.organiserToken,
    })
    assertStatus(res, 200, 'GET recommended vendors')
  }, 'Organiser: Vendor Discovery')

  await ctx.step('O8d: GET /vendors/:slug (detail)', async () => {
    const vendor = ctx.allVendors?.[0]
    if (!vendor?.slug) { ctx.skip('No vendor slug available'); return }
    const res = await http(`${ctx.API_URL}/vendors/${vendor.slug}`, { token: ctx.organiserToken })
    assertStatus(res, 200, 'GET vendor detail')
    assertField(res.data, 'name', 'Vendor detail')
  }, 'Organiser: Vendor Discovery')

  // ── Vendor Shortlisting (Full Wedding A/B/C) ──────────────────────────────

  await ctx.step('O9: Shortlist vendors for wedding (A/B/C per category)', async () => {
    ctx.shortlistedInterests = []

    // Find vendors by category and shortlist up to 3 per category
    const categoryGroups = {}
    for (const v of (ctx.allVendors || [])) {
      const cat = v.vendor_categories?.slug || v.category_slug || 'unknown'
      if (!categoryGroups[cat]) categoryGroups[cat] = []
      categoryGroups[cat].push(v)
    }

    // Shortlist up to 3 vendors per category (A=1, B=2, C=3)
    const weddingCategories = ['venues', 'caterers', 'photographers', 'decorators', 'djs', 'mcs', 'makeup-artists', 'videographers']
    let shortlistCount = 0

    for (const catSlug of weddingCategories) {
      const vendors = categoryGroups[catSlug] || []
      const toShortlist = vendors.slice(0, 3)
      for (let i = 0; i < toShortlist.length; i++) {
        const v = toShortlist[i]
        const res = await http(`${ctx.API_URL}/events/${ctx.eventId}/vendor-interests`, {
          method: 'POST',
          token: ctx.organiserToken,
          body: { vendorId: v.id, offeredPrice: 500000 + i * 100000, preferenceRank: i + 1 },
        })
        if (res.status === 201) {
          ctx.shortlistedInterests.push({ id: res.data.id, vendorId: v.id, category: catSlug, rank: i + 1 })
          shortlistCount++
        } else if (res.status === 409) {
          ctx.log(`  Already shortlisted ${v.name} in ${catSlug}`)
        } else {
          ctx.log(`  Skipped ${v.name} in ${catSlug}: ${res.status}`)
        }
      }
    }
    ctx.log(`  Shortlisted ${shortlistCount} vendors across ${weddingCategories.length} categories`)
    if (shortlistCount === 0) throw new Error('No vendors were shortlisted — check vendor data')
  }, 'Organiser: Shortlisting')

  await ctx.step('O9b: GET /events/:id/vendor-interests', async () => {
    const res = await http(`${ctx.API_URL}/events/${ctx.eventId}/vendor-interests`, {
      token: ctx.organiserToken,
    })
    assertStatus(res, 200, 'GET vendor interests')
    ctx.vendorInterests = res.data || []
    ctx.log(`  ${ctx.vendorInterests.length} interests loaded`)
  }, 'Organiser: Shortlisting')

  await ctx.step('O9c: Slot limit — 4th vendor in same category blocked', async () => {
    // Find a category we already have 3 slots filled for (use shortlistedInterests which has category stored)
    const catCounts = {}
    for (const si of (ctx.shortlistedInterests || [])) {
      catCounts[si.category] = (catCounts[si.category] || 0) + 1
    }
    const fullCat = Object.entries(catCounts).find(([, count]) => count >= 3)?.[0]
    if (!fullCat) { ctx.skip('No category with 3 slots filled to test limit'); return }

    // Find a 4th vendor in that category
    const fourth = (ctx.allVendors || []).find(v => {
      const cat = v.vendor_categories?.slug || v.category_slug
      return cat === fullCat && !ctx.shortlistedInterests.find(i => i.vendorId === v.id)
    })
    if (!fourth) { ctx.skip('No 4th vendor available to test slot limit'); return }

    const res = await http(`${ctx.API_URL}/events/${ctx.eventId}/vendor-interests`, {
      method: 'POST',
      token: ctx.organiserToken,
      body: { vendorId: fourth.id, offeredPrice: 400000, preferenceRank: 4 },
    })
    if (res.status !== 400 && res.status !== 409 && res.status !== 422) {
      throw new Error(`Expected 4xx for exceeding slot limit, got ${res.status}`)
    }
    ctx.log(`  Slot limit enforced: ${res.status}`)
  }, 'Organiser: Shortlisting')

  // ── Organiser counter-back (vendor side tested in vendor-portal.mjs) ──────

  await ctx.step('O11: Counter-back vendor offer', async () => {
    // Use first interest that might have been countered (or any pending one)
    const interest = ctx.vendorInterests?.[0]
    if (!interest) { ctx.skip('No vendor interests to counter'); return }
    const res = await http(
      `${ctx.API_URL}/events/${ctx.eventId}/vendor-interests/${interest.id}/counter-back`,
      {
        method: 'POST',
        token: ctx.organiserToken,
        body: { offeredPrice: 600000, isFinalOffer: false },
      }
    )
    // 200 = success, 400 = no counter to respond to yet (vendor hasn't countered)
    if (res.status !== 200 && res.status !== 400) {
      throw new Error(`Counter-back: ${res.status} ${JSON.stringify(res.data)}`)
    }
    ctx.log(`  Counter-back: ${res.status}`)
  }, 'Organiser: Negotiation')

  await ctx.step('O11b: Accept vendor counter', async () => {
    const interest = ctx.vendorInterests?.[0]
    if (!interest) { ctx.skip('No vendor interests'); return }
    const res = await http(
      `${ctx.API_URL}/events/${ctx.eventId}/vendor-interests/${interest.id}/accept-counter`,
      { method: 'POST', token: ctx.organiserToken, body: {} }
    )
    // 200 = accepted, 400 = no counter to accept yet
    if (res.status !== 200 && res.status !== 400) {
      throw new Error(`Accept counter: ${res.status} ${JSON.stringify(res.data)}`)
    }
  }, 'Organiser: Negotiation')

  await ctx.step('O13: GET cancellation terms', async () => {
    const interest = ctx.vendorInterests?.[0]
    if (!interest) { ctx.skip('No vendor interests'); return }
    const res = await http(
      `${ctx.API_URL}/events/${ctx.eventId}/vendor-interests/${interest.id}/cancellation`,
      { token: ctx.organiserToken }
    )
    if (res.status !== 200 && res.status !== 404) {
      throw new Error(`GET cancellation: ${res.status} ${JSON.stringify(res.data)}`)
    }
  }, 'Organiser: Negotiation')

  // ── Commitment Fee ────────────────────────────────────────────────────────

  await ctx.step('O12: Initialize commitment fee payment', async () => {
    const interest = ctx.vendorInterests?.[0]
    if (!interest) { ctx.skip('No accepted vendor interest for payment'); return }
    const res = await http(`${ctx.API_URL}/payments/initialize`, {
      method: 'POST',
      token: ctx.organiserToken,
      body: { interestId: interest.id },
    })
    // 201 = payment initialized with Paystack URL
    // 400 = interest not in accepted state yet (vendor hasn't accepted)
    if (res.status !== 201 && res.status !== 400) {
      throw new Error(`Payment init: ${res.status} ${JSON.stringify(res.data)}`)
    }
    if (res.status === 201) {
      ctx.paymentReference = res.data?.reference
      ctx.log(`  Payment initialized: ${res.data?.reference}`)
    }
  }, 'Organiser: Payments')

  await ctx.step('O12b: GET payment history', async () => {
    const res = await http(`${ctx.API_URL}/payments/history`, { token: ctx.organiserToken })
    assertStatus(res, 200, 'Payment history')
  }, 'Organiser: Payments')

  // ── Gift System ───────────────────────────────────────────────────────────

  await ctx.step('O15: Update gift settings (bank account)', async () => {
    const res = await http(`${ctx.API_URL}/events/${ctx.eventId}/gift-list/settings`, {
      method: 'PATCH',
      token: ctx.organiserToken,
      body: {
        bankAccountName: 'Ada Obi',
        bankAccountNumber: '0123456789',
        bankName: 'Access Bank',
        bankCode: '044',
        cashGiftsEnabled: true,
      },
    })
    assertStatus(res, 200, 'Gift settings')
  }, 'Organiser: Gifts')

  await ctx.step('O16: Add wishlist items', async () => {
    ctx.wishlistItemIds = []
    const items = [
      { title: '[QA] KitchenAid Stand Mixer', description: 'Artisan Series 5qt', priceEstimate: 180000 },
      { title: '[QA] Honeymoon Fund', description: 'Maldives trip', priceEstimate: 500000 },
    ]
    for (const item of items) {
      const res = await http(`${ctx.API_URL}/events/${ctx.eventId}/gift-list/items`, {
        method: 'POST',
        token: ctx.organiserToken,
        body: item,
      })
      assertStatus(res, 201, `Add wishlist item: ${item.name}`)
      ctx.wishlistItemIds.push(res.data.id)
    }
    ctx.log(`  Added ${items.length} wishlist items`)
  }, 'Organiser: Gifts')

  await ctx.step('O16b: Update wishlist item', async () => {
    if (!ctx.wishlistItemIds?.[0]) { ctx.skip('No wishlist item to update'); return }
    const res = await http(`${ctx.API_URL}/gift-list/items/${ctx.wishlistItemIds[0]}`, {
      method: 'PATCH',
      token: ctx.organiserToken,
      body: { description: '[QA] Updated description' },
    })
    assertStatus(res, 200, 'Update wishlist item')
  }, 'Organiser: Gifts')

  // ── Gift: Guest claiming & bank transfer (public flows) ───────────────────

  await ctx.step('G6: GET public gift list', async () => {
    const res = await http(`${ctx.API_URL}/events/${ctx.eventId}/gift-list`)
    assertStatus(res, 200, 'Public gift list')
  }, 'Guest: Gifts')

  await ctx.step('G7: Claim wishlist item', async () => {
    if (!ctx.wishlistItemIds?.[1]) { ctx.skip('No wishlist item to claim'); return }
    const res = await http(`${ctx.API_URL}/gift-list/items/${ctx.wishlistItemIds[1]}/claim`, {
      method: 'POST',
      body: { claimedByName: '[QA] Ngozi Obi' },
    })
    assertStatus(res, 201, 'Claim wishlist item')
  }, 'Guest: Gifts')

  await ctx.step('G7b: Claim same item again → 409', async () => {
    if (!ctx.wishlistItemIds?.[1]) { ctx.skip('No wishlist item for race condition test'); return }
    const res = await http(`${ctx.API_URL}/gift-list/items/${ctx.wishlistItemIds[1]}/claim`, {
      method: 'POST',
      body: { claimedByName: '[QA] Another Guest' },
    })
    assertStatus(res, 409, 'Duplicate claim should be 409')
  }, 'Guest: Gifts')

  await ctx.step('G8: Report direct bank transfer', async () => {
    const res = await http(`${ctx.API_URL}/events/${ctx.eventId}/gift-list/direct-transfer`, {
      method: 'POST',
      body: {
        gifterName: '[QA] Tunde Adesanya',
        amountNaira: 50000,
        message: 'Congrats on your wedding!',
      },
    })
    assertStatus(res, 201, 'Report direct transfer')
    ctx.directTransferId = res.data?.transferId
  }, 'Guest: Gifts')

  await ctx.step('G9: Initialize Paystack gift payment', async () => {
    const res = await http(`${ctx.API_URL}/events/${ctx.eventId}/gift-list/pay`, {
      method: 'POST',
      body: { giftAmountNaira: 10000, gifterEmail: 'qa.gifter@example.com', gifterName: '[QA] Amaka Eze' },
    })
    assertStatus(res, 201, 'Init gift payment')
    assertField(res.data, 'publicKey', 'Gift payment init')
    assertField(res.data, 'amountKobo', 'Gift payment init')
    ctx.log(`  Gift charge: ₦${res.data.amountKobo / 100} (for ₦10,000 gift)`)
  }, 'Guest: Gifts')

  // ── Gift Dashboard (organiser) ────────────────────────────────────────────

  await ctx.step('O17: GET gift dashboard', async () => {
    const res = await http(`${ctx.API_URL}/events/${ctx.eventId}/gift-list/dashboard`, {
      token: ctx.organiserToken,
    })
    assertStatus(res, 200, 'Gift dashboard')
    assertField(res.data, 'directTransfers', 'Gift dashboard')
  }, 'Organiser: Gifts')

  await ctx.step('O18: Confirm direct transfer', async () => {
    if (!ctx.directTransferId) { ctx.skip('No direct transfer to confirm'); return }
    const res = await http(`${ctx.API_URL}/gift-list/direct-transfers/${ctx.directTransferId}/confirm`, {
      method: 'POST',
      token: ctx.organiserToken,
    })
    assertStatus(res, 201, 'Confirm direct transfer')
  }, 'Organiser: Gifts')

  // ── Thank You ─────────────────────────────────────────────────────────────

  await ctx.step('O19: Preview thank-you recipients (all)', async () => {
    const res = await http(`${ctx.API_URL}/events/${ctx.eventId}/thank-you/preview`, {
      method: 'POST',
      token: ctx.organiserToken,
      body: { target: 'all' },
    })
    assertStatus(res, 201, 'Thank-you preview (all)')
    ctx.log(`  Recipients: ${res.data?.count ?? '?'}`)
  }, 'Organiser: Thank You')

  await ctx.step('O19b: Preview thank-you (attendees only)', async () => {
    const res = await http(`${ctx.API_URL}/events/${ctx.eventId}/thank-you/preview`, {
      method: 'POST',
      token: ctx.organiserToken,
      body: { target: 'attendees' },
    })
    assertStatus(res, 201, 'Thank-you preview (attendees)')
  }, 'Organiser: Thank You')

  await ctx.step('O19c: Preview thank-you (gifters only)', async () => {
    const res = await http(`${ctx.API_URL}/events/${ctx.eventId}/thank-you/preview`, {
      method: 'POST',
      token: ctx.organiserToken,
      body: { target: 'gifters' },
    })
    assertStatus(res, 201, 'Thank-you preview (gifters)')
  }, 'Organiser: Thank You')

  await ctx.step('O20: Send thank-you messages', async () => {
    const res = await http(`${ctx.API_URL}/events/${ctx.eventId}/thank-you`, {
      method: 'POST',
      token: ctx.organiserToken,
      body: {
        target: 'all',
        subject: '[QA] Thank you for celebrating with us!',
        message: 'Dear {{name}}, thank you so much for joining us on our special day. Your presence meant everything.',
      },
    })
    assertStatus(res, 201, 'Send thank-you')
    ctx.log(`  Sent to: ${res.data?.sent ?? '?'} recipients`)
  }, 'Organiser: Thank You')

  // ── Reviews ───────────────────────────────────────────────────────────────

  await ctx.step('O21: GET /reviews/reviewable', async () => {
    const res = await http(`${ctx.API_URL}/reviews/reviewable`, { token: ctx.organiserToken })
    assertStatus(res, 200, 'GET reviewable vendors')
  }, 'Organiser: Reviews')

  await ctx.step('O21b: GET /vendors/:slug/reviews', async () => {
    const vendor = ctx.allVendors?.[0]
    if (!vendor?.slug) { ctx.skip('No vendor slug for reviews'); return }
    const res = await http(`${ctx.API_URL}/vendors/${vendor.slug}/reviews`, { token: ctx.organiserToken })
    assertStatus(res, 200, 'GET vendor reviews')
  }, 'Organiser: Reviews')

  // ── Cleanup ───────────────────────────────────────────────────────────────

  await ctx.step('O22: Delete wishlist item', async () => {
    if (!ctx.wishlistItemIds?.[0]) { ctx.skip('No wishlist item to delete'); return }
    const res = await http(`${ctx.API_URL}/gift-list/items/${ctx.wishlistItemIds[0]}`, {
      method: 'DELETE',
      token: ctx.organiserToken,
    })
    assertStatus(res, 200, 'Delete wishlist item')
  }, 'Organiser: Gifts')
}

export async function deleteTestEvent(ctx) {
  if (!ctx.eventId) return
  const res = await http(`${ctx.API_URL}/events/${ctx.eventId}`, {
    method: 'DELETE',
    token: ctx.organiserToken,
  })
  if (res.ok) {
    console.log(`[cleanup] Deleted test event ${ctx.eventId}`)
  } else {
    console.warn(`[cleanup] Could not delete test event: ${res.status}`)
  }
}
