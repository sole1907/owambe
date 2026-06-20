import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { SupabaseService } from '../supabase/supabase.service'
import { EmailService } from '../email/email.service'
import { SubmitReviewDto } from './dto/submit-review.dto'

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name)

  constructor(
    private supabase: SupabaseService,
    private email: EmailService,
  ) {}

  // ── Submit a review ──────────────────────────────────────────────────────────

  async submitReview(userId: string, interestId: string, dto: SubmitReviewDto) {
    if (dto.rating < 1 || dto.rating > 5) {
      throw new BadRequestException('Rating must be between 1 and 5')
    }

    const client = this.supabase.getAdminClient()

    // Verify the interest is committed and belongs to this user
    const { data: interest, error: interestError } = await client
      .from('vendor_interests')
      .select(`
        id, status, vendor_id, event_id,
        events (title, event_date),
        vendors (name)
      `)
      .eq('id', interestId)
      .eq('user_id', userId)
      .single()

    if (interestError || !interest) throw new NotFoundException('Vendor commitment not found')

    if (interest.status !== 'committed') {
      throw new BadRequestException('You can only review vendors you have committed to.')
    }

    // Check event date has passed
    const eventDate = (interest.events as any)?.event_date
    if (eventDate && new Date(eventDate) > new Date()) {
      throw new BadRequestException('You can only review a vendor after your event has taken place.')
    }

    // Check for existing review
    const { data: existing } = await client
      .from('vendor_reviews')
      .select('id')
      .eq('interest_id', interestId)
      .single()

    if (existing) throw new BadRequestException('You have already reviewed this vendor for this event.')

    // Insert review
    const { data: review, error: reviewError } = await client
      .from('vendor_reviews')
      .insert({
        vendor_id: interest.vendor_id,
        event_id: interest.event_id,
        user_id: userId,
        interest_id: interestId,
        rating: dto.rating,
        comment: dto.comment ?? null,
      })
      .select()
      .single()

    if (reviewError) throw new InternalServerErrorException(reviewError.message)

    // Recalculate vendor aggregate rating
    await this.recalculateVendorRating(interest.vendor_id, client)

    return review
  }

  // ── Get reviews for a vendor (public) ───────────────────────────────────────

  async getVendorReviews(vendorSlug: string) {
    const client = this.supabase.getAdminClient()

    const { data: vendor } = await client
      .from('vendors')
      .select('id')
      .eq('slug', vendorSlug)
      .single()

    if (!vendor) throw new NotFoundException('Vendor not found')

    const { data, error } = await client
      .from('vendor_reviews')
      .select(`
        id, rating, comment, created_at,
        users (full_name),
        events (title, event_date, event_type)
      `)
      .eq('vendor_id', vendor.id)
      .order('created_at', { ascending: false })

    if (error) throw new InternalServerErrorException(error.message)
    return data ?? []
  }

  // ── Get reviewable commitments for a user (committed + event has passed) ────

  async getReviewable(userId: string) {
    const client = this.supabase.getAdminClient()
    const today = new Date().toISOString().split('T')[0]

    const { data, error } = await client
      .from('vendor_interests')
      .select(`
        id, vendor_id, event_id, status,
        vendors (id, name, slug, vendor_categories (name)),
        events (id, title, event_date),
        vendor_reviews (id)
      `)
      .eq('user_id', userId)
      .eq('status', 'committed')
      .lt('events.event_date', today)

    if (error) throw new InternalServerErrorException(error.message)

    // Filter to only those with no review yet
    return (data ?? []).filter(
      (i: any) => !(i.vendor_reviews?.length > 0) && i.events?.event_date,
    )
  }

  // ── Recalculate vendor aggregate rating ──────────────────────────────────────

  private async recalculateVendorRating(
    vendorId: string,
    client: ReturnType<SupabaseService['getAdminClient']>,
  ) {
    const { data } = await client
      .from('vendor_reviews')
      .select('rating')
      .eq('vendor_id', vendorId)

    if (!data || data.length === 0) return

    const avg = data.reduce((sum, r) => sum + r.rating, 0) / data.length
    const rounded = Math.round(avg * 10) / 10 // 1 decimal place

    await client
      .from('vendors')
      .update({ rating: rounded, review_count: data.length, updated_at: new Date().toISOString() })
      .eq('id', vendorId)
  }

  // ── Daily cron: send review reminder emails ──────────────────────────────────

  @Cron(CronExpression.EVERY_DAY_AT_8AM) // 8 AM UTC = 9 AM Lagos
  async sendReviewReminders() {
    this.logger.log('Running review reminder cron...')
    const client = this.supabase.getAdminClient()

    // Load the reminder schedule from platform_settings
    const { data: settingsRows } = await client
      .from('platform_settings')
      .select('key, value')
      .eq('key', 'review_reminder_schedule')
      .single()

    const schedule: number[] = settingsRows?.value ?? [7, 4, 4, 4, 4]
    const cumulativeDays = schedule.reduce<number[]>((acc, days) => {
      acc.push((acc[acc.length - 1] ?? 0) + days)
      return acc
    }, [])

    // Find all committed interests where event has passed and no review yet
    const { data: commitments } = await client
      .from('vendor_interests')
      .select(`
        id, vendor_id, event_id, user_id,
        events (title, event_date, city),
        vendors (name, vendor_categories (name)),
        users (email, full_name),
        vendor_reviews (id),
        review_reminders (reminder_number, sent_at)
      `)
      .eq('status', 'committed')

    if (!commitments?.length) return

    const today = new Date()

    for (const commitment of commitments) {
      const c = commitment as any

      // Skip if already reviewed
      if (c.vendor_reviews?.length > 0) continue

      const eventDate = c.events?.event_date
      if (!eventDate) continue

      // Skip if event hasn't happened yet
      const daysSinceEvent = Math.floor(
        (today.getTime() - new Date(eventDate).getTime()) / (1000 * 60 * 60 * 24),
      )
      if (daysSinceEvent < 0) continue

      const remindersSent = (c.review_reminders ?? []).length
      if (remindersSent >= cumulativeDays.length) continue // all reminders already sent

      const daysThreshold = cumulativeDays[remindersSent]
      if (daysSinceEvent < daysThreshold) continue // not yet time

      // Send the reminder
      const organizerEmail = c.users?.email
      if (!organizerEmail) continue

      try {
        await this.email.sendReviewReminder({
          to: organizerEmail,
          organizerName: c.users?.full_name || 'there',
          vendorName: c.vendors?.name,
          eventTitle: c.events?.title,
          interestId: commitment.id,
          reminderNumber: remindersSent + 1,
          isLast: remindersSent + 1 === cumulativeDays.length,
        })

        // Record that this reminder was sent
        await client.from('review_reminders').insert({
          interest_id: commitment.id,
          reminder_number: remindersSent + 1,
        })

        this.logger.log(`Review reminder #${remindersSent + 1} sent for interest ${commitment.id}`)
      } catch (err) {
        this.logger.error(`Failed to send review reminder for ${commitment.id}`, err)
      }
    }
  }
}
