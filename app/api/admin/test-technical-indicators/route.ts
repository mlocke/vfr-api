/**
 * Admin API - Simple Technical Indicators Testing
 * POST /api/admin/test-technical-indicators
 * Tests technical indicator calculations using existing services
 */

import { NextRequest, NextResponse } from "next/server";
import { SimpleTechnicalTestService } from "../../../services/admin/SimpleTechnicalTestService";
import { RedisCache } from "../../../services/cache/RedisCache";

interface SimpleTestRequest {
	symbols: string[];
}

export async function POST(request: NextRequest) {
	try {
		const body: SimpleTestRequest = await request.json();
		const { symbols } = body;

		console.log("🧪 Admin API: Testing technical indicators", { symbols });

		// Simple validation
		if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
			return NextResponse.json(
				{ error: "Symbols array required", success: false },
				{ status: 400 }
			);
		}

		const validSymbols = symbols.filter(
			symbol => typeof symbol === "string" && /^[A-Z]{1,10}$/.test(symbol.toUpperCase())
		);

		if (validSymbols.length === 0) {
			return NextResponse.json(
				{ error: "No valid symbols provided", success: false },
				{ status: 400 }
			);
		}

		// Initialize simple test service
		const cache = new RedisCache();
		const testService = new SimpleTechnicalTestService(cache);

		// Test all symbols
		const results = await testService.testSymbols(validSymbols);

		// Simple summary
		const successCount = results.filter(r => r.success).length;
		const avgResponseTime =
			results.length > 0
				? Math.round(results.reduce((sum, r) => sum + r.responseTime, 0) / results.length)
				: 0;

		console.log("✅ Admin API: Technical indicator tests completed", {
			total: results.length,
			success: successCount,
			failed: results.length - successCount,
			avgResponseTime,
		});

		return NextResponse.json({
			success: true,
			results,
			summary: {
				total: results.length,
				success: successCount,
				failed: results.length - successCount,
				avgResponseTime,
				timestamp: Date.now(),
			},
		});
	} catch (error) {
		console.error("❌ Admin API error:", error);
		return NextResponse.json(
			{
				error: "Technical indicators test failed",
				message: error instanceof Error ? error.message : "Unknown error",
				success: false,
			},
			{ status: 500 }
		);
	}
}
