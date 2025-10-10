/**
 * Sentiment Fusion API Endpoint
 * POST /api/stocks/sentiment-fusion
 *
 * Provides FinBERT-powered sentiment predictions for 2-week price direction
 * Combines news, social, options, analyst, and macro sentiment signals
 *
 * Returns: BULLISH, NEUTRAL, or BEARISH prediction with confidence
 */

import { NextRequest, NextResponse } from "next/server";
import { SentimentFusionService } from "../../../services/ml/sentiment-fusion/SentimentFusionService";
import { z } from "zod";

// Request validation schema
const SentimentFusionRequestSchema = z.object({
	symbol: z.string().min(1).max(10).toUpperCase(),
	sector: z.string().optional(),
});

// Initialize service (singleton pattern)
let sentimentFusionService: SentimentFusionService | null = null;

function getService(): SentimentFusionService {
	if (!sentimentFusionService) {
		sentimentFusionService = new SentimentFusionService({
			confidenceThresholdHigh: 0.65, // High confidence only
			enableCaching: true,
			cacheTTL: 900, // 15 minutes
		});
	}
	return sentimentFusionService;
}

export async function POST(request: NextRequest) {
	const startTime = Date.now();

	try {
		// Parse and validate request body
		const body = await request.json();
		const validationResult = SentimentFusionRequestSchema.safeParse(body);

		if (!validationResult.success) {
			return NextResponse.json(
				{
					success: false,
					error: "Invalid request parameters",
					details: validationResult.error.issues,
				},
				{ status: 400 }
			);
		}

		const { symbol, sector } = validationResult.data;

		// Get sentiment prediction
		const service = getService();
		const prediction = await service.predict(symbol);

		const latency = Date.now() - startTime;

		// Return prediction or low confidence response
		if (prediction) {
			return NextResponse.json({
				success: true,
				data: {
					symbol,
					prediction: {
						direction: prediction.direction,
						confidence: prediction.confidence,
						probabilities: prediction.probabilities,
						horizon: prediction.horizon,
						reasoning: prediction.reasoning,
						model_version: prediction.model_version,
						timestamp: prediction.prediction_timestamp,
					},
					latency_ms: latency,
				},
			});
		} else {
			return NextResponse.json({
				success: false,
				error: "Low confidence prediction",
				message:
					"Sentiment signals are not strong enough for a reliable prediction",
				data: {
					symbol,
					threshold: 0.65,
					latency_ms: latency,
				},
			});
		}
	} catch (error) {
		console.error("Sentiment fusion API error:", error);

		return NextResponse.json(
			{
				success: false,
				error: "Internal server error",
				message:
					error instanceof Error ? error.message : "Unknown error occurred",
			},
			{ status: 500 }
		);
	}
}

export async function GET(request: NextRequest) {
	try {
		const service = getService();
		const health = await service.getHealthStatus();

		return NextResponse.json({
			success: true,
			service: "Sentiment Fusion",
			status: health.modelLoaded && health.cacheConnected ? "healthy" : "degraded",
			details: health,
		});
	} catch (error) {
		return NextResponse.json(
			{
				success: false,
				service: "Sentiment Fusion",
				status: "unhealthy",
				error: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 503 }
		);
	}
}
