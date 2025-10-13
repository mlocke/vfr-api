/**
 * Comprehensive Stock Analysis API - Admin Dashboard Integration
 * Uses StockSelectionService for full analysisInputServices metadata
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { MLEnhancedStockSelectionService } from "../../../services/stock-selection/MLEnhancedStockSelectionService";
import {
	SelectionRequest,
	SelectionMode,
	AnalysisScope,
} from "../../../services/stock-selection/types";
import { FinancialDataService } from "../../../services/financial-data/FinancialDataService";
import { FactorLibrary } from "../../../services/algorithms/FactorLibrary";
import { RedisCache } from "../../../services/cache/RedisCache";
import { TechnicalIndicatorService } from "../../../services/technical-analysis/TechnicalIndicatorService";
import { MacroeconomicAnalysisService } from "../../../services/financial-data/MacroeconomicAnalysisService";
import SentimentAnalysisService from "../../../services/financial-data/SentimentAnalysisService";
import { VWAPService } from "../../../services/financial-data/VWAPService";
import ESGDataService from "../../../services/financial-data/ESGDataService";
import ShortInterestService from "../../../services/financial-data/ShortInterestService";
import { ExtendedMarketDataService } from "../../../services/financial-data/ExtendedMarketDataService";
import { OptionsDataService } from "../../../services/financial-data/OptionsDataService";
import { FinancialModelingPrepAPI } from "../../../services/financial-data/FinancialModelingPrepAPI";
import { MLPredictionService } from "../../../services/ml/prediction/MLPredictionService";
import { FeatureEngineeringService } from "../../../services/ml/features/FeatureEngineeringService";
import { ProgressTracker } from "../../../services/progress/ProgressTracker";
import { sendProgressUpdate, closeProgressSession } from "./progress/[sessionId]/progressUtils";

// Request validation - supports admin dashboard test format
const RequestSchema = z.object({
	mode: z.enum(["single", "sector", "multiple"]),
	symbols: z.array(z.string()).optional(),
	sector: z.string().optional(),
	limit: z.number().min(1).max(50).default(10),
	config: z
		.object({
			symbol: z.string().optional(),
			preferredDataSources: z.array(z.string()).optional(),
			timeout: z.number().optional(),
		})
		.optional(),
	// ML Enhancement Parameters (Phase 4.1)
	include_ml: z.boolean().optional().default(true), // Enabled by default - 4-model ensemble (sentiment-fusion, price-prediction, early-signal-detection, smart-money-flow)
	ml_horizon: z.enum(["1h", "4h", "1d", "1w", "1m"]).optional().default("1w"),
	ml_confidence_threshold: z.number().min(0).max(1).optional().default(0.5),
	ml_weight: z.number().min(0).max(1).optional().default(0.15),
	ml_timeout: z.number().min(100).max(30000).optional().default(5000), // Allow Python server initialization time
	// Real-time progress tracking
	sessionId: z.string().optional(), // Optional session ID for progress tracking
});

// Initialize services (lazy initialization for optimal performance)
let stockSelectionService: MLEnhancedStockSelectionService | null = null;

/**
 * Get or initialize the comprehensive MLEnhancedStockSelectionService (Phase 4.1)
 */
async function getStockSelectionService(): Promise<MLEnhancedStockSelectionService> {
	if (stockSelectionService) {
		return stockSelectionService;
	}

	try {
		// Initialize core dependencies
		const cache = new RedisCache();
		const financialDataService = new FinancialDataService();
		const factorLibrary = new FactorLibrary();

		// Initialize optional services
		let technicalService: TechnicalIndicatorService | undefined;
		try {
			technicalService = new TechnicalIndicatorService(cache);
		} catch (error) {
			console.warn("Technical analysis service not available:", error);
		}

		let macroeconomicService: MacroeconomicAnalysisService | undefined;
		try {
			macroeconomicService = new MacroeconomicAnalysisService({
				fredApiKey: process.env.FRED_API_KEY,
				blsApiKey: process.env.BLS_API_KEY,
				eiaApiKey: process.env.EIA_API_KEY,
			});
		} catch (error) {
			console.warn("Macroeconomic service not available:", error);
		}

		let sentimentService: SentimentAnalysisService | undefined;
		try {
			// Yahoo Finance sentiment doesn't need API key
			sentimentService = new SentimentAnalysisService(cache);
		} catch (error) {
			console.warn("Sentiment analysis service not available:", error);
		}

		let vwapService: VWAPService | undefined;
		try {
			if (process.env.FMP_API_KEY) {
				const fmpAPI = new FinancialModelingPrepAPI(process.env.FMP_API_KEY);
				vwapService = new VWAPService(fmpAPI, cache);
			}
		} catch (error) {
			console.warn("VWAP service not available:", error);
		}

		let esgService: ESGDataService | undefined;
		try {
			esgService = new ESGDataService({
				apiKey: process.env.ESG_API_KEY || process.env.FINANCIAL_MODELING_PREP_API_KEY,
			});
		} catch (error) {
			console.warn("ESG service not available:", error);
		}

		let shortInterestService: ShortInterestService | undefined;
		try {
			shortInterestService = new ShortInterestService({
				finraApiKey: process.env.FINRA_API_KEY,
				polygonApiKey: process.env.POLYGON_API_KEY,
			});
		} catch (error) {
			console.warn("Short interest service not available:", error);
		}

		let extendedMarketService: ExtendedMarketDataService | undefined;
		try {
			if (process.env.FMP_API_KEY) {
				const fmpAPI2 = new FinancialModelingPrepAPI(process.env.FMP_API_KEY);
				extendedMarketService = new ExtendedMarketDataService(fmpAPI2, cache);
			}
		} catch (error) {
			console.warn("Extended market service not available:", error);
		}

		let optionsService: OptionsDataService | undefined;
		try {
			optionsService = new OptionsDataService(cache);
		} catch (error) {
			console.warn("Options service not available:", error);
		}

		let mlPredictionService: MLPredictionService | undefined;
		try {
			mlPredictionService = new MLPredictionService();
		} catch (error) {
			console.warn("ML prediction service not available:", error);
		}

		// Create the comprehensive ML-enhanced service (Phase 4.1)
		stockSelectionService = new MLEnhancedStockSelectionService(
			financialDataService,
			factorLibrary,
			cache,
			technicalService,
			macroeconomicService,
			sentimentService,
			vwapService,
			esgService,
			shortInterestService,
			extendedMarketService,
			undefined, // institutionalService
			optionsService,
			mlPredictionService
		);

		console.log(
			"✅ Comprehensive MLEnhancedStockSelectionService initialized (Phase 4.1 - ML enhancement layer active)"
		);
		return stockSelectionService;
	} catch (error) {
		console.error("Failed to initialize StockSelectionService:", error);
		throw new Error("Service initialization failed");
	}
}

/**
 * Convert admin dashboard request format to SelectionRequest (Phase 4.1 - ML support added)
 */
async function convertToSelectionRequest(body: any): Promise<SelectionRequest> {
	const { mode, symbols, sector, limit, config, include_ml, ml_horizon, ml_confidence_threshold, ml_weight, ml_timeout } = body;

	// Handle test format where symbol is in config
	const symbolToUse = config?.symbol || symbols?.[0];
	const actualSymbols = symbolToUse ? [symbolToUse] : symbols;

	let selectionMode: SelectionMode;
	let scope: AnalysisScope;

	switch (mode) {
		case "single":
			selectionMode = SelectionMode.SINGLE_STOCK;
			scope = {
				mode: selectionMode,
				symbols: actualSymbols,
				maxResults: 1,
			};
			break;

		case "sector":
			selectionMode = SelectionMode.SECTOR_ANALYSIS;
			scope = {
				mode: selectionMode,
				sector: {
					id: sector || "technology",
					label: sector || "Technology",
					description: `${sector || "Technology"} sector analysis`,
					category: "sector" as const,
				},
				maxResults: limit,
			};
			break;

		case "multiple":
			selectionMode = SelectionMode.MULTIPLE_STOCKS;
			scope = {
				mode: selectionMode,
				symbols: symbols,
				maxResults: limit,
			};
			break;

		default:
			throw new Error(`Unsupported mode: ${mode}`);
	}

	// Check if ML features are enabled via admin toggles
	const { MLFeatureToggleService } = await import(
		"../../../services/admin/MLFeatureToggleService"
	);
	const toggleService = MLFeatureToggleService.getInstance();
	const esdEnabled = await toggleService.isEarlySignalEnabled();
	const sentimentFusionEnabled = await toggleService.isSentimentFusionEnabled();
	const smartMoneyFlowEnabled = await toggleService.isSmartMoneyFlowEnabled();

	console.log(`🔍 /api/stocks/analyze - ESD Toggle: ${esdEnabled}, Sentiment-Fusion Toggle: ${sentimentFusionEnabled}, Smart-Money-Flow Toggle: ${smartMoneyFlowEnabled}, ML Enhancement: ${include_ml || false}`);

	return {
		scope,
		options: {
			algorithmId: "composite",
			useRealTimeData: true,
			includeSentiment: true,
			includeNews: true,
			includeEarlySignal: esdEnabled,
			includeSentimentFusion: sentimentFusionEnabled,
			includeSmartMoneyFlow: smartMoneyFlowEnabled,
			riskTolerance: "moderate",
			timeout: config?.timeout || 90000, // 90 seconds to accommodate multiple slow options API calls (~45s total) plus other data fetching
			// ML Enhancement Options (Phase 4.1)
			include_ml,
			ml_horizon,
			ml_confidence_threshold,
			ml_weight,
		},
		requestId: `admin_test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
	};
}

/**
 * Convert SelectionResponse to admin dashboard format
 */
function convertToAdminResponse(response: any): any {
	const stocks =
		response.topSelections?.map((selection: any) => {
			// Extract factor scores from the factorScores object
			const factorScores = selection.score?.factorScores || {};
			console.log(
				`🔍 DEBUG factorScores for ${selection.symbol}:`,
				JSON.stringify(factorScores, null, 2)
			);
			console.log(`🔍 DEBUG overallScore:`, selection.score?.overallScore);

			// 🎯 SCORE EXTRACTION: All scores come from AlgorithmEngine via FactorLibrary
			// Expected scales: 0-1 from FactorLibrary composites, 0-100 from pre-calculated exports

			// Technical Score: Pre-exported as 0-100 by AlgorithmEngine (line 825)
			const technicalScore = factorScores.technicalScore || 0;

			// Fundamental Score: Pre-exported as 0-100 by AlgorithmEngine (line 842)
			const fundamentalScore = factorScores.fundamentalScore || 0;

			// Analyst Score: Pre-exported as 0-100 by AlgorithmEngine (line 845)
			const analystScore = factorScores.analystScore || 0;

			// Composite Scores: 0-1 scale, convert to 0-100 for display
			const macroeconomicScore = (factorScores.macroeconomic_composite || 0) * 100;
			const sentimentScore = (factorScores.sentiment_composite || 0) * 100;
			const esgScore = (factorScores.esg_composite || 0) * 100;

			// 🎯 DISPLAY FORMATTING ONLY: Convert 0-1 scale to 0-100 for frontend display
			const overallScoreRaw = selection.score?.overallScore || 0;
			const compositeScoreDisplay = overallScoreRaw * 100;

			// 🚨 VALIDATION: Verify score is in expected 0-1 range before display formatting
			if (overallScoreRaw < 0 || overallScoreRaw > 1) {
				console.error(
					`❌ API VALIDATION FAILED: overallScore ${overallScoreRaw} is outside 0-1 range for ${selection.symbol}!`
				);
			}

			console.log(
				`✅ API /stocks/analyze: Display score = ${compositeScoreDisplay.toFixed(2)} (formatted from ${overallScoreRaw.toFixed(4)})`
			);

			return {
				symbol: selection.symbol,
				price: selection.score?.marketData?.price || 0,
				compositeScore: compositeScoreDisplay,
				recommendation: selection.action || "HOLD",
				sector: selection.context?.sector || "Unknown",
				confidence: selection.confidence
					? Math.round(selection.confidence * 100)
					: undefined,
				// Score breakdowns from factorScores object (0-100 scale)
				technicalScore,
				fundamentalScore,
				macroeconomicScore,
				sentimentScore,
				esgScore,
				analystScore,
				// Additional details
				marketCap: selection.context?.marketCap,
				priceChange: selection.score?.marketData?.priceChange,
				priceChangePercent: selection.score?.marketData?.priceChangePercent,
				reasoning: selection.reasoning,
				rationale: selection.rationale,
				strengths: selection.strengths,
				risks: selection.risks,
				insights: selection.insights,
				early_signal: selection.early_signal,
				price_prediction: selection.price_prediction, // Phase 4.2: Include price prediction in API response
				sentiment_fusion: selection.sentiment_fusion, // Phase 4.3: Include sentiment-fusion in API response
				smart_money_flow: selection.smart_money_flow, // Phase 4.4: Include smart-money-flow in API response
				mlPrediction: selection.mlPrediction, // Phase 4.1: Include ML predictions in API response
			};
		}) || [];

	const metadata = {
		mode: response.metadata?.analysisMode || "single",
		count: stocks.length,
		timestamp: response.timestamp || Date.now(),
		sources: response.metadata?.dataSourcesUsed || ["comprehensive"],
		technicalAnalysisEnabled: true,
		fundamentalDataEnabled: true,
		analystDataEnabled: true,
		sentimentAnalysisEnabled:
			!!response.metadata?.analysisInputServices?.sentimentAnalysis?.enabled,
		macroeconomicAnalysisEnabled:
			!!response.metadata?.analysisInputServices?.macroeconomicAnalysis?.enabled,
		esgAnalysisEnabled:
			!!response.metadata?.analysisInputServices?.esgAnalysis?.enabled,
		shortInterestAnalysisEnabled:
			!!response.metadata?.analysisInputServices?.shortInterestAnalysis?.enabled,
		extendedMarketDataEnabled:
			!!response.metadata?.analysisInputServices?.extendedMarketData?.enabled,
		// CRITICAL: Include the full analysisInputServices metadata
		analysisInputServices: response.metadata?.analysisInputServices || {},
		// Phase 4.1: Include ML enhancement metadata from service response
		...(response.metadata?.mlEnhancement && { mlEnhancement: response.metadata.mlEnhancement }),
	};

	return {
		success: response.success,
		data: {
			stocks,
			metadata,
		},
		error: response.errors?.join(", ") || undefined,
	};
}

/**
 * Main POST endpoint - comprehensive analysis with full StockSelectionService
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
	let progressTracker: ProgressTracker | undefined;
	let sessionId: string | undefined;

	try {
		console.log("🔬 Starting comprehensive analysis via StockSelectionService...");

		// Parse and validate request
		const body = await request.json();
		console.log("📦 Request body keys:", Object.keys(body));
		console.log("📦 Raw sessionId from body:", body.sessionId);

		const validatedRequest = RequestSchema.parse(body);
		sessionId = validatedRequest.sessionId;

		console.log("🎯 Validated sessionId:", sessionId);
		console.log("🎯 SessionId type:", typeof sessionId);

		// Initialize progress tracker if session ID provided
		if (sessionId) {
			console.log("✅ Initializing ProgressTracker for session:", sessionId);
			progressTracker = new ProgressTracker();
			progressTracker.onProgress(update => {
				console.log("📊 Progress update:", update.stage, update.progress + "%");
				sendProgressUpdate(sessionId!, update);
			});
			progressTracker.startStage("init", "Initializing analysis engine...");
			console.log("✅ Started 'init' stage");
		} else {
			console.log("⚠️ No sessionId provided - progress tracking disabled");
		}

		// Get the comprehensive service
		progressTracker?.updateStage("init", "Loading analysis services...");
		const service = await getStockSelectionService();

		// Convert to SelectionRequest format
		progressTracker?.completeStage("init");
		const selectionRequest = await convertToSelectionRequest(validatedRequest);

		console.log("📊 Executing comprehensive stock analysis:", {
			mode: selectionRequest.scope.mode,
			symbols: selectionRequest.scope.symbols,
			sector: selectionRequest.scope.sector?.label,
			requestId: selectionRequest.requestId,
			withProgressTracking: !!sessionId,
		});

		// Pass progress tracker to analysis
		if (progressTracker) {
			(selectionRequest as any).progressTracker = progressTracker;
		}

		// Execute comprehensive analysis
		const startTime = Date.now();
		const analysisResult = await service.selectStocks(selectionRequest);
		const analysisTime = Date.now() - startTime;

		// Complete progress tracking
		if (progressTracker) {
			progressTracker.complete();
			// Close SSE connection after a short delay
			setTimeout(() => {
				if (sessionId) closeProgressSession(sessionId);
			}, 1000);
		}

		console.log(`✅ Comprehensive analysis completed in ${analysisTime}ms`, {
			success: analysisResult.success,
			topSelections: analysisResult.topSelections.length,
			analysisInputServices: Object.keys(analysisResult.metadata?.analysisInputServices || {})
				.length,
		});

		// Convert to admin dashboard format
		const adminResponse = convertToAdminResponse(analysisResult);

		return NextResponse.json(adminResponse);
	} catch (error) {
		console.error("Comprehensive analysis error:", error);

		// Notify progress tracker of failure
		if (progressTracker && sessionId) {
			const errorMessage =
				error instanceof Error ? error.message : "Analysis failed unexpectedly";

			sendProgressUpdate(sessionId, {
				stage: "error",
				message: errorMessage,
				progress: 100, // Set to 100 so the progress bar completes
				timestamp: Date.now(),
				metadata: { error: true },
			});
			setTimeout(() => closeProgressSession(sessionId!), 2000); // Slightly longer delay to show error
		}

		// Return appropriate status codes for different error types
		if (error instanceof z.ZodError) {
			return NextResponse.json(
				{
					success: false,
					error:
						"Invalid request format: " +
						error.issues.map((e: any) => e.message).join(", "),
				},
				{ status: 400 }
			);
		}

		if (error instanceof Error && error.message.includes("Symbol required")) {
			return NextResponse.json(
				{
					success: false,
					error: error.message,
				},
				{ status: 400 }
			);
		}

		return NextResponse.json(
			{
				success: false,
				error: "Comprehensive analysis failed",
			},
			{ status: 500 }
		);
	}
}

/**
 * GET endpoint for health check
 */
export async function GET(): Promise<NextResponse> {
	try {
		const service = await getStockSelectionService();
		const health = await service.healthCheck();

		return NextResponse.json({
			success: true,
			data: {
				status: health.status,
				services: health.details,
				timestamp: Date.now(),
			},
		});
	} catch (error) {
		return NextResponse.json(
			{
				success: false,
				error: "Comprehensive analysis service health check failed",
			},
			{ status: 500 }
		);
	}
}
