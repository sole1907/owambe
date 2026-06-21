import { BadRequestException, NotFoundException } from '@nestjs/common'
import { InvitesService } from './invites.service'
import { makeSupabaseMock, q } from '../test/supabase.mock'

jest.mock('qrcode', () => ({
  toBuffer: jest.fn().mockResolvedValue(Buffer.from('fake-qr')),
}))

const mockEmail = {
  sendInvite: jest.fn().mockResolvedValue(undefined),
  sendPlusOneRequestToHost: jest.fn().mockResolvedValue(undefined),
  sendPlusOneOutcomeToGuest: jest.fn().mockResolvedValue(undefined),
}

const mockConfig = {
  get: jest.fn().mockImplementation((key: string) => {
    if (key === 'appUrl') return 'https://app.owambe.com'
    if (key === 'paystackSecretKey') return null
    return null
  }),
}

const guestInvite = {
  id: 'invite-id-1',
  full_name: 'Adaeze',
  email: 'adaeze@example.com',
  allocation: 2,
  checked_in_count: 0,
  rsvp_status: 'pending',
  token: 'token-abc',
  qr_code_url: 'https://storage.example.com/qr.png',
  guest_lists: {
    events: {
      id: 'event-id-1',
      title: 'Big Wedding',
      user_id: 'host-id-1',
      event_date: '2025-12-01',
      event_date_approximate: null,
      city: 'Lagos',
    },
  },
}

function makeService(fromMap: Record<string, any> = {}) {
  const supabase = makeSupabaseMock(fromMap)
  return { svc: new InvitesService(supabase as any, mockEmail as any, mockConfig as any), supabase }
}

describe('InvitesService', () => {
  beforeEach(() => jest.clearAllMocks())

  describe('checkIn()', () => {
    it('increments checked_in_count and returns success', async () => {
      const { svc, supabase } = makeService()
      supabase._client.from = jest
        .fn()
        .mockReturnValueOnce(q({ data: guestInvite, error: null })) // select invite
        .mockReturnValueOnce(q({ data: {}, error: null })) // update
      const result = await svc.checkIn('token-abc')
      expect(result.success).toBe(true)
      expect(result.guestName).toBe('Adaeze')
      expect(result.checkedInCount).toBe(1)
      expect(result.remaining).toBe(1)
    })

    it('returns over_limit when all spots used', async () => {
      const fullGuest = { ...guestInvite, checked_in_count: 2, allocation: 2 }
      const { svc, supabase } = makeService()
      supabase._client.from = jest.fn().mockReturnValueOnce(q({ data: fullGuest, error: null }))
      const result = await svc.checkIn('token-abc')
      expect(result.success).toBe(false)
      expect(result.reason).toBe('over_limit')
      expect(result.remaining).toBe(0)
    })

    it('throws NotFoundException for invalid token', async () => {
      const { svc, supabase } = makeService()
      supabase._client.from = jest
        .fn()
        .mockReturnValueOnce(q({ data: null, error: { message: 'not found' } }))
      await expect(svc.checkIn('bad-token')).rejects.toThrow(NotFoundException)
    })
  })

  describe('getInviteByToken()', () => {
    it('returns invite with event details', async () => {
      const { svc, supabase } = makeService()
      supabase._client.from = jest
        .fn()
        .mockReturnValueOnce(q({ data: guestInvite, error: null })) // invite
        .mockReturnValueOnce(q({ data: null, error: null })) // pending plus-one
      const result = await svc.getInviteByToken('token-abc')
      expect(result.full_name).toBe('Adaeze')
      expect(result.pendingPlusOneRequest).toBeNull()
    })

    it('includes pending plus-one request if it exists', async () => {
      const pendingReq = { id: 'req-1', requested_count: 1, status: 'pending' }
      const { svc, supabase } = makeService()
      supabase._client.from = jest
        .fn()
        .mockReturnValueOnce(q({ data: guestInvite, error: null }))
        .mockReturnValueOnce(q({ data: pendingReq, error: null }))
      const result = await svc.getInviteByToken('token-abc')
      expect(result.pendingPlusOneRequest).toEqual(pendingReq)
    })

    it('throws NotFoundException for invalid token', async () => {
      const { svc, supabase } = makeService()
      supabase._client.from = jest
        .fn()
        .mockReturnValueOnce(q({ data: null, error: { message: 'not found' } }))
      await expect(svc.getInviteByToken('bad')).rejects.toThrow(NotFoundException)
    })
  })

  describe('requestPlusOne()', () => {
    const dto = { requestedCount: 1, reason: 'bringing spouse' }

    it('creates a plus-one request', async () => {
      const requestRow = { id: 'req-1', requested_count: 1, status: 'pending' }
      const hostRow = { email: 'host@example.com', full_name: 'Emeka' }
      const { svc, supabase } = makeService()
      supabase._client.from = jest
        .fn()
        .mockReturnValueOnce(q({ data: guestInvite, error: null })) // fetch invite
        .mockReturnValueOnce(q({ data: null, error: null })) // check existing (none)
        .mockReturnValueOnce(q({ data: requestRow, error: null })) // insert request
        .mockReturnValueOnce(q({ data: hostRow, error: null })) // fetch host
      await svc.requestPlusOne('token-abc', dto as any)
      expect(mockEmail.sendPlusOneRequestToHost).toHaveBeenCalled()
    })

    it('throws BadRequestException if request count < 1', async () => {
      const { svc } = makeService()
      await expect(svc.requestPlusOne('token', { requestedCount: 0 } as any)).rejects.toThrow(
        BadRequestException,
      )
    })

    it('throws BadRequestException if pending request already exists', async () => {
      const { svc, supabase } = makeService()
      supabase._client.from = jest
        .fn()
        .mockReturnValueOnce(q({ data: guestInvite, error: null }))
        .mockReturnValueOnce(q({ data: { id: 'existing-req' }, error: null })) // existing
      await expect(svc.requestPlusOne('token-abc', dto as any)).rejects.toThrow(BadRequestException)
    })
  })

  describe('reviewPlusOneRequest()', () => {
    const pendingRequest = {
      id: 'req-1',
      requested_count: 2,
      status: 'pending',
      guest_invites: {
        id: 'invite-id-1',
        full_name: 'Adaeze',
        email: 'adaeze@example.com',
        allocation: 2,
        token: 'token-abc',
        guest_lists: { events: { id: 'event-id-1', title: 'Wedding', user_id: 'host-id-1' } },
      },
    }

    it('approves request — updates allocation and sends outcome email', async () => {
      const { svc, supabase } = makeService()
      supabase._client.from = jest
        .fn()
        .mockReturnValueOnce(q({ data: pendingRequest, error: null })) // fetch request
        .mockReturnValueOnce(q({ data: {}, error: null })) // update request status
        .mockReturnValueOnce(q({ data: {}, error: null })) // update allocation
        .mockReturnValueOnce(q({ data: {}, error: null })) // generateAndStoreQrCode: update qr_code_url
      const result = await svc.reviewPlusOneRequest('req-1', true, 'host-id-1')
      expect(result.approved).toBe(true)
      expect(result.newAllocation).toBe(4)
      expect(mockEmail.sendPlusOneOutcomeToGuest).toHaveBeenCalledWith(
        expect.objectContaining({ approved: true }),
      )
    })

    it('rejects request — sends rejection email without changing allocation', async () => {
      const { svc, supabase } = makeService()
      supabase._client.from = jest
        .fn()
        .mockReturnValueOnce(q({ data: pendingRequest, error: null }))
        .mockReturnValueOnce(q({ data: {}, error: null })) // update status
      const result = await svc.reviewPlusOneRequest('req-1', false, 'host-id-1')
      expect(result.approved).toBe(false)
      expect(mockEmail.sendPlusOneOutcomeToGuest).toHaveBeenCalledWith(
        expect.objectContaining({ approved: false }),
      )
    })

    it('throws NotFoundException for wrong owner', async () => {
      const { svc, supabase } = makeService()
      supabase._client.from = jest
        .fn()
        .mockReturnValueOnce(q({ data: pendingRequest, error: null }))
      await expect(svc.reviewPlusOneRequest('req-1', true, 'different-host')).rejects.toThrow(
        NotFoundException,
      )
    })

    it('throws BadRequestException if request already reviewed', async () => {
      const reviewed = { ...pendingRequest, status: 'approved' }
      const { svc, supabase } = makeService()
      supabase._client.from = jest.fn().mockReturnValueOnce(q({ data: reviewed, error: null }))
      await expect(svc.reviewPlusOneRequest('req-1', true, 'host-id-1')).rejects.toThrow(
        BadRequestException,
      )
    })
  })
})
