import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common'
import { CollaboratorsService } from './collaborators.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'

// Public: accept invite
@Controller()
export class CollaboratorsPublicController {
  constructor(private collaborators: CollaboratorsService) {}

  @Post('collaborators/accept')
  @UseGuards(JwtAuthGuard)
  acceptInvite(@Body() body: { token: string }, @CurrentUser() user: any) {
    return this.collaborators.acceptInvite(body.token, user.id)
  }
}

// Protected: organiser manages collaborators
@Controller('events/:eventId/collaborators')
@UseGuards(JwtAuthGuard)
export class CollaboratorsController {
  constructor(private collaborators: CollaboratorsService) {}

  @Post()
  invite(
    @Param('eventId') eventId: string,
    @Body() body: { email: string; message?: string },
    @CurrentUser() user: any,
  ) {
    return this.collaborators.inviteCollaborator(eventId, user.id, body)
  }

  @Get()
  list(@Param('eventId') eventId: string, @CurrentUser() user: any) {
    return this.collaborators.listCollaborators(eventId, user.id)
  }

  @Delete(':id')
  revoke(@Param('id') id: string, @CurrentUser() user: any) {
    return this.collaborators.revokeCollaborator(id, user.id)
  }
}
