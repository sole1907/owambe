import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { SupabaseService } from '../supabase/supabase.service'
import { EmailService } from '../email/email.service'
import {
  ClaimItemDto,
  CreateGiftItemDto,
  InitGiftPaymentDto,
  ReportDirectTransferDto,
  UpdateGiftItemDto,
  UpdateGiftSettingsDto,
} from './dto/gift-item.dto'

@Injectable()
export class GiftsService {
  private readonly logger = new Logger(GiftsService.name)
  private readonly paystackBase = 'https://api.paystack.co'
  private readonly secretKey: string

  constructor(
    private supabase: SupabaseService,
    private config: ConfigService,
    private email: EmailService,
  ) {
    this.secretKey = this.config.get<string>('paystackSecretKey') ?? ''
  }

  // ── Paystack helpers ─────────────────────────────────────────────────────────

  private async paystackGet<T>(path: string): Promise<T> {
    const res = await fetch(`${this.paystackBase}${path}`, {
      headers: { Authorization: `Bearer ${this.secretKey}` },
    })
    const json = (await res.json()) as { status: boolean; message: string; data: T }
    if (!json.status) throw new InternalServerErrorException(json.message)
    return json.data
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

  // ── Fee calculator ───────────────────────────────────────────────────────────

  calculateGiftCharge(giftAmountNaira: number): { chargeNaira: number; feeNaira: number } {
    // Paystack charges 1.5% + ₦100 flat. We also keep ₦100 platform fee.
    // charge * 0.985 - 100 = giftAmount + 100  →  charge = (giftAmount + 200) / 0.985
    const chargeNaira = Math.ceil((giftAmountNaira + 200) / 0.985)
    return { chargeNaira, feeNaira: chargeNaira - giftAmountNaira }
  }

  // ── Admin gift-list helper ───────────────────────────────────────────────────

  private async getOrCreateGiftListAdmin(eventId: string) {
    const client = this.supabase.getAdminClient()
    const { data: existing } = await client
      .from('gift_lists')
      .select('*')
      .eq('event_id', eventId)
      .single()
    if (existing) return existing

    const { data: created, error } = await client
      .from('gift_lists')
      .insert({ event_id: eventId })
      .select()
      .single()
    if (error) throw new InternalServerErrorException(error.message)
    return created
  }

  // ── Public: gift list page data ──────────────────────────────────────────────

  async getGiftListPublic(eventId: string) {
    const client = this.supabase.getAdminClient()

    const { data: event, error: eventError } = await client
      .from('events')
      .select('id, title, event_date, event_date_approximate, city, event_type')
      .eq('id', eventId)
      .single()
    if (eventError || !event) throw new NotFoundException('Event not found')

    const { data: giftList } = await client
      .from('gift_lists')
      .select('id, cash_contribution_enabled, bank_account_name, bank_account_number, bank_name')
      .eq('event_id', eventId)
      .single()

    if (!giftList) {
      return { event, items: [], cashContributionEnabled: false, bankAccount: null }
    }

    const { data: items, error: itemsError } = await client
      .from('gift_list_items')
      .select(
        'id, title, description, price_estimate, store_url, status, claimed_by_name, sort_order',
      )
      .eq('gift_list_id', giftList.id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    if (itemsError) throw new InternalServerErrorException(itemsError.message)

    const bankAccount = giftList.bank_account_number
      ? {
          accountName: giftList.bank_account_name,
          accountNumber: giftList.bank_account_number,
          bankName: giftList.bank_name,
        }
      : null

    return {
      event,
      items: items ?? [],
      cashContributionEnabled: giftList.cash_contribution_enabled,
      bankAccount,
    }
  }

  // ── Public: claim a wishlist item ────────────────────────────────────────────

  async claimItem(itemId: string, dto: ClaimItemDto) {
    const client = this.supabase.getAdminClient()
    const { data: item } = await client
      .from('gift_list_items')
      .select('id, status')
      .eq('id', itemId)
      .single()

    if (!item) throw new NotFoundException('Item not found')
    if (item.status === 'claimed') throw new ConflictException('This item has already been claimed')

    const { data: updated, error } = await client
      .from('gift_list_items')
      .update({
        status: 'claimed',
        claimed_by_name: dto.claimerName,
        updated_at: new Date().toISOString(),
      })
      .eq('id', itemId)
      .eq('status', 'available')
      .select()
      .single()

    if (error || !updated) throw new ConflictException('Item was just claimed by someone else')
    return updated
  }

  // ── Public: initialize Paystack inline gift payment ──────────────────────────

  async initializeGiftPayment(eventId: string, dto: InitGiftPaymentDto) {
    if (!dto.giftAmountNaira || dto.giftAmountNaira < 100) {
      throw new BadRequestException('Minimum gift amount is ₦100')
    }

    const client = this.supabase.getAdminClient()
    const giftList = await this.getOrCreateGiftListAdmin(eventId)

    const { chargeNaira, feeNaira } = this.calculateGiftCharge(dto.giftAmountNaira)
    const chargeKobo = chargeNaira * 100
    const giftAmountKobo = dto.giftAmountNaira * 100

    const reference = `owambe-gift-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    const { error } = await client.from('event_gift_payments').insert({
      gift_list_id: giftList.id,
      event_id: eventId,
      gifter_name: dto.gifterName,
      gifter_email: dto.gifterEmail ?? null,
      message: dto.message ?? null,
      gift_amount_kobo: giftAmountKobo,
      charge_kobo: chargeKobo,
      paystack_reference: reference,
      status: 'pending',
    })

    if (error) throw new InternalServerErrorException(error.message)

    const publicKey = this.config.get<string>('paystackPublicKey') ?? ''

    return {
      publicKey,
      email: dto.gifterEmail ?? 'gift@owambe.app',
      amountKobo: chargeKobo,
      reference,
      giftAmountNaira: dto.giftAmountNaira,
      chargeNaira,
      feeNaira,
      metadata: { gifter_name: dto.gifterName, gift_type: 'cash_gift', event_id: eventId },
    }
  }

  // ── Public: verify Paystack payment and trigger transfer ─────────────────────

  async verifyGiftPayment(reference: string) {
    const client = this.supabase.getAdminClient()

    const { data: payment, error: payErr } = await client
      .from('event_gift_payments')
      .select('id, gift_list_id, event_id, gifter_name, message, gift_amount_kobo, status')
      .eq('paystack_reference', reference)
      .single()

    if (payErr || !payment) throw new NotFoundException('Payment record not found')
    if (payment.status === 'paid' || payment.status === 'transfer_initiated') {
      return { success: true, alreadyProcessed: true }
    }

    const verification = await this.paystackGet<{ status: string }>(
      `/transaction/verify/${reference}`,
    )

    if (verification.status !== 'success') {
      await client
        .from('event_gift_payments')
        .update({ status: 'failed', updated_at: new Date().toISOString() })
        .eq('id', payment.id)
      throw new BadRequestException('Payment not successful')
    }

    await client
      .from('event_gift_payments')
      .update({ status: 'paid', updated_at: new Date().toISOString() })
      .eq('id', payment.id)

    const { data: giftList } = await client
      .from('gift_lists')
      .select(
        `id, bank_account_name, bank_account_number, bank_code, paystack_recipient_code,
               events ( title, user_id, users!user_id ( email, full_name ) )`,
      )
      .eq('id', payment.gift_list_id)
      .single()

    const eventData = (giftList as any)?.events
    const organiser = eventData?.['users!user_id'] ?? eventData?.users

    if (organiser?.email) {
      this.email
        .sendGiftReceived({
          to: organiser.email,
          organizerName: organiser.full_name || 'there',
          gifterName: payment.gifter_name,
          amountNaira: payment.gift_amount_kobo / 100,
          message: payment.message,
          eventTitle: eventData?.title ?? 'your event',
        })
        .catch((err) => this.logger.error('Failed to send gift received email', err))
    }

    if (giftList?.bank_account_number && this.secretKey) {
      this.initiateGiftTransfer(client, payment, giftList as any).catch((err) =>
        this.logger.error(`Failed to initiate gift transfer for payment ${payment.id}`, err),
      )
    }

    return { success: true }
  }

  private async initiateGiftTransfer(
    client: ReturnType<SupabaseService['getAdminClient']>,
    payment: { id: string; gift_amount_kobo: number },
    giftList: {
      id: string
      bank_account_name: string | null
      bank_account_number: string | null
      bank_code: string | null
      paystack_recipient_code: string | null
    },
  ) {
    let recipientCode = giftList.paystack_recipient_code

    if (!recipientCode) {
      const recipient = await this.paystackPost<{ recipient_code: string }>('/transferrecipient', {
        type: 'nuban',
        name: giftList.bank_account_name,
        account_number: giftList.bank_account_number,
        bank_code: giftList.bank_code,
        currency: 'NGN',
      })
      recipientCode = recipient.recipient_code
      await client
        .from('gift_lists')
        .update({ paystack_recipient_code: recipientCode })
        .eq('id', giftList.id)
    }

    const transfer = await this.paystackPost<{ transfer_code: string }>('/transfer', {
      source: 'balance',
      amount: payment.gift_amount_kobo,
      recipient: recipientCode,
      reason: 'Cash gift via Owambe',
      reference: `owambe-gift-transfer-${payment.id}`,
    })

    await client
      .from('event_gift_payments')
      .update({
        paystack_transfer_code: transfer.transfer_code,
        status: 'transfer_initiated',
        updated_at: new Date().toISOString(),
      })
      .eq('id', payment.id)
  }

  // ── Public: self-report a direct bank transfer ───────────────────────────────

  async reportDirectTransfer(eventId: string, dto: ReportDirectTransferDto) {
    if (!dto.amountNaira || dto.amountNaira < 1) {
      throw new BadRequestException('Amount must be at least ₦1')
    }

    const client = this.supabase.getAdminClient()
    const giftList = await this.getOrCreateGiftListAdmin(eventId)

    const { data: transfer, error } = await client
      .from('event_gift_direct_transfers')
      .insert({
        gift_list_id: giftList.id,
        event_id: eventId,
        gifter_name: dto.gifterName,
        amount_naira: dto.amountNaira,
        message: dto.message ?? null,
        status: 'pending',
      })
      .select()
      .single()

    if (error) throw new InternalServerErrorException(error.message)

    const { data: eventData } = await client
      .from('events')
      .select('title, user_id, users!user_id ( email, full_name )')
      .eq('id', eventId)
      .single()

    const organiser = (eventData as any)?.['users!user_id'] ?? (eventData as any)?.users
    const appUrl = this.config.get<string>('appUrl') ?? 'http://localhost:3000'
    const confirmUrl = `${appUrl}/dashboard/events/${eventId}/gifts`

    if (organiser?.email) {
      this.email
        .sendDirectTransferReported({
          to: organiser.email,
          organizerName: organiser.full_name || 'there',
          gifterName: dto.gifterName,
          amountNaira: dto.amountNaira,
          message: dto.message,
          eventTitle: (eventData as any)?.title ?? 'your event',
          confirmUrl,
        })
        .catch((err) => this.logger.error('Failed to send direct transfer reported email', err))
    }

    return { success: true, transferId: transfer.id }
  }

  // ── Protected: confirm a direct transfer (organiser) ─────────────────────────

  async confirmDirectTransfer(transferId: string, userId: string) {
    const client = this.supabase.getAdminClient()

    const { data: transfer, error } = await client
      .from('event_gift_direct_transfers')
      .select('id, status, event_id, events ( user_id )')
      .eq('id', transferId)
      .single()

    if (error || !transfer) throw new NotFoundException('Transfer not found')
    if ((transfer.events as any)?.user_id !== userId) throw new ForbiddenException()
    if (transfer.status === 'confirmed') return { success: true }

    const { error: updateError } = await client
      .from('event_gift_direct_transfers')
      .update({
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', transferId)

    if (updateError) throw new InternalServerErrorException(updateError.message)
    return { success: true }
  }

  // ── Protected: gift settings (organiser) ─────────────────────────────────────

  async updateGiftSettings(eventId: string, userId: string, dto: UpdateGiftSettingsDto) {
    await this.verifyEventOwnership(eventId, userId)
    const giftList = await this.getOrCreateGiftList(eventId)
    const client = this.supabase.getClient()

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (dto.bankAccountName !== undefined) updates.bank_account_name = dto.bankAccountName
    if (dto.bankAccountNumber !== undefined) updates.bank_account_number = dto.bankAccountNumber
    if (dto.bankName !== undefined) updates.bank_name = dto.bankName
    if (dto.bankCode !== undefined) updates.bank_code = dto.bankCode
    if (dto.cashContributionEnabled !== undefined)
      updates.cash_contribution_enabled = dto.cashContributionEnabled
    if (dto.bankAccountNumber !== undefined) updates.paystack_recipient_code = null

    const { data, error } = await client
      .from('gift_lists')
      .update(updates)
      .eq('id', giftList.id)
      .select(
        'id, cash_contribution_enabled, bank_account_name, bank_account_number, bank_name, bank_code',
      )
      .single()

    if (error) throw new InternalServerErrorException(error.message)
    return data
  }

  // ── Protected: gift dashboard (organiser) ────────────────────────────────────

  async getGiftDashboard(eventId: string, userId: string) {
    await this.verifyEventOwnership(eventId, userId)
    const giftList = await this.getOrCreateGiftList(eventId)
    const client = this.supabase.getAdminClient()

    const [paymentsResult, transfersResult, itemsResult] = await Promise.all([
      client
        .from('event_gift_payments')
        .select(
          'id, gifter_name, gifter_email, message, gift_amount_kobo, charge_kobo, status, created_at',
        )
        .eq('gift_list_id', giftList.id)
        .order('created_at', { ascending: false }),
      client
        .from('event_gift_direct_transfers')
        .select('id, gifter_name, amount_naira, message, status, confirmed_at, created_at')
        .eq('gift_list_id', giftList.id)
        .order('created_at', { ascending: false }),
      client
        .from('gift_list_items')
        .select(
          'id, title, description, price_estimate, store_url, status, claimed_by_name, sort_order',
        )
        .eq('gift_list_id', giftList.id)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true }),
    ])

    return {
      settings: {
        cashContributionEnabled: giftList.cash_contribution_enabled,
        bankAccountName: giftList.bank_account_name,
        bankAccountNumber: giftList.bank_account_number,
        bankName: giftList.bank_name,
        bankCode: giftList.bank_code,
      },
      payments: paymentsResult.data ?? [],
      directTransfers: transfersResult.data ?? [],
      wishlistItems: itemsResult.data ?? [],
    }
  }

  private async verifyEventOwnership(eventId: string, userId: string) {
    const client = this.supabase.getClient()
    const { data, error } = await client
      .from('events')
      .select('id, title')
      .eq('id', eventId)
      .eq('user_id', userId)
      .single()
    if (error || !data) throw new NotFoundException('Event not found')
    return data
  }

  private async getOrCreateGiftList(eventId: string) {
    const client = this.supabase.getClient()
    const { data: existing } = await client
      .from('gift_lists')
      .select('*')
      .eq('event_id', eventId)
      .single()
    if (existing) return existing

    const { data: created, error } = await client
      .from('gift_lists')
      .insert({ event_id: eventId })
      .select()
      .single()
    if (error) throw new InternalServerErrorException(error.message)
    return created
  }

  async getGiftList(eventId: string) {
    const client = this.supabase.getClient()

    // Fetch the event (public info)
    const { data: event, error: eventError } = await client
      .from('events')
      .select('id, title, event_date, event_date_approximate, city, event_type')
      .eq('id', eventId)
      .single()
    if (eventError || !event) throw new NotFoundException('Event not found')

    const { data: giftList } = await client
      .from('gift_lists')
      .select('id, cash_contribution_enabled, cash_contribution_link')
      .eq('event_id', eventId)
      .single()

    if (!giftList) {
      return { event, items: [], cashContributionEnabled: false, cashContributionLink: null }
    }

    const { data: items, error: itemsError } = await client
      .from('gift_list_items')
      .select(
        'id, title, description, price_estimate, store_url, is_purchased, purchased_by, sort_order',
      )
      .eq('gift_list_id', giftList.id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    if (itemsError) throw new InternalServerErrorException(itemsError.message)

    return {
      event,
      items: items ?? [],
      cashContributionEnabled: giftList.cash_contribution_enabled,
      cashContributionLink: giftList.cash_contribution_link,
    }
  }

  // ── Protected: wishlist item CRUD ────────────────────────────────────────────

  async addItem(eventId: string, userId: string, dto: CreateGiftItemDto) {
    await this.verifyEventOwnership(eventId, userId)
    const giftList = await this.getOrCreateGiftList(eventId)
    const client = this.supabase.getClient()

    const { data, error } = await client
      .from('gift_list_items')
      .insert({
        gift_list_id: giftList.id,
        title: dto.title,
        description: dto.description ?? null,
        price_estimate: dto.priceEstimate ?? null,
        store_url: dto.storeUrl ?? null,
        sort_order: dto.sortOrder ?? 0,
      })
      .select()
      .single()

    if (error) throw new InternalServerErrorException(error.message)
    return data
  }

  async updateItem(itemId: string, userId: string, dto: UpdateGiftItemDto) {
    const client = this.supabase.getClient()

    const { data: item, error } = await client
      .from('gift_list_items')
      .select(`id, gift_list_id, gift_lists ( event_id, events ( user_id ) )`)
      .eq('id', itemId)
      .single()

    if (error || !item) throw new NotFoundException('Item not found')
    const eventUserId = (item.gift_lists as any)?.events?.user_id
    if (eventUserId !== userId) throw new ForbiddenException()

    const updates: Record<string, unknown> = {}
    if (dto.title !== undefined) updates.title = dto.title
    if (dto.description !== undefined) updates.description = dto.description
    if (dto.priceEstimate !== undefined) updates.price_estimate = dto.priceEstimate
    if (dto.storeUrl !== undefined) updates.store_url = dto.storeUrl
    if (dto.isPurchased !== undefined) updates.is_purchased = dto.isPurchased
    if (dto.purchasedBy !== undefined) updates.purchased_by = dto.purchasedBy
    if (dto.sortOrder !== undefined) updates.sort_order = dto.sortOrder
    updates.updated_at = new Date().toISOString()

    const { data: updated, error: updateError } = await client
      .from('gift_list_items')
      .update(updates)
      .eq('id', itemId)
      .select()
      .single()

    if (updateError) throw new InternalServerErrorException(updateError.message)
    return updated
  }

  async deleteItem(itemId: string, userId: string) {
    const client = this.supabase.getClient()

    const { data: item, error } = await client
      .from('gift_list_items')
      .select(`id, gift_lists ( events ( user_id ) )`)
      .eq('id', itemId)
      .single()

    if (error || !item) throw new NotFoundException('Item not found')
    const eventUserId = (item.gift_lists as any)?.events?.user_id
    if (eventUserId !== userId) throw new ForbiddenException()

    await client.from('gift_list_items').delete().eq('id', itemId)
    return { success: true }
  }
}
