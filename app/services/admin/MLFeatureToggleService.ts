/**
 * ML Feature Toggle Service
 *
 * Centralized management of ML feature flags for production deployment
 * Features:
 * - Early Signal Detection toggle
 * - Redis-backed persistence with in-memory fallback
 * - Audit logging for compliance
 * - Thread-safe toggle operations
 *
 * Usage:
 * ```typescript
 * const toggleService = MLFeatureToggleService.getInstance()
 * const isEnabled = await toggleService.isEarlySignalEnabled()
 * await toggleService.setEarlySignalEnabled(true)
 * ```
 */

import { RedisCache } from "../cache/RedisCache";

export interface MLFeatureStatus {
	featureId: string;
	featureName: string;
	enabled: boolean;
	enabledAt?: number;
	enabledBy?: string;
	lastModified: number;
	description: string;
}

export interface ToggleAuditLog {
	timestamp: number;
	featureId: string;
	action: "enabled" | "disabled";
	previousState: boolean;
	newState: boolean;
	userId?: string;
	reason?: string;
}

export class MLFeatureToggleService {
	private static instance: MLFeatureToggleService | null = null;
	private cache: RedisCache;
	private inMemoryFallback: Map<string, MLFeatureStatus> = new Map();

	// Feature registry
	private static readonly FEATURES = {
		EARLY_SIGNAL_DETECTION: {
			id: "early_signal_detection",
			name: "Early Signal Detection",
			description: "ML-powered analyst rating upgrade predictions (2-week horizon)",
			defaultState: true, // Production-ready model (v1.0.0, 97.6% accuracy, deployed Oct 2, 2025)
		},
	};

	// Cache keys
	private static readonly CACHE_PREFIX = "ml_feature_toggle:";
	private static readonly AUDIT_LOG_PREFIX = "ml_toggle_audit:";
	private static readonly CACHE_TTL = 86400; // 24 hours for feature toggle state

	private constructor() {
		this.cache = new RedisCache();
		// Don't call initializeFeatures() here - it's async and needs to be awaited
		// Instead, we'll initialize on first use via ensureInitialized()
	}

	private initializePromise: Promise<void> | null = null;

	/**
	 * Wait for Redis to be ready (with timeout)
	 */
	private async waitForRedis(maxAttempts: number = 10, delayMs: number = 100): Promise<void> {
		for (let i = 0; i < maxAttempts; i++) {
			try {
				const result = await this.cache.ping();
				if (result === "PONG" || result === "PONG (fallback)") {
					return; // Redis is ready
				}
			} catch (error) {
				// Redis not ready yet, continue waiting
			}

			if (i < maxAttempts - 1) {
				await new Promise(resolve => setTimeout(resolve, delayMs));
			}
		}

		console.warn("⚠️ Redis not ready after waiting, proceeding with in-memory fallback");
	}

	/**
	 * Ensure features are initialized before any operation
	 * Called automatically by all public methods
	 */
	private async ensureInitialized(): Promise<void> {
		if (!this.initializePromise) {
			this.initializePromise = this.initializeFeatures();
		}
		await this.initializePromise;
	}

	/**
	 * Singleton pattern for global access
	 */
	public static getInstance(): MLFeatureToggleService {
		if (!MLFeatureToggleService.instance) {
			MLFeatureToggleService.instance = new MLFeatureToggleService();
		}
		return MLFeatureToggleService.instance;
	}

	/**
	 * Initialize features with default states if not already set
	 */
	private async initializeFeatures(): Promise<void> {
		try {
			// Wait for Redis to be ready before attempting to initialize features
			await this.waitForRedis();

			// Initialize Early Signal Detection feature
			const esdKey = this.getFeatureKey(
				MLFeatureToggleService.FEATURES.EARLY_SIGNAL_DETECTION.id
			);
			const existingStatus = await this.cache.get(esdKey);

			if (!existingStatus) {
				const initialStatus: MLFeatureStatus = {
					featureId: MLFeatureToggleService.FEATURES.EARLY_SIGNAL_DETECTION.id,
					featureName: MLFeatureToggleService.FEATURES.EARLY_SIGNAL_DETECTION.name,
					enabled: MLFeatureToggleService.FEATURES.EARLY_SIGNAL_DETECTION.defaultState,
					lastModified: Date.now(),
					description: MLFeatureToggleService.FEATURES.EARLY_SIGNAL_DETECTION.description,
				};

				await this.cache.set(
					esdKey,
					JSON.stringify(initialStatus),
					MLFeatureToggleService.CACHE_TTL
				);
				this.inMemoryFallback.set(esdKey, initialStatus);

				console.log(
					`✅ Initialized ML feature: ${initialStatus.featureName} (default: ${initialStatus.enabled ? "enabled" : "disabled"})`
				);
			} else {
				// Load existing status into memory fallback
				const status = JSON.parse(existingStatus);
				this.inMemoryFallback.set(esdKey, status);
				console.log(
					`✅ Loaded ML feature: ${status.featureName} (current: ${status.enabled ? "enabled" : "disabled"})`
				);
			}
		} catch (error) {
			console.error("Failed to initialize ML features:", error);
			// Use in-memory fallback if Redis fails
			const fallbackStatus: MLFeatureStatus = {
				featureId: MLFeatureToggleService.FEATURES.EARLY_SIGNAL_DETECTION.id,
				featureName: MLFeatureToggleService.FEATURES.EARLY_SIGNAL_DETECTION.name,
				enabled: MLFeatureToggleService.FEATURES.EARLY_SIGNAL_DETECTION.defaultState,
				lastModified: Date.now(),
				description: MLFeatureToggleService.FEATURES.EARLY_SIGNAL_DETECTION.description,
			};
			this.inMemoryFallback.set(
				this.getFeatureKey(MLFeatureToggleService.FEATURES.EARLY_SIGNAL_DETECTION.id),
				fallbackStatus
			);
		}
	}

	/**
	 * Get feature key for cache storage
	 */
	private getFeatureKey(featureId: string): string {
		return `${MLFeatureToggleService.CACHE_PREFIX}${featureId}`;
	}

	/**
	 * Get audit log key for a feature
	 */
	private getAuditKey(featureId: string): string {
		return `${MLFeatureToggleService.AUDIT_LOG_PREFIX}${featureId}`;
	}

	/**
	 * Check if Early Signal Detection is enabled
	 * This is the primary method used by the stock selection API
	 */
	public async isEarlySignalEnabled(): Promise<boolean> {
		try {
			await this.ensureInitialized();
			const status = await this.getFeatureStatus(
				MLFeatureToggleService.FEATURES.EARLY_SIGNAL_DETECTION.id
			);
			return status.enabled;
		} catch (error) {
			console.error("Failed to check Early Signal Detection status:", error);
			// Fail safe: return false if unable to determine status
			return false;
		}
	}

	/**
	 * Enable or disable Early Signal Detection
	 */
	public async setEarlySignalEnabled(
		enabled: boolean,
		userId?: string,
		reason?: string
	): Promise<void> {
		await this.ensureInitialized();
		await this.setFeatureEnabled(
			MLFeatureToggleService.FEATURES.EARLY_SIGNAL_DETECTION.id,
			enabled,
			userId,
			reason
		);
	}

	/**
	 * Get current status of a feature
	 */
	public async getFeatureStatus(featureId: string): Promise<MLFeatureStatus> {
		await this.ensureInitialized();
		try {
			const key = this.getFeatureKey(featureId);
			const cached = await this.cache.get(key);

			if (cached) {
				const status = JSON.parse(cached);
				this.inMemoryFallback.set(key, status); // Update fallback
				return status;
			}

			// Check in-memory fallback
			const fallback = this.inMemoryFallback.get(key);
			if (fallback) {
				return fallback;
			}

			// Feature not found - return default disabled state
			console.warn(`Feature ${featureId} not found, returning disabled state`);
			return {
				featureId,
				featureName: featureId,
				enabled: false,
				lastModified: Date.now(),
				description: "Unknown feature",
			};
		} catch (error) {
			console.error(`Failed to get feature status for ${featureId}:`, error);

			// Try in-memory fallback
			const fallback = this.inMemoryFallback.get(this.getFeatureKey(featureId));
			if (fallback) {
				return fallback;
			}

			// Ultimate fallback: disabled
			return {
				featureId,
				featureName: featureId,
				enabled: false,
				lastModified: Date.now(),
				description: "Error retrieving feature status",
			};
		}
	}

	/**
	 * Enable or disable a feature with audit logging
	 */
	public async setFeatureEnabled(
		featureId: string,
		enabled: boolean,
		userId?: string,
		reason?: string
	): Promise<void> {
		await this.ensureInitialized();
		try {
			// Get current status
			const currentStatus = await this.getFeatureStatus(featureId);
			const previousState = currentStatus.enabled;

			// Create updated status
			const updatedStatus: MLFeatureStatus = {
				...currentStatus,
				enabled,
				lastModified: Date.now(),
				...(enabled && {
					enabledAt: Date.now(),
					enabledBy: userId,
				}),
			};

			// Save to cache
			const key = this.getFeatureKey(featureId);
			await this.cache.set(
				key,
				JSON.stringify(updatedStatus),
				MLFeatureToggleService.CACHE_TTL
			);

			// Update in-memory fallback
			this.inMemoryFallback.set(key, updatedStatus);

			// Create audit log entry
			const auditEntry: ToggleAuditLog = {
				timestamp: Date.now(),
				featureId,
				action: enabled ? "enabled" : "disabled",
				previousState,
				newState: enabled,
				userId,
				reason,
			};

			// Save audit log (with 30-day retention)
			const auditKey = `${this.getAuditKey(featureId)}:${Date.now()}`;
			await this.cache.set(auditKey, JSON.stringify(auditEntry), 2592000); // 30 days

			console.log(
				`✅ ML Feature ${enabled ? "ENABLED" : "DISABLED"}: ${currentStatus.featureName}`
			);
			console.log(`   Previous: ${previousState}, New: ${enabled}`);
			if (userId) console.log(`   Changed by: ${userId}`);
			if (reason) console.log(`   Reason: ${reason}`);
		} catch (error) {
			console.error(`Failed to set feature status for ${featureId}:`, error);
			throw new Error(
				`Failed to update feature toggle: ${error instanceof Error ? error.message : "Unknown error"}`
			);
		}
	}

	/**
	 * Get all feature statuses
	 */
	public async getAllFeatures(): Promise<MLFeatureStatus[]> {
		await this.ensureInitialized();
		const features: MLFeatureStatus[] = [];

		for (const feature of Object.values(MLFeatureToggleService.FEATURES)) {
			try {
				const status = await this.getFeatureStatus(feature.id);
				features.push(status);
			} catch (error) {
				console.warn(`Failed to get status for feature ${feature.id}:`, error);
			}
		}

		return features;
	}

	/**
	 * Get audit log for a feature (last 100 entries)
	 */
	public async getAuditLog(featureId: string, limit: number = 100): Promise<ToggleAuditLog[]> {
		await this.ensureInitialized();
		try {
			// This is a simplified implementation
			// In production, you might want to use Redis SCAN or a time-series database
			console.warn(
				"Audit log retrieval is simplified - implement full SCAN pattern for production"
			);
			return [];
		} catch (error) {
			console.error(`Failed to get audit log for ${featureId}:`, error);
			return [];
		}
	}

	/**
	 * Health check for the toggle service
	 */
	public async healthCheck(): Promise<{
		healthy: boolean;
		cacheConnected: boolean;
		featuresInitialized: number;
	}> {
		await this.ensureInitialized();
		try {
			const cacheConnected = await this.cache
				.ping()
				.then(() => true)
				.catch(() => false);
			const features = await this.getAllFeatures();

			return {
				healthy: cacheConnected || this.inMemoryFallback.size > 0,
				cacheConnected,
				featuresInitialized: features.length,
			};
		} catch (error) {
			return {
				healthy: false,
				cacheConnected: false,
				featuresInitialized: 0,
			};
		}
	}

	/**
	 * Clear all feature toggles (for testing only)
	 */
	public async clearAllToggles(): Promise<void> {
		await this.ensureInitialized();
		console.warn("⚠️  Clearing all ML feature toggles - this should only be used in testing!");

		for (const feature of Object.values(MLFeatureToggleService.FEATURES)) {
			try {
				const key = this.getFeatureKey(feature.id);
				await this.cache.delete(key);
				this.inMemoryFallback.delete(key);
			} catch (error) {
				console.error(`Failed to clear toggle for ${feature.id}:`, error);
			}
		}

		// Reinitialize with defaults
		await this.initializeFeatures();
	}
}
