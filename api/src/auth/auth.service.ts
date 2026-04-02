import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { SupabaseService } from '../supabase/supabase.service'
import { SignUpDto } from './dto/signup.dto'
import { SignInDto } from './dto/signin.dto'

@Injectable()
export class AuthService {
  constructor(
    private supabase: SupabaseService,
    private jwt: JwtService,
  ) {}

  async signUp(dto: SignUpDto) {
    const client = this.supabase.getClient()

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await client.auth.admin.createUser({
      email: dto.email,
      password: dto.password,
      email_confirm: true,
    })

    if (authError) throw new BadRequestException(authError.message)

    // Create user record in our users table
    const { data: user, error: dbError } = await client
      .from('users')
      .insert({
        id: authData.user.id,
        email: dto.email,
        full_name: dto.fullName,
        phone: dto.phone ?? null,
        role: 'user',
      })
      .select()
      .single()

    if (dbError) throw new BadRequestException(dbError.message)

    const token = this.issueToken(user)
    return { user, token }
  }

  async signIn(dto: SignInDto) {
    const client = this.supabase.getClient()

    // Authenticate via Supabase Auth
    const { data: authData, error: authError } = await client.auth.signInWithPassword({
      email: dto.email,
      password: dto.password,
    })

    if (authError) throw new UnauthorizedException('Invalid email or password')

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

  private issueToken(user: { id: string; email: string; role: string }) {
    return this.jwt.sign({ sub: user.id, email: user.email, role: user.role })
  }
}
