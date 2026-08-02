import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common'
import { VendorPortalService } from './vendor-portal.service'
import { makeSupabaseMock, q } from '../test/supabase.mock'
import { EmailService } from '../email/email.service'

const mockEmail = {
  sendVendorCancelledToOrganiser: jest.fn().mockResolvedValue(undefined),
  sendRepaymentDemandToVendor: jest.fn().mockResolvedValue(undefined),
  sendExtensionGrantedToOrganiser: jest.fn().mockResolvedValue(undefined),
}

const vendorRow = {
  id: 'ven-1',
  name: 'Vendor A',
  email: 'vendor@test.com',
  user_id: 'user-1',
  vendor_categories: { id: 'cat-1', name: 'Catering', slug: 'caterers' },
  commitment_fee_percentage: 30,
}

const platformSettingsRows = [
  { key: 'commitment_fee_min_pct', value: 10 },
  { key: 'commitment_fee_max_pct', value: 50 },
]

function makeService(fromMap: Record<string, ReturnType<typeof q>> = {}) {
  const supabase = makeSupabaseMock(fromMap)
  const service = new VendorPortalService(supabase as any, mockEmail as any as EmailService)
  return { service, supabase }
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('VendorPortalService', () => {
  describe('getProfile()', () => {
    it('throws NotFoundException when vendor not found', async () => {
      const { service } = makeService({
        vendors: q({ data: null, error: { message: 'not found' } }),
      })
      await expect(service.getProfile('user-1')).rejects.toThrow(NotFoundException)
    })

    it('returns vendor profile', async () => {
      const { service } = makeService({ vendors: q({ data: vendorRow, error: null }) })
      const result = await service.getProfile('user-1')
      expect(result).toEqual(vendorRow)
    })
  })

  describe('updateProfile()', () => {
    it('throws NotFoundException when vendor not found', async () => {
      const { service } = makeService({
        vendors: q({ data: null, error: { message: 'not found' } }),
      })
      await expect(service.updateProfile('user-1', {})).rejects.toThrow(NotFoundException)
    })

    it('throws BadRequestException when commitment fee out of range', async () => {
      const supabase = makeSupabaseMock()
      supabase._mockFrom.mockImplementation((table: string) => {
        if (table === 'vendors') return q({ data: vendorRow, error: null })
        if (table === 'platform_settings') return q({ data: platformSettingsRows, error: null })
        return q()
      })
      const service = new VendorPortalService(supabase as any, mockEmail as any as EmailService)
      await expect(service.updateProfile('user-1', { commitmentFeePercentage: 5 })).rejects.toThrow(
        BadRequestException,
      )
      await expect(
        service.updateProfile('user-1', { commitmentFeePercentage: 60 }),
      ).rejects.toThrow(BadRequestException)
    })

    it('updates profile with allowed fields', async () => {
      const supabase = makeSupabaseMock()
      supabase._mockFrom.mockImplementation((table: string) => {
        if (table === 'vendors') return q({ data: vendorRow, error: null })
        if (table === 'platform_settings') return q({ data: platformSettingsRows, error: null })
        return q()
      })
      const service = new VendorPortalService(supabase as any, mockEmail as any as EmailService)
      const result = await service.updateProfile('user-1', {
        phone: '0812345678',
        description: 'We cook',
      })
      expect(result).toEqual(vendorRow)
    })

    it('throws InternalServerErrorException on DB error', async () => {
      const supabase = makeSupabaseMock()
      let vendorCallCount = 0
      supabase._mockFrom.mockImplementation((table: string) => {
        if (table === 'platform_settings') return q({ data: platformSettingsRows, error: null })
        if (table === 'vendors') {
          vendorCallCount++
          if (vendorCallCount === 1) return q({ data: vendorRow, error: null }) // getVendorByUserId
          return q({ data: null, error: { message: 'DB error' } }) // update
        }
        return q()
      })
      const service = new VendorPortalService(supabase as any, mockEmail as any as EmailService)
      await expect(service.updateProfile('user-1', { phone: '0812345678' })).rejects.toThrow(
        InternalServerErrorException,
      )
    })
  })

  describe('getAvailability()', () => {
    it('throws NotFoundException when vendor not found', async () => {
      const { service } = makeService({
        vendors: q({ data: null, error: { message: 'not found' } }),
      })
      await expect(service.getAvailability('user-1', 2099, 6)).rejects.toThrow(NotFoundException)
    })

    it('returns availability data', async () => {
      const availData = [{ date: '2099-06-15', status: 'blocked', event_id: null }]
      const supabase = makeSupabaseMock()
      supabase._mockFrom.mockImplementation((table: string) => {
        if (table === 'vendors') return q({ data: vendorRow, error: null })
        if (table === 'vendor_availability') return q({ data: availData, error: null })
        return q()
      })
      const service = new VendorPortalService(supabase as any, mockEmail as any as EmailService)
      const result = await service.getAvailability('user-1', 2099, 6)
      expect(result).toEqual(availData)
    })

    it('throws InternalServerErrorException on DB error', async () => {
      const supabase = makeSupabaseMock()
      supabase._mockFrom.mockImplementation((table: string) => {
        if (table === 'vendors') return q({ data: vendorRow, error: null })
        if (table === 'vendor_availability')
          return q({ data: null, error: { message: 'DB error' } })
        return q()
      })
      const service = new VendorPortalService(supabase as any, mockEmail as any as EmailService)
      await expect(service.getAvailability('user-1', 2099, 6)).rejects.toThrow(
        InternalServerErrorException,
      )
    })
  })

  describe('blockDate()', () => {
    it('throws NotFoundException when vendor not found', async () => {
      const { service } = makeService({
        vendors: q({ data: null, error: { message: 'not found' } }),
      })
      await expect(service.blockDate('user-1', '2099-06-15')).rejects.toThrow(NotFoundException)
    })

    it('throws BadRequestException when date is already booked', async () => {
      const supabase = makeSupabaseMock()
      supabase._mockFrom.mockImplementation((table: string) => {
        if (table === 'vendors') return q({ data: vendorRow, error: null })
        if (table === 'vendor_availability')
          return q({ data: { id: 'av-1', status: 'booked' }, error: null })
        return q()
      })
      const service = new VendorPortalService(supabase as any, mockEmail as any as EmailService)
      await expect(service.blockDate('user-1', '2099-06-15')).rejects.toThrow(BadRequestException)
    })

    it('blocks date successfully', async () => {
      const supabase = makeSupabaseMock()
      supabase._mockFrom.mockImplementation((table: string) => {
        if (table === 'vendors') return q({ data: vendorRow, error: null })
        if (table === 'vendor_availability') return q({ data: null, error: null })
        return q()
      })
      const service = new VendorPortalService(supabase as any, mockEmail as any as EmailService)
      const result = await service.blockDate('user-1', '2099-06-15')
      expect(result).toEqual({ date: '2099-06-15', status: 'blocked' })
    })

    it('throws InternalServerErrorException on DB error', async () => {
      const supabase = makeSupabaseMock()
      let avCallCount = 0
      supabase._mockFrom.mockImplementation((table: string) => {
        if (table === 'vendors') return q({ data: vendorRow, error: null })
        if (table === 'vendor_availability') {
          avCallCount++
          if (avCallCount === 1) return q({ data: null, error: null }) // existing check
          return q({ data: null, error: { message: 'DB error' } }) // upsert
        }
        return q()
      })
      const service = new VendorPortalService(supabase as any, mockEmail as any as EmailService)
      await expect(service.blockDate('user-1', '2099-06-15')).rejects.toThrow(
        InternalServerErrorException,
      )
    })
  })

  describe('unblockDate()', () => {
    it('throws BadRequestException when date is booked', async () => {
      const supabase = makeSupabaseMock()
      supabase._mockFrom.mockImplementation((table: string) => {
        if (table === 'vendors') return q({ data: vendorRow, error: null })
        if (table === 'vendor_availability') return q({ data: { status: 'booked' }, error: null })
        return q()
      })
      const service = new VendorPortalService(supabase as any, mockEmail as any as EmailService)
      await expect(service.unblockDate('user-1', '2099-06-15')).rejects.toThrow(BadRequestException)
    })

    it('unblocks date successfully', async () => {
      const supabase = makeSupabaseMock()
      supabase._mockFrom.mockImplementation((table: string) => {
        if (table === 'vendors') return q({ data: vendorRow, error: null })
        if (table === 'vendor_availability') return q({ data: null, error: null })
        return q()
      })
      const service = new VendorPortalService(supabase as any, mockEmail as any as EmailService)
      const result = await service.unblockDate('user-1', '2099-06-15')
      expect(result).toEqual({ date: '2099-06-15', status: 'available' })
    })
  })

  describe('getMenu()', () => {
    it('throws NotFoundException when vendor not found', async () => {
      const { service } = makeService({
        vendors: q({ data: null, error: { message: 'not found' } }),
      })
      await expect(service.getMenu('user-1')).rejects.toThrow(NotFoundException)
    })

    it('returns menu items', async () => {
      const menuItems = [
        { id: 'item-1', name: 'Jollof Rice', category: 'Rice', caterer_menu_pricing_tiers: [] },
      ]
      const supabase = makeSupabaseMock()
      supabase._mockFrom.mockImplementation((table: string) => {
        if (table === 'vendors') return q({ data: vendorRow, error: null })
        if (table === 'caterer_menu_items') return q({ data: menuItems, error: null })
        return q()
      })
      const service = new VendorPortalService(supabase as any, mockEmail as any as EmailService)
      const result = await service.getMenu('user-1')
      expect(result).toEqual(menuItems)
    })
  })

  describe('addMenuItem()', () => {
    it('throws NotFoundException when vendor not found', async () => {
      const { service } = makeService({
        vendors: q({ data: null, error: { message: 'not found' } }),
      })
      await expect(
        service.addMenuItem('user-1', { name: 'Rice', category: 'Mains', tiers: [] }),
      ).rejects.toThrow(NotFoundException)
    })

    it('creates menu item without tiers', async () => {
      const supabase = makeSupabaseMock()
      supabase._mockFrom.mockImplementation((table: string) => {
        if (table === 'vendors') return q({ data: vendorRow, error: null })
        if (table === 'caterer_menu_items')
          return q({ data: { id: 'item-1', name: 'Rice' }, error: null })
        return q()
      })
      const service = new VendorPortalService(supabase as any, mockEmail as any as EmailService)
      const result = await service.addMenuItem('user-1', {
        name: 'Rice',
        category: 'Mains',
        tiers: [],
      })
      expect(result.id).toBe('item-1')
    })

    it('creates menu item with tiers', async () => {
      const supabase = makeSupabaseMock()
      supabase._mockFrom.mockImplementation((table: string) => {
        if (table === 'vendors') return q({ data: vendorRow, error: null })
        if (table === 'caterer_menu_items')
          return q({ data: { id: 'item-1', name: 'Rice' }, error: null })
        if (table === 'caterer_menu_pricing_tiers') return q({ data: null, error: null })
        return q()
      })
      const service = new VendorPortalService(supabase as any, mockEmail as any as EmailService)
      const result = await service.addMenuItem('user-1', {
        name: 'Rice',
        category: 'Mains',
        tiers: [{ minServings: 50, pricePerServing: 500 }],
      })
      expect(result.id).toBe('item-1')
    })
  })

  describe('deleteMenuItem()', () => {
    it('soft-deletes menu item', async () => {
      const supabase = makeSupabaseMock()
      supabase._mockFrom.mockImplementation((table: string) => {
        if (table === 'vendors') return q({ data: vendorRow, error: null })
        if (table === 'caterer_menu_items') return q({ data: null, error: null })
        return q()
      })
      const service = new VendorPortalService(supabase as any, mockEmail as any as EmailService)
      const result = await service.deleteMenuItem('user-1', 'item-1')
      expect(result).toEqual({ id: 'item-1' })
    })
  })

  describe('getDecoratorProfile()', () => {
    it('throws NotFoundException when vendor not found', async () => {
      const { service } = makeService({
        vendors: q({ data: null, error: { message: 'not found' } }),
      })
      await expect(service.getDecoratorProfile('user-1')).rejects.toThrow(NotFoundException)
    })

    it('returns styles and packages', async () => {
      const supabase = makeSupabaseMock()
      supabase._mockFrom.mockImplementation((table: string) => {
        if (table === 'vendors') return q({ data: vendorRow, error: null })
        if (table === 'decorator_styles')
          return q({ data: [{ id: 'sty-1', style: 'Modern', sort_order: 1 }], error: null })
        if (table === 'decorator_packages') return q({ data: [], error: null })
        return q()
      })
      const service = new VendorPortalService(supabase as any, mockEmail as any as EmailService)
      const result = await service.getDecoratorProfile('user-1')
      expect(result.styles).toHaveLength(1)
      expect(result.packages).toHaveLength(0)
    })
  })

  describe('getPaymentStructure()', () => {
    it('throws NotFoundException when vendor not found', async () => {
      const { service } = makeService({
        vendors: q({ data: null, error: { message: 'not found' } }),
      })
      await expect(service.getPaymentStructure('user-1')).rejects.toThrow(NotFoundException)
    })

    it('returns null when no payment structure', async () => {
      const supabase = makeSupabaseMock()
      supabase._mockFrom.mockImplementation((table: string) => {
        if (table === 'vendors') return q({ data: vendorRow, error: null })
        if (table === 'vendor_payment_structures') return q({ data: null, error: null })
        return q()
      })
      const service = new VendorPortalService(supabase as any, mockEmail as any as EmailService)
      const result = await service.getPaymentStructure('user-1')
      expect(result).toBeNull()
    })

    it('returns payment structure', async () => {
      const structure = { id: 'ps-1', commitment_pct: 30, materials_pct: 20, balance_pct: 50 }
      const supabase = makeSupabaseMock()
      supabase._mockFrom.mockImplementation((table: string) => {
        if (table === 'vendors') return q({ data: vendorRow, error: null })
        if (table === 'vendor_payment_structures') return q({ data: structure, error: null })
        return q()
      })
      const service = new VendorPortalService(supabase as any, mockEmail as any as EmailService)
      const result = await service.getPaymentStructure('user-1')
      expect(result).toEqual(structure)
    })
  })

  describe('savePaymentStructure()', () => {
    const validDto = {
      commitmentPct: 30,
      materialsPct: 20,
      balancePct: 50,
      commitmentReleaseDays: 14,
      materialsReleaseDays: 14,
      balanceReleaseHours: 48,
    }

    it('throws NotFoundException when vendor not found', async () => {
      const { service } = makeService({
        vendors: q({ data: null, error: { message: 'not found' } }),
      })
      await expect(service.savePaymentStructure('user-1', validDto)).rejects.toThrow(
        NotFoundException,
      )
    })

    it('throws BadRequestException when percentages do not sum to 100', async () => {
      const { service } = makeService({ vendors: q({ data: vendorRow, error: null }) })
      await expect(
        service.savePaymentStructure('user-1', { ...validDto, balancePct: 40 }),
      ).rejects.toThrow(BadRequestException)
    })

    it('throws BadRequestException when balance is below 20%', async () => {
      const { service } = makeService({ vendors: q({ data: vendorRow, error: null }) })
      // 40 + 45 + 15 = 100, balance 15 < 20 → should throw
      await expect(
        service.savePaymentStructure('user-1', {
          ...validDto,
          commitmentPct: 40,
          materialsPct: 45,
          balancePct: 15,
        }),
      ).rejects.toThrow(BadRequestException)
    })

    it('throws BadRequestException when commitment is below 10%', async () => {
      const { service } = makeService({ vendors: q({ data: vendorRow, error: null }) })
      await expect(
        service.savePaymentStructure('user-1', {
          ...validDto,
          commitmentPct: 5,
          materialsPct: 15,
          balancePct: 80,
        }),
      ).rejects.toThrow(BadRequestException)
    })

    it('throws BadRequestException when commitment release days too low', async () => {
      const { service } = makeService({ vendors: q({ data: vendorRow, error: null }) })
      await expect(
        service.savePaymentStructure('user-1', { ...validDto, commitmentReleaseDays: 3 }),
      ).rejects.toThrow(BadRequestException)
    })

    it('throws BadRequestException when balance release hours out of range', async () => {
      const { service } = makeService({ vendors: q({ data: vendorRow, error: null }) })
      await expect(
        service.savePaymentStructure('user-1', { ...validDto, balanceReleaseHours: 200 }),
      ).rejects.toThrow(BadRequestException)
      await expect(
        service.savePaymentStructure('user-1', { ...validDto, balanceReleaseHours: 12 }),
      ).rejects.toThrow(BadRequestException)
    })

    it('saves and returns payment structure', async () => {
      const savedStructure = { id: 'ps-1', ...validDto, is_active: false }
      const supabase = makeSupabaseMock()
      supabase._mockFrom.mockImplementation((table: string) => {
        if (table === 'vendors') return q({ data: vendorRow, error: null })
        if (table === 'vendor_payment_structures') return q({ data: savedStructure, error: null })
        return q()
      })
      const service = new VendorPortalService(supabase as any, mockEmail as any as EmailService)
      const result = await service.savePaymentStructure('user-1', validDto)
      expect(result).toEqual(savedStructure)
    })
  })

  describe('agreeToPaymentTerms()', () => {
    it('throws BadRequestException when no payment structure exists', async () => {
      const supabase = makeSupabaseMock()
      supabase._mockFrom.mockImplementation((table: string) => {
        if (table === 'vendors') return q({ data: vendorRow, error: null })
        if (table === 'vendor_payment_structures') return q({ data: null, error: null })
        return q()
      })
      const service = new VendorPortalService(supabase as any, mockEmail as any as EmailService)
      await expect(service.agreeToPaymentTerms('user-1')).rejects.toThrow(BadRequestException)
    })

    it('activates payment structure', async () => {
      const activeStructure = {
        id: 'ps-1',
        is_active: true,
        terms_agreed_at: '2099-01-01T00:00:00Z',
      }
      const supabase = makeSupabaseMock()
      let psCallCount = 0
      supabase._mockFrom.mockImplementation((table: string) => {
        if (table === 'vendors') return q({ data: vendorRow, error: null })
        if (table === 'vendor_payment_structures') {
          psCallCount++
          if (psCallCount === 1) return q({ data: { id: 'ps-1' }, error: null }) // existing check
          return q({ data: activeStructure, error: null }) // update result
        }
        return q()
      })
      const service = new VendorPortalService(supabase as any, mockEmail as any as EmailService)
      const result = await service.agreeToPaymentTerms('user-1')
      expect(result.is_active).toBe(true)
    })
  })

  describe('cancelBookingAsVendor()', () => {
    const interestWithSchedule = {
      id: 'int-1',
      status: 'committed',
      event_id: 'evt-1',
      offered_price: 500000,
      agreed_price: 500000,
      total_contract_kobo: 50000000,
      events: { id: 'evt-1', title: 'Wedding', event_date: '2099-01-01', user_id: 'user-2' },
      users: { email: 'organiser@test.com', full_name: 'Organiser' },
    }

    it('throws NotFoundException when booking not found', async () => {
      const supabase = makeSupabaseMock()
      supabase._mockFrom.mockImplementation((table: string) => {
        if (table === 'vendors') return q({ data: vendorRow, error: null })
        if (table === 'vendor_interests') return q({ data: null, error: { message: 'not found' } })
        return q()
      })
      const service = new VendorPortalService(supabase as any, mockEmail as any as EmailService)
      await expect(service.cancelBookingAsVendor('user-1', 'int-1')).rejects.toThrow(
        NotFoundException,
      )
    })

    it('throws BadRequestException when status is not available/committed', async () => {
      const supabase = makeSupabaseMock()
      supabase._mockFrom.mockImplementation((table: string) => {
        if (table === 'vendors') return q({ data: vendorRow, error: null })
        if (table === 'vendor_interests')
          return q({ data: { ...interestWithSchedule, status: 'pending' }, error: null })
        return q()
      })
      const service = new VendorPortalService(supabase as any, mockEmail as any as EmailService)
      await expect(service.cancelBookingAsVendor('user-1', 'int-1')).rejects.toThrow(
        BadRequestException,
      )
    })

    it('cancels booking with no outstanding when nothing released', async () => {
      const supabase = makeSupabaseMock()
      supabase._mockFrom.mockImplementation((table: string) => {
        if (table === 'vendors') return q({ data: vendorRow, error: null })
        if (table === 'vendor_interests') return q({ data: interestWithSchedule, error: null })
        if (table === 'interest_payment_schedule')
          return q({
            data: [{ bucket: 'commitment', amount_kobo: 150000, status: 'scheduled' }],
            error: null,
          })
        if (table === 'booking_cancellations')
          return q({ data: { id: 'canc-1', status: 'no_outstanding' }, error: null })
        if (table === 'cancellation_events') return q({ data: null, error: null })
        return q()
      })
      const service = new VendorPortalService(supabase as any, mockEmail as any as EmailService)
      const result = await service.cancelBookingAsVendor('user-1', 'int-1')
      expect(result.heldKobo).toBe(150000)
      expect(result.outstandingKobo).toBe(0)
      expect(mockEmail.sendVendorCancelledToOrganiser).toHaveBeenCalled()
      expect(mockEmail.sendRepaymentDemandToVendor).not.toHaveBeenCalled()
    })

    it('frees up the vendor calendar for the event date', async () => {
      const supabase = makeSupabaseMock()
      const availabilityDelete = jest.fn().mockReturnThis()
      supabase._mockFrom.mockImplementation((table: string) => {
        if (table === 'vendors') return q({ data: vendorRow, error: null })
        if (table === 'vendor_interests') return q({ data: interestWithSchedule, error: null })
        if (table === 'interest_payment_schedule')
          return q({
            data: [{ bucket: 'commitment', amount_kobo: 150000, status: 'scheduled' }],
            error: null,
          })
        if (table === 'booking_cancellations')
          return q({ data: { id: 'canc-1', status: 'no_outstanding' }, error: null })
        if (table === 'cancellation_events') return q({ data: null, error: null })
        if (table === 'vendor_availability') {
          const builder = q()
          builder.delete = availabilityDelete
          return builder
        }
        return q()
      })
      const service = new VendorPortalService(supabase as any, mockEmail as any as EmailService)
      await service.cancelBookingAsVendor('user-1', 'int-1')
      expect(availabilityDelete).toHaveBeenCalled()
    })

    it('cancels booking with outstanding when funds were released', async () => {
      const supabase = makeSupabaseMock()
      supabase._mockFrom.mockImplementation((table: string) => {
        if (table === 'vendors') return q({ data: vendorRow, error: null })
        if (table === 'vendor_interests') return q({ data: interestWithSchedule, error: null })
        if (table === 'interest_payment_schedule')
          return q({
            data: [
              { bucket: 'commitment', amount_kobo: 150000, status: 'released' },
              { bucket: 'balance', amount_kobo: 250000, status: 'scheduled' },
            ],
            error: null,
          })
        if (table === 'booking_cancellations')
          return q({ data: { id: 'canc-1', status: 'pending' }, error: null })
        if (table === 'cancellation_events') return q({ data: null, error: null })
        return q()
      })
      const service = new VendorPortalService(supabase as any, mockEmail as any as EmailService)
      const result = await service.cancelBookingAsVendor('user-1', 'int-1')
      expect(result.outstandingKobo).toBe(150000)
      expect(mockEmail.sendRepaymentDemandToVendor).toHaveBeenCalled()
    })
  })

  describe('requestCancellationExtension()', () => {
    const cancellationRow = {
      id: 'canc-1',
      status: 'pending',
      extension_granted: false,
      repayment_deadline: '2099-06-27T00:00:00Z',
      interest_id: 'int-1',
      vendor_interests: { vendor_id: 'ven-1' },
    }

    it('throws NotFoundException when cancellation not found', async () => {
      const supabase = makeSupabaseMock()
      supabase._mockFrom.mockImplementation((table: string) => {
        if (table === 'vendors') return q({ data: vendorRow, error: null })
        if (table === 'booking_cancellations')
          return q({ data: null, error: { message: 'not found' } })
        return q()
      })
      const service = new VendorPortalService(supabase as any, mockEmail as any as EmailService)
      await expect(service.requestCancellationExtension('user-1', 'int-1')).rejects.toThrow(
        NotFoundException,
      )
    })

    it('throws BadRequestException when not authorised', async () => {
      const supabase = makeSupabaseMock()
      supabase._mockFrom.mockImplementation((table: string) => {
        if (table === 'vendors') return q({ data: vendorRow, error: null })
        if (table === 'booking_cancellations')
          return q({
            data: { ...cancellationRow, vendor_interests: { vendor_id: 'other-ven' } },
            error: null,
          })
        return q()
      })
      const service = new VendorPortalService(supabase as any, mockEmail as any as EmailService)
      await expect(service.requestCancellationExtension('user-1', 'int-1')).rejects.toThrow(
        BadRequestException,
      )
    })

    it('throws BadRequestException when extension already granted', async () => {
      const supabase = makeSupabaseMock()
      supabase._mockFrom.mockImplementation((table: string) => {
        if (table === 'vendors') return q({ data: vendorRow, error: null })
        if (table === 'booking_cancellations')
          return q({ data: { ...cancellationRow, extension_granted: true }, error: null })
        return q()
      })
      const service = new VendorPortalService(supabase as any, mockEmail as any as EmailService)
      await expect(service.requestCancellationExtension('user-1', 'int-1')).rejects.toThrow(
        BadRequestException,
      )
    })

    it('throws BadRequestException when status is not pending', async () => {
      const supabase = makeSupabaseMock()
      supabase._mockFrom.mockImplementation((table: string) => {
        if (table === 'vendors') return q({ data: vendorRow, error: null })
        if (table === 'booking_cancellations')
          return q({ data: { ...cancellationRow, status: 'completed' }, error: null })
        return q()
      })
      const service = new VendorPortalService(supabase as any, mockEmail as any as EmailService)
      await expect(service.requestCancellationExtension('user-1', 'int-1')).rejects.toThrow(
        BadRequestException,
      )
    })

    it('grants extension and notifies organiser', async () => {
      const supabase = makeSupabaseMock()
      supabase._mockFrom.mockImplementation((table: string) => {
        if (table === 'vendors') return q({ data: vendorRow, error: null })
        if (table === 'booking_cancellations') return q({ data: cancellationRow, error: null })
        if (table === 'cancellation_events') return q({ data: null, error: null })
        if (table === 'vendor_interests')
          return q({
            data: {
              vendors: { name: 'Vendor A' },
              events: { title: 'Wedding' },
              users: { email: 'organiser@test.com', full_name: 'Organiser' },
            },
            error: null,
          })
        return q()
      })
      const service = new VendorPortalService(supabase as any, mockEmail as any as EmailService)
      const result = await service.requestCancellationExtension('user-1', 'int-1')
      expect(result.newDeadline).toBeDefined()
      expect(mockEmail.sendExtensionGrantedToOrganiser).toHaveBeenCalled()
    })
  })
})
