/**
 * Admin API Endpoints - Data Source Management
 * GET /api/admin/data-sources - List all API data sources with status
 * Protected route requiring admin authentication
 */

import { NextRequest, NextResponse } from "next/server";
import { dataSourceConfigManager } from "../../../services/admin/DataSourceConfigManager";

export async function GET(request: NextRequest) {
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

		// Get query parameters
		const { searchParams } = new URL(request.url);
		const type = searchParams.get("type") as "commercial" | "government" | "free" | null;
		const category = searchParams.get("category") as
			| "stock_data"
			| "economic_data"
			| "web_intelligence"
			| "filings"
			| null;

		// Fetch data sources based on filters
		let dataSources;
		if (type) {
			dataSources = await dataSourceConfigManager.getDataSourcesByType(type);
		} else {
			dataSources = await dataSourceConfigManager.getAllDataSources();
		}

		// Apply category filter if specified
		if (category) {
			dataSources = dataSources.filter(dataSource => dataSource.category === category);
		}

		// Get ML service statistics (optional, non-blocking)
		let mlStats = null;
		try {
			const { MLPerformanceCacheService } = await import(
				"../../../services/ml/cache/MLPerformanceCacheService"
			);

			const mlPerformanceCache = MLPerformanceCacheService.getInstance();

			mlStats = {
				models: {
					total: 0,
					status: "not_yet_implemented",
					phase: "Phase 3",
					message: "Model management will be available in Phase 3",
				},
				performance: {
					cacheHitRate: await mlPerformanceCache.getCachePerformance(),
					systemPerformance: await mlPerformanceCache.getSystemPerformance(),
				},
			};
		} catch (error) {
			// ML services not available - this is acceptable (optional enhancement)
			console.log(
				"ML statistics not available:",
				error instanceof Error ? error.message : "Unknown error"
			);
		}

		return NextResponse.json({
			success: true,
			data: {
				dataSources,
				totalCount: dataSources.length,
				filters: { type, category },
				mlServices: mlStats,
			},
		});
	} catch (error) {
		console.error("Error fetching data sources:", error);
		return NextResponse.json(
			{
				error: "Failed to fetch data source information",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 }
		);
	}
}
