/**
 * Shared Supabase mock utilities for unit tests.
 *
 * q(result) — creates a chainable query builder that resolves to `result`.
 * All builder methods (.select, .eq, .order, …) return `this` for chaining.
 * Terminal methods (.single, .maybeSingle) resolve to `result`.
 * The builder is also awaitable directly (for queries without .single()).
 */

export type QueryResult<T = any> = {
  data?: T | null
  error?: { message: string } | null
  count?: number | null
}

export function q<T = any>(result: QueryResult<T> = { data: null, error: null }) {
  const self: any = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    gt: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    // Terminal — resolves to result
    single: jest.fn().mockResolvedValue(result),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    // Make the builder itself awaitable (queries without .single())
    then: (onFulfilled: any, onRejected?: any) =>
      Promise.resolve(result).then(onFulfilled, onRejected),
    catch: (onRejected: any) => Promise.resolve(result).catch(onRejected),
    finally: (onFinally: any) => Promise.resolve(result).finally(onFinally),
  }
  return self
}

/**
 * Creates a mock SupabaseService whose .getClient() returns a mock client.
 * `fromMap` maps table names to pre-built q() responses.
 * Tables not in the map return q() (null data, no error).
 */
export function makeSupabaseMock(fromMap: Record<string, ReturnType<typeof q>> = {}) {
  const mockFrom = jest.fn((table: string) => fromMap[table] ?? q())

  const mockStorageBucket = {
    upload: jest.fn().mockResolvedValue({ data: {}, error: null }),
    getPublicUrl: jest
      .fn()
      .mockReturnValue({ data: { publicUrl: 'https://storage.example.com/qr.png' } }),
  }

  const client = {
    from: mockFrom,
    auth: {
      admin: {
        createUser: jest
          .fn()
          .mockResolvedValue({ data: { user: { id: 'user-id-1' } }, error: null }),
      },
      signUp: jest.fn().mockResolvedValue({
        data: { user: { id: 'user-id-1' } },
        error: null,
      }),
      signInWithPassword: jest.fn().mockResolvedValue({
        data: { user: { id: 'user-id-1' } },
        error: null,
      }),
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'user-id-1' } },
        error: null,
      }),
    },
    storage: {
      from: jest.fn().mockReturnValue(mockStorageBucket),
      _bucket: mockStorageBucket,
    },
  }

  return {
    getClient: jest.fn().mockReturnValue(client),
    _mockFrom: mockFrom,
    _client: client,
  }
}
