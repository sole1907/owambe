import { Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { SupabaseService } from '../../supabase/supabase.service'

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private config: ConfigService,
    private supabase: SupabaseService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.secret')!,
    })
  }

  async validate(payload: { sub: string; email: string; role: string }) {
    const { data: user, error } = await this.supabase
      .getClient()
      .from('users')
      .select('id, email, full_name, role')
      .eq('id', payload.sub)
      .single()

    if (error || !user) throw new UnauthorizedException()

    return user
  }
}
