/**
 * ML Enhancement Store Database Service
 * Simple TypeScript service for CRUD operations on ml_enhancement_store table
 * Following KISS principles - essential functionality only
 */

import { Pool, PoolClient } from "pg";

// Simple interface matching the database schema
export interface MLEnhancement {
	ticker: string;
	timestamp: Date;
	enhancement_id: string;
	base_vfr_value?: number;
	enhanced_value?: number;
	enhanced_composite_value?: number;
	confidence_score?: number;
	data_quality_score?: number;
	vfr_factor_name?: string;
	enhancement_weight?: number;
	enhancement_latency_ms?: number;
	models_used?: string[];
	fallback_mode?: boolean;
	validation_status?: "pending" | "valid" | "invalid" | "fallback" | "partial";
	created_at?: Date;
}

export interface MLEnhancementUpdate {
	actual_value?: number;
	prediction_error?: number;
	direction_correct?: boolean;
	validation_status?: "valid" | "invalid";
}

/**
 * Simple database connection following existing patterns
 */
class DatabaseConnection {
	private pool: Pool;
	private isConnected: boolean = false;

	constructor() {
		this.pool = new Pool({
			host: process.env.DB_HOST || "localhost",
			port: parseInt(process.env.DB_PORT || "5432"),
			database: process.env.DB_NAME || "vfr_api",
			user: process.env.DB_USER || "vfr_app_role",
			password: process.env.DB_PASSWORD,
			max: 20,
			idleTimeoutMillis: 30000,
			connectionTimeoutMillis: 5000,
			ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
		});

		this.pool.on("error", err => {
			console.error("ML Enhancement Store DB pool error:", err);
			this.isConnected = false;
		});
	}

	async connect(): Promise<void> {
		try {
			const client = await this.pool.connect();
			client.release();
			this.isConnected = true;
		} catch (error) {
			console.error("ML Enhancement Store DB connection failed:", error);
			this.isConnected = false;
			throw error;
		}
	}

	async query<T = any>(text: string, params?: any[]): Promise<T[]> {
		if (!this.isConnected) {
			await this.connect();
		}

		try {
			const result = await this.pool.query(text, params);
			return result.rows;
		} catch (error) {
			console.error("ML Enhancement Store DB query error:", error);
			throw error;
		}
	}

	async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
		const client = await this.pool.connect();
		try {
			await client.query("BEGIN");
			const result = await callback(client);
			await client.query("COMMIT");
			return result;
		} catch (error) {
			await client.query("ROLLBACK");
			throw error;
		} finally {
			client.release();
		}
	}

	async close(): Promise<void> {
		await this.pool.end();
		this.isConnected = false;
	}

	get healthy(): boolean {
		return this.isConnected;
	}
}

/**
 * ML Enhancement Store Service
 * CRUD operations for ML enhancement data
 */
export class MLEnhancementStore {
	private db: DatabaseConnection;

	constructor() {
		this.db = new DatabaseConnection();
	}

	/**
	 * Initialize the service and ensure database connection
	 */
	async initialize(): Promise<void> {
		await this.db.connect();
	}

	/**
	 * Store ML enhancement data
	 */
	async storeEnhancement(enhancement: MLEnhancement): Promise<boolean> {
		const query = `
      INSERT INTO ml_enhancement_store (
        ticker, timestamp, enhancement_id, base_vfr_value, enhanced_value,
        enhanced_composite_value, confidence_score, data_quality_score,
        vfr_factor_name, enhancement_weight, enhancement_latency_ms,
        models_used, fallback_mode, validation_status
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
      )
      ON CONFLICT (ticker, timestamp, enhancement_id)
      DO UPDATE SET
        enhanced_value = EXCLUDED.enhanced_value,
        enhanced_composite_value = EXCLUDED.enhanced_composite_value,
        confidence_score = EXCLUDED.confidence_score,
        data_quality_score = EXCLUDED.data_quality_score,
        validation_status = EXCLUDED.validation_status
    `;

		const params = [
			enhancement.ticker.toUpperCase(),
			enhancement.timestamp,
			enhancement.enhancement_id,
			enhancement.base_vfr_value,
			enhancement.enhanced_value,
			enhancement.enhanced_composite_value,
			enhancement.confidence_score,
			enhancement.data_quality_score,
			enhancement.vfr_factor_name,
			enhancement.enhancement_weight || 0.1,
			enhancement.enhancement_latency_ms,
			enhancement.models_used,
			enhancement.fallback_mode || false,
			enhancement.validation_status || "pending",
		];

		try {
			await this.db.query(query, params);
			return true;
		} catch (error) {
			console.error("Error storing ML enhancement:", error);
			return false;
		}
	}

	/**
	 * Get latest enhancement for a ticker
	 */
	async getLatestEnhancement(
		ticker: string,
		enhancement_id?: string,
		vfr_factor_name?: string
	): Promise<MLEnhancement | null> {
		let query = `
      SELECT
        ticker, timestamp, enhancement_id, base_vfr_value, enhanced_value,
        enhanced_composite_value, confidence_score, data_quality_score,
        vfr_factor_name, enhancement_weight, enhancement_latency_ms,
        models_used, fallback_mode, validation_status, created_at
      FROM ml_enhancement_store
      WHERE ticker = $1
    `;

		const params = [ticker.toUpperCase()];
		let paramIndex = 2;

		if (enhancement_id) {
			query += ` AND enhancement_id = $${paramIndex}`;
			params.push(enhancement_id);
			paramIndex++;
		}

		if (vfr_factor_name) {
			query += ` AND vfr_factor_name = $${paramIndex}`;
			params.push(vfr_factor_name);
			paramIndex++;
		}

		query += ` ORDER BY timestamp DESC LIMIT 1`;

		try {
			const result = await this.db.query<MLEnhancement>(query, params);
			return result[0] || null;
		} catch (error) {
			console.error("Error getting latest ML enhancement:", error);
			return null;
		}
	}

	/**
	 * Get enhancements for a ticker within time range
	 */
	async getEnhancements(
		ticker: string,
		startDate?: Date,
		endDate?: Date,
		enhancement_id?: string
	): Promise<MLEnhancement[]> {
		let query = `
      SELECT
        ticker, timestamp, enhancement_id, base_vfr_value, enhanced_value,
        enhanced_composite_value, confidence_score, data_quality_score,
        vfr_factor_name, enhancement_weight, enhancement_latency_ms,
        models_used, fallback_mode, validation_status, created_at
      FROM ml_enhancement_store
      WHERE ticker = $1
    `;

		const params = [ticker.toUpperCase()];
		let paramIndex = 2;

		if (startDate) {
			query += ` AND timestamp >= $${paramIndex}`;
			params.push(startDate.toISOString());
			paramIndex++;
		}

		if (endDate) {
			query += ` AND timestamp <= $${paramIndex}`;
			params.push(endDate.toISOString());
			paramIndex++;
		}

		if (enhancement_id) {
			query += ` AND enhancement_id = $${paramIndex}`;
			params.push(enhancement_id);
			paramIndex++;
		}

		query += ` ORDER BY timestamp DESC`;

		try {
			return await this.db.query<MLEnhancement>(query, params);
		} catch (error) {
			console.error("Error getting ML enhancements:", error);
			return [];
		}
	}

	/**
	 * Update enhancement with actual values when known
	 */
	async updateWithActuals(
		ticker: string,
		timestamp: Date,
		enhancement_id: string,
		updates: MLEnhancementUpdate
	): Promise<boolean> {
		// Note: This would require extending the schema to include actual_value fields
		// For now, we'll update validation_status and any other available fields
		const query = `
      UPDATE ml_enhancement_store
      SET validation_status = $4
      WHERE ticker = $1 AND timestamp = $2 AND enhancement_id = $3
    `;

		const params = [
			ticker.toUpperCase(),
			timestamp,
			enhancement_id,
			updates.validation_status || "valid",
		];

		try {
			const result = await this.db.query(query, params);
			return true;
		} catch (error) {
			console.error("Error updating ML enhancement with actuals:", error);
			return false;
		}
	}

	/**
	 * Delete old enhancements (cleanup)
	 */
	async cleanupOldEnhancements(daysToKeep: number = 90): Promise<number> {
		const cutoffDate = new Date();
		cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

		const query = `
      DELETE FROM ml_enhancement_store
      WHERE timestamp < $1
    `;

		try {
			await this.db.query(query, [cutoffDate]);
			return 1; // Return success indicator since we can't get affected rows easily
		} catch (error) {
			console.error("Error cleaning up old ML enhancements:", error);
			return 0;
		}
	}

	/**
	 * Get enhancement statistics for a ticker
	 */
	async getEnhancementStats(
		ticker: string,
		days: number = 30
	): Promise<{
		totalEnhancements: number;
		avgConfidenceScore: number;
		avgDataQualityScore: number;
		fallbackRate: number;
		validationRate: number;
	} | null> {
		const startDate = new Date();
		startDate.setDate(startDate.getDate() - days);

		const query = `
      SELECT
        COUNT(*) as total_enhancements,
        AVG(confidence_score) as avg_confidence_score,
        AVG(data_quality_score) as avg_data_quality_score,
        (COUNT(*) FILTER (WHERE fallback_mode = true))::FLOAT / COUNT(*) as fallback_rate,
        (COUNT(*) FILTER (WHERE validation_status = 'valid'))::FLOAT / COUNT(*) as validation_rate
      FROM ml_enhancement_store
      WHERE ticker = $1 AND timestamp >= $2
    `;

		try {
			const result = await this.db.query(query, [ticker.toUpperCase(), startDate]);
			const row = result[0];

			if (!row || row.total_enhancements === "0") {
				return null;
			}

			return {
				totalEnhancements: parseInt(row.total_enhancements),
				avgConfidenceScore: parseFloat(row.avg_confidence_score) || 0,
				avgDataQualityScore: parseFloat(row.avg_data_quality_score) || 0,
				fallbackRate: parseFloat(row.fallback_rate) || 0,
				validationRate: parseFloat(row.validation_rate) || 0,
			};
		} catch (error) {
			console.error("Error getting ML enhancement stats:", error);
			return null;
		}
	}

	/**
	 * Health check
	 */
	async healthCheck(): Promise<boolean> {
		try {
			await this.db.query("SELECT 1");
			return true;
		} catch (error) {
			console.error("ML Enhancement Store health check failed:", error);
			return false;
		}
	}

	/**
	 * Close database connections
	 */
	async close(): Promise<void> {
		await this.db.close();
	}
}

// Singleton instance
export const mlEnhancementStore = new MLEnhancementStore();
