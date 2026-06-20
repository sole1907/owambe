import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common'
import { SupabaseService } from '../supabase/supabase.service'
import { EmailService } from '../email/email.service'
import { UpdateVendorProfileDto } from './dto/update-vendor-profile.dto'

@Injectable()
export class VendorPortalService {
  constructor(
    private supabase: SupabaseService,
    private email: EmailService,
  ) {}

  private async getVendorByUserId(userId: string) {
    const client = this.supabase.getAdminClient()
    const { data, error } = await client
      .from('vendors')
      .select(`*, vendor_categories (id, name, slug)`)
      .eq('user_id', userId)
      .single()

    if (error || !data) throw new NotFoundException('Vendor profile not found')
    return data
  }

  async getProfile(userId: string) {
    return this.getVendorByUserId(userId)
  }

  async updateProfile(userId: string, dto: UpdateVendorProfileDto) {
    const client = this.supabase.getAdminClient()
    const vendor = await this.getVendorByUserId(userId)

    const settings = await this.getPlatformSettings(client)
    const minPct = (settings.commitment_fee_min_pct as number | undefined) ?? 10
    const maxPct = (settings.commitment_fee_max_pct as number | undefined) ?? 50

    if (
      dto.commitmentFeePercentage !== undefined &&
      (dto.commitmentFeePercentage < minPct || dto.commitmentFeePercentage > maxPct)
    ) {
      throw new BadRequestException(
        `Commitment fee must be between ${minPct}% and ${maxPct}%`,
      )
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (dto.phone !== undefined)                updates.phone = dto.phone
    if (dto.whatsapp !== undefined)             updates.whatsapp = dto.whatsapp
    if (dto.email !== undefined)                updates.email = dto.email
    if (dto.instagram !== undefined)            updates.instagram = dto.instagram
    if (dto.website !== undefined)              updates.website = dto.website
    if (dto.description !== undefined)          updates.description = dto.description
    if (dto.servicefee !== undefined)           updates.service_fee = dto.servicefee
    if (dto.perUnitCost !== undefined)          updates.per_unit_cost = dto.perUnitCost
    if (dto.perUnitLabel !== undefined)         updates.per_unit_label = dto.perUnitLabel
    if (dto.hasMaterialCosts !== undefined)     updates.has_material_costs = dto.hasMaterialCosts
    if (dto.priceMin !== undefined)             updates.price_min = dto.priceMin
    if (dto.priceMax !== undefined)             updates.price_max = dto.priceMax
    if (dto.commitmentFeePercentage !== undefined) updates.commitment_fee_percentage = dto.commitmentFeePercentage
    if (dto.balancePaymentMethods !== undefined)   updates.balance_payment_methods = dto.balancePaymentMethods
    if (dto.cancellationPolicy !== undefined)      updates.cancellation_policy = dto.cancellationPolicy

    const { data, error } = await client
      .from('vendors')
      .update(updates)
      .eq('id', vendor.id)
      .select()
      .single()

    if (error) throw new InternalServerErrorException(error.message)
    return data
  }

  async getAvailability(userId: string, year: number, month: number) {
    const client = this.supabase.getAdminClient()
    const vendor = await this.getVendorByUserId(userId)

    const from = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const to = `${year}-${String(month).padStart(2, '0')}-${lastDay}`

    const { data, error } = await client
      .from('vendor_availability')
      .select('date, status, event_id')
      .eq('vendor_id', vendor.id)
      .gte('date', from)
      .lte('date', to)

    if (error) throw new InternalServerErrorException(error.message)
    return data ?? []
  }

  async blockDate(userId: string, date: string) {
    const client = this.supabase.getAdminClient()
    const vendor = await this.getVendorByUserId(userId)

    const { data: existing } = await client
      .from('vendor_availability')
      .select('id, status')
      .eq('vendor_id', vendor.id)
      .eq('date', date)
      .single()

    if (existing?.status === 'booked') {
      throw new BadRequestException('This date is already confirmed as booked and cannot be manually blocked.')
    }

    const { error } = await client
      .from('vendor_availability')
      .upsert({ vendor_id: vendor.id, date, status: 'blocked' }, { onConflict: 'vendor_id,date' })

    if (error) throw new InternalServerErrorException(error.message)
    return { date, status: 'blocked' }
  }

  async unblockDate(userId: string, date: string) {
    const client = this.supabase.getAdminClient()
    const vendor = await this.getVendorByUserId(userId)

    const { data: existing } = await client
      .from('vendor_availability')
      .select('status')
      .eq('vendor_id', vendor.id)
      .eq('date', date)
      .single()

    if (existing?.status === 'booked') {
      throw new BadRequestException('This date is confirmed as booked and cannot be unblocked.')
    }

    const { error } = await client
      .from('vendor_availability')
      .delete()
      .eq('vendor_id', vendor.id)
      .eq('date', date)

    if (error) throw new InternalServerErrorException(error.message)
    return { date, status: 'available' }
  }

  async getSettings() {
    const client = this.supabase.getAdminClient()
    return this.getPlatformSettings(client)
  }

  // ── Caterer menu management ───────────────────────────────────────────────

  async getMenu(userId: string) {
    const client = this.supabase.getAdminClient()
    const vendor = await this.getVendorByUserId(userId)
    const { data, error } = await client
      .from('caterer_menu_items')
      .select('*, caterer_menu_pricing_tiers (id, min_servings, max_servings, price_per_serving)')
      .eq('vendor_id', vendor.id)
      .eq('is_active', true)
      .order('category')
      .order('sort_order')
    if (error) throw new InternalServerErrorException(error.message)
    return data ?? []
  }

  async addMenuItem(userId: string, dto: { name: string; category: string; description?: string; tiers: { minServings: number; maxServings?: number; pricePerServing: number }[] }) {
    const client = this.supabase.getAdminClient()
    const vendor = await this.getVendorByUserId(userId)
    const { data: item, error } = await client
      .from('caterer_menu_items')
      .insert({ vendor_id: vendor.id, name: dto.name, category: dto.category, description: dto.description ?? null })
      .select()
      .single()
    if (error || !item) throw new InternalServerErrorException(error?.message ?? 'Failed to create item')

    if (dto.tiers?.length) {
      const tiers = dto.tiers.map((t) => ({
        menu_item_id: item.id,
        min_servings: t.minServings,
        max_servings: t.maxServings ?? null,
        price_per_serving: t.pricePerServing,
      }))
      const { error: te } = await client.from('caterer_menu_pricing_tiers').insert(tiers)
      if (te) throw new InternalServerErrorException(te.message)
    }
    return item
  }

  async updateMenuItem(userId: string, itemId: string, dto: { name?: string; category?: string; description?: string; tiers?: { minServings: number; maxServings?: number; pricePerServing: number }[] }) {
    const client = this.supabase.getAdminClient()
    const vendor = await this.getVendorByUserId(userId)

    const updates: Record<string, unknown> = {}
    if (dto.name !== undefined) updates.name = dto.name
    if (dto.category !== undefined) updates.category = dto.category
    if (dto.description !== undefined) updates.description = dto.description

    if (Object.keys(updates).length) {
      const { error } = await client.from('caterer_menu_items').update(updates).eq('id', itemId).eq('vendor_id', vendor.id)
      if (error) throw new InternalServerErrorException(error.message)
    }

    if (dto.tiers !== undefined) {
      await client.from('caterer_menu_pricing_tiers').delete().eq('menu_item_id', itemId)
      if (dto.tiers.length) {
        const tiers = dto.tiers.map((t) => ({
          menu_item_id: itemId,
          min_servings: t.minServings,
          max_servings: t.maxServings ?? null,
          price_per_serving: t.pricePerServing,
        }))
        const { error: te } = await client.from('caterer_menu_pricing_tiers').insert(tiers)
        if (te) throw new InternalServerErrorException(te.message)
      }
    }
    return { id: itemId }
  }

  async deleteMenuItem(userId: string, itemId: string) {
    const client = this.supabase.getAdminClient()
    const vendor = await this.getVendorByUserId(userId)
    const { error } = await client.from('caterer_menu_items').update({ is_active: false }).eq('id', itemId).eq('vendor_id', vendor.id)
    if (error) throw new InternalServerErrorException(error.message)
    return { id: itemId }
  }

  // ── Decorator styles & packages management ────────────────────────────────

  async getDecoratorProfile(userId: string) {
    const client = this.supabase.getAdminClient()
    const vendor = await this.getVendorByUserId(userId)

    const [stylesRes, packagesRes] = await Promise.all([
      client
        .from('decorator_styles')
        .select('id, style, sort_order')
        .eq('vendor_id', vendor.id)
        .eq('is_active', true)
        .order('sort_order'),
      client
        .from('decorator_packages')
        .select('id, name, description, includes, sort_order, decorator_package_guest_tiers (id, min_guests, max_guests, price)')
        .eq('vendor_id', vendor.id)
        .eq('is_active', true)
        .order('sort_order'),
    ])

    if (stylesRes.error) throw new InternalServerErrorException(stylesRes.error.message)
    if (packagesRes.error) throw new InternalServerErrorException(packagesRes.error.message)

    return { styles: stylesRes.data ?? [], packages: packagesRes.data ?? [] }
  }

  async addDecoratorStyle(userId: string, dto: { style: string }) {
    const client = this.supabase.getAdminClient()
    const vendor = await this.getVendorByUserId(userId)
    if (!dto.style?.trim()) throw new BadRequestException('Style is required')

    const { data, error } = await client
      .from('decorator_styles')
      .insert({ vendor_id: vendor.id, style: dto.style.trim() })
      .select()
      .single()
    if (error) throw new InternalServerErrorException(error.message)
    return data
  }

  async deleteDecoratorStyle(userId: string, styleId: string) {
    const client = this.supabase.getAdminClient()
    const vendor = await this.getVendorByUserId(userId)
    const { error } = await client
      .from('decorator_styles')
      .delete()
      .eq('id', styleId)
      .eq('vendor_id', vendor.id)
    if (error) throw new InternalServerErrorException(error.message)
    return { id: styleId }
  }

  async addDecoratorPackage(
    userId: string,
    dto: { name: string; description?: string; includes?: string[]; tiers: { minGuests: number; maxGuests?: number; price: number }[] },
  ) {
    const client = this.supabase.getAdminClient()
    const vendor = await this.getVendorByUserId(userId)

    const { data: pkg, error } = await client
      .from('decorator_packages')
      .insert({
        vendor_id: vendor.id,
        name: dto.name,
        description: dto.description ?? null,
        includes: dto.includes ?? [],
      })
      .select()
      .single()
    if (error || !pkg) throw new InternalServerErrorException(error?.message ?? 'Failed to create package')

    if (dto.tiers?.length) {
      const tiers = dto.tiers.map((t) => ({
        package_id: pkg.id,
        min_guests: t.minGuests,
        max_guests: t.maxGuests ?? null,
        price: t.price,
      }))
      const { error: te } = await client.from('decorator_package_guest_tiers').insert(tiers)
      if (te) throw new InternalServerErrorException(te.message)
    }
    return pkg
  }

  async updateDecoratorPackage(
    userId: string,
    packageId: string,
    dto: { name?: string; description?: string; includes?: string[]; tiers?: { minGuests: number; maxGuests?: number; price: number }[] },
  ) {
    const client = this.supabase.getAdminClient()
    const vendor = await this.getVendorByUserId(userId)

    const updates: Record<string, unknown> = {}
    if (dto.name !== undefined) updates.name = dto.name
    if (dto.description !== undefined) updates.description = dto.description
    if (dto.includes !== undefined) updates.includes = dto.includes

    if (Object.keys(updates).length) {
      const { error } = await client
        .from('decorator_packages')
        .update(updates)
        .eq('id', packageId)
        .eq('vendor_id', vendor.id)
      if (error) throw new InternalServerErrorException(error.message)
    }

    if (dto.tiers !== undefined) {
      await client.from('decorator_package_guest_tiers').delete().eq('package_id', packageId)
      if (dto.tiers.length) {
        const tiers = dto.tiers.map((t) => ({
          package_id: packageId,
          min_guests: t.minGuests,
          max_guests: t.maxGuests ?? null,
          price: t.price,
        }))
        const { error: te } = await client.from('decorator_package_guest_tiers').insert(tiers)
        if (te) throw new InternalServerErrorException(te.message)
      }
    }
    return { id: packageId }
  }

  async deleteDecoratorPackage(userId: string, packageId: string) {
    const client = this.supabase.getAdminClient()
    const vendor = await this.getVendorByUserId(userId)
    const { error } = await client
      .from('decorator_packages')
      .update({ is_active: false })
      .eq('id', packageId)
      .eq('vendor_id', vendor.id)
    if (error) throw new InternalServerErrorException(error.message)
    return { id: packageId }
  }

  // ── Photo management ─────────────────────────────────────────────────────────

  async getPhotoUploadUrl(userId: string, filename: string) {
    const client = this.supabase.getAdminClient()
    const vendor = await this.getVendorByUserId(userId)

    const ext = filename.split('.').pop()?.toLowerCase() ?? 'jpg'
    const path = `${vendor.id}/${Date.now()}.${ext}`

    const { data, error } = await client.storage
      .from('vendor-photos')
      .createSignedUploadUrl(path)

    if (error) throw new InternalServerErrorException(error.message)

    const { data: { publicUrl } } = client.storage
      .from('vendor-photos')
      .getPublicUrl(path)

    return { signedUrl: data.signedUrl, publicUrl }
  }

  async addPhoto(userId: string, url: string) {
    const client = this.supabase.getAdminClient()
    const vendor = await this.getVendorByUserId(userId)

    const photos = [...((vendor as any).photos ?? []), url]
    const { error } = await client.from('vendors').update({ photos }).eq('id', vendor.id)
    if (error) throw new InternalServerErrorException(error.message)
    return { photos }
  }

  async deletePhoto(userId: string, url: string) {
    const client = this.supabase.getAdminClient()
    const vendor = await this.getVendorByUserId(userId)

    const photos = ((vendor as any).photos ?? []).filter((p: string) => p !== url)
    const { error } = await client.from('vendors').update({ photos }).eq('id', vendor.id)
    if (error) throw new InternalServerErrorException(error.message)

    // Best-effort removal from storage
    try {
      const prefix = '/storage/v1/object/public/vendor-photos/'
      const idx = url.indexOf(prefix)
      if (idx !== -1) {
        await client.storage.from('vendor-photos').remove([url.slice(idx + prefix.length)])
      }
    } catch {}

    return { photos }
  }

  // ── Payment structure management ─────────────────────────────────────────────

  async getPaymentStructure(userId: string) {
    const client = this.supabase.getAdminClient()
    const vendor = await this.getVendorByUserId(userId)
    const { data } = await client
      .from('vendor_payment_structures')
      .select('*')
      .eq('vendor_id', vendor.id)
      .single()
    return data ?? null
  }

  async savePaymentStructure(
    userId: string,
    dto: {
      commitmentPct: number
      materialsPct: number
      balancePct: number
      commitmentReleaseDays: number
      materialsReleaseDays: number
      balanceReleaseHours: number
    },
  ) {
    const client = this.supabase.getAdminClient()
    const vendor = await this.getVendorByUserId(userId)

    const total = dto.commitmentPct + dto.materialsPct + dto.balancePct
    if (total !== 100) throw new BadRequestException('Percentages must sum to 100')
    if (dto.balancePct < 20) throw new BadRequestException('Balance must be at least 20%')
    if (dto.commitmentPct < 10) throw new BadRequestException('Commitment fee must be at least 10%')
    if (dto.commitmentReleaseDays < 7) throw new BadRequestException('Commitment release must be at least 7 days before event')
    if (dto.materialsReleaseDays < 7) throw new BadRequestException('Materials release must be at least 7 days before event')
    if (dto.balanceReleaseHours < 24 || dto.balanceReleaseHours > 168) {
      throw new BadRequestException('Balance release must be between 24 and 168 hours after event')
    }

    const record = {
      vendor_id: vendor.id,
      commitment_pct: dto.commitmentPct,
      materials_pct: dto.materialsPct,
      balance_pct: dto.balancePct,
      commitment_release_days: dto.commitmentReleaseDays,
      materials_release_days: dto.materialsReleaseDays,
      balance_release_hours: dto.balanceReleaseHours,
      is_active: false, // inactive until terms agreed
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await client
      .from('vendor_payment_structures')
      .upsert(record, { onConflict: 'vendor_id' })
      .select()
      .single()

    if (error) throw new InternalServerErrorException(error.message)
    return data
  }

  async agreeToPaymentTerms(userId: string) {
    const client = this.supabase.getAdminClient()
    const vendor = await this.getVendorByUserId(userId)

    const { data: existing } = await client
      .from('vendor_payment_structures')
      .select('id')
      .eq('vendor_id', vendor.id)
      .single()

    if (!existing) throw new BadRequestException('Set up your payment structure before agreeing to terms')

    const { data, error } = await client
      .from('vendor_payment_structures')
      .update({
        is_active: true,
        terms_agreed_at: new Date().toISOString(),
        terms_version: 1,
        updated_at: new Date().toISOString(),
      })
      .eq('vendor_id', vendor.id)
      .select()
      .single()

    if (error) throw new InternalServerErrorException(error.message)
    return data
  }

  // ── Vendor cancellation flow ──────────────────────────────────────────────────

  async cancelBookingAsVendor(userId: string, interestId: string, reason?: string) {
    const client = this.supabase.getAdminClient()
    const vendor = await this.getVendorByUserId(userId)

    const { data: interest, error: ie } = await client
      .from('vendor_interests')
      .select(`
        id, status, event_id, offered_price, agreed_price, total_contract_kobo,
        events (id, title, event_date, user_id),
        users (email, full_name)
      `)
      .eq('id', interestId)
      .eq('vendor_id', vendor.id)
      .single()

    if (ie || !interest) throw new NotFoundException('Booking not found')
    if (!['available', 'committed'].includes(interest.status)) {
      throw new BadRequestException('Only confirmed bookings can be cancelled')
    }

    // Calculate what has already been released vs still held
    const { data: schedule } = await client
      .from('interest_payment_schedule')
      .select('bucket, amount_kobo, status')
      .eq('interest_id', interestId)

    const releasedKobo = (schedule ?? [])
      .filter((s) => s.status === 'released')
      .reduce((sum, s) => sum + s.amount_kobo, 0)

    const heldKobo = (schedule ?? [])
      .filter((s) => s.status === 'scheduled')
      .reduce((sum, s) => sum + s.amount_kobo, 0)

    const outstandingKobo = releasedKobo // vendor must repay what was already released
    const repaymentDeadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    // Mark all held schedule entries as refunded
    if (heldKobo > 0) {
      await client
        .from('interest_payment_schedule')
        .update({ status: 'refunded', refunded_at: new Date().toISOString() })
        .eq('interest_id', interestId)
        .eq('status', 'scheduled')
    }

    // Mark interest as cancelled
    await client
      .from('vendor_interests')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), cancelled_by: 'vendor' })
      .eq('id', interestId)

    // Create cancellation record
    const { data: cancellation, error: ce } = await client
      .from('booking_cancellations')
      .insert({
        interest_id: interestId,
        cancelled_by: 'vendor',
        held_funds_returned_kobo: heldKobo,
        outstanding_kobo: outstandingKobo,
        repayment_deadline: outstandingKobo > 0 ? repaymentDeadline : null,
        status: outstandingKobo > 0 ? 'pending' : 'no_outstanding',
      })
      .select()
      .single()

    if (ce || !cancellation) throw new InternalServerErrorException('Failed to record cancellation')

    // Build transparency timeline
    const events: { event_type: string; message: string }[] = []
    const heldNaira = Math.round(heldKobo / 100).toLocaleString()
    const outstandingNaira = Math.round(outstandingKobo / 100).toLocaleString()

    events.push({ event_type: 'cancelled', message: `Vendor cancelled the booking.${reason ? ` Reason: ${reason}` : ''}` })

    if (heldKobo > 0) {
      events.push({ event_type: 'held_returned', message: `₦${heldNaira} returned to you immediately (funds held by Owambe).` })
    }

    if (outstandingKobo > 0) {
      events.push({ event_type: 'repayment_demanded', message: `₦${outstandingNaira} outstanding — vendor has been notified and has 7 days to refund you. Deadline: ${new Date(repaymentDeadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.` })
    } else {
      events.push({ event_type: 'resolved', message: 'No additional funds outstanding. Your full payment has been returned.' })
    }

    await client.from('cancellation_events').insert(
      events.map((e) => ({ ...e, cancellation_id: cancellation.id }))
    )

    // Notify organiser
    const organiserEmail = (interest.users as any)?.email
    const organiserName = (interest.users as any)?.full_name ?? 'there'
    const eventTitle = (interest.events as any)?.title ?? 'your event'
    const eventDate = (interest.events as any)?.event_date ?? ''
    if (organiserEmail) {
      await this.email.sendVendorCancelledToOrganiser({
        to: organiserEmail,
        organizerName: organiserName,
        vendorName: vendor.name,
        eventTitle,
        eventDate,
        heldRefundedNaira: Math.round(heldKobo / 100),
        outstandingNaira: Math.round(outstandingKobo / 100),
        repaymentDeadline: outstandingKobo > 0 ? repaymentDeadline : null,
      })
    }

    // Notify vendor of repayment obligation
    if (outstandingKobo > 0 && vendor.email) {
      await this.email.sendRepaymentDemandToVendor({
        to: vendor.email,
        vendorName: vendor.name,
        organizerName: organiserName,
        eventTitle,
        outstandingNaira: Math.round(outstandingKobo / 100),
        repaymentDeadline,
      })
    }

    return { cancellation, heldKobo, outstandingKobo }
  }

  async requestCancellationExtension(userId: string, interestId: string) {
    const client = this.supabase.getAdminClient()
    const vendor = await this.getVendorByUserId(userId)

    const { data: cancellation, error } = await client
      .from('booking_cancellations')
      .select('id, status, extension_granted, repayment_deadline, interest_id, vendor_interests!inner(vendor_id)')
      .eq('interest_id', interestId)
      .eq('cancelled_by', 'vendor')
      .single()

    if (error || !cancellation) throw new NotFoundException('Cancellation not found')
    if ((cancellation.vendor_interests as any)?.vendor_id !== vendor.id) throw new BadRequestException('Not authorised')
    if (cancellation.extension_granted) throw new BadRequestException('Extension already granted')
    if (cancellation.status !== 'pending') throw new BadRequestException('Extension can only be requested while repayment is pending')

    const newDeadline = new Date(new Date(cancellation.repayment_deadline).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()

    await client
      .from('booking_cancellations')
      .update({
        extension_granted: true,
        extension_requested_at: new Date().toISOString(),
        repayment_deadline: newDeadline,
        status: 'extension_granted',
        updated_at: new Date().toISOString(),
      })
      .eq('id', cancellation.id)

    await client.from('cancellation_events').insert({
      cancellation_id: cancellation.id,
      event_type: 'extension_granted',
      message: `Vendor requested a 7-day extension. New repayment deadline: ${new Date(newDeadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.`,
    })

    // Notify organiser of the extension
    const { data: interest } = await client
      .from('vendor_interests')
      .select(`vendors(name), events(title), users(email, full_name)`)
      .eq('id', interestId)
      .single()

    const organiserEmail = (interest as any)?.users?.email
    if (organiserEmail) {
      await this.email.sendExtensionGrantedToOrganiser({
        to: organiserEmail,
        organizerName: (interest as any)?.users?.full_name ?? 'there',
        vendorName: (interest as any)?.vendors?.name ?? 'The vendor',
        eventTitle: (interest as any)?.events?.title ?? 'your event',
        newDeadline,
      })
    }

    return { newDeadline }
  }

  private async getPlatformSettings(client: ReturnType<SupabaseService['getAdminClient']>) {
    const { data } = await client.from('platform_settings').select('key, value')
    const settings: Record<string, unknown> = {}
    for (const row of data ?? []) {
      settings[row.key] = row.value
    }
    return settings
  }
}
