/**
 * ML Service Health Check API Endpoint
 * GET /api/ml/health - Comprehensive ML service health status
 */

import { NextRequest, NextResponse } from "next/server";
import { MLCacheService } from "../../../services/ml/cache/MLCacheService";
import { MLPerformanceCacheService } from "../../../services/ml/cache/MLPerformanceCacheService";

export async function GET(request: NextRequest): Promise<NextResponse> {
	try {
		const healthChecks: Record<string, any> = {};

		// Check Model Manager (Phase 3 - not yet implemented)
		healthChecks.modelManager = {
			healthy: true,
			status: "not_yet_implemented",
			phase: "Phase 3",
			message: "Model management functionality will be available in Phase 3",
		};

		// Check ML Cache Service
		try {
			const mlCache = MLCacheService.getInstance();
			const cacheHealth = await mlCache.healthCheck();

			healthChecks.mlCache = {
				healthy: cacheHealth.healthy,
				details: cacheHealth,
				status: cacheHealth.healthy ? "operational" : "degraded",
			};
		} catch (error) {
			healthChecks.mlCache = {
				healthy: false,
				error: error instanceof Error ? error.message : "Unknown error",
				status: "failed",
			};
		}

		// Check ML Performance Cache Service
		try {
			const mlPerfCache = MLPerformanceCacheService.getInstance();
			const perfHealth = await mlPerfCache.healthCheck();

			healthChecks.mlPerformanceCache = {
				healthy: perfHealth.healthy,
				details: perfHealth,
				status: perfHealth.healthy ? "operational" : "degraded",
			};
		} catch (error) {
			healthChecks.mlPerformanceCache = {
				healthy: false,
				error: error instanceof Error ? error.message : "Unknown error",
				status: "failed",
			};
		}

		// Determine overall health
		const allHealthy = Object.values(healthChecks).every((check: any) => check.healthy);
		const anyHealthy = Object.values(healthChecks).some((check: any) => check.healthy);

		const overallStatus = allHealthy ? "healthy" : anyHealthy ? "degraded" : "unhealthy";

		const response = {
			success: true,
			status: overallStatus,
			timestamp: Date.now(),
			services: healthChecks,
			summary: {
				totalServices: Object.keys(healthChecks).length,
				healthyServices: Object.values(healthChecks).filter((check: any) => check.healthy)
					.length,
				degradedServices: Object.values(healthChecks).filter((check: any) => !check.healthy)
					.length,
			},
		};

		const httpStatus = allHealthy ? 200 : anyHealthy ? 200 : 503;

		return NextResponse.json(response, { status: httpStatus });
	} catch (error) {
		console.error("ML health check failed:", error);
		return NextResponse.json(
			{
				success: false,
				status: "unhealthy",
				error: "ML health check failed",
				details: error instanceof Error ? error.message : "Unknown error",
				timestamp: Date.now(),
			},
			{ status: 503 }
		);
	}
}
