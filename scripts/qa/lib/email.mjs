export async function sendReportEmail({ resendKey, to, passed, failed, skipped, failures, filepath }) {
  if (!resendKey) {
    console.log('[email] RESEND_API_KEY not set — skipping notification')
    return
  }

  const subject = `Owambe QA — ${passed} passed · ${failed} failed · ${new Date().toLocaleDateString('en-GB')}`

  const failureHtml = failures.length > 0
    ? `<h3 style="color:#dc2626">Failed (${failures.length})</h3><ul>${failures.map(f =>
        `<li><strong>${f.name}</strong><br/><code style="font-size:12px">${f.error}</code></li>`
      ).join('')}</ul>`
    : `<p style="color:#16a34a">🎉 All tests passed!</p>`

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2 style="border-bottom:2px solid #000;padding-bottom:8px">Owambe QA Report</h2>
      <p style="font-size:18px">
        <span style="color:#16a34a">✅ ${passed} passed</span> &nbsp;
        <span style="color:#dc2626">❌ ${failed} failed</span> &nbsp;
        <span style="color:#9ca3af">⏭️ ${skipped} skipped</span>
      </p>
      ${failureHtml}
      <p style="color:#6b7280;font-size:13px">Full report: <code>${filepath}</code></p>
      <hr/>
      <p style="color:#9ca3af;font-size:12px">Owambe QA Runner</p>
    </div>
  `

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${resendKey}`,
    },
    body: JSON.stringify({ from: 'Owambe QA <onboarding@resend.dev>', to: [to], subject, html }),
  })

  if (res.ok) {
    console.log(`[email] Report sent to ${to}`)
  } else {
    const err = await res.json().catch(() => ({}))
    console.warn('[email] Send failed:', err)
  }
}
