import { http, assertStatus, assertField } from '../lib/http.mjs'

// Tests vendor portal journeys for the seeded test vendors
// Cycles through multiple vendors to simulate a full wedding booking

const SECTION = 'Vendor Portal'

const TEST_VENDORS = [
  { email: 'landmark@owambe.test', name: 'Landmark Event Centre', category: 'venues' },
  { email: 'royalfeast@owambe.test', name: 'Royal Feast Catering', category: 'caterers' },
  { email: 'clicksdami@owambe.test', name: 'Clicks by Dami', category: 'photographers' },
  { email: 'bloomdrape@owambe.test', name: 'Bloom & Drape Events', category: 'decorators' },
  { email: 'djkhalid@owambe.test', name: 'DJ Khalid NG', category: 'djs' },
  { email: 'mctee@owambe.test', name: 'MC Tee', category: 'mcs' },
]

export async function runVendorPortalJourneys(ctx) {
  const password = ctx.VENDOR_PASSWORD

  for (const vendor of TEST_VENDORS) {
    await ctx.step(`V1: Sign in — ${vendor.name}`, async () => {
      const res = await http(`${ctx.API_URL}/auth/signin`, {
        method: 'POST',
        body: { email: vendor.email, password },
      })
      assertStatus(res, 201, `Sign in ${vendor.name}`)
      vendor.token = res.data?.token
      ctx.log(`  Signed in as ${vendor.name}`)
    }, SECTION)
  }

  // Use the first vendor (Landmark) for deeper portal tests
  const primary = TEST_VENDORS[0]

  await ctx.step('V2: GET /vendor/profile', async () => {
    if (!primary.token) { ctx.skip('No vendor token'); return }
    const res = await http(`${ctx.API_URL}/vendor-portal/profile`, { token: primary.token })
    assertStatus(res, 200, 'GET vendor profile')
    assertField(res.data, 'name', 'Vendor profile')
  }, SECTION)

  await ctx.step('V2b: PATCH /vendor/profile', async () => {
    if (!primary.token) { ctx.skip('No vendor token'); return }
    const res = await http(`${ctx.API_URL}/vendor-portal/profile`, {
      method: 'PATCH',
      token: primary.token,
      body: { bio: '[QA] Updated vendor bio for testing purposes' },
    })
    assertStatus(res, 200, 'PATCH vendor profile')
  }, SECTION)

  await ctx.step('V3: GET /vendor/availability', async () => {
    if (!primary.token) { ctx.skip('No vendor token'); return }
    const res = await http(`${ctx.API_URL}/vendor-portal/availability`, { token: primary.token })
    assertStatus(res, 200, 'GET availability')
  }, SECTION)

  await ctx.step('V3b: Block and unblock a date', async () => {
    if (!primary.token) { ctx.skip('No vendor token'); return }
    const testDate = new Date(Date.now() + 400 * 86400000).toISOString().slice(0, 10)
    const blockRes = await http(`${ctx.API_URL}/vendor-portal/availability/block`, {
      method: 'POST',
      token: primary.token,
      body: { date: testDate },
    })
    assertStatus(blockRes, 201, 'Block date')

    const deleteRes = await http(`${ctx.API_URL}/vendor-portal/availability/${testDate}`, {
      method: 'DELETE',
      token: primary.token,
    })
    assertStatus(deleteRes, 200, 'Unblock date')
  }, SECTION)

  await ctx.step('V5: GET /vendor/menu (caterer)', async () => {
    const caterer = TEST_VENDORS.find(v => v.category === 'caterers')
    if (!caterer?.token) { ctx.skip('No caterer token'); return }
    const res = await http(`${ctx.API_URL}/vendor-portal/menu`, { token: caterer.token })
    assertStatus(res, 200, 'GET caterer menu')
  }, SECTION)

  await ctx.step('V5b: Add, update, delete menu item', async () => {
    const caterer = TEST_VENDORS.find(v => v.category === 'caterers')
    if (!caterer?.token) { ctx.skip('No caterer token'); return }

    const addRes = await http(`${ctx.API_URL}/vendor-portal/menu/items`, {
      method: 'POST',
      token: caterer.token,
      body: { name: '[QA] Jollof Rice Special', category: 'Rice Dishes' },
    })
    assertStatus(addRes, 201, 'Add menu item')
    const itemId = addRes.data?.id

    const patchRes = await http(`${ctx.API_URL}/vendor-portal/menu/items/${itemId}`, {
      method: 'PATCH',
      token: caterer.token,
      body: { priceNaira: 4000 },
    })
    assertStatus(patchRes, 200, 'Update menu item')

    const delRes = await http(`${ctx.API_URL}/vendor-portal/menu/items/${itemId}`, {
      method: 'DELETE',
      token: caterer.token,
    })
    assertStatus(delRes, 200, 'Delete menu item')
  }, SECTION)

  await ctx.step('V6: Decorator styles and packages', async () => {
    const decorator = TEST_VENDORS.find(v => v.category === 'decorators')
    if (!decorator?.token) { ctx.skip('No decorator token'); return }

    const styleRes = await http(`${ctx.API_URL}/vendor-portal/decorator/styles`, {
      method: 'POST',
      token: decorator.token,
      body: { style: '[QA] Elegant Afro Luxe' },
    })
    assertStatus(styleRes, 201, 'Add decorator style')
    const styleId = styleRes.data?.id

    const pkgRes = await http(`${ctx.API_URL}/vendor-portal/decorator/packages`, {
      method: 'POST',
      token: decorator.token,
      body: { name: '[QA] Full Wedding Package', description: 'Everything included', priceNaira: 800000 },
    })
    assertStatus(pkgRes, 201, 'Add decorator package')
    const pkgId = pkgRes.data?.id

    const patchPkg = await http(`${ctx.API_URL}/vendor-portal/decorator/packages/${pkgId}`, {
      method: 'PATCH',
      token: decorator.token,
      body: { priceNaira: 850000 },
    })
    assertStatus(patchPkg, 200, 'Update decorator package')

    await http(`${ctx.API_URL}/vendor-portal/decorator/packages/${pkgId}`, { method: 'DELETE', token: decorator.token })
    await http(`${ctx.API_URL}/vendor-portal/decorator/styles/${styleId}`, { method: 'DELETE', token: decorator.token })
  }, SECTION)

  await ctx.step('V7: GET /payouts/banks', async () => {
    if (!primary.token) { ctx.skip('No vendor token'); return }
    const res = await http(`${ctx.API_URL}/payouts/banks`, { token: primary.token })
    assertStatus(res, 200, 'GET banks list')
    if (!Array.isArray(res.data) || res.data.length === 0) {
      throw new Error('No banks returned')
    }
    ctx.log(`  ${res.data.length} banks available`)
  }, SECTION)

  await ctx.step('V8: GET /vendor/payment-structure', async () => {
    if (!primary.token) { ctx.skip('No vendor token'); return }
    const res = await http(`${ctx.API_URL}/vendor-portal/payment-structure`, { token: primary.token })
    // 200 = exists, 404 = not yet configured
    if (res.status !== 200 && res.status !== 404) {
      throw new Error(`Payment structure: ${res.status} ${JSON.stringify(res.data)}`)
    }
  }, SECTION)

  await ctx.step('V8b: POST /vendor/payment-structure', async () => {
    if (!primary.token) { ctx.skip('No vendor token'); return }
    const res = await http(`${ctx.API_URL}/vendor-portal/payment-structure`, {
      method: 'POST',
      token: primary.token,
      body: {
        commitmentPct: 20,
        commitmentReleaseDays: 30,
        materialsPct: 30,
        materialsReleaseDays: 14,
        balancePct: 50,
        balanceReleaseHours: 48,
      },
    })
    if (res.status !== 200 && res.status !== 201) {
      throw new Error(`POST payment structure: ${res.status} ${JSON.stringify(res.data)}`)
    }
  }, SECTION)

  await ctx.step('V8c: Agree to payment terms', async () => {
    if (!primary.token) { ctx.skip('No vendor token'); return }
    const res = await http(`${ctx.API_URL}/vendor-portal/payment-structure/agree-terms`, {
      method: 'POST',
      token: primary.token,
    })
    if (res.status !== 200 && res.status !== 201) {
      throw new Error(`Agree terms: ${res.status} ${JSON.stringify(res.data)}`)
    }
  }, SECTION)

  await ctx.step('V9: GET /vendor-portal/inquiry-counts', async () => {
    if (!primary.token) { ctx.skip('No vendor token'); return }
    const res = await http(`${ctx.API_URL}/vendor-portal/inquiry-counts`, { token: primary.token })
    assertStatus(res, 200, 'Inquiry counts')
  }, SECTION)

  await ctx.step('V9b: GET /vendor-portal/inquiries', async () => {
    if (!primary.token) { ctx.skip('No vendor token'); return }
    const res = await http(`${ctx.API_URL}/vendor-portal/inquiries`, { token: primary.token })
    assertStatus(res, 200, 'GET inquiries')
    ctx.vendorInquiries = res.data || []
    ctx.log(`  ${ctx.vendorInquiries.length} inquiries for ${primary.name}`)
  }, SECTION)

  await ctx.step('V10: Counter organiser offer', async () => {
    const inquiry = ctx.vendorInquiries?.[0]
    if (!inquiry || !primary.token) { ctx.skip('No inquiry to counter'); return }
    const res = await http(`${ctx.API_URL}/vendor-portal/inquiries/${inquiry.id}`, {
      method: 'PATCH',
      token: primary.token,
      body: { action: 'counter', counterPrice: 750000 },
    })
    if (res.status !== 200 && res.status !== 400) {
      throw new Error(`Counter offer: ${res.status} ${JSON.stringify(res.data)}`)
    }
    ctx.log(`  Counter sent: ${res.status}`)
  }, SECTION)

  await ctx.step('V14: GET /vendor/earnings', async () => {
    if (!primary.token) { ctx.skip('No vendor token'); return }
    const res = await http(`${ctx.API_URL}/vendor-portal/earnings`, { token: primary.token })
    assertStatus(res, 200, 'GET earnings')
  }, SECTION)

  await ctx.step('V15: GET vendor reviews (public)', async () => {
    const vendor = ctx.allVendors?.[0]
    if (!vendor?.slug) { ctx.skip('No vendor slug'); return }
    const res = await http(`${ctx.API_URL}/vendors/${vendor.slug}/reviews`)
    assertStatus(res, 200, 'GET vendor reviews')
  }, SECTION)
}
