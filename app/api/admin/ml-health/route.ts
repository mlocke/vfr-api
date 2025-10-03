/**
 * Admin API - ML Health Check
 * Provides a simple health check endpoint for ML infrastructure
 * Used by admin dashboard for system status monitoring
 */

import { NextRequest, NextResponse } from "next/server";
import { mlMonitoringService } from "../../../services/admin/MLMonitoringService";
import { dataSourceConfigManager } from "../../../services/admin/DataSourceConfigManager";
import ErrorHandler from "../../../services/error-handling/ErrorHandler";

const errorHandler = ErrorHandler.getInstance();

/**
 * GET /api/admin/ml-health
 * Quick health check for ML infrastructure
 */
export async function GET(request: NextRequest) {
	try {
		// Validate admin access
		const authHeader = request.headers.get("authorization");
		const token = authHeader?.replace("Bearer ", "") || "dev-admin-token";

		const hasAccess = await dataSourceConfigManager.validateAdminAccess(token);
		if (!hasAccess) {
			return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
		}

		// Get basic ML services status
		const mlServices = await mlMonitoringService.getAllMLServices();
		const enabledServices = mlServices.filter(s => s.enabled);
		const healthyServices = enabledServices.filter(s => s.status === "healthy");

		// Calculate system health score
		const healthScore =
			enabledServices.length > 0
				? (healthyServices.length / enabledServices.length) * 100
				: 0;

		// Determine overall status
		let overallStatus: "healthy" | "degraded" | "critical" | "offline";
		if (healthScore >= 90) {
			overallStatus = "healthy";
		} else if (healthScore >= 70) {
			overallStatus = "degraded";
		} else if (healthScore > 0) {
			overallStatus = "critical";
		} else {
			overallStatus = "offline";
		}

		// Get average response time
		const responseTimes = mlServices
			.filter(s => s.enabled && s.responseTime)
			.map(s => s.responseTime!);

		const avgResponseTime =
			responseTimes.length > 0
				? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
				: 0;

		return NextResponse.json({
			success: true,
			status: overallStatus,
			healthScore,
			summary: {
				totalServices: mlServices.length,
				enabledServices: enabledServices.length,
				healthyServices: healthyServices.length,
				avgResponseTime: Math.round(avgResponseTime),
				timestamp: Date.now(),
			},
			services: mlServices.map(service => ({
				id: service.id,
				name: service.name,
				status: service.status,
				enabled: service.enabled,
				responseTime: service.responseTime,
				type: service.type,
			})),
			timestamp: Date.now(),
		});
	} catch (error) {
		console.error("❌ ML health check failed:", error);

		const sanitizedError = error instanceof Error ? error.message : "Unknown error";
		return NextResponse.json(
			{
				success: false,
				status: "error",
				error: "ML health check failed",
				details: sanitizedError,
				timestamp: Date.now(),
			},
			{ status: 500 }
		);
	}
}
