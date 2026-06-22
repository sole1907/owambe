import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PaymentsService } from './payments.service'
import { makeSupabaseMock, q } from '../test/supabase.mock'
import { EmailService } from '../email/email.service'

const mockEmail = {
  sendCommitmentConfirmedToOrganiser: jest.fn().mockResolvedValue(undefined),
  sendCommitmentConfirmedToVendor: jest.fn().mockResolvedValue(undefined),
}

const mockConfig = {
  get: jest.fn((key: string) => {
    if (key === 'paystackSecretKey') return 'test-secret'
    if (key === 'appUrl') return 'http://localhost:3000'
    return undefined
  }),
}

const interestRow = {
  id: 'int-1',
  status: 'available',
  event_id: 'evt-1',
  vendor_id: 'ven-1',
  agreed_price: 500000,
  offered_price: 500000,
  vendors: {
    id: 'ven-1',
    name: 'Vendor A',
    commitment_fee_percentage: 30,
    vendor_categories: { name: 'Catering' },
  },
  events: {
    id: 'evt-1',
    title: 'Wedding',
    event_date: '2099-12-01',
    event_date_approximate: null,
    city: 'Lagos',
  },
}

const userRow = { email: 'user@test.com', full_name: 'Test User' }
const vendorRow = { name: 'Vendor A', email: 'vendor@test.com' }
const eventRow = {
  title: 'Wedding',
  event_date: '2099-12-01',
  event_date_approximate: null,
  city: 'Lagos',
}

function makeService(fromMap: Record<string, ReturnType<typeof q>> = {}) {
  const supabase = makeSupabaseMock(fromMap)
  const service = new PaymentsService(
    supabase as any,
    mockEmail as any as EmailService,
    mockConfig as any as ConfigService,
  )
  return { service, supabase }
}

global.fetch = jest.fn()

function mockFetch(response: object) {
  ;(global.fetch as jest.Mock).mockResolvedValueOnce({
    json: jest.fn().mockResolvedValue(response),
  })
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('PaymentsService', () => {
  describe('initializePayment()', () => {
    it('throws NotFoundException when interest not found', async () => {
      const { service } = makeService({
        vendor_interests: q({ data: null, error: { message: 'not found' } }),
      })
      await expect(service.initializePayment('user-1', 'int-1')).rejects.toThrow(NotFoundException)
    })

    it('throws BadRequestException when status is not available and not committed', async () => {
      const { service } = makeService({
        vendor_interests: q({ data: { ...interestRow, status: 'pending' }, error: null }),
      })
      await expect(service.initializePayment('user-1', 'int-1')).rejects.toThrow(
        BadRequestException,
      )
    })

    it('returns alreadyPaid when interest is already committed', async () => {
      const { service } = makeService({
        vendor_interests: q({ data: { ...interestRow, status: 'committed' }, error: null }),
      })
      const result = await service.initializePayment('user-1', 'int-1')
      expect(result).toEqual({ alreadyPaid: true })
    })

    it('returns alreadyPaid and fixes interest status when success payment exists', async () => {
      const supabase = makeSupabaseMock()
      supabase._mockFrom.mockImplementation((table: string) => {
        if (table === 'vendor_interests') return q({ data: interestRow, error: null })
        if (table === 'commitment_payments')
          return q({
            data: {
              status: 'success',
              paystack_reference: 'ref',
              paystack_access_code: 'code',
              amount_kobo: 150000,
              commitment_pct: 30,
            },
            error: null,
          })
        return q()
      })
      const service = new PaymentsService(
        supabase as any,
        mockEmail as any as EmailService,
        mockConfig as any as ConfigService,
      )
      const result = await service.initializePayment('user-1', 'int-1')
      expect(result).toEqual({ alreadyPaid: true })
    })

    it('returns existing pending payment without creating a new one', async () => {
      const supabase = makeSupabaseMock()
      supabase._mockFrom.mockImplementation((table: string) => {
        if (table === 'vendor_interests') return q({ data: interestRow, error: null })
        if (table === 'commitment_payments')
          return q({
            data: {
              status: 'pending',
              paystack_reference: 'existing-ref',
              paystack_access_code: 'existing-code',
              amount_kobo: 150000,
              commitment_pct: 30,
            },
            error: null,
          })
        return q()
      })
      const service = new PaymentsService(
        supabase as any,
        mockEmail as any as EmailService,
        mockConfig as any as ConfigService,
      )
      const result = await service.initializePayment('user-1', 'int-1')
      expect(result.reference).toBe('existing-ref')
      expect(result.access_code).toBe('existing-code')
    })

    it('throws BadRequestException when no agreed or offered price', async () => {
      const supabase = makeSupabaseMock()
      supabase._mockFrom.mockImplementation((table: string) => {
        if (table === 'vendor_interests')
          return q({
            data: { ...interestRow, agreed_price: null, offered_price: null },
            error: null,
          })
        if (table === 'commitment_payments')
          return q({ data: null, error: { message: 'not found' } })
        return q()
      })
      const service = new PaymentsService(
        supabase as any,
        mockEmail as any as EmailService,
        mockConfig as any as ConfigService,
      )
      await expect(service.initializePayment('user-1', 'int-1')).rejects.toThrow(
        BadRequestException,
      )
    })

    it('throws NotFoundException when user not found', async () => {
      const supabase = makeSupabaseMock()
      supabase._mockFrom.mockImplementation((table: string) => {
        if (table === 'vendor_interests') return q({ data: interestRow, error: null })
        if (table === 'commitment_payments')
          return q({ data: null, error: { message: 'not found' } })
        if (table === 'users') return q({ data: null, error: null })
        return q()
      })
      const service = new PaymentsService(
        supabase as any,
        mockEmail as any as EmailService,
        mockConfig as any as ConfigService,
      )
      await expect(service.initializePayment('user-1', 'int-1')).rejects.toThrow(NotFoundException)
    })

    it('initializes payment and returns reference', async () => {
      const supabase = makeSupabaseMock()
      supabase._mockFrom.mockImplementation((table: string) => {
        if (table === 'vendor_interests') return q({ data: interestRow, error: null })
        if (table === 'commitment_payments')
          return q({ data: null, error: { message: 'not found' } })
        if (table === 'users') return q({ data: userRow, error: null })
        return q()
      })
      mockFetch({
        status: true,
        message: 'OK',
        data: { authorization_url: 'https://pay.co', access_code: 'ac-1', reference: 'ref-1' },
      })
      const service = new PaymentsService(
        supabase as any,
        mockEmail as any as EmailService,
        mockConfig as any as ConfigService,
      )
      const result = await service.initializePayment('user-1', 'int-1')
      expect(result.reference).toBe('ref-1')
      expect(result.access_code).toBe('ac-1')
      expect(result.amount_kobo).toBe(15000000) // 500000 * 30% * 100
    })

    it('charges full contract when payFull is true', async () => {
      const supabase = makeSupabaseMock()
      supabase._mockFrom.mockImplementation((table: string) => {
        if (table === 'vendor_interests') return q({ data: interestRow, error: null })
        if (table === 'commitment_payments')
          return q({ data: null, error: { message: 'not found' } })
        if (table === 'users') return q({ data: userRow, error: null })
        return q()
      })
      mockFetch({
        status: true,
        message: 'OK',
        data: { authorization_url: 'https://pay.co', access_code: 'ac-1', reference: 'ref-full' },
      })
      const service = new PaymentsService(
        supabase as any,
        mockEmail as any as EmailService,
        mockConfig as any as ConfigService,
      )
      const result = await service.initializePayment('user-1', 'int-1', true)
      expect(result.commitment_pct).toBe(100)
      expect(result.amount_kobo).toBe(50000000) // 500000 * 100% * 100
      expect(result.pay_full).toBe(true)
    })
  })

  describe('verifyPayment()', () => {
    it('throws NotFoundException when payment not found', async () => {
      const { service } = makeService({
        commitment_payments: q({ data: null, error: { message: 'not found' } }),
      })
      await expect(service.verifyPayment('user-1', 'ref-1')).rejects.toThrow(NotFoundException)
    })

    it('returns alreadyConfirmed when status is success', async () => {
      const { service } = makeService({
        commitment_payments: q({
          data: { status: 'success', vendor_interests: { id: 'int-1' } },
          error: null,
        }),
      })
      const result = await service.verifyPayment('user-1', 'ref-1')
      expect(result).toEqual({ status: 'success', alreadyConfirmed: true })
    })

    it('calls confirmPayment for pending payment', async () => {
      const supabase = makeSupabaseMock()
      let callCount = 0
      supabase._mockFrom.mockImplementation((table: string) => {
        if (table === 'commitment_payments') {
          if (callCount++ === 0)
            return q({
              data: { status: 'pending', vendor_interests: { id: 'int-1' } },
              error: null,
            })
          return q({
            data: {
              id: 'pay-1',
              status: 'pending',
              interest_id: 'int-1',
              event_id: 'evt-1',
              vendor_id: 'ven-1',
              user_id: 'user-1',
              amount_kobo: 150000,
              commitment_pct: 30,
            },
            error: null,
          })
        }
        if (table === 'vendors') return q({ data: vendorRow, error: null })
        if (table === 'events') return q({ data: eventRow, error: null })
        if (table === 'users') return q({ data: userRow, error: null })
        if (table === 'vendor_payment_structures') return q({ data: null, error: null })
        if (table === 'vendor_interests') return q({ data: null, error: null })
        return q()
      })
      mockFetch({
        status: true,
        message: 'OK',
        data: {
          status: 'success',
          reference: 'ref-1',
          amount: 150000,
          paid_at: '2099-01-01',
          metadata: {},
        },
      })
      const service = new PaymentsService(
        supabase as any,
        mockEmail as any as EmailService,
        mockConfig as any as ConfigService,
      )
      const result = await service.verifyPayment('user-1', 'ref-1')
      expect(result.status).toBe('success')
    })
  })

  describe('confirmPayment()', () => {
    it('throws BadRequestException when Paystack status is not success', async () => {
      const { service } = makeService()
      mockFetch({
        status: true,
        message: 'OK',
        data: { status: 'failed', reference: 'ref-1', amount: 0, paid_at: '', metadata: {} },
      })
      await expect(service.confirmPayment('ref-1')).rejects.toThrow(BadRequestException)
    })

    it('throws NotFoundException when payment record not found', async () => {
      const supabase = makeSupabaseMock()
      supabase._mockFrom.mockImplementation((table: string) => {
        if (table === 'commitment_payments') return q({ data: null, error: null })
        return q()
      })
      mockFetch({
        status: true,
        message: 'OK',
        data: {
          status: 'success',
          reference: 'ref-1',
          amount: 150000,
          paid_at: '2099-01-01',
          metadata: {},
        },
      })
      const service = new PaymentsService(
        supabase as any,
        mockEmail as any as EmailService,
        mockConfig as any as ConfigService,
      )
      await expect(service.confirmPayment('ref-1')).rejects.toThrow(NotFoundException)
    })

    it('is idempotent when payment is already success', async () => {
      const supabase = makeSupabaseMock()
      supabase._mockFrom.mockImplementation((table: string) => {
        if (table === 'commitment_payments')
          return q({
            data: {
              id: 'pay-1',
              status: 'success',
              interest_id: 'int-1',
              event_id: 'evt-1',
              vendor_id: 'ven-1',
              user_id: 'user-1',
              amount_kobo: 150000,
              commitment_pct: 30,
            },
            error: null,
          })
        return q()
      })
      mockFetch({
        status: true,
        message: 'OK',
        data: {
          status: 'success',
          reference: 'ref-1',
          amount: 150000,
          paid_at: '2099-01-01',
          metadata: {},
        },
      })
      const service = new PaymentsService(
        supabase as any,
        mockEmail as any as EmailService,
        mockConfig as any as ConfigService,
      )
      await expect(service.confirmPayment('ref-1')).resolves.toBeUndefined()
    })

    it('confirms payment and sends emails', async () => {
      const supabase = makeSupabaseMock()
      supabase._mockFrom.mockImplementation((table: string) => {
        if (table === 'commitment_payments')
          return q({
            data: {
              id: 'pay-1',
              status: 'pending',
              interest_id: 'int-1',
              event_id: 'evt-1',
              vendor_id: 'ven-1',
              user_id: 'user-1',
              amount_kobo: 150000,
              commitment_pct: 30,
            },
            error: null,
          })
        if (table === 'vendors') return q({ data: vendorRow, error: null })
        if (table === 'events') return q({ data: eventRow, error: null })
        if (table === 'users') return q({ data: userRow, error: null })
        if (table === 'vendor_payment_structures') return q({ data: null, error: null })
        if (table === 'vendor_interests') return q({ data: null, error: null })
        return q()
      })
      mockFetch({
        status: true,
        message: 'OK',
        data: {
          status: 'success',
          reference: 'ref-1',
          amount: 150000,
          paid_at: '2099-01-01',
          metadata: {},
        },
      })
      const service = new PaymentsService(
        supabase as any,
        mockEmail as any as EmailService,
        mockConfig as any as ConfigService,
      )
      await service.confirmPayment('ref-1')
      expect(mockEmail.sendCommitmentConfirmedToOrganiser).toHaveBeenCalled()
      expect(mockEmail.sendCommitmentConfirmedToVendor).toHaveBeenCalled()
    })
  })

  describe('handleWebhook()', () => {
    it('throws UnauthorizedException for invalid signature', async () => {
      const { service } = makeService()
      const body = Buffer.from(
        JSON.stringify({
          event: 'charge.success',
          data: { reference: 'ref-1', status: 'success' },
        }),
      )
      await expect(service.handleWebhook(body, 'bad-signature')).rejects.toThrow(
        UnauthorizedException,
      )
    })

    it('does not throw for non-charge.success events', async () => {
      const { service } = makeService()
      const bodyObj = { event: 'charge.failed', data: { reference: 'ref-1', status: 'failed' } }
      const body = Buffer.from(JSON.stringify(bodyObj))
      const crypto = require('crypto')
      const hash = crypto.createHmac('sha512', 'test-secret').update(body).digest('hex')
      await expect(service.handleWebhook(body, hash)).resolves.toBeUndefined()
    })

    it('calls confirmPayment for charge.success event', async () => {
      const supabase = makeSupabaseMock()
      supabase._mockFrom.mockImplementation((table: string) => {
        if (table === 'commitment_payments')
          return q({
            data: {
              id: 'pay-1',
              status: 'pending',
              interest_id: 'int-1',
              event_id: 'evt-1',
              vendor_id: 'ven-1',
              user_id: 'user-1',
              amount_kobo: 150000,
              commitment_pct: 30,
            },
            error: null,
          })
        if (table === 'vendors') return q({ data: vendorRow, error: null })
        if (table === 'events') return q({ data: eventRow, error: null })
        if (table === 'users') return q({ data: userRow, error: null })
        if (table === 'vendor_payment_structures') return q({ data: null, error: null })
        if (table === 'vendor_interests') return q({ data: null, error: null })
        return q()
      })
      const service = new PaymentsService(
        supabase as any,
        mockEmail as any as EmailService,
        mockConfig as any as ConfigService,
      )
      const bodyObj = { event: 'charge.success', data: { reference: 'ref-1', status: 'success' } }
      const body = Buffer.from(JSON.stringify(bodyObj))
      const crypto = require('crypto')
      const hash = crypto.createHmac('sha512', 'test-secret').update(body).digest('hex')
      mockFetch({
        status: true,
        message: 'OK',
        data: {
          status: 'success',
          reference: 'ref-1',
          amount: 150000,
          paid_at: '2099-01-01',
          metadata: {},
        },
      })
      await expect(service.handleWebhook(body, hash)).resolves.toBeUndefined()
    })
  })

  describe('getPaymentByReference()', () => {
    it('throws NotFoundException when payment not found', async () => {
      const { service } = makeService({
        commitment_payments: q({ data: null, error: { message: 'not found' } }),
      })
      await expect(service.getPaymentByReference('ref-1')).rejects.toThrow(NotFoundException)
    })

    it('returns payment data', async () => {
      const paymentData = {
        id: 'pay-1',
        status: 'success',
        amount_kobo: 150000,
        commitment_pct: 30,
        paid_at: '2099-01-01',
        created_at: '2099-01-01',
        vendors: { name: 'Vendor A' },
        events: { title: 'Wedding', city: 'Lagos' },
      }
      const { service } = makeService({
        commitment_payments: q({ data: paymentData, error: null }),
      })
      const result = await service.getPaymentByReference('ref-1')
      expect(result).toEqual(paymentData)
    })
  })

  describe('getMyPayments()', () => {
    it('returns empty array when no payments found', async () => {
      const { service } = makeService({
        commitment_payments: q({ data: [], error: null }),
      })
      const result = await service.getMyPayments('user-1')
      expect(result).toEqual([])
    })

    it('returns payment history for organiser', async () => {
      const rows = [
        {
          id: 'p1',
          status: 'success',
          amount_kobo: 150000,
          platform_fee_kobo: 2500,
          commitment_pct: 30,
          paid_at: '2099-01-01',
          created_at: '2099-01-01',
          vendors: { name: 'Vendor A', vendor_categories: { name: 'Catering' } },
          events: { title: 'Wedding', event_date: '2099-12-01', city: 'Lagos' },
        },
      ]
      const { service } = makeService({
        commitment_payments: q({ data: rows, error: null }),
      })
      const result = await service.getMyPayments('user-1')
      expect(result).toHaveLength(1)
      expect(result[0].status).toBe('success')
    })

    it('throws on DB error', async () => {
      const { service } = makeService({
        commitment_payments: q({ data: null, error: { message: 'db error' } }),
      })
      await expect(service.getMyPayments('user-1')).rejects.toThrow(InternalServerErrorException)
    })
  })
})
