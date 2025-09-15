/**
 * Jest Setup File
 * Configures global test environment for memory optimization and leak prevention
 */

// Mock process.env to prevent environment variable leaks across tests
const originalEnv = process.env

beforeEach(() => {
  // Restore original environment for each test
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

// Set shorter default timeouts to prevent hanging tests
jest.setTimeout(8000) // 8 seconds (reduced from default 10s)

// Configure console to suppress noise during tests
const originalConsole = global.console

// Don't mock console globally as it interferes with test debugging
// Individual tests can mock console if needed

// Global error handlers to prevent unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
  // Don't exit the process during tests
})

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
  // Don't exit the process during tests
})

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