import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { PaymentsService } from './payments.service'
import { InitializePaymentDto } from './dto/initialize-payment.dto'
import { VerifyPaymentDto } from './dto/verify-payment.dto'

@Controller('payments')
export class PaymentsController {
  constructor(private payments: PaymentsService) {}

  // Webhook — no auth guard, Paystack signs the payload
  @Post('webhook')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async webhook(@Req() req: any, @Headers('x-paystack-signature') signature: string) {
    await this.payments.handleWebhook(req.rawBody as Buffer, signature)
    return { received: true }
  }

  // Get payment by reference (for callback page — no auth needed to show status)
  @Get('status/:reference')
  getStatus(@Param('reference') reference: string) {
    return this.payments.getPaymentByReference(reference)
  }

  // Initialize a commitment fee payment (requires auth)
  @Post('initialize')
  @UseGuards(JwtAuthGuard)
  initialize(@Body() dto: InitializePaymentDto, @CurrentUser() user: any) {
    return this.payments.initializePayment(user.id, dto.interestId)
  }

  // Verify payment after Paystack callback (requires auth)
  @Post('verify')
  @UseGuards(JwtAuthGuard)
  verify(@Body() dto: VerifyPaymentDto, @CurrentUser() user: any) {
    return this.payments.verifyPayment(user.id, dto.reference)
  }
}
