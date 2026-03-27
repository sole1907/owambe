import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common'
import { SupabaseService } from '../supabase/supabase.service'

type VendorFilters = {
  categorySlug?: string
  city?: string
  budgetMax?: number
}

@Injectable()
export class VendorsService {
  constructor(private supabase: SupabaseService) {}

  async getVendors(filters: VendorFilters) {
    const client = this.supabase.getClient()

    let query = client
      .from('vendors')
      .select(
        `
        id, name, slug, description, city, location,
        price_min, price_max, rating, review_count,
        photos, whatsapp, phone, instagram, is_featured,
        vendor_categories (id, name, slug)
      `,
      )
      .eq('is_active', true)
      .order('is_featured', { ascending: false })
      .order('rating', { ascending: false })

    if (filters.city) {
      query = query.ilike('city', `%${filters.city}%`)
    }

    if (filters.budgetMax) {
      query = query.lte('price_min', filters.budgetMax)
    }

    if (filters.categorySlug) {
      const { data: category } = await client
        .from('vendor_categories')
        .select('id')
        .eq('slug', filters.categorySlug)
        .single()

      if (category) {
        query = query.eq('category_id', category.id)
      }
    }

    const { data, error } = await query

    if (error) throw new InternalServerErrorException(error.message)
    return data
  }

  async getVendor(slug: string) {
    const client = this.supabase.getClient()

    const { data, error } = await client
      .from('vendors')
      .select(
        `
        *,
        vendor_categories (id, name, slug)
      `,
      )
      .eq('slug', slug)
      .eq('is_active', true)
      .single()

    if (error || !data) throw new NotFoundException('Vendor not found')
    return data
  }

  async getRecommendedVendors(eventId: string, userId: string) {
    const client = this.supabase.getClient()

    // Fetch event details
    const { data: event, error: eventError } = await client
      .from('events')
      .select('city, budget_estimate, event_type, has_existing_vendors')
      .eq('id', eventId)
      .eq('user_id', userId)
      .single()

    if (eventError || !event) throw new NotFoundException('Event not found')

    let query = client
      .from('vendors')
      .select(
        `
        id, name, slug, description, city, location,
        price_min, price_max, rating, review_count,
        photos, whatsapp, phone, instagram, is_featured,
        vendor_categories (id, name, slug)
      `,
      )
      .eq('is_active', true)
      .order('is_featured', { ascending: false })
      .order('rating', { ascending: false })
      .limit(12)

    // Filter by event city
    if (event.city) {
      query = query.ilike('city', `%${event.city}%`)
    }

    // Filter by budget — vendor min price should not exceed ~35% of total budget
    if (event.budget_estimate) {
      const maxVendorPrice = Math.round(event.budget_estimate * 0.35)
      query = query.lte('price_min', maxVendorPrice)
    }

    const { data, error } = await query

    if (error) throw new InternalServerErrorException(error.message)
    return data
  }

  async getCategories() {
    const client = this.supabase.getClient()
    const { data, error } = await client
      .from('vendor_categories')
      .select('id, name, slug')
      .eq('is_active', true)
      .order('name')

    if (error) throw new InternalServerErrorException(error.message)
    return data
  }
}
