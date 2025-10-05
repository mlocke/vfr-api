/**
 * Admin API - ML Feature Toggles
 * Provides endpoints for managing ML feature flags
 */

import { NextRequest, NextResponse } from "next/server";
import { MLFeatureToggleService } from "../../../services/admin/MLFeatureToggleService";
import { dataSourceConfigManager } from "../../../services/admin/DataSourceConfigManager";

/**
 * GET /api/admin/ml-feature-toggles
 * Retrieve all ML feature toggle statuses
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

		// Get feature toggle service instance
		const toggleService = MLFeatureToggleService.getInstance();

		// Get all feature statuses
		const features = await toggleService.getAllFeatures();

		// Get health check
		const health = await toggleService.healthCheck();

		return NextResponse.json({
			success: true,
			features,
			health,
			summary: {
				totalFeatures: features.length,
				enabledFeatures: features.filter(f => f.enabled).length,
				disabledFeatures: features.filter(f => !f.enabled).length,
			},
			timestamp: Date.now(),
		});
	} catch (error) {
		console.error("❌ ML feature toggles retrieval failed:", error);

		const sanitizedError = error instanceof Error ? error.message : "Unknown error";
		return NextResponse.json(
			{
				error: "Failed to retrieve ML feature toggles",
				details: sanitizedError,
				timestamp: Date.now(),
			},
			{ status: 500 }
		);
	}
}
