import { Module } from '@nestjs/common'
import { ScheduleModule } from '@nestjs/schedule'
import { SupabaseModule } from '../supabase/supabase.module'
import { EmailModule } from '../email/email.module'
import { PayoutsService } from './payouts.service'
import { PayoutsController } from './payouts.controller'

@Module({
  imports: [ScheduleModule.forRoot(), SupabaseModule, EmailModule],
  controllers: [PayoutsController],
  providers: [PayoutsService],
  exports: [PayoutsService],
})
export class PayoutsModule {}
