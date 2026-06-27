import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common'
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
    const authClient = this.supabase.getAuthClient()
    const adminClient = this.supabase.getAdminClient()
    const appUrl = this.config.get<string>('appUrl')

    const { data: authData, error: authError } = await authClient.auth.signUp({
      email: dto.email,
      password: dto.password,
      options: {
        emailRedirectTo: `${appUrl}/auth/confirm`,
      },
    })

    if (authError) {
      if (authError.message === 'fetch failed')
        throw new InternalServerErrorException('Unable to reach auth service')
      if (authError.message.toLowerCase().includes('password')) {
        throw new BadRequestException(
          'Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a special character.',
        )
      }
      throw new BadRequestException(authError.message)
    }
    if (!authData.user) throw new BadRequestException('Signup failed')

    const { error: dbError } = await adminClient.from('users').insert({
      id: authData.user.id,
      email: dto.email,
      full_name: dto.fullName,
      phone: dto.phone ?? null,
      role: 'user',
    })

    if (dbError) {
      if (
        dbError.message.includes('users_email_key') ||
        dbError.message.includes('unique constraint')
      ) {
        throw new BadRequestException('An account with this email already exists.')
      }
      throw new BadRequestException('Could not create account. Please try again.')
    }

    return { message: 'Check your email to confirm your account' }
  }

  async exchangeToken(supabaseAccessToken: string) {
    const authClient = this.supabase.getAuthClient()
    const adminClient = this.supabase.getAdminClient()

    const {
      data: { user },
      error,
    } = await authClient.auth.getUser(supabaseAccessToken)
    if (error || !user) throw new UnauthorizedException('Invalid or expired token')

    const { data: dbUser, error: dbError } = await adminClient
      .from('users')
      .select('id, email, full_name, role')
      .eq('id', user.id)
      .single()

    if (dbError || !dbUser) throw new UnauthorizedException('User not found')

    return { user: dbUser, token: this.issueToken(dbUser) }
  }

  async signIn(dto: SignInDto) {
    const authClient = this.supabase.getAuthClient()
    const adminClient = this.supabase.getAdminClient()

    const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
      email: dto.email,
      password: dto.password,
    })

    if (authError) {
      const msg = authError.message.toLowerCase()
      if (msg.includes('email not confirmed') || msg.includes('not confirmed')) {
        throw new UnauthorizedException(
          'Please verify your email before signing in. Check your inbox.',
        )
      }
      throw new UnauthorizedException('Invalid email or password')
    }

    const { data: user, error: dbError } = await adminClient
      .from('users')
      .select('id, email, full_name, role')
      .eq('id', authData.user.id)
      .single()

    if (dbError || !user)
      throw new UnauthorizedException('Could not load your account. Please contact support.')

    return { user, token: this.issueToken(user) }
  }

  async forgotPassword(email: string) {
    const authClient = this.supabase.getAuthClient()
    const appUrl = this.config.get<string>('appUrl')

    const { error } = await authClient.auth.resetPasswordForEmail(email, {
      redirectTo: `${appUrl}/reset-password`,
    })

    if (error && error.message === 'fetch failed') {
      throw new InternalServerErrorException('Unable to reach auth service')
    }

    return { message: 'If an account exists for that email, a reset link has been sent.' }
  }

  async resetPassword(accessToken: string, password: string) {
    const adminClient = this.supabase.getAdminClient()

    const {
      data: { user },
      error: userError,
    } = await adminClient.auth.getUser(accessToken)
    if (userError || !user)
      throw new BadRequestException('This reset link is invalid or has expired.')

    const { error } = await adminClient.auth.admin.updateUserById(user.id, { password })
    if (error) {
      if (error.message.toLowerCase().includes('password')) {
        throw new BadRequestException(
          'Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a special character.',
        )
      }
      throw new BadRequestException('Could not reset password. Please try again.')
    }

    return { message: 'Your password has been reset. You can now sign in.' }
  }

  async devConfirmEmail(email: string) {
    const adminClient = this.supabase.getAdminClient()
    const { data: dbUser, error: dbErr } = await adminClient
      .from('users')
      .select('id')
      .eq('email', email)
      .single()
    if (dbErr || !dbUser) throw new BadRequestException('User not found')
    const { error } = await adminClient.auth.admin.updateUserById(dbUser.id, {
      email_confirm: true,
    })
    if (error) throw new BadRequestException(error.message)
    return { confirmed: true }
  }

  async devDeleteAccount(userId: string) {
    const adminClient = this.supabase.getAdminClient()
    await adminClient.from('users').delete().eq('id', userId)
    await adminClient.auth.admin.deleteUser(userId)
    return { deleted: true }
  }

  private issueToken(user: { id: string; email: string; role: string }) {
    return this.jwt.sign({ sub: user.id, email: user.email, role: user.role })
  }
}
