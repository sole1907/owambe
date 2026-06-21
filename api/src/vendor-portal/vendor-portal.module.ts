import { Module } from '@nestjs/common'
import { VendorPortalController } from './vendor-portal.controller'
import { VendorPortalService } from './vendor-portal.service'
import { SupabaseModule } from '../supabase/supabase.module'
import { PayoutsModule } from '../payouts/payouts.module'

@Module({
  imports: [SupabaseModule, PayoutsModule],
  controllers: [VendorPortalController],
  providers: [VendorPortalService],
})
export class VendorPortalModule {}
