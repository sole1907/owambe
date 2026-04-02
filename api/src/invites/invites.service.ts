import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { SupabaseService } from '../supabase/supabase.service'
import { EmailService } from '../email/email.service'
import { RequestPlusOneDto } from './dto/request-plus-one.dto'
import * as QRCode from 'qrcode'

@Injectable()
export class InvitesService {
  constructor(
    private supabase: SupabaseService,
    private email: EmailService,
    private config: ConfigService,
  ) {}

  async generateAndStoreQrCode(token: string, guestId: string): Promise<string> {
    const client = this.supabase.getClient()
    const appUrl = this.config.get<string>('appUrl')
    const inviteUrl = `${appUrl}/invite/${token}`

    // Generate QR code as PNG buffer
    const qrBuffer = await QRCode.toBuffer(inviteUrl, {
      type: 'png',
      width: 400,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    })

    const fileName = `qrcodes/${guestId}.png`

    // Upload to Supabase storage
    const { error: uploadError } = await client.storage
      .from('invites')
      .upload(fileName, qrBuffer, { contentType: 'image/png', upsert: true })

    if (uploadError) throw new InternalServerErrorException(uploadError.message)

    const { data: urlData } = client.storage.from('invites').getPublicUrl(fileName)

    // Store QR code URL on the invite record
    await client.from('guest_invites').update({ qr_code_url: urlData.publicUrl }).eq('id', guestId)

    return urlData.publicUrl
  }

  async sendInviteEmail(guestId: string) {
    const client = this.supabase.getClient()

    const { data: invite, error } = await client
      .from('guest_invites')
      .select(
        `
        id, full_name, email, allocation, token, qr_code_url,
        guest_lists (
          events (title, event_date, event_date_approximate, city)
        )
      `,
      )
      .eq('id', guestId)
      .single()

    if (error || !invite) throw new NotFoundException('Invite not found')

    const event = (invite.guest_lists as any)?.events
    const appUrl = this.config.get<string>('appUrl')
    const inviteUrl = `${appUrl}/invite/${invite.token}`

    await this.email.sendInvite({
      to: invite.email,
      guestName: invite.full_name,
      eventTitle: event?.title ?? 'Your event',
      eventDate: event?.event_date
        ? new Date(event.event_date).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })
        : (event?.event_date_approximate ?? ''),
      eventCity: event?.city ?? '',
      allocation: invite.allocation,
      inviteUrl,
      qrCodeUrl: invite.qr_code_url ?? inviteUrl,
    })

    // Mark invite as sent
    await client
      .from('guest_invites')
      .update({ invite_sent_at: new Date().toISOString() })
      .eq('id', guestId)
  }

  async getInviteByToken(token: string) {
    const client = this.supabase.getClient()

    const { data: invite, error } = await client
      .from('guest_invites')
      .select(
        `
        id, full_name, allocation, checked_in_count, rsvp_status, qr_code_url, token,
        guest_lists (
          events (id, title, event_date, event_date_approximate, city, location, event_type)
        )
      `,
      )
      .eq('token', token)
      .single()

    if (error || !invite) throw new NotFoundException('Invite not found')

    // Check for any pending plus-one request
    const { data: pendingRequest } = await client
      .from('plus_one_requests')
      .select('id, requested_count, status')
      .eq('guest_invite_id', invite.id)
      .eq('status', 'pending')
      .single()

    return {
      ...invite,
      event: (invite.guest_lists as any)?.events,
      pendingPlusOneRequest: pendingRequest ?? null,
    }
  }

  async requestPlusOne(token: string, dto: RequestPlusOneDto) {
    const client = this.supabase.getClient()

    if (dto.requestedCount < 1) throw new BadRequestException('Must request at least 1 extra spot')

    const { data: invite, error } = await client
      .from('guest_invites')
      .select(
        `
        id, full_name, email,
        guest_lists (
          events (title, user_id)
        )
      `,
      )
      .eq('token', token)
      .single()

    if (error || !invite) throw new NotFoundException('Invite not found')

    // Check no existing pending request
    const { data: existing } = await client
      .from('plus_one_requests')
      .select('id')
      .eq('guest_invite_id', invite.id)
      .eq('status', 'pending')
      .single()

    if (existing) throw new BadRequestException('You already have a pending request')

    // Create the request
    const { data: request, error: reqError } = await client
      .from('plus_one_requests')
      .insert({
        guest_invite_id: invite.id,
        requested_count: dto.requestedCount,
        reason: dto.reason ?? null,
        status: 'pending',
      })
      .select()
      .single()

    if (reqError) throw new InternalServerErrorException(reqError.message)

    // Notify the host via email
    const event = (invite.guest_lists as any)?.events
    if (event?.user_id) {
      const { data: host } = await client
        .from('users')
        .select('email, full_name')
        .eq('id', event.user_id)
        .single()

      if (host) {
        const appUrl = this.config.get<string>('appUrl')
        await this.email.sendPlusOneRequestToHost({
          to: host.email,
          hostName: host.full_name,
          guestName: invite.full_name,
          eventTitle: event.title,
          requestedCount: dto.requestedCount,
          approveUrl: `${appUrl}/dashboard`,
        })
      }
    }

    return request
  }

  async reviewPlusOneRequest(requestId: string, approved: boolean, userId: string) {
    const client = this.supabase.getClient()

    // Fetch the request with invite + event to verify ownership
    const { data: request, error } = await client
      .from('plus_one_requests')
      .select(
        `
        id, requested_count, status,
        guest_invites (
          id, full_name, email, allocation, token,
          guest_lists (
            events (id, title, user_id)
          )
        )
      `,
      )
      .eq('id', requestId)
      .single()

    if (error || !request) throw new NotFoundException('Request not found')

    const invite = request.guest_invites as any
    const event = invite?.guest_lists?.events

    // Verify the logged-in user owns the event
    if (event?.user_id !== userId) throw new NotFoundException('Request not found')

    if (request.status !== 'pending') {
      throw new BadRequestException('This request has already been reviewed')
    }

    // Update request status
    await client
      .from('plus_one_requests')
      .update({ status: approved ? 'approved' : 'rejected', reviewed_at: new Date().toISOString() })
      .eq('id', requestId)

    let newAllocation = invite.allocation

    if (approved) {
      newAllocation = invite.allocation + request.requested_count

      // Update guest allocation
      await client.from('guest_invites').update({ allocation: newAllocation }).eq('id', invite.id)

      // Regenerate QR code with updated allocation (token unchanged, so URL is the same — just refresh)
      await this.generateAndStoreQrCode(invite.token, invite.id)
    }

    // Email the guest with the outcome
    await this.email.sendPlusOneOutcomeToGuest({
      to: invite.email,
      guestName: invite.full_name,
      eventTitle: event?.title ?? 'your event',
      approved,
      newAllocation: approved ? newAllocation : undefined,
    })

    return { success: true, approved, newAllocation: approved ? newAllocation : invite.allocation }
  }

  async checkIn(token: string) {
    const client = this.supabase.getClient()

    const { data: invite, error } = await client
      .from('guest_invites')
      .select(
        `
        id, full_name, allocation, checked_in_count, rsvp_status,
        guest_lists (
          events (id, title, event_date, event_date_approximate, city)
        )
      `,
      )
      .eq('token', token)
      .single()

    if (error || !invite) throw new NotFoundException('Invalid QR code — invite not found')

    const remaining = invite.allocation - invite.checked_in_count

    if (remaining <= 0) {
      return {
        success: false,
        reason: 'over_limit',
        guestName: invite.full_name,
        allocation: invite.allocation,
        checkedInCount: invite.checked_in_count,
        remaining: 0,
      }
    }

    // Increment checked_in_count
    const newCount = invite.checked_in_count + 1
    await client
      .from('guest_invites')
      .update({ checked_in_count: newCount, rsvp_status: 'accepted' })
      .eq('id', invite.id)

    const event = (invite.guest_lists as any)?.events

    return {
      success: true,
      guestName: invite.full_name,
      allocation: invite.allocation,
      checkedInCount: newCount,
      remaining: invite.allocation - newCount,
      event: event
        ? {
            title: event.title,
            date: event.event_date || event.event_date_approximate || null,
            city: event.city || null,
          }
        : null,
    }
  }

  async searchGuestsByName(eventId: string, query: string) {
    const client = this.supabase.getClient()

    const { data: guestList } = await client
      .from('guest_lists')
      .select('id')
      .eq('event_id', eventId)
      .single()

    if (!guestList) throw new NotFoundException('Event not found')

    const { data, error } = await client
      .from('guest_invites')
      .select('id, full_name, allocation, checked_in_count, token')
      .eq('guest_list_id', guestList.id)
      .ilike('full_name', `%${query}%`)
      .limit(10)

    if (error) throw new InternalServerErrorException(error.message)

    return data ?? []
  }

  async getPendingRequests(eventId: string, userId: string) {
    const client = this.supabase.getClient()

    // Verify event ownership
    const { data: event, error: eventError } = await client
      .from('events')
      .select('id')
      .eq('id', eventId)
      .eq('user_id', userId)
      .single()

    if (eventError || !event) throw new NotFoundException('Event not found')

    const { data, error } = await client
      .from('plus_one_requests')
      .select(
        `
        id, requested_count, reason, status, created_at,
        guest_invites (id, full_name, email, allocation)
      `,
      )
      .eq('status', 'pending')
      .order('created_at', { ascending: true })

    if (error) throw new InternalServerErrorException(error.message)

    // Filter to only requests for this event's guests
    const { data: guestListData } = await client
      .from('guest_lists')
      .select('id')
      .eq('event_id', eventId)
      .single()

    if (!guestListData) return []

    const { data: inviteIds } = await client
      .from('guest_invites')
      .select('id')
      .eq('guest_list_id', guestListData.id)

    const validIds = new Set((inviteIds ?? []).map((i: any) => i.id))
    return (data ?? []).filter((r: any) => validIds.has(r.guest_invites?.id))
  }
}
