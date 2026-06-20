import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { VendorPortalService } from './vendor-portal.service'
import { UpdateVendorProfileDto } from './dto/update-vendor-profile.dto'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { CurrentUser } from '../auth/decorators/current-user.decorator'

@Controller('vendor-portal')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('vendor')
export class VendorPortalController {
  constructor(private portal: VendorPortalService) {}

  @Get('profile')
  getProfile(@CurrentUser() user: any) {
    return this.portal.getProfile(user.id)
  }

  @Patch('profile')
  updateProfile(@CurrentUser() user: any, @Body() dto: UpdateVendorProfileDto) {
    return this.portal.updateProfile(user.id, dto)
  }

  @Get('availability')
  getAvailability(
    @CurrentUser() user: any,
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    const now = new Date()
    return this.portal.getAvailability(
      user.id,
      year ? parseInt(year) : now.getFullYear(),
      month ? parseInt(month) : now.getMonth() + 1,
    )
  }

  @Post('availability/block')
  blockDate(@CurrentUser() user: any, @Body() body: { date: string }) {
    return this.portal.blockDate(user.id, body.date)
  }

  @Delete('availability/:date')
  unblockDate(@CurrentUser() user: any, @Param('date') date: string) {
    return this.portal.unblockDate(user.id, date)
  }

  @Get('settings')
  getSettings() {
    return this.portal.getSettings()
  }

  // ── Photo management ─────────────────────────────────────────────────────

  @Post('photos/upload-url')
  getPhotoUploadUrl(@CurrentUser() user: any, @Body() body: { filename: string }) {
    return this.portal.getPhotoUploadUrl(user.id, body.filename)
  }

  @Post('photos')
  addPhoto(@CurrentUser() user: any, @Body() body: { url: string }) {
    return this.portal.addPhoto(user.id, body.url)
  }

  @Delete('photos')
  deletePhoto(@CurrentUser() user: any, @Query('url') url: string) {
    return this.portal.deletePhoto(user.id, url)
  }

  // ── Caterer menu management ───────────────────────────────────────────────

  @Get('menu')
  getMenu(@CurrentUser() user: any) {
    return this.portal.getMenu(user.id)
  }

  @Post('menu/items')
  addMenuItem(@CurrentUser() user: any, @Body() body: any) {
    return this.portal.addMenuItem(user.id, body)
  }

  @Patch('menu/items/:id')
  updateMenuItem(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
    return this.portal.updateMenuItem(user.id, id, body)
  }

  @Delete('menu/items/:id')
  deleteMenuItem(@CurrentUser() user: any, @Param('id') id: string) {
    return this.portal.deleteMenuItem(user.id, id)
  }

  // ── Decorator styles & packages management ────────────────────────────────

  @Get('decorator')
  getDecoratorProfile(@CurrentUser() user: any) {
    return this.portal.getDecoratorProfile(user.id)
  }

  @Post('decorator/styles')
  addDecoratorStyle(@CurrentUser() user: any, @Body() body: any) {
    return this.portal.addDecoratorStyle(user.id, body)
  }

  @Delete('decorator/styles/:id')
  deleteDecoratorStyle(@CurrentUser() user: any, @Param('id') id: string) {
    return this.portal.deleteDecoratorStyle(user.id, id)
  }

  @Post('decorator/packages')
  addDecoratorPackage(@CurrentUser() user: any, @Body() body: any) {
    return this.portal.addDecoratorPackage(user.id, body)
  }

  @Patch('decorator/packages/:id')
  updateDecoratorPackage(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
    return this.portal.updateDecoratorPackage(user.id, id, body)
  }

  @Delete('decorator/packages/:id')
  deleteDecoratorPackage(@CurrentUser() user: any, @Param('id') id: string) {
    return this.portal.deleteDecoratorPackage(user.id, id)
  }

  // ── Payment structure management ──────────────────────────────────────────

  @Get('payment-structure')
  getPaymentStructure(@CurrentUser() user: any) {
    return this.portal.getPaymentStructure(user.id)
  }

  @Post('payment-structure')
  savePaymentStructure(@CurrentUser() user: any, @Body() body: any) {
    return this.portal.savePaymentStructure(user.id, body)
  }

  @Post('payment-structure/agree-terms')
  agreeToPaymentTerms(@CurrentUser() user: any) {
    return this.portal.agreeToPaymentTerms(user.id)
  }

  // ── Vendor cancellation ───────────────────────────────────────────────────

  @Post('inquiries/:id/cancel')
  cancelBooking(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    return this.portal.cancelBookingAsVendor(user.id, id, body.reason)
  }

  @Post('inquiries/:id/request-extension')
  requestExtension(@CurrentUser() user: any, @Param('id') id: string) {
    return this.portal.requestCancellationExtension(user.id, id)
  }
}
