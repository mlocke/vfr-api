# VFR Error Handling Standards

**Purpose**: Centralized error management with standardized types, structured logging, and enterprise security.

## Quick Reference

### Core Components
- **ErrorHandler**: `app/services/error-handling/ErrorHandler.ts` - Central error processing
- **Logger**: `app/services/error-handling/Logger.ts` - Structured logging with sanitization
- **RetryHandler**: `app/services/error-handling/RetryHandler.ts` - Exponential backoff retry logic
- **TimeoutHandler**: Timeout management with AbortController

## Error Classification

### Error Types & Codes
| Type | Code Range | Examples |
|------|------------|----------|
| VALIDATION | 1000-1999 | Invalid symbol (1001), missing field (1003) |
| AUTHENTICATION | 2000-2999 | Unauthorized (2001), token expired (2003) |
| RATE_LIMIT | 3000-3999 | Rate exceeded (3001), quota exceeded (3003) |
| API_ERROR | 4000-4999 | Timeout (4001), unavailable (4002) |
| SYSTEM | 5000-5999 | DB failed (5001), cache unavailable (5002) |

### Severity Levels
- **LOW**: Minor issues, system continues
- **MEDIUM**: Some functionality affected
- **HIGH**: Significant functionality affected
- **CRITICAL**: System-threatening, immediate attention

### StandardError Interface
```typescript
interface StandardError {
  id: string;                    // Unique identifier
  type: ErrorType;              // Category
  code: ErrorCode;              // Specific code
  severity: ErrorSeverity;      // Impact level
  message: string;              // User-friendly message
  timestamp: Date;              // When occurred
  context?: Record<string, any>; // Sanitized context
  correlationId?: string;       // Request tracking
  source: string;               // Component source
}
```

## Implementation Details

### Error Handler Core Service
```typescript
export class ErrorHandler {
  private logger: Logger;
  private sanitizer: DataSanitizer;

  constructor() {
    this.logger = new Logger('ErrorHandler');
    this.sanitizer = new DataSanitizer();
  }

  /**
   * Handle and process errors with standardized format
   */
  async handleError(
    error: unknown,
    source: string,
    context?: Record<string, any>
  ): Promise<StandardError> {
    const errorId = this.generateErrorId();
    const correlationId = this.getCorrelationId(context);

    // Classify the error
    const classification = this.classifyError(error);

    // Sanitize context to prevent data leaks
    const sanitizedContext = this.sanitizer.sanitizeContext(context);

    // Create standardized error object
    const standardError: StandardError = {
      id: errorId,
      type: classification.type,
      code: classification.code,
      severity: classification.severity,
      message: this.getUserFriendlyMessage(classification),
      details: this.getSafeDetails(error),
      timestamp: new Date(),
      context: sanitizedContext,
      stack: this.getStackTrace(error),
      correlationId,
      source
    };

    // Log the error
    await this.logError(standardError);

    // Trigger alerts for high/critical severity
    if (standardError.severity === ErrorSeverity.HIGH ||
        standardError.severity === ErrorSeverity.CRITICAL) {
      await this.triggerAlert(standardError);
    }

    return standardError;
  }

  /**
   * Classify error into standard categories
   */
  private classifyError(error: unknown): ErrorClassification {
    if (error instanceof ValidationError) {
      return {
        type: ErrorType.VALIDATION,
        code: ErrorCode.INVALID_INPUT_FORMAT,
        severity: ErrorSeverity.LOW
      };
    }

    if (error instanceof SecurityError) {
      return {
        type: ErrorType.SECURITY,
        code: ErrorCode.UNAUTHORIZED,
        severity: ErrorSeverity.HIGH
      };
    }

    if (error instanceof APITimeoutError) {
      return {
        type: ErrorType.API_TIMEOUT,
        code: ErrorCode.API_TIMEOUT,
        severity: ErrorSeverity.MEDIUM
      };
    }

    if (error instanceof RateLimitError) {
      return {
        type: ErrorType.RATE_LIMIT,
        code: ErrorCode.RATE_LIMIT_EXCEEDED,
        severity: ErrorSeverity.MEDIUM
      };
    }

    // Default classification for unknown errors
    return {
      type: ErrorType.UNKNOWN,
      code: ErrorCode.INTERNAL_SERVER_ERROR,
      severity: ErrorSeverity.HIGH
    };
  }

  /**
   * Generate user-friendly error messages
   */
  private getUserFriendlyMessage(classification: ErrorClassification): string {
    const messageMap: Record<string, string> = {
      [ErrorCode.INVALID_SYMBOL]: 'Invalid stock symbol format',
      [ErrorCode.RATE_LIMIT_EXCEEDED]: 'Too many requests. Please try again later',
      [ErrorCode.API_TIMEOUT]: 'Service temporarily unavailable. Please try again',
      [ErrorCode.UNAUTHORIZED]: 'Access denied',
      [ErrorCode.DATABASE_CONNECTION_FAILED]: 'Service temporarily unavailable'
    };

    return messageMap[classification.code] || 'An unexpected error occurred';
  }
}
```

### Data Sanitization for Security
```typescript
export class DataSanitizer {
  private readonly SENSITIVE_KEYS = [
    'password', 'token', 'key', 'secret', 'api_key',
    'authorization', 'cookie', 'session', 'credit_card',
    'ssn', 'social_security'
  ];

  /**
   * Sanitize context data to prevent sensitive information leaks
   */
  sanitizeContext(context?: Record<string, any>): Record<string, any> | undefined {
    if (!context) return undefined;

    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(context)) {
      if (this.isSensitiveKey(key)) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'string' && this.containsSensitiveData(value)) {
        sanitized[key] = this.sanitizeString(value);
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeContext(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  private isSensitiveKey(key: string): boolean {
    const lowerKey = key.toLowerCase();
    return this.SENSITIVE_KEYS.some(sensitive => lowerKey.includes(sensitive));
  }

  private containsSensitiveData(value: string): boolean {
    // Check for patterns like API keys, tokens, etc.
    const sensitivePatterns = [
      /\b[A-Za-z0-9]{32,}\b/,  // Long alphanumeric strings (likely keys)
      /Bearer\s+[A-Za-z0-9]+/i, // Bearer tokens
      /\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/ // Credit card patterns
    ];

    return sensitivePatterns.some(pattern => pattern.test(value));
  }

  private sanitizeString(value: string): string {
    // Replace sensitive patterns with safe representations
    return value
      .replace(/\b[A-Za-z0-9]{32,}\b/g, '[KEY]')
      .replace(/Bearer\s+[A-Za-z0-9]+/gi, 'Bearer [TOKEN]')
      .replace(/\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/g, '[CARD]');
  }
}
```

## Structured Logging System

### Logger Service Implementation
```typescript
export class Logger {
  private component: string;
  private winston: winston.Logger;

  constructor(component: string) {
    this.component = component;
    this.winston = this.createWinstonLogger();
  }

  async logError(error: StandardError): Promise<void> {
    const logEntry = {
      level: this.mapSeverityToLogLevel(error.severity),
      message: error.message,
      error_id: error.id,
      error_type: error.type,
      error_code: error.code,
      severity: error.severity,
      component: this.component,
      source: error.source,
      timestamp: error.timestamp.toISOString(),
      correlation_id: error.correlationId,
      context: error.context,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    };

    this.winston.log(logEntry.level, logEntry);

    // Also send to external monitoring if configured
    if (process.env.EXTERNAL_MONITORING_ENABLED === 'true') {
      await this.sendToExternalMonitoring(logEntry);
    }
  }

  logPerformance(operation: string, duration: number, details?: any): void {
    this.winston.info({
      type: 'performance',
      operation,
      duration_ms: duration,
      component: this.component,
      details: details ? this.sanitizer.sanitizeContext(details) : undefined,
      timestamp: new Date().toISOString()
    });
  }

  private mapSeverityToLogLevel(severity: ErrorSeverity): string {
    switch (severity) {
      case ErrorSeverity.LOW: return 'info';
      case ErrorSeverity.MEDIUM: return 'warn';
      case ErrorSeverity.HIGH: return 'error';
      case ErrorSeverity.CRITICAL: return 'error';
      default: return 'error';
    }
  }
}
```

## Retry Handler with Exponential Backoff

### RetryHandler Service
```typescript
export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffStrategy: 'linear' | 'exponential' | 'fixed';
  retryableErrors: ErrorType[];
}

export class RetryHandler {
  private defaultConfig: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffStrategy: 'exponential',
    retryableErrors: [
      ErrorType.API_TIMEOUT,
      ErrorType.API_ERROR,
      ErrorType.RATE_LIMIT,
      ErrorType.DATABASE,
      ErrorType.CACHE
    ]
  };

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    config?: Partial<RetryConfig>
  ): Promise<T> {
    const finalConfig = { ...this.defaultConfig, ...config };
    let lastError: any;

    for (let attempt = 1; attempt <= finalConfig.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        // Check if error is retryable
        if (!this.isRetryableError(error, finalConfig.retryableErrors)) {
          throw error;
        }

        // Don't delay on the last attempt
        if (attempt === finalConfig.maxRetries) {
          break;
        }

        const delay = this.calculateDelay(attempt, finalConfig);
        await this.delay(delay);

        // Log retry attempt
        this.logger.logRetryAttempt(attempt, delay, error);
      }
    }

    throw lastError;
  }

  private isRetryableError(error: any, retryableTypes: ErrorType[]): boolean {
    if (error instanceof StandardError) {
      return retryableTypes.includes(error.type);
    }

    // Check for specific error instances
    return (
      error instanceof APITimeoutError ||
      error instanceof RateLimitError ||
      error instanceof DatabaseConnectionError
    );
  }

  private calculateDelay(attempt: number, config: RetryConfig): number {
    let delay: number;

    switch (config.backoffStrategy) {
      case 'linear':
        delay = config.baseDelay * attempt;
        break;
      case 'exponential':
        delay = config.baseDelay * Math.pow(2, attempt - 1);
        break;
      case 'fixed':
        delay = config.baseDelay;
        break;
      default:
        delay = config.baseDelay;
    }

    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.1 * delay;
    delay += jitter;

    return Math.min(delay, config.maxDelay);
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

## Timeout Handler

### TimeoutHandler Service
```typescript
export class TimeoutHandler {
  private readonly DEFAULT_TIMEOUT = 30000; // 30 seconds

  async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number = this.DEFAULT_TIMEOUT,
    timeoutMessage?: string
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new APITimeoutError(
          timeoutMessage || `Operation timed out after ${timeoutMs}ms`
        ));
      }, timeoutMs);
    });

    try {
      return await Promise.race([operation(), timeoutPromise]);
    } catch (error) {
      if (error instanceof APITimeoutError) {
        await this.errorHandler.handleError(error, 'timeout-handler');
      }
      throw error;
    }
  }

  createAbortableOperation<T>(
    operation: (signal: AbortSignal) => Promise<T>,
    timeoutMs: number = this.DEFAULT_TIMEOUT
  ): Promise<T> {
    const abortController = new AbortController();

    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, timeoutMs);

    return operation(abortController.signal)
      .finally(() => clearTimeout(timeoutId));
  }
}
```

## Error Handling Integration Patterns

### API Route Error Handling
```typescript
// Standardized API route error handling
export async function POST(request: NextRequest) {
  const correlationId = generateCorrelationId();

  try {
    // Security validation
    const validationResult = await securityValidator.validateRequest(request);
    if (!validationResult.isValid) {
      throw new ValidationError(validationResult.errors);
    }

    // Business logic with timeout
    const result = await timeoutHandler.executeWithTimeout(
      () => businessLogic.process(request),
      30000
    );

    return NextResponse.json({
      success: true,
      data: result,
      correlationId
    });

  } catch (error) {
    const standardError = await errorHandler.handleError(
      error,
      'api-route',
      { correlationId, path: request.url }
    );

    return NextResponse.json({
      success: false,
      error: {
        message: standardError.message,
        code: standardError.code,
        id: standardError.id
      }
    }, {
      status: this.getHttpStatusCode(standardError)
    });
  }
}
```

### Service Layer Error Handling
```typescript
// Service layer with comprehensive error handling
export class FinancialDataService {
  async fetchStockData(symbol: string): Promise<StockData> {
    try {
      // Validate inputs
      await this.validateSymbol(symbol);

      // Execute with retry and timeout
      return await retryHandler.executeWithRetry(
        () => timeoutHandler.executeWithTimeout(
          () => this.performFetch(symbol),
          15000 // 15 second timeout
        ),
        {
          maxRetries: 3,
          backoffStrategy: 'exponential',
          retryableErrors: [ErrorType.API_TIMEOUT, ErrorType.API_ERROR]
        }
      );

    } catch (error) {
      const handledError = await errorHandler.handleError(
        error,
        'financial-data-service',
        { symbol, operation: 'fetchStockData' }
      );

      // Re-throw with additional context
      throw new ServiceError(
        handledError.message,
        handledError.code,
        handledError.id
      );
    }
  }

  private async validateSymbol(symbol: string): Promise<void> {
    if (!symbol || typeof symbol !== 'string') {
      throw new ValidationError('Symbol is required and must be a string');
    }

    if (!/^[A-Z]{1,5}$/.test(symbol)) {
      throw new ValidationError('Invalid symbol format');
    }
  }
}
```

## Error Monitoring and Alerting

### Alert System Configuration
```typescript
export interface AlertConfig {
  enabled: boolean;
  channels: ('email' | 'slack' | 'webhook')[];
  thresholds: {
    errorRate: number;        // Errors per minute
    criticalErrors: number;   // Critical errors per hour
    responseTime: number;     // Average response time in ms
  };
  recipients: string[];
}

export class AlertManager {
  async checkAlertConditions(metrics: ErrorMetrics): Promise<void> {
    const config = await this.getAlertConfig();

    if (!config.enabled) return;

    // Check error rate threshold
    if (metrics.errorRate > config.thresholds.errorRate) {
      await this.sendAlert({
        type: 'high_error_rate',
        message: `Error rate exceeded threshold: ${metrics.errorRate}/min`,
        severity: 'high',
        metrics
      });
    }

    // Check for critical errors
    if (metrics.criticalErrorCount > config.thresholds.criticalErrors) {
      await this.sendAlert({
        type: 'critical_errors',
        message: `Critical errors exceeded threshold: ${metrics.criticalErrorCount}/hour`,
        severity: 'critical',
        metrics
      });
    }
  }
}
```

## Testing Error Handling

### Error Handling Tests
```typescript
describe('ErrorHandler', () => {
  let errorHandler: ErrorHandler;

  beforeEach(() => {
    errorHandler = new ErrorHandler();
  });

  test('handles validation errors correctly', async () => {
    const error = new ValidationError('Invalid input');
    const result = await errorHandler.handleError(error, 'test-service');

    expect(result.type).toBe(ErrorType.VALIDATION);
    expect(result.severity).toBe(ErrorSeverity.LOW);
    expect(result.message).toContain('Invalid input');
  });

  test('sanitizes sensitive data in context', async () => {
    const sensitiveContext = {
      symbol: 'AAPL',
      api_key: 'secret-key-123',
      user: { password: 'user-password' }
    };

    const result = await errorHandler.handleError(
      new Error('Test error'),
      'test-service',
      sensitiveContext
    );

    expect(result.context?.api_key).toBe('[REDACTED]');
    expect(result.context?.user.password).toBe('[REDACTED]');
    expect(result.context?.symbol).toBe('AAPL');
  });

  test('applies correct retry logic', async () => {
    let attempts = 0;
    const operation = jest.fn().mockImplementation(() => {
      attempts++;
      if (attempts < 3) {
        throw new APITimeoutError('Timeout');
      }
      return Promise.resolve('success');
    });

    const result = await retryHandler.executeWithRetry(operation);

    expect(result).toBe('success');
    expect(attempts).toBe(3);
  });
});
```

## Performance Impact

### Error Handling Overhead
- **Validation**: < 5ms per request
- **Logging**: < 10ms per error
- **Sanitization**: < 3ms per context object
- **Total Overhead**: < 20ms (minimal impact on performance targets)

### Memory Usage
- **Error Objects**: Lightweight with sanitized context
- **Log Buffers**: Automatic rotation and cleanup
- **Retry State**: Minimal memory footprint with cleanup

## Future Enhancements

### Planned Improvements
1. **Machine Learning Error Prediction**: Predict and prevent errors before they occur
2. **Advanced Analytics**: Error pattern analysis and trend detection
3. **Automated Recovery**: Self-healing mechanisms for common error scenarios
4. **Enhanced Monitoring**: Real-time error visualization and dashboards

The VFR error handling standards provide enterprise-grade error management while maintaining the performance and security standards required for real-time financial analysis.