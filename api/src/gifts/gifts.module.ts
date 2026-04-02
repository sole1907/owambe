import { Module } from '@nestjs/common'
import { GiftsController, GiftsPublicController } from './gifts.controller'
import { GiftsService } from './gifts.service'

@Module({
  controllers: [GiftsPublicController, GiftsController],
  providers: [GiftsService],
})
export class GiftsModule {}
