import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPORTS_DIR = join(__dirname, '../reports')

export function writeReport(results) {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const timestamp = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}-${pad(now.getHours())}-${pad(now.getMinutes())}`
  const filename = `${timestamp}.md`

  const passed = results.filter(r => r.status === 'pass').length
  const failed = results.filter(r => r.status === 'fail').length
  const skipped = results.filter(r => r.status === 'skip').length
  const totalMs = results.reduce((acc, r) => acc + (r.ms || 0), 0)
  const failures = results.filter(r => r.status === 'fail')

  const dateLabel = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  const timeLabel = `${pad(now.getHours())}:${pad(now.getMinutes())}`

  const lines = [
    `# Owambe QA Report — ${dateLabel} ${timeLabel}`,
    '',
    `**${passed} passed · ${failed} failed · ${skipped} skipped · ${(totalMs / 1000).toFixed(1)}s total**`,
    '',
  ]

  // Group by section
  const sections = {}
  for (const r of results) {
    const s = r.section || 'General'
    if (!sections[s]) sections[s] = []
    sections[s].push(r)
  }

  for (const [section, items] of Object.entries(sections)) {
    lines.push(`## ${section}`)
    for (const r of items) {
      const icon = r.status === 'pass' ? '✅' : r.status === 'skip' ? '⏭️' : '❌'
      const note = r.status === 'skip' && r.note ? ` — ${r.note}` : ''
      lines.push(`- ${icon} **${r.name}** (${r.ms || 0}ms)${note}`)
    }
    lines.push('')
  }

  if (failures.length > 0) {
    lines.push('## Failed Steps — Detail')
    lines.push('')
    for (const f of failures) {
      lines.push(`### ❌ ${f.name}`)
      lines.push(`\`\`\``)
      lines.push(f.error || 'Unknown error')
      lines.push(`\`\`\``)
      lines.push('')
    }
  }

  // Recommendations
  const recs = generateRecommendations(failures)
  if (recs.length > 0) {
    lines.push('## Recommendations')
    lines.push('')
    recs.forEach((rec, i) => lines.push(`${i + 1}. ${rec}`))
    lines.push('')
  }

  mkdirSync(REPORTS_DIR, { recursive: true })
  const filepath = join(REPORTS_DIR, filename)
  writeFileSync(filepath, lines.join('\n'), 'utf8')

  return { filepath, filename, passed, failed, skipped, failures, content: lines.join('\n') }
}

function generateRecommendations(failures) {
  const recs = []
  for (const f of failures) {
    if (f.error?.includes('Expected HTTP 401') || f.error?.includes('Expected HTTP 403')) {
      recs.push(`**Auth issue on "${f.name}"** — check token expiry or permission guard`)
    } else if (f.error?.includes('Expected HTTP 500')) {
      recs.push(`**Server error on "${f.name}"** — check Render logs for stack trace`)
    } else if (f.error?.includes('Expected HTTP 404')) {
      recs.push(`**Not found on "${f.name}"** — resource may not have been created in a prior step`)
    } else if (f.error?.includes('Expected HTTP 409')) {
      recs.push(`**Conflict on "${f.name}"** — test data from a previous run may still exist`)
    } else if (f.status === 0) {
      recs.push(`**Network error on "${f.name}"** — API may be down or cold-starting on Render`)
    } else {
      recs.push(`**Review "${f.name}"** — ${f.error}`)
    }
  }
  if (failures.length === 0) {
    recs.push('All journeys passed. Consider adding tests for edge cases and error states.')
  }
  return recs
}
