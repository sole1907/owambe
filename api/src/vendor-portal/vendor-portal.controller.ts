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
}
