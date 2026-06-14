import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { EventsService } from './events.service'
import { VendorsService } from '../vendors/vendors.service'
import { GeneratePlanDto } from './dto/generate-plan.dto'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'

@Controller('events')
@UseGuards(JwtAuthGuard)
export class EventsController {
  constructor(
    private events: EventsService,
    private vendors: VendorsService,
  ) {}

  @Post('generate-plan')
  generatePlan(@Body() dto: GeneratePlanDto, @CurrentUser() user: any) {
    return this.events.generatePlan(dto, user.id)
  }

  @Get()
  getUserEvents(@CurrentUser() user: any) {
    return this.events.getUserEvents(user.id)
  }

  @Get(':id')
  getEvent(@Param('id') id: string, @CurrentUser() user: any) {
    return this.events.getEvent(id, user.id)
  }

  @Patch(':id')
  updateEvent(
    @Param('id') id: string,
    @Body() body: {
      title?: string
      eventDate?: string
      eventDateApproximate?: string
      city?: string
      guestCount?: number | null
      budgetEstimate?: number | null
      styleTheme?: string
    },
    @CurrentUser() user: any,
  ) {
    return this.events.updateEvent(id, body, user.id)
  }

  @Delete(':id')
  @HttpCode(200)
  deleteEvent(@Param('id') id: string, @CurrentUser() user: any) {
    return this.events.deleteEvent(id, user.id)
  }

  @Post(':id/checklist')
  addChecklistItem(
    @Param('id') id: string,
    @Body() body: { title: string },
    @CurrentUser() user: any,
  ) {
    return this.events.addChecklistItem(id, body.title, user.id)
  }

  @Patch('checklist/:itemId')
  updateChecklistItem(
    @Param('itemId') itemId: string,
    @Body() body: { isCompleted?: boolean; title?: string },
    @CurrentUser() user: any,
  ) {
    return this.events.updateChecklistItem(itemId, body, user.id)
  }

  @Delete('checklist/:itemId')
  deleteChecklistItem(@Param('itemId') itemId: string, @CurrentUser() user: any) {
    return this.events.deleteChecklistItem(itemId, user.id)
  }

  @Get(':id/recommended-vendors')
  getRecommendedVendors(@Param('id') id: string, @CurrentUser() user: any) {
    return this.vendors.getRecommendedVendors(id, user.id)
  }

  @Patch(':id/budget')
  updateBudgetBreakdown(
    @Param('id') id: string,
    @Body() body: { budgetBreakdown: object[] },
    @CurrentUser() user: any,
  ) {
    return this.events.updateBudgetBreakdown(id, body.budgetBreakdown, user.id)
  }
}
