import {
  Injectable,
  InternalServerErrorException,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common'
import { EmailService } from '../email/email.service'

// Maps AI-generated budget category labels → vendor category slugs
export const BUDGET_CATEGORY_TO_VENDOR_SLUG: Record<string, string | null> = {
  Venue: 'venues',
  Catering: 'caterers',
  Decoration: 'decorators',
  Photography: 'photographers',
  Videography: 'videographers',
  'Photography / Videography': 'photographers',
  'DJ / Live Band': 'djs',
  'DJ / Entertainment': 'djs',
  Entertainment: 'djs',
  MC: 'mcs',
  'Makeup Artist': 'makeup-artists',
  'Event Coordinator': 'event-coordinators',
  'AV / Technical Equipment': null,
  'Branding & Materials': null,
  Miscellaneous: null,
}
import { SupabaseService } from '../supabase/supabase.service'
import { PlanGeneratorService } from './plan-generator/plan-generator.service'
import { GeneratePlanDto } from './dto/generate-plan.dto'
import { PostHogService } from '../analytics/posthog.service'

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name)

  constructor(
    private supabase: SupabaseService,
    private planGenerator: PlanGeneratorService,
    private posthog: PostHogService,
    private email: EmailService,
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
    const client = this.supabase.getAdminClient()

    const { data: event, error } = await client
      .from('events')
      .select(`*, event_plans (*), checklist_items (*)`)
      .eq('id', eventId)
      .single()

    if (error || !event) throw new NotFoundException('Event not found')

    if (event.user_id === userId) {
      return { ...event, myRole: 'owner' }
    }

    // Check coordinator access
    const { data: collab } = await client
      .from('event_collaborators')
      .select('id')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle()

    if (!collab) throw new NotFoundException('Event not found')

    return { ...event, myRole: 'coordinator' }
  }

  async getUserEvents(userId: string) {
    const client = this.supabase.getAdminClient()

    const [ownedResult, collabResult] = await Promise.all([
      client
        .from('events')
        .select(
          'id, title, event_type, event_date, event_date_approximate, city, status, created_at',
        )
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      client
        .from('event_collaborators')
        .select(
          'event_id, events ( id, title, event_type, event_date, event_date_approximate, city, status, created_at )',
        )
        .eq('user_id', userId)
        .eq('status', 'active'),
    ])

    const owned = (ownedResult.data ?? []).map((e) => ({ ...e, myRole: 'owner' }))
    const coordinating = (collabResult.data ?? [])
      .map((c) => c.events as any)
      .filter(Boolean)
      .map((e: any) => ({ ...e, myRole: 'coordinator' }))

    // Dedupe by id (in case owner is also somehow a collab)
    const seen = new Set<string>()
    const all = [...owned, ...coordinating].filter((e) => {
      if (seen.has(e.id)) return false
      seen.add(e.id)
      return true
    })

    return all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
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
        ...(updates.eventDateApproximate !== undefined && {
          event_date_approximate: updates.eventDateApproximate || null,
        }),
        ...(updates.city !== undefined && { city: updates.city || null }),
        ...(updates.guestCount !== undefined && { guest_count_estimate: updates.guestCount }),
        ...(updates.budgetEstimate !== undefined && { budget_estimate: updates.budgetEstimate }),
        ...(updates.styleTheme !== undefined && { style_theme: updates.styleTheme || null }),
      })
      .eq('id', eventId)
      .eq('user_id', userId)

    if (error) throw new InternalServerErrorException(error.message)

    // Recalculate checklist due dates when the date changes
    const dateChanged =
      updates.eventDate !== undefined || updates.eventDateApproximate !== undefined
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

        for (const milestone of planData.milestones as {
          title: string
          weeksBeforeEvent: number
        }[]) {
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
      throw new BadRequestException(
        'Cannot delete an event that has confirmed vendor bookings. Cancel those bookings first.',
      )
    }

    const { error } = await client.from('events').delete().eq('id', eventId).eq('user_id', userId)

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
      client
        .from('events')
        .select('budget_estimate')
        .eq('id', eventId)
        .eq('user_id', userId)
        .single(),
      client.from('event_plans').select('budget_breakdown').eq('event_id', eventId).single(),
    ])

    if (!event) throw new NotFoundException('Event not found')

    const totalBudget: number | null = event.budget_estimate ?? null
    const breakdown: { category: string; percentage: number; amount: number | null }[] =
      (plan?.budget_breakdown as any[]) ?? []

    const [{ data: interests }, { data: payments }] = await Promise.all([
      client
        .from('vendor_interests')
        .select(
          'id, status, vendor_id, preference_rank, offered_price, agreed_price, vendors(name, price_min, vendor_categories(slug))',
        )
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
      committedFeeByVendor[p.vendor_id] =
        (committedFeeByVendor[p.vendor_id] ?? 0) + p.amount_kobo / 100
    }

    // Pick best interest per vendor category (committed > available > pending, then rank 1 > 2 > 3)
    const STATUS_PRIORITY: Record<string, number> = {
      committed: 0,
      available: 1,
      quoted: 2,
      pending: 3,
    }
    const bestBySlug: Record<string, any> = {}
    for (const interest of interests ?? []) {
      const slug = (interest as any).vendors?.vendor_categories?.slug
      if (!slug) continue
      const existing = bestBySlug[slug]
      const curP = STATUS_PRIORITY[interest.status] ?? 3
      const exP = existing ? (STATUS_PRIORITY[existing.status] ?? 3) : 99
      if (
        !existing ||
        curP < exP ||
        (curP === exP && (interest as any).preference_rank < existing.preference_rank)
      ) {
        bestBySlug[slug] = interest
      }
    }

    let totalCommittedFee = 0
    let totalProjectedCost = 0

    const enriched = breakdown.map((item) => {
      const slug = BUDGET_CATEGORY_TO_VENDOR_SLUG[item.category] ?? null
      const interest = slug ? bestBySlug[slug] : null
      const vendor = interest ? interest.vendors : null
      const committedFee = interest ? (committedFeeByVendor[interest.vendor_id] ?? 0) : 0
      const projectedCost = interest
        ? (interest.agreed_price ?? interest.offered_price ?? vendor?.price_min ?? 0)
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

  // ── Thank you messages ────────────────────────────────────────────────────────

  async previewThankYouRecipients(
    eventId: string,
    userId: string,
    target: 'attendees' | 'gifters' | 'all',
  ) {
    const client = this.supabase.getAdminClient()
    await this.requireEventOwner(client, eventId, userId)

    const { attendees, gifters } = await this.collectRecipients(client, eventId, target)
    const all = this.dedupeRecipients([...attendees, ...gifters])

    return {
      attendeeCount: attendees.length,
      gifterCount: gifters.length,
      totalCount: all.length,
    }
  }

  async sendThankYouMessages(
    eventId: string,
    userId: string,
    dto: { target: 'attendees' | 'gifters' | 'all'; message: string; subject: string },
  ) {
    if (!dto.message?.trim()) throw new BadRequestException('Message is required')
    if (!dto.subject?.trim()) throw new BadRequestException('Subject is required')

    const client = this.supabase.getAdminClient()
    const event = await this.requireEventOwner(client, eventId, userId)

    const { data: organiserUser } = await client
      .from('users')
      .select('full_name')
      .eq('id', userId)
      .single()
    const organizerName = (organiserUser as any)?.full_name || 'Your host'

    const { attendees, gifters } = await this.collectRecipients(client, eventId, dto.target)
    const recipients = this.dedupeRecipients([...attendees, ...gifters])

    let sent = 0
    let failed = 0

    for (const r of recipients) {
      try {
        await this.email.sendThankYou({
          to: r.email,
          recipientName: r.name,
          organizerName,
          eventTitle: event.title,
          customMessage: dto.message.trim(),
          subject: dto.subject.trim(),
        })
        sent++
      } catch (err) {
        this.logger.error(`Failed to send thank-you to ${r.email}`, err)
        failed++
      }
    }

    return { sent, failed, total: recipients.length }
  }

  private async requireEventOwner(
    client: ReturnType<SupabaseService['getAdminClient']>,
    eventId: string,
    userId: string,
  ) {
    const { data, error } = await client
      .from('events')
      .select('id, title, user_id')
      .eq('id', eventId)
      .eq('user_id', userId)
      .single()
    if (error || !data) throw new NotFoundException('Event not found')
    return data as { id: string; title: string; user_id: string }
  }

  private async collectRecipients(
    client: ReturnType<SupabaseService['getAdminClient']>,
    eventId: string,
    target: 'attendees' | 'gifters' | 'all',
  ): Promise<{
    attendees: { email: string; name: string }[]
    gifters: { email: string; name: string }[]
  }> {
    const attendees: { email: string; name: string }[] = []
    const gifters: { email: string; name: string }[] = []

    if (target === 'attendees' || target === 'all') {
      const { data: guestList } = await client
        .from('guest_lists')
        .select('id')
        .eq('event_id', eventId)
        .single()

      if (guestList) {
        const { data: invites } = await client
          .from('guest_invites')
          .select('full_name, email')
          .eq('guest_list_id', guestList.id)
          .neq('rsvp_status', 'declined')

        for (const inv of invites ?? []) {
          if (inv.email) attendees.push({ email: inv.email, name: inv.full_name })
        }
      }
    }

    if (target === 'gifters' || target === 'all') {
      const { data: giftList } = await client
        .from('gift_lists')
        .select('id')
        .eq('event_id', eventId)
        .single()

      if (giftList) {
        // Paystack online payments with email
        const { data: payments } = await client
          .from('event_gift_payments')
          .select('gifter_name, gifter_email')
          .eq('gift_list_id', giftList.id)
          .in('status', ['paid', 'transfer_initiated', 'transfer_complete'])
          .not('gifter_email', 'is', null)

        for (const p of payments ?? []) {
          if (p.gifter_email) gifters.push({ email: p.gifter_email, name: p.gifter_name })
        }
      }
    }

    return { attendees, gifters }
  }

  private dedupeRecipients(
    list: { email: string; name: string }[],
  ): { email: string; name: string }[] {
    const seen = new Set<string>()
    return list.filter((r) => {
      const key = r.email.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }
}
