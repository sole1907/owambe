import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { CollaboratorsService } from './collaborators.service'
import { makeSupabaseMock, q } from '../test/supabase.mock'

const mockConfig = {
  get: jest.fn().mockImplementation((key: string) => {
    if (key === 'appUrl') return 'http://localhost:3000'
    return null
  }),
}

const mockEmail = {
  sendCollaboratorInvite: jest.fn().mockResolvedValue(undefined),
}

const eventRow = {
  id: 'event-1',
  title: 'Owambe 2025',
  event_date: '2025-12-20T00:00:00Z',
  event_date_approximate: null,
  user_id: 'owner-1',
  users: { full_name: 'Ada Okafor' },
}

function makeService() {
  const supabase = makeSupabaseMock()
  return {
    svc: new CollaboratorsService(supabase as any, mockConfig as any, mockEmail as any),
    client: supabase._client,
  }
}

describe('CollaboratorsService', () => {
  beforeEach(() => jest.clearAllMocks())

  // ── inviteCollaborator ────────────────────────────────────────────────────

  describe('inviteCollaborator()', () => {
    it('creates a collaborator record and sends invite email', async () => {
      const { svc, client } = makeService()
      const collabRow = {
        id: 'col-1',
        event_id: 'event-1',
        invited_email: 'coord@test.com',
        status: 'pending',
      }

      client.from = jest
        .fn()
        .mockReturnValueOnce(q({ data: eventRow })) // verify ownership
        .mockReturnValueOnce(q({ data: null })) // no existing invite
        .mockReturnValueOnce(q({ data: collabRow })) // insert

      const result = await svc.inviteCollaborator('event-1', 'owner-1', {
        email: 'coord@test.com',
        message: 'Looking forward to working with you!',
      })

      expect(result.status).toBe('pending')
      expect(mockEmail.sendCollaboratorInvite).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'coord@test.com', eventTitle: 'Owambe 2025' }),
      )
    })

    it('throws ConflictException when active invite exists', async () => {
      const { svc, client } = makeService()
      client.from = jest
        .fn()
        .mockReturnValueOnce(q({ data: eventRow }))
        .mockReturnValueOnce(q({ data: { id: 'col-1', status: 'active' } }))

      await expect(
        svc.inviteCollaborator('event-1', 'owner-1', { email: 'coord@test.com' }),
      ).rejects.toThrow(ConflictException)
    })

    it('throws ConflictException when pending invite exists', async () => {
      const { svc, client } = makeService()
      client.from = jest
        .fn()
        .mockReturnValueOnce(q({ data: eventRow }))
        .mockReturnValueOnce(q({ data: { id: 'col-1', status: 'pending' } }))

      await expect(
        svc.inviteCollaborator('event-1', 'owner-1', { email: 'coord@test.com' }),
      ).rejects.toThrow(ConflictException)
    })

    it('throws NotFoundException when caller does not own the event', async () => {
      const { svc, client } = makeService()
      client.from = jest
        .fn()
        .mockReturnValueOnce(q({ data: null, error: { message: 'not found' } }))

      await expect(
        svc.inviteCollaborator('event-1', 'other-user', { email: 'coord@test.com' }),
      ).rejects.toThrow(NotFoundException)
    })
  })

  // ── listCollaborators ─────────────────────────────────────────────────────

  describe('listCollaborators()', () => {
    it('returns active and pending collaborators', async () => {
      const { svc, client } = makeService()
      const collabs = [{ id: 'col-1', invited_email: 'coord@test.com', status: 'active' }]

      client.from = jest
        .fn()
        .mockReturnValueOnce(q({ data: { id: 'event-1' } }))
        .mockReturnValueOnce(q({ data: collabs }))

      const result = await svc.listCollaborators('event-1', 'owner-1')
      expect(result).toHaveLength(1)
      expect(result[0].status).toBe('active')
    })
  })

  // ── revokeCollaborator ────────────────────────────────────────────────────

  describe('revokeCollaborator()', () => {
    it('revokes an existing collaborator', async () => {
      const { svc, client } = makeService()
      const collab = { id: 'col-1', event_id: 'event-1', events: { user_id: 'owner-1' } }

      client.from = jest
        .fn()
        .mockReturnValueOnce(q({ data: collab }))
        .mockReturnValueOnce(q({ data: null }))

      const result = await svc.revokeCollaborator('col-1', 'owner-1')
      expect(result.success).toBe(true)
    })

    it('throws ForbiddenException for non-owner', async () => {
      const { svc, client } = makeService()
      const collab = { id: 'col-1', event_id: 'event-1', events: { user_id: 'owner-1' } }
      client.from = jest.fn().mockReturnValueOnce(q({ data: collab }))

      await expect(svc.revokeCollaborator('col-1', 'other-user')).rejects.toThrow(
        ForbiddenException,
      )
    })
  })

  // ── acceptInvite ──────────────────────────────────────────────────────────

  describe('acceptInvite()', () => {
    it('activates a pending invite', async () => {
      const { svc, client } = makeService()
      const collab = {
        id: 'col-1',
        event_id: 'event-1',
        status: 'pending',
        invited_email: 'coord@test.com',
      }

      client.from = jest
        .fn()
        .mockReturnValueOnce(q({ data: collab }))
        .mockReturnValueOnce(q({ data: null }))

      const result = await svc.acceptInvite('valid-token', 'user-1')
      expect(result.eventId).toBe('event-1')
      expect(result.alreadyAccepted).toBe(false)
    })

    it('returns alreadyAccepted=true for active invite', async () => {
      const { svc, client } = makeService()
      const collab = {
        id: 'col-1',
        event_id: 'event-1',
        status: 'active',
        invited_email: 'coord@test.com',
      }
      client.from = jest.fn().mockReturnValueOnce(q({ data: collab }))

      const result = await svc.acceptInvite('valid-token', 'user-1')
      expect(result.alreadyAccepted).toBe(true)
    })

    it('throws ForbiddenException for revoked invite', async () => {
      const { svc, client } = makeService()
      const collab = {
        id: 'col-1',
        event_id: 'event-1',
        status: 'revoked',
        invited_email: 'coord@test.com',
      }
      client.from = jest.fn().mockReturnValueOnce(q({ data: collab }))

      await expect(svc.acceptInvite('token', 'user-1')).rejects.toThrow(ForbiddenException)
    })

    it('throws NotFoundException for invalid token', async () => {
      const { svc, client } = makeService()
      client.from = jest
        .fn()
        .mockReturnValueOnce(q({ data: null, error: { message: 'not found' } }))

      await expect(svc.acceptInvite('bad-token', 'user-1')).rejects.toThrow(NotFoundException)
    })
  })

  // ── getCollaboratorRole ───────────────────────────────────────────────────

  describe('getCollaboratorRole()', () => {
    it('returns owner for event owner', async () => {
      const { svc, client } = makeService()
      client.from = jest.fn().mockReturnValueOnce(q({ data: { user_id: 'user-1' } }))

      const role = await svc.getCollaboratorRole('event-1', 'user-1')
      expect(role).toBe('owner')
    })

    it('returns coordinator for active collaborator', async () => {
      const { svc, client } = makeService()
      client.from = jest
        .fn()
        .mockReturnValueOnce(q({ data: { user_id: 'owner-1' } }))
        .mockReturnValueOnce(q({ data: { id: 'col-1' } }))

      const role = await svc.getCollaboratorRole('event-1', 'coord-1')
      expect(role).toBe('coordinator')
    })

    it('returns null for unauthorized user', async () => {
      const { svc, client } = makeService()
      client.from = jest
        .fn()
        .mockReturnValueOnce(q({ data: { user_id: 'owner-1' } }))
        .mockReturnValueOnce(q({ data: null }))

      const role = await svc.getCollaboratorRole('event-1', 'stranger')
      expect(role).toBeNull()
    })
  })
})
