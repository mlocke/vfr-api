/**
 * Centralized Error Handler Service
 * Provides standardized error handling patterns across all financial data services
 * Built on KISS principles with consistent error types and response formats
 */

import SecurityValidator from "../security/SecurityValidator";

// Standardized error types for financial APIs
export enum ErrorType {
	VALIDATION_ERROR = "VALIDATION_ERROR",
	RATE_LIMIT_ERROR = "RATE_LIMIT_ERROR",
	TIMEOUT_ERROR = "TIMEOUT_ERROR",
	NETWORK_ERROR = "NETWORK_ERROR",
	API_ERROR = "API_ERROR",
	AUTHENTICATION_ERROR = "AUTHENTICATION_ERROR",
	DATA_QUALITY_ERROR = "DATA_QUALITY_ERROR",
	CIRCUIT_BREAKER_ERROR = "CIRCUIT_BREAKER_ERROR",
	CONFIGURATION_ERROR = "CONFIGURATION_ERROR",
	INTERNAL_ERROR = "INTERNAL_ERROR",
}

// Error severity levels
export enum ErrorSeverity {
	LOW = "LOW",
	MEDIUM = "MEDIUM",
	HIGH = "HIGH",
	CRITICAL = "CRITICAL",
}

// Standardized error codes
export enum ErrorCode {
	// Validation errors (1000-1099)
	INVALID_SYMBOL = 1000,
	INVALID_BATCH_SIZE = 1001,
	INVALID_PARAMETERS = 1002,
	MISSING_REQUIRED_FIELD = 1003,

	// Rate limiting errors (1100-1199)
	RATE_LIMIT_EXCEEDED = 1100,
	DAILY_LIMIT_EXCEEDED = 1101,
	CIRCUIT_BREAKER_OPEN = 1102,

	// Network/API errors (1200-1299)
	CONNECTION_TIMEOUT = 1200,
	REQUEST_TIMEOUT = 1201,
	NETWORK_UNAVAILABLE = 1202,
	API_UNAVAILABLE = 1203,
	HTTP_ERROR = 1204,

	// Authentication errors (1300-1399)
	MISSING_API_KEY = 1300,
	INVALID_API_KEY = 1301,
	AUTHENTICATION_FAILED = 1302,
	AUTHORIZATION_FAILED = 1303,

	// Data quality errors (1400-1499)
	INCOMPLETE_DATA = 1400,
	INVALID_DATA_FORMAT = 1401,
	DATA_CORRUPTION = 1402,
	STALE_DATA = 1403,

	// Internal errors (1500-1599)
	CONFIGURATION_ERROR = 1500,
	SERVICE_UNAVAILABLE = 1501,
	INTERNAL_SERVER_ERROR = 1502,
}

// Standardized error response interface
export interface ErrorResponse {
	success: false;
	error: {
		type: ErrorType;
		code: ErrorCode;
		message: string;
		severity: ErrorSeverity;
		timestamp: number;
		requestId?: string;
		source: string;
		retryable: boolean;
		retryAfter?: number;
		metadata?: any;
	};
}

// Configuration for error handling behavior
export interface ErrorHandlerConfig {
	sanitizeErrors: boolean;
	includeStackTrace: boolean;
	logErrors: boolean;
	enableCircuitBreaker: boolean;
	enableRateLimiting: boolean;
}

export class ErrorHandler {
	private static instance: ErrorHandler;
	private config: ErrorHandlerConfig;
	private errorCounts: Map<string, number> = new Map();

	private constructor(config?: Partial<ErrorHandlerConfig>) {
		this.config = {
			sanitizeErrors: process.env.NODE_ENV === "production",
			includeStackTrace: process.env.NODE_ENV !== "production",
			logErrors: true,
			enableCircuitBreaker: true,
			enableRateLimiting: true,
			...config,
		};
	}

	public static getInstance(config?: Partial<ErrorHandlerConfig>): ErrorHandler {
		if (!ErrorHandler.instance) {
			ErrorHandler.instance = new ErrorHandler(config);
		}
		return ErrorHandler.instance;
	}

	/**
	 * Create standardized error response
	 */
	public createErrorResponse(
		error: any,
		source: string,
		requestId?: string,
		type?: ErrorType,
		code?: ErrorCode
	): ErrorResponse {
		const errorType = type || this.classifyError(error);
		const errorCode = code || this.getErrorCode(error, errorType);
		const severity = this.determineSeverity(errorType, errorCode);

		let message = this.extractErrorMessage(error);

		// Always sanitize messages for security - this is critical for preventing information disclosure
		message = SecurityValidator.sanitizeErrorMessage(message, true);

		const errorResponse: ErrorResponse = {
			success: false,
			error: {
				type: errorType,
				code: errorCode,
				message,
				severity,
				timestamp: Date.now(),
				requestId,
				source,
				retryable: this.isRetryable(errorType, errorCode),
				retryAfter: this.getRetryAfter(errorType, errorCode),
				metadata: this.extractErrorMetadata(error, errorType),
			},
		};

		// Log error if configured
		if (this.config.logErrors) {
			this.logError(errorResponse, error);
		}

		// Track error for circuit breaker
		if (this.config.enableCircuitBreaker && source) {
			this.trackError(source, errorType);
		}

		return errorResponse;
	}

	/**
	 * Handle async operation with standardized error handling
	 */
	public async handleAsync<T>(
		operation: () => Promise<T>,
		source: string,
		requestId?: string,
		options?: {
			timeout?: number;
			retries?: number;
			retryDelay?: number;
		}
	): Promise<T | ErrorResponse> {
		const maxRetries = options?.retries || 0;
		const retryDelay = options?.retryDelay || 1000;
		let lastError: any;

		for (let attempt = 0; attempt <= maxRetries; attempt++) {
			try {
				// Apply timeout if specified
				if (options?.timeout) {
					return await this.withTimeout(operation(), options.timeout);
				}

				return await operation();
			} catch (error) {
				lastError = error;

				const errorResponse = this.createErrorResponse(error, source, requestId);

				// Don't retry if not retryable or on last attempt
				if (!errorResponse.error.retryable || attempt === maxRetries) {
					return errorResponse;
				}

				// Wait before retry
				if (attempt < maxRetries) {
					await this.delay(retryDelay * Math.pow(2, attempt)); // Exponential backoff
				}
			}
		}

		return this.createErrorResponse(lastError, source, requestId);
	}

	/**
	 * Validate operation before execution with circuit breaker check
	 */
	public async validateOperation(
		serviceId: string,
		symbols?: string[]
	): Promise<ErrorResponse | null> {
		// Symbol validation if provided
		if (symbols) {
			if (symbols.length === 1) {
				const validation = SecurityValidator.validateSymbol(symbols[0]);
				if (!validation.isValid) {
					return this.createErrorResponse(
						new Error(`Invalid symbol: ${validation.errors.join(", ")}`),
						serviceId,
						undefined,
						ErrorType.VALIDATION_ERROR,
						ErrorCode.INVALID_SYMBOL
					);
				}
			} else {
				const batchValidation = SecurityValidator.validateSymbolBatch(symbols, 50);
				if (!batchValidation.isValid) {
					return this.createErrorResponse(
						new Error(`Invalid symbol batch: ${batchValidation.errors.join(", ")}`),
						serviceId,
						undefined,
						ErrorType.VALIDATION_ERROR,
						ErrorCode.INVALID_BATCH_SIZE
					);
				}
			}
		}

		// Rate limiting check if enabled
		if (this.config.enableRateLimiting) {
			const rateLimitCheck = SecurityValidator.checkRateLimit(serviceId);
			if (!rateLimitCheck.allowed) {
				return this.createErrorResponse(
					new Error("Rate limit exceeded"),
					serviceId,
					undefined,
					ErrorType.RATE_LIMIT_ERROR,
					ErrorCode.RATE_LIMIT_EXCEEDED
				);
			}
		}

		// Circuit breaker check if enabled
		if (this.config.enableCircuitBreaker) {
			const circuitCheck = SecurityValidator.checkCircuitBreaker(serviceId);
			if (!circuitCheck.allowed) {
				return this.createErrorResponse(
					new Error(`Service temporarily unavailable: ${circuitCheck.state}`),
					serviceId,
					undefined,
					ErrorType.CIRCUIT_BREAKER_ERROR,
					ErrorCode.CIRCUIT_BREAKER_OPEN
				);
			}
		}

		return null; // No validation errors
	}

	/**
	 * Record successful operation for circuit breaker
	 */
	public recordSuccess(serviceId: string): void {
		if (this.config.enableCircuitBreaker) {
			SecurityValidator.recordSuccess(serviceId);
		}
	}

	/**
	 * Record failed operation for circuit breaker
	 */
	public recordFailure(serviceId: string): void {
		if (this.config.enableCircuitBreaker) {
			SecurityValidator.recordFailure(serviceId);
		}
	}

	/**
	 * Check if an error response indicates a temporary failure
	 */
	public isTemporaryFailure(error: ErrorResponse): boolean {
		const temporaryTypes = [
			ErrorType.RATE_LIMIT_ERROR,
			ErrorType.TIMEOUT_ERROR,
			ErrorType.NETWORK_ERROR,
			ErrorType.CIRCUIT_BREAKER_ERROR,
		];

		return temporaryTypes.includes(error.error.type) && error.error.retryable;
	}

	/**
	 * Get service statistics for monitoring
	 */
	public getErrorStats(): {
		errorCounts: Record<string, number>;
		circuitBreakerStatus: any;
		rateLimitStatus: any;
	} {
		const errorCounts: Record<string, number> = {};
		this.errorCounts.forEach((count, service) => {
			errorCounts[service] = count;
		});

		return {
			errorCounts,
			circuitBreakerStatus: SecurityValidator.getSecurityStatus().circuitBreakers,
			rateLimitStatus: SecurityValidator.getSecurityStatus().rateLimits,
		};
	}

	/**
	 * Reset error tracking (for testing/maintenance)
	 */
	public resetErrorTracking(): void {
		this.errorCounts.clear();
		SecurityValidator.resetSecurityState();
	}

	// Private helper methods

	private classifyError(error: any): ErrorType {
		if (!error) return ErrorType.INTERNAL_ERROR;

		const message = this.extractErrorMessage(error).toLowerCase();

		// Network/timeout errors
		if (message.includes("timeout") || message.includes("etimedout")) {
			return ErrorType.TIMEOUT_ERROR;
		}
		if (
			message.includes("network") ||
			message.includes("econnrefused") ||
			message.includes("enotfound")
		) {
			return ErrorType.NETWORK_ERROR;
		}

		// API/HTTP errors
		if (message.includes("rate limit") || message.includes("429")) {
			return ErrorType.RATE_LIMIT_ERROR;
		}
		if (message.includes("unauthorized") || message.includes("401")) {
			return ErrorType.AUTHENTICATION_ERROR;
		}
		if (message.includes("forbidden") || message.includes("403")) {
			return ErrorType.AUTHENTICATION_ERROR;
		}
		if (message.includes("api key") || message.includes("authentication")) {
			return ErrorType.AUTHENTICATION_ERROR;
		}

		// Validation errors
		if (message.includes("invalid") || message.includes("validation")) {
			return ErrorType.VALIDATION_ERROR;
		}

		// Configuration errors
		if (message.includes("not configured") || message.includes("missing")) {
			return ErrorType.CONFIGURATION_ERROR;
		}

		// Data quality errors
		if (
			message.includes("data") &&
			(message.includes("corrupt") || message.includes("incomplete"))
		) {
			return ErrorType.DATA_QUALITY_ERROR;
		}

		// Circuit breaker errors
		if (message.includes("circuit breaker") || message.includes("service unavailable")) {
			return ErrorType.CIRCUIT_BREAKER_ERROR;
		}

		// Default to API error for HTTP errors
		if (error.status || error.statusCode || message.includes("http")) {
			return ErrorType.API_ERROR;
		}

		return ErrorType.INTERNAL_ERROR;
	}

	private getErrorCode(error: any, type: ErrorType): ErrorCode {
		const message = this.extractErrorMessage(error).toLowerCase();

		switch (type) {
			case ErrorType.VALIDATION_ERROR:
				if (message.includes("symbol")) return ErrorCode.INVALID_SYMBOL;
				if (message.includes("batch")) return ErrorCode.INVALID_BATCH_SIZE;
				if (message.includes("required")) return ErrorCode.MISSING_REQUIRED_FIELD;
				return ErrorCode.INVALID_PARAMETERS;

			case ErrorType.RATE_LIMIT_ERROR:
				if (message.includes("daily")) return ErrorCode.DAILY_LIMIT_EXCEEDED;
				return ErrorCode.RATE_LIMIT_EXCEEDED;

			case ErrorType.CIRCUIT_BREAKER_ERROR:
				return ErrorCode.CIRCUIT_BREAKER_OPEN;

			case ErrorType.TIMEOUT_ERROR:
				if (message.includes("connection")) return ErrorCode.CONNECTION_TIMEOUT;
				return ErrorCode.REQUEST_TIMEOUT;

			case ErrorType.NETWORK_ERROR:
				if (message.includes("unavailable")) return ErrorCode.API_UNAVAILABLE;
				return ErrorCode.NETWORK_UNAVAILABLE;

			case ErrorType.AUTHENTICATION_ERROR:
				if (message.includes("missing") || message.includes("not configured"))
					return ErrorCode.MISSING_API_KEY;
				if (message.includes("invalid") || message.includes("unauthorized"))
					return ErrorCode.INVALID_API_KEY;
				return ErrorCode.AUTHENTICATION_FAILED;

			case ErrorType.DATA_QUALITY_ERROR:
				if (message.includes("incomplete")) return ErrorCode.INCOMPLETE_DATA;
				if (message.includes("format")) return ErrorCode.INVALID_DATA_FORMAT;
				return ErrorCode.DATA_CORRUPTION;

			case ErrorType.CONFIGURATION_ERROR:
				return ErrorCode.CONFIGURATION_ERROR;

			case ErrorType.API_ERROR:
				return ErrorCode.HTTP_ERROR;

			default:
				return ErrorCode.INTERNAL_SERVER_ERROR;
		}
	}

	private determineSeverity(type: ErrorType, code: ErrorCode): ErrorSeverity {
		// Critical errors
		if (type === ErrorType.AUTHENTICATION_ERROR || type === ErrorType.CONFIGURATION_ERROR) {
			return ErrorSeverity.CRITICAL;
		}

		// High severity errors
		if (type === ErrorType.CIRCUIT_BREAKER_ERROR || type === ErrorType.DATA_QUALITY_ERROR) {
			return ErrorSeverity.HIGH;
		}

		// Medium severity errors
		if (type === ErrorType.RATE_LIMIT_ERROR || type === ErrorType.API_ERROR) {
			return ErrorSeverity.MEDIUM;
		}

		// Low severity errors (timeout, network issues, validation)
		return ErrorSeverity.LOW;
	}

	private isRetryable(type: ErrorType, code: ErrorCode): boolean {
		const retryableTypes = [
			ErrorType.TIMEOUT_ERROR,
			ErrorType.NETWORK_ERROR,
			ErrorType.RATE_LIMIT_ERROR,
			ErrorType.API_ERROR,
		];

		const nonRetryableCodes = [
			ErrorCode.INVALID_SYMBOL,
			ErrorCode.INVALID_PARAMETERS,
			ErrorCode.MISSING_REQUIRED_FIELD,
			ErrorCode.MISSING_API_KEY,
			ErrorCode.INVALID_API_KEY,
			ErrorCode.AUTHORIZATION_FAILED,
		];

		return retryableTypes.includes(type) && !nonRetryableCodes.includes(code);
	}

	private getRetryAfter(type: ErrorType, code: ErrorCode): number | undefined {
		switch (type) {
			case ErrorType.RATE_LIMIT_ERROR:
				return code === ErrorCode.DAILY_LIMIT_EXCEEDED ? 86400 : 60; // 24 hours or 1 minute
			case ErrorType.CIRCUIT_BREAKER_ERROR:
				return 300; // 5 minutes
			case ErrorType.TIMEOUT_ERROR:
				return 30; // 30 seconds
			case ErrorType.NETWORK_ERROR:
				return 60; // 1 minute
			default:
				return undefined;
		}
	}

	/**
	 * Type-safe error type narrowing utility
	 */
	public static normalizeError(error: unknown): {
		message: string;
		stack?: string;
		code?: string | number;
		status?: number;
		isError: boolean;
	} {
		if (error instanceof Error) {
			return {
				message: error.message,
				stack: error.stack,
				code: (error as any).code,
				status: (error as any).status || (error as any).statusCode,
				isError: true,
			};
		}

		if (typeof error === "string") {
			return {
				message: error,
				isError: false,
			};
		}

		if (error && typeof error === "object") {
			const errorObj = error as any;
			return {
				message:
					errorObj.message || errorObj.error || errorObj.statusText || "Unknown error",
				stack: errorObj.stack,
				code: errorObj.code,
				status: errorObj.status || errorObj.statusCode,
				isError: false,
			};
		}

		return {
			message: "Unknown error occurred",
			isError: false,
		};
	}

	private extractErrorMessage(error: any): string {
		return ErrorHandler.normalizeError(error).message;
	}

	private extractErrorMetadata(error: any, type: ErrorType): any {
		const metadata: any = {};

		if (error instanceof Error && this.config.includeStackTrace) {
			// Always sanitize stack trace to prevent information disclosure
			metadata.stack = SecurityValidator.sanitizeErrorMessage(error.stack || "", true);
		}

		if (error && typeof error === "object") {
			if (error.status || error.statusCode) {
				metadata.httpStatus = error.status || error.statusCode;
			}
			if (error.headers) {
				metadata.headers = error.headers;
			}
			if (error.response) {
				// Always sanitize response data if it contains sensitive information
				metadata.response = error.response
					? SecurityValidator.sanitizeErrorMessage(JSON.stringify(error.response), true)
					: error.response;
			}
		}

		return Object.keys(metadata).length > 0 ? metadata : undefined;
	}

	private logError(errorResponse: ErrorResponse, originalError: any): void {
		const logLevel = this.getLogLevel(errorResponse.error.severity);
		const logMessage = `[${errorResponse.error.source}] ${errorResponse.error.type}: ${errorResponse.error.message}`;

		// Use console for now - could be replaced with proper logging library
		switch (logLevel) {
			case "error":
				console.error(logMessage, {
					code: errorResponse.error.code,
					severity: errorResponse.error.severity,
					timestamp: errorResponse.error.timestamp,
					requestId: errorResponse.error.requestId,
					metadata: errorResponse.error.metadata,
				});
				break;
			case "warn":
				console.warn(logMessage);
				break;
			case "info":
				console.info(logMessage);
				break;
			default:
				console.log(logMessage);
		}
	}

	private getLogLevel(severity: ErrorSeverity): string {
		switch (severity) {
			case ErrorSeverity.CRITICAL:
			case ErrorSeverity.HIGH:
				return "error";
			case ErrorSeverity.MEDIUM:
				return "warn";
			case ErrorSeverity.LOW:
				return "info";
			default:
				return "log";
		}
	}

	private trackError(source: string, type: ErrorType): void {
		const key = `${source}:${type}`;
		const current = this.errorCounts.get(key) || 0;
		this.errorCounts.set(key, current + 1);
	}

	private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
		const timeoutPromise = new Promise<never>((_, reject) => {
			setTimeout(
				() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)),
				timeoutMs
			);
		});

		return Promise.race([promise, timeoutPromise]);
	}

	private delay(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}
}

// Export class and getInstance method
export default ErrorHandler;
