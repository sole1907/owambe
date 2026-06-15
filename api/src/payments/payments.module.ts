import { Module } from '@nestjs/common'
import { SupabaseModule } from '../supabase/supabase.module'
import { EmailModule } from '../email/email.module'
import { PaymentsController } from './payments.controller'
import { PaymentsService } from './payments.service'

@Module({
  imports: [SupabaseModule, EmailModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
