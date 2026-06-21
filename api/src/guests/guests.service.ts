import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common'
import { SupabaseService } from '../supabase/supabase.service'
import { InvitesService } from '../invites/invites.service'
import { CreateGuestDto } from './dto/create-guest.dto'
import { UpdateGuestDto } from './dto/update-guest.dto'
import { PostHogService } from '../analytics/posthog.service'
import { randomUUID } from 'crypto'

@Injectable()
export class GuestsService {
  constructor(
    private supabase: SupabaseService,
    private invites: InvitesService,
    private posthog: PostHogService,
  ) {}

  private async getGuestListId(eventId: string, _userId: string): Promise<string> {
    const client = this.supabase.getClient()

    // Verify event belongs to user and get guest list id
    const { data, error } = await client
      .from('guest_lists')
      .select('id, events!inner(user_id)')
      .eq('event_id', eventId)
      .single()

    if (error || !data) throw new NotFoundException('Guest list not found')
    return data.id
  }

  async getGuests(eventId: string, userId: string) {
    const client = this.supabase.getClient()
    const guestListId = await this.getGuestListId(eventId, userId)

    const { data, error } = await client
      .from('guest_invites')
      .select(
        'id, full_name, email, phone, allocation, rsvp_status, checked_in_count, invite_sent_at, created_at',
      )
      .eq('guest_list_id', guestListId)
      .order('created_at', { ascending: false })

    if (error) throw new InternalServerErrorException(error.message)
    return data
  }

  async addGuest(eventId: string, dto: CreateGuestDto, userId: string) {
    const client = this.supabase.getClient()
    const guestListId = await this.getGuestListId(eventId, userId)

    if (dto.allocation < 1) throw new BadRequestException('Allocation must be at least 1')

    const token = randomUUID()

    const { data, error } = await client
      .from('guest_invites')
      .insert({
        guest_list_id: guestListId,
        full_name: dto.fullName,
        email: dto.email,
        phone: dto.phone ?? null,
        allocation: dto.allocation,
        token,
      })
      .select()
      .single()

    if (error) throw new InternalServerErrorException(error.message)

    // Generate QR code and send invite email asynchronously (don't block response)
    this.invites
      .generateAndStoreQrCode(data.token, data.id)
      .then(() => this.invites.sendInviteEmail(data.id))
      .then(() =>
        this.posthog.capture(userId, 'invite_sent', { event_id: eventId, guest_id: data.id }),
      )
      .catch(() => null) // log internally, don't fail the request

    this.posthog.capture(userId, 'guest_added', { event_id: eventId, allocation: dto.allocation })

    return data
  }

  async updateGuest(guestId: string, dto: UpdateGuestDto, _userId: string) {
    const client = this.supabase.getClient()

    // Verify guest belongs to a user-owned event
    const { data: guest, error: fetchError } = await client
      .from('guest_invites')
      .select('id, guest_lists!inner(events!inner(user_id))')
      .eq('id', guestId)
      .single()

    if (fetchError || !guest) throw new NotFoundException('Guest not found')

    if (dto.allocation !== undefined && dto.allocation < 1) {
      throw new BadRequestException('Allocation must be at least 1')
    }

    const { data, error } = await client
      .from('guest_invites')
      .update({
        ...(dto.fullName !== undefined && { full_name: dto.fullName }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.allocation !== undefined && { allocation: dto.allocation }),
      })
      .eq('id', guestId)
      .select()
      .single()

    if (error) throw new InternalServerErrorException(error.message)
    return data
  }

  async importGuests(
    eventId: string,
    rows: { fullName: string; email: string; phone?: string; allocation?: number }[],
    userId: string,
  ) {
    const client = this.supabase.getClient()
    const guestListId = await this.getGuestListId(eventId, userId)

    if (!rows.length) throw new BadRequestException('No rows to import')
    if (rows.length > 500) throw new BadRequestException('Maximum 500 guests per import')

    const records = rows.map((r) => ({
      guest_list_id: guestListId,
      full_name: r.fullName.trim(),
      email: r.email.trim().toLowerCase(),
      phone: r.phone?.trim() || null,
      allocation: r.allocation && r.allocation > 0 ? r.allocation : 1,
      token: randomUUID(),
    }))

    const { data, error } = await client.from('guest_invites').insert(records).select('id, token')

    if (error) throw new InternalServerErrorException(error.message)

    // Fire QR + email async per guest, same as single add
    for (const guest of data) {
      this.invites
        .generateAndStoreQrCode(guest.token, guest.id)
        .then(() => this.invites.sendInviteEmail(guest.id))
        .catch(() => null)
    }

    this.posthog.capture(userId, 'guests_imported', { event_id: eventId, count: data.length })

    return { imported: data.length }
  }

  async deleteGuest(guestId: string, _userId: string) {
    const client = this.supabase.getClient()

    const { data: guest, error: fetchError } = await client
      .from('guest_invites')
      .select('id, guest_lists!inner(events!inner(user_id))')
      .eq('id', guestId)
      .single()

    if (fetchError || !guest) throw new NotFoundException('Guest not found')

    const { error } = await client.from('guest_invites').delete().eq('id', guestId)

    if (error) throw new InternalServerErrorException(error.message)
    return { success: true }
  }

  async getGuestStats(eventId: string, userId: string) {
    const client = this.supabase.getClient()
    const guestListId = await this.getGuestListId(eventId, userId)

    const { data, error } = await client
      .from('guest_invites')
      .select('allocation, checked_in_count, rsvp_status')
      .eq('guest_list_id', guestListId)

    if (error) throw new InternalServerErrorException(error.message)

    const totalGuests = data.length
    const totalAllocation = data.reduce((sum, g) => sum + g.allocation, 0)
    const totalCheckedIn = data.reduce((sum, g) => sum + g.checked_in_count, 0)
    const accepted = data.filter((g) => g.rsvp_status === 'accepted').length
    const declined = data.filter((g) => g.rsvp_status === 'declined').length
    const pending = data.filter((g) => g.rsvp_status === 'pending').length

    return { totalGuests, totalAllocation, totalCheckedIn, accepted, declined, pending }
  }
}
