import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common'
import { GiftsService } from './gifts.service'
import { makeSupabaseMock, q } from '../test/supabase.mock'

const mockConfig = {
  get: jest.fn().mockImplementation((key: string) => {
    if (key === 'paystackSecretKey') return 'sk_test_xxx'
    if (key === 'paystackPublicKey') return 'pk_test_xxx'
    if (key === 'appUrl') return 'http://localhost:3000'
    return null
  }),
}

const mockEmail = {
  sendGiftReceived: jest.fn().mockResolvedValue(undefined),
  sendDirectTransferReported: jest.fn().mockResolvedValue(undefined),
}

const eventRow = { id: 'event-1', title: 'Baby Shower', user_id: 'user-1' }
const giftListRow = {
  id: 'gl-1',
  event_id: 'event-1',
  cash_contribution_enabled: false,
  bank_account_name: null,
  bank_account_number: null,
  bank_name: null,
  bank_code: null,
  paystack_recipient_code: null,
}
const itemRow = {
  id: 'item-1',
  title: 'Baby monitor',
  description: null,
  price_estimate: 25000,
  store_url: null,
  status: 'available',
  claimed_by_name: null,
  sort_order: 0,
}

function makeService() {
  const supabase = makeSupabaseMock()
  return {
    svc: new GiftsService(supabase as any, mockConfig as any, mockEmail as any),
    client: supabase._client,
  }
}

describe('GiftsService', () => {
  beforeEach(() => jest.clearAllMocks())

  // ── calculateGiftCharge ────────────────────────────────────────────────────

  describe('calculateGiftCharge()', () => {
    it('returns inflated charge so organiser receives full gift amount', () => {
      const { svc } = makeService()
      const { chargeNaira, feeNaira } = svc.calculateGiftCharge(10000)
      expect(chargeNaira).toBeGreaterThan(10000)
      expect(feeNaira).toEqual(chargeNaira - 10000)
      // Verify math: charge * 0.985 - 100 >= 10000 + 100
      expect(chargeNaira * 0.985 - 100).toBeGreaterThanOrEqual(10100 - 1) // allow rounding
    })

    it('returns ceiling integer', () => {
      const { svc } = makeService()
      const { chargeNaira } = svc.calculateGiftCharge(5000)
      expect(Number.isInteger(chargeNaira)).toBe(true)
    })
  })

  // ── getGiftListPublic ──────────────────────────────────────────────────────

  describe('getGiftListPublic()', () => {
    it('returns event, items and bank account info', async () => {
      const { svc, client } = makeService()
      const listWithBank = {
        ...giftListRow,
        cash_contribution_enabled: true,
        bank_account_name: 'Ada Johnson',
        bank_account_number: '0123456789',
        bank_name: 'GTBank',
      }
      client.from = jest
        .fn()
        .mockReturnValueOnce(q({ data: eventRow }))
        .mockReturnValueOnce(q({ data: listWithBank }))
        .mockReturnValueOnce(q({ data: [itemRow] }))

      const result = await svc.getGiftListPublic('event-1')
      expect(result.event).toMatchObject({ id: 'event-1' })
      expect(result.cashContributionEnabled).toBe(true)
      expect(result.bankAccount).toMatchObject({ accountNumber: '0123456789' })
      expect(result.items).toHaveLength(1)
    })

    it('returns null bankAccount when bank number not set', async () => {
      const { svc, client } = makeService()
      client.from = jest
        .fn()
        .mockReturnValueOnce(q({ data: eventRow }))
        .mockReturnValueOnce(q({ data: giftListRow }))
        .mockReturnValueOnce(q({ data: [] }))

      const result = await svc.getGiftListPublic('event-1')
      expect(result.bankAccount).toBeNull()
    })

    it('returns empty items when no gift list exists', async () => {
      const { svc, client } = makeService()
      client.from = jest
        .fn()
        .mockReturnValueOnce(q({ data: eventRow }))
        .mockReturnValueOnce(q({ data: null }))

      const result = await svc.getGiftListPublic('event-1')
      expect(result.items).toHaveLength(0)
    })

    it('throws NotFoundException for unknown event', async () => {
      const { svc, client } = makeService()
      client.from = jest.fn().mockReturnValueOnce(q({ error: { message: 'not found' } }))
      await expect(svc.getGiftListPublic('bad-id')).rejects.toThrow(NotFoundException)
    })
  })

  // ── claimItem ─────────────────────────────────────────────────────────────

  describe('claimItem()', () => {
    it('marks item as claimed', async () => {
      const { svc, client } = makeService()
      const claimedRow = { ...itemRow, status: 'claimed', claimed_by_name: 'Fatima' }
      client.from = jest
        .fn()
        .mockReturnValueOnce(q({ data: itemRow }))
        .mockReturnValueOnce(q({ data: claimedRow }))

      const result = await svc.claimItem('item-1', { claimerName: 'Fatima' })
      expect(result.claimed_by_name).toBe('Fatima')
    })

    it('throws ConflictException when item already claimed', async () => {
      const { svc, client } = makeService()
      client.from = jest.fn().mockReturnValueOnce(q({ data: { ...itemRow, status: 'claimed' } }))
      await expect(svc.claimItem('item-1', { claimerName: 'Fatima' })).rejects.toThrow(
        ConflictException,
      )
    })

    it('throws NotFoundException when item not found', async () => {
      const { svc, client } = makeService()
      client.from = jest.fn().mockReturnValueOnce(q({ data: null }))
      await expect(svc.claimItem('bad-id', { claimerName: 'Fatima' })).rejects.toThrow(
        NotFoundException,
      )
    })
  })

  // ── initializeGiftPayment ─────────────────────────────────────────────────

  describe('initializeGiftPayment()', () => {
    it('creates a payment record and returns Paystack config', async () => {
      const { svc, client } = makeService()
      client.from = jest
        .fn()
        .mockReturnValueOnce(q({ data: giftListRow })) // getOrCreateGiftListAdmin select
        .mockReturnValueOnce(q({ data: null })) // insert payment

      const result = await svc.initializeGiftPayment('event-1', {
        giftAmountNaira: 5000,
        gifterName: 'Chidi',
        gifterEmail: 'chidi@test.com',
      })

      expect(result.publicKey).toBe('pk_test_xxx')
      expect(result.giftAmountNaira).toBe(5000)
      expect(result.chargeNaira).toBeGreaterThan(5000)
      expect(result.reference).toMatch(/owambe-gift-/)
    })

    it('throws BadRequestException for amount below minimum', async () => {
      const { svc } = makeService()
      await expect(
        svc.initializeGiftPayment('event-1', { giftAmountNaira: 50, gifterName: 'X' }),
      ).rejects.toThrow(BadRequestException)
    })
  })

  // ── reportDirectTransfer ──────────────────────────────────────────────────

  describe('reportDirectTransfer()', () => {
    it('creates a pending transfer record and emails organiser', async () => {
      const { svc, client } = makeService()
      const transferRow = {
        id: 'dt-1',
        gifter_name: 'Ngozi',
        amount_naira: 10000,
        status: 'pending',
      }
      const eventWithOrg = {
        ...eventRow,
        'users!user_id': { email: 'org@test.com', full_name: 'Ada' },
      }

      client.from = jest
        .fn()
        .mockReturnValueOnce(q({ data: giftListRow })) // get gift list
        .mockReturnValueOnce(q({ data: transferRow })) // insert transfer
        .mockReturnValueOnce(q({ data: eventWithOrg })) // fetch event+organiser

      const result = await svc.reportDirectTransfer('event-1', {
        gifterName: 'Ngozi',
        amountNaira: 10000,
      })

      expect(result.success).toBe(true)
      expect(result.transferId).toBe('dt-1')
    })

    it('throws BadRequestException for zero amount', async () => {
      const { svc } = makeService()
      await expect(
        svc.reportDirectTransfer('event-1', { gifterName: 'X', amountNaira: 0 }),
      ).rejects.toThrow(BadRequestException)
    })
  })

  // ── confirmDirectTransfer ─────────────────────────────────────────────────

  describe('confirmDirectTransfer()', () => {
    it('marks transfer as confirmed', async () => {
      const { svc, client } = makeService()
      const transfer = {
        id: 'dt-1',
        status: 'pending',
        event_id: 'event-1',
        events: { user_id: 'user-1' },
      }

      client.from = jest
        .fn()
        .mockReturnValueOnce(q({ data: transfer }))
        .mockReturnValueOnce(q({ data: { ...transfer, status: 'confirmed' } }))

      const result = await svc.confirmDirectTransfer('dt-1', 'user-1')
      expect(result.success).toBe(true)
    })

    it('throws ForbiddenException for wrong owner', async () => {
      const { svc, client } = makeService()
      const transfer = {
        id: 'dt-1',
        status: 'pending',
        event_id: 'event-1',
        events: { user_id: 'other-user' },
      }
      client.from = jest.fn().mockReturnValueOnce(q({ data: transfer }))
      await expect(svc.confirmDirectTransfer('dt-1', 'user-1')).rejects.toThrow(ForbiddenException)
    })

    it('returns success immediately if already confirmed', async () => {
      const { svc, client } = makeService()
      const transfer = {
        id: 'dt-1',
        status: 'confirmed',
        event_id: 'event-1',
        events: { user_id: 'user-1' },
      }
      client.from = jest.fn().mockReturnValueOnce(q({ data: transfer }))
      const result = await svc.confirmDirectTransfer('dt-1', 'user-1')
      expect(result.success).toBe(true)
    })
  })

  // ── updateGiftSettings ────────────────────────────────────────────────────

  describe('updateGiftSettings()', () => {
    it('saves bank account and enables contribution', async () => {
      const { svc, client } = makeService()
      const updated = {
        ...giftListRow,
        bank_account_name: 'Ada J',
        bank_account_number: '0123456789',
        bank_name: 'GTBank',
        cash_contribution_enabled: true,
      }

      client.from = jest
        .fn()
        .mockReturnValueOnce(q({ data: eventRow })) // verify ownership
        .mockReturnValueOnce(q({ data: giftListRow })) // get or create list
        .mockReturnValueOnce(q({ data: updated })) // update

      const result = await svc.updateGiftSettings('event-1', 'user-1', {
        bankAccountName: 'Ada J',
        bankAccountNumber: '0123456789',
        bankName: 'GTBank',
        cashContributionEnabled: true,
      })

      expect(result.bank_account_number).toBe('0123456789')
    })
  })

  // ── getGiftDashboard ──────────────────────────────────────────────────────

  describe('getGiftDashboard()', () => {
    it('returns settings, payments, transfers and wishlist', async () => {
      const { svc, client } = makeService()
      client.from = jest
        .fn()
        .mockReturnValueOnce(q({ data: eventRow })) // verify ownership
        .mockReturnValueOnce(q({ data: giftListRow })) // get list
        .mockReturnValueOnce(q({ data: [{ id: 'p-1' }] })) // payments
        .mockReturnValueOnce(q({ data: [] })) // transfers
        .mockReturnValueOnce(q({ data: [itemRow] })) // items

      const result = await svc.getGiftDashboard('event-1', 'user-1')
      expect(result.payments).toHaveLength(1)
      expect(result.wishlistItems).toHaveLength(1)
      expect(result.settings).toBeDefined()
    })
  })

  // ── addItem ───────────────────────────────────────────────────────────────

  describe('addItem()', () => {
    it('creates a gift item for an owned event', async () => {
      const { svc, client } = makeService()
      client.from = jest
        .fn()
        .mockReturnValueOnce(q({ data: eventRow }))
        .mockReturnValueOnce(q({ data: giftListRow }))
        .mockReturnValueOnce(q({ data: itemRow }))

      const result = await svc.addItem('event-1', 'user-1', { title: 'Baby monitor' })
      expect(result.title).toBe('Baby monitor')
    })
  })

  // ── updateItem ────────────────────────────────────────────────────────────

  describe('updateItem()', () => {
    it('updates item for owner', async () => {
      const { svc, client } = makeService()
      const itemWithOwner = {
        ...itemRow,
        gift_lists: { event_id: 'event-1', events: { user_id: 'user-1' } },
      }
      client.from = jest
        .fn()
        .mockReturnValueOnce(q({ data: itemWithOwner }))
        .mockReturnValueOnce(q({ data: { ...itemRow, status: 'claimed' } }))

      const result = await svc.updateItem('item-1', 'user-1', { isPurchased: true })
      expect(result).toBeDefined()
    })

    it('throws ForbiddenException for wrong owner', async () => {
      const { svc, client } = makeService()
      const itemWithOwner = {
        ...itemRow,
        gift_lists: { event_id: 'event-1', events: { user_id: 'other' } },
      }
      client.from = jest.fn().mockReturnValueOnce(q({ data: itemWithOwner }))
      await expect(svc.updateItem('item-1', 'user-1', {})).rejects.toThrow(ForbiddenException)
    })
  })

  // ── deleteItem ────────────────────────────────────────────────────────────

  describe('deleteItem()', () => {
    it('deletes an owned item', async () => {
      const { svc, client } = makeService()
      const itemWithOwner = { ...itemRow, gift_lists: { events: { user_id: 'user-1' } } }
      client.from = jest
        .fn()
        .mockReturnValueOnce(q({ data: itemWithOwner }))
        .mockReturnValueOnce(q({ data: null }))

      const result = await svc.deleteItem('item-1', 'user-1')
      expect(result.success).toBe(true)
    })

    it('throws ForbiddenException for wrong owner', async () => {
      const { svc, client } = makeService()
      const itemWithOwner = { ...itemRow, gift_lists: { events: { user_id: 'other' } } }
      client.from = jest.fn().mockReturnValueOnce(q({ data: itemWithOwner }))
      await expect(svc.deleteItem('item-1', 'user-1')).rejects.toThrow(ForbiddenException)
    })
  })
})
