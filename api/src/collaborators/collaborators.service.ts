import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common'
import { randomBytes } from 'crypto'
import { ConfigService } from '@nestjs/config'
import { SupabaseService } from '../supabase/supabase.service'
import { EmailService } from '../email/email.service'

@Injectable()
export class CollaboratorsService {
  constructor(
    private supabase: SupabaseService,
    private config: ConfigService,
    private email: EmailService,
  ) {}

  // ── Organiser: invite a coordinator ──────────────────────────────────────────

  async inviteCollaborator(
    eventId: string,
    ownerId: string,
    dto: { email: string; message?: string },
  ) {
    const client = this.supabase.getAdminClient()

    // Verify caller owns the event
    const { data: event, error: evErr } = await client
      .from('events')
      .select('id, title, event_date, event_date_approximate, user_id, users!user_id (full_name)')
      .eq('id', eventId)
      .eq('user_id', ownerId)
      .single()
    if (evErr || !event) throw new NotFoundException('Event not found')

    const inviteeEmail = dto.email.toLowerCase().trim()

    // Prevent duplicate active/pending invites
    const { data: existing } = await client
      .from('event_collaborators')
      .select('id, status')
      .eq('event_id', eventId)
      .eq('invited_email', inviteeEmail)
      .in('status', ['pending', 'active'])
      .maybeSingle()

    if (existing) {
      throw new ConflictException(
        existing.status === 'active'
          ? 'This person is already a collaborator on this event'
          : 'An invitation is already pending for this email',
      )
    }

    const token = randomBytes(32).toString('hex')

    const { data: collab, error: insertErr } = await client
      .from('event_collaborators')
      .insert({
        event_id: eventId,
        invited_email: inviteeEmail,
        invited_by: ownerId,
        invite_token: token,
        message: dto.message?.trim() || null,
      })
      .select()
      .single()

    if (insertErr) throw new InternalServerErrorException(insertErr.message)

    const organizerName = (event as any).users?.full_name || 'Your host'
    const appUrl = this.config.get<string>('appUrl') ?? 'http://localhost:3000'
    const acceptUrl = `${appUrl}/coordinator/accept?token=${token}`

    const eventDate = (event as any).event_date
      ? new Date((event as any).event_date).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : (event as any).event_date_approximate || null

    await this.email.sendCollaboratorInvite({
      to: inviteeEmail,
      inviteeEmail,
      organizerName,
      eventTitle: (event as any).title,
      eventDate,
      message: dto.message,
      acceptUrl,
    })

    return collab
  }

  // ── Organiser: list collaborators ─────────────────────────────────────────────

  async listCollaborators(eventId: string, ownerId: string) {
    const client = this.supabase.getAdminClient()

    const { data: event } = await client
      .from('events')
      .select('id')
      .eq('id', eventId)
      .eq('user_id', ownerId)
      .single()
    if (!event) throw new NotFoundException('Event not found')

    const { data, error } = await client
      .from('event_collaborators')
      .select(
        'id, invited_email, role, status, accepted_at, message, created_at, users (full_name, email)',
      )
      .eq('event_id', eventId)
      .neq('status', 'revoked')
      .order('created_at', { ascending: false })

    if (error) throw new InternalServerErrorException(error.message)
    return data ?? []
  }

  // ── Organiser: revoke access ───────────────────────────────────────────────────

  async revokeCollaborator(collaboratorId: string, ownerId: string) {
    const client = this.supabase.getAdminClient()

    const { data: collab, error } = await client
      .from('event_collaborators')
      .select('id, event_id, events ( user_id )')
      .eq('id', collaboratorId)
      .single()

    if (error || !collab) throw new NotFoundException('Collaborator not found')
    if ((collab.events as any)?.user_id !== ownerId) throw new ForbiddenException()

    await client
      .from('event_collaborators')
      .update({ status: 'revoked', updated_at: new Date().toISOString() })
      .eq('id', collaboratorId)

    return { success: true }
  }

  // ── Public: accept invite by token ────────────────────────────────────────────

  async acceptInvite(token: string, userId: string) {
    const client = this.supabase.getAdminClient()

    const { data: collab, error } = await client
      .from('event_collaborators')
      .select('id, event_id, status, invited_email')
      .eq('invite_token', token)
      .single()

    if (error || !collab) throw new NotFoundException('Invite not found or already used')
    if (collab.status === 'revoked')
      throw new ForbiddenException('This invitation has been revoked')
    if (collab.status === 'active') return { eventId: collab.event_id, alreadyAccepted: true }

    await client
      .from('event_collaborators')
      .update({
        status: 'active',
        user_id: userId,
        accepted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', collab.id)

    return { eventId: collab.event_id, alreadyAccepted: false }
  }

  // ── Shared: check if user has coordinator access on an event ─────────────────

  async getCollaboratorRole(
    eventId: string,
    userId: string,
  ): Promise<'owner' | 'coordinator' | null> {
    const client = this.supabase.getAdminClient()

    const { data: event } = await client.from('events').select('user_id').eq('id', eventId).single()

    if (!event) return null
    if ((event as any).user_id === userId) return 'owner'

    const { data: collab } = await client
      .from('event_collaborators')
      .select('id')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle()

    return collab ? 'coordinator' : null
  }
}
