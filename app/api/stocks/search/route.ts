/**
 * Stock Search API Route
 * Provides real-time stock symbol search using FMP API
 */

import { NextRequest, NextResponse } from "next/server";
import ErrorHandler from "../../../services/error-handling/ErrorHandler";

export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const query = searchParams.get("query");

		if (!query || query.length < 1) {
			return NextResponse.json(
				{
					success: false,
					error: "Query parameter is required",
					message: "Please provide a search query",
				},
				{ status: 400 }
			);
		}

		console.log(`🔍 Stock search request: "${query}"`);

		// Call FMP search API directly
		const fmpApiKey = process.env.FMP_API_KEY;
		if (!fmpApiKey) {
			throw new Error("FMP API key not configured");
		}

		const fmpUrl = `https://financialmodelingprep.com/api/v3/search?query=${encodeURIComponent(query)}&limit=20&apikey=${fmpApiKey}`;

		const response = await fetch(fmpUrl);

		if (!response.ok) {
			throw new Error(`FMP API error: ${response.status} ${response.statusText}`);
		}

		const fmpData = await response.json();

		// Transform FMP response to our format
		const results = (fmpData || []).map((item: any) => ({
			symbol: item.symbol,
			name: item.name,
			exchange: item.exchangeShortName || item.stockExchange || "N/A",
			type: item.exchangeShortName?.includes("ETF") ? "ETF" : "Stock",
			status: "Active",
			matchScore: 100, // FMP returns relevant results
			matchType: "both",
			currency: item.currency,
		}));

		console.log(`✅ Found ${results.length} results for "${query}"`);

		return NextResponse.json({
			success: true,
			data: {
				results,
				query,
				total: results.length,
			},
			timestamp: Date.now(),
		});
	} catch (error) {
		const normalizedError = ErrorHandler.normalizeError(error);
		console.error("❌ Stock search error:", normalizedError);

		return NextResponse.json(
			{
				success: false,
				error: "Stock search failed",
				message: normalizedError.message,
				timestamp: Date.now(),
			},
			{ status: 500 }
		);
	}
}
