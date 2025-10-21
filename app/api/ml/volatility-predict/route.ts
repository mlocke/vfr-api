/**
 * Volatility Prediction API Route
 *
 * Endpoints:
 * - GET  /api/ml/volatility-predict?symbol=AAPL - Single prediction
 * - POST /api/ml/volatility-predict - Batch predictions
 *
 * Features:
 * - 5-minute caching via Redis
 * - Feature extraction (when VolatilityFeatureExtractor is ready)
 * - Error handling with appropriate HTTP status codes
 * - Request validation
 */

import { NextRequest, NextResponse } from "next/server";
import { VolatilityPredictionService } from "@/app/services/ml/volatility-prediction/VolatilityPredictionService";
import { VolatilityFeatureExtractor } from "@/app/services/ml/volatility-prediction/VolatilityFeatureExtractor";
import type { VolatilityFeatures } from "@/app/services/ml/volatility-prediction/types";

/**
 * GET /api/ml/volatility-predict?symbol=AAPL
 *
 * Query parameters:
 * - symbol: Stock symbol (required)
 *
 * Response:
 * {
 *   "symbol": "AAPL",
 *   "predicted_volatility": 32.5,
 *   "confidence_level": "high",
 *   "risk_category": "moderate",
 *   "prediction_horizon_days": 21,
 *   "timestamp": "2025-10-19T20:30:00.000Z",
 *   "feature_completeness": 0.97,
 *   "reasoning": "Predicted 32.5% volatility (moderate risk): Recent volatility stable; Normal environment"
 * }
 */
export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const symbol = searchParams.get("symbol");

		// Validate symbol parameter
		if (!symbol) {
			return NextResponse.json(
				{ error: "Missing required parameter: symbol" },
				{ status: 400 }
			);
		}

		// Validate symbol format (uppercase letters, 1-5 chars)
		if (!/^[A-Z]{1,5}$/.test(symbol.toUpperCase())) {
			return NextResponse.json(
				{ error: "Invalid symbol format. Expected 1-5 uppercase letters." },
				{ status: 400 }
			);
		}

		// Get prediction service and feature extractor instances
		const service = VolatilityPredictionService.getInstance();
		const featureExtractor = new VolatilityFeatureExtractor();

		// Extract features for the symbol
		const features = await featureExtractor.extractFeatures(symbol.toUpperCase());

		if (!features) {
			return NextResponse.json(
				{
					error: "Unable to extract features",
					details: "Failed to fetch required data from Polygon API",
				},
				{ status: 503 }
			);
		}

		// Make prediction with extracted features
		const prediction = await service.predict(symbol.toUpperCase(), features);

		if (!prediction) {
			return NextResponse.json(
				{
					error: "Unable to generate volatility prediction",
					details: "Low confidence prediction filtered out or insufficient data",
				},
				{ status: 404 }
			);
		}

		return NextResponse.json(prediction, { status: 200 });
	} catch (error) {
		console.error("Volatility prediction API error:", error);

		const errorMessage = error instanceof Error ? error.message : "Unknown error";

		// Handle specific error types
		if (errorMessage.includes("Model file not found")) {
			return NextResponse.json(
				{
					error: "Model not available",
					details: "Volatility prediction model not yet trained or deployed",
				},
				{ status: 503 }
			);
		}

		if (errorMessage.includes("Feature extraction not yet implemented")) {
			return NextResponse.json(
				{
					error: "Feature extraction unavailable",
					details: "VolatilityFeatureExtractor service not yet implemented",
				},
				{ status: 501 }
			);
		}

		return NextResponse.json(
			{
				error: "Prediction failed",
				details: errorMessage,
			},
			{ status: 500 }
		);
	}
}

/**
 * POST /api/ml/volatility-predict
 *
 * Request body:
 * {
 *   "symbols": ["AAPL", "MSFT", "GOOGL"]
 * }
 *
 * Response:
 * {
 *   "predictions": [
 *     {
 *       "symbol": "AAPL",
 *       "predicted_volatility": 32.5,
 *       ...
 *     },
 *     ...
 *   ],
 *   "total": 3,
 *   "successful": 3,
 *   "failed": []
 * }
 */
export async function POST(request: NextRequest) {
	try {
		// Parse request body
		let body;
		try {
			body = await request.json();
		} catch (error) {
			return NextResponse.json(
				{ error: "Invalid JSON in request body" },
				{ status: 400 }
			);
		}

		const { symbols } = body;

		// Validate symbols array
		if (!Array.isArray(symbols) || symbols.length === 0) {
			return NextResponse.json(
				{ error: "Missing or empty 'symbols' array in request body" },
				{ status: 400 }
			);
		}

		// Limit batch size to prevent abuse
		const MAX_BATCH_SIZE = 50;
		if (symbols.length > MAX_BATCH_SIZE) {
			return NextResponse.json(
				{
					error: `Batch size exceeds maximum of ${MAX_BATCH_SIZE} symbols`,
					received: symbols.length,
				},
				{ status: 400 }
			);
		}

		// Validate each symbol
		const invalidSymbols = symbols.filter(
			(s: any) => typeof s !== "string" || !/^[A-Z]{1,5}$/.test(s.toUpperCase())
		);

		if (invalidSymbols.length > 0) {
			return NextResponse.json(
				{
					error: "Invalid symbols in request",
					invalid: invalidSymbols,
				},
				{ status: 400 }
			);
		}

		// Get prediction service and feature extractor instances
		const service = VolatilityPredictionService.getInstance();
		const featureExtractor = new VolatilityFeatureExtractor();

		// Normalize symbols to uppercase
		const normalizedSymbols = symbols.map((s: string) => s.toUpperCase());

		// Extract features for all symbols
		const featuresMap = new Map<string, VolatilityFeatures>();
		for (const sym of normalizedSymbols) {
			try {
				const features = await featureExtractor.extractFeatures(sym);
				if (features) {
					featuresMap.set(sym, features);
				}
			} catch (error) {
				console.warn(`Failed to extract features for ${sym}:`, error);
			}
		}

		// Make batch predictions with extracted features
		const predictions = await service.batchPredict(normalizedSymbols, featuresMap);

		// Identify failed symbols
		const successfulSymbols = new Set(predictions.map(p => p.symbol));
		const failedSymbols = normalizedSymbols.filter(s => !successfulSymbols.has(s));

		return NextResponse.json(
			{
				predictions,
				total: normalizedSymbols.length,
				successful: predictions.length,
				failed: failedSymbols,
			},
			{ status: 200 }
		);
	} catch (error) {
		console.error("Batch volatility prediction API error:", error);

		const errorMessage = error instanceof Error ? error.message : "Unknown error";

		return NextResponse.json(
			{
				error: "Batch prediction failed",
				details: errorMessage,
			},
			{ status: 500 }
		);
	}
}
