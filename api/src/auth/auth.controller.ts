import { Body, Controller, Delete, ForbiddenException, Get, Post, UseGuards } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AuthService } from './auth.service'
import { SignUpDto } from './dto/signup.dto'
import { SignInDto } from './dto/signin.dto'
import { JwtAuthGuard } from './guards/jwt-auth.guard'
import { CurrentUser } from './decorators/current-user.decorator'

@Controller('auth')
export class AuthController {
  constructor(
    private auth: AuthService,
    private config: ConfigService,
  ) {}

  @Post('signup')
  signUp(@Body() dto: SignUpDto) {
    return this.auth.signUp(dto)
  }

  @Post('signin')
  signIn(@Body() dto: SignInDto) {
    return this.auth.signIn(dto)
  }

  @Post('exchange-token')
  exchangeToken(@Body() body: { access_token: string }) {
    return this.auth.exchangeToken(body.access_token)
  }

  @Post('forgot-password')
  forgotPassword(@Body() body: { email: string }) {
    return this.auth.forgotPassword(body.email)
  }

  @Post('reset-password')
  resetPassword(@Body() body: { access_token: string; password: string }) {
    return this.auth.resetPassword(body.access_token, body.password)
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: any) {
    return user
  }

  // ── Dev-only helpers (blocked in production) ──────────────────────────────

  @Post('dev-confirm-email')
  devConfirmEmail(@Body() body: { email: string }) {
    if (this.config.get('NODE_ENV') === 'production') throw new ForbiddenException()
    return this.auth.devConfirmEmail(body.email)
  }

  @Delete('dev-delete-account')
  @UseGuards(JwtAuthGuard)
  devDeleteAccount(@CurrentUser() user: any) {
    if (this.config.get('NODE_ENV') === 'production') throw new ForbiddenException()
    return this.auth.devDeleteAccount(user.id)
  }
}
