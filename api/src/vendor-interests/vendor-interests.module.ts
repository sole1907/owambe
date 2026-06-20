import { Module } from '@nestjs/common'
import { SupabaseModule } from '../supabase/supabase.module'
import { EmailModule } from '../email/email.module'
import { VendorInterestsController } from './vendor-interests.controller'
import { VendorInterestsService } from './vendor-interests.service'

@Module({
  imports: [SupabaseModule, EmailModule],
  controllers: [VendorInterestsController],
  providers: [VendorInterestsService],
  exports: [VendorInterestsService],
})
export class VendorInterestsModule {}
