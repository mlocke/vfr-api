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

  // Test results output - suppress warnings and noise
  reporters: [
    ['default', { silent: false, verbose: false }],
    '<rootDir>/jest.reporter.js'
  ],

  // Verbose output disabled to reduce console clutter
  verbose: false,

  // Suppress specific Jest warnings
  silent: false,
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],

  // Transform files with ts-jest and suppress diagnostics
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      diagnostics: {
        warnOnly: true,
        exclude: ['**']
      },
      transpilation: true // Use modern transpilation instead of isolatedModules
    }]
  },

  // Suppress Jest internal warnings and timeout notifications
  errorOnDeprecated: false,
  notify: false,
  notifyMode: 'failure',

  // Additional Node.js warning suppression via environment
  setupFiles: ['<rootDir>/jest.node-setup.js'],


  // Clear mocks between tests
  clearMocks: true,

  // Detect open handles and async operations
  detectOpenHandles: true,
  forceExit: false,

  // Test timeout - set for longest integration tests with real API calls
  testTimeout: 300000, // 5 minutes for comprehensive integration tests with real APIs


  // Maximum worker processes
  maxWorkers: 1,

  // Memory leak prevention and optimization
  logHeapUsage: true,
  detectLeaks: false,  // Temporarily disabled until cleanup is complete
  workerIdleMemoryLimit: '512MB',


  // Additional memory optimization
  maxConcurrency: 5,

  // Test isolation to prevent memory leaks
  restoreMocks: true,
  resetMocks: true,
  resetModules: false  // Keep false to avoid excessive module reloading
};

module.exports = config;