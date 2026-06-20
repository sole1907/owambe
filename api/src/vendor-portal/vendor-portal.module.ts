import { Module } from '@nestjs/common'
import { VendorPortalController } from './vendor-portal.controller'
import { VendorPortalService } from './vendor-portal.service'
import { SupabaseModule } from '../supabase/supabase.module'

@Module({
  imports: [SupabaseModule],
  controllers: [VendorPortalController],
  providers: [VendorPortalService],
})
export class VendorPortalModule {}
