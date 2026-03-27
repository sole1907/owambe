import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { SupabaseService } from '../supabase/supabase.service'
import { CreateGiftItemDto, UpdateGiftItemDto } from './dto/gift-item.dto'

@Injectable()
export class GiftsService {
  constructor(
    private supabase: SupabaseService,
    private config: ConfigService,
  ) {}

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
      .select('id, title, description, price_estimate, is_purchased, purchased_by, sort_order')
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
        sort_order: dto.sortOrder ?? 0,
      })
      .select()
      .single()

    if (error) throw new InternalServerErrorException(error.message)
    return data
  }

  async updateItem(itemId: string, userId: string, dto: UpdateGiftItemDto) {
    const client = this.supabase.getClient()

    // Verify ownership via join
    const { data: item, error } = await client
      .from('gift_list_items')
      .select(
        `id, gift_list_id,
         gift_lists ( event_id, events ( user_id ) )`,
      )
      .eq('id', itemId)
      .single()

    if (error || !item) throw new NotFoundException('Item not found')
    const eventUserId = (item.gift_lists as any)?.events?.user_id
    if (eventUserId !== userId) throw new ForbiddenException()

    const updates: Record<string, unknown> = {}
    if (dto.title !== undefined) updates.title = dto.title
    if (dto.description !== undefined) updates.description = dto.description
    if (dto.priceEstimate !== undefined) updates.price_estimate = dto.priceEstimate
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
      .select(
        `id, gift_lists ( events ( user_id ) )`,
      )
      .eq('id', itemId)
      .single()

    if (error || !item) throw new NotFoundException('Item not found')
    const eventUserId = (item.gift_lists as any)?.events?.user_id
    if (eventUserId !== userId) throw new ForbiddenException()

    await client.from('gift_list_items').delete().eq('id', itemId)
    return { success: true }
  }

  async enableCashContribution(eventId: string, userId: string) {
    const event = await this.verifyEventOwnership(eventId, userId)
    const giftList = await this.getOrCreateGiftList(eventId)

    // If already enabled, return existing link
    if (giftList.cash_contribution_enabled && giftList.cash_contribution_link) {
      return {
        enabled: true,
        link: giftList.cash_contribution_link,
      }
    }

    const paystackKey = this.config.get<string>('paystackSecretKey')
    let paymentLink: string | null = null

    if (paystackKey) {
      try {
        const response = await fetch('https://api.paystack.co/page', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${paystackKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: `Contribute to ${event.title}`,
            description: `Cash gift contribution for ${event.title}`,
            // No amount = flexible / pay what you want
          }),
        })
        const json = await response.json() as { status: boolean; data?: { slug: string } }
        if (json.status && json.data?.slug) {
          paymentLink = `https://paystack.com/pay/${json.data.slug}`
        }
      } catch {
        // Non-fatal — fall through to manual link
      }
    }

    const client = this.supabase.getClient()
    await client
      .from('gift_lists')
      .update({
        cash_contribution_enabled: true,
        cash_contribution_link: paymentLink,
        updated_at: new Date().toISOString(),
      })
      .eq('id', giftList.id)

    return { enabled: true, link: paymentLink }
  }

  async disableCashContribution(eventId: string, userId: string) {
    await this.verifyEventOwnership(eventId, userId)
    const giftList = await this.getOrCreateGiftList(eventId)
    const client = this.supabase.getClient()

    await client
      .from('gift_lists')
      .update({
        cash_contribution_enabled: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', giftList.id)

    return { enabled: false }
  }
}
