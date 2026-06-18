import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common'
import { SupabaseService } from '../supabase/supabase.service'
import { UpdateVendorProfileDto } from './dto/update-vendor-profile.dto'

@Injectable()
export class VendorPortalService {
  constructor(private supabase: SupabaseService) {}

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
    return { vendorId: vendor.id, year, month, blockedDates: data ?? [] }
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

  private async getPlatformSettings(client: ReturnType<SupabaseService['getAdminClient']>) {
    const { data } = await client.from('platform_settings').select('key, value')
    const settings: Record<string, unknown> = {}
    for (const row of data ?? []) {
      settings[row.key] = row.value
    }
    return settings
  }
}
