/**
 * Admin API - Data Source Testing
 * POST /api/admin/data-sources/[dataSourceId]/test - Test individual data source
 * Protected route requiring admin authentication
 */

import { NextRequest, NextResponse } from "next/server";
import { dataSourceConfigManager } from "../../../../../services/admin/DataSourceConfigManager";

export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ dataSourceId: string }> }
) {
	try {
		// Extract authorization header
		const authHeader = request.headers.get("authorization");
		const token = authHeader?.replace("Bearer ", "");

		if (!token) {
			return NextResponse.json({ error: "Authorization token required" }, { status: 401 });
		}

		// Validate admin access
		const isAdmin = await dataSourceConfigManager.validateAdminAccess(token);
		if (!isAdmin) {
			return NextResponse.json({ error: "Administrator access required" }, { status: 403 });
		}

		const { dataSourceId } = await params;
		const body = await request.json().catch(() => ({}));
		const testType = body.testType || "health";

		// Validate test type
		const validTestTypes = ["connection", "health", "data_fetch", "rate_limit"];
		if (!validTestTypes.includes(testType)) {
			return NextResponse.json(
				{ error: `Invalid test type. Must be one of: ${validTestTypes.join(", ")}` },
				{ status: 400 }
			);
		}

		try {
			const testResult = await dataSourceConfigManager.testDataSource(dataSourceId, testType);

			return NextResponse.json({
				success: true,
				data: testResult,
			});
		} catch (error) {
			return NextResponse.json(
				{
					error: "Data source test failed",
					details: error instanceof Error ? error.message : "Unknown error",
				},
				{ status: 500 }
			);
		}
	} catch (error) {
		console.error("Error testing data source:", error);
		return NextResponse.json(
			{
				error: "Failed to execute data source test",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 }
		);
	}
}
