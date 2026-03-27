import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { GiftsService } from './gifts.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { CreateGiftItemDto, UpdateGiftItemDto } from './dto/gift-item.dto'

// Public routes
@Controller()
export class GiftsPublicController {
  constructor(private gifts: GiftsService) {}

  @Get('events/:eventId/gift-list')
  getGiftList(@Param('eventId') eventId: string) {
    return this.gifts.getGiftList(eventId)
  }
}

// Protected routes (host only)
@Controller()
@UseGuards(JwtAuthGuard)
export class GiftsController {
  constructor(private gifts: GiftsService) {}

  @Post('events/:eventId/gift-list/items')
  addItem(
    @Param('eventId') eventId: string,
    @Body() dto: CreateGiftItemDto,
    @CurrentUser() user: any,
  ) {
    return this.gifts.addItem(eventId, user.id, dto)
  }

  @Patch('gift-list/items/:id')
  updateItem(@Param('id') id: string, @Body() dto: UpdateGiftItemDto, @CurrentUser() user: any) {
    return this.gifts.updateItem(id, user.id, dto)
  }

  @Delete('gift-list/items/:id')
  deleteItem(@Param('id') id: string, @CurrentUser() user: any) {
    return this.gifts.deleteItem(id, user.id)
  }

  @Post('events/:eventId/gift-list/cash-contribution')
  enableCashContribution(@Param('eventId') eventId: string, @CurrentUser() user: any) {
    return this.gifts.enableCashContribution(eventId, user.id)
  }

  @Delete('events/:eventId/gift-list/cash-contribution')
  disableCashContribution(@Param('eventId') eventId: string, @CurrentUser() user: any) {
    return this.gifts.disableCashContribution(eventId, user.id)
  }
}
