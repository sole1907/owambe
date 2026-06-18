import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common'
import { SupabaseService } from '../supabase/supabase.service'
import { EmailService } from '../email/email.service'
import { CreateInterestDto, MenuSelectionDto } from './dto/create-interest.dto'
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
        offered_price, counter_price, agreed_price, is_final_offer,
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

    // For caterers: compute offered_price from menu selections
    let computedOfferedPrice = dto.offeredPrice ?? null
    let menuLineItems: { item: any; servings: number; pricePerServing: number; subtotal: number }[] = []

    if (dto.menuSelections?.length && v.vendor_categories?.slug === 'caterers') {
      const itemIds = dto.menuSelections.map((s: MenuSelectionDto) => s.menuItemId)
      const { data: menuItems } = await client
        .from('caterer_menu_items')
        .select('id, name, category, caterer_menu_pricing_tiers (min_servings, max_servings, price_per_serving)')
        .in('id', itemIds)
        .eq('vendor_id', dto.vendorId)
        .eq('is_active', true)

      let total = 0
      for (const sel of dto.menuSelections) {
        const item = (menuItems ?? []).find((m: any) => m.id === sel.menuItemId)
        if (!item) continue
        const tiers: any[] = item.caterer_menu_pricing_tiers ?? []
        const tier = tiers
          .sort((a: any, b: any) => b.min_servings - a.min_servings)
          .find((t: any) => sel.servings >= t.min_servings && (t.max_servings === null || sel.servings <= t.max_servings))
          ?? tiers.sort((a: any, b: any) => a.min_servings - b.min_servings)[0]
        if (!tier) continue
        const subtotal = sel.servings * tier.price_per_serving
        total += subtotal
        menuLineItems.push({ item, servings: sel.servings, pricePerServing: tier.price_per_serving, subtotal })
      }
      if (total > 0) computedOfferedPrice = total
    }

    // For decorators: compute offered_price from the chosen package's guest tier
    let decoratorSelection: { packageId: string; packageName: string; includes: string[]; guestCount: number; price: number } | null = null

    if (dto.decoratorPackageId && v.vendor_categories?.slug === 'decorators') {
      const { data: pkg } = await client
        .from('decorator_packages')
        .select('id, name, includes, decorator_package_guest_tiers (min_guests, max_guests, price)')
        .eq('id', dto.decoratorPackageId)
        .eq('vendor_id', dto.vendorId)
        .eq('is_active', true)
        .single()

      if (pkg) {
        const guestCount = dto.decoratorGuestCount ?? event.guest_count_estimate ?? 100
        const tiers: any[] = (pkg as any).decorator_package_guest_tiers ?? []
        const tier =
          tiers
            .sort((a: any, b: any) => b.min_guests - a.min_guests)
            .find((t: any) => guestCount >= t.min_guests && (t.max_guests === null || guestCount <= t.max_guests)) ??
          tiers.sort((a: any, b: any) => a.min_guests - b.min_guests)[0]
        if (tier) {
          computedOfferedPrice = tier.price
          decoratorSelection = {
            packageId: (pkg as any).id,
            packageName: (pkg as any).name,
            includes: (pkg as any).includes ?? [],
            guestCount,
            price: tier.price,
          }
        }
      }
    }

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
        offered_price: computedOfferedPrice,
        is_final_offer: dto.isFinalOffer ?? false,
        discount_requested: dto.discountRequested ?? null,
      })
      .select()
      .single()

    if (insertError) throw new InternalServerErrorException(insertError.message)

    // Insert menu selections snapshot
    if (menuLineItems.length && interest) {
      await client.from('vendor_interest_menu_selections').insert(
        menuLineItems.map(({ item, servings, pricePerServing, subtotal }) => ({
          interest_id: interest.id,
          menu_item_id: item.id,
          menu_item_name: item.name,
          menu_item_category: item.category,
          servings,
          price_per_serving: pricePerServing,
          subtotal,
        })),
      )
    }

    // Insert decorator package selection snapshot
    if (decoratorSelection && interest) {
      await client.from('vendor_interest_decorator_selections').insert({
        interest_id: interest.id,
        package_id: decoratorSelection.packageId,
        package_name: decoratorSelection.packageName,
        package_includes: decoratorSelection.includes,
        guest_count: decoratorSelection.guestCount,
        price: decoratorSelection.price,
      })
    }

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

  // Summary of interests needing action across all of a user's events
  async getActionSummary(userId: string) {
    const client = this.supabase.getAdminClient()

    const { data } = await client
      .from('vendor_interests')
      .select('status, events(id, title)')
      .eq('user_id', userId)
      .in('status', ['pending', 'quoted'])

    const rows = data ?? []
    const pending_vendor_response = rows.filter((i) => i.status === 'pending').length
    const counter_received = rows.filter((i) => i.status === 'quoted').length

    // Deduplicated list of events that have at least one counter-offer
    const seen = new Set<string>()
    const counter_events: { id: string; title: string }[] = []
    for (const row of rows.filter((i) => i.status === 'quoted')) {
      const event = row.events as any
      if (event?.id && !seen.has(event.id)) {
        seen.add(event.id)
        counter_events.push({ id: event.id, title: event.title })
      }
    }

    return { pending_vendor_response, counter_received, counter_events }
  }

  // User counters back after receiving a vendor counter-offer
  async counterBack(eventId: string, interestId: string, userId: string, offeredPrice: number, isFinalOffer?: boolean) {
    const client = this.supabase.getAdminClient()

    const { data: interest, error } = await client
      .from('vendor_interests')
      .select('id, status, vendor_id, offered_price, counter_price, is_final_offer, events(title, city, event_date), vendors(name, email)')
      .eq('id', interestId)
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .single()

    if (error || !interest) throw new NotFoundException('Interest not found')
    if (interest.status !== 'quoted') throw new BadRequestException('No counter-offer to respond to.')

    // If the vendor marked their counter as final, user cannot counter — only accept or decline
    if ((interest as any).is_final_offer) {
      throw new BadRequestException(
        'The vendor marked their counter-offer as final. You can only accept or decline.',
      )
    }

    const { data, error: updateError } = await client
      .from('vendor_interests')
      .update({
        offered_price: offeredPrice,
        counter_price: null,
        status: 'pending',
        is_final_offer: isFinalOffer ?? false,
      })
      .eq('id', interestId)
      .select()
      .single()

    if (updateError) throw new InternalServerErrorException(updateError.message)

    // Notify vendor of the counter-back
    const vendorEmail = (interest.vendors as any)?.email
    if (vendorEmail) {
      const fmt = (v: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(v)
      await this.email.sendVendorInquiry({
        to: vendorEmail,
        vendorName: (interest.vendors as any)?.name ?? 'Vendor',
        eventTitle: (interest.events as any)?.title ?? 'Event',
        eventDate: (interest.events as any)?.event_date ?? 'Date TBC',
        eventCity: (interest.events as any)?.city ?? '',
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        offeredPrice: fmt(offeredPrice),
      })
    }

    return data
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

  async getInquiryCounts(vendorUserId: string) {
    const client = this.supabase.getAdminClient()

    const { data: vendor } = await client
      .from('vendors')
      .select('id')
      .eq('user_id', vendorUserId)
      .single()

    if (!vendor) return { pending: 0 }

    const { data } = await client
      .from('vendor_interests')
      .select('status')
      .eq('vendor_id', vendor.id)
      .eq('status', 'pending')

    return { pending: (data ?? []).length }
  }

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
        offered_price, counter_price, agreed_price, is_final_offer,
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
        id, status, event_id, user_id, offered_price, is_final_offer,
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

    // If the organiser marked their offer as final, vendor cannot counter — only accept or decline
    if ((interest as any).is_final_offer && dto.available && dto.counterPrice) {
      throw new BadRequestException(
        'This offer was marked as final by the organiser. You can only accept or decline.',
      )
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
        // Record if vendor's counter is final; clear flag if accepting/declining
        is_final_offer: newStatus === 'quoted' ? (dto.isFinalOffer ?? false) : false,
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
