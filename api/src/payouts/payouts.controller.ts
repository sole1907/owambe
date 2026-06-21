import { Controller, Get, Headers, Post, UnauthorizedException, UseGuards } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { PayoutsService } from './payouts.service'

@Controller('payouts')
export class PayoutsController {
  constructor(
    private payouts: PayoutsService,
    private config: ConfigService,
  ) {}

  // Bank list — vendors need this to pick their bank
  @Get('banks')
  @UseGuards(JwtAuthGuard)
  getBanks() {
    return this.payouts.getBanks()
  }

  // Admin/cron trigger — protected by CRON_SECRET header
  @Post('process')
  async processDue(@Headers('x-cron-secret') secret: string) {
    const expected = this.config.get<string>('cronSecret')
    if (!expected || secret !== expected) {
      throw new UnauthorizedException('Invalid cron secret')
    }
    await this.payouts.processDueReleases()
    return { ok: true }
  }
}
