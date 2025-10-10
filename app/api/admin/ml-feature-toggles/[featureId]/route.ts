/**
 * Admin API - Individual ML Feature Toggle Management
 * Provides endpoints for toggling specific ML features
 */

import { NextRequest, NextResponse } from "next/server";
import { MLFeatureToggleService } from "../../../../services/admin/MLFeatureToggleService";
import { dataSourceConfigManager } from "../../../../services/admin/DataSourceConfigManager";

/**
 * GET /api/admin/ml-feature-toggles/[featureId]
 * Get status of a specific ML feature
 */
export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ featureId: string }> }
) {
	try {
		// Validate admin access
		const authHeader = request.headers.get("authorization");
		const token = authHeader?.replace("Bearer ", "") || "dev-admin-token";

		const hasAccess = await dataSourceConfigManager.validateAdminAccess(token);
		if (!hasAccess) {
			return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
		}

		const { featureId } = await params;
		const toggleService = MLFeatureToggleService.getInstance();
		const featureStatus = await toggleService.getFeatureStatus(featureId);

		return NextResponse.json({
			success: true,
			feature: featureStatus,
			timestamp: Date.now(),
		});
	} catch (error) {
		console.error(`❌ Failed to get feature:`, error);

		const sanitizedError = error instanceof Error ? error.message : "Unknown error";
		return NextResponse.json(
			{
				error: "Failed to retrieve feature status",
				details: sanitizedError,
				timestamp: Date.now(),
			},
			{ status: 500 }
		);
	}
}

/**
 * POST /api/admin/ml-feature-toggles/[featureId]
 * Toggle a specific ML feature on/off
 */
export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ featureId: string }> }
) {
	try {
		// Validate admin access
		const authHeader = request.headers.get("authorization");
		const token = authHeader?.replace("Bearer ", "") || "dev-admin-token";

		const hasAccess = await dataSourceConfigManager.validateAdminAccess(token);
		if (!hasAccess) {
			return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
		}

		const { featureId } = await params;
		const body = await request.json();
		const { enabled, userId, reason } = body;

		if (typeof enabled !== "boolean") {
			return NextResponse.json(
				{ error: "Missing or invalid 'enabled' parameter (must be boolean)" },
				{ status: 400 }
			);
		}

		const toggleService = MLFeatureToggleService.getInstance();

		// Toggle the feature
		await toggleService.setFeatureEnabled(featureId, enabled, userId, reason);

		// Get updated status
		const updatedStatus = await toggleService.getFeatureStatus(featureId);

		return NextResponse.json({
			success: true,
			message: `Feature ${enabled ? "enabled" : "disabled"} successfully`,
			feature: updatedStatus,
			timestamp: Date.now(),
		});
	} catch (error) {
		console.error(`❌ Failed to toggle feature:`, error);

		const sanitizedError = error instanceof Error ? error.message : "Unknown error";
		return NextResponse.json(
			{
				error: "Failed to toggle feature",
				details: sanitizedError,
				timestamp: Date.now(),
			},
			{ status: 500 }
		);
	}
}
