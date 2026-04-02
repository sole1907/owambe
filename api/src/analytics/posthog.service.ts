import { Injectable, OnModuleDestroy } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PostHog } from 'posthog-node'

@Injectable()
export class PostHogService implements OnModuleDestroy {
  private client: PostHog | null = null

  constructor(private config: ConfigService) {
    const key = this.config.get<string>('posthogKey')
    if (key) {
      this.client = new PostHog(key, {
        host: 'https://app.posthog.com',
        flushAt: 20,
        flushInterval: 10000,
      })
    }
  }

  capture(distinctId: string, event: string, properties?: Record<string, unknown>) {
    if (!this.client) return
    this.client.capture({ distinctId, event, properties })
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.shutdown()
    }
  }
}
