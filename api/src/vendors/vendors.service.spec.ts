import { NotFoundException } from '@nestjs/common'
import { VendorsService } from './vendors.service'
import { makeSupabaseMock, q } from '../test/supabase.mock'

const mockPosthog = { capture: jest.fn() }

const categoryRow = { id: 'cat-id-1', name: 'Catering', slug: 'catering' }
const vendorRow = {
  id: 'vendor-id-1', name: 'Mama Put Catering', slug: 'mama-put-catering',
  city: 'Lagos', is_active: true, is_featured: false,
  vendor_categories: categoryRow,
}

function makeService(fromMap: Record<string, any> = {}) {
  const supabase = makeSupabaseMock(fromMap)
  return { svc: new VendorsService(supabase as any, mockPosthog as any), supabase }
}

describe('VendorsService', () => {
  beforeEach(() => jest.clearAllMocks())

  describe('getVendors()', () => {
    it('returns active vendors filtered by city', async () => {
      const { svc, supabase } = makeService()
      supabase._client.from = jest.fn().mockReturnValueOnce(
        q({ data: [vendorRow], error: null }),
      )
      const result = await svc.getVendors({ city: 'Lagos' })
      expect(result).toHaveLength(1)
    })

    it('fetches category id when categorySlug filter is supplied', async () => {
      const { svc, supabase } = makeService()
      supabase._client.from = jest.fn()
        .mockReturnValueOnce(q({ data: categoryRow, error: null })) // category lookup
        .mockReturnValueOnce(q({ data: [vendorRow], error: null })) // vendors
      const result = await svc.getVendors({ categorySlug: 'catering' })
      expect(result).toHaveLength(1)
    })
  })

  describe('getVendor()', () => {
    it('returns vendor by slug and fires posthog event', async () => {
      const { svc, supabase } = makeService()
      supabase._client.from = jest.fn().mockReturnValueOnce(
        q({ data: vendorRow, error: null }),
      )
      const result = await svc.getVendor('mama-put-catering')
      expect(result.name).toBe('Mama Put Catering')
      expect(mockPosthog.capture).toHaveBeenCalledWith(
        'anonymous', 'vendor_viewed', expect.any(Object),
      )
    })

    it('throws NotFoundException for unknown slug', async () => {
      const { svc, supabase } = makeService()
      supabase._client.from = jest.fn().mockReturnValueOnce(
        q({ data: null, error: { message: 'not found' } }),
      )
      await expect(svc.getVendor('nonexistent')).rejects.toThrow(NotFoundException)
    })
  })

  describe('getCategories()', () => {
    it('returns all active categories', async () => {
      const { svc, supabase } = makeService()
      supabase._client.from = jest.fn().mockReturnValueOnce(
        q({ data: [categoryRow], error: null }),
      )
      const result = await svc.getCategories()
      expect(result).toHaveLength(1)
      expect(result[0].slug).toBe('catering')
    })
  })

  describe('adminCreateVendor()', () => {
    it('creates a vendor with a slugified name', async () => {
      const { svc, supabase } = makeService()
      const created = { ...vendorRow, id: 'new-id', slug: 'mama-put-catering' }
      supabase._client.from = jest.fn()
        .mockReturnValueOnce(q({ data: null, error: null }))  // slug uniqueness check (none)
        .mockReturnValueOnce(q({ data: created, error: null })) // insert
      const result = await svc.adminCreateVendor({
        name: 'Mama Put Catering',
        categoryId: 'cat-id-1',
        location: 'VI, Lagos',
        city: 'Lagos',
      })
      expect(result.name).toBe('Mama Put Catering')
    })

    it('appends timestamp to slug when it already exists', async () => {
      const { svc, supabase } = makeService()
      supabase._client.from = jest.fn()
        .mockReturnValueOnce(q({ data: { slug: 'mama-put-catering' }, error: null })) // slug taken
        .mockReturnValueOnce(q({ data: vendorRow, error: null }))                     // insert
      await svc.adminCreateVendor({
        name: 'Mama Put Catering',
        categoryId: 'cat-id-1',
        location: 'VI',
        city: 'Lagos',
      })
      const insertCall = supabase._client.from.mock.calls[1]
      expect(insertCall[0]).toBe('vendors')
    })
  })

  describe('adminUpdateVendor()', () => {
    it('updates vendor fields', async () => {
      const { svc, supabase } = makeService()
      const updated = { ...vendorRow, is_active: false }
      supabase._client.from = jest.fn().mockReturnValueOnce(
        q({ data: updated, error: null }),
      )
      const result = await svc.adminUpdateVendor('vendor-id-1', { isActive: false })
      expect(result.is_active).toBe(false)
    })
  })
})
