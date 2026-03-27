import { Module } from '@nestjs/common'
import { VendorsController, AdminVendorsController } from './vendors.controller'
import { VendorsService } from './vendors.service'
import { AnalyticsModule } from '../analytics/analytics.module'

@Module({
  imports: [AnalyticsModule],
  controllers: [VendorsController, AdminVendorsController],
  providers: [VendorsService],
  exports: [VendorsService],
})
export class VendorsModule {}
