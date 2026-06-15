import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common'
import { SupabaseService } from '../supabase/supabase.service'
import { CreateVendorDto, UpdateVendorDto } from './dto/vendor.dto'
import { PostHogService } from '../analytics/posthog.service'

type VendorFilters = {
  categorySlug?: string
  city?: string
  budgetMax?: number
  minCapacity?: number // venues only: filter out venues smaller than guest count
}

@Injectable()
export class VendorsService {
  constructor(
    private supabase: SupabaseService,
    private posthog: PostHogService,
  ) {}

  async getVendors(filters: VendorFilters) {
    const client = this.supabase.getClient()

    let query = client
      .from('vendors')
      .select(
        `
        id, name, slug, description, city, location,
        price_min, price_max, rating, review_count, capacity,
        photos, videos, whatsapp, phone, instagram, is_featured,
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
        .select('id, slug')
        .eq('slug', filters.categorySlug)
        .single()

      if (category) {
        query = query.eq('category_id', category.id)
        // filter venues by capacity if requested
        if (category.slug === 'venues' && filters.minCapacity) {
          query = query.gte('capacity', filters.minCapacity)
        }
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

    this.posthog.capture('anonymous', 'vendor_viewed', {
      vendor_id: data.id,
      vendor_name: data.name,
      vendor_slug: slug,
      category: data.vendor_categories?.slug,
      city: data.city,
    })

    return data
  }

  async getRecommendedVendors(eventId: string, userId: string) {
    const client = this.supabase.getClient()

    // Fetch event details
    const { data: event, error: eventError } = await client
      .from('events')
      .select('city, budget_estimate, event_type, has_existing_vendors, guest_count')
      .eq('id', eventId)
      .eq('user_id', userId)
      .single()

    if (eventError || !event) throw new NotFoundException('Event not found')

    // Get venue category id for capacity filtering
    const { data: venueCategory } = await client
      .from('vendor_categories')
      .select('id')
      .eq('slug', 'venues')
      .single()

    let query = client
      .from('vendors')
      .select(
        `
        id, name, slug, description, city, location,
        price_min, price_max, rating, review_count, capacity,
        photos, videos, whatsapp, phone, instagram, is_featured,
        vendor_categories (id, name, slug)
      `,
      )
      .eq('is_active', true)
      .order('is_featured', { ascending: false })
      .order('rating', { ascending: false })
      .limit(20)

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

    // Post-filter: exclude venues too small for the event guest count
    const results = (data ?? []).filter((v: any) => {
      if (v.vendor_categories?.id === venueCategory?.id && v.capacity && event.guest_count) {
        return v.capacity >= event.guest_count
      }
      return true
    })

    return results.slice(0, 12)
  }

  private slugify(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
  }

  async adminGetAllVendors() {
    const client = this.supabase.getClient()
    const { data, error } = await client
      .from('vendors')
      .select(
        `id, name, slug, city, is_active, is_featured, rating, review_count,
         phone, whatsapp, instagram, price_min, price_max,
         vendor_categories (id, name, slug)`,
      )
      .order('created_at', { ascending: false })

    if (error) throw new InternalServerErrorException(error.message)
    return data
  }

  async adminGetVendor(id: string) {
    const client = this.supabase.getClient()
    const { data, error } = await client
      .from('vendors')
      .select(`*, vendor_categories (id, name, slug)`)
      .eq('id', id)
      .single()

    if (error || !data) throw new NotFoundException('Vendor not found')
    return data
  }

  async adminCreateVendor(dto: CreateVendorDto) {
    const client = this.supabase.getClient()

    // Generate a unique slug
    let slug = this.slugify(dto.name)
    const { data: existing } = await client.from('vendors').select('slug').eq('slug', slug).single()
    if (existing) {
      slug = `${slug}-${Date.now()}`
    }

    const { data, error } = await client
      .from('vendors')
      .insert({
        name: dto.name,
        slug,
        category_id: dto.categoryId,
        description: dto.description ?? null,
        location: dto.location,
        city: dto.city,
        price_min: dto.priceMin ?? null,
        price_max: dto.priceMax ?? null,
        phone: dto.phone ?? null,
        whatsapp: dto.whatsapp ?? null,
        email: dto.email ?? null,
        instagram: dto.instagram ?? null,
        website: dto.website ?? null,
        photos: dto.photos ?? [],
        videos: dto.videos ?? [],
        capacity: dto.capacity ?? null,
        is_featured: dto.isFeatured ?? false,
        is_active: true,
      })
      .select()
      .single()

    if (error) throw new InternalServerErrorException(error.message)
    return data
  }

  async adminUpdateVendor(id: string, dto: UpdateVendorDto) {
    const client = this.supabase.getClient()

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (dto.name !== undefined) updates.name = dto.name
    if (dto.categoryId !== undefined) updates.category_id = dto.categoryId
    if (dto.description !== undefined) updates.description = dto.description
    if (dto.location !== undefined) updates.location = dto.location
    if (dto.city !== undefined) updates.city = dto.city
    if (dto.priceMin !== undefined) updates.price_min = dto.priceMin
    if (dto.priceMax !== undefined) updates.price_max = dto.priceMax
    if (dto.phone !== undefined) updates.phone = dto.phone
    if (dto.whatsapp !== undefined) updates.whatsapp = dto.whatsapp
    if (dto.email !== undefined) updates.email = dto.email
    if (dto.instagram !== undefined) updates.instagram = dto.instagram
    if (dto.website !== undefined) updates.website = dto.website
    if (dto.photos !== undefined) updates.photos = dto.photos
    if (dto.videos !== undefined) updates.videos = dto.videos
    if (dto.capacity !== undefined) updates.capacity = dto.capacity
    if (dto.isFeatured !== undefined) updates.is_featured = dto.isFeatured
    if (dto.isActive !== undefined) updates.is_active = dto.isActive

    const { data, error } = await client
      .from('vendors')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw new InternalServerErrorException(error.message)
    return data
  }

  async adminCreateVendorUser(vendorId: string, email: string, password: string) {
    const authClient = this.supabase.getAuthClient()
    const adminClient = this.supabase.getAdminClient()

    // Create the auth user
    const { data: authData, error: authError } = await authClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (authError) throw new InternalServerErrorException(authError.message)

    // Create user record with vendor role
    const { error: userError } = await adminClient.from('users').insert({
      id: authData.user.id,
      email,
      full_name: '',
      role: 'vendor',
    })
    if (userError) throw new InternalServerErrorException(userError.message)

    // Link vendor to this user
    const { error: vendorError } = await adminClient
      .from('vendors')
      .update({ user_id: authData.user.id })
      .eq('id', vendorId)
    if (vendorError) throw new InternalServerErrorException(vendorError.message)

    return { message: 'Vendor account created', userId: authData.user.id }
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
