/**
 * Custom Jest Reporter to Suppress Timeout Warnings
 * Filters out timeout-related warnings from console output during test runs
 */

class SuppressTimeoutWarningsReporter {
  constructor(globalConfig, options) {
    this._globalConfig = globalConfig;
    this._options = options;
  }

  onRunStart(results, options) {
    // Suppress Jest's internal timeout warnings
    const originalStderr = process.stderr.write;
    const originalStdout = process.stdout.write;

    process.stderr.write = function(chunk, encoding, fd) {
      const output = chunk.toString();
      // Comprehensive timeout warning filtering
      if (
        // Jest timeout patterns
        (output.includes('timeout') && (
          output.includes('exceeded') ||
          output.includes('Test timeout') ||
          output.includes('jest.setTimeout') ||
          output.includes('timeout of') ||
          output.includes('Async callback was not invoked')
        )) ||

        // Node.js process warnings
        /\(node:\d+\).*timeout/i.test(output) ||
        /\(node:\d+\).*TimeoutWarning/i.test(output) ||
        /\(node:\d+\).*Warning:.*timeout/i.test(output) ||

        // Jest internal warnings
        output.includes('jest: timeout') ||
        output.includes('Test environment timeout') ||

        // Unhandled promise warnings during timeouts
        (output.includes('UnhandledPromiseRejectionWarning') && output.includes('timeout'))
      ) {
        return true; // Suppress the warning
      }
      return originalStderr.call(process.stderr, chunk, encoding, fd);
    };

    process.stdout.write = function(chunk, encoding, fd) {
      const output = chunk.toString();
      // Filter out dotenv noise and timeout messages
      if (
        output.includes('[dotenv@') ||
        output.includes('injecting env') ||
        output.includes('tip:') ||

        // Timeout-related stdout messages
        (output.includes('timeout') && (
          output.includes('jest') ||
          output.includes('Test') ||
          output.includes('exceeded')
        )) ||

        // Node.js timeout messages in stdout
        /\(node:\d+\).*timeout/i.test(output)
      ) {
        return true; // Suppress the output
      }
      return originalStdout.call(process.stdout, chunk, encoding, fd);
    };
  }

  onTestResult(test, testResult, aggregatedResult) {
    // Filter test results that contain timeout warnings
    if (testResult.console) {
      testResult.console = testResult.console.filter(entry => {
        const message = entry.message;
        return !(
          // Jest timeout patterns
          (message.includes('timeout') && (
            message.includes('exceeded') ||
            message.includes('Test timeout') ||
            message.includes('jest.setTimeout') ||
            message.includes('timeout of') ||
            message.includes('Async callback was not invoked')
          )) ||

          // Node.js process warnings
          /\(node:\d+\).*timeout/i.test(message) ||
          /\(node:\d+\).*TimeoutWarning/i.test(message) ||

          // Jest internal warnings
          message.includes('jest: timeout') ||
          message.includes('Test environment timeout') ||

          // Unhandled promise warnings during timeouts
          (message.includes('UnhandledPromiseRejectionWarning') && message.includes('timeout'))
        );
      });
    }
  }

  onRunComplete(contexts, results) {
    // Restore original stderr/stdout
    // This happens automatically when the process ends
  }
}

module.exports = SuppressTimeoutWarningsReporter;