/**
 * Admin API - Individual ML Service Management
 * Provides endpoints for managing individual ML services
 * Supports testing, toggling, and configuration retrieval
 */

import { NextRequest, NextResponse } from "next/server";
import { mlMonitoringService } from "../../../../services/admin/MLMonitoringService";
import { dataSourceConfigManager } from "../../../../services/admin/DataSourceConfigManager";
import ErrorHandler from "../../../../services/error-handling/ErrorHandler";

const errorHandler = ErrorHandler.getInstance();

interface RouteParams {
	params: Promise<{
		serviceId: string;
	}>;
}

/**
 * GET /api/admin/ml-services/[serviceId]
 * Get detailed information about a specific ML service
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
	try {
		// Validate admin access
		const authHeader = request.headers.get("authorization");
		const token = authHeader?.replace("Bearer ", "") || "dev-admin-token";

		const hasAccess = await dataSourceConfigManager.validateAdminAccess(token);
		if (!hasAccess) {
			return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
		}

		const { serviceId } = await params;

		// Get all services and find the specific one
		const allServices = await mlMonitoringService.getAllMLServices();
		const service = allServices.find(s => s.id === serviceId);

		if (!service) {
			return NextResponse.json(
				{ error: `ML service ${serviceId} not found` },
				{ status: 404 }
			);
		}

		// Get performance metrics for this service
		const performanceMetrics = await mlMonitoringService.getMLPerformanceMetrics();
		const serviceMetrics = performanceMetrics.find(m => m.serviceId === serviceId);

		return NextResponse.json({
			success: true,
			service,
			metrics: serviceMetrics,
			enabled: mlMonitoringService.isMLServiceEnabled(serviceId),
			timestamp: Date.now(),
		});
	} catch (error) {
		const resolvedParams = await params;
		console.error(`❌ ML service ${resolvedParams.serviceId} retrieval failed:`, error);

		const sanitizedError = error instanceof Error ? error.message : "Unknown error";
		return NextResponse.json(
			{
				error: `Failed to retrieve ML service ${resolvedParams.serviceId}`,
				details: sanitizedError,
				timestamp: Date.now(),
			},
			{ status: 500 }
		);
	}
}

/**
 * POST /api/admin/ml-services/[serviceId]
 * Perform actions on a specific ML service
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
	try {
		// Validate admin access
		const authHeader = request.headers.get("authorization");
		const token = authHeader?.replace("Bearer ", "") || "dev-admin-token";

		const hasAccess = await dataSourceConfigManager.validateAdminAccess(token);
		if (!hasAccess) {
			return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
		}

		const { serviceId } = await params;
		const body = await request.json();
		const { action, testType, config } = body;

		switch (action) {
			case "test":
				// Test the specific ML service
				const testResult = await mlMonitoringService.testMLService(
					serviceId,
					testType || "health"
				);

				return NextResponse.json({
					success: true,
					action: "test",
					serviceId,
					result: testResult,
					timestamp: Date.now(),
				});

			case "toggle":
				// Toggle service enabled/disabled state
				const toggleResult = await mlMonitoringService.toggleMLService(serviceId);

				return NextResponse.json({
					success: toggleResult.success,
					action: "toggle",
					serviceId,
					enabled: toggleResult.enabled,
					message: toggleResult.message,
					timestamp: Date.now(),
				});

			case "health_check":
				// Perform comprehensive health check
				const healthResult = await mlMonitoringService.testMLService(serviceId, "health");

				return NextResponse.json({
					success: true,
					action: "health_check",
					serviceId,
					healthy: healthResult.success,
					result: healthResult,
					timestamp: Date.now(),
				});

			case "performance_test":
				// Run performance test
				const perfResult = await mlMonitoringService.testMLService(
					serviceId,
					"performance"
				);

				return NextResponse.json({
					success: true,
					action: "performance_test",
					serviceId,
					result: perfResult,
					timestamp: Date.now(),
				});

			case "stress_test":
				// Run stress test
				const stressResult = await mlMonitoringService.testMLService(serviceId, "stress");

				return NextResponse.json({
					success: true,
					action: "stress_test",
					serviceId,
					result: stressResult,
					timestamp: Date.now(),
				});

			default:
				return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
		}
	} catch (error) {
		const resolvedParams = await params;
		console.error(`❌ ML service ${resolvedParams.serviceId} action failed:`, error);

		const sanitizedError = error instanceof Error ? error.message : "Unknown error";
		return NextResponse.json(
			{
				error: `Failed to execute action on ML service ${resolvedParams.serviceId}`,
				details: sanitizedError,
				timestamp: Date.now(),
			},
			{ status: 500 }
		);
	}
}
