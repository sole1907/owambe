import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import configuration from './config/configuration'
import { SupabaseModule } from './supabase/supabase.module'
import { AuthModule } from './auth/auth.module'
import { EventsModule } from './events/events.module'
import { VendorsModule } from './vendors/vendors.module'
import { GuestsModule } from './guests/guests.module'
import { InvitesModule } from './invites/invites.module'
import { EmailModule } from './email/email.module'
import { GiftsModule } from './gifts/gifts.module'
import { AnalyticsModule } from './analytics/analytics.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    SupabaseModule,
    AuthModule,
    EventsModule,
    VendorsModule,
    GuestsModule,
    InvitesModule,
    EmailModule,
    GiftsModule,
    AnalyticsModule,
  ],
})
export class AppModule {}
