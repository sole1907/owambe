import { BadRequestException, UnauthorizedException } from '@nestjs/common'
import { AuthService } from './auth.service'
import { makeSupabaseMock, q } from '../test/supabase.mock'

const mockJwt = { sign: jest.fn().mockReturnValue('signed-token') }
const mockConfig = { get: jest.fn().mockReturnValue('http://localhost:3000') }

const userRow = { id: 'user-id-1', email: 'test@example.com', full_name: 'Test User', role: 'user' }

function makeService(fromMap: Record<string, any> = {}) {
  const supabase = makeSupabaseMock(fromMap)
  return { svc: new AuthService(supabase as any, mockJwt as any, mockConfig as any), supabase }
}

describe('AuthService', () => {
  describe('signUp()', () => {
    it('creates a user and returns a confirmation message', async () => {
      const { svc } = makeService({
        users: q({ data: userRow, error: null }),
      })
      const result = await svc.signUp({
        email: 'test@example.com',
        password: 'password',
        fullName: 'Test User',
      })
      expect(result).toEqual({ message: 'Check your email to confirm your account' })
    })

    it('throws BadRequestException when Supabase Auth fails', async () => {
      const { svc, supabase } = makeService()
      supabase._client.auth.signUp.mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'Email already exists' },
      })
      await expect(svc.signUp({ email: 'x@x.com', password: 'pw', fullName: 'X' })).rejects.toThrow(
        BadRequestException,
      )
    })

    it('throws BadRequestException when DB insert fails', async () => {
      const { svc } = makeService({
        users: q({ data: null, error: { message: 'duplicate key' } }),
      })
      await expect(svc.signUp({ email: 'x@x.com', password: 'pw', fullName: 'X' })).rejects.toThrow(
        BadRequestException,
      )
    })
  })

  describe('signIn()', () => {
    it('returns user and token on valid credentials', async () => {
      const { svc } = makeService({
        users: q({ data: userRow, error: null }),
      })
      const result = await svc.signIn({ email: 'test@example.com', password: 'password' })
      expect(result.token).toBe('signed-token')
      expect(result.user).toEqual(userRow)
    })

    it('throws UnauthorizedException when Supabase Auth fails', async () => {
      const { svc, supabase } = makeService()
      supabase._client.auth.signInWithPassword.mockResolvedValueOnce({
        data: null,
        error: { message: 'Invalid credentials' },
      })
      await expect(svc.signIn({ email: 'bad@example.com', password: 'wrong' })).rejects.toThrow(
        UnauthorizedException,
      )
    })

    it('throws UnauthorizedException with helpful message when email not confirmed', async () => {
      const { svc, supabase } = makeService()
      supabase._client.auth.signInWithPassword.mockResolvedValueOnce({
        data: null,
        error: { message: 'Email not confirmed' },
      })
      await expect(svc.signIn({ email: 'unverified@example.com', password: 'pw' })).rejects.toThrow(
        'Please verify your email before signing in',
      )
    })

    it('throws UnauthorizedException when user row not found', async () => {
      const { svc } = makeService({
        users: q({ data: null, error: { message: 'not found' } }),
      })
      await expect(svc.signIn({ email: 'test@example.com', password: 'pw' })).rejects.toThrow(
        UnauthorizedException,
      )
    })
  })

  describe('exchangeToken()', () => {
    it('returns user and token for a valid Supabase access token', async () => {
      const { svc } = makeService({
        users: q({ data: userRow, error: null }),
      })
      const result = await svc.exchangeToken('valid-supabase-token')
      expect(result.token).toBe('signed-token')
      expect(result.user).toEqual(userRow)
    })

    it('throws UnauthorizedException when Supabase token is invalid', async () => {
      const { svc, supabase } = makeService()
      supabase._client.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'Invalid token' },
      })
      await expect(svc.exchangeToken('bad-token')).rejects.toThrow(UnauthorizedException)
    })

    it('throws UnauthorizedException when user row not found', async () => {
      const { svc } = makeService({
        users: q({ data: null, error: { message: 'not found' } }),
      })
      await expect(svc.exchangeToken('valid-token')).rejects.toThrow(UnauthorizedException)
    })
  })
})
