// Mock posthog-js before importing our module
const mockPosthog = {
  init: jest.fn(),
  capture: jest.fn(),
  identify: jest.fn(),
  reset: jest.fn(),
}
jest.mock('posthog-js', () => mockPosthog)

// Reset the module's `initialised` flag between tests by re-importing fresh
let initPostHog: typeof import('@/lib/posthog').initPostHog
let capture: typeof import('@/lib/posthog').capture
let identify: typeof import('@/lib/posthog').identify
let reset: typeof import('@/lib/posthog').reset

beforeEach(() => {
  jest.resetModules()
  jest.clearAllMocks()
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('@/lib/posthog')
  initPostHog = mod.initPostHog
  capture = mod.capture
  identify = mod.identify
  reset = mod.reset
})

describe('posthog lib', () => {
  describe('initPostHog()', () => {
    it('does not call posthog.init when NEXT_PUBLIC_POSTHOG_KEY is absent', () => {
      delete process.env.NEXT_PUBLIC_POSTHOG_KEY
      initPostHog()
      expect(mockPosthog.init).not.toHaveBeenCalled()
    })

    it('calls posthog.init with key and host when key is set', () => {
      process.env.NEXT_PUBLIC_POSTHOG_KEY = 'phc_testkey'
      initPostHog()
      expect(mockPosthog.init).toHaveBeenCalledWith(
        'phc_testkey',
        expect.objectContaining({ capture_pageview: true }),
      )
    })

    it('does not reinitialise on second call', () => {
      process.env.NEXT_PUBLIC_POSTHOG_KEY = 'phc_testkey'
      initPostHog()
      initPostHog()
      expect(mockPosthog.init).toHaveBeenCalledTimes(1)
    })

  })

  describe('capture()', () => {
    it('calls posthog.capture with event and properties', () => {
      capture('test_event', { foo: 'bar' })
      expect(mockPosthog.capture).toHaveBeenCalledWith('test_event', { foo: 'bar' })
    })

  })

  describe('identify()', () => {
    it('calls posthog.identify with userId and traits', () => {
      identify('user-123', { name: 'Ada' })
      expect(mockPosthog.identify).toHaveBeenCalledWith('user-123', { name: 'Ada' })
    })
  })

  describe('reset()', () => {
    it('calls posthog.reset', () => {
      reset()
      expect(mockPosthog.reset).toHaveBeenCalled()
    })

  })
})
