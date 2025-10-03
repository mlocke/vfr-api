/**
 * Configuration management for Stock Selection Service
 * Provides flexible configuration with environment-based overrides
 */

import { SelectionServiceConfig, SelectionMode } from "../types";

/**
 * Default configuration for the stock selection service
 */
export const DEFAULT_CONFIG: SelectionServiceConfig = {
	// Algorithm settings
	defaultAlgorithmId: "composite",
	fallbackAlgorithmId: "quality",

	// Data source configuration with priorities and weights
	dataSources: {
		polygon: {
			priority: 1,
			weight: 0.4,
			timeout: 5000,
		},
		firecrawl: {
			priority: 2,
			weight: 0.3,
			timeout: 8000,
		},
		github: {
			priority: 3,
			weight: 0.2,
			timeout: 10000,
		},
		context7: {
			priority: 4,
			weight: 0.1,
			timeout: 15000,
		},
	},

	// Cache configuration
	cache: {
		enabled: true,
		ttl: {
			singleStock: 5 * 60 * 1000, // 5 minutes
			sectorAnalysis: 15 * 60 * 1000, // 15 minutes
			multiStock: 10 * 60 * 1000, // 10 minutes
		},
		keyStrategy: "detailed",
	},

	// Performance and safety limits
	limits: {
		maxSymbolsPerRequest: 50,
		maxConcurrentRequests: 10,
		defaultTimeout: 30000, // 30 seconds
		maxTimeout: 120000, // 2 minutes
	},

	// Data quality thresholds
	quality: {
		minDataQuality: 0.7,
		minSourceAgreement: 0.6,
		maxDataAge: 10 * 60 * 1000, // 10 minutes
	},
};

/**
 * Environment-specific configuration overrides
 */
const ENVIRONMENT_CONFIGS: { [env: string]: Partial<SelectionServiceConfig> } = {
	development: {
		cache: {
			enabled: true,
			ttl: {
				singleStock: 2 * 60 * 1000, // 2 minutes for faster development
				sectorAnalysis: 5 * 60 * 1000, // 5 minutes
				multiStock: 3 * 60 * 1000, // 3 minutes
			},
			keyStrategy: "simple",
		},
		limits: {
			maxSymbolsPerRequest: 20, // Lower limits for dev
			maxConcurrentRequests: 5,
			defaultTimeout: 15000,
			maxTimeout: 60000,
		},
		quality: {
			minDataQuality: 0.5, // More lenient for testing
			minSourceAgreement: 0.4,
			maxDataAge: 30 * 60 * 1000, // 30 minutes
		},
	},

	testing: {
		cache: {
			enabled: false, // Disable cache for consistent testing
			ttl: {
				singleStock: 0,
				sectorAnalysis: 0,
				multiStock: 0,
			},
			keyStrategy: "simple",
		},
		limits: {
			maxSymbolsPerRequest: 10,
			maxConcurrentRequests: 3,
			defaultTimeout: 5000,
			maxTimeout: 10000,
		},
	},

	production: {
		cache: {
			enabled: true,
			ttl: {
				singleStock: 10 * 60 * 1000, // 10 minutes
				sectorAnalysis: 30 * 60 * 1000, // 30 minutes
				multiStock: 20 * 60 * 1000, // 20 minutes
			},
			keyStrategy: "detailed",
		},
		limits: {
			maxSymbolsPerRequest: 100,
			maxConcurrentRequests: 20,
			defaultTimeout: 45000,
			maxTimeout: 180000, // 3 minutes
		},
		quality: {
			minDataQuality: 0.8, // Higher quality requirements
			minSourceAgreement: 0.7,
			maxDataAge: 5 * 60 * 1000, // 5 minutes
		},
	},
};

/**
 * Configuration manager class
 */
export class SelectionConfigManager {
	private config: SelectionServiceConfig;
	private environment: string;
	private customOverrides: Partial<SelectionServiceConfig> = {};

	constructor(environment?: string) {
		this.environment = environment || process.env.NODE_ENV || "development";
		this.config = this.buildConfiguration();
	}

	/**
	 * Build final configuration from base + environment + custom overrides
	 */
	private buildConfiguration(): SelectionServiceConfig {
		const envConfig = ENVIRONMENT_CONFIGS[this.environment] || {};

		return this.deepMerge(
			DEFAULT_CONFIG,
			envConfig,
			this.customOverrides
		) as SelectionServiceConfig;
	}

	/**
	 * Deep merge multiple configuration objects
	 */
	private deepMerge(...objects: any[]): any {
		return objects.reduce((prev, obj) => {
			Object.keys(obj).forEach(key => {
				const pVal = prev[key];
				const oVal = obj[key];

				if (Array.isArray(pVal) && Array.isArray(oVal)) {
					prev[key] = pVal.concat(...oVal);
				} else if (pVal && oVal && typeof pVal === "object" && typeof oVal === "object") {
					prev[key] = this.deepMerge(pVal, oVal);
				} else {
					prev[key] = oVal;
				}
			});

			return prev;
		}, {});
	}

	/**
	 * Get current configuration
	 */
	getConfig(): SelectionServiceConfig {
		return { ...this.config };
	}

	/**
	 * Get specific configuration section
	 */
	getCacheConfig() {
		return { ...this.config.cache };
	}

	getLimitsConfig() {
		return { ...this.config.limits };
	}

	getQualityConfig() {
		return { ...this.config.quality };
	}

	getDataSourceConfig(source?: string) {
		if (source) {
			return this.config.dataSources[source] || null;
		}
		return { ...this.config.dataSources };
	}

	/**
	 * Update configuration with custom overrides
	 */
	updateConfig(overrides: Partial<SelectionServiceConfig>): void {
		this.customOverrides = this.deepMerge(this.customOverrides, overrides);
		this.config = this.buildConfiguration();
	}

	/**
	 * Get cache TTL for specific selection mode
	 */
	getCacheTTL(mode: SelectionMode): number {
		switch (mode) {
			case SelectionMode.SINGLE_STOCK:
				return this.config.cache.ttl.singleStock;
			case SelectionMode.SECTOR_ANALYSIS:
			case SelectionMode.INDEX_ANALYSIS:
			case SelectionMode.ETF_ANALYSIS:
				return this.config.cache.ttl.sectorAnalysis;
			case SelectionMode.MULTIPLE_STOCKS:
				return this.config.cache.ttl.multiStock;
			default:
				return this.config.cache.ttl.singleStock;
		}
	}

	/**
	 * Generate cache key based on strategy
	 */
	generateCacheKey(baseKey: string, additionalData?: any): string {
		if (this.config.cache.keyStrategy === "simple") {
			return baseKey;
		}

		// Detailed strategy includes more context for cache discrimination
		const timestamp = Math.floor(Date.now() / (5 * 60 * 1000)); // 5-minute windows
		const envPrefix = this.environment === "production" ? "prod" : "dev";

		let detailedKey = `${envPrefix}:${baseKey}:${timestamp}`;

		if (additionalData) {
			// Add hash of additional data for cache discrimination
			const dataHash = this.simpleHash(JSON.stringify(additionalData));
			detailedKey += `:${dataHash}`;
		}

		return detailedKey;
	}

	/**
	 * Simple hash function for cache keys
	 */
	private simpleHash(str: string): string {
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			const char = str.charCodeAt(i);
			hash = (hash << 5) - hash + char;
			hash = hash & hash; // Convert to 32-bit integer
		}
		return Math.abs(hash).toString(36);
	}

	/**
	 * Validate configuration
	 */
	validateConfig(): { isValid: boolean; errors: string[] } {
		const errors: string[] = [];

		// Validate algorithm IDs
		if (!this.config.defaultAlgorithmId) {
			errors.push("Default algorithm ID is required");
		}
		if (!this.config.fallbackAlgorithmId) {
			errors.push("Fallback algorithm ID is required");
		}

		// Validate data sources
		if (!this.config.dataSources || Object.keys(this.config.dataSources).length === 0) {
			errors.push("At least one data source must be configured");
		}

		for (const [source, config] of Object.entries(this.config.dataSources)) {
			if (config.priority < 1) {
				errors.push(`Data source ${source} priority must be >= 1`);
			}
			if (config.weight < 0 || config.weight > 1) {
				errors.push(`Data source ${source} weight must be between 0 and 1`);
			}
			if (config.timeout < 1000) {
				errors.push(`Data source ${source} timeout must be >= 1000ms`);
			}
		}

		// Validate limits
		if (this.config.limits.maxSymbolsPerRequest < 1) {
			errors.push("Max symbols per request must be >= 1");
		}
		if (this.config.limits.maxConcurrentRequests < 1) {
			errors.push("Max concurrent requests must be >= 1");
		}
		if (this.config.limits.defaultTimeout < 1000) {
			errors.push("Default timeout must be >= 1000ms");
		}
		if (this.config.limits.maxTimeout < this.config.limits.defaultTimeout) {
			errors.push("Max timeout must be >= default timeout");
		}

		// Validate quality thresholds
		if (this.config.quality.minDataQuality < 0 || this.config.quality.minDataQuality > 1) {
			errors.push("Min data quality must be between 0 and 1");
		}
		if (
			this.config.quality.minSourceAgreement < 0 ||
			this.config.quality.minSourceAgreement > 1
		) {
			errors.push("Min source agreement must be between 0 and 1");
		}
		if (this.config.quality.maxDataAge < 0) {
			errors.push("Max data age must be >= 0");
		}

		return {
			isValid: errors.length === 0,
			errors,
		};
	}

	/**
	 * Get configuration for logging/debugging
	 */
	getConfigSummary() {
		return {
			environment: this.environment,
			defaultAlgorithm: this.config.defaultAlgorithmId,
			fallbackAlgorithm: this.config.fallbackAlgorithmId,
			dataSourceCount: Object.keys(this.config.dataSources).length,
			cacheEnabled: this.config.cache.enabled,
			limitsMaxSymbols: this.config.limits.maxSymbolsPerRequest,
			qualityMinScore: this.config.quality.minDataQuality,
		};
	}

	/**
	 * Reset to default configuration
	 */
	resetToDefaults(): void {
		this.customOverrides = {};
		this.config = this.buildConfiguration();
	}

	/**
	 * Export configuration for external tools
	 */
	exportConfig(): string {
		return JSON.stringify(this.config, null, 2);
	}

	/**
	 * Import configuration from JSON
	 */
	importConfig(configJson: string): { success: boolean; error?: string } {
		try {
			const importedConfig = JSON.parse(configJson);
			this.updateConfig(importedConfig);

			const validation = this.validateConfig();
			if (!validation.isValid) {
				return {
					success: false,
					error: `Invalid configuration: ${validation.errors.join(", ")}`,
				};
			}

			return { success: true };
		} catch (error) {
			return {
				success: false,
				error: `Failed to parse configuration: ${error instanceof Error ? error.message : "Unknown error"}`,
			};
		}
	}
}

/**
 * Global configuration instance
 */
export const selectionConfig = new SelectionConfigManager();

/**
 * Utility functions for configuration access
 */
export const getSelectionConfig = () => selectionConfig.getConfig();
export const updateSelectionConfig = (overrides: Partial<SelectionServiceConfig>) =>
	selectionConfig.updateConfig(overrides);
export const validateSelectionConfig = () => selectionConfig.validateConfig();
