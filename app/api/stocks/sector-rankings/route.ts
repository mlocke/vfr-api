/**
 * Sector Performance Rankings API Endpoint
 * Provides comprehensive sector performance rankings with multi-timeframe analysis
 */

import { NextRequest, NextResponse } from "next/server";
import { SectorDataService } from "@/app/services/financial-data/SectorDataService";
import SecurityValidator from "@/app/services/security/SecurityValidator";
import { createServiceErrorHandler } from "@/app/services/error-handling";

const sectorDataService = new SectorDataService();
const errorHandler = createServiceErrorHandler("SectorRankingsAPI");

export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const format = searchParams.get("format") || "full"; // 'full' or 'quick'

		// Validate request parameters
		SecurityValidator.validateSymbol(format);

		let rankings;
		if (format === "quick") {
			// Get simplified rankings for quick display
			rankings = await sectorDataService.getSectorRankingsQuick();
		} else {
			// Get full comprehensive rankings
			rankings = await sectorDataService.getSectorPerformanceRankings();
		}

		return NextResponse.json(
			{
				success: true,
				data: rankings,
				timestamp: Date.now(),
				format: format,
				message: `Sector ${format} rankings retrieved successfully`,
			},
			{ status: 200 }
		);
	} catch (error) {
		console.error("Sector Rankings API Error:", error);

		const errorResponse = errorHandler.errorHandler.createErrorResponse(
			error,
			"getSectorRankings"
		);

		return NextResponse.json(
			{
				success: false,
				error: errorResponse.error || "Failed to retrieve sector rankings",
				timestamp: Date.now(),
				format: "error",
			},
			{ status: 500 }
		);
	}
}

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const { sectors, timeframe, includeAnalysis } = body;

		// Validate inputs
		if (sectors && Array.isArray(sectors)) {
			sectors.forEach((sector: string) => {
				SecurityValidator.validateSymbol(sector);
			});
		}

		if (timeframe) {
			SecurityValidator.validateSymbol(timeframe);
		}

		// Get comprehensive rankings first
		const fullRankings = await sectorDataService.getSectorPerformanceRankings();

		// Filter results if specific sectors requested
		let filteredRankings = fullRankings;
		if (sectors && sectors.length > 0) {
			filteredRankings = {
				...fullRankings,
				rankings: fullRankings.rankings.filter(ranking =>
					sectors.some(
						(sector: string) =>
							ranking.sector.toLowerCase().includes(sector.toLowerCase()) ||
							ranking.symbol.toLowerCase() === sector.toLowerCase()
					)
				),
			};
		}

		// Add custom analysis if requested
		if (includeAnalysis) {
			const analysis = {
				topPerformer: filteredRankings.rankings[0],
				worstPerformer: filteredRankings.rankings[filteredRankings.rankings.length - 1],
				marketSentiment: filteredRankings.marketContext.sentiment,
				rotationStrength: filteredRankings.rotationSignals.strength,
				recommendedActions: {
					buy: filteredRankings.rotationSignals.intoSectors.slice(0, 3),
					avoid: filteredRankings.rotationSignals.outOfSectors.slice(0, 3),
					reasoning: `Market is in ${filteredRankings.marketContext.phase} phase with ${filteredRankings.marketContext.sentiment} sentiment`,
				},
			};

			return NextResponse.json(
				{
					success: true,
					data: filteredRankings,
					analysis,
					timestamp: Date.now(),
					message: "Custom sector analysis completed successfully",
				},
				{ status: 200 }
			);
		}

		return NextResponse.json(
			{
				success: true,
				data: filteredRankings,
				timestamp: Date.now(),
				message: "Filtered sector rankings retrieved successfully",
			},
			{ status: 200 }
		);
	} catch (error) {
		console.error("Sector Rankings POST API Error:", error);

		const errorResponse = errorHandler.errorHandler.createErrorResponse(
			error,
			"postSectorRankings"
		);

		return NextResponse.json(
			{
				success: false,
				error: errorResponse.error || "Failed to process sector rankings request",
				timestamp: Date.now(),
			},
			{ status: 500 }
		);
	}
}
