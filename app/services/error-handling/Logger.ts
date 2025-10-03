/**
 * Unified Logging Utility
 * Provides standardized logging patterns across all financial data services
 * Built on KISS principles with consistent formatting and log levels
 */

import SecurityValidator from "../security/SecurityValidator";

export enum LogLevel {
	ERROR = 0,
	WARN = 1,
	INFO = 2,
	DEBUG = 3,
	TRACE = 4,
}

export interface LogEntry {
	timestamp: string;
	level: LogLevel;
	service: string;
	message: string;
	requestId?: string;
	metadata?: any;
	stack?: string;
}

export interface LoggerConfig {
	level: LogLevel;
	includeTimestamp: boolean;
	includeMetadata: boolean;
	sanitizeData: boolean;
	maxMessageLength: number;
	outputFormat: "json" | "text";
}

export class Logger {
	private static instances: Map<string, Logger> = new Map();
	private config: LoggerConfig;
	private serviceName: string;

	private constructor(serviceName: string, config?: Partial<LoggerConfig>) {
		this.serviceName = serviceName;
		this.config = {
			level: process.env.NODE_ENV === "production" ? LogLevel.INFO : LogLevel.DEBUG,
			includeTimestamp: true,
			includeMetadata: true,
			sanitizeData: process.env.NODE_ENV === "production",
			maxMessageLength: 1000,
			outputFormat: process.env.NODE_ENV === "production" ? "json" : "text",
			...config,
		};
	}

	public static getInstance(serviceName: string, config?: Partial<LoggerConfig>): Logger {
		if (!Logger.instances.has(serviceName)) {
			Logger.instances.set(serviceName, new Logger(serviceName, config));
		}
		return Logger.instances.get(serviceName)!;
	}

	/**
	 * Log error message
	 */
	public error(message: string, metadata?: any, requestId?: string): void {
		this.log(LogLevel.ERROR, message, metadata, requestId);
	}

	/**
	 * Log warning message
	 */
	public warn(message: string, metadata?: any, requestId?: string): void {
		this.log(LogLevel.WARN, message, metadata, requestId);
	}

	/**
	 * Log info message
	 */
	public info(message: string, metadata?: any, requestId?: string): void {
		this.log(LogLevel.INFO, message, metadata, requestId);
	}

	/**
	 * Log debug message
	 */
	public debug(message: string, metadata?: any, requestId?: string): void {
		this.log(LogLevel.DEBUG, message, metadata, requestId);
	}

	/**
	 * Log trace message
	 */
	public trace(message: string, metadata?: any, requestId?: string): void {
		this.log(LogLevel.TRACE, message, metadata, requestId);
	}

	/**
	 * Log API request start
	 */
	public logApiRequest(method: string, url: string, requestId?: string, metadata?: any): void {
		this.info(
			`API Request: ${method} ${this.sanitizeUrl(url)}`,
			{
				type: "api_request",
				method,
				url: this.sanitizeUrl(url),
				...metadata,
			},
			requestId
		);
	}

	/**
	 * Log API response
	 */
	public logApiResponse(
		method: string,
		url: string,
		statusCode: number,
		responseTime: number,
		requestId?: string,
		metadata?: any
	): void {
		const level = statusCode >= 400 ? LogLevel.ERROR : LogLevel.INFO;
		this.log(
			level,
			`API Response: ${method} ${this.sanitizeUrl(url)} - ${statusCode} (${responseTime}ms)`,
			{
				type: "api_response",
				method,
				url: this.sanitizeUrl(url),
				statusCode,
				responseTime,
				...metadata,
			},
			requestId
		);
	}

	/**
	 * Log API error
	 */
	public logApiError(
		method: string,
		url: string,
		error: any,
		requestId?: string,
		metadata?: any
	): void {
		this.error(
			`API Error: ${method} ${this.sanitizeUrl(url)} - ${this.extractErrorMessage(error)}`,
			{
				type: "api_error",
				method,
				url: this.sanitizeUrl(url),
				error: this.sanitizeError(error),
				...metadata,
			},
			requestId
		);
	}

	/**
	 * Log rate limit event
	 */
	public logRateLimit(
		service: string,
		limit: number,
		current: number,
		resetTime?: number,
		requestId?: string
	): void {
		this.warn(
			`Rate limit reached: ${service} (${current}/${limit})`,
			{
				type: "rate_limit",
				service,
				limit,
				current,
				resetTime,
				resetTimeFormatted: resetTime ? new Date(resetTime).toISOString() : undefined,
			},
			requestId
		);
	}

	/**
	 * Log circuit breaker event
	 */
	public logCircuitBreaker(
		service: string,
		state: string,
		failures: number,
		requestId?: string
	): void {
		const level = state === "OPEN" ? LogLevel.ERROR : LogLevel.WARN;
		this.log(
			level,
			`Circuit breaker ${state}: ${service} (${failures} failures)`,
			{
				type: "circuit_breaker",
				service,
				state,
				failures,
			},
			requestId
		);
	}

	/**
	 * Log cache event
	 */
	public logCacheEvent(
		operation: "hit" | "miss" | "set" | "clear",
		key: string,
		requestId?: string,
		metadata?: any
	): void {
		this.debug(
			`Cache ${operation}: ${this.sanitizeKey(key)}`,
			{
				type: "cache_event",
				operation,
				key: this.sanitizeKey(key),
				...metadata,
			},
			requestId
		);
	}

	/**
	 * Log performance metrics
	 */
	public logPerformance(
		operation: string,
		duration: number,
		requestId?: string,
		metadata?: any
	): void {
		const level = duration > 10000 ? LogLevel.WARN : LogLevel.DEBUG; // Warn if over 10 seconds
		this.log(
			level,
			`Performance: ${operation} completed in ${duration}ms`,
			{
				type: "performance",
				operation,
				duration,
				...metadata,
			},
			requestId
		);
	}

	/**
	 * Log data quality issue
	 */
	public logDataQuality(
		issue: string,
		severity: "low" | "medium" | "high",
		symbol?: string,
		requestId?: string,
		metadata?: any
	): void {
		const level =
			severity === "high"
				? LogLevel.ERROR
				: severity === "medium"
					? LogLevel.WARN
					: LogLevel.INFO;
		this.log(
			level,
			`Data Quality ${severity}: ${issue}${symbol ? ` (${symbol})` : ""}`,
			{
				type: "data_quality",
				issue,
				severity,
				symbol,
				...metadata,
			},
			requestId
		);
	}

	/**
	 * Log security event
	 */
	public logSecurity(
		event: string,
		severity: "low" | "medium" | "high" | "critical",
		requestId?: string,
		metadata?: any
	): void {
		const level = ["high", "critical"].includes(severity) ? LogLevel.ERROR : LogLevel.WARN;
		this.log(
			level,
			`Security ${severity}: ${event}`,
			{
				type: "security",
				event,
				severity,
				...metadata,
			},
			requestId
		);
	}

	/**
	 * Create structured log entry
	 */
	public createLogEntry(
		level: LogLevel,
		message: string,
		metadata?: any,
		requestId?: string,
		stack?: string
	): LogEntry {
		return {
			timestamp: new Date().toISOString(),
			level,
			service: this.serviceName,
			message: this.truncateMessage(message),
			requestId,
			metadata: this.config.includeMetadata ? this.sanitizeMetadata(metadata) : undefined,
			stack: this.config.level >= LogLevel.DEBUG ? stack : undefined,
		};
	}

	/**
	 * Update logger configuration
	 */
	public updateConfig(newConfig: Partial<LoggerConfig>): void {
		this.config = { ...this.config, ...newConfig };
	}

	/**
	 * Get current configuration
	 */
	public getConfig(): LoggerConfig {
		return { ...this.config };
	}

	/**
	 * Check if log level is enabled
	 */
	public isLevelEnabled(level: LogLevel): boolean {
		return level <= this.config.level;
	}

	// Private helper methods

	private log(level: LogLevel, message: string, metadata?: any, requestId?: string): void {
		if (!this.isLevelEnabled(level)) {
			return;
		}

		const logEntry = this.createLogEntry(level, message, metadata, requestId);
		this.output(logEntry);
	}

	private output(entry: LogEntry): void {
		const formatted =
			this.config.outputFormat === "json"
				? this.formatAsJson(entry)
				: this.formatAsText(entry);

		// Route to appropriate console method based on level
		switch (entry.level) {
			case LogLevel.ERROR:
				console.error(formatted);
				break;
			case LogLevel.WARN:
				console.warn(formatted);
				break;
			case LogLevel.INFO:
				console.info(formatted);
				break;
			case LogLevel.DEBUG:
			case LogLevel.TRACE:
				console.log(formatted);
				break;
		}
	}

	private formatAsJson(entry: LogEntry): string {
		const cleanEntry = { ...entry };

		// Remove undefined properties
		Object.keys(cleanEntry).forEach(key => {
			if (cleanEntry[key as keyof LogEntry] === undefined) {
				delete cleanEntry[key as keyof LogEntry];
			}
		});

		return JSON.stringify(cleanEntry);
	}

	private formatAsText(entry: LogEntry): string {
		const levelName = LogLevel[entry.level];
		const timestamp = this.config.includeTimestamp ? `[${entry.timestamp}] ` : "";
		const requestId = entry.requestId ? `[${entry.requestId}] ` : "";

		let formatted = `${timestamp}${levelName} [${entry.service}] ${requestId}${entry.message}`;

		if (entry.metadata && this.config.includeMetadata) {
			try {
				const metadataStr = JSON.stringify(entry.metadata, null, 2);
				formatted += `\nMetadata: ${metadataStr}`;
			} catch {
				formatted += "\nMetadata: [Complex object]";
			}
		}

		if (entry.stack && this.config.level >= LogLevel.DEBUG) {
			formatted += `\nStack: ${entry.stack}`;
		}

		return formatted;
	}

	private sanitizeUrl(url: string): string {
		if (!this.config.sanitizeData) {
			return url;
		}

		// Remove API keys and sensitive parameters from URLs
		return url
			.replace(/([?&])(api[_-]?key|token|password|secret)=[^&]*/gi, "$1$2=***")
			.replace(/\/\/[^@]*@/g, "//***@"); // Remove auth from URLs
	}

	private sanitizeKey(key: string): string {
		if (!this.config.sanitizeData) {
			return key;
		}

		// Remove sensitive parts from cache keys
		return key.replace(/[a-f0-9]{32,}/gi, "***"); // Remove hash-like strings
	}

	private sanitizeError(error: any): any {
		if (!this.config.sanitizeData) {
			return error;
		}

		if (error instanceof Error) {
			return {
				name: error.name,
				message: this.sanitizeMessage(error.message),
				stack: this.config.level >= LogLevel.DEBUG ? error.stack : undefined,
			};
		}

		if (typeof error === "string") {
			return this.sanitizeMessage(error);
		}

		if (error && typeof error === "object") {
			const sanitized: any = {};
			for (const [key, value] of Object.entries(error)) {
				if (typeof value === "string") {
					sanitized[key] = this.sanitizeMessage(value);
				} else if (typeof value === "number" || typeof value === "boolean") {
					sanitized[key] = value;
				} else {
					sanitized[key] = "[Object]";
				}
			}
			return sanitized;
		}

		return error;
	}

	private sanitizeMessage(message: string): string {
		if (!this.config.sanitizeData) {
			return message;
		}

		// Use SecurityValidator's comprehensive sanitization
		return SecurityValidator.sanitizeErrorMessage(message, true);
	}

	private sanitizeMetadata(metadata: any): any {
		if (!metadata || !this.config.sanitizeData) {
			return metadata;
		}

		if (typeof metadata === "string") {
			return this.sanitizeMessage(metadata);
		}

		if (Array.isArray(metadata)) {
			return metadata.map(item => this.sanitizeMetadata(item));
		}

		if (typeof metadata === "object") {
			const sanitized: any = {};
			for (const [key, value] of Object.entries(metadata)) {
				// Skip sensitive keys entirely in production
				if (["password", "secret", "token", "apiKey", "api_key"].includes(key)) {
					sanitized[key] = "***";
				} else {
					sanitized[key] = this.sanitizeMetadata(value);
				}
			}
			return sanitized;
		}

		return metadata;
	}

	private extractErrorMessage(error: any): string {
		if (error instanceof Error) {
			return error.message;
		}
		if (typeof error === "string") {
			return error;
		}
		if (error && typeof error === "object" && error.message) {
			return error.message;
		}
		return "Unknown error";
	}

	private truncateMessage(message: string): string {
		if (message.length <= this.config.maxMessageLength) {
			return message;
		}
		return message.substring(0, this.config.maxMessageLength - 3) + "...";
	}
}

// Factory functions for common logger types
export const createServiceLogger = (
	serviceName: string,
	config?: Partial<LoggerConfig>
): Logger => {
	return Logger.getInstance(serviceName, config);
};

export const createApiLogger = (apiName: string): Logger => {
	return Logger.getInstance(`api.${apiName}`, {
		level: LogLevel.INFO,
		includeMetadata: true,
	});
};

export const createSecurityLogger = (): Logger => {
	return Logger.getInstance("security", {
		level: LogLevel.WARN,
		includeMetadata: true,
		sanitizeData: true,
	});
};

// Export log level constants
export const LOG_LEVELS = {
	ERROR: LogLevel.ERROR,
	WARN: LogLevel.WARN,
	INFO: LogLevel.INFO,
	DEBUG: LogLevel.DEBUG,
	TRACE: LogLevel.TRACE,
} as const;
