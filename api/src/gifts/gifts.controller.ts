import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { GiftsService } from './gifts.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import {
  ClaimItemDto,
  CreateGiftItemDto,
  InitGiftPaymentDto,
  ReportDirectTransferDto,
  UpdateGiftItemDto,
  UpdateGiftSettingsDto,
} from './dto/gift-item.dto'

// Public routes (guests)
@Controller()
export class GiftsPublicController {
  constructor(private gifts: GiftsService) {}

  @Get('events/:eventId/gift-list')
  getGiftList(@Param('eventId') eventId: string) {
    return this.gifts.getGiftListPublic(eventId)
  }

  @Post('gift-list/items/:id/claim')
  claimItem(@Param('id') id: string, @Body() dto: ClaimItemDto) {
    return this.gifts.claimItem(id, dto)
  }

  @Post('events/:eventId/gift-list/pay')
  initGiftPayment(@Param('eventId') eventId: string, @Body() dto: InitGiftPaymentDto) {
    return this.gifts.initializeGiftPayment(eventId, dto)
  }

  @Get('gift-list/verify/:reference')
  verifyGiftPayment(@Param('reference') reference: string) {
    return this.gifts.verifyGiftPayment(reference)
  }

  @Post('events/:eventId/gift-list/direct-transfer')
  reportDirectTransfer(@Param('eventId') eventId: string, @Body() dto: ReportDirectTransferDto) {
    return this.gifts.reportDirectTransfer(eventId, dto)
  }
}

// Protected routes (organiser only)
@Controller()
@UseGuards(JwtAuthGuard)
export class GiftsController {
  constructor(private gifts: GiftsService) {}

  @Get('events/:eventId/gift-list/dashboard')
  getGiftDashboard(@Param('eventId') eventId: string, @CurrentUser() user: any) {
    return this.gifts.getGiftDashboard(eventId, user.id)
  }

  @Patch('events/:eventId/gift-list/settings')
  updateSettings(
    @Param('eventId') eventId: string,
    @Body() dto: UpdateGiftSettingsDto,
    @CurrentUser() user: any,
  ) {
    return this.gifts.updateGiftSettings(eventId, user.id, dto)
  }

  @Post('gift-list/direct-transfers/:id/confirm')
  confirmDirectTransfer(@Param('id') id: string, @CurrentUser() user: any) {
    return this.gifts.confirmDirectTransfer(id, user.id)
  }

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
}
