/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    // stub out Next.js image and other non-JS imports
    '\\.(css|less|scss|svg|png|jpg|gif)$': '<rootDir>/__mocks__/fileMock.js',
  },
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': ['babel-jest', { configFile: './babel.config.js' }],
  },
  testMatch: ['**/__tests__/**/*.{ts,tsx}', '**/*.test.{ts,tsx}'],
  // Only collect coverage for lib/ — components require full React render setup
  collectCoverageFrom: [
    'lib/**/*.{ts,tsx}',
    '!lib/types.ts',
  ],
  coverageThreshold: {
    global: { lines: 80, functions: 80, branches: 70, statements: 80 },
  },
}

module.exports = config
