/**
 * Admin API - ML Feature Toggle Audit Logs
 * Provides endpoints for viewing feature toggle audit history
 */

import { NextRequest, NextResponse } from "next/server";
import { MLFeatureToggleService } from "../../../../services/admin/MLFeatureToggleService";
import { dataSourceConfigManager } from "../../../../services/admin/DataSourceConfigManager";

/**
 * GET /api/admin/ml-feature-toggles/audit-logs
 * Retrieve audit logs for feature toggles
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

		const toggleService = MLFeatureToggleService.getInstance();

		// Get query parameters
		const url = new URL(request.url);
		const featureId = url.searchParams.get("featureId");
		const limit = parseInt(url.searchParams.get("limit") || "100");

		// Get audit logs
		let logs;
		if (featureId) {
			logs = await toggleService.getAuditLog(featureId, limit);
		} else {
			// Get logs for all features
			const allFeatures = await toggleService.getAllFeatures();
			logs = [];
			for (const feature of allFeatures) {
				const featureLogs = await toggleService.getAuditLog(feature.featureId, limit);
				logs.push(...featureLogs);
			}
			// Sort by timestamp descending
			logs.sort((a, b) => b.timestamp - a.timestamp);
			// Limit total results
			logs = logs.slice(0, limit);
		}

		return NextResponse.json({
			success: true,
			logs,
			count: logs.length,
			limit,
			featureId: featureId || "all",
			timestamp: Date.now(),
		});
	} catch (error) {
		console.error("❌ Failed to retrieve audit logs:", error);

		const sanitizedError = error instanceof Error ? error.message : "Unknown error";
		return NextResponse.json(
			{
				error: "Failed to retrieve audit logs",
				details: sanitizedError,
				timestamp: Date.now(),
			},
			{ status: 500 }
		);
	}
}
