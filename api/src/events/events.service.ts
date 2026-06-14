import { Injectable, InternalServerErrorException } from '@nestjs/common'
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

    const { data: completed } = await client
      .from('checklist_items')
      .select('id')
      .eq('event_id', eventId)
      .eq('is_completed', true)
      .limit(1)

    const hasCompletedItems = completed && completed.length > 0

    const { error } = await client
      .from('events')
      .delete()
      .eq('id', eventId)
      .eq('user_id', userId)

    if (error) throw new InternalServerErrorException(error.message)

    return { success: true, hadProgress: hasCompletedItems }
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
}
