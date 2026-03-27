import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Resend } from 'resend'

type InviteEmailParams = {
  to: string
  guestName: string
  eventTitle: string
  eventDate: string
  eventCity: string
  allocation: number
  inviteUrl: string
  qrCodeUrl: string
}

type PlusOneRequestEmailParams = {
  to: string
  hostName: string
  guestName: string
  eventTitle: string
  requestedCount: number
  approveUrl: string
}

type PlusOneOutcomeEmailParams = {
  to: string
  guestName: string
  eventTitle: string
  approved: boolean
  newAllocation?: number
}

// ─── Shared base template ────────────────────────────────────────────────────

function base(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
  <style>
    @media only screen and (max-width: 600px) {
      .wrapper { padding: 16px !important; }
      .card    { padding: 24px 20px !important; border-radius: 16px !important; }
      .btn     { display: block !important; text-align: center !important; }
      .qr-img  { width: 160px !important; height: 160px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
    <tr>
      <td class="wrapper" style="padding:32px 16px;">
        <!-- Wordmark -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;margin:0 auto;">
          <tr>
            <td style="padding-bottom:20px;text-align:center;">
              <span style="font-size:20px;font-weight:700;color:#111;letter-spacing:-0.5px;">Owambe</span>
            </td>
          </tr>
        </table>

        <!-- Card -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;margin:0 auto;">
          <tr>
            <td class="card" style="background:#ffffff;border-radius:20px;padding:36px 32px;border:1px solid #e5e7eb;">
              ${content}
            </td>
          </tr>
        </table>

        <!-- Footer -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;margin:0 auto;">
          <tr>
            <td style="padding-top:20px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">Sent by Owambe &mdash; Event Planning Made Simple</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// ─── Reusable building blocks ─────────────────────────────────────────────────

function heading(text: string): string {
  return `<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111;letter-spacing:-0.3px;">${text}</h1>`
}

function subtext(text: string): string {
  return `<p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.5;">${text}</p>`
}

function divider(): string {
  return `<hr style="border:none;border-top:1px solid #f3f4f6;margin:24px 0;" />`
}

function eventCard(title: string, date: string, city: string): string {
  return `
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
         style="background:#f9fafb;border-radius:12px;border:1px solid #e5e7eb;margin-bottom:24px;">
    <tr>
      <td style="padding:16px 20px;">
        <p style="margin:0 0 2px;font-size:11px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">Event</p>
        <p style="margin:0 0 6px;font-size:18px;font-weight:700;color:#111;">${title}</p>
        <p style="margin:0;font-size:13px;color:#6b7280;">
          ${date}${city ? ` &nbsp;·&nbsp; ${city}` : ''}
        </p>
      </td>
    </tr>
  </table>`
}

function pill(text: string): string {
  return `<span style="display:inline-block;background:#f3f4f6;border-radius:100px;padding:4px 12px;font-size:13px;color:#374151;font-weight:500;">${text}</span>`
}

function primaryBtn(label: string, url: string): string {
  return `
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto;">
    <tr>
      <td style="border-radius:12px;background:#111;">
        <a class="btn" href="${url}"
           style="display:inline-block;padding:14px 32px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:12px;min-width:180px;text-align:center;">
          ${label}
        </a>
      </td>
    </tr>
  </table>`
}

function outlineBtn(label: string, url: string): string {
  return `
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto;">
    <tr>
      <td style="border-radius:12px;border:1px solid #d1d5db;">
        <a class="btn" href="${url}"
           style="display:inline-block;padding:13px 32px;font-size:14px;font-weight:500;color:#374151;text-decoration:none;border-radius:12px;min-width:180px;text-align:center;">
          ${label}
        </a>
      </td>
    </tr>
  </table>`
}

// ─── Email service ────────────────────────────────────────────────────────────

@Injectable()
export class EmailService {
  private resend: Resend
  private readonly logger = new Logger(EmailService.name)
  private readonly from = 'Owambe <invites@owambe.app>'

  constructor(private config: ConfigService) {
    this.resend = new Resend(this.config.get<string>('RESEND_API_KEY'))
  }

  // ── 1. Guest invite ──────────────────────────────────────────────────────────

  async sendInvite(params: InviteEmailParams) {
    const dateStr = params.eventDate || 'Date TBC'
    const spots = params.allocation
    const plusOnes = spots - 1

    const content = `
      ${heading("You're invited! 🎉")}
      ${subtext(`Hi <strong style="color:#111;">${params.guestName}</strong>, you have a personal invite to:`)}

      ${eventCard(params.eventTitle, dateStr, params.eventCity)}

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:24px;">
        <tr>
          <td style="padding:14px 18px;background:#f0fdf4;border-radius:10px;border:1px solid #bbf7d0;">
            <p style="margin:0;font-size:14px;color:#166534;">
              <strong>Your allocation:</strong>
              ${spots} spot${spots !== 1 ? 's' : ''}
              ${plusOnes > 0
                ? `&nbsp;&mdash;&nbsp; you + ${plusOnes} guest${plusOnes !== 1 ? 's' : ''}`
                : `&nbsp;&mdash;&nbsp; just you`}
            </p>
          </td>
        </tr>
      </table>

      <!-- QR code -->
      <p style="margin:0 0 12px;font-size:14px;color:#6b7280;text-align:center;">
        Show this QR code at the entrance
      </p>
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 28px;">
        <tr>
          <td style="padding:12px;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;">
            <img class="qr-img" src="${params.qrCodeUrl}" alt="Your invite QR code"
                 width="180" height="180"
                 style="display:block;width:180px;height:180px;" />
          </td>
        </tr>
      </table>

      ${primaryBtn('View my invite', params.inviteUrl)}

      ${divider()}
      <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
        Can't attend or need more spots? Visit your invite page above.
      </p>
    `

    try {
      await this.resend.emails.send({
        from: this.from,
        to: params.to,
        subject: `You're invited to ${params.eventTitle}`,
        html: base(content),
      })
    } catch (err) {
      this.logger.error('Failed to send invite email', err)
    }
  }

  // ── 2. Plus-one request notification to host ─────────────────────────────────

  async sendPlusOneRequestToHost(params: PlusOneRequestEmailParams) {
    const content = `
      ${heading('New plus-one request')}
      ${subtext(`Hi <strong style="color:#111;">${params.hostName}</strong>,`)}

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
             style="background:#fffbeb;border-radius:12px;border:1px solid #fde68a;margin-bottom:24px;">
        <tr>
          <td style="padding:18px 20px;">
            <p style="margin:0 0 6px;font-size:15px;color:#111;">
              <strong>${params.guestName}</strong> is requesting
              ${pill(`+${params.requestedCount} extra spot${params.requestedCount !== 1 ? 's' : ''}`)}
            </p>
            <p style="margin:6px 0 0;font-size:13px;color:#92400e;">
              Event: <strong>${params.eventTitle}</strong>
            </p>
          </td>
        </tr>
      </table>

      <p style="margin:0 0 20px;font-size:14px;color:#6b7280;text-align:center;">
        Review and approve or decline in the app
      </p>

      ${primaryBtn('Review request', params.approveUrl)}
    `

    try {
      await this.resend.emails.send({
        from: this.from,
        to: params.to,
        subject: `Plus-one request from ${params.guestName} — ${params.eventTitle}`,
        html: base(content),
      })
    } catch (err) {
      this.logger.error('Failed to send plus-one request email', err)
    }
  }

  // ── 3. Plus-one outcome to guest ─────────────────────────────────────────────

  async sendPlusOneOutcomeToGuest(params: PlusOneOutcomeEmailParams) {
    const approved = params.approved

    const content = approved
      ? `
        ${heading('Your request was approved ✅')}
        ${subtext(`Hi <strong style="color:#111;">${params.guestName}</strong>,`)}

        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
               style="background:#f0fdf4;border-radius:12px;border:1px solid #bbf7d0;margin-bottom:24px;">
          <tr>
            <td style="padding:18px 20px;">
              <p style="margin:0 0 4px;font-size:15px;color:#111;">
                Great news — your plus-one request for <strong>${params.eventTitle}</strong> has been approved.
              </p>
              <p style="margin:8px 0 0;font-size:14px;color:#166534;">
                Your new allocation:
                <strong>${params.newAllocation} spot${(params.newAllocation ?? 0) !== 1 ? 's' : ''}</strong>
              </p>
            </td>
          </tr>
        </table>

        <p style="margin:0;font-size:13px;color:#6b7280;text-align:center;">
          Your QR code has been updated — check your original invite email or visit your invite link.
        </p>
      `
      : `
        ${heading('Your request was not approved')}
        ${subtext(`Hi <strong style="color:#111;">${params.guestName}</strong>,`)}

        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
               style="background:#fef2f2;border-radius:12px;border:1px solid #fecaca;margin-bottom:24px;">
          <tr>
            <td style="padding:18px 20px;">
              <p style="margin:0;font-size:15px;color:#111;">
                Unfortunately your plus-one request for <strong>${params.eventTitle}</strong> was not approved.
                Your original allocation remains unchanged.
              </p>
            </td>
          </tr>
        </table>

        <p style="margin:0;font-size:13px;color:#6b7280;text-align:center;">
          If you have questions, please reach out to the event host directly.
        </p>
      `

    try {
      await this.resend.emails.send({
        from: this.from,
        to: params.to,
        subject: approved
          ? `Your plus-one request for ${params.eventTitle} was approved`
          : `Your plus-one request for ${params.eventTitle}`,
        html: base(content),
      })
    } catch (err) {
      this.logger.error('Failed to send plus-one outcome email', err)
    }
  }
}
