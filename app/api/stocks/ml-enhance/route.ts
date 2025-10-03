/**
 * ML Enhancement API - Single POST endpoint for ML-enhanced scoring
 * Takes ticker + base score, returns enhanced score using MLPredictionService
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { MLPredictionService } from "../../../services/ml/prediction/MLPredictionService";
import { MLFactors } from "../../../services/ml/MLPredictionService";
import { FeatureEngineeringService } from "../../../services/ml/features/FeatureEngineeringService";
import { RedisCache } from "../../../services/cache/RedisCache";
import SecurityValidator from "../../../services/security/SecurityValidator";

// Request validation
const RequestSchema = z.object({
	ticker: z.string().min(1).max(10),
	baseScore: z.number().min(0).max(100),
	factors: z
		.object({
			technical: z.record(z.string(), z.number()).optional(),
			fundamental: z.record(z.string(), z.number()).optional(),
			sentiment: z.record(z.string(), z.number()).optional(),
			macro: z.record(z.string(), z.number()).optional(),
			options: z.record(z.string(), z.number()).optional(),
		})
		.optional(),
});

// Initialize ML service (lazy initialization)
let mlService: MLPredictionService | null = null;

/**
 * Get or initialize MLPredictionService
 */
async function getMLService(): Promise<MLPredictionService> {
	if (mlService) {
		return mlService;
	}

	try {
		mlService = new MLPredictionService();
		console.log("✅ MLPredictionService initialized");
		return mlService;
	} catch (error) {
		console.error("Failed to initialize MLPredictionService:", error);
		throw new Error("ML service initialization failed");
	}
}

/**
 * POST endpoint - ML score enhancement
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
	try {
		console.log("🤖 Starting ML enhancement...");

		// Parse and validate request
		const body = await request.json();
		const { ticker, baseScore, factors } = RequestSchema.parse(body);

		// TODO: Re-enable security validation after testing
		// Basic validation for now
		if (!ticker || typeof ticker !== "string" || ticker.length > 5) {
			return NextResponse.json(
				{
					success: false,
					error: "Invalid ticker symbol",
				},
				{ status: 400 }
			);
		}

		if (typeof baseScore !== "number" || baseScore < 0 || baseScore > 100) {
			return NextResponse.json(
				{
					success: false,
					error: "Invalid base score",
				},
				{ status: 400 }
			);
		}

		// Use cleaned ticker
		const sanitizedTicker = ticker.trim().toUpperCase();

		// Get ML service
		const service = await getMLService();

		console.log("📊 Enhancing score:", { ticker: sanitizedTicker, baseScore });

		// Execute ML enhancement using prediction service
		const startTime = Date.now();
		const baseScoreMap = new Map([[sanitizedTicker.toUpperCase(), baseScore]]);
		const mlEnhancements = await service.getMLEnhancement(
			[sanitizedTicker.toUpperCase()],
			"premium",
			baseScoreMap
		);
		const processingTime = Date.now() - startTime;

		const mlScore = mlEnhancements.get(sanitizedTicker.toUpperCase()) || baseScore;
		const mlContribution = mlScore - baseScore;

		// Calculate final enhanced score (90% VFR + 10% ML)
		const enhancedScore = baseScore * 0.9 + mlScore * 0.1;

		console.log(`✅ ML enhancement completed in ${processingTime}ms`, {
			baseScore,
			mlScore,
			enhancedScore,
			mlContribution,
		});

		return NextResponse.json({
			success: true,
			data: {
				ticker: sanitizedTicker.toUpperCase(),
				baseScore,
				enhancedScore: Math.round(enhancedScore * 100) / 100,
				enhancement: {
					vfrWeight: 0.9,
					mlWeight: 0.1,
					mlContribution: Math.round(mlContribution * 100) / 100,
					confidence: service.isAvailable() ? 0.8 : 0.1,
					fallbackUsed: !service.isAvailable(),
				},
				processingTimeMs: processingTime,
			},
		});
	} catch (error) {
		console.error("ML enhancement error:", error);

		// Return appropriate status codes
		if (error instanceof z.ZodError) {
			return NextResponse.json(
				{
					success: false,
					error: "Invalid request format: " + error.issues.map(e => e.message).join(", "),
				},
				{ status: 400 }
			);
		}

		return NextResponse.json(
			{
				success: false,
				error: "ML enhancement failed",
			},
			{ status: 500 }
		);
	}
}

/**
 * GET endpoint - Health check
 */
export async function GET(): Promise<NextResponse> {
	try {
		const service = await getMLService();

		return NextResponse.json({
			success: true,
			data: {
				status: service.isAvailable() ? "healthy" : "degraded",
				enabled: service.isAvailable(),
				timestamp: Date.now(),
			},
		});
	} catch (error) {
		return NextResponse.json(
			{
				success: false,
				error: "ML service health check failed",
			},
			{ status: 500 }
		);
	}
}
