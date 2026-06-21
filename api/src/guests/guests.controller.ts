import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { GuestsService } from './guests.service'
import { CreateGuestDto } from './dto/create-guest.dto'
import { UpdateGuestDto } from './dto/update-guest.dto'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'

@Controller()
@UseGuards(JwtAuthGuard)
export class GuestsController {
  constructor(private guests: GuestsService) {}

  @Get('events/:eventId/guests')
  getGuests(@Param('eventId') eventId: string, @CurrentUser() user: any) {
    return this.guests.getGuests(eventId, user.id)
  }

  @Get('events/:eventId/guests/stats')
  getGuestStats(@Param('eventId') eventId: string, @CurrentUser() user: any) {
    return this.guests.getGuestStats(eventId, user.id)
  }

  @Post('events/:eventId/guests')
  addGuest(
    @Param('eventId') eventId: string,
    @Body() dto: CreateGuestDto,
    @CurrentUser() user: any,
  ) {
    return this.guests.addGuest(eventId, dto, user.id)
  }

  @Post('events/:eventId/guests/import')
  importGuests(
    @Param('eventId') eventId: string,
    @Body()
    body: { guests: { fullName: string; email: string; phone?: string; allocation?: number }[] },
    @CurrentUser() user: any,
  ) {
    return this.guests.importGuests(eventId, body.guests, user.id)
  }

  @Patch('guests/:id')
  updateGuest(@Param('id') id: string, @Body() dto: UpdateGuestDto, @CurrentUser() user: any) {
    return this.guests.updateGuest(id, dto, user.id)
  }

  @Delete('guests/:id')
  deleteGuest(@Param('id') id: string, @CurrentUser() user: any) {
    return this.guests.deleteGuest(id, user.id)
  }
}
