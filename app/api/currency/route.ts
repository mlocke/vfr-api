/**
 * Currency Data API Routes
 * Provides real-time currency analysis and sector correlation data
 */

import { NextRequest, NextResponse } from "next/server";
import { currencyDataService } from "../../services/financial-data/CurrencyDataService";
import securityValidator from "../../services/security/SecurityValidator";
import ErrorHandler from "../../services/error-handling/ErrorHandler";

export async function GET(request: NextRequest) {
	const startTime = Date.now();
	const url = new URL(request.url);
	const searchParams = url.searchParams;

	try {
		const action = searchParams.get("action") || "analysis";
		const sector = searchParams.get("sector");

		// Validate inputs using basic regex patterns
		const alphanumericPattern = /^[a-zA-Z0-9_-]+$/;

		if (action && !alphanumericPattern.test(action)) {
			return NextResponse.json({ error: "Invalid action parameter" }, { status: 400 });
		}

		if (sector && !alphanumericPattern.test(sector)) {
			return NextResponse.json({ error: "Invalid sector parameter" }, { status: 400 });
		}

		let result;
		let endpoint = "currency-analysis";

		switch (action) {
			case "analysis":
			case "full":
				endpoint = "full-currency-analysis";
				result = await currencyDataService.getCurrencyAnalysis();
				break;

			case "dxy":
				endpoint = "dxy-index";
				result = await currencyDataService.getDollarIndex();
				break;

			case "pairs":
				endpoint = "currency-pairs";
				result = await currencyDataService.getMajorCurrencyPairs();
				break;

			case "strengths":
				endpoint = "currency-strengths";
				result = await currencyDataService.getCurrencyStrengths();
				break;

			case "sector":
				if (!sector) {
					return NextResponse.json(
						{ error: "Sector parameter required for sector analysis" },
						{ status: 400 }
					);
				}
				endpoint = `sector-currency-impact-${sector.toLowerCase()}`;
				result = await currencyDataService.getSectorCurrencyImpact(sector);
				break;

			case "health":
				endpoint = "currency-health-check";
				const isHealthy = await currencyDataService.healthCheck();
				result = {
					healthy: isHealthy,
					service: "Currency Data Service",
					timestamp: Date.now(),
				};
				break;

			default:
				return NextResponse.json(
					{
						error: "Invalid action. Supported: analysis, dxy, pairs, strengths, sector, health",
					},
					{ status: 400 }
				);
		}

		const elapsed = Date.now() - startTime;

		if (!result) {
			console.warn(`Currency API: No data available for action: ${action}`);
			return NextResponse.json(
				{
					error: "No data available",
					action,
					message:
						"Currency data service returned no results. This may be due to API limits or network issues.",
					elapsed: `${elapsed}ms`,
				},
				{ status: 503 }
			);
		}

		return NextResponse.json({
			success: true,
			data: result,
			metadata: {
				action,
				endpoint,
				responseTime: `${elapsed}ms`,
				timestamp: Date.now(),
				dataSource: "currency-service",
			},
		});
	} catch (error) {
		const elapsed = Date.now() - startTime;
		console.error("Currency API error:", error);

		const normalizedError = ErrorHandler.normalizeError(error);

		return NextResponse.json(
			{
				error: "Currency analysis failed",
				message: normalizedError.message,
				action: searchParams.get("action") || "unknown",
				elapsed: `${elapsed}ms`,
				timestamp: Date.now(),
			},
			{ status: 500 }
		);
	}
}

/**
 * POST endpoint for batch currency operations
 */
export async function POST(request: NextRequest) {
	const startTime = Date.now();

	try {
		const body = await request.json();
		const { sectors, includeAnalysis = true } = body;

		// Validate sectors input
		if (!Array.isArray(sectors)) {
			return NextResponse.json({ error: "Sectors must be an array" }, { status: 400 });
		}

		// Validate each sector
		const alphanumericPattern = /^[a-zA-Z0-9_-\s]+$/;
		for (const sector of sectors) {
			if (!alphanumericPattern.test(sector)) {
				return NextResponse.json({ error: `Invalid sector: ${sector}` }, { status: 400 });
			}
		}

		const results: any = {
			sectors: {},
			timestamp: Date.now(),
		};

		// Get sector impacts in parallel
		const sectorPromises = sectors.map(async (sector: string) => {
			try {
				const impact = await currencyDataService.getSectorCurrencyImpact(sector);
				return { sector, impact };
			} catch (error) {
				console.warn(`Failed to get currency impact for sector ${sector}:`, error);
				return { sector, impact: null, error: "Failed to fetch data" };
			}
		});

		const sectorResults = await Promise.allSettled(sectorPromises);

		// Process results
		sectorResults.forEach(result => {
			if (result.status === "fulfilled") {
				const { sector, impact, error } = result.value;
				results.sectors[sector] = impact
					? {
							...impact,
							error: error || null,
						}
					: {
							error: error || "No data available",
						};
			}
		});

		// Include full analysis if requested
		if (includeAnalysis) {
			results.analysis = await currencyDataService.getCurrencyAnalysis();
		}

		const elapsed = Date.now() - startTime;

		return NextResponse.json({
			success: true,
			data: results,
			metadata: {
				sectorsRequested: sectors.length,
				sectorsProcessed: Object.keys(results.sectors).length,
				includeAnalysis,
				responseTime: `${elapsed}ms`,
				timestamp: Date.now(),
				dataSource: "currency-service",
			},
		});
	} catch (error) {
		const elapsed = Date.now() - startTime;
		console.error("Currency batch API error:", error);

		const normalizedError = ErrorHandler.normalizeError(error);

		return NextResponse.json(
			{
				error: "Batch currency analysis failed",
				message: normalizedError.message,
				elapsed: `${elapsed}ms`,
				timestamp: Date.now(),
			},
			{ status: 500 }
		);
	}
}
