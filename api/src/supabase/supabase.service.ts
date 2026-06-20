import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

@Injectable()
export class SupabaseService {
  // Used for auth operations (signUp, signIn, etc.) — session may be mutated by auth calls
  private authClient: SupabaseClient
  // Used for database queries — session is never modified, always uses service role key
  private adminClient: SupabaseClient

  constructor(private config: ConfigService) {
    const url = this.config.get<string>('supabase.url')!
    const serviceRoleKey = this.config.get<string>('supabase.serviceRoleKey')!
    const opts = { auth: { autoRefreshToken: false, persistSession: false } }

    this.authClient = createClient(url, serviceRoleKey, opts)
    this.adminClient = createClient(url, serviceRoleKey, opts)
  }

  // For auth operations (signUp, signIn, resetPassword, etc.)
  getAuthClient(): SupabaseClient {
    return this.authClient
  }

  // For database queries — always uses service role key, never polluted by auth sessions
  getAdminClient(): SupabaseClient {
    return this.adminClient
  }

  // Backwards-compatible alias
  getClient(): SupabaseClient {
    return this.adminClient
  }
}
