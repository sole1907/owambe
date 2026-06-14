import { BadRequestException, Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { SupabaseService } from '../supabase/supabase.service'
import { SignUpDto } from './dto/signup.dto'
import { SignInDto } from './dto/signin.dto'

@Injectable()
export class AuthService {
  constructor(
    private supabase: SupabaseService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async signUp(dto: SignUpDto) {
    const client = this.supabase.getClient()
    const appUrl = this.config.get<string>('appUrl')

    const { data: authData, error: authError } = await client.auth.signUp({
      email: dto.email,
      password: dto.password,
      options: {
        emailRedirectTo: `${appUrl}/auth/confirm`,
      },
    })

    if (authError) {
      if (authError.message === 'fetch failed') throw new InternalServerErrorException('Unable to reach auth service')
      if (authError.message.toLowerCase().includes('password')) {
        throw new BadRequestException('Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a special character.')
      }
      throw new BadRequestException(authError.message)
    }
    if (!authData.user) throw new BadRequestException('Signup failed')

    // Create user record in our users table
    const { error: dbError } = await client
      .from('users')
      .insert({
        id: authData.user.id,
        email: dto.email,
        full_name: dto.fullName,
        phone: dto.phone ?? null,
        role: 'user',
      })

    if (dbError) {
      if (dbError.message.includes('users_email_key') || dbError.message.includes('unique constraint')) {
        throw new BadRequestException('An account with this email already exists.')
      }
      throw new BadRequestException('Could not create account. Please try again.')
    }

    return { message: 'Check your email to confirm your account' }
  }

  async exchangeToken(supabaseAccessToken: string) {
    const client = this.supabase.getClient()

    const { data: { user }, error } = await client.auth.getUser(supabaseAccessToken)
    if (error || !user) throw new UnauthorizedException('Invalid or expired token')

    const { data: dbUser, error: dbError } = await client
      .from('users')
      .select('id, email, full_name, role')
      .eq('id', user.id)
      .single()

    if (dbError || !dbUser) throw new UnauthorizedException('User not found')

    return { user: dbUser, token: this.issueToken(dbUser) }
  }

  async signIn(dto: SignInDto) {
    const client = this.supabase.getClient()

    // Authenticate via Supabase Auth
    const { data: authData, error: authError } = await client.auth.signInWithPassword({
      email: dto.email,
      password: dto.password,
    })

    if (authError) {
      const msg = authError.message.toLowerCase()
      if (msg.includes('email not confirmed') || msg.includes('not confirmed')) {
        throw new UnauthorizedException('Please verify your email before signing in. Check your inbox.')
      }
      throw new UnauthorizedException('Invalid email or password')
    }

    // Fetch user from our users table
    const { data: user, error: dbError } = await client
      .from('users')
      .select('id, email, full_name, role')
      .eq('id', authData.user.id)
      .single()

    if (dbError || !user) throw new UnauthorizedException('User not found')

    const token = this.issueToken(user)
    return { user, token }
  }

  async forgotPassword(email: string) {
    const client = this.supabase.getClient()
    const appUrl = this.config.get<string>('appUrl')

    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: `${appUrl}/reset-password`,
    })

    if (error && error.message === 'fetch failed') {
      throw new InternalServerErrorException('Unable to reach auth service')
    }

    // Always return success to avoid email enumeration
    return { message: 'If an account exists for that email, a reset link has been sent.' }
  }

  async resetPassword(accessToken: string, password: string) {
    const client = this.supabase.getClient()

    const { data: { user }, error: userError } = await client.auth.getUser(accessToken)
    if (userError || !user) throw new BadRequestException('This reset link is invalid or has expired.')

    const { error } = await client.auth.admin.updateUserById(user.id, { password })
    if (error) {
      if (error.message.toLowerCase().includes('password')) {
        throw new BadRequestException('Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a special character.')
      }
      throw new BadRequestException('Could not reset password. Please try again.')
    }

    return { message: 'Your password has been reset. You can now sign in.' }
  }

  private issueToken(user: { id: string; email: string; role: string }) {
    return this.jwt.sign({ sub: user.id, email: user.email, role: user.role })
  }
}
