/**
 * Historical Data API Endpoint
 * Provides cached historical financial data with intelligent fallback
 */

import { NextRequest, NextResponse } from "next/server";
import { financialDataCacheService } from "../../services/database/FinancialDataCacheService";
import { databaseMigrationService } from "../../services/database/DatabaseMigrationService";
import ErrorHandler from "../../services/error-handling/ErrorHandler";

// Initialize services
let initialized = false;

async function ensureInitialized() {
	if (!initialized) {
		try {
			await financialDataCacheService.initialize();
			initialized = true;
		} catch (error) {
			console.error("Failed to initialize financial data cache service:", error);
			throw new Error("Service initialization failed");
		}
	}
}

/**
 * GET /api/historical-data
 * Retrieve historical market data with caching
 */
export async function GET(request: NextRequest) {
	try {
		await ensureInitialized();

		const { searchParams } = new URL(request.url);
		const symbol = searchParams.get("symbol")?.toUpperCase();
		const timeframe = searchParams.get("timeframe") || "1d";
		const startDate = searchParams.get("startDate");
		const endDate = searchParams.get("endDate");
		const source = searchParams.get("source");
		const forceRefresh = searchParams.get("forceRefresh") === "true";
		const maxStaleSeconds = searchParams.get("maxStaleSeconds");

		// Validation
		if (!symbol) {
			return NextResponse.json({ error: "Symbol parameter is required" }, { status: 400 });
		}

		const validTimeframes = ["1m", "5m", "15m", "30m", "1h", "4h", "1d", "1w", "1M"];
		if (!validTimeframes.includes(timeframe)) {
			return NextResponse.json(
				{ error: `Invalid timeframe. Must be one of: ${validTimeframes.join(", ")}` },
				{ status: 400 }
			);
		}

		// Prepare request
		const dataRequest = {
			symbol,
			timeframe,
			startDate: startDate ? new Date(startDate) : undefined,
			endDate: endDate ? new Date(endDate) : undefined,
			preferredSource: source || undefined,
			forceRefresh,
			maxStaleSeconds: maxStaleSeconds ? parseInt(maxStaleSeconds) : undefined,
		};

		// Get data through cache service
		const response = await financialDataCacheService.getMarketData(dataRequest);

		// Return structured response
		return NextResponse.json({
			success: true,
			data: response.data,
			metadata: {
				symbol,
				timeframe,
				source: response.source,
				cached: response.cached,
				freshness: response.freshness,
				quality: response.quality,
				responseTime: response.responseTime,
				provider: response.provider,
				timestamp: response.timestamp,
				totalRecords: response.data.length,
			},
		});
	} catch (error) {
		console.error("Historical data API error:", error);
		const normalizedError = ErrorHandler.normalizeError(error);
		return NextResponse.json(
			{
				success: false,
				error: "Failed to retrieve historical data",
				message: normalizedError.message,
			},
			{ status: 500 }
		);
	}
}

/**
 * POST /api/historical-data/backfill
 * Trigger historical data backfill
 */
export async function POST(request: NextRequest) {
	try {
		await ensureInitialized();

		const body = await request.json();
		const {
			symbols,
			startDate,
			endDate,
			timeframes = ["1d"],
			batchSize = 50,
			delayBetweenBatches = 1000,
			preferredSources = ["Polygon", "TwelveData", "Yahoo Finance"],
			validateData = true,
			skipExisting = true,
		} = body;

		// Validation
		if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
			return NextResponse.json({ error: "Symbols array is required" }, { status: 400 });
		}

		if (!startDate || !endDate) {
			return NextResponse.json(
				{ error: "Start date and end date are required" },
				{ status: 400 }
			);
		}

		// Limit to reasonable batch sizes to prevent overwhelming
		if (symbols.length > 1000) {
			return NextResponse.json(
				{ error: "Maximum 1000 symbols per backfill request" },
				{ status: 400 }
			);
		}

		// Prepare backfill options
		const backfillOptions = {
			symbols: symbols.map((s: string) => s.toUpperCase()),
			startDate: new Date(startDate),
			endDate: new Date(endDate),
			timeframes,
			batchSize,
			delayBetweenBatches,
			preferredSources,
			validateData,
			skipExisting,
		};

		// Start backfill process
		const result = await databaseMigrationService.backfillHistoricalData(backfillOptions);

		return NextResponse.json({
			success: result.success,
			message: result.message,
			duration: result.duration,
			recordsProcessed: result.recordsProcessed,
			errors: result.errors,
		});
	} catch (error) {
		console.error("Backfill API error:", error);
		const normalizedError = ErrorHandler.normalizeError(error);
		return NextResponse.json(
			{
				success: false,
				error: "Failed to start backfill process",
				message: normalizedError.message,
			},
			{ status: 500 }
		);
	}
}

// Note: Cache metrics endpoint moved to /api/historical-data/metrics/route.ts

/**
 * DELETE /api/historical-data/cache
 * Clear cache for specific symbol or all data
 */
export async function DELETE(request: NextRequest) {
	try {
		await ensureInitialized();

		const { searchParams } = new URL(request.url);
		const symbol = searchParams.get("symbol")?.toUpperCase();
		const timeframe = searchParams.get("timeframe");

		await financialDataCacheService.clearCache(symbol, timeframe || undefined);

		return NextResponse.json({
			success: true,
			message: symbol
				? `Cache cleared for ${symbol}${timeframe ? ` (${timeframe})` : ""}`
				: "All caches cleared",
		});
	} catch (error) {
		console.error("Cache clear API error:", error);
		const normalizedError = ErrorHandler.normalizeError(error);
		return NextResponse.json(
			{
				success: false,
				error: "Failed to clear cache",
				message: normalizedError.message,
			},
			{ status: 500 }
		);
	}
}
