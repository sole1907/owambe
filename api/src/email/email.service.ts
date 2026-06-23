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

type VendorInquiryEmailParams = {
  to: string
  vendorName: string
  eventTitle: string
  eventDate: string
  eventCity: string
  expiresAt: string
  offeredPrice?: string | null
}

type VendorResponseEmailParams = {
  to: string
  organizerName: string
  vendorName: string
  eventTitle: string
  eventDate: string
  available: boolean
  vendorNotes?: string
  counterPrice?: number
}

type CommitmentConfirmedOrganizerParams = {
  to: string
  organizerName: string
  vendorName: string
  eventTitle: string
  eventDate: string
  amountPaid: number
}

type CommitmentConfirmedVendorParams = {
  to: string
  vendorName: string
  organizerName: string
  eventTitle: string
  eventDate: string
  amountHeld: number
}

type ReviewReminderParams = {
  to: string
  organizerName: string
  vendorName: string
  eventTitle: string
  interestId: string
  reminderNumber: number
  isLast: boolean
}

type VendorCancelledParams = {
  to: string // organiser email
  organizerName: string
  vendorName: string
  eventTitle: string
  eventDate: string
  heldRefundedNaira: number
  outstandingNaira: number
  repaymentDeadline: string | null
}

type OrganiserCancelledParams = {
  to: string // vendor email
  vendorName: string
  organizerName: string
  eventTitle: string
  eventDate: string
}

type RepaymentDemandParams = {
  to: string // vendor email
  vendorName: string
  organizerName: string
  eventTitle: string
  outstandingNaira: number
  repaymentDeadline: string
}

type ExtensionGrantedParams = {
  to: string // organiser email
  organizerName: string
  vendorName: string
  eventTitle: string
  newDeadline: string
}

type PaymentReleasedParams = {
  to: string // vendor email
  vendorName: string
  bucket: string // 'commitment' | 'materials' | 'balance'
  amountNaira: number
  eventTitle: string
}

type UpcomingPaymentReminderParams = {
  to: string // vendor email
  vendorName: string
  bucket: string
  amountNaira: number
  eventTitle: string
  daysUntil: number
  scheduledAt: string
}

type BookingWindowOpenParams = {
  to: string // organiser email
  organizerName: string
  vendorName: string
  eventTitle: string
  agreedPriceNaira: number
  commitmentFeeNaira: number
  expiresInHours: number
  eventPageUrl: string
}

type UpcomingOrgPaymentReminderParams = {
  to: string // organiser email
  organizerName: string
  vendorName: string
  eventTitle: string
  bucket: 'materials' | 'balance'
  amountNaira: number
  daysUntil: number
  scheduledAt: string
}

type CommitmentFeeExpiredParams = {
  to: string // organiser email
  organizerName: string
  vendorName: string
  eventTitle: string
}

type CollaboratorInviteParams = {
  to: string
  inviteeEmail: string
  organizerName: string
  eventTitle: string
  eventDate: string | null
  message?: string | null
  acceptUrl: string
}

type ThankYouParams = {
  to: string
  recipientName: string
  organizerName: string
  eventTitle: string
  customMessage: string
  subject: string
}

type GiftReceivedParams = {
  to: string // organiser email
  organizerName: string
  gifterName: string
  amountNaira: number
  message?: string | null
  eventTitle: string
}

type DirectTransferReportedParams = {
  to: string // organiser email
  organizerName: string
  gifterName: string
  amountNaira: number
  message?: string | null
  eventTitle: string
  confirmUrl: string
}

// ─── Shared base template ────────────────────────────────────────────────────

function base(content: string, interceptNote?: string): string {
  const intercept = interceptNote
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;margin:0 auto 12px;">
        <tr>
          <td style="background:#fef3c7;border:1px solid #f59e0b;border-radius:10px;padding:10px 16px;">
            <p style="margin:0;font-size:12px;color:#92400e;">
              📬 <strong>Test intercept:</strong> ${interceptNote}
            </p>
          </td>
        </tr>
      </table>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
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

        ${intercept}

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

function fmt(n: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(n)
}

// ─── Email service ────────────────────────────────────────────────────────────

@Injectable()
export class EmailService {
  private resend: Resend | null = null
  private readonly logger = new Logger(EmailService.name)
  private readonly from = 'Owambe <invites@owambe.app>'
  private readonly testIntercept: string | null = null

  constructor(private config: ConfigService) {
    const key = this.config.get<string>('RESEND_API_KEY')
    if (key) {
      this.resend = new Resend(key)
    } else {
      this.logger.warn('RESEND_API_KEY is not set — emails will not be sent')
    }
    this.testIntercept = this.config.get<string>('testEmailIntercept') ?? null
  }

  // Intercept @owambe.test addresses — redirect to TEST_EMAIL_INTERCEPT
  private resolve(email: string): { to: string; note: string | undefined } {
    if (email.endsWith('@owambe.test') && this.testIntercept) {
      return { to: this.testIntercept, note: `Originally addressed to ${email} (test vendor)` }
    }
    return { to: email, note: undefined }
  }

  private async send(to: string, subject: string, content: string) {
    if (!this.resend) return
    const { to: resolvedTo, note } = this.resolve(to)
    try {
      await this.resend.emails.send({
        from: 'onboarding@resend.dev', //this.from,
        to: resolvedTo,
        subject,
        html: base(content, note),
      })
    } catch (err) {
      this.logger.error(`Failed to send "${subject}" to ${resolvedTo}`, err)
    }
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
              ${plusOnes > 0 ? `&nbsp;&mdash;&nbsp; you + ${plusOnes} guest${plusOnes !== 1 ? 's' : ''}` : `&nbsp;&mdash;&nbsp; just you`}
            </p>
          </td>
        </tr>
      </table>

      <p style="margin:0 0 12px;font-size:14px;color:#6b7280;text-align:center;">Show this QR code at the entrance</p>
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 28px;">
        <tr>
          <td style="padding:12px;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;">
            <img class="qr-img" src="${params.qrCodeUrl}" alt="Your invite QR code" width="180" height="180" style="display:block;width:180px;height:180px;" />
          </td>
        </tr>
      </table>

      ${primaryBtn('View my invite', params.inviteUrl)}
      ${divider()}
      <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">Can't attend or need more spots? Visit your invite page above.</p>
    `
    await this.send(params.to, `You're invited to ${params.eventTitle}`, content)
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
            <p style="margin:6px 0 0;font-size:13px;color:#92400e;">Event: <strong>${params.eventTitle}</strong></p>
          </td>
        </tr>
      </table>

      <p style="margin:0 0 20px;font-size:14px;color:#6b7280;text-align:center;">Review and approve or decline in the app</p>
      ${primaryBtn('Review request', params.approveUrl)}
    `
    await this.send(
      params.to,
      `Plus-one request from ${params.guestName} — ${params.eventTitle}`,
      content,
    )
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
          <tr><td style="padding:18px 20px;">
            <p style="margin:0 0 4px;font-size:15px;color:#111;">
              Great news — your plus-one request for <strong>${params.eventTitle}</strong> has been approved.
            </p>
            <p style="margin:8px 0 0;font-size:14px;color:#166534;">
              Your new allocation: <strong>${params.newAllocation} spot${(params.newAllocation ?? 0) !== 1 ? 's' : ''}</strong>
            </p>
          </td></tr>
        </table>
        <p style="margin:0;font-size:13px;color:#6b7280;text-align:center;">Your QR code has been updated — check your original invite email or visit your invite link.</p>
      `
      : `
        ${heading('Your request was not approved')}
        ${subtext(`Hi <strong style="color:#111;">${params.guestName}</strong>,`)}
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
               style="background:#fef2f2;border-radius:12px;border:1px solid #fecaca;margin-bottom:24px;">
          <tr><td style="padding:18px 20px;">
            <p style="margin:0;font-size:15px;color:#111;">
              Unfortunately your plus-one request for <strong>${params.eventTitle}</strong> was not approved. Your original allocation remains unchanged.
            </p>
          </td></tr>
        </table>
        <p style="margin:0;font-size:13px;color:#6b7280;text-align:center;">If you have questions, please reach out to the event host directly.</p>
      `

    await this.send(
      params.to,
      approved
        ? `Your plus-one request for ${params.eventTitle} was approved`
        : `Your plus-one request for ${params.eventTitle}`,
      content,
    )
  }

  // ── 4. Vendor inquiry (to vendor) ────────────────────────────────────────────

  async sendVendorInquiry(params: VendorInquiryEmailParams) {
    const deadline = new Date(params.expiresAt).toLocaleString('en-NG', {
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    })

    const content = `
      ${heading('New availability enquiry')}
      ${subtext(`Hi <strong style="color:#111;">${params.vendorName}</strong>, you have a new enquiry through Owambe.`)}
      ${eventCard(params.eventTitle, params.eventDate, params.eventCity)}

      ${
        params.offeredPrice
          ? `
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
             style="background:#f0fdf4;border-radius:12px;border:1px solid #bbf7d0;margin-bottom:16px;">
        <tr><td style="padding:16px 20px;">
          <p style="margin:0;font-size:13px;color:#166534;">
            💰 The organiser has offered <strong>${params.offeredPrice}</strong> for this booking.
            You can accept this price or suggest a counter-offer when you respond.
          </p>
        </td></tr>
      </table>`
          : ''
      }

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
             style="background:#fffbeb;border-radius:12px;border:1px solid #fde68a;margin-bottom:24px;">
        <tr><td style="padding:16px 20px;">
          <p style="margin:0;font-size:13px;color:#92400e;">
            ⏱ Please respond by <strong>${deadline}</strong> — after this the enquiry will expire automatically.
          </p>
        </td></tr>
      </table>

      <p style="margin:0 0 20px;font-size:14px;color:#6b7280;text-align:center;">
        Log in to your vendor portal to confirm your availability and price.
      </p>
    `
    await this.send(params.to, `New availability enquiry — ${params.eventTitle}`, content)
  }

  // ── 5. Vendor response notification (to organiser) ───────────────────────────

  async sendVendorResponse(params: VendorResponseEmailParams) {
    const available = params.available
    const hasCounter = !!params.counterPrice

    const statusBlock = available
      ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
               style="background:#f0fdf4;border-radius:12px;border:1px solid #bbf7d0;margin-bottom:24px;">
          <tr><td style="padding:16px 20px;">
            <p style="margin:0 0 4px;font-size:15px;color:#166534;font-weight:600;">
              ✅ ${params.vendorName} is available on your event date
            </p>
            ${hasCounter ? `<p style="margin:6px 0 0;font-size:13px;color:#166534;">They've suggested a counter-offer of <strong>${fmt(params.counterPrice!)}</strong>. Review and respond in the app.</p>` : ''}
            ${params.vendorNotes ? `<p style="margin:6px 0 0;font-size:13px;color:#166534;">"${params.vendorNotes}"</p>` : ''}
          </td></tr>
        </table>`
      : `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
               style="background:#fef2f2;border-radius:12px;border:1px solid #fecaca;margin-bottom:24px;">
          <tr><td style="padding:16px 20px;">
            <p style="margin:0 0 4px;font-size:15px;color:#991b1b;font-weight:600;">
              ❌ ${params.vendorName} is not available on your event date
            </p>
            ${params.vendorNotes ? `<p style="margin:6px 0 0;font-size:13px;color:#991b1b;">"${params.vendorNotes}"</p>` : ''}
          </td></tr>
        </table>`

    const content = `
      ${heading('Vendor availability update')}
      ${subtext(`Hi <strong style="color:#111;">${params.organizerName}</strong>,`)}
      ${eventCard(params.eventTitle, params.eventDate, '')}
      ${statusBlock}
      <p style="margin:0;font-size:13px;color:#6b7280;text-align:center;">
        ${available ? 'Log in to your event dashboard to proceed with this booking.' : 'Consider choosing your B or C option for this category.'}
      </p>
    `
    await this.send(
      params.to,
      available
        ? `${params.vendorName} is available for ${params.eventTitle}`
        : `${params.vendorName} is not available — ${params.eventTitle}`,
      content,
    )
  }

  // ── 6. Commitment confirmed — to organiser ───────────────────────────────────

  async sendCommitmentConfirmedToOrganiser(params: CommitmentConfirmedOrganizerParams) {
    const content = `
      ${heading('Commitment fee paid ✅')}
      ${subtext(`Hi <strong style="color:#111;">${params.organizerName}</strong>, your commitment fee has been received.`)}
      ${eventCard(params.eventTitle, params.eventDate, '')}

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
             style="background:#f0fdf4;border-radius:12px;border:1px solid #bbf7d0;margin-bottom:24px;">
        <tr><td style="padding:18px 20px;">
          <p style="margin:0 0 6px;font-size:15px;font-weight:600;color:#166534;">${params.vendorName} is now committed to your event</p>
          <p style="margin:0;font-size:13px;color:#166534;">
            Commitment fee paid: <strong>${fmt(params.amountPaid)}</strong> — held securely until after your event.
          </p>
        </td></tr>
      </table>

      <p style="margin:0;font-size:13px;color:#6b7280;text-align:center;">
        The balance will be settled directly with the vendor via your agreed payment method after the event.
      </p>
    `
    await this.send(params.to, `${params.vendorName} is committed to ${params.eventTitle}`, content)
  }

  // ── 7. Commitment confirmed — to vendor ──────────────────────────────────────

  async sendCommitmentConfirmedToVendor(params: CommitmentConfirmedVendorParams) {
    const content = `
      ${heading('New commitment received 🎉')}
      ${subtext(`Hi <strong style="color:#111;">${params.vendorName}</strong>, you have a confirmed booking through Owambe.`)}
      ${eventCard(params.eventTitle, params.eventDate, '')}

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
             style="background:#f0fdf4;border-radius:12px;border:1px solid #bbf7d0;margin-bottom:24px;">
        <tr><td style="padding:18px 20px;">
          <p style="margin:0 0 4px;font-size:13px;color:#166534;">Booked by</p>
          <p style="margin:0 0 10px;font-size:15px;font-weight:600;color:#111;">${params.organizerName}</p>
          <p style="margin:0;font-size:13px;color:#166534;">
            Commitment fee in escrow: <strong>${fmt(params.amountHeld)}</strong>
          </p>
        </td></tr>
      </table>

      <p style="margin:0;font-size:13px;color:#6b7280;text-align:center;">
        Please ensure the date is blocked in your availability calendar.
      </p>
    `
    await this.send(params.to, `You have a confirmed booking — ${params.eventTitle}`, content)
  }

  // ── 8. Review reminder ───────────────────────────────────────────────────────

  async sendReviewReminder(params: ReviewReminderParams) {
    const appUrl = this.config.get<string>('appUrl') ?? 'http://localhost:3000'
    const reviewUrl = `${appUrl}/review/${params.interestId}`
    const urgency = params.isLast
      ? `<p style="margin:0 0 16px;font-size:13px;color:#9ca3af;text-align:center;">This is our last reminder — we won't send any more.</p>`
      : ''

    const content = `
      ${heading('How did it go? ⭐')}
      ${subtext(`Hi <strong style="color:#111;">${params.organizerName}</strong>, your event has passed — we'd love to hear how your vendor performed.`)}

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
             style="background:#f9fafb;border-radius:12px;border:1px solid #e5e7eb;margin-bottom:24px;">
        <tr><td style="padding:16px 20px;">
          <p style="margin:0 0 2px;font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">Vendor</p>
          <p style="margin:0 0 6px;font-size:18px;font-weight:700;color:#111;">${params.vendorName}</p>
          <p style="margin:0;font-size:13px;color:#6b7280;">for <strong>${params.eventTitle}</strong></p>
        </td></tr>
      </table>

      <p style="margin:0 0 20px;font-size:14px;color:#6b7280;text-align:center;">
        Takes less than a minute. Your review helps other event organisers make the right choice.
      </p>
      ${primaryBtn('Leave a review', reviewUrl)}
      ${divider()}
      ${urgency}
      <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">Reminder ${params.reminderNumber} of ${params.isLast ? params.reminderNumber : '...'}</p>
    `
    await this.send(params.to, `How was ${params.vendorName}? Leave a quick review`, content)
  }

  // ── 9. Vendor cancelled → notify organiser ───────────────────────────────────

  async sendVendorCancelledToOrganiser(params: VendorCancelledParams) {
    const hasOutstanding = params.outstandingNaira > 0

    const content = `
      ${heading('A vendor has cancelled your booking')}
      ${subtext(`Hi <strong style="color:#111;">${params.organizerName}</strong>, unfortunately ${params.vendorName} has cancelled their booking for your event.`)}
      ${eventCard(params.eventTitle, params.eventDate, '')}

      ${
        params.heldRefundedNaira > 0
          ? `
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
             style="background:#f0fdf4;border-radius:12px;border:1px solid #bbf7d0;margin-bottom:16px;">
        <tr><td style="padding:16px 20px;">
          <p style="margin:0;font-size:14px;color:#166534;">
            ✅ <strong>${fmt(params.heldRefundedNaira)}</strong> has been returned to you immediately — this was the amount Owambe still held.
          </p>
        </td></tr>
      </table>`
          : ''
      }

      ${
        hasOutstanding
          ? `
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
             style="background:#fffbeb;border-radius:12px;border:1px solid #fde68a;margin-bottom:24px;">
        <tr><td style="padding:16px 20px;">
          <p style="margin:0 0 6px;font-size:14px;color:#92400e;font-weight:600;">
            ⚠️ ${fmt(params.outstandingNaira)} outstanding
          </p>
          <p style="margin:0;font-size:13px;color:#92400e;">
            This amount was already released to the vendor. They have been notified and have until
            <strong>${params.repaymentDeadline ? new Date(params.repaymentDeadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'TBC'}</strong>
            to refund you.
          </p>
          <p style="margin:8px 0 0;font-size:13px;color:#92400e;">
            The vendor's profile has been suspended until this is resolved. We will keep you updated on repayment progress.
          </p>
          <p style="margin:8px 0 0;font-size:12px;color:#b45309;">
            Note: Owambe does not currently hold a guarantee reserve. We will pursue this refund on your behalf but cannot guarantee the recovery timeline.
          </p>
        </td></tr>
      </table>`
          : `
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
             style="background:#f0fdf4;border-radius:12px;border:1px solid #bbf7d0;margin-bottom:24px;">
        <tr><td style="padding:16px 20px;">
          <p style="margin:0;font-size:14px;color:#166534;">
            ✅ No additional amount outstanding — your full payment has been returned.
          </p>
        </td></tr>
      </table>`
      }

      <p style="margin:0;font-size:13px;color:#6b7280;text-align:center;">
        We recommend finding a replacement vendor as soon as possible. Log in to your event dashboard to shortlist alternatives.
      </p>
    `
    await this.send(
      params.to,
      `${params.vendorName} has cancelled your booking — ${params.eventTitle}`,
      content,
    )
  }

  // ── 10. Organiser cancelled → notify vendor ──────────────────────────────────

  async sendOrganiserCancelledToVendor(params: OrganiserCancelledParams) {
    const content = `
      ${heading('A booking has been cancelled')}
      ${subtext(`Hi <strong style="color:#111;">${params.vendorName}</strong>, the organiser has cancelled your booking.`)}
      ${eventCard(params.eventTitle, params.eventDate, '')}

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
             style="background:#fef2f2;border-radius:12px;border:1px solid #fecaca;margin-bottom:24px;">
        <tr><td style="padding:16px 20px;">
          <p style="margin:0;font-size:14px;color:#991b1b;">
            <strong>${params.organizerName}</strong> has cancelled this booking. Any funds still held by Owambe have been returned to them per your payment structure's cancellation policy.
          </p>
        </td></tr>
      </table>

      <p style="margin:0;font-size:13px;color:#6b7280;text-align:center;">
        The date is now free in your calendar. You may wish to update your availability.
      </p>
    `
    await this.send(params.to, `Booking cancelled — ${params.eventTitle}`, content)
  }

  // ── 11. Repayment demand → vendor (after they cancelled with outstanding amount)

  async sendRepaymentDemandToVendor(params: RepaymentDemandParams) {
    const content = `
      ${heading('Refund required — action needed')}
      ${subtext(`Hi <strong style="color:#111;">${params.vendorName}</strong>, you have cancelled a confirmed booking and are required to refund the organiser.`)}
      ${eventCard(params.eventTitle, 'Cancelled booking', '')}

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
             style="background:#fef2f2;border-radius:12px;border:1px solid #fecaca;margin-bottom:24px;">
        <tr><td style="padding:18px 20px;">
          <p style="margin:0 0 4px;font-size:13px;color:#991b1b;">Amount owed to ${params.organizerName}</p>
          <p style="margin:0 0 10px;font-size:20px;font-weight:700;color:#111;">${fmt(params.outstandingNaira)}</p>
          <p style="margin:0;font-size:13px;color:#991b1b;">
            Deadline: <strong>${new Date(params.repaymentDeadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
          </p>
        </td></tr>
      </table>

      <p style="margin:0 0 16px;font-size:14px;color:#6b7280;">
        Per the terms you agreed to when activating your payment structure, you are responsible for refunding any amounts already released to you when you cancel a confirmed booking.
      </p>
      <p style="margin:0 0 20px;font-size:14px;color:#6b7280;">
        Please log in to your vendor portal to initiate the refund. If you need an extra 7 days, you can request a one-time extension there.
      </p>
      <p style="margin:0;font-size:13px;color:#9ca3af;">
        Your profile has been suspended and will remain so until the refund is confirmed.
      </p>
    `
    await this.send(
      params.to,
      `Refund required — ${fmt(params.outstandingNaira)} owed to organiser`,
      content,
    )
  }

  // ── 12. Extension granted → notify organiser ─────────────────────────────────

  async sendExtensionGrantedToOrganiser(params: ExtensionGrantedParams) {
    const content = `
      ${heading('Repayment deadline extended')}
      ${subtext(`Hi <strong style="color:#111;">${params.organizerName}</strong>, we have an update on your pending refund.`)}

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
             style="background:#fffbeb;border-radius:12px;border:1px solid #fde68a;margin-bottom:24px;">
        <tr><td style="padding:16px 20px;">
          <p style="margin:0 0 4px;font-size:14px;color:#92400e;">
            <strong>${params.vendorName}</strong> has requested a 7-day extension on their refund for <strong>${params.eventTitle}</strong>.
          </p>
          <p style="margin:8px 0 0;font-size:13px;color:#92400e;">
            New deadline: <strong>${new Date(params.newDeadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
          </p>
          <p style="margin:8px 0 0;font-size:12px;color:#b45309;">
            This is the maximum extension allowed. If the refund is not completed by this date, we will escalate.
          </p>
        </td></tr>
      </table>

      <p style="margin:0;font-size:13px;color:#6b7280;text-align:center;">
        You will be notified as soon as the refund is completed.
      </p>
    `
    await this.send(params.to, `Refund extension granted — ${params.vendorName}`, content)
  }

  // ── 13. Upcoming payment reminder → notify vendor ────────────────────────────

  async sendUpcomingPaymentReminder(params: UpcomingPaymentReminderParams) {
    const bucketLabel =
      params.bucket === 'commitment'
        ? 'Commitment fee'
        : params.bucket === 'materials'
          ? 'Materials fee'
          : 'Balance payment'

    const releaseDate = new Date(params.scheduledAt).toLocaleDateString('en-NG', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })

    const urgency =
      params.daysUntil <= 3
        ? 'bg-amber-50;border:1px solid #fde68a'
        : 'background:#f0fdf4;border:1px solid #bbf7d0'
    const urgencyText = params.daysUntil <= 3 ? '#92400e' : '#166534'

    const content = `
      ${heading('Upcoming payment release')}
      ${subtext(`Hi <strong style="color:#111;">${params.vendorName}</strong>, a payment is scheduled to be released to your account soon.`)}

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
             style="background:#f9fafb;border-radius:12px;border:1px solid #e5e7eb;margin-bottom:16px;">
        <tr><td style="padding:16px 20px;">
          <p style="margin:0 0 2px;font-size:11px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">Event</p>
          <p style="margin:0;font-size:16px;font-weight:700;color:#111;">${params.eventTitle}</p>
        </td></tr>
      </table>

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
             style="${urgency};border-radius:12px;margin-bottom:24px;">
        <tr><td style="padding:16px 20px;">
          <p style="margin:0 0 4px;font-size:14px;color:${urgencyText};font-weight:600;">${bucketLabel}</p>
          <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111;">₦${params.amountNaira.toLocaleString('en-NG')}</p>
          <p style="margin:0;font-size:13px;color:${urgencyText};">
            Scheduled for release on <strong>${releaseDate}</strong>
            ${params.daysUntil === 1 ? ' — that&apos;s tomorrow!' : ` — in ${params.daysUntil} days`}
          </p>
        </td></tr>
      </table>

      <p style="margin:0;font-size:13px;color:#6b7280;text-align:center;">
        Please ensure your bank account details are up to date in your vendor portal. Payments are processed automatically on the release date.
      </p>
    `
    await this.send(
      params.to,
      `${bucketLabel} of ₦${params.amountNaira.toLocaleString('en-NG')} releasing in ${params.daysUntil} day${params.daysUntil !== 1 ? 's' : ''} — ${params.eventTitle}`,
      content,
    )
  }

  // ── 14. Booking window opened → notify organiser ────────────────────────────

  async sendBookingWindowOpen(params: BookingWindowOpenParams) {
    const deadline = new Date(Date.now() + params.expiresInHours * 3_600_000).toLocaleString(
      'en-NG',
      { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' },
    )

    const content = `
      ${heading('Your booking is ready — pay now to lock it in')}
      ${subtext(`Hi <strong style="color:#111;">${params.organizerName}</strong>, <strong>${params.vendorName}</strong> has accepted your booking for <strong>${params.eventTitle}</strong>.`)}

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
             style="background:#f0fdf4;border-radius:12px;border:1px solid #86efac;margin-bottom:16px;">
        <tr><td style="padding:16px 20px;">
          <p style="margin:0 0 4px;font-size:13px;color:#166534;font-weight:600;">Commitment fee due</p>
          <p style="margin:0 0 2px;font-size:24px;font-weight:700;color:#15803d;">₦${params.commitmentFeeNaira.toLocaleString('en-NG')}</p>
          <p style="margin:0;font-size:12px;color:#166534;">of ₦${params.agreedPriceNaira.toLocaleString('en-NG')} agreed price</p>
        </td></tr>
      </table>

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
             style="background:#fef3c7;border-radius:12px;border:1px solid #fde68a;margin-bottom:24px;">
        <tr><td style="padding:12px 20px;">
          <p style="margin:0;font-size:13px;color:#92400e;">
            ⏱ Pay before <strong>${deadline}</strong> — the booking will be automatically released if unpaid.
          </p>
        </td></tr>
      </table>

      ${primaryBtn('Pay commitment fee', params.eventPageUrl)}
    `
    await this.send(
      params.to,
      `Action required: pay ₦${params.commitmentFeeNaira.toLocaleString('en-NG')} within ${params.expiresInHours}h to confirm ${params.vendorName}`,
      content,
    )
  }

  // ── 15. Upcoming payment reminder → notify organiser ────────────────────────

  async sendUpcomingPaymentReminderToOrganiser(params: UpcomingOrgPaymentReminderParams) {
    const bucketLabel = params.bucket === 'materials' ? 'Materials payment' : 'Balance payment'
    const releaseDate = new Date(params.scheduledAt).toLocaleDateString('en-NG', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
    const urgency =
      params.daysUntil <= 3
        ? 'background:#fffbeb;border:1px solid #fde68a'
        : 'background:#eff6ff;border:1px solid #bfdbfe'
    const urgencyText = params.daysUntil <= 3 ? '#92400e' : '#1e40af'

    const content = `
      ${heading('Upcoming payment milestone')}
      ${subtext(`Hi <strong style="color:#111;">${params.organizerName}</strong>, a payment milestone for your booking is coming up soon.`)}

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
             style="background:#f9fafb;border-radius:12px;border:1px solid #e5e7eb;margin-bottom:16px;">
        <tr><td style="padding:16px 20px;">
          <p style="margin:0 0 2px;font-size:11px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">Booking</p>
          <p style="margin:0 0 2px;font-size:16px;font-weight:700;color:#111;">${params.eventTitle}</p>
          <p style="margin:0;font-size:13px;color:#6b7280;">Vendor: <strong>${params.vendorName}</strong></p>
        </td></tr>
      </table>

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
             style="${urgency};border-radius:12px;margin-bottom:24px;">
        <tr><td style="padding:16px 20px;">
          <p style="margin:0 0 4px;font-size:14px;color:${urgencyText};font-weight:600;">${bucketLabel}</p>
          <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111;">₦${params.amountNaira.toLocaleString('en-NG')}</p>
          <p style="margin:0;font-size:13px;color:${urgencyText};">
            Due on <strong>${releaseDate}</strong>
            ${params.daysUntil === 1 ? ' — that&apos;s tomorrow!' : ` — in ${params.daysUntil} days`}
          </p>
        </td></tr>
      </table>

      <p style="margin:0;font-size:13px;color:#6b7280;text-align:center;">
        Log in to your Owambe dashboard to review your full payment schedule.
      </p>
    `
    await this.send(
      params.to,
      `${bucketLabel} of ₦${params.amountNaira.toLocaleString('en-NG')} due in ${params.daysUntil} day${params.daysUntil !== 1 ? 's' : ''} — ${params.eventTitle}`,
      content,
    )
  }

  // ── 15. Commitment fee booking window expired → notify organiser ─────────────

  async sendCommitmentFeeExpired(params: CommitmentFeeExpiredParams) {
    const content = `
      ${heading('Booking window closed')}
      ${subtext(`Hi <strong style="color:#111;">${params.organizerName}</strong>, your reservation window for the following vendor has expired.`)}

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
             style="background:#fef2f2;border-radius:12px;border:1px solid #fecaca;margin-bottom:24px;">
        <tr><td style="padding:16px 20px;">
          <p style="margin:0 0 4px;font-size:14px;color:#991b1b;font-weight:600;">${params.vendorName}</p>
          <p style="margin:0;font-size:13px;color:#b91c1c;">Event: <strong>${params.eventTitle}</strong></p>
          <p style="margin:8px 0 0;font-size:13px;color:#b91c1c;">
            The 48-hour window to pay the commitment fee has passed. The vendor has been released and is now available to other organisers.
          </p>
        </td></tr>
      </table>

      <p style="margin:0;font-size:13px;color:#6b7280;text-align:center;">
        You can shortlist this vendor again from your event page if they are still available.
      </p>
    `
    await this.send(params.to, `Booking window expired — ${params.vendorName}`, content)
  }

  // ── 16. Payment released → notify vendor ─────────────────────────────────────

  async sendPaymentReleased(params: PaymentReleasedParams) {
    const bucketLabel =
      params.bucket === 'commitment'
        ? 'Commitment fee'
        : params.bucket === 'materials'
          ? 'Materials fee'
          : 'Balance payment'

    const content = `
      ${heading('Payment released to your account')}
      ${subtext(`Hi <strong style="color:#111;">${params.vendorName}</strong>, a payment has been transferred to your registered bank account.`)}

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
             style="background:#f0fdf4;border-radius:12px;border:1px solid #86efac;margin-bottom:24px;">
        <tr><td style="padding:16px 20px;">
          <p style="margin:0 0 4px;font-size:14px;color:#166534;">
            <strong>${bucketLabel}</strong> for <strong>${params.eventTitle}</strong>
          </p>
          <p style="margin:8px 0 0;font-size:22px;font-weight:700;color:#15803d;">
            ₦${params.amountNaira.toLocaleString('en-NG')}
          </p>
          <p style="margin:8px 0 0;font-size:12px;color:#166534;">
            Allow 1–3 business days for the funds to appear in your account.
          </p>
        </td></tr>
      </table>

      <p style="margin:0;font-size:13px;color:#6b7280;text-align:center;">
        If you have any questions, reply to this email and we'll be happy to help.
      </p>
    `
    await this.send(
      params.to,
      `Payment of ₦${params.amountNaira.toLocaleString('en-NG')} released — ${params.eventTitle}`,
      content,
    )
  }

  // ── 17. Collaborator invite → coordinator ────────────────────────────────────

  async sendCollaboratorInvite(params: CollaboratorInviteParams) {
    const content = `
      ${heading("You've been invited to co-coordinate an event")}
      ${subtext(`<strong style="color:#111;">${params.organizerName}</strong> has invited you to help coordinate their event on Owambe.`)}

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
             style="background:#f9fafb;border-radius:12px;border:1px solid #e5e7eb;margin-bottom:16px;">
        <tr><td style="padding:16px 20px;">
          <p style="margin:0 0 2px;font-size:11px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">Event</p>
          <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#111;">${params.eventTitle}</p>
          ${params.eventDate ? `<p style="margin:0;font-size:13px;color:#6b7280;">${params.eventDate}</p>` : ''}
        </td></tr>
      </table>

      ${
        params.message
          ? `
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
             style="background:#fffbeb;border-radius:12px;border:1px solid #fcd34d;margin-bottom:24px;">
        <tr><td style="padding:14px 18px;">
          <p style="margin:0;font-size:13px;color:#92400e;font-style:italic;">"${params.message}"</p>
          <p style="margin:6px 0 0;font-size:12px;color:#b45309;">— ${params.organizerName}</p>
        </td></tr>
      </table>`
          : '<div style="margin-bottom:24px;"></div>'
      }

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:20px;">
        <tr><td align="center">
          <a href="${params.acceptUrl}"
             style="display:inline-block;padding:14px 32px;background:#111;color:#fff;font-size:15px;font-weight:600;border-radius:12px;text-decoration:none;">
            Accept invitation →
          </a>
        </td></tr>
      </table>

      <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
        As a coordinator you can view vendor bookings, manage the guest list and checklist,<br />
        and access event logistics. Payments remain with the organiser.
      </p>
    `
    await this.send(
      params.to,
      `You're invited to coordinate "${params.eventTitle}" on Owambe`,
      content,
    )
  }

  // ── 18. Personalised thank you → guest or gifter ─────────────────────────────

  async sendThankYou(params: ThankYouParams) {
    const content = `
      ${heading(params.subject)}
      ${subtext(`Dear <strong style="color:#111;">${params.recipientName}</strong>,`)}

      <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px 24px;margin-bottom:24px;white-space:pre-wrap;font-size:14px;color:#374151;line-height:1.7;">
        ${params.customMessage.replace(/\n/g, '<br />')}
      </div>

      <p style="margin:0;font-size:13px;color:#6b7280;text-align:center;">
        With gratitude,<br />
        <strong style="color:#111;">${params.organizerName}</strong><br />
        <span style="font-size:12px;color:#9ca3af;">${params.eventTitle}</span>
      </p>
    `
    await this.send(params.to, params.subject, content)
  }

  // ── 18. Cash gift received (platform payment) → notify organiser ─────────────

  async sendGiftReceived(params: GiftReceivedParams) {
    const content = `
      ${heading('You received a gift!')}
      ${subtext(`Hi <strong style="color:#111;">${params.organizerName}</strong>, a guest has sent you a cash gift for <strong>${params.eventTitle}</strong>.`)}

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
             style="background:#f0fdf4;border-radius:12px;border:1px solid #86efac;margin-bottom:16px;">
        <tr><td style="padding:16px 20px;">
          <p style="margin:0 0 2px;font-size:11px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">From</p>
          <p style="margin:0 0 12px;font-size:16px;font-weight:700;color:#111;">${params.gifterName}</p>
          <p style="margin:0 0 2px;font-size:11px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">Amount</p>
          <p style="margin:0;font-size:22px;font-weight:700;color:#15803d;">₦${params.amountNaira.toLocaleString('en-NG')}</p>
          ${params.message ? `<p style="margin:12px 0 0;font-size:13px;color:#374151;font-style:italic;">"${params.message}"</p>` : ''}
        </td></tr>
      </table>

      <p style="margin:0;font-size:13px;color:#6b7280;text-align:center;">
        The funds will be transferred to your registered bank account within 1–3 business days.
      </p>
    `
    await this.send(
      params.to,
      `₦${params.amountNaira.toLocaleString('en-NG')} gift from ${params.gifterName} — ${params.eventTitle}`,
      content,
    )
  }

  // ── 18. Direct transfer self-reported → ask organiser to confirm ─────────────

  async sendDirectTransferReported(params: DirectTransferReportedParams) {
    const content = `
      ${heading('Someone says they sent you a gift')}
      ${subtext(`Hi <strong style="color:#111;">${params.organizerName}</strong>, a guest has reported a direct bank transfer for <strong>${params.eventTitle}</strong>. Please confirm once you see it in your account.`)}

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
             style="background:#fffbeb;border-radius:12px;border:1px solid #fcd34d;margin-bottom:24px;">
        <tr><td style="padding:16px 20px;">
          <p style="margin:0 0 2px;font-size:11px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">From</p>
          <p style="margin:0 0 12px;font-size:16px;font-weight:700;color:#111;">${params.gifterName}</p>
          <p style="margin:0 0 2px;font-size:11px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">Amount they reported</p>
          <p style="margin:0;font-size:22px;font-weight:700;color:#92400e;">₦${params.amountNaira.toLocaleString('en-NG')}</p>
          ${params.message ? `<p style="margin:12px 0 0;font-size:13px;color:#374151;font-style:italic;">"${params.message}"</p>` : ''}
        </td></tr>
      </table>

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:16px;">
        <tr><td align="center">
          <a href="${params.confirmUrl}"
             style="display:inline-block;padding:12px 28px;background:#111;color:#fff;font-size:14px;font-weight:600;border-radius:10px;text-decoration:none;">
            Confirm I received this →
          </a>
        </td></tr>
      </table>

      <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
        Only confirm once you have verified the transfer in your bank account.
      </p>
    `
    await this.send(
      params.to,
      `Gift reported by ${params.gifterName} — please confirm receipt`,
      content,
    )
  }
}
