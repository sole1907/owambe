import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common'
import { VendorInterestsService } from './vendor-interests.service'
import { makeSupabaseMock, q } from '../test/supabase.mock'
import { EmailService } from '../email/email.service'

const mockEmail = {
  sendVendorInquiry: jest.fn().mockResolvedValue(undefined),
  sendVendorResponse: jest.fn().mockResolvedValue(undefined),
  sendOrganiserCancelledToVendor: jest.fn().mockResolvedValue(undefined),
}

const eventRow = {
  id: 'evt-1',
  title: 'Test Event',
  event_date: '2099-12-01',
  event_date_approximate: null,
  user_id: 'user-1',
  city: 'Lagos',
  guest_count_estimate: 100,
}
const vendorRow = {
  id: 'ven-1',
  name: 'Vendor A',
  email: 'vendor@test.com',
  whatsapp: null,
  city: 'Lagos',
  capacity: null,
  vendor_categories: { id: 'cat-1', name: 'Catering', slug: 'caterers' },
  vendor_availability: [],
}
const interestRow = {
  id: 'int-1',
  status: 'available',
  vendor_id: 'ven-1',
  event_id: 'evt-1',
  offered_price: 500000,
  counter_price: 600000,
  is_final_offer: false,
  events: eventRow,
  vendors: vendorRow,
}

function makeService(fromMap: Record<string, ReturnType<typeof q>> = {}) {
  const supabase = makeSupabaseMock(fromMap)
  const service = new VendorInterestsService(supabase as any, mockEmail as any as EmailService)
  return { service, supabase }
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('VendorInterestsService', () => {
  describe('getInterests()', () => {
    it('throws NotFoundException when event not found', async () => {
      const { service } = makeService({
        events: q({ data: null, error: { message: 'not found' } }),
      })
      await expect(service.getInterests('evt-1', 'user-1')).rejects.toThrow(NotFoundException)
    })

    it('throws InternalServerErrorException on DB error for interests', async () => {
      const supabase = makeSupabaseMock()
      supabase._mockFrom.mockImplementation((table: string) => {
        if (table === 'events') return q({ data: eventRow, error: null })
        if (table === 'vendor_interests') return q({ data: null, error: { message: 'DB error' } })
        return q()
      })
      const service = new VendorInterestsService(supabase as any, mockEmail as any as EmailService)
      await expect(service.getInterests('evt-1', 'user-1')).rejects.toThrow(
        InternalServerErrorException,
      )
    })

    it('returns interests array', async () => {
      const supabase = makeSupabaseMock()
      supabase._mockFrom.mockImplementation((table: string) => {
        if (table === 'events') return q({ data: eventRow, error: null })
        if (table === 'vendor_interests') return q({ data: [interestRow], error: null })
        return q()
      })
      const service = new VendorInterestsService(supabase as any, mockEmail as any as EmailService)
      const result = await service.getInterests('evt-1', 'user-1')
      expect(result).toHaveLength(1)
    })
  })

  describe('addInterest()', () => {
    it('throws BadRequestException for invalid preference rank', async () => {
      const { service } = makeService()
      await expect(
        service.addInterest('evt-1', 'user-1', { vendorId: 'ven-1', preferenceRank: 4 } as any),
      ).rejects.toThrow(BadRequestException)
      await expect(
        service.addInterest('evt-1', 'user-1', { vendorId: 'ven-1', preferenceRank: 0 } as any),
      ).rejects.toThrow(BadRequestException)
    })

    it('throws NotFoundException when event not found', async () => {
      const { service } = makeService({
        events: q({ data: null, error: { message: 'not found' } }),
      })
      await expect(
        service.addInterest('evt-1', 'user-1', { vendorId: 'ven-1', preferenceRank: 1 } as any),
      ).rejects.toThrow(NotFoundException)
    })

    it('throws NotFoundException when vendor not found', async () => {
      const supabase = makeSupabaseMock()
      supabase._mockFrom.mockImplementation((table: string) => {
        if (table === 'events') return q({ data: eventRow, error: null })
        if (table === 'vendors') return q({ data: null, error: { message: 'not found' } })
        return q()
      })
      const service = new VendorInterestsService(supabase as any, mockEmail as any as EmailService)
      await expect(
        service.addInterest('evt-1', 'user-1', { vendorId: 'ven-1', preferenceRank: 1 } as any),
      ).rejects.toThrow(NotFoundException)
    })

    it('throws BadRequestException when venue capacity exceeded', async () => {
      const supabase = makeSupabaseMock()
      supabase._mockFrom.mockImplementation((table: string) => {
        if (table === 'events')
          return q({ data: { ...eventRow, guest_count_estimate: 500 }, error: null })
        if (table === 'vendors')
          return q({
            data: {
              ...vendorRow,
              capacity: 100,
              vendor_categories: { id: 'cat-1', name: 'Venues', slug: 'venues' },
            },
            error: null,
          })
        return q()
      })
      const service = new VendorInterestsService(supabase as any, mockEmail as any as EmailService)
      await expect(
        service.addInterest('evt-1', 'user-1', { vendorId: 'ven-1', preferenceRank: 1 } as any),
      ).rejects.toThrow(BadRequestException)
    })

    it('throws BadRequestException when vendor already on shortlist', async () => {
      const supabase = makeSupabaseMock()
      let vendorInterestCallCount = 0
      supabase._mockFrom.mockImplementation((table: string) => {
        if (table === 'events') return q({ data: eventRow, error: null })
        if (table === 'vendors') return q({ data: vendorRow, error: null })
        if (table === 'vendor_interests') {
          vendorInterestCallCount++
          if (vendorInterestCallCount === 1) return q({ data: { id: 'int-existing' }, error: null }) // already exists
          return q()
        }
        return q()
      })
      const service = new VendorInterestsService(supabase as any, mockEmail as any as EmailService)
      await expect(
        service.addInterest('evt-1', 'user-1', { vendorId: 'ven-1', preferenceRank: 1 } as any),
      ).rejects.toThrow(BadRequestException)
    })

    it('throws BadRequestException when slot already taken', async () => {
      const supabase = makeSupabaseMock()
      let callCount = 0
      supabase._mockFrom.mockImplementation((table: string) => {
        if (table === 'events') return q({ data: eventRow, error: null })
        if (table === 'vendors') return q({ data: vendorRow, error: null })
        if (table === 'vendor_interests') {
          callCount++
          if (callCount === 1) return q({ data: null, error: { message: 'not found' } }) // not already on shortlist
          if (callCount === 2)
            return q({ data: { id: 'int-slot', vendors: { name: 'Other Vendor' } }, error: null }) // slot taken
          return q()
        }
        return q()
      })
      const service = new VendorInterestsService(supabase as any, mockEmail as any as EmailService)
      await expect(
        service.addInterest('evt-1', 'user-1', { vendorId: 'ven-1', preferenceRank: 1 } as any),
      ).rejects.toThrow(BadRequestException)
    })

    it('inserts interest and sends email', async () => {
      const supabase = makeSupabaseMock()
      let viCallCount = 0
      supabase._mockFrom.mockImplementation((table: string) => {
        if (table === 'events') return q({ data: eventRow, error: null })
        if (table === 'vendors') return q({ data: vendorRow, error: null })
        if (table === 'vendor_interests') {
          viCallCount++
          if (viCallCount <= 2) return q({ data: null, error: { message: 'not found' } }) // not on shortlist, slot not taken
          return q({ data: { id: 'int-new', status: 'pending' }, error: null }) // insert result
        }
        return q()
      })
      const service = new VendorInterestsService(supabase as any, mockEmail as any as EmailService)
      const result = await service.addInterest('evt-1', 'user-1', {
        vendorId: 'ven-1',
        preferenceRank: 1,
        offeredPrice: 300000,
      } as any)
      expect(result).toBeTruthy()
      expect(mockEmail.sendVendorInquiry).toHaveBeenCalled()
    })

    it('sets status to unavailable when vendor has blocked event date', async () => {
      const blockedVendor = {
        ...vendorRow,
        vendor_availability: [{ date: '2099-12-01', status: 'blocked' }],
      }
      const supabase = makeSupabaseMock()
      let viCallCount = 0
      supabase._mockFrom.mockImplementation((table: string) => {
        if (table === 'events') return q({ data: eventRow, error: null })
        if (table === 'vendors') return q({ data: blockedVendor, error: null })
        if (table === 'vendor_interests') {
          viCallCount++
          if (viCallCount <= 2) return q({ data: null, error: { message: 'not found' } })
          return q({ data: { id: 'int-new', status: 'unavailable' }, error: null })
        }
        return q()
      })
      const service = new VendorInterestsService(supabase as any, mockEmail as any as EmailService)
      const result = await service.addInterest('evt-1', 'user-1', {
        vendorId: 'ven-1',
        preferenceRank: 1,
      } as any)
      expect(result.status).toBe('unavailable')
    })
  })

  describe('removeInterest()', () => {
    it('throws NotFoundException when interest not found', async () => {
      const { service } = makeService({
        vendor_interests: q({ data: null, error: { message: 'not found' } }),
      })
      await expect(service.removeInterest('evt-1', 'int-1', 'user-1')).rejects.toThrow(
        NotFoundException,
      )
    })

    it('throws InternalServerErrorException on delete error', async () => {
      const supabase = makeSupabaseMock()
      let viCallCount = 0
      supabase._mockFrom.mockImplementation((table: string) => {
        if (table === 'vendor_interests') {
          viCallCount++
          if (viCallCount === 1) return q({ data: { id: 'int-1', status: 'pending' }, error: null })
          return q({ data: null, error: { message: 'DB error' } })
        }
        return q()
      })
      const service = new VendorInterestsService(supabase as any, mockEmail as any as EmailService)
      await expect(service.removeInterest('evt-1', 'int-1', 'user-1')).rejects.toThrow(
        InternalServerErrorException,
      )
    })

    it('returns success message', async () => {
      const supabase = makeSupabaseMock()
      let viCallCount = 0
      supabase._mockFrom.mockImplementation((table: string) => {
        if (table === 'vendor_interests') {
          viCallCount++
          if (viCallCount === 1) return q({ data: { id: 'int-1', status: 'pending' }, error: null })
          return q({ data: null, error: null })
        }
        return q()
      })
      const service = new VendorInterestsService(supabase as any, mockEmail as any as EmailService)
      const result = await service.removeInterest('evt-1', 'int-1', 'user-1')
      expect(result.message).toBe('Removed from shortlist')
    })
  })

  describe('getActionSummary()', () => {
    it('returns zero counts when no interests', async () => {
      const { service } = makeService({
        vendor_interests: q({ data: null, error: null }),
      })
      const result = await service.getActionSummary('user-1')
      expect(result.pending_vendor_response).toBe(0)
      expect(result.counter_received).toBe(0)
    })

    it('counts pending and quoted interests correctly', async () => {
      const { service } = makeService({
        vendor_interests: q({
          data: [
            { status: 'pending', events: { id: 'evt-1', title: 'Wedding' } },
            { status: 'pending', events: { id: 'evt-2', title: 'Party' } },
            { status: 'quoted', events: { id: 'evt-1', title: 'Wedding' } },
            { status: 'quoted', events: { id: 'evt-1', title: 'Wedding' } }, // same event — deduped
          ],
          error: null,
        }),
      })
      const result = await service.getActionSummary('user-1')
      expect(result.pending_vendor_response).toBe(2)
      expect(result.counter_received).toBe(2)
      expect(result.counter_events).toHaveLength(1) // deduplicated
    })
  })

  describe('counterBack()', () => {
    it('throws NotFoundException when interest not found', async () => {
      const { service } = makeService({
        vendor_interests: q({ data: null, error: { message: 'not found' } }),
      })
      await expect(service.counterBack('evt-1', 'int-1', 'user-1', 550000)).rejects.toThrow(
        NotFoundException,
      )
    })

    it('throws BadRequestException when status is not quoted', async () => {
      const { service } = makeService({
        vendor_interests: q({ data: { ...interestRow, status: 'pending' }, error: null }),
      })
      await expect(service.counterBack('evt-1', 'int-1', 'user-1', 550000)).rejects.toThrow(
        BadRequestException,
      )
    })

    it('throws BadRequestException when vendor counter is final', async () => {
      const { service } = makeService({
        vendor_interests: q({
          data: { ...interestRow, status: 'quoted', is_final_offer: true },
          error: null,
        }),
      })
      await expect(service.counterBack('evt-1', 'int-1', 'user-1', 550000)).rejects.toThrow(
        BadRequestException,
      )
    })

    it('updates interest and notifies vendor', async () => {
      const supabase = makeSupabaseMock()
      let viCallCount = 0
      supabase._mockFrom.mockImplementation((table: string) => {
        if (table === 'vendor_interests') {
          viCallCount++
          if (viCallCount === 1)
            return q({
              data: { ...interestRow, status: 'quoted', is_final_offer: false },
              error: null,
            })
          return q({
            data: { ...interestRow, status: 'pending', offered_price: 550000 },
            error: null,
          })
        }
        return q()
      })
      const service = new VendorInterestsService(supabase as any, mockEmail as any as EmailService)
      const result = await service.counterBack('evt-1', 'int-1', 'user-1', 550000)
      expect(result.status).toBe('pending')
      expect(mockEmail.sendVendorInquiry).toHaveBeenCalled()
    })
  })

  describe('acceptCounter()', () => {
    it('throws NotFoundException when interest not found', async () => {
      const { service } = makeService({
        vendor_interests: q({ data: null, error: { message: 'not found' } }),
      })
      await expect(service.acceptCounter('evt-1', 'int-1', 'user-1')).rejects.toThrow(
        NotFoundException,
      )
    })

    it('throws BadRequestException when status is not quoted', async () => {
      const { service } = makeService({
        vendor_interests: q({ data: { ...interestRow, status: 'available' }, error: null }),
      })
      await expect(service.acceptCounter('evt-1', 'int-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      )
    })

    it('throws BadRequestException when counter_price is missing', async () => {
      const { service } = makeService({
        vendor_interests: q({
          data: { ...interestRow, status: 'quoted', counter_price: null },
          error: null,
        }),
      })
      await expect(service.acceptCounter('evt-1', 'int-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      )
    })

    it('accepts counter and returns updated interest', async () => {
      const supabase = makeSupabaseMock()
      let viCallCount = 0
      supabase._mockFrom.mockImplementation((table: string) => {
        if (table === 'vendor_interests') {
          viCallCount++
          if (viCallCount === 1)
            return q({
              data: { ...interestRow, status: 'quoted', counter_price: 600000 },
              error: null,
            })
          return q({
            data: { ...interestRow, status: 'available', agreed_price: 600000 },
            error: null,
          })
        }
        return q()
      })
      const service = new VendorInterestsService(supabase as any, mockEmail as any as EmailService)
      const result = await service.acceptCounter('evt-1', 'int-1', 'user-1')
      expect(result.status).toBe('available')
      expect(result.agreed_price).toBe(600000)
    })
  })

  describe('getInquiryCounts()', () => {
    it('returns zero when vendor profile not found', async () => {
      const { service } = makeService({
        vendors: q({ data: null, error: null }),
      })
      const result = await service.getInquiryCounts('user-1')
      expect(result).toEqual({ pending: 0 })
    })

    it('returns pending count for found vendor', async () => {
      const supabase = makeSupabaseMock()
      supabase._mockFrom.mockImplementation((table: string) => {
        if (table === 'vendors') return q({ data: { id: 'ven-1' }, error: null })
        if (table === 'vendor_interests')
          return q({ data: [{ status: 'pending' }, { status: 'pending' }], error: null })
        return q()
      })
      const service = new VendorInterestsService(supabase as any, mockEmail as any as EmailService)
      const result = await service.getInquiryCounts('user-1')
      expect(result.pending).toBe(2)
    })
  })

  describe('getInquiries()', () => {
    it('throws NotFoundException when vendor not found', async () => {
      const { service } = makeService({
        vendors: q({ data: null, error: { message: 'not found' } }),
      })
      await expect(service.getInquiries('user-1')).rejects.toThrow(NotFoundException)
    })

    it('throws InternalServerErrorException on DB error', async () => {
      const supabase = makeSupabaseMock()
      supabase._mockFrom.mockImplementation((table: string) => {
        if (table === 'vendors') return q({ data: { id: 'ven-1' }, error: null })
        if (table === 'vendor_interests') return q({ data: null, error: { message: 'DB error' } })
        return q()
      })
      const service = new VendorInterestsService(supabase as any, mockEmail as any as EmailService)
      await expect(service.getInquiries('user-1')).rejects.toThrow(InternalServerErrorException)
    })

    it('returns inquiries array', async () => {
      const supabase = makeSupabaseMock()
      supabase._mockFrom.mockImplementation((table: string) => {
        if (table === 'vendors') return q({ data: { id: 'ven-1' }, error: null })
        if (table === 'vendor_interests') return q({ data: [interestRow], error: null })
        return q()
      })
      const service = new VendorInterestsService(supabase as any, mockEmail as any as EmailService)
      const result = await service.getInquiries('user-1')
      expect(result).toHaveLength(1)
    })
  })

  describe('respondToInquiry()', () => {
    const respondVendorRow = {
      id: 'ven-1',
      name: 'Vendor A',
      email: 'vendor@test.com',
      commitment_fee_percentage: 30,
    }
    const respondInterestRow = {
      id: 'int-1',
      status: 'pending',
      event_id: 'evt-1',
      user_id: 'user-1',
      offered_price: 500000,
      is_final_offer: false,
      events: { title: 'Wedding', city: 'Lagos', event_date: '2099-01-01' },
      users: { email: 'user@test.com', full_name: 'User' },
    }

    it('throws NotFoundException when vendor not found', async () => {
      const { service } = makeService({ vendors: q({ data: null, error: null }) })
      await expect(
        service.respondToInquiry('user-1', 'int-1', { available: true } as any),
      ).rejects.toThrow(NotFoundException)
    })

    it('throws NotFoundException when inquiry not found', async () => {
      const supabase = makeSupabaseMock()
      supabase._mockFrom.mockImplementation((table: string) => {
        if (table === 'vendors') return q({ data: respondVendorRow, error: null })
        if (table === 'vendor_interests') return q({ data: null, error: { message: 'not found' } })
        return q()
      })
      const service = new VendorInterestsService(supabase as any, mockEmail as any as EmailService)
      await expect(
        service.respondToInquiry('user-1', 'int-1', { available: true } as any),
      ).rejects.toThrow(NotFoundException)
    })

    it('throws BadRequestException when status is not pending/quoted', async () => {
      const supabase = makeSupabaseMock()
      supabase._mockFrom.mockImplementation((table: string) => {
        if (table === 'vendors') return q({ data: respondVendorRow, error: null })
        if (table === 'vendor_interests')
          return q({ data: { ...respondInterestRow, status: 'committed' }, error: null })
        return q()
      })
      const service = new VendorInterestsService(supabase as any, mockEmail as any as EmailService)
      await expect(
        service.respondToInquiry('user-1', 'int-1', { available: true } as any),
      ).rejects.toThrow(BadRequestException)
    })

    it('throws BadRequestException when offer is final but vendor tries to counter', async () => {
      const supabase = makeSupabaseMock()
      supabase._mockFrom.mockImplementation((table: string) => {
        if (table === 'vendors') return q({ data: respondVendorRow, error: null })
        if (table === 'vendor_interests')
          return q({ data: { ...respondInterestRow, is_final_offer: true }, error: null })
        return q()
      })
      const service = new VendorInterestsService(supabase as any, mockEmail as any as EmailService)
      await expect(
        service.respondToInquiry('user-1', 'int-1', {
          available: true,
          counterPrice: 600000,
        } as any),
      ).rejects.toThrow(BadRequestException)
    })

    it('marks as unavailable when vendor declines', async () => {
      const supabase = makeSupabaseMock()
      supabase._mockFrom.mockImplementation((table: string) => {
        if (table === 'vendors') return q({ data: respondVendorRow, error: null })
        if (table === 'vendor_interests') return q({ data: respondInterestRow, error: null })
        return q()
      })
      const service = new VendorInterestsService(supabase as any, mockEmail as any as EmailService)
      await service.respondToInquiry('user-1', 'int-1', { available: false } as any)
      expect(mockEmail.sendVendorResponse).toHaveBeenCalledWith(
        expect.objectContaining({ available: false }),
      )
    })

    it('marks as quoted when vendor counters', async () => {
      const supabase = makeSupabaseMock()
      let viCallCount = 0
      supabase._mockFrom.mockImplementation((table: string) => {
        if (table === 'vendors') return q({ data: respondVendorRow, error: null })
        if (table === 'vendor_interests') {
          viCallCount++
          if (viCallCount === 1) return q({ data: respondInterestRow, error: null })
          return q({
            data: { ...respondInterestRow, status: 'quoted', counter_price: 600000 },
            error: null,
          })
        }
        return q()
      })
      const service = new VendorInterestsService(supabase as any, mockEmail as any as EmailService)
      const result = await service.respondToInquiry('user-1', 'int-1', {
        available: true,
        counterPrice: 600000,
      } as any)
      expect(result.status).toBe('quoted')
    })

    it('marks as available when vendor accepts offered price', async () => {
      const supabase = makeSupabaseMock()
      let viCallCount = 0
      supabase._mockFrom.mockImplementation((table: string) => {
        if (table === 'vendors') return q({ data: respondVendorRow, error: null })
        if (table === 'vendor_interests') {
          viCallCount++
          if (viCallCount === 1) return q({ data: respondInterestRow, error: null })
          return q({
            data: { ...respondInterestRow, status: 'available', agreed_price: 500000 },
            error: null,
          })
        }
        return q()
      })
      const service = new VendorInterestsService(supabase as any, mockEmail as any as EmailService)
      const result = await service.respondToInquiry('user-1', 'int-1', { available: true } as any)
      expect(result.status).toBe('available')
    })
  })

  describe('cancelBookingAsOrganiser()', () => {
    const cancelledInterest = {
      id: 'int-1',
      status: 'committed',
      vendor_id: 'ven-1',
      events: { id: 'evt-1', user_id: 'user-1', title: 'Wedding', event_date: '2099-01-01' },
      vendors: { name: 'Vendor A', email: 'vendor@test.com' },
    }

    it('throws NotFoundException when booking not found', async () => {
      const { service } = makeService({
        vendor_interests: q({ data: null, error: { message: 'not found' } }),
      })
      await expect(service.cancelBookingAsOrganiser('evt-1', 'int-1', 'user-1')).rejects.toThrow(
        NotFoundException,
      )
    })

    it('throws BadRequestException when not authorised', async () => {
      const { service } = makeService({
        vendor_interests: q({
          data: {
            ...cancelledInterest,
            events: { ...cancelledInterest.events, user_id: 'other-user' },
          },
          error: null,
        }),
      })
      await expect(service.cancelBookingAsOrganiser('evt-1', 'int-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      )
    })

    it('throws BadRequestException when status is not cancellable', async () => {
      const { service } = makeService({
        vendor_interests: q({ data: { ...cancelledInterest, status: 'pending' }, error: null }),
      })
      await expect(service.cancelBookingAsOrganiser('evt-1', 'int-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      )
    })

    it('cancels booking and notifies vendor', async () => {
      const supabase = makeSupabaseMock()
      supabase._mockFrom.mockImplementation((table: string) => {
        if (table === 'vendor_interests') return q({ data: cancelledInterest, error: null })
        if (table === 'interest_payment_schedule')
          return q({
            data: [{ bucket: 'commitment', amount_kobo: 150000, status: 'scheduled' }],
            error: null,
          })
        if (table === 'booking_cancellations') return q({ data: { id: 'canc-1' }, error: null })
        if (table === 'cancellation_events') return q({ data: null, error: null })
        return q()
      })
      const service = new VendorInterestsService(supabase as any, mockEmail as any as EmailService)
      const result = await service.cancelBookingAsOrganiser('evt-1', 'int-1', 'user-1')
      expect(result.heldKobo).toBe(150000)
      expect(mockEmail.sendOrganiserCancelledToVendor).toHaveBeenCalled()
    })
  })

  describe('getCancellationStatus()', () => {
    it('throws NotFoundException when booking not found', async () => {
      const { service } = makeService({
        vendor_interests: q({ data: null, error: { message: 'not found' } }),
      })
      await expect(service.getCancellationStatus('evt-1', 'int-1', 'user-1')).rejects.toThrow(
        NotFoundException,
      )
    })

    it('throws BadRequestException when not authorised', async () => {
      const { service } = makeService({
        vendor_interests: q({
          data: { id: 'int-1', events: { user_id: 'other-user' } },
          error: null,
        }),
      })
      await expect(service.getCancellationStatus('evt-1', 'int-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      )
    })

    it('throws NotFoundException when no cancellation found', async () => {
      const supabase = makeSupabaseMock()
      supabase._mockFrom.mockImplementation((table: string) => {
        if (table === 'vendor_interests')
          return q({ data: { id: 'int-1', events: { user_id: 'user-1' } }, error: null })
        if (table === 'booking_cancellations')
          return q({ data: null, error: { message: 'not found' } })
        return q()
      })
      const service = new VendorInterestsService(supabase as any, mockEmail as any as EmailService)
      await expect(service.getCancellationStatus('evt-1', 'int-1', 'user-1')).rejects.toThrow(
        NotFoundException,
      )
    })

    it('returns cancellation with events', async () => {
      const cancellationData = { id: 'canc-1', cancelled_by: 'organiser', cancellation_events: [] }
      const supabase = makeSupabaseMock()
      supabase._mockFrom.mockImplementation((table: string) => {
        if (table === 'vendor_interests')
          return q({ data: { id: 'int-1', events: { user_id: 'user-1' } }, error: null })
        if (table === 'booking_cancellations') return q({ data: cancellationData, error: null })
        return q()
      })
      const service = new VendorInterestsService(supabase as any, mockEmail as any as EmailService)
      const result = await service.getCancellationStatus('evt-1', 'int-1', 'user-1')
      expect(result).toEqual(cancellationData)
    })
  })
})
