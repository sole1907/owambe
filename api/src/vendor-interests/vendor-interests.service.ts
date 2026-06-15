import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common'
import { SupabaseService } from '../supabase/supabase.service'
import { EmailService } from '../email/email.service'
import { CreateInterestDto } from './dto/create-interest.dto'
import { RespondInquiryDto } from './dto/respond-inquiry.dto'

@Injectable()
export class VendorInterestsService {
  constructor(
    private supabase: SupabaseService,
    private email: EmailService,
  ) {}

  async getInterests(eventId: string, userId: string) {
    const client = this.supabase.getAdminClient()

    // verify event ownership
    const { data: event, error: eventError } = await client
      .from('events')
      .select('id, title, event_date, event_date_approximate, user_id')
      .eq('id', eventId)
      .eq('user_id', userId)
      .single()

    if (eventError || !event) throw new NotFoundException('Event not found')

    const { data, error } = await client
      .from('vendor_interests')
      .select(`
        id, preference_rank, status, event_date, expires_at,
        vendor_response_at, vendor_notes, created_at,
        vendors (id, name, slug, city, price_min, price_max, rating, photos,
          vendor_categories (id, name, slug))
      `)
      .eq('event_id', eventId)
      .order('preference_rank', { ascending: true })

    if (error) throw new InternalServerErrorException(error.message)
    return data ?? []
  }

  async addInterest(eventId: string, userId: string, dto: CreateInterestDto) {
    const client = this.supabase.getAdminClient()

    if (dto.preferenceRank < 1 || dto.preferenceRank > 3) {
      throw new BadRequestException('Preference rank must be 1 (A), 2 (B), or 3 (C)')
    }

    // verify event ownership and get event details
    const { data: event, error: eventError } = await client
      .from('events')
      .select('id, title, event_date, event_date_approximate, city, guest_count')
      .eq('id', eventId)
      .eq('user_id', userId)
      .single()

    if (eventError || !event) throw new NotFoundException('Event not found')

    // get vendor details including category
    const { data: vendor, error: vendorError } = await client
      .from('vendors')
      .select(`id, name, email, whatsapp, city, capacity,
        vendor_categories (id, name, slug),
        vendor_availability (date, status)`)
      .eq('id', dto.vendorId)
      .eq('is_active', true)
      .single()

    if (vendorError || !vendor) throw new NotFoundException('Vendor not found')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const v = vendor as any

    // check capacity for venues
    if (
      v.vendor_categories?.slug === 'venues' &&
      v.capacity &&
      event.guest_count &&
      v.capacity < event.guest_count
    ) {
      throw new BadRequestException(
        `This venue has a capacity of ${v.capacity} guests but your event has ${event.guest_count} expected guests.`,
      )
    }

    // check if already shortlisted
    const { data: existing } = await client
      .from('vendor_interests')
      .select('id')
      .eq('event_id', eventId)
      .eq('vendor_id', dto.vendorId)
      .single()

    if (existing) throw new BadRequestException('This vendor is already on your shortlist for this event.')

    // check if rank slot is taken
    const { data: slotTaken } = await client
      .from('vendor_interests')
      .select('id, vendors (name)')
      .eq('event_id', eventId)
      .eq('category_id', v.vendor_categories.id)
      .eq('preference_rank', dto.preferenceRank)
      .single()

    if (slotTaken) {
      const rank = ['A', 'B', 'C'][dto.preferenceRank - 1]
      throw new BadRequestException(
        `Slot ${rank} for ${v.vendor_categories.name} is already taken. Choose a different slot.`,
      )
    }

    // check availability — if vendor has the event date blocked/booked, mark immediately unavailable
    const eventDate = event.event_date ?? null
    let initialStatus = 'pending'

    if (eventDate && Array.isArray(v.vendor_availability)) {
      const blocked = v.vendor_availability.find(
        (a: { date: string; status: string }) => a.date === eventDate,
      )
      if (blocked) initialStatus = 'unavailable'
    }

    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 48)

    // get vendor email for notification
    const vendorEmail = v.email as string | null

    const { data: interest, error: insertError } = await client
      .from('vendor_interests')
      .insert({
        event_id: eventId,
        vendor_id: dto.vendorId,
        user_id: userId,
        category_id: v.vendor_categories.id,
        preference_rank: dto.preferenceRank,
        status: initialStatus,
        event_date: eventDate,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single()

    if (insertError) throw new InternalServerErrorException(insertError.message)

    // send email if pending (vendor needs to respond)
    if (initialStatus === 'pending' && vendorEmail) {
      await this.email.sendVendorInquiry({
        to: vendorEmail,
        vendorName: v.name,
        eventTitle: event.title,
        eventDate: eventDate ?? event.event_date_approximate ?? 'Date TBC',
        eventCity: event.city ?? '',
        expiresAt: expiresAt.toISOString(),
      })
    }

    return interest
  }

  async removeInterest(eventId: string, interestId: string, userId: string) {
    const client = this.supabase.getAdminClient()

    const { data: interest, error } = await client
      .from('vendor_interests')
      .select('id, status')
      .eq('id', interestId)
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .single()

    if (error || !interest) throw new NotFoundException('Interest not found')

    const { error: deleteError } = await client
      .from('vendor_interests')
      .delete()
      .eq('id', interestId)

    if (deleteError) throw new InternalServerErrorException(deleteError.message)
    return { message: 'Removed from shortlist' }
  }

  // ─── Vendor portal: get incoming inquiries ──────────────────────────────────

  async getInquiries(vendorUserId: string) {
    const client = this.supabase.getAdminClient()

    const { data: vendor, error: vendorError } = await client
      .from('vendors')
      .select('id')
      .eq('user_id', vendorUserId)
      .single()

    if (vendorError || !vendor) throw new NotFoundException('Vendor profile not found')

    const { data, error } = await client
      .from('vendor_interests')
      .select(`
        id, preference_rank, status, event_date, expires_at,
        vendor_response_at, vendor_notes, created_at,
        events (id, title, city, guest_count),
        users (full_name, email, phone)
      `)
      .eq('vendor_id', vendor.id)
      .order('created_at', { ascending: false })

    if (error) throw new InternalServerErrorException(error.message)
    return data ?? []
  }

  async respondToInquiry(vendorUserId: string, interestId: string, dto: RespondInquiryDto) {
    const client = this.supabase.getAdminClient()

    const { data: vendor } = await client
      .from('vendors')
      .select('id, name, email')
      .eq('user_id', vendorUserId)
      .single()

    if (!vendor) throw new NotFoundException('Vendor profile not found')

    const { data: interest, error: interestError } = await client
      .from('vendor_interests')
      .select(`id, status, event_id, user_id, events (title, city, event_date), users (email, full_name)`)
      .eq('id', interestId)
      .eq('vendor_id', vendor.id)
      .single()

    if (interestError || !interest) throw new NotFoundException('Inquiry not found')

    if (interest.status !== 'pending') {
      throw new BadRequestException('This inquiry has already been responded to or has expired.')
    }

    const newStatus = dto.available ? 'available' : 'unavailable'

    const { data, error } = await client
      .from('vendor_interests')
      .update({
        status: newStatus,
        vendor_response_at: new Date().toISOString(),
        vendor_notes: dto.notes ?? null,
      })
      .eq('id', interestId)
      .select()
      .single()

    if (error) throw new InternalServerErrorException(error.message)

    // notify organiser
    const organiserEmail = (interest.users as any)?.email
    const eventTitle = (interest.events as any)?.title ?? 'your event'
    const eventCity = (interest.events as any)?.city ?? ''
    const eventDate = (interest.events as any)?.event_date ?? ''

    if (organiserEmail) {
      await this.email.sendVendorResponse({
        to: organiserEmail,
        organizerName: (interest.users as any)?.full_name ?? 'there',
        vendorName: vendor.name,
        eventTitle,
        eventDate,
        available: dto.available,
        vendorNotes: dto.notes,
      })
    }

    return data
  }
}
