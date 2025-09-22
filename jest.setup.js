/**
 * Jest Setup File
 * Configures global test environment for memory optimization and leak prevention
 */

// Load environment variables from .env file for tests (silently)
require('dotenv').config({ quiet: true })

// Mock process.env to prevent environment variable leaks across tests
const originalEnv = process.env

beforeEach(() => {
  // Restore original environment for each test (with .env loaded)
  process.env = { ...originalEnv }
})

afterEach(() => {
  // Force garbage collection if available (for memory testing)
  if (global.gc) {
    global.gc()
  }

  // Clear all module require caches to prevent memory leaks
  // Only clear non-node_modules modules to avoid breaking dependencies
  Object.keys(require.cache).forEach(key => {
    if (!key.includes('node_modules')) {
      delete require.cache[key]
    }
  })
})

// Set timeout to match jest.config.js for consistency
jest.setTimeout(300000) // 5 minutes for comprehensive integration tests with real APIs

// Configure console to suppress timeout warnings and noise during tests
const originalConsole = global.console

// Filter out Jest timeout warnings and other noise
const filteredConsole = {
  ...originalConsole,
  warn: (...args) => {
    const message = args.join(' ')
    // Comprehensive timeout warning suppression
    if (
      // Jest timeout patterns
      (message.includes('timeout') && (message.includes('exceeded') || message.includes('Test timeout') || message.includes('timeout of'))) ||
      message.includes('jest.setTimeout') ||
      message.includes('Async callback was not invoked within the timeout') ||
      message.includes('Timeout - Async callback was not invoked') ||

      // Node.js process warnings related to timeouts
      /\(node:\d+\).*timeout/i.test(message) ||
      /\(node:\d+\).*TimeoutWarning/i.test(message) ||
      /\(node:\d+\).*Warning:.*timeout/i.test(message) ||

      // Unhandled promise warnings during timeouts
      (message.includes('UnhandledPromiseRejectionWarning') && message.includes('timeout')) ||

      // Jest internal warnings
      message.includes('jest: timeout') ||
      message.includes('Test environment timeout') ||
      message.includes('jest timeout') ||

      // Dotenv noise
      message.includes('dotenv') ||
      message.includes('[dotenv@') ||
      message.includes('injecting env') ||
      message.includes('tip:')
    ) {
      return
    }
    originalConsole.warn(...args)
  },
  log: (...args) => {
    const message = args.join(' ')
    // Suppress dotenv injection logs and timeout-related logs
    if (
      message.includes('[dotenv@') ||
      message.includes('injecting env') ||
      message.includes('tip:') ||

      // Additional timeout logs that might appear in console.log
      (message.includes('timeout') && (message.includes('jest') || message.includes('Test')))
    ) {
      return
    }
    originalConsole.log(...args)
  },
  error: (...args) => {
    const message = args.join(' ')
    // Suppress timeout-related errors that aren't actual test failures
    if (
      // Jest timeout errors
      message.includes('jest.setTimeout global timeout') ||
      message.includes('Test environment timeout') ||

      // Node.js process timeout errors
      /\(node:\d+\).*timeout/i.test(message) ||
      (message.includes('timeout') && message.includes('node:'))
    ) {
      return
    }
    originalConsole.error(...args)
  }
}

// Apply filtered console globally for tests
global.console = filteredConsole

// Global error handlers to prevent unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  const reasonStr = reason ? reason.toString() : ''
  // Suppress timeout-related unhandled rejections
  if (reasonStr.includes('timeout') || reasonStr.includes('Timeout')) {
    return // Silently ignore timeout-related unhandled rejections
  }
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
  // Don't exit the process during tests
})

process.on('uncaughtException', (error) => {
  const errorStr = error ? error.toString() : ''
  // Suppress timeout-related uncaught exceptions
  if (errorStr.includes('timeout') || errorStr.includes('Timeout')) {
    return // Silently ignore timeout-related uncaught exceptions
  }
  console.error('Uncaught Exception:', error)
  // Don't exit the process during tests
})

// Suppress Node.js process warnings related to timeouts
const originalProcessEmitWarning = process.emitWarning
process.emitWarning = function(warning, type, code, ctor) {
  const warningStr = warning ? warning.toString() : ''
  const typeStr = type ? type.toString() : ''

  // Filter out timeout-related process warnings
  if (
    warningStr.toLowerCase().includes('timeout') ||
    typeStr.toLowerCase().includes('timeout') ||
    typeStr === 'TimeoutWarning'
  ) {
    return // Suppress timeout warnings
  }

  return originalProcessEmitWarning.call(this, warning, type, code, ctor)
}

// Mock WebSocket globally to prevent real connections during tests
class MockWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  readyState = MockWebSocket.CONNECTING
  onopen = null
  onmessage = null
  onclose = null
  onerror = null

  constructor(url) {
    this.url = url
  }

  send() {}
  close() {
    this.readyState = MockWebSocket.CLOSED
  }
}

global.WebSocket = MockWebSocket

// Memory leak detection helper
global.detectMemoryLeak = function(threshold = 50 * 1024 * 1024) { // 50MB
  const usage = process.memoryUsage()
  if (usage.heapUsed > threshold) {
    console.warn(`Memory usage high: ${Math.round(usage.heapUsed / 1024 / 1024)}MB`)
    return true
  }
  return false
}

// Helper to force cleanup between intensive tests
global.forceCleanup = async function() {
  // Clear all timers
  const highestTimeoutId = setTimeout(() => {}, 0)
  for (let i = 0; i < highestTimeoutId; i++) {
    clearTimeout(i)
    clearInterval(i)
  }

  // Wait for cleanup to complete
  await new Promise(resolve => setTimeout(resolve, 10))

  // Force garbage collection
  if (global.gc) {
    global.gc()
  }
}