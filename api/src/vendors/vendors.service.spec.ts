import { NotFoundException } from '@nestjs/common'
import { VendorsService } from './vendors.service'
import { makeSupabaseMock, q } from '../test/supabase.mock'

const mockPosthog = { capture: jest.fn() }

const categoryRow = { id: 'cat-id-1', name: 'Catering', slug: 'catering' }
const vendorRow = {
  id: 'vendor-id-1',
  name: 'Mama Put Catering',
  slug: 'mama-put-catering',
  city: 'Lagos',
  is_active: true,
  is_featured: false,
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
      supabase._client.from = jest.fn().mockReturnValueOnce(q({ data: [vendorRow], error: null }))
      const result = await svc.getVendors({ city: 'Lagos' })
      expect(result).toHaveLength(1)
    })

    it('fetches category id when categorySlug filter is supplied', async () => {
      const { svc, supabase } = makeService()
      supabase._client.from = jest
        .fn()
        .mockReturnValueOnce(q({ data: [vendorRow], error: null })) // vendors (built first)
        .mockReturnValueOnce(q({ data: categoryRow, error: null })) // category lookup (inside if)
      const result = await svc.getVendors({ categorySlug: 'catering' })
      expect(result).toHaveLength(1)
    })
  })

  describe('getVendor()', () => {
    it('returns vendor by slug and fires posthog event', async () => {
      const { svc, supabase } = makeService()
      supabase._client.from = jest.fn().mockReturnValueOnce(q({ data: vendorRow, error: null }))
      const result = await svc.getVendor('mama-put-catering')
      expect(result.name).toBe('Mama Put Catering')
      expect(mockPosthog.capture).toHaveBeenCalledWith(
        'anonymous',
        'vendor_viewed',
        expect.any(Object),
      )
    })

    it('throws NotFoundException for unknown slug', async () => {
      const { svc, supabase } = makeService()
      supabase._client.from = jest
        .fn()
        .mockReturnValueOnce(q({ data: null, error: { message: 'not found' } }))
      await expect(svc.getVendor('nonexistent')).rejects.toThrow(NotFoundException)
    })
  })

  describe('getCategories()', () => {
    it('returns all active categories', async () => {
      const { svc, supabase } = makeService()
      supabase._client.from = jest.fn().mockReturnValueOnce(q({ data: [categoryRow], error: null }))
      const result = await svc.getCategories()
      expect(result).toHaveLength(1)
      expect(result[0].slug).toBe('catering')
    })
  })

  describe('adminCreateVendor()', () => {
    it('creates a vendor with a slugified name', async () => {
      const { svc, supabase } = makeService()
      const created = { ...vendorRow, id: 'new-id', slug: 'mama-put-catering' }
      supabase._client.from = jest
        .fn()
        .mockReturnValueOnce(q({ data: null, error: null })) // slug uniqueness check (none)
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
      supabase._client.from = jest
        .fn()
        .mockReturnValueOnce(q({ data: { slug: 'mama-put-catering' }, error: null })) // slug taken
        .mockReturnValueOnce(q({ data: vendorRow, error: null })) // insert
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
      supabase._client.from = jest.fn().mockReturnValueOnce(q({ data: updated, error: null }))
      const result = await svc.adminUpdateVendor('vendor-id-1', { isActive: false })
      expect(result.is_active).toBe(false)
    })
  })

  describe('getMenuCatalog()', () => {
    it('returns empty array when caterers category not found', async () => {
      const { svc, supabase } = makeService()
      supabase._client.from = jest.fn()
        .mockReturnValueOnce(q({ data: null, error: null })) // vendor_categories
      const result = await svc.getMenuCatalog('Lagos')
      expect(result).toEqual([])
    })

    it('returns empty array when no caterer vendors in city', async () => {
      const { svc, supabase } = makeService()
      supabase._client.from = jest.fn()
        .mockReturnValueOnce(q({ data: { id: 'cat-1' }, error: null })) // vendor_categories
        .mockReturnValueOnce(q({ data: [], error: null })) // vendors
      const result = await svc.getMenuCatalog('Lagos')
      expect(result).toEqual([])
    })

    it('returns grouped and deduplicated menu catalog', async () => {
      const { svc, supabase } = makeService()
      supabase._client.from = jest.fn()
        .mockReturnValueOnce(q({ data: { id: 'cat-1' }, error: null })) // vendor_categories
        .mockReturnValueOnce(q({ data: [{ id: 'ven-1' }, { id: 'ven-2' }], error: null })) // vendors
        .mockReturnValueOnce(q({ data: [{ name: 'Jollof Rice', category: 'Rice' }, { name: 'Jollof Rice', category: 'Rice' }, { name: 'Beans', category: 'Proteins' }], error: null })) // caterer_menu_items
      const result = await svc.getMenuCatalog('Lagos')
      expect(result.length).toBeGreaterThan(0)
      const rice = result.find((g) => g.category === 'Rice')
      expect(rice?.items).toEqual(['Jollof Rice']) // deduplicated
    })
  })

  describe('getVendorMenu()', () => {
    it('returns empty array when vendor not found', async () => {
      const { svc, supabase } = makeService()
      supabase._client.from = jest.fn().mockReturnValueOnce(q({ data: null, error: null }))
      const result = await svc.getVendorMenu('unknown-slug')
      expect(result).toEqual([])
    })

    it('returns menu items for vendor', async () => {
      const menuItems = [{ id: 'item-1', name: 'Jollof Rice', category: 'Rice', description: null, sort_order: 1, caterer_menu_pricing_tiers: [] }]
      const { svc, supabase } = makeService()
      supabase._client.from = jest.fn()
        .mockReturnValueOnce(q({ data: { id: 'ven-1' }, error: null })) // vendors
        .mockReturnValueOnce(q({ data: menuItems, error: null })) // caterer_menu_items
      const result = await svc.getVendorMenu('vendor-slug')
      expect(result).toEqual(menuItems)
    })

    it('returns empty array on error', async () => {
      const { svc, supabase } = makeService()
      supabase._client.from = jest.fn()
        .mockReturnValueOnce(q({ data: { id: 'ven-1' }, error: null }))
        .mockReturnValueOnce(q({ data: null, error: { message: 'DB error' } }))
      const result = await svc.getVendorMenu('vendor-slug')
      expect(result).toEqual([])
    })
  })

  describe('getStyleCatalog()', () => {
    it('returns empty array when decorators category not found', async () => {
      const { svc, supabase } = makeService()
      supabase._client.from = jest.fn().mockReturnValueOnce(q({ data: null, error: null }))
      const result = await svc.getStyleCatalog('Lagos')
      expect(result).toEqual([])
    })

    it('returns empty array when no decorators in city', async () => {
      const { svc, supabase } = makeService()
      supabase._client.from = jest.fn()
        .mockReturnValueOnce(q({ data: { id: 'cat-2' }, error: null }))
        .mockReturnValueOnce(q({ data: [], error: null }))
      const result = await svc.getStyleCatalog('Lagos')
      expect(result).toEqual([])
    })

    it('returns deduplicated styles across vendors', async () => {
      const { svc, supabase } = makeService()
      supabase._client.from = jest.fn()
        .mockReturnValueOnce(q({ data: { id: 'cat-2' }, error: null }))
        .mockReturnValueOnce(q({ data: [{ id: 'ven-1' }, { id: 'ven-2' }], error: null }))
        .mockReturnValueOnce(q({ data: [{ style: 'Modern' }, { style: 'Modern' }, { style: 'Traditional' }], error: null }))
      const result = await svc.getStyleCatalog('Lagos')
      expect(result).toHaveLength(2)
      expect(result.map((s) => s.style)).toEqual(['Modern', 'Traditional'])
    })
  })

  describe('getVendorPackages()', () => {
    it('returns empty array when vendor not found', async () => {
      const { svc, supabase } = makeService()
      supabase._client.from = jest.fn().mockReturnValueOnce(q({ data: null, error: null }))
      const result = await svc.getVendorPackages('unknown-slug')
      expect(result).toEqual([])
    })

    it('returns decorator packages for vendor', async () => {
      const packages = [{ id: 'pkg-1', name: 'Classic', description: 'Elegant', includes: ['Flowers'], sort_order: 1, decorator_package_guest_tiers: [] }]
      const { svc, supabase } = makeService()
      supabase._client.from = jest.fn()
        .mockReturnValueOnce(q({ data: { id: 'ven-1' }, error: null }))
        .mockReturnValueOnce(q({ data: packages, error: null }))
      const result = await svc.getVendorPackages('vendor-slug')
      expect(result).toEqual(packages)
    })
  })

  describe('adminGetAllVendors()', () => {
    it('returns all vendors', async () => {
      const { svc, supabase } = makeService()
      supabase._client.from = jest.fn().mockReturnValueOnce(q({ data: [vendorRow], error: null }))
      const result = await svc.adminGetAllVendors()
      expect(result).toHaveLength(1)
    })

    it('throws InternalServerErrorException on DB error', async () => {
      const { InternalServerErrorException } = require('@nestjs/common')
      const { svc, supabase } = makeService()
      supabase._client.from = jest.fn().mockReturnValueOnce(q({ data: null, error: { message: 'DB error' } }))
      await expect(svc.adminGetAllVendors()).rejects.toThrow(InternalServerErrorException)
    })
  })

  describe('adminGetVendor()', () => {
    it('returns vendor by id', async () => {
      const { svc, supabase } = makeService()
      supabase._client.from = jest.fn().mockReturnValueOnce(q({ data: vendorRow, error: null }))
      const result = await svc.adminGetVendor('vendor-id-1')
      expect(result.name).toBe('Mama Put Catering')
    })

    it('throws NotFoundException for unknown id', async () => {
      const { svc, supabase } = makeService()
      supabase._client.from = jest.fn().mockReturnValueOnce(q({ data: null, error: { message: 'not found' } }))
      await expect(svc.adminGetVendor('unknown-id')).rejects.toThrow(NotFoundException)
    })
  })

  describe('adminCreateVendorUser()', () => {
    it('creates auth user, user record, and links vendor', async () => {
      const { svc, supabase } = makeService()
      // auth.admin.createUser is already mocked by makeSupabaseMock to return user-id-1
      supabase._client.from = jest.fn()
        .mockReturnValueOnce(q({ data: null, error: null })) // users insert
        .mockReturnValueOnce(q({ data: null, error: null })) // vendors update
      const result = await svc.adminCreateVendorUser('ven-1', 'vendor@test.com', 'Pass123!')
      expect(result.userId).toBe('user-id-1')
      expect(result.message).toBe('Vendor account created')
    })

    it('throws InternalServerErrorException when auth creation fails', async () => {
      const { InternalServerErrorException } = require('@nestjs/common')
      const { svc, supabase } = makeService()
      supabase._client.auth.admin.createUser = jest.fn().mockResolvedValue({ data: { user: null }, error: { message: 'Auth error' } })
      await expect(svc.adminCreateVendorUser('ven-1', 'bad@test.com', 'Pass123!')).rejects.toThrow(InternalServerErrorException)
    })
  })
})
