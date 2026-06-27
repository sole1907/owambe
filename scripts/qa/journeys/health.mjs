import { http, assertStatus } from '../lib/http.mjs'

const SECTION = 'System Health'

export async function runHealthChecks(ctx) {
  await ctx.step('H1: Render deploy status', async () => {
    const res = await http(
      `https://api.render.com/v1/services/${ctx.RENDER_SERVICE_ID}/deploys?limit=1`,
      { headers: { Authorization: `Bearer ${ctx.RENDER_API_KEY}`, Accept: 'application/json' } }
    )
    assertStatus(res, 200, 'Render API')
    const deploy = res.data?.[0]?.deploy
    if (!deploy) throw new Error('No deploy found on Render')
    if (deploy.status !== 'live') throw new Error(`Deploy status is "${deploy.status}", expected "live"`)
    ctx.log(`  Render: ${deploy.status} (deployed ${new Date(deploy.finishedAt || deploy.createdAt).toLocaleString('en-GB')})`)
  }, SECTION)

  await ctx.step('H2: Vercel deploy status', async () => {
    const res = await http(
      `https://api.vercel.com/v6/deployments?projectId=${ctx.VERCEL_PROJECT_ID}&limit=1`,
      { headers: { Authorization: `Bearer ${ctx.VERCEL_TOKEN}` } }
    )
    assertStatus(res, 200, 'Vercel API')
    const deploy = res.data?.deployments?.[0]
    if (!deploy) throw new Error('No deployment found on Vercel')
    if (deploy.state !== 'READY') throw new Error(`Vercel deployment state is "${deploy.state}", expected "READY"`)
    ctx.log(`  Vercel: ${deploy.state} (url: ${deploy.url})`)
  }, SECTION)

  await ctx.step('H3: API health check', async () => {
    const res = await http(`${ctx.API_URL}/`)
    if (res.status !== 200 && res.status !== 404) {
      // 404 is fine — no root route defined — means API is up
      if (res.status === 0) throw new Error(`API unreachable: ${res.error}`)
    }
    ctx.log(`  API: reachable (${res.ms}ms)`)
  }, SECTION)
}
