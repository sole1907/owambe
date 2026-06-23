import { Module } from '@nestjs/common'
import { CollaboratorsController, CollaboratorsPublicController } from './collaborators.controller'
import { CollaboratorsService } from './collaborators.service'

@Module({
  controllers: [CollaboratorsPublicController, CollaboratorsController],
  providers: [CollaboratorsService],
  exports: [CollaboratorsService],
})
export class CollaboratorsModule {}
