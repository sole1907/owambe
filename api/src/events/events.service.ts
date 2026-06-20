import { Injectable, InternalServerErrorException, BadRequestException, NotFoundException } from '@nestjs/common'

// Maps AI-generated budget category labels → vendor category slugs
export const BUDGET_CATEGORY_TO_VENDOR_SLUG: Record<string, string | null> = {
  'Venue': 'venues',
  'Catering': 'caterers',
  'Decoration': 'decorators',
  'Photography': 'photographers',
  'Videography': 'videographers',
  'Photography / Videography': 'photographers',
  'DJ / Live Band': 'djs',
  'DJ / Entertainment': 'djs',
  'Entertainment': 'djs',
  'MC': 'mcs',
  'Makeup Artist': 'makeup-artists',
  'Event Coordinator': 'event-coordinators',
  'AV / Technical Equipment': null,
  'Branding & Materials': null,
  'Miscellaneous': null,
}
import { SupabaseService } from '../supabase/supabase.service'
import { PlanGeneratorService } from './plan-generator/plan-generator.service'
import { GeneratePlanDto } from './dto/generate-plan.dto'
import { PostHogService } from '../analytics/posthog.service'

@Injectable()
export class EventsService {
  constructor(
    private supabase: SupabaseService,
    private planGenerator: PlanGeneratorService,
    private posthog: PostHogService,
  ) {}

  async generatePlan(dto: GeneratePlanDto, userId: string) {
    const client = this.supabase.getClient()

    // 1. Create the event record
    const { data: event, error: eventError } = await client
      .from('events')
      .insert({
        user_id: userId,
        title: dto.eventTitle,
        event_type: dto.eventType,
        event_date: dto.eventDate || null,
        event_date_approximate: dto.eventDateApproximate || null,
        location: dto.location || null,
        city: dto.city || null,
        guest_count_estimate: dto.guestCount || null,
        budget_estimate: dto.budgetEstimate || null,
        style_theme: dto.styleTheme || null,
        has_existing_vendors: dto.hasExistingVendors ?? false,
      })
      .select()
      .single()

    if (eventError) throw new InternalServerErrorException(eventError.message)

    // 2. Generate the plan
    const { checklist, plan } = this.planGenerator.generate(dto)

    // 3. Save the event plan
    const { error: planError } = await client.from('event_plans').insert({
      event_id: event.id,
      budget_breakdown: plan.budgetBreakdown,
      milestones: plan.milestones,
    })

    if (planError) throw new InternalServerErrorException(planError.message)

    // 4. Save checklist items
    if (checklist.length > 0) {
      const { error: checklistError } = await client.from('checklist_items').insert(
        checklist.map((item) => ({
          event_id: event.id,
          title: item.title,
          due_date: item.dueDate,
          sort_order: item.sortOrder,
        })),
      )
      if (checklistError) throw new InternalServerErrorException(checklistError.message)
    }

    // 5. Create the guest list record for this event
    await client.from('guest_lists').insert({ event_id: event.id })

    // 6. Create the gift list record for this event
    await client.from('gift_lists').insert({ event_id: event.id })

    this.posthog.capture(userId, 'plan_generated', {
      event_id: event.id,
      event_type: dto.eventType,
      guest_count: dto.guestCount,
      budget_estimate: dto.budgetEstimate,
    })

    return { id: event.id }
  }

  async getEvent(eventId: string, userId: string) {
    const client = this.supabase.getClient()

    const { data: event, error } = await client
      .from('events')
      .select(
        `
        *,
        event_plans (*),
        checklist_items (*)
      `,
      )
      .eq('id', eventId)
      .eq('user_id', userId)
      .single()

    if (error) throw new InternalServerErrorException(error.message)
    return event
  }

  async getUserEvents(userId: string) {
    const client = this.supabase.getClient()

    const { data, error } = await client
      .from('events')
      .select('id, title, event_type, event_date, event_date_approximate, city, status, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw new InternalServerErrorException(error.message)
    return data
  }

  async updateChecklistItem(
    itemId: string,
    updates: { isCompleted?: boolean; title?: string },
    _userId: string,
  ) {
    const client = this.supabase.getClient()

    const { error } = await client
      .from('checklist_items')
      .update({
        ...(updates.isCompleted !== undefined && { is_completed: updates.isCompleted }),
        ...(updates.title !== undefined && { title: updates.title }),
      })
      .eq('id', itemId)

    if (error) throw new InternalServerErrorException(error.message)
    return { success: true }
  }

  async addChecklistItem(eventId: string, title: string, _userId: string) {
    const client = this.supabase.getClient()

    // Get current max sort_order
    const { data: items } = await client
      .from('checklist_items')
      .select('sort_order')
      .eq('event_id', eventId)
      .order('sort_order', { ascending: false })
      .limit(1)

    const nextOrder = items && items.length > 0 ? items[0].sort_order + 1 : 0

    const { data, error } = await client
      .from('checklist_items')
      .insert({ event_id: eventId, title, sort_order: nextOrder })
      .select()
      .single()

    if (error) throw new InternalServerErrorException(error.message)
    return data
  }

  async deleteChecklistItem(itemId: string, _userId: string) {
    const client = this.supabase.getClient()

    const { error } = await client.from('checklist_items').delete().eq('id', itemId)

    if (error) throw new InternalServerErrorException(error.message)
    return { success: true }
  }

  async updateEvent(
    eventId: string,
    updates: {
      title?: string
      eventDate?: string
      eventDateApproximate?: string
      city?: string
      guestCount?: number | null
      budgetEstimate?: number | null
      styleTheme?: string
    },
    userId: string,
  ) {
    const client = this.supabase.getClient()

    const { error } = await client
      .from('events')
      .update({
        ...(updates.title !== undefined && { title: updates.title }),
        ...(updates.eventDate !== undefined && { event_date: updates.eventDate || null }),
        ...(updates.eventDateApproximate !== undefined && { event_date_approximate: updates.eventDateApproximate || null }),
        ...(updates.city !== undefined && { city: updates.city || null }),
        ...(updates.guestCount !== undefined && { guest_count_estimate: updates.guestCount }),
        ...(updates.budgetEstimate !== undefined && { budget_estimate: updates.budgetEstimate }),
        ...(updates.styleTheme !== undefined && { style_theme: updates.styleTheme || null }),
      })
      .eq('id', eventId)
      .eq('user_id', userId)

    if (error) throw new InternalServerErrorException(error.message)

    // Recalculate checklist due dates when the date changes
    const dateChanged = updates.eventDate !== undefined || updates.eventDateApproximate !== undefined
    if (dateChanged) {
      const eventDate = updates.eventDate
        ? new Date(updates.eventDate)
        : this.planGenerator.parseApproximateDate(updates.eventDateApproximate ?? '')

      const { data: planData } = await client
        .from('event_plans')
        .select('milestones')
        .eq('event_id', eventId)
        .single()

      if (planData?.milestones && Array.isArray(planData.milestones)) {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const todayStr = today.toISOString().split('T')[0]

        for (const milestone of planData.milestones as { title: string; weeksBeforeEvent: number }[]) {
          let dueDate: string | null = null
          if (eventDate) {
            const due = new Date(eventDate)
            due.setDate(due.getDate() - milestone.weeksBeforeEvent * 7)
            dueDate = due < today ? todayStr : due.toISOString().split('T')[0]
          }
          await client
            .from('checklist_items')
            .update({ due_date: dueDate })
            .eq('event_id', eventId)
            .eq('title', milestone.title)
        }
      }
    }

    return { success: true }
  }

  async deleteEvent(eventId: string, userId: string) {
    const client = this.supabase.getClient()

    const { data: committed } = await client
      .from('vendor_interests')
      .select('id')
      .eq('event_id', eventId)
      .eq('status', 'committed')
      .limit(1)

    if (committed && committed.length > 0) {
      throw new BadRequestException('Cannot delete an event that has confirmed vendor bookings. Cancel those bookings first.')
    }

    const { error } = await client
      .from('events')
      .delete()
      .eq('id', eventId)
      .eq('user_id', userId)

    if (error) throw new InternalServerErrorException(error.message)

    return { success: true }
  }

  async updateBudgetBreakdown(eventId: string, budgetBreakdown: object[], _userId: string) {
    const client = this.supabase.getClient()

    const { error } = await client
      .from('event_plans')
      .update({ budget_breakdown: budgetBreakdown })
      .eq('event_id', eventId)

    if (error) throw new InternalServerErrorException(error.message)
    return { success: true }
  }

  async getBudgetSummary(eventId: string, userId: string) {
    const client = this.supabase.getClient()

    const [{ data: event }, { data: plan }] = await Promise.all([
      client.from('events').select('budget_estimate').eq('id', eventId).eq('user_id', userId).single(),
      client.from('event_plans').select('budget_breakdown').eq('event_id', eventId).single(),
    ])

    if (!event) throw new NotFoundException('Event not found')

    const totalBudget: number | null = event.budget_estimate ?? null
    const breakdown: { category: string; percentage: number; amount: number | null }[] =
      (plan?.budget_breakdown as any[]) ?? []

    const [{ data: interests }, { data: payments }] = await Promise.all([
      client
        .from('vendor_interests')
        .select('id, status, vendor_id, preference_rank, offered_price, agreed_price, vendors(name, price_min, vendor_categories(slug))')
        .eq('event_id', eventId)
        .in('status', ['pending', 'available', 'quoted', 'committed']),
      client
        .from('commitment_payments')
        .select('vendor_id, amount_kobo')
        .eq('event_id', eventId)
        .eq('status', 'success'),
    ])

    const committedFeeByVendor: Record<string, number> = {}
    for (const p of payments ?? []) {
      committedFeeByVendor[p.vendor_id] = (committedFeeByVendor[p.vendor_id] ?? 0) + p.amount_kobo / 100
    }

    // Pick best interest per vendor category (committed > available > pending, then rank 1 > 2 > 3)
    const STATUS_PRIORITY: Record<string, number> = { committed: 0, available: 1, quoted: 2, pending: 3 }
    const bestBySlug: Record<string, any> = {}
    for (const interest of interests ?? []) {
      const slug = (interest as any).vendors?.vendor_categories?.slug
      if (!slug) continue
      const existing = bestBySlug[slug]
      const curP = STATUS_PRIORITY[interest.status] ?? 3
      const exP = existing ? (STATUS_PRIORITY[existing.status] ?? 3) : 99
      if (!existing || curP < exP || (curP === exP && (interest as any).preference_rank < existing.preference_rank)) {
        bestBySlug[slug] = interest
      }
    }

    let totalCommittedFee = 0
    let totalProjectedCost = 0

    const enriched = breakdown.map((item) => {
      const slug = BUDGET_CATEGORY_TO_VENDOR_SLUG[item.category] ?? null
      const interest = slug ? bestBySlug[slug] : null
      const vendor = interest ? (interest as any).vendors : null
      const committedFee = interest ? (committedFeeByVendor[interest.vendor_id] ?? 0) : 0
      const projectedCost = interest
        ? ((interest as any).agreed_price ?? (interest as any).offered_price ?? vendor?.price_min ?? 0)
        : 0
      totalCommittedFee += committedFee
      totalProjectedCost += projectedCost
      return {
        category: item.category,
        percentage: item.percentage,
        recommended: item.amount,
        vendor_category_slug: slug,
        committed_fee: committedFee,
        projected_cost: projectedCost,
        vendor_name: vendor?.name ?? null,
        interest_status: interest?.status ?? null,
      }
    })

    return {
      total_budget: totalBudget,
      breakdown: enriched,
      total_committed_fee: totalCommittedFee,
      total_projected_cost: totalProjectedCost,
      remaining: totalBudget ? totalBudget - totalProjectedCost : null,
    }
  }
}
