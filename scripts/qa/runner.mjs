#!/usr/bin/env node
/**
 * Owambe QA Runner
 * Usage: node --env-file=scripts/qa/.env.qa scripts/qa/runner.mjs
 */

import { runHealthChecks } from './journeys/health.mjs'
import { runOrganiserJourneys, deleteTestEvent } from './journeys/organiser.mjs'
import { runCoordinatorJourneys } from './journeys/coordinator.mjs'
import { runVendorPortalJourneys } from './journeys/vendor-portal.mjs'
import { writeReport } from './lib/report.mjs'
import { sendReportEmail } from './lib/email.mjs'

// ── Shared context ──────────────────────────────────────────────────────────

const ctx = {
  // Config from env
  API_URL: process.env.API_URL || 'https://owambe-api-dev.onrender.com',
  WEB_URL: process.env.WEB_URL,
  RENDER_API_KEY: process.env.RENDER_API_KEY,
  RENDER_SERVICE_ID: process.env.RENDER_SERVICE_ID,
  VERCEL_TOKEN: process.env.VERCEL_TOKEN,
  VERCEL_PROJECT_ID: process.env.VERCEL_PROJECT_ID,
  ORGANISER_EMAIL: process.env.ORGANISER_EMAIL,
  ORGANISER_PASSWORD: process.env.ORGANISER_PASSWORD,
  VENDOR_PASSWORD: process.env.VENDOR_PASSWORD || 'Owambe2025!',
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  REPORT_EMAIL: process.env.REPORT_EMAIL,

  // Runtime state (set during test run)
  organiserToken: null,
  organiserId: null,
  eventId: null,
  inviteToken: null,
  guestInviteToken: null,
  guestIds: [],
  plusOneRequestId: null,
  vendorCategories: [],
  allVendors: [],
  vendorInterests: [],
  shortlistedInterests: [],
  checklistItemId: null,
  wishlistItemIds: [],
  directTransferId: null,
  paymentReference: null,
  collaboratorId: null,
  collaboratorToken: null,
  coordinatorToken: null,
  vendorInquiries: [],

  // Results accumulator
  _results: [],
  _currentSection: 'General',
  _skipped: false,

  // Helpers
  log(msg) {
    console.log(msg)
  },

  skip(note = 'skipped') {
    this._skipped = true
    this._skipNote = note
  },

  async step(name, fn, section = 'General') {
    this._skipped = false
    this._skipNote = ''
    const start = Date.now()
    process.stdout.write(`  ${name} ... `)
    try {
      await fn()
      const ms = Date.now() - start
      if (this._skipped) {
        console.log(`⏭️  (${this._skipNote})`)
        this._results.push({ name, section, status: 'skip', ms, note: this._skipNote })
      } else {
        console.log(`✅ ${ms}ms`)
        this._results.push({ name, section, status: 'pass', ms })
      }
    } catch (err) {
      const ms = Date.now() - start
      console.log(`❌ ${ms}ms`)
      console.log(`     → ${err.message}`)
      this._results.push({ name, section, status: 'fail', ms, error: err.message })
    }
  },
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🎉 Owambe QA Runner')
  console.log(`   API: ${ctx.API_URL}`)
  console.log(`   Web: ${ctx.WEB_URL}`)
  console.log(`   Started: ${new Date().toLocaleString('en-GB')}\n`)

  try {
    console.log('── System Health ─────────────────────────────────────────')
    await runHealthChecks(ctx)

    console.log('\n── Organiser Journeys (Wedding) ──────────────────────────')
    await runOrganiserJourneys(ctx)

    console.log('\n── Coordinator Journeys ──────────────────────────────────')
    await runCoordinatorJourneys(ctx)

    console.log('\n── Vendor Portal Journeys ────────────────────────────────')
    await runVendorPortalJourneys(ctx)

  } finally {
    // Always clean up test data
    console.log('\n── Cleanup ───────────────────────────────────────────────')
    await deleteTestEvent(ctx)
  }

  // ── Report ────────────────────────────────────────────────────────────────

  const results = ctx._results
  const passed = results.filter(r => r.status === 'pass').length
  const failed = results.filter(r => r.status === 'fail').length
  const skipped = results.filter(r => r.status === 'skip').length
  const failures = results.filter(r => r.status === 'fail')

  console.log('\n─────────────────────────────────────────────────────────')
  console.log(`✅ ${passed} passed  ❌ ${failed} failed  ⏭️  ${skipped} skipped`)

  const report = writeReport(results)
  console.log(`\n📄 Report: ${report.filepath}`)

  if (ctx.RESEND_API_KEY && ctx.REPORT_EMAIL) {
    await sendReportEmail({
      resendKey: ctx.RESEND_API_KEY,
      to: ctx.REPORT_EMAIL,
      passed,
      failed,
      skipped,
      failures,
      filepath: report.filepath,
    })
  }

  process.exit(failed > 0 ? 1 : 0)
}

main().catch(err => {
  console.error('\n💥 Runner crashed:', err.message)
  process.exit(1)
})
