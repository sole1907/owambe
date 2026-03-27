import { Module } from '@nestjs/common'
import { AnalyticsController } from './analytics.controller'
import { AnalyticsService } from './analytics.service'
import { PostHogService } from './posthog.service'

@Module({
  controllers: [AnalyticsController],
  providers: [AnalyticsService, PostHogService],
  exports: [PostHogService],
})
export class AnalyticsModule {}
