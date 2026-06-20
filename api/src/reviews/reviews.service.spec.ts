import { BadRequestException, InternalServerErrorException, NotFoundException } from '@nestjs/common'
import { ReviewsService } from './reviews.service'
import { makeSupabaseMock, q } from '../test/supabase.mock'
import { EmailService } from '../email/email.service'

const mockEmail = {
  sendReviewReminder: jest.fn().mockResolvedValue(undefined),
}

const committedInterest = {
  id: 'int-1',
  status: 'committed',
  vendor_id: 'ven-1',
  event_id: 'evt-1',
  events: { title: 'Wedding', event_date: '2020-01-01' }, // past date
  vendors: { name: 'Vendor A' },
}

function makeService(fromMap: Record<string, ReturnType<typeof q>> = {}) {
  const supabase = makeSupabaseMock(fromMap)
  const service = new ReviewsService(supabase as any, mockEmail as any as EmailService)
  return { service, supabase }
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('ReviewsService', () => {
  describe('submitReview()', () => {
    it('throws BadRequestException for rating out of range', async () => {
      const { service } = makeService()
      await expect(service.submitReview('user-1', 'int-1', { rating: 6, comment: 'x' })).rejects.toThrow(BadRequestException)
      await expect(service.submitReview('user-1', 'int-1', { rating: 0, comment: 'x' })).rejects.toThrow(BadRequestException)
    })

    it('throws NotFoundException when interest not found', async () => {
      const { service } = makeService({
        vendor_interests: q({ data: null, error: { message: 'not found' } }),
      })
      await expect(service.submitReview('user-1', 'int-1', { rating: 5 })).rejects.toThrow(NotFoundException)
    })

    it('throws BadRequestException when interest is not committed', async () => {
      const { service } = makeService({
        vendor_interests: q({ data: { ...committedInterest, status: 'available' }, error: null }),
      })
      await expect(service.submitReview('user-1', 'int-1', { rating: 5 })).rejects.toThrow(BadRequestException)
    })

    it('throws BadRequestException when event has not passed', async () => {
      const { service } = makeService({
        vendor_interests: q({ data: { ...committedInterest, events: { title: 'Wedding', event_date: '2099-01-01' } }, error: null }),
      })
      await expect(service.submitReview('user-1', 'int-1', { rating: 5 })).rejects.toThrow(BadRequestException)
    })

    it('throws BadRequestException when already reviewed', async () => {
      const supabase = makeSupabaseMock()
      supabase._mockFrom.mockImplementation((table: string) => {
        if (table === 'vendor_interests') return q({ data: committedInterest, error: null })
        if (table === 'vendor_reviews') return q({ data: { id: 'rev-1' }, error: null })
        return q()
      })
      const service = new ReviewsService(supabase as any, mockEmail as any as EmailService)
      await expect(service.submitReview('user-1', 'int-1', { rating: 5 })).rejects.toThrow(BadRequestException)
    })

    it('submits review and recalculates rating', async () => {
      const supabase = makeSupabaseMock()
      const reviewRow = { id: 'rev-1', rating: 5, comment: 'Great' }
      supabase._mockFrom.mockImplementation((table: string) => {
        if (table === 'vendor_interests') return q({ data: committedInterest, error: null })
        if (table === 'vendor_reviews') {
          // first call: check existing (null), second call: insert, third call: select ratings for recalculate
          return q({ data: reviewRow, error: null })
        }
        if (table === 'vendors') return q({ data: null, error: null })
        return q()
      })
      let vendorReviewCallCount = 0
      supabase._mockFrom.mockImplementation((table: string) => {
        if (table === 'vendor_interests') return q({ data: committedInterest, error: null })
        if (table === 'vendor_reviews') {
          vendorReviewCallCount++
          if (vendorReviewCallCount === 1) return q({ data: null, error: null }) // no existing review
          if (vendorReviewCallCount === 2) return q({ data: reviewRow, error: null }) // insert result
          return q({ data: [{ rating: 5 }], error: null }) // recalculate ratings
        }
        if (table === 'vendors') return q({ data: null, error: null })
        return q()
      })
      const service = new ReviewsService(supabase as any, mockEmail as any as EmailService)
      const result = await service.submitReview('user-1', 'int-1', { rating: 5, comment: 'Great' })
      expect(result).toEqual(reviewRow)
    })

    it('throws InternalServerErrorException when insert fails', async () => {
      const supabase = makeSupabaseMock()
      let reviewCallCount = 0
      supabase._mockFrom.mockImplementation((table: string) => {
        if (table === 'vendor_interests') return q({ data: committedInterest, error: null })
        if (table === 'vendor_reviews') {
          reviewCallCount++
          if (reviewCallCount === 1) return q({ data: null, error: null })
          return q({ data: null, error: { message: 'DB error' } })
        }
        return q()
      })
      const service = new ReviewsService(supabase as any, mockEmail as any as EmailService)
      await expect(service.submitReview('user-1', 'int-1', { rating: 5 })).rejects.toThrow(InternalServerErrorException)
    })
  })

  describe('getVendorReviews()', () => {
    it('throws NotFoundException when vendor not found', async () => {
      const { service } = makeService({
        vendors: q({ data: null, error: null }),
      })
      await expect(service.getVendorReviews('unknown-slug')).rejects.toThrow(NotFoundException)
    })

    it('throws InternalServerErrorException on DB error', async () => {
      const supabase = makeSupabaseMock()
      supabase._mockFrom.mockImplementation((table: string) => {
        if (table === 'vendors') return q({ data: { id: 'ven-1' }, error: null })
        if (table === 'vendor_reviews') return q({ data: null, error: { message: 'DB error' } })
        return q()
      })
      const service = new ReviewsService(supabase as any, mockEmail as any as EmailService)
      await expect(service.getVendorReviews('vendor-slug')).rejects.toThrow(InternalServerErrorException)
    })

    it('returns reviews array', async () => {
      const reviews = [{ id: 'rev-1', rating: 5, comment: 'Excellent', created_at: '2099-01-01', users: { full_name: 'User' }, events: { title: 'Wedding', event_date: '2020-01-01', event_type: 'wedding' } }]
      const supabase = makeSupabaseMock()
      supabase._mockFrom.mockImplementation((table: string) => {
        if (table === 'vendors') return q({ data: { id: 'ven-1' }, error: null })
        if (table === 'vendor_reviews') return q({ data: reviews, error: null })
        return q()
      })
      const service = new ReviewsService(supabase as any, mockEmail as any as EmailService)
      const result = await service.getVendorReviews('vendor-slug')
      expect(result).toEqual(reviews)
    })

    it('returns empty array when no reviews', async () => {
      const supabase = makeSupabaseMock()
      supabase._mockFrom.mockImplementation((table: string) => {
        if (table === 'vendors') return q({ data: { id: 'ven-1' }, error: null })
        if (table === 'vendor_reviews') return q({ data: null, error: null })
        return q()
      })
      const service = new ReviewsService(supabase as any, mockEmail as any as EmailService)
      const result = await service.getVendorReviews('vendor-slug')
      expect(result).toEqual([])
    })
  })

  describe('getReviewable()', () => {
    it('throws InternalServerErrorException on DB error', async () => {
      const { service } = makeService({
        vendor_interests: q({ data: null, error: { message: 'DB error' } }),
      })
      await expect(service.getReviewable('user-1')).rejects.toThrow(InternalServerErrorException)
    })

    it('returns only interests with no existing review and past event date', async () => {
      const interests = [
        { id: 'int-1', vendor_id: 'ven-1', event_id: 'evt-1', status: 'committed', vendors: { id: 'ven-1', name: 'A', slug: 'a', vendor_categories: { name: 'Cat' } }, events: { id: 'evt-1', title: 'Wedding', event_date: '2020-01-01' }, vendor_reviews: [] },
        { id: 'int-2', vendor_id: 'ven-2', event_id: 'evt-2', status: 'committed', vendors: { id: 'ven-2', name: 'B', slug: 'b', vendor_categories: { name: 'Cat' } }, events: { id: 'evt-2', title: 'Party', event_date: '2020-01-01' }, vendor_reviews: [{ id: 'rev-1' }] },
        { id: 'int-3', vendor_id: 'ven-3', event_id: 'evt-3', status: 'committed', vendors: null, events: null, vendor_reviews: [] },
      ]
      const { service } = makeService({
        vendor_interests: q({ data: interests, error: null }),
      })
      const result = await service.getReviewable('user-1')
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('int-1')
    })

    it('returns empty array when no interests', async () => {
      const { service } = makeService({
        vendor_interests: q({ data: null, error: null }),
      })
      const result = await service.getReviewable('user-1')
      expect(result).toEqual([])
    })
  })

  describe('sendReviewReminders()', () => {
    it('returns early when no commitments', async () => {
      const supabase = makeSupabaseMock()
      supabase._mockFrom.mockImplementation((table: string) => {
        if (table === 'platform_settings') return q({ data: null, error: null })
        if (table === 'vendor_interests') return q({ data: null, error: null })
        return q()
      })
      const service = new ReviewsService(supabase as any, mockEmail as any as EmailService)
      await expect(service.sendReviewReminders()).resolves.toBeUndefined()
      expect(mockEmail.sendReviewReminder).not.toHaveBeenCalled()
    })

    it('skips already-reviewed commitments', async () => {
      const supabase = makeSupabaseMock()
      supabase._mockFrom.mockImplementation((table: string) => {
        if (table === 'platform_settings') return q({ data: null, error: null })
        if (table === 'vendor_interests') return q({
          data: [{
            id: 'int-1', vendor_id: 'ven-1', event_id: 'evt-1', user_id: 'user-1',
            events: { title: 'Wedding', event_date: '2020-01-01', city: 'Lagos' },
            vendors: { name: 'Vendor A', vendor_categories: { name: 'Cat' } },
            users: { email: 'user@test.com', full_name: 'User' },
            vendor_reviews: [{ id: 'rev-1' }], // already reviewed
            review_reminders: [],
          }],
          error: null,
        })
        return q()
      })
      const service = new ReviewsService(supabase as any, mockEmail as any as EmailService)
      await service.sendReviewReminders()
      expect(mockEmail.sendReviewReminder).not.toHaveBeenCalled()
    })

    it('skips commitments for future events', async () => {
      const supabase = makeSupabaseMock()
      supabase._mockFrom.mockImplementation((table: string) => {
        if (table === 'platform_settings') return q({ data: null, error: null })
        if (table === 'vendor_interests') return q({
          data: [{
            id: 'int-1', vendor_id: 'ven-1', event_id: 'evt-1', user_id: 'user-1',
            events: { title: 'Wedding', event_date: '2099-01-01', city: 'Lagos' },
            vendors: { name: 'Vendor A', vendor_categories: { name: 'Cat' } },
            users: { email: 'user@test.com', full_name: 'User' },
            vendor_reviews: [],
            review_reminders: [],
          }],
          error: null,
        })
        return q()
      })
      const service = new ReviewsService(supabase as any, mockEmail as any as EmailService)
      await service.sendReviewReminders()
      expect(mockEmail.sendReviewReminder).not.toHaveBeenCalled()
    })

    it('sends first reminder when threshold is met', async () => {
      const supabase = makeSupabaseMock()
      supabase._mockFrom.mockImplementation((table: string) => {
        if (table === 'platform_settings') return q({ data: { key: 'review_reminder_schedule', value: [1, 1, 1] }, error: null })
        if (table === 'vendor_interests') return q({
          data: [{
            id: 'int-1', vendor_id: 'ven-1', event_id: 'evt-1', user_id: 'user-1',
            events: { title: 'Wedding', event_date: '2020-01-01', city: 'Lagos' }, // very old
            vendors: { name: 'Vendor A', vendor_categories: { name: 'Cat' } },
            users: { email: 'user@test.com', full_name: 'User' },
            vendor_reviews: [],
            review_reminders: [], // no reminders sent yet
          }],
          error: null,
        })
        if (table === 'review_reminders') return q({ data: { id: 'rm-1' }, error: null })
        return q()
      })
      const service = new ReviewsService(supabase as any, mockEmail as any as EmailService)
      await service.sendReviewReminders()
      expect(mockEmail.sendReviewReminder).toHaveBeenCalledTimes(1)
    })

    it('skips commitment without event date', async () => {
      const supabase = makeSupabaseMock()
      supabase._mockFrom.mockImplementation((table: string) => {
        if (table === 'platform_settings') return q({ data: null, error: null })
        if (table === 'vendor_interests') return q({
          data: [{
            id: 'int-1', vendor_id: 'ven-1', event_id: 'evt-1', user_id: 'user-1',
            events: { title: 'Wedding', event_date: null, city: 'Lagos' },
            vendors: { name: 'Vendor A', vendor_categories: { name: 'Cat' } },
            users: { email: 'user@test.com', full_name: 'User' },
            vendor_reviews: [],
            review_reminders: [],
          }],
          error: null,
        })
        return q()
      })
      const service = new ReviewsService(supabase as any, mockEmail as any as EmailService)
      await service.sendReviewReminders()
      expect(mockEmail.sendReviewReminder).not.toHaveBeenCalled()
    })
  })
})
