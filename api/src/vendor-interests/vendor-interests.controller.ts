import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { VendorInterestsService } from './vendor-interests.service'
import { CreateInterestDto } from './dto/create-interest.dto'
import { RespondInquiryDto } from './dto/respond-inquiry.dto'

@Controller()
@UseGuards(JwtAuthGuard)
export class VendorInterestsController {
  constructor(private service: VendorInterestsService) {}

  // ─── Event organiser endpoints ──────────────────────────────────────────────

  @Get('events/:eventId/vendor-interests')
  getInterests(@Param('eventId') eventId: string, @CurrentUser() user: any) {
    return this.service.getInterests(eventId, user.id)
  }

  @Post('events/:eventId/vendor-interests')
  addInterest(
    @Param('eventId') eventId: string,
    @Body() dto: CreateInterestDto,
    @CurrentUser() user: any,
  ) {
    return this.service.addInterest(eventId, user.id, dto)
  }

  @Delete('events/:eventId/vendor-interests/:interestId')
  removeInterest(
    @Param('eventId') eventId: string,
    @Param('interestId') interestId: string,
    @CurrentUser() user: any,
  ) {
    return this.service.removeInterest(eventId, interestId, user.id)
  }

  // ─── Vendor portal endpoints ────────────────────────────────────────────────

  @Get('vendor-portal/inquiries')
  @UseGuards(RolesGuard)
  @Roles('vendor')
  getInquiries(@CurrentUser() user: any) {
    return this.service.getInquiries(user.id)
  }

  @Patch('vendor-portal/inquiries/:id')
  @UseGuards(RolesGuard)
  @Roles('vendor')
  respondToInquiry(
    @Param('id') id: string,
    @Body() dto: RespondInquiryDto,
    @CurrentUser() user: any,
  ) {
    return this.service.respondToInquiry(user.id, id, dto)
  }
}
