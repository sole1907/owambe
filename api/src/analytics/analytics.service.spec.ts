import { AnalyticsService } from './analytics.service'
import { makeSupabaseMock, q } from '../test/supabase.mock'

describe('AnalyticsService', () => {
  function makeService(fromMap: Record<string, any> = {}) {
    return new AnalyticsService(makeSupabaseMock(fromMap) as any)
  }

  it('returns zeroed stats when all queries return empty data', async () => {
    const supabase = makeSupabaseMock()
    // All from() calls return q() which has data: null, count: null
    // Override to return safe empty arrays/counts
    supabase._client.from = jest.fn().mockReturnValue(
      q({ data: [], error: null, count: 0 }),
    )
    const svc = new AnalyticsService(supabase as any)
    const stats = await svc.getDashboardStats()

    expect(stats.events.total).toBe(0)
    expect(stats.guests.total).toBe(0)
    expect(stats.vendors.total).toBe(0)
  })

  it('aggregates event counts and type breakdown', async () => {
    const eventsQuery = q({ data: null, error: null, count: 5 })
    const eventsByTypeQuery = q({
      data: [
        { event_type: 'wedding' },
        { event_type: 'wedding' },
        { event_type: 'birthday' },
      ],
      error: null,
    })
    const plansQuery = q({ data: null, error: null, count: 3 })
    const guestsQuery = q({ data: null, error: null, count: 12 })
    const invitesSentQuery = q({ data: null, error: null, count: 10 })
    const checkInsQuery = q({
      data: [{ checked_in_count: 3 }, { checked_in_count: 2 }],
      error: null,
    })
    const plusOneQuery = q({
      data: [
        { status: 'pending' },
        { status: 'approved' },
        { status: 'approved' },
        { status: 'rejected' },
      ],
      error: null,
    })
    const vendorsQuery = q({
      data: [
        { is_active: true, is_featured: true },
        { is_active: true, is_featured: false },
        { is_active: false, is_featured: false },
      ],
      error: null,
    })

    const supabase = makeSupabaseMock()
    supabase._client.from = jest
      .fn()
      .mockReturnValueOnce(eventsQuery)
      .mockReturnValueOnce(eventsByTypeQuery)
      .mockReturnValueOnce(plansQuery)
      .mockReturnValueOnce(guestsQuery)
      .mockReturnValueOnce(invitesSentQuery)
      .mockReturnValueOnce(checkInsQuery)
      .mockReturnValueOnce(plusOneQuery)
      .mockReturnValueOnce(vendorsQuery)

    const svc = new AnalyticsService(supabase as any)
    const stats = await svc.getDashboardStats()

    expect(stats.events.total).toBe(5)
    expect(stats.events.withPlan).toBe(3)
    expect(stats.events.byType.wedding).toBe(2)
    expect(stats.events.byType.birthday).toBe(1)
    expect(stats.guests.total).toBe(12)
    expect(stats.guests.invitesSent).toBe(10)
    expect(stats.guests.totalCheckIns).toBe(5)
    expect(stats.plusOneRequests.pending).toBe(1)
    expect(stats.plusOneRequests.approved).toBe(2)
    expect(stats.plusOneRequests.rejected).toBe(1)
    expect(stats.vendors.total).toBe(3)
    expect(stats.vendors.active).toBe(2)
    expect(stats.vendors.featured).toBe(1)
  })
})
