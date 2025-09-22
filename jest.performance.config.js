/** @type {import('jest').Config} */
const config = {
  // Extend base Jest configuration
  ...require('./jest.config.js'),

  // Performance test specific settings
  displayName: 'Performance Tests',

  // Test file patterns - only performance tests
  testMatch: [
    '<rootDir>/**/__tests__/**/*.performance.test.ts',
    '<rootDir>/**/*.performance.test.ts'
  ],

  // Extended timeout for performance tests with real API calls
  testTimeout: 300000, // 5 minutes

  // Memory optimization for performance testing
  maxWorkers: 1, // Single worker for consistent performance measurement
  logHeapUsage: true, // Enable memory monitoring
  detectOpenHandles: true, // Detect resource leaks
  detectLeaks: false, // Disabled temporarily for performance focus

  // Memory limits for performance testing
  workerIdleMemoryLimit: '1GB',

  // Enhanced memory monitoring
  verbose: true,

  // Performance test specific reporters
  reporters: [
    ['default', { silent: false, verbose: true }],
    ['<rootDir>/jest.performance-reporter.js']
  ],

  // Setup files for performance testing
  setupFilesAfterEnv: [
    '<rootDir>/jest.setup.js',
    '<rootDir>/jest.performance-setup.js'
  ],

  // Coverage disabled for performance tests (impacts performance)
  collectCoverage: false,

  // Force exit after tests (important for performance testing)
  forceExit: true,

  // Clear all caches and mocks between tests
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,

  // Test isolation for memory leak detection
  resetModules: false, // Keep false to avoid excessive module reloading

  // Global performance test settings
  globals: {
    'PERFORMANCE_TEST_MODE': true,
    'PERFORMANCE_TARGET_MS': 500,
    'MEMORY_LEAK_THRESHOLD_MB': 50,
    'CACHE_HIT_RATE_TARGET': 0.80
  }
};

module.exports = config;