import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { ConfigService } from '@nestjs/config'
import { SupabaseService } from '../supabase/supabase.service'
import { EmailService } from '../email/email.service'

@Injectable()
export class PayoutsService {
  private readonly logger = new Logger(PayoutsService.name)
  private readonly secretKey: string
  private readonly paystackBase = 'https://api.paystack.co'

  constructor(
    private supabase: SupabaseService,
    private email: EmailService,
    private config: ConfigService,
  ) {
    this.secretKey = this.config.get<string>('paystackSecretKey') ?? ''
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

  // ── Vendor earnings history ──────────────────────────────────────────────────

  async getEarnings(userId: string) {
    const vendorId = await this.getVendorId(userId)
    const client = this.supabase.getAdminClient()

    const { data, error } = await client
      .from('interest_payment_schedule')
      .select(
        `
        id, bucket, amount_kobo, scheduled_at, status,
        vendor_interests!inner (
          vendor_id,
          events (title, event_date, event_date_approximate, city)
        )
      `,
      )
      .eq('vendor_interests.vendor_id', vendorId)
      .order('scheduled_at', { ascending: false })

    if (error) throw new InternalServerErrorException(error.message)
    return data ?? []
  }

  // ── Bank list ────────────────────────────────────────────────────────────────

  async getBanks() {
    return this.paystackGet<{ name: string; code: string; slug: string }[]>(
      '/bank?currency=NGN&perPage=100',
    )
  }

  // ── Bank account management (vendor portal) ──────────────────────────────────

  private async getVendorId(userId: string): Promise<string> {
    const client = this.supabase.getAdminClient()
    const { data, error } = await client.from('vendors').select('id').eq('user_id', userId).single()
    if (error || !data) throw new InternalServerErrorException('Vendor not found for user')
    return data.id
  }

  async getBankAccount(userId: string) {
    const vendorId = await this.getVendorId(userId)
    const client = this.supabase.getAdminClient()
    const { data } = await client
      .from('vendor_bank_accounts')
      .select('account_number, bank_code, bank_name, account_name, updated_at')
      .eq('vendor_id', vendorId)
      .maybeSingle()
    return data
  }

  async verifyBankAccount(accountNumber: string, bankCode: string) {
    return this.paystackGet<{ account_name: string; account_number: string }>(
      `/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
    )
  }

  async saveBankAccount(
    userId: string,
    dto: { accountNumber: string; bankCode: string; bankName: string; accountName: string },
  ) {
    const vendorId = await this.getVendorId(userId)
    const client = this.supabase.getAdminClient()

    // Upsert bank account — clear recipient code so a fresh one is created on next transfer
    const { data, error } = await client
      .from('vendor_bank_accounts')
      .upsert(
        {
          vendor_id: vendorId,
          account_number: dto.accountNumber,
          bank_code: dto.bankCode,
          bank_name: dto.bankName,
          account_name: dto.accountName,
          paystack_recipient_code: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'vendor_id' },
      )
      .select()
      .single()

    if (error) throw new InternalServerErrorException('Failed to save bank account')
    return data
  }

  // ── Recipient management ─────────────────────────────────────────────────────

  private async ensureRecipient(vendorId: string): Promise<string | null> {
    const client = this.supabase.getAdminClient()

    const { data: account } = await client
      .from('vendor_bank_accounts')
      .select('id, account_number, bank_code, account_name, paystack_recipient_code')
      .eq('vendor_id', vendorId)
      .maybeSingle()

    if (!account) return null
    if (account.paystack_recipient_code) return account.paystack_recipient_code

    // Create recipient on Paystack
    const recipient = await this.paystackPost<{ recipient_code: string }>('/transferrecipient', {
      type: 'nuban',
      name: account.account_name,
      account_number: account.account_number,
      bank_code: account.bank_code,
      currency: 'NGN',
    })

    await client
      .from('vendor_bank_accounts')
      .update({ paystack_recipient_code: recipient.recipient_code })
      .eq('id', account.id)

    return recipient.recipient_code
  }

  // ── Release scheduler ────────────────────────────────────────────────────────

  @Cron('0 8 * * *') // 08:00 WAT daily
  async processDueReleases() {
    if (!this.secretKey) {
      this.logger.warn('Skipping payout cron — PAYSTACK_SECRET_KEY not set')
      return
    }

    const client = this.supabase.getAdminClient()
    const now = new Date()

    // ── 1. Process items due now ──────────────────────────────────────────────

    const { data: dueItems, error } = await client
      .from('interest_payment_schedule')
      .select(
        `
        id, bucket, amount_kobo, interest_id,
        vendor_interests!inner (
          vendor_id,
          vendors!inner (id, name, email, is_test_vendor),
          events!inner (title)
        )
      `,
      )
      .eq('status', 'scheduled')
      .lte('scheduled_at', now.toISOString())

    if (error) {
      this.logger.error('Failed to query due releases', error)
      return
    }

    if (dueItems?.length) {
      this.logger.log(`Processing ${dueItems.length} due payout(s)`)
      for (const item of dueItems as any[]) {
        try {
          await this.processScheduleItem(item)
        } catch (err) {
          this.logger.error(`Failed to process schedule item ${item.id}`, err)
        }
      }
    }

    // ── 2. Expire stale pending commitment payments ───────────────────────────

    await this.expireStalePayments(client, now)

    // ── 3. Send upcoming payment reminders (7-day and 3-day) ─────────────────

    await this.sendUpcomingReminders(client, now)
  }

  private async expireStalePayments(
    client: ReturnType<SupabaseService['getAdminClient']>,
    now: Date,
  ) {
    const hours = this.config.get<number>('commitmentFeeExpiryHours') ?? 48
    const cutoff = new Date(now.getTime() - hours * 3_600_000)

    const { data: stale } = await client
      .from('commitment_payments')
      .select(
        `id, interest_id, user_id,
         vendors (name),
         events (title),
         users!user_id (email, full_name)`,
      )
      .eq('status', 'pending')
      .lt('created_at', cutoff.toISOString())

    if (!stale?.length) return

    this.logger.log(`Expiring ${stale.length} stale commitment payment(s)`)
    for (const payment of stale as any[]) {
      try {
        await Promise.all([
          client.from('commitment_payments').update({ status: 'expired' }).eq('id', payment.id),
          client
            .from('vendor_interests')
            .update({ status: 'expired' })
            .eq('id', payment.interest_id),
        ])

        const organiserEmail = payment.users?.email
        if (organiserEmail) {
          await this.email.sendCommitmentFeeExpired({
            to: organiserEmail,
            organizerName: payment.users?.full_name || 'there',
            vendorName: payment.vendors?.name ?? 'the vendor',
            eventTitle: payment.events?.title ?? 'your event',
          })
        }
      } catch (err) {
        this.logger.error(`Failed to expire stale payment ${payment.id}`, err)
      }
    }
  }

  private async sendUpcomingReminders(
    client: ReturnType<SupabaseService['getAdminClient']>,
    now: Date,
  ) {
    const windows = [
      { days: 7, lo: 6, hi: 7 },
      { days: 3, lo: 2, hi: 3 },
    ]

    for (const { days, lo, hi } of windows) {
      const loDate = new Date(now.getTime() + lo * 24 * 60 * 60 * 1000)
      const hiDate = new Date(now.getTime() + hi * 24 * 60 * 60 * 1000)

      const { data: items } = await client
        .from('interest_payment_schedule')
        .select(
          `
          id, bucket, amount_kobo, scheduled_at,
          vendor_interests!inner (
            user_id,
            vendors!inner (name, email, users (email)),
            events!inner (title),
            users!user_id (email, full_name)
          )
        `,
        )
        .eq('status', 'scheduled')
        .gte('scheduled_at', loDate.toISOString())
        .lt('scheduled_at', hiDate.toISOString())

      if (!items?.length) continue

      for (const item of items as any[]) {
        const vi = item.vendor_interests
        try {
          // Vendor reminder — all buckets
          const vendor = vi.vendors
          const vendorEmail = vendor?.email || vendor?.users?.email || null
          if (vendorEmail) {
            await this.email.sendUpcomingPaymentReminder({
              to: vendorEmail,
              vendorName: vendor.name,
              bucket: item.bucket,
              amountNaira: item.amount_kobo / 100,
              eventTitle: vi.events.title,
              daysUntil: days,
              scheduledAt: item.scheduled_at,
            })
          }
        } catch (err) {
          this.logger.error(`Failed to send ${days}-day vendor reminder for item ${item.id}`, err)
        }

        // Organiser reminder — materials and balance only (commitment is already paid)
        if (item.bucket === 'commitment') continue
        try {
          const organiser = vi['users!user_id'] ?? vi.users
          const organiserEmail = organiser?.email
          if (organiserEmail) {
            await this.email.sendUpcomingPaymentReminderToOrganiser({
              to: organiserEmail,
              organizerName: organiser.full_name || 'there',
              vendorName: vi.vendors?.name ?? 'your vendor',
              eventTitle: vi.events.title,
              bucket: item.bucket,
              amountNaira: item.amount_kobo / 100,
              daysUntil: days,
              scheduledAt: item.scheduled_at,
            })
          }
        } catch (err) {
          this.logger.error(
            `Failed to send ${days}-day organiser reminder for item ${item.id}`,
            err,
          )
        }
      }
    }
  }

  async processScheduleItem(item: {
    id: string
    bucket: string
    amount_kobo: number
    interest_id: string
    vendor_interests: {
      vendor_id: string
      vendors: { id: string; name: string; email: string; is_test_vendor: boolean }
      events: { title: string }
    }
  }) {
    const client = this.supabase.getAdminClient()
    const vi = item.vendor_interests
    const vendor = vi.vendors

    // Mark as processing to prevent duplicate attempts
    await client
      .from('interest_payment_schedule')
      .update({ status: 'processing' })
      .eq('id', item.id)

    const recipientCode = await this.ensureRecipient(vendor.id)
    if (!recipientCode) {
      await client
        .from('interest_payment_schedule')
        .update({ status: 'scheduled', transfer_error: 'No bank account on file' })
        .eq('id', item.id)
      this.logger.warn(`Skipping payout for vendor ${vendor.id} — no bank account`)
      return
    }

    const bucketLabel =
      item.bucket === 'commitment'
        ? 'Commitment fee'
        : item.bucket === 'materials'
          ? 'Materials fee'
          : 'Balance payment'

    const reason = `${bucketLabel} – ${vi.events.title} (Owambe)`

    const transfer = await this.paystackPost<{
      transfer_code: string
      status: string
    }>('/transfer', {
      source: 'balance',
      amount: item.amount_kobo,
      recipient: recipientCode,
      reason,
      reference: `owambe-payout-${item.id}`,
    })

    await client
      .from('interest_payment_schedule')
      .update({ paystack_transfer_code: transfer.transfer_code })
      .eq('id', item.id)

    // In test mode Paystack may resolve the transfer immediately
    if (transfer.status === 'success') {
      await this.markReleased(item.id, vendor, item.bucket, item.amount_kobo, vi.events.title)
    }
    // Otherwise stay as 'processing' until the webhook fires
  }

  // ── Transfer webhook handler ─────────────────────────────────────────────────

  async handleTransferWebhook(event: string, data: { transfer_code: string; status: string }) {
    const client = this.supabase.getAdminClient()

    const { data: item } = await client
      .from('interest_payment_schedule')
      .select(
        `
        id, bucket, amount_kobo,
        vendor_interests!inner (
          vendor_id,
          vendors!inner (id, name, email),
          events!inner (title)
        )
      `,
      )
      .eq('paystack_transfer_code', data.transfer_code)
      .maybeSingle()

    if (!item) {
      this.logger.warn(`No schedule item for transfer_code ${data.transfer_code}`)
      return
    }

    const vi = item.vendor_interests as any

    if (event === 'transfer.success') {
      await this.markReleased(item.id, vi.vendors, item.bucket, item.amount_kobo, vi.events.title)
    } else if (event === 'transfer.failed' || event === 'transfer.reversed') {
      await client
        .from('interest_payment_schedule')
        .update({
          status: 'scheduled',
          paystack_transfer_code: null,
          transfer_error: `Transfer ${event} — will retry`,
        })
        .eq('id', item.id)
      this.logger.warn(`Transfer ${event} for item ${item.id} — reset to scheduled`)
    }
  }

  private async markReleased(
    itemId: string,
    vendor: { name: string; email: string },
    bucket: string,
    amountKobo: number,
    eventTitle: string,
  ) {
    const client = this.supabase.getAdminClient()

    await client
      .from('interest_payment_schedule')
      .update({ status: 'released', released_at: new Date().toISOString() })
      .eq('id', itemId)

    this.logger.log(`Released ${amountKobo / 100} NGN (${bucket}) to ${vendor.name}`)

    if (vendor.email) {
      await this.email.sendPaymentReleased({
        to: vendor.email,
        vendorName: vendor.name,
        bucket,
        amountNaira: amountKobo / 100,
        eventTitle,
      })
    }
  }
}
