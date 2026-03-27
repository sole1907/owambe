import { PostHogService } from './posthog.service'
import { ConfigService } from '@nestjs/config'

jest.mock('posthog-node', () => ({
  PostHog: jest.fn().mockImplementation(() => ({
    capture: jest.fn(),
    shutdown: jest.fn().mockResolvedValue(undefined),
  })),
}))

const { PostHog } = require('posthog-node')

function makeConfig(key?: string): ConfigService {
  return { get: jest.fn().mockReturnValue(key) } as any
}

describe('PostHogService', () => {
  afterEach(() => jest.clearAllMocks())

  it('initialises PostHog when a key is present', () => {
    new PostHogService(makeConfig('phc_testkey'))
    expect(PostHog).toHaveBeenCalledWith('phc_testkey', expect.any(Object))
  })

  it('does not initialise PostHog when no key is set', () => {
    PostHog.mockClear()
    new PostHogService(makeConfig(undefined))
    expect(PostHog).not.toHaveBeenCalled()
  })

  it('calls client.capture when key is present', () => {
    const svc = new PostHogService(makeConfig('phc_testkey'))
    svc.capture('user-1', 'plan_generated', { type: 'wedding' })
    const instance = PostHog.mock.results[0].value
    expect(instance.capture).toHaveBeenCalledWith({
      distinctId: 'user-1',
      event: 'plan_generated',
      properties: { type: 'wedding' },
    })
  })

  it('is a no-op when no key is configured', () => {
    const svc = new PostHogService(makeConfig(undefined))
    expect(() => svc.capture('u', 'e')).not.toThrow()
  })

  it('calls client.shutdown on module destroy', async () => {
    const svc = new PostHogService(makeConfig('phc_testkey'))
    await svc.onModuleDestroy()
    const instance = PostHog.mock.results[0].value
    expect(instance.shutdown).toHaveBeenCalled()
  })

  it('onModuleDestroy is safe when no client exists', async () => {
    const svc = new PostHogService(makeConfig(undefined))
    await expect(svc.onModuleDestroy()).resolves.not.toThrow()
  })
})
