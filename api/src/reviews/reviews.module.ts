import { Module } from '@nestjs/common'
import { ScheduleModule } from '@nestjs/schedule'
import { SupabaseModule } from '../supabase/supabase.module'
import { EmailModule } from '../email/email.module'
import { ReviewsController } from './reviews.controller'
import { ReviewsService } from './reviews.service'

@Module({
  imports: [ScheduleModule.forRoot(), SupabaseModule, EmailModule],
  controllers: [ReviewsController],
  providers: [ReviewsService],
})
export class ReviewsModule {}
