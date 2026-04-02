import { Module } from '@nestjs/common'
import { EventsController } from './events.controller'
import { EventsService } from './events.service'
import { PlanGeneratorService } from './plan-generator/plan-generator.service'
import { VendorsModule } from '../vendors/vendors.module'
import { AnalyticsModule } from '../analytics/analytics.module'

@Module({
  imports: [VendorsModule, AnalyticsModule],
  controllers: [EventsController],
  providers: [EventsService, PlanGeneratorService],
})
export class EventsModule {}
