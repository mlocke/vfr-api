/**
 * Jest Node.js Setup File
 * Suppresses Node.js process-level warnings related to timeouts and testing
 * This runs before jest.setup.js and handles low-level Node.js warnings
 */

// Suppress Node.js deprecation warnings related to testing
process.env.NODE_NO_WARNINGS = '1'

// Suppress specific Node.js warnings that appear during Jest testing
const originalEmitWarning = process.emitWarning
process.emitWarning = function(warning, type, code, ctor) {
  const warningStr = warning ? warning.toString() : ''
  const typeStr = type ? type.toString() : ''

  // Filter out testing-related warnings
  if (
    // Timeout-related warnings
    warningStr.toLowerCase().includes('timeout') ||
    typeStr.toLowerCase().includes('timeout') ||
    typeStr === 'TimeoutWarning' ||

    // Jest-related deprecation warnings
    warningStr.includes('jest') ||
    warningStr.includes('Jest') ||

    // Async operation warnings during testing
    warningStr.includes('async') && warningStr.includes('operation') ||

    // Promise rejection warnings during timeouts
    warningStr.includes('promise') && warningStr.includes('rejection')
  ) {
    return // Suppress these warnings
  }

  return originalEmitWarning.call(this, warning, type, code, ctor)
}

// Suppress stdout/stderr warnings at the process level for Jest
const originalStderrWrite = process.stderr.write
const originalStdoutWrite = process.stdout.write

process.stderr.write = function(chunk, encoding, fd) {
  const output = chunk.toString()

  // Filter Node.js process warnings in stderr
  if (
    /\(node:\d+\).*timeout/i.test(output) ||
    /\(node:\d+\).*TimeoutWarning/i.test(output) ||
    /\(node:\d+\).*DeprecationWarning.*jest/i.test(output) ||
    output.includes('Use `node --trace-deprecation') ||
    output.includes('(Use `node --trace-warnings')
  ) {
    return true
  }

  return originalStderrWrite.call(process.stderr, chunk, encoding, fd)
}

process.stdout.write = function(chunk, encoding, fd) {
  const output = chunk.toString()

  // Filter Node.js process messages in stdout
  if (
    /\(node:\d+\).*timeout/i.test(output)
  ) {
    return true
  }

  return originalStdoutWrite.call(process.stdout, chunk, encoding, fd)
}

// Set Node.js warning behavior for Jest testing
process.setMaxListeners(0) // Prevent EventEmitter memory leak warnings during tests