import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { GiftsService } from './gifts.service'
import { makeSupabaseMock, q } from '../test/supabase.mock'

const mockConfig = {
  get: jest.fn().mockImplementation((key: string) => (key === 'paystackSecretKey' ? null : null)),
}

const eventRow = { id: 'event-id-1', title: 'Baby Shower', user_id: 'user-id-1' }
const giftListRow = {
  id: 'gl-id-1',
  event_id: 'event-id-1',
  cash_contribution_enabled: false,
  cash_contribution_link: null,
}
const itemRow = {
  id: 'item-id-1',
  title: 'Nappies',
  description: null,
  price_estimate: 5000,
  is_purchased: false,
  purchased_by: null,
  sort_order: 0,
}

function makeService(fromMap: Record<string, any> = {}) {
  const supabase = makeSupabaseMock(fromMap)
  return { svc: new GiftsService(supabase as any, mockConfig as any), supabase }
}

describe('GiftsService', () => {
  beforeEach(() => jest.clearAllMocks())

  describe('getGiftList()', () => {
    it('returns event, items and contribution state', async () => {
      const { svc, supabase } = makeService()
      supabase._client.from = jest
        .fn()
        .mockReturnValueOnce(q({ data: eventRow, error: null }))
        .mockReturnValueOnce(q({ data: giftListRow, error: null }))
        .mockReturnValueOnce(q({ data: [itemRow], error: null }))

      const result = await svc.getGiftList('event-id-1')
      expect(result.event).toEqual(eventRow)
      expect(result.items).toHaveLength(1)
      expect(result.cashContributionEnabled).toBe(false)
    })

    it('returns empty items when no gift list exists yet', async () => {
      const { svc, supabase } = makeService()
      supabase._client.from = jest
        .fn()
        .mockReturnValueOnce(q({ data: eventRow, error: null }))
        .mockReturnValueOnce(q({ data: null, error: null })) // no gift list

      const result = await svc.getGiftList('event-id-1')
      expect(result.items).toHaveLength(0)
    })

    it('throws NotFoundException for unknown event', async () => {
      const { svc, supabase } = makeService()
      supabase._client.from = jest
        .fn()
        .mockReturnValueOnce(q({ data: null, error: { message: 'not found' } }))
      await expect(svc.getGiftList('bad-id')).rejects.toThrow(NotFoundException)
    })
  })

  describe('addItem()', () => {
    it('creates a gift item for an owned event', async () => {
      const { svc, supabase } = makeService()
      supabase._client.from = jest
        .fn()
        .mockReturnValueOnce(q({ data: eventRow, error: null })) // verify ownership
        .mockReturnValueOnce(q({ data: giftListRow, error: null })) // get or create list
        .mockReturnValueOnce(q({ data: itemRow, error: null })) // insert item

      const result = await svc.addItem('event-id-1', 'user-id-1', {
        title: 'Nappies',
        priceEstimate: 5000,
      })
      expect(result.title).toBe('Nappies')
    })
  })

  describe('updateItem()', () => {
    it('marks item as purchased', async () => {
      const { svc, supabase } = makeService()
      const itemWithOwner = {
        ...itemRow,
        gift_lists: { event_id: 'event-id-1', events: { user_id: 'user-id-1' } },
      }
      supabase._client.from = jest
        .fn()
        .mockReturnValueOnce(q({ data: itemWithOwner, error: null }))
        .mockReturnValueOnce(q({ data: { ...itemRow, is_purchased: true }, error: null }))

      const result = await svc.updateItem('item-id-1', 'user-id-1', { isPurchased: true })
      expect(result.is_purchased).toBe(true)
    })

    it('throws ForbiddenException for wrong owner', async () => {
      const { svc, supabase } = makeService()
      const itemWithOwner = {
        ...itemRow,
        gift_lists: { event_id: 'event-id-1', events: { user_id: 'other-user' } },
      }
      supabase._client.from = jest.fn().mockReturnValueOnce(q({ data: itemWithOwner, error: null }))
      await expect(svc.updateItem('item-id-1', 'user-id-1', { isPurchased: true })).rejects.toThrow(
        ForbiddenException,
      )
    })
  })

  describe('deleteItem()', () => {
    it('deletes an owned item', async () => {
      const { svc, supabase } = makeService()
      const itemWithOwner = {
        ...itemRow,
        gift_lists: { events: { user_id: 'user-id-1' } },
      }
      supabase._client.from = jest
        .fn()
        .mockReturnValueOnce(q({ data: itemWithOwner, error: null }))
        .mockReturnValueOnce(q({ data: null, error: null }))
      const result = await svc.deleteItem('item-id-1', 'user-id-1')
      expect(result.success).toBe(true)
    })
  })

  describe('enableCashContribution()', () => {
    it('returns existing link without re-calling Paystack if already enabled', async () => {
      const enabledList = {
        ...giftListRow,
        cash_contribution_enabled: true,
        cash_contribution_link: 'https://paystack.com/pay/slug',
      }
      const { svc, supabase } = makeService()
      supabase._client.from = jest
        .fn()
        .mockReturnValueOnce(q({ data: eventRow, error: null }))
        .mockReturnValueOnce(q({ data: enabledList, error: null }))

      const result = await svc.enableCashContribution('event-id-1', 'user-id-1')
      expect(result.enabled).toBe(true)
      expect(result.link).toBe('https://paystack.com/pay/slug')
    })

    it('enables cash contributions and stores null link when no Paystack key', async () => {
      const { svc, supabase } = makeService()
      supabase._client.from = jest
        .fn()
        .mockReturnValueOnce(q({ data: eventRow, error: null })) // verify ownership
        .mockReturnValueOnce(q({ data: giftListRow, error: null })) // get list
        .mockReturnValueOnce(q({ data: null, error: null })) // update list

      const result = await svc.enableCashContribution('event-id-1', 'user-id-1')
      expect(result.enabled).toBe(true)
      expect(result.link).toBeNull()
    })
  })
})
