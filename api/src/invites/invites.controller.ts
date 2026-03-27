import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { InvitesService } from './invites.service'
import { RequestPlusOneDto } from './dto/request-plus-one.dto'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'

// Public routes (no auth)
@Controller('invites')
export class InvitesController {
  constructor(private invites: InvitesService) {}

  @Get(':token')
  getInvite(@Param('token') token: string) {
    return this.invites.getInviteByToken(token)
  }

  @Post(':token/request-plus-one')
  requestPlusOne(@Param('token') token: string, @Body() dto: RequestPlusOneDto) {
    return this.invites.requestPlusOne(token, dto)
  }

  @Post('check-in')
  checkIn(@Body() body: { token: string }) {
    return this.invites.checkIn(body.token)
  }

  @Get('events/:eventId/search-guests')
  searchGuests(@Param('eventId') eventId: string, @Query('q') q: string) {
    return this.invites.searchGuestsByName(eventId, q ?? '')
  }
}

// Protected routes (host only)
@Controller()
@UseGuards(JwtAuthGuard)
export class InvitesProtectedController {
  constructor(private invites: InvitesService) {}

  @Get('events/:eventId/plus-one-requests')
  getPendingRequests(@Param('eventId') eventId: string, @CurrentUser() user: any) {
    return this.invites.getPendingRequests(eventId, user.id)
  }

  @Patch('plus-one-requests/:id')
  reviewRequest(
    @Param('id') id: string,
    @Body() body: { approved: boolean },
    @CurrentUser() user: any,
  ) {
    return this.invites.reviewPlusOneRequest(id, body.approved, user.id)
  }
}
