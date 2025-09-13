/** @type {import('jest').Config} */
const config = {
  // Use ts-jest preset for TypeScript support
  preset: 'ts-jest',

  // Test environment
  testEnvironment: 'node',

  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/?(*.)+(spec|test).ts'
  ],

  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  // Transform files with ts-jest
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },

  // Module name mapping for absolute imports
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1'
  },

  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: 'docs/test-output/coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  collectCoverageFrom: [
    'app/services/mcp/**/*.ts',
    '!app/services/mcp/**/*.test.ts',
    '!app/services/mcp/**/*.d.ts'
  ],

  // Test results output (handled by reporters)
  reporters: ['default'],

  // Verbose output for detailed test information
  verbose: true,

  // Setup files
  setupFilesAfterEnv: [],

  // Clear mocks between tests
  clearMocks: true,

  // Detect open handles and async operations
  detectOpenHandles: true,
  forceExit: false,

  // Test timeout
  testTimeout: 30000,

  // Global setup/teardown
  globalSetup: undefined,
  globalTeardown: undefined,

  // Maximum worker processes
  maxWorkers: 1
};

module.exports = config;