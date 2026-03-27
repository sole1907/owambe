import { Injectable, InternalServerErrorException } from '@nestjs/common'
import { SupabaseService } from '../supabase/supabase.service'

@Injectable()
export class AnalyticsService {
  constructor(private supabase: SupabaseService) {}

  async getDashboardStats() {
    const client = this.supabase.getClient()

    const [
      eventsResult,
      eventsByTypeResult,
      plansResult,
      guestsResult,
      invitesSentResult,
      checkInsResult,
      plusOneResult,
      vendorsResult,
    ] = await Promise.all([
      // Total events created
      client.from('events').select('id', { count: 'exact', head: true }),

      // Events broken down by type
      client.from('events').select('event_type'),

      // Events with a generated plan (= questionnaire completions)
      client.from('event_plans').select('id', { count: 'exact', head: true }),

      // Total guests added
      client.from('guest_invites').select('id', { count: 'exact', head: true }),

      // Invites actually sent (email dispatched)
      client
        .from('guest_invites')
        .select('id', { count: 'exact', head: true })
        .not('invite_sent_at', 'is', null),

      // Total check-ins recorded
      client
        .from('guest_invites')
        .select('checked_in_count')
        .gt('checked_in_count', 0),

      // Plus-one requests by status
      client.from('plus_one_requests').select('status'),

      // Vendors: total active, total featured
      client.from('vendors').select('is_active, is_featured'),
    ])

    if (eventsResult.error) throw new InternalServerErrorException(eventsResult.error.message)

    // Events by type
    const eventTypeCounts: Record<string, number> = {}
    for (const row of eventsByTypeResult.data ?? []) {
      eventTypeCounts[row.event_type] = (eventTypeCounts[row.event_type] ?? 0) + 1
    }

    // Total check-ins (sum of checked_in_count across all guests)
    const totalCheckIns = (checkInsResult.data ?? []).reduce(
      (sum: number, row: { checked_in_count: number }) => sum + (row.checked_in_count ?? 0),
      0,
    )

    // Plus-one requests
    const plusOneCounts = { pending: 0, approved: 0, rejected: 0 }
    for (const row of plusOneResult.data ?? []) {
      const s = row.status as keyof typeof plusOneCounts
      if (s in plusOneCounts) plusOneCounts[s]++
    }

    // Vendor stats
    const vendors = vendorsResult.data ?? []
    const activeVendors = vendors.filter((v: { is_active: boolean }) => v.is_active).length
    const featuredVendors = vendors.filter((v: { is_featured: boolean }) => v.is_featured).length

    return {
      events: {
        total: eventsResult.count ?? 0,
        withPlan: plansResult.count ?? 0,
        byType: eventTypeCounts,
      },
      guests: {
        total: guestsResult.count ?? 0,
        invitesSent: invitesSentResult.count ?? 0,
        totalCheckIns,
      },
      plusOneRequests: plusOneCounts,
      vendors: {
        active: activeVendors,
        featured: featuredVendors,
        total: vendors.length,
      },
    }
  }
}
