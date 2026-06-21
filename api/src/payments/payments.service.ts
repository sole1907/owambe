import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as crypto from 'crypto'
import { SupabaseService } from '../supabase/supabase.service'
import { EmailService } from '../email/email.service'

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name)
  private readonly secretKey: string
  private readonly paystackBase = 'https://api.paystack.co'

  constructor(
    private supabase: SupabaseService,
    private email: EmailService,
    private config: ConfigService,
  ) {
    this.secretKey = this.config.get<string>('paystackSecretKey') ?? ''
    if (!this.secretKey) {
      this.logger.warn('PAYSTACK_SECRET_KEY not set — payments will not work')
    }
  }

  private async paystackPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const res = await fetch(`${this.paystackBase}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    const json = (await res.json()) as { status: boolean; message: string; data: T }
    if (!json.status) throw new InternalServerErrorException(json.message)
    return json.data
  }

  private async paystackGet<T>(path: string): Promise<T> {
    const res = await fetch(`${this.paystackBase}${path}`, {
      headers: { Authorization: `Bearer ${this.secretKey}` },
    })
    const json = (await res.json()) as { status: boolean; message: string; data: T }
    if (!json.status) throw new InternalServerErrorException(json.message)
    return json.data
  }

  // ── Calculate the commitment amount for an interest ──────────────────────────

  private calculateCommitmentKobo(agreedPrice: number, commitmentPct: number): number {
    // agreedPrice is in Naira, convert result to kobo (× 100)
    return Math.round((agreedPrice * commitmentPct) / 100) * 100
  }

  // ── Initialize a commitment fee payment ──────────────────────────────────────

  async initializePayment(userId: string, interestId: string) {
    const client = this.supabase.getAdminClient()

    // Get interest + vendor + event + user details
    const { data: interest, error: interestError } = await client
      .from('vendor_interests')
      .select(
        `
        id, status, event_id, vendor_id,
        agreed_price, offered_price,
        vendors (
          id, name, commitment_fee_percentage,
          vendor_categories (name)
        ),
        events (id, title, event_date, event_date_approximate, city)
      `,
      )
      .eq('id', interestId)
      .eq('user_id', userId)
      .single()

    if (interestError || !interest) throw new NotFoundException('Interest not found')

    if (interest.status !== 'available') {
      throw new BadRequestException(
        `Cannot pay for this vendor — their status is "${interest.status}". Only available vendors can be committed.`,
      )
    }

    // Check for existing pending/success payment
    const { data: existingPayment } = await client
      .from('commitment_payments')
      .select('id, status, paystack_reference, paystack_access_code, amount_kobo, commitment_pct')
      .eq('interest_id', interestId)
      .in('status', ['pending', 'success'])
      .single()

    if (existingPayment?.status === 'success') {
      throw new BadRequestException('Commitment fee has already been paid for this vendor.')
    }

    // Reuse pending payment if one exists (prevents duplicate Paystack txns)
    if (existingPayment?.status === 'pending' && existingPayment.paystack_access_code) {
      return {
        reference: existingPayment.paystack_reference,
        access_code: existingPayment.paystack_access_code,
        amount_kobo: existingPayment.amount_kobo,
        commitment_pct: existingPayment.commitment_pct,
      }
    }

    const vendor = interest.vendors as any
    const event = interest.events as any

    // Use agreed_price (set after negotiation) or fall back to offered_price
    const agreedPrice = (interest as any).agreed_price ?? (interest as any).offered_price
    if (!agreedPrice) {
      throw new BadRequestException(
        'No agreed price on this booking. The vendor must respond with a price first.',
      )
    }

    const commitmentPct = vendor.commitment_fee_percentage
    const amountKobo = this.calculateCommitmentKobo(agreedPrice, commitmentPct)

    // Get user email
    const { data: user } = await client
      .from('users')
      .select('email, full_name')
      .eq('id', userId)
      .single()

    if (!user) throw new NotFoundException('User not found')

    const reference = `owambe-${interestId}-${Date.now()}`
    const appUrl = this.config.get<string>('appUrl') ?? 'http://localhost:3000'

    // Initialize with Paystack
    const paystackData = await this.paystackPost<{
      authorization_url: string
      access_code: string
      reference: string
    }>('/transaction/initialize', {
      email: user.email,
      amount: amountKobo,
      reference,
      currency: 'NGN',
      callback_url: `${appUrl}/payment/callback`,
      metadata: {
        interest_id: interestId,
        event_id: interest.event_id,
        vendor_id: interest.vendor_id,
        user_id: userId,
        vendor_name: vendor.name,
        event_title: event.title,
      },
    })

    // Store pending payment record
    await client.from('commitment_payments').insert({
      interest_id: interestId,
      event_id: interest.event_id,
      vendor_id: interest.vendor_id,
      user_id: userId,
      amount_kobo: amountKobo,
      commitment_pct: commitmentPct,
      paystack_reference: paystackData.reference,
      paystack_access_code: paystackData.access_code,
      status: 'pending',
    })

    return {
      reference: paystackData.reference,
      access_code: paystackData.access_code,
      authorization_url: paystackData.authorization_url,
      amount_kobo: amountKobo,
      commitment_pct: commitmentPct,
    }
  }

  // ── Verify + confirm a payment ───────────────────────────────────────────────

  async verifyPayment(userId: string, reference: string) {
    const client = this.supabase.getAdminClient()

    const { data: payment, error } = await client
      .from('commitment_payments')
      .select('*, vendor_interests (id)')
      .eq('paystack_reference', reference)
      .eq('user_id', userId)
      .single()

    if (error || !payment) throw new NotFoundException('Payment not found')

    if (payment.status === 'success') {
      return { status: 'success', alreadyConfirmed: true }
    }

    await this.confirmPayment(reference)
    return { status: 'success' }
  }

  // ── Shared confirm logic (used by verify + webhook) ──────────────────────────

  async confirmPayment(reference: string) {
    const client = this.supabase.getAdminClient()

    // Verify with Paystack
    const txn = await this.paystackGet<{
      status: string
      reference: string
      amount: number
      paid_at: string
      metadata: Record<string, string>
    }>(`/transaction/verify/${reference}`)

    if (txn.status !== 'success') {
      throw new BadRequestException(`Payment status is "${txn.status}", not success.`)
    }

    // Get payment record
    const { data: payment } = await client
      .from('commitment_payments')
      .select('id, status, interest_id, event_id, vendor_id, user_id, amount_kobo, commitment_pct')
      .eq('paystack_reference', reference)
      .single()

    if (!payment) throw new NotFoundException('Payment record not found for this reference')
    if (payment.status === 'success') return // idempotent

    // Mark payment as success
    await client
      .from('commitment_payments')
      .update({ status: 'success', paid_at: txn.paid_at })
      .eq('id', payment.id)

    // Snapshot contract amount in kobo
    const contractKobo = payment.amount_kobo / (payment.commitment_pct / 100)
    await client
      .from('vendor_interests')
      .update({ status: 'committed', total_contract_kobo: Math.round(contractKobo) })
      .eq('id', payment.interest_id)

    // Build payment release schedule from vendor's payment structure
    await this.createPaymentSchedule(
      client,
      payment.interest_id,
      payment.vendor_id,
      Math.round(contractKobo),
    )

    // Get vendor + event + user info for emails
    const { data: vendor } = await client
      .from('vendors')
      .select('name, email')
      .eq('id', payment.vendor_id)
      .single()

    const { data: event } = await client
      .from('events')
      .select('title, event_date, event_date_approximate, city')
      .eq('id', payment.event_id)
      .single()

    const { data: user } = await client
      .from('users')
      .select('email, full_name')
      .eq('id', payment.user_id)
      .single()

    const eventDate = event?.event_date ?? event?.event_date_approximate ?? 'TBC'
    const amountNaira = payment.amount_kobo / 100

    // Send confirmation to organiser
    if (user?.email) {
      await this.email.sendCommitmentConfirmedToOrganiser({
        to: user.email,
        organizerName: user.full_name || 'there',
        vendorName: vendor?.name ?? 'Vendor',
        eventTitle: event?.title ?? 'your event',
        eventDate,
        amountPaid: amountNaira,
      })
    }

    // Send notification to vendor
    if (vendor?.email) {
      await this.email.sendCommitmentConfirmedToVendor({
        to: vendor.email,
        vendorName: vendor.name,
        organizerName: user?.full_name || 'An organiser',
        eventTitle: event?.title ?? 'an event',
        eventDate,
        amountHeld: amountNaira,
      })
    }
  }

  // ── Paystack webhook ─────────────────────────────────────────────────────────

  async handleWebhook(rawBody: Buffer, signature: string) {
    const hash = crypto.createHmac('sha512', this.secretKey).update(rawBody).digest('hex')

    if (hash !== signature) {
      throw new UnauthorizedException('Invalid Paystack webhook signature')
    }

    const event = JSON.parse(rawBody.toString()) as {
      event: string
      data: { reference: string; status: string }
    }

    if (event.event === 'charge.success') {
      try {
        await this.confirmPayment(event.data.reference)
      } catch (err) {
        this.logger.error(`Webhook confirmPayment failed for ${event.data.reference}`, err)
      }
    }
  }

  // ── Build release schedule when booking is committed ─────────────────────────

  private async createPaymentSchedule(
    client: ReturnType<SupabaseService['getAdminClient']>,
    interestId: string,
    vendorId: string,
    totalKobo: number,
  ) {
    // Get vendor payment structure + event date
    const [structureRes, interestRes] = await Promise.all([
      client.from('vendor_payment_structures').select('*').eq('vendor_id', vendorId).single(),
      client.from('vendor_interests').select('event_date').eq('id', interestId).single(),
    ])

    // Fall back to legacy commitment_fee_percentage if no structure configured
    if (!structureRes.data || !structureRes.data.is_active) return

    const s = structureRes.data
    const eventDate = interestRes.data?.event_date ? new Date(interestRes.data.event_date) : null

    const buckets: { bucket: string; pct: number; scheduled_at: Date }[] = []

    if (eventDate) {
      const commitmentRelease = new Date(eventDate)
      commitmentRelease.setDate(commitmentRelease.getDate() - s.commitment_release_days)
      buckets.push({ bucket: 'commitment', pct: s.commitment_pct, scheduled_at: commitmentRelease })

      if (s.materials_pct > 0) {
        const materialsRelease = new Date(eventDate)
        materialsRelease.setDate(materialsRelease.getDate() - s.materials_release_days)
        buckets.push({ bucket: 'materials', pct: s.materials_pct, scheduled_at: materialsRelease })
      }

      const balanceRelease = new Date(eventDate)
      balanceRelease.setHours(balanceRelease.getHours() + s.balance_release_hours)
      buckets.push({ bucket: 'balance', pct: s.balance_pct, scheduled_at: balanceRelease })
    }

    if (buckets.length === 0) return

    const rows = buckets.map((b) => ({
      interest_id: interestId,
      bucket: b.bucket,
      amount_kobo: Math.round((totalKobo * b.pct) / 100),
      pct_snapshot: b.pct,
      scheduled_at: b.scheduled_at.toISOString(),
      status: 'scheduled',
    }))

    await client.from('interest_payment_schedule').insert(rows)
  }

  // ── Get payment status for a reference ───────────────────────────────────────

  async getPaymentByReference(reference: string) {
    const client = this.supabase.getAdminClient()

    const { data, error } = await client
      .from('commitment_payments')
      .select(
        `
        id, status, amount_kobo, commitment_pct, paid_at, created_at,
        vendors (name),
        events (title, city)
      `,
      )
      .eq('paystack_reference', reference)
      .single()

    if (error || !data) throw new NotFoundException('Payment not found')
    return data
  }
}
