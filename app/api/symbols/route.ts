/**
 * Stock Symbols API Route
 * Provides access to stock symbol data with daily auto-refresh functionality
 */

import { NextRequest, NextResponse } from "next/server";
import { symbolDataService } from "../../services/financial-data/SymbolDataService";
import ErrorHandler from "../../services/error-handling/ErrorHandler";

export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const forceRefresh = searchParams.get("refresh") === "true";
		const query = searchParams.get("q");
		const limit = parseInt(searchParams.get("limit") || "50");

		console.log(
			`📡 Symbols API request - refresh: ${forceRefresh}, query: ${query}, limit: ${limit}`
		);

		// Get symbols with auto-refresh logic
		const symbols = await symbolDataService.getSymbols(forceRefresh);

		// Filter results if query provided
		let filteredSymbols = symbols;
		if (query && query.length > 0) {
			const queryLower = query.toLowerCase();
			filteredSymbols = symbols
				.filter(
					symbol =>
						symbol.symbol.toLowerCase().includes(queryLower) ||
						symbol.name.toLowerCase().includes(queryLower)
				)
				.slice(0, limit);
		} else {
			filteredSymbols = symbols.slice(0, limit);
		}

		// Get refresh status
		const refreshStatus = await symbolDataService.getRefreshStatus();

		return NextResponse.json({
			success: true,
			data: {
				symbols: filteredSymbols,
				metadata: {
					total: symbols.length,
					filtered: filteredSymbols.length,
					query: query || null,
					refreshStatus: refreshStatus || null,
				},
			},
			timestamp: Date.now(),
		});
	} catch (error) {
		const normalizedError = ErrorHandler.normalizeError(error);
		console.error("❌ Symbols API error:", normalizedError);

		return NextResponse.json(
			{
				success: false,
				error: "Failed to fetch stock symbols",
				message: normalizedError.message,
				timestamp: Date.now(),
			},
			{ status: 500 }
		);
	}
}

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const action = body.action;

		if (action === "refresh") {
			console.log("🔄 Manual symbol refresh requested");
			const symbols = await symbolDataService.forceRefresh();
			const refreshStatus = await symbolDataService.getRefreshStatus();

			return NextResponse.json({
				success: true,
				message: "Symbols refreshed successfully",
				data: {
					totalSymbols: symbols.length,
					refreshStatus,
				},
				timestamp: Date.now(),
			});
		}

		if (action === "status") {
			const refreshStatus = await symbolDataService.getRefreshStatus();
			return NextResponse.json({
				success: true,
				data: { refreshStatus },
				timestamp: Date.now(),
			});
		}

		return NextResponse.json(
			{
				success: false,
				error: "Invalid action",
				message: "Supported actions: refresh, status",
			},
			{ status: 400 }
		);
	} catch (error) {
		const normalizedError = ErrorHandler.normalizeError(error);
		console.error("❌ Symbols API POST error:", normalizedError);

		return NextResponse.json(
			{
				success: false,
				error: "Symbol operation failed",
				message: normalizedError.message,
				timestamp: Date.now(),
			},
			{ status: 500 }
		);
	}
}
