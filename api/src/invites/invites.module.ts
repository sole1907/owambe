import { Module } from '@nestjs/common'
import { InvitesController, InvitesProtectedController } from './invites.controller'
import { InvitesService } from './invites.service'

@Module({
  controllers: [InvitesController, InvitesProtectedController],
  providers: [InvitesService],
  exports: [InvitesService],
})
export class InvitesModule {}
