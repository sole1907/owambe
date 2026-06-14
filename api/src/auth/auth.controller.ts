import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common'
import { AuthService } from './auth.service'
import { SignUpDto } from './dto/signup.dto'
import { SignInDto } from './dto/signin.dto'
import { JwtAuthGuard } from './guards/jwt-auth.guard'
import { CurrentUser } from './decorators/current-user.decorator'

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

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
}
