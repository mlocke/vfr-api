/**
 * Jest setup file for Stock Selection Engine tests
 * Provides minimal mocking and configuration for test execution
 */

// Mock Redis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    ttl: jest.fn(),
    scan: jest.fn(),
    keys: jest.fn(),
    info: jest.fn().mockResolvedValue('# Memory\nused_memory_human:32.50M'),
    disconnect: jest.fn(),
    on: jest.fn(),
    off: jest.fn()
  }))
})

// Mock WebSocket
global.WebSocket = jest.fn().mockImplementation(() => ({
  readyState: WebSocket.OPEN,
  send: jest.fn(),
  close: jest.fn(),
  onopen: null,
  onmessage: null,
  onclose: null,
  onerror: null
}))

// WebSocket constants
global.WebSocket.CONNECTING = 0
global.WebSocket.OPEN = 1
global.WebSocket.CLOSING = 2
global.WebSocket.CLOSED = 3

// Mock fetch globally
global.fetch = jest.fn()

// Mock console methods to reduce test noise
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn()
}

// Mock setTimeout and clearTimeout
global.setTimeout = jest.fn().mockImplementation((cb, delay) => {
  return setImmediate(() => cb())
})
global.clearTimeout = jest.fn()

// Mock process.env
process.env.NODE_ENV = 'test'