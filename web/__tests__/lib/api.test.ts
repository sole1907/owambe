import { api } from '@/lib/api'

const mockFetch = jest.fn()
global.fetch = mockFetch

function mockResponse(data: unknown, ok = true, status = 200) {
  mockFetch.mockResolvedValueOnce({
    ok,
    status,
    json: jest.fn().mockResolvedValueOnce(data),
  })
}

describe('api', () => {
  beforeEach(() => mockFetch.mockClear())

  describe('get()', () => {
    it('makes a GET request and returns data', async () => {
      mockResponse({ id: 1, name: 'Test' })
      const result = await api.get<{ id: number; name: string }>('/test')
      expect(result).toEqual({ id: 1, name: 'Test' })
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/test'),
        expect.objectContaining({ method: 'GET' }),
      )
    })

    it('sets Authorization header when token is provided', async () => {
      mockResponse({ ok: true })
      await api.get('/protected', 'my-jwt-token')
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer my-jwt-token' }),
        }),
      )
    })

    it('throws when response is not ok', async () => {
      mockResponse({ message: 'Not found' }, false, 404)
      await expect(api.get('/missing')).rejects.toThrow('Not found')
    })

    it('throws generic message when server returns no message', async () => {
      mockResponse({}, false, 500)
      await expect(api.get('/fail')).rejects.toThrow('Something went wrong')
    })
  })

  describe('post()', () => {
    it('makes a POST request with JSON body', async () => {
      mockResponse({ id: 'new-id' })
      const result = await api.post<{ id: string }>('/items', { name: 'Widget' })
      expect(result).toEqual({ id: 'new-id' })
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/items'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'Widget' }),
        }),
      )
    })

    it('includes token in POST request', async () => {
      mockResponse({ created: true })
      await api.post('/items', { name: 'X' }, 'token-123')
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer token-123' }),
        }),
      )
    })
  })

  describe('patch()', () => {
    it('makes a PATCH request with body', async () => {
      mockResponse({ updated: true })
      await api.patch('/items/1', { name: 'Updated' })
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/items/1'),
        expect.objectContaining({ method: 'PATCH' }),
      )
    })
  })

  describe('delete()', () => {
    it('makes a DELETE request', async () => {
      mockResponse({ success: true })
      const result = await api.delete<{ success: boolean }>('/items/1', 'tok')
      expect(result).toEqual({ success: true })
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/items/1'),
        expect.objectContaining({ method: 'DELETE' }),
      )
    })
  })
})
