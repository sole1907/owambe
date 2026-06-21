import { Module } from '@nestjs/common'
import { SupabaseModule } from '../supabase/supabase.module'
import { EmailModule } from '../email/email.module'
import { PayoutsModule } from '../payouts/payouts.module'
import { PaymentsController } from './payments.controller'
import { PaymentsService } from './payments.service'

@Module({
  imports: [SupabaseModule, EmailModule, PayoutsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
