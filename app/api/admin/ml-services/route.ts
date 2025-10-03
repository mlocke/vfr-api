/**
 * Admin API - ML Services Management
 * Provides endpoints for monitoring and testing ML services
 * Follows existing admin API patterns for consistency
 */

import { NextRequest, NextResponse } from "next/server";
import { mlMonitoringService } from "../../../services/admin/MLMonitoringService";
import { dataSourceConfigManager } from "../../../services/admin/DataSourceConfigManager";
import ErrorHandler from "../../../services/error-handling/ErrorHandler";

const errorHandler = ErrorHandler.getInstance();

/**
 * GET /api/admin/ml-services
 * Retrieve all ML services with current status and performance metrics
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

		// Get all ML services with status
		const mlServices = await mlMonitoringService.getAllMLServices();

		// Get performance metrics
		const performanceMetrics = await mlMonitoringService.getMLPerformanceMetrics();

		return NextResponse.json({
			success: true,
			services: mlServices,
			performanceMetrics,
			enabled: mlMonitoringService.getEnabledMLServices(),
			summary: {
				totalServices: mlServices.length,
				healthyServices: mlServices.filter(s => s.status === "healthy").length,
				enabledServices: mlServices.filter(s => s.enabled).length,
				avgResponseTime:
					mlServices.reduce((sum, s) => sum + (s.responseTime || 0), 0) /
					mlServices.length,
			},
			timestamp: Date.now(),
		});
	} catch (error) {
		console.error("❌ ML services retrieval failed:", error);

		const sanitizedError = error instanceof Error ? error.message : "Unknown error";
		return NextResponse.json(
			{
				error: "Failed to retrieve ML services",
				details: sanitizedError,
				timestamp: Date.now(),
			},
			{ status: 500 }
		);
	}
}

/**
 * POST /api/admin/ml-services
 * Test ML services or perform specific actions
 */
export async function POST(request: NextRequest) {
	try {
		// Validate admin access
		const authHeader = request.headers.get("authorization");
		const token = authHeader?.replace("Bearer ", "") || "dev-admin-token";

		const hasAccess = await dataSourceConfigManager.validateAdminAccess(token);
		if (!hasAccess) {
			return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
		}

		const body = await request.json();
		const { action, serviceIds, testType, config } = body;

		switch (action) {
			case "test_services":
				if (!serviceIds || !Array.isArray(serviceIds)) {
					return NextResponse.json(
						{ error: "serviceIds array is required for testing" },
						{ status: 400 }
					);
				}

				// Test individual services
				const testResults = await Promise.allSettled(
					serviceIds.map(serviceId =>
						mlMonitoringService.testMLService(serviceId, testType || "health")
					)
				);

				const results = testResults.map((result, index) => {
					if (result.status === "fulfilled") {
						return result.value;
					} else {
						return {
							serviceId: serviceIds[index],
							serviceName: serviceIds[index],
							success: false,
							responseTime: 0,
							error: result.reason?.message || "Test failed",
							timestamp: Date.now(),
							testType: (testType || "health") as
								| "health"
								| "integration"
								| "performance"
								| "stress",
						};
					}
				});

				return NextResponse.json({
					success: true,
					action: "test_services",
					results,
					summary: {
						total: results.length,
						successful: results.filter(r => r.success).length,
						failed: results.filter(r => !r.success).length,
						avgResponseTime:
							results.reduce((sum, r) => sum + (r.responseTime || 0), 0) /
							results.length,
					},
					timestamp: Date.now(),
				});

			case "test_integration":
				// Test ML service group with integration tests
				const groupTestResult = await mlMonitoringService.testMLServiceGroup();

				return NextResponse.json({
					success: true,
					action: "test_integration",
					result: groupTestResult,
					timestamp: Date.now(),
				});

			case "performance_benchmark":
				// Run performance tests on all enabled services
				const enabledServices = mlMonitoringService.getEnabledMLServices();
				const performanceResults = await Promise.allSettled(
					enabledServices.map(serviceId =>
						mlMonitoringService.testMLService(serviceId, "performance")
					)
				);

				const benchmarkResults = performanceResults.map((result, index) => {
					if (result.status === "fulfilled") {
						return result.value;
					} else {
						return {
							serviceId: enabledServices[index],
							serviceName: enabledServices[index],
							success: false,
							responseTime: 0,
							error: result.reason?.message || "Performance test failed",
							timestamp: Date.now(),
							testType: "performance" as const,
						};
					}
				});

				return NextResponse.json({
					success: true,
					action: "performance_benchmark",
					results: benchmarkResults,
					summary: {
						avgResponseTime:
							benchmarkResults.reduce((sum, r) => sum + (r.responseTime || 0), 0) /
							benchmarkResults.length,
						slowestService: benchmarkResults.reduce((slowest, current) =>
							(current.responseTime || 0) > (slowest.responseTime || 0)
								? current
								: slowest
						),
						fastestService: benchmarkResults.reduce((fastest, current) =>
							(current.responseTime || 0) < (fastest.responseTime || 0)
								? current
								: fastest
						),
					},
					timestamp: Date.now(),
				});

			default:
				return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
		}
	} catch (error) {
		console.error("❌ ML services action failed:", error);

		const sanitizedError = error instanceof Error ? error.message : "Unknown error";
		return NextResponse.json(
			{
				error: "Failed to execute ML services action",
				details: sanitizedError,
				timestamp: Date.now(),
			},
			{ status: 500 }
		);
	}
}
