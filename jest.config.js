/** @type {import('jest').Config} */
const config = {
  // Use ts-jest preset for TypeScript support
  preset: 'ts-jest',

  // Test environment
  testEnvironment: 'node',

  // Test file patterns - exclude node_modules to prevent memory issues
  testMatch: [
    '<rootDir>/**/__tests__/**/*.test.ts',
    '<rootDir>/**/?(*.)+(spec|test).ts'
  ],
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist/',
    '<rootDir>/.next/'
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
    'app/services/**/*.ts',
    '!app/services/**/*.test.ts',
    '!app/services/**/*.d.ts'
  ],

  // Test results output (handled by reporters)
  reporters: ['default'],

  // Verbose output for detailed test information
  verbose: true,

  // Setup files - memory optimization and leak prevention
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],

  // Clear mocks between tests
  clearMocks: true,

  // Detect open handles and async operations
  detectOpenHandles: true,
  forceExit: false,

  // Test timeout - reduced to prevent memory buildup
  testTimeout: 10000,

  // Global setup/teardown
  globalSetup: undefined,
  globalTeardown: undefined,

  // Maximum worker processes
  maxWorkers: 1,

  // Memory leak prevention and optimization
  logHeapUsage: true,
  detectLeaks: false,  // Temporarily disabled until cleanup is complete
  workerIdleMemoryLimit: '512MB',

  // Force garbage collection between tests
  // Note: runInBand is deprecated in Jest 30+, but maxWorkers: 1 achieves serial execution

  // Additional memory optimization
  maxConcurrency: 5,

  // Test isolation to prevent memory leaks
  restoreMocks: true,
  resetMocks: true,
  resetModules: false  // Keep false to avoid excessive module reloading
};

module.exports = config;