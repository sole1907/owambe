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
        offered_price, counter_price, agreed_price,
        vendors (id, name, slug, city, price_min, price_max, rating, photos,
          commitment_fee_percentage,
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

    const { data: event, error: eventError } = await client
      .from('events')
      .select('id, title, event_date, event_date_approximate, city, guest_count_estimate')
      .eq('id', eventId)
      .eq('user_id', userId)
      .single()

    if (eventError || !event) throw new NotFoundException('Event not found')

    const { data: vendor, error: vendorError } = await client
      .from('vendors')
      .select(`id, name, email, whatsapp, city, capacity,
        vendor_categories (id, name, slug),
        vendor_availability (date, status)`)
      .eq('id', dto.vendorId)
      .eq('is_active', true)
      .single()

    if (vendorError || !vendor) throw new NotFoundException('Vendor not found')

    const v = vendor as any

    // Capacity check for venues
    if (
      v.vendor_categories?.slug === 'venues' &&
      v.capacity &&
      event.guest_count_estimate &&
      v.capacity < event.guest_count_estimate
    ) {
      throw new BadRequestException(
        `This venue holds ${v.capacity.toLocaleString()} guests but your event has ~${event.guest_count_estimate.toLocaleString()} expected.`,
      )
    }

    const { data: existing } = await client
      .from('vendor_interests')
      .select('id')
      .eq('event_id', eventId)
      .eq('vendor_id', dto.vendorId)
      .single()

    if (existing) throw new BadRequestException('This vendor is already on your shortlist for this event.')

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
        offered_price: dto.offeredPrice ?? null,
      })
      .select()
      .single()

    if (insertError) throw new InternalServerErrorException(insertError.message)

    if (initialStatus === 'pending' && v.email) {
      const offeredPriceFormatted = dto.offeredPrice
        ? new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(dto.offeredPrice)
        : null

      await this.email.sendVendorInquiry({
        to: v.email,
        vendorName: v.name,
        eventTitle: event.title,
        eventDate: eventDate ?? event.event_date_approximate ?? 'Date TBC',
        eventCity: event.city ?? '',
        expiresAt: expiresAt.toISOString(),
        offeredPrice: offeredPriceFormatted,
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

  // Accept vendor's counter-offer (user-side)
  async acceptCounter(eventId: string, interestId: string, userId: string) {
    const client = this.supabase.getAdminClient()

    const { data: interest, error } = await client
      .from('vendor_interests')
      .select('id, status, counter_price')
      .eq('id', interestId)
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .single()

    if (error || !interest) throw new NotFoundException('Interest not found')
    if (interest.status !== 'quoted') throw new BadRequestException('No counter-offer to accept.')
    if (!interest.counter_price) throw new BadRequestException('Counter price is missing.')

    const { data, error: updateError } = await client
      .from('vendor_interests')
      .update({ status: 'available', agreed_price: interest.counter_price })
      .eq('id', interestId)
      .select()
      .single()

    if (updateError) throw new InternalServerErrorException(updateError.message)
    return data
  }

  // ─── Vendor portal ──────────────────────────────────────────────────────────

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
        offered_price, counter_price, agreed_price,
        events (id, title, city, guest_count_estimate),
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
      .select('id, name, email, commitment_fee_percentage')
      .eq('user_id', vendorUserId)
      .single()

    if (!vendor) throw new NotFoundException('Vendor profile not found')

    const { data: interest, error: interestError } = await client
      .from('vendor_interests')
      .select(`
        id, status, event_id, user_id, offered_price,
        events (title, city, event_date),
        users (email, full_name)
      `)
      .eq('id', interestId)
      .eq('vendor_id', vendor.id)
      .single()

    if (interestError || !interest) throw new NotFoundException('Inquiry not found')

    if (!['pending', 'quoted'].includes(interest.status)) {
      throw new BadRequestException('This inquiry has already been finalised or has expired.')
    }

    let newStatus: string
    let agreedPrice: number | null = null

    if (!dto.available) {
      newStatus = 'unavailable'
    } else if (dto.counterPrice && dto.counterPrice !== (interest as any).offered_price) {
      // Vendor is available but wants a different price
      newStatus = 'quoted'
    } else {
      // Vendor accepts at offered price (or no counter given)
      newStatus = 'available'
      agreedPrice = (interest as any).offered_price ?? null
    }

    const { data, error } = await client
      .from('vendor_interests')
      .update({
        status: newStatus,
        vendor_response_at: new Date().toISOString(),
        vendor_notes: dto.notes ?? null,
        counter_price: dto.counterPrice ?? null,
        agreed_price: agreedPrice,
      })
      .eq('id', interestId)
      .select()
      .single()

    if (error) throw new InternalServerErrorException(error.message)

    const organiserEmail = (interest.users as any)?.email
    const eventTitle = (interest.events as any)?.title ?? 'your event'
    const eventDate = (interest.events as any)?.event_date ?? ''
    const eventCity = (interest.events as any)?.city ?? ''

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
