import { BadRequestException, NotFoundException } from '@nestjs/common'
import { GuestsService } from './guests.service'
import { makeSupabaseMock, q } from '../test/supabase.mock'

const mockInvites = {
  generateAndStoreQrCode: jest.fn().mockResolvedValue('https://storage.example.com/qr.png'),
  sendInviteEmail: jest.fn().mockResolvedValue(undefined),
}
const mockPosthog = { capture: jest.fn() }

const guestListRow = { id: 'gl-id-1' }
const guestRow = {
  id: 'invite-id-1',
  full_name: 'Ngozi',
  email: 'ngozi@example.com',
  phone: null,
  allocation: 1,
  token: 'token-xyz',
  rsvp_status: 'pending',
  checked_in_count: 0,
  invite_sent_at: null,
}

function makeService(fromMap: Record<string, any> = {}) {
  const supabase = makeSupabaseMock(fromMap)
  return {
    svc: new GuestsService(supabase as any, mockInvites as any, mockPosthog as any),
    supabase,
  }
}

describe('GuestsService', () => {
  beforeEach(() => jest.clearAllMocks())

  describe('addGuest()', () => {
    it('creates a guest and triggers QR + email async', async () => {
      const { svc, supabase } = makeService()
      supabase._client.from = jest
        .fn()
        .mockReturnValueOnce(q({ data: guestListRow, error: null })) // getGuestListId
        .mockReturnValueOnce(q({ data: guestRow, error: null }))     // insert guest

      const result = await svc.addGuest(
        'event-id-1',
        {
          fullName: 'Ngozi',
          email: 'ngozi@example.com',
          allocation: 1,
        },
        'user-id-1',
      )

      expect(result.full_name).toBe('Ngozi')
      expect(mockPosthog.capture).toHaveBeenCalledWith(
        'user-id-1',
        'guest_added',
        expect.any(Object),
      )
    })

    it('throws BadRequestException for allocation < 1', async () => {
      const { svc, supabase } = makeService()
      supabase._client.from = jest
        .fn()
        .mockReturnValueOnce(q({ data: guestListRow, error: null })) // getGuestListId

      await expect(
        svc.addGuest('event-id-1', { fullName: 'X', email: 'x@x.com', allocation: 0 }, 'user-1'),
      ).rejects.toThrow(BadRequestException)
    })
  })

  describe('getGuests()', () => {
    it('returns list of guests for owned event', async () => {
      const { svc, supabase } = makeService()
      supabase._client.from = jest
        .fn()
        .mockReturnValueOnce(q({ data: guestListRow, error: null })) // getGuestListId
        .mockReturnValueOnce(q({ data: [guestRow], error: null }))   // getGuests query

      const result = await svc.getGuests('event-id-1', 'user-id-1')
      expect(result).toHaveLength(1)
    })
  })

  describe('updateGuest()', () => {
    it('updates guest fields when user owns the event', async () => {
      const { svc, supabase } = makeService()
      const ownerGuest = {
        id: 'invite-id-1',
        guest_lists: { events: { user_id: 'user-id-1' } },
      }
      supabase._client.from = jest
        .fn()
        .mockReturnValueOnce(q({ data: ownerGuest, error: null }))
        .mockReturnValueOnce(q({ data: { ...guestRow, full_name: 'Updated' }, error: null }))

      const result = await svc.updateGuest('invite-id-1', { fullName: 'Updated' }, 'user-id-1')
      expect(result.full_name).toBe('Updated')
    })

    it('throws NotFoundException when guest not found', async () => {
      const { svc, supabase } = makeService()
      supabase._client.from = jest
        .fn()
        .mockReturnValueOnce(q({ data: null, error: { message: 'not found' } }))
      await expect(svc.updateGuest('bad-id', { fullName: 'X' }, 'user-1')).rejects.toThrow(
        NotFoundException,
      )
    })
  })

  describe('deleteGuest()', () => {
    it('deletes guest when user owns the event', async () => {
      const { svc, supabase } = makeService()
      const ownerGuest = {
        id: 'invite-id-1',
        guest_lists: { events: { user_id: 'user-id-1' } },
      }
      supabase._client.from = jest
        .fn()
        .mockReturnValueOnce(q({ data: ownerGuest, error: null }))
        .mockReturnValueOnce(q({ data: null, error: null }))
      const result = await svc.deleteGuest('invite-id-1', 'user-id-1')
      expect(result.success).toBe(true)
    })

    it('throws NotFoundException when guest not found', async () => {
      const { svc, supabase } = makeService()
      supabase._client.from = jest
        .fn()
        .mockReturnValueOnce(q({ data: null, error: { message: 'not found' } }))
      await expect(svc.deleteGuest('bad-id', 'user-1')).rejects.toThrow(NotFoundException)
    })
  })
})
