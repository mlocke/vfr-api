/**
 * Stock Search API Route
 * Provides real-time stock symbol search using FMP API with Redis caching
 */

import { NextRequest, NextResponse } from "next/server";
import ErrorHandler from "../../../services/error-handling/ErrorHandler";
import { redisCache } from "../../../services/cache/RedisCache";

interface SearchResult {
	symbol: string;
	name: string;
	exchange: string;
	type: string;
	status: string;
	matchScore: number;
	matchType: string;
	currency?: string;
}

interface CachedSearchResponse {
	results: SearchResult[];
	query: string;
	total: number;
}

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

		// Create cache key for this search query
		const cacheKey = `stock:search:${query.toLowerCase().trim()}`;

		// Try to get cached results first
		const cachedResults = await redisCache.get<CachedSearchResponse>(cacheKey);

		if (cachedResults) {
			console.log(`✅ Cache HIT for search query: "${query}"`);
			return NextResponse.json({
				success: true,
				data: cachedResults,
				timestamp: Date.now(),
				cached: true,
			});
		}

		console.log(`📡 Cache MISS - fetching from FMP API for: "${query}"`);

		// Call FMP search API
		const fmpApiKey = process.env.FMP_API_KEY;
		if (!fmpApiKey) {
			throw new Error("FMP API key not configured");
		}

		const fmpUrl = `https://financialmodelingprep.com/api/v3/search?query=${encodeURIComponent(query)}&limit=20&apikey=${fmpApiKey}`;

		const response = await fetch(fmpUrl);

		if (!response.ok) {
			// Handle rate limiting specifically
			if (response.status === 429) {
				console.error(`⚠️ FMP API rate limit exceeded for query: "${query}"`);
				return NextResponse.json(
					{
						success: false,
						error: "Rate limit exceeded",
						message: "Too many requests. Please try again in a moment.",
						timestamp: Date.now(),
					},
					{ status: 429 }
				);
			}
			throw new Error(`FMP API error: ${response.status} ${response.statusText}`);
		}

		const fmpData = await response.json();

		// Transform FMP response to our format
		const results: SearchResult[] = (fmpData || []).map((item: any) => ({
			symbol: item.symbol,
			name: item.name,
			exchange: item.exchangeShortName || item.stockExchange || "N/A",
			type: item.exchangeShortName?.includes("ETF") ? "ETF" : "Stock",
			status: "Active",
			matchScore: 100, // FMP returns relevant results
			matchType: "both",
			currency: item.currency,
		}));

		const searchResponse: CachedSearchResponse = {
			results,
			query,
			total: results.length,
		};

		// Cache the results for 5 minutes (300 seconds)
		// This prevents repeated API calls for the same search query
		await redisCache.set(cacheKey, searchResponse, 300, {
			source: "fmp-search",
			version: "1.0.0",
		});

		console.log(`✅ Found ${results.length} results for "${query}" (cached for 5 min)`);

		return NextResponse.json({
			success: true,
			data: searchResponse,
			timestamp: Date.now(),
			cached: false,
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
