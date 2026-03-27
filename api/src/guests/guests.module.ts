import { Module } from '@nestjs/common'
import { GuestsController } from './guests.controller'
import { GuestsService } from './guests.service'
import { InvitesModule } from '../invites/invites.module'
import { AnalyticsModule } from '../analytics/analytics.module'

@Module({
  imports: [InvitesModule, AnalyticsModule],
  controllers: [GuestsController],
  providers: [GuestsService],
  exports: [GuestsService],
})
export class GuestsModule {}
