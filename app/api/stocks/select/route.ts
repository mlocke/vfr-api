/**
 * Simplified Stock Selection API - KISS principles applied
 * Direct API implementation replacing MCP-based architecture
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
	financialDataService,
	StockData,
	FundamentalRatios,
	AnalystRatings,
	PriceTarget,
} from "../../../services/financial-data";
import { TechnicalIndicatorService } from "../../../services/technical-analysis/TechnicalIndicatorService";
import { RedisCache } from "../../../services/cache/RedisCache";
import { OHLCData, TechnicalAnalysisResult } from "../../../services/technical-analysis/types";
import { SentimentAnalysisService } from "../../../services/financial-data/SentimentAnalysisService";
import { StockSentimentImpact } from "../../../services/financial-data/types/sentiment-types";
import { MacroeconomicAnalysisService } from "../../../services/financial-data/MacroeconomicAnalysisService";
import { FREDAPI } from "../../../services/financial-data/FREDAPI";
import { BLSAPI } from "../../../services/financial-data/BLSAPI";
import { EIAAPI } from "../../../services/financial-data/EIAAPI";
import { StockMacroeconomicImpact } from "../../../services/financial-data/types/macroeconomic-types";
import ESGDataService from "../../../services/financial-data/ESGDataService";
import ShortInterestService from "../../../services/financial-data/ShortInterestService";
import { ExtendedMarketDataService } from "../../../services/financial-data/ExtendedMarketDataService";
import { FinancialModelingPrepAPI } from "../../../services/financial-data/FinancialModelingPrepAPI";
import { getRecommendation } from "../../../services/utils/RecommendationUtils";
import { TimeoutHandler } from "../../../services/error-handling/TimeoutHandler";
import { EarlySignalService } from "../../../services/ml/early-signal/EarlySignalService";
import { EarlySignalPrediction } from "../../../services/ml/early-signal/types";
import { MLFeatureToggleService } from "../../../services/admin/MLFeatureToggleService";

// Request validation - supports both test format and production format
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
	// ML Enhancement Parameters (optional, backward compatible)
	include_ml: z.boolean().optional().default(false),
	ml_models: z.array(z.string()).optional(),
	ml_horizon: z.enum(["1h", "4h", "1d", "1w", "1m"]).optional().default("1w"),
	ml_confidence_threshold: z.number().min(0).max(1).optional().default(0.5),
	// Early Signal Detection (NEW - Phase 4)
	include_early_signal: z.boolean().optional().default(false),
});

// Enhanced response format with comprehensive analysis
interface EnhancedStockData extends StockData {
	technicalAnalysis?: {
		score: number; // 0-100 overall technical score
		trend: {
			direction: "bullish" | "bearish" | "neutral";
			strength: number;
			confidence: number;
		};
		momentum: {
			signal: "buy" | "sell" | "hold";
			strength: number;
		};
		summary: string;
	};
	sentimentAnalysis?: {
		score: number; // 0-100 overall sentiment score
		impact: "positive" | "negative" | "neutral";
		confidence: number;
		newsVolume: number;
		adjustedScore: number;
		summary: string;
	};
	macroeconomicAnalysis?: {
		score: number; // 0-100 overall macro score
		cyclephase: string;
		sectorImpact: string;
		adjustedScore: number;
		economicRisk: number;
		summary: string;
	};
	esgAnalysis?: {
		score: number; // 0-100 overall ESG score
		impact: "positive" | "negative" | "neutral";
		factors: string[];
		confidence: number;
		adjustedScore: number;
		summary: string;
	};
	shortInterestAnalysis?: {
		score: number; // 0-100 overall short interest score
		impact: "positive" | "negative" | "neutral";
		factors: string[];
		confidence: number;
		shortInterestRatio: number;
		adjustedScore: number;
		summary: string;
	};
	fundamentals?: FundamentalRatios;
	analystRating?: AnalystRatings;
	priceTarget?: PriceTarget;
	compositeScore?: number;
	recommendation?:
		| "STRONG_BUY"
		| "BUY"
		| "MODERATE_BUY"
		| "HOLD"
		| "MODERATE_SELL"
		| "SELL"
		| "STRONG_SELL"; // 7-tier only
	sector?: string;
	// ML Enhancement Fields (optional)
	mlPrediction?: {
		horizon: string;
		priceTarget: number;
		expectedReturn: number;
		confidence: number;
		direction: "bullish" | "bearish" | "neutral";
		probability: number;
		models: string[];
	};
	mlEnhancedScore?: number; // ML-enhanced composite score (optional)
	// Early Signal Detection (NEW - Phase 4)
	early_signal?: EarlySignalPrediction;
}

interface SimpleStockResponse {
	success: boolean;
	data?: {
		stocks: EnhancedStockData[];
		metadata: {
			mode: string;
			count: number;
			timestamp: number;
			sources: string[];
			technicalAnalysisEnabled?: boolean;
			fundamentalDataEnabled?: boolean;
			analystDataEnabled?: boolean;
			sentimentAnalysisEnabled?: boolean;
			macroeconomicAnalysisEnabled?: boolean;
			esgAnalysisEnabled?: boolean;
			shortInterestAnalysisEnabled?: boolean;
			extendedMarketDataEnabled?: boolean;
			// ML Enhancement Metadata (optional)
			mlEnhancementEnabled?: boolean;
			mlModelsUsed?: string[];
			mlHorizon?: string;
			mlLatency?: number;
			// Early Signal Detection Metadata (NEW - Phase 4)
			early_signal_enabled?: boolean;
			early_signal_latency_ms?: number;
		};
	};
	error?: string;
	// ML Enhancement warnings (optional)
	warnings?: string[];
}

// Optimized Service Factory with API Key Validation and Singleton Management
interface ServiceConfig {
	enabled: boolean;
	hasRequiredKeys: boolean;
	instance: any;
	error?: string;
}

class OptimizedServiceFactory {
	private static sharedCache: RedisCache | null = null;
	private static services: Map<string, ServiceConfig> = new Map();

	/**
	 * Get shared cache instance for memory efficiency
	 */
	private static getSharedCache(): RedisCache {
		if (!this.sharedCache) {
			this.sharedCache = new RedisCache();
		}
		return this.sharedCache;
	}

	/**
	 * Pre-validate API keys for fast startup failure detection
	 */
	private static validateServiceApiKeys(): Map<string, boolean> {
		const keyValidation = new Map<string, boolean>();

		// Technical Service - always enabled (no API keys required)
		keyValidation.set("technical", true);

		// Sentiment Service - requires NewsAPI key
		keyValidation.set("sentiment", !!process.env.NEWSAPI_KEY);

		// Macroeconomic Service - requires at least one API key (FRED/BLS/EIA)
		keyValidation.set(
			"macroeconomic",
			!!(process.env.FRED_API_KEY || process.env.BLS_API_KEY || process.env.EIA_API_KEY)
		);

		// ESG Service - requires ESG or FMP API key
		keyValidation.set(
			"esg",
			!!(process.env.ESG_API_KEY || process.env.FINANCIAL_MODELING_PREP_API_KEY)
		);

		// Short Interest Service - requires FINRA or Polygon API key
		keyValidation.set(
			"shortInterest",
			!!(process.env.FINRA_API_KEY || process.env.POLYGON_API_KEY)
		);

		// Extended Market Service - requires Polygon API key
		keyValidation.set("extendedMarket", !!process.env.POLYGON_API_KEY);

		return keyValidation;
	}

	/**
	 * Initialize service with proper error handling and memory optimization
	 */
	private static initializeService(serviceType: string): ServiceConfig {
		const cache = this.getSharedCache();
		const keyValidation = this.validateServiceApiKeys();
		const hasKeys = keyValidation.get(serviceType) || false;

		if (!hasKeys) {
			return {
				enabled: false,
				hasRequiredKeys: false,
				instance: null,
				error: `Missing required API keys for ${serviceType} service`,
			};
		}

		try {
			let instance = null;

			switch (serviceType) {
				case "technical":
					instance = new TechnicalIndicatorService(cache);
					break;

				case "sentiment":
					// Yahoo Finance sentiment doesn't need API key
					instance = new SentimentAnalysisService(cache);
					break;

				case "macroeconomic":
					instance = new MacroeconomicAnalysisService({
						fredApiKey: process.env.FRED_API_KEY,
						blsApiKey: process.env.BLS_API_KEY,
						eiaApiKey: process.env.EIA_API_KEY,
					});
					break;

				case "esg":
					instance = new ESGDataService({
						apiKey:
							process.env.ESG_API_KEY || process.env.FINANCIAL_MODELING_PREP_API_KEY!,
					});
					break;

				case "shortInterest":
					instance = new ShortInterestService({
						finraApiKey: process.env.FINRA_API_KEY,
						polygonApiKey: process.env.POLYGON_API_KEY,
					});
					break;

				case "extendedMarket":
					const fmpAPI = new FinancialModelingPrepAPI(process.env.FMP_API_KEY!);
					instance = new ExtendedMarketDataService(fmpAPI, cache);
					break;

				default:
					throw new Error(`Unknown service type: ${serviceType}`);
			}

			return {
				enabled: true,
				hasRequiredKeys: true,
				instance,
				error: undefined,
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Unknown error";
			console.warn(`Failed to initialize ${serviceType} service:`, errorMessage);

			return {
				enabled: false,
				hasRequiredKeys: true,
				instance: null,
				error: errorMessage,
			};
		}
	}

	/**
	 * Get service with lazy initialization and caching
	 */
	static getService<T>(serviceType: string): T | null {
		if (!this.services.has(serviceType)) {
			const config = this.initializeService(serviceType);
			this.services.set(serviceType, config);
		}

		const config = this.services.get(serviceType)!;
		return config.enabled ? config.instance : null;
	}

	/**
	 * Get service availability without initializing
	 */
	static isServiceAvailable(serviceType: string): boolean {
		const keyValidation = this.validateServiceApiKeys();
		return keyValidation.get(serviceType) || false;
	}

	/**
	 * Get all service statuses for metadata
	 */
	static getServiceStatuses(): Record<string, boolean> {
		const keyValidation = this.validateServiceApiKeys();
		const statuses: Record<string, boolean> = {};

		keyValidation.forEach((hasKeys, serviceType) => {
			statuses[serviceType] = hasKeys;
		});

		return statuses;
	}

	/**
	 * Memory cleanup for testing/development
	 */
	static cleanup(): void {
		this.services.clear();
		this.sharedCache = null;
	}
}

/**
 * Optimized service getters with fast startup and error handling
 */
function getTechnicalService(): TechnicalIndicatorService {
	return OptimizedServiceFactory.getService<TechnicalIndicatorService>("technical")!;
}

function getSentimentService(): SentimentAnalysisService | null {
	return OptimizedServiceFactory.getService<SentimentAnalysisService>("sentiment");
}

function getMacroService(): MacroeconomicAnalysisService | null {
	return OptimizedServiceFactory.getService<MacroeconomicAnalysisService>("macroeconomic");
}

function getESGService(): ESGDataService | null {
	return OptimizedServiceFactory.getService<ESGDataService>("esg");
}

function getShortInterestService(): ShortInterestService | null {
	return OptimizedServiceFactory.getService<ShortInterestService>("shortInterest");
}

function getExtendedMarketService(): ExtendedMarketDataService | null {
	return OptimizedServiceFactory.getService<ExtendedMarketDataService>("extendedMarket");
}

/**
 * Convert HistoricalOHLC to OHLCData format
 */
function convertToOHLCData(
	historicalData: import("../../../services/financial-data").HistoricalOHLC[]
): OHLCData[] {
	return historicalData.map(item => ({
		timestamp: item.timestamp,
		open: item.open,
		high: item.high,
		low: item.low,
		close: item.close,
		volume: item.volume,
	}));
}

// ❌ REMOVED: Duplicate calculation logic - use FactorLibrary instead
// This function was calculating scores in a second location, violating single source of truth
// All score calculations MUST happen in FactorLibrary.calculateMainComposite()
// Scores come from AlgorithmEngine which uses FactorLibrary

// REMOVED: getRecommendation() - now using centralized RecommendationUtils

/**
 * Enhance stock data with comprehensive analysis
 */
async function enhanceStockData(
	stocks: StockData[],
	options?: { include_early_signal?: boolean }
): Promise<{ enhancedStocks: EnhancedStockData[]; earlySignalLatencyMs: number }> {
	// Check both admin toggle AND explicit request parameter
	const toggleService = MLFeatureToggleService.getInstance();
	const adminToggle = await toggleService.isEarlySignalEnabled();
	const esdEnabled = adminToggle || options?.include_early_signal;

	console.log(
		`🔍 ESD Toggle Check: adminToggle=${adminToggle}, requestParam=${options?.include_early_signal}, esdEnabled=${esdEnabled}`
	);

	const validatedRequest = { include_early_signal: esdEnabled };
	const technical = getTechnicalService();
	const sentiment = getSentimentService();
	const macro = getMacroService();
	const esg = getESGService();
	const shortInterest = getShortInterestService();
	const extendedMarket = getExtendedMarketService();
	const enhancedStocks: EnhancedStockData[] = [];

	// Process stocks in parallel with Promise.allSettled for resilience
	const analysisPromises = stocks.map(async (stock): Promise<EnhancedStockData> => {
		try {
			// Fetch all data types in parallel
			const [
				historicalResult,
				fundamentalsResult,
				analystResult,
				priceTargetResult,
				companyInfoResult,
			] = await Promise.allSettled([
				financialDataService.getHistoricalOHLC(stock.symbol, 50),
				financialDataService.getFundamentalRatios(stock.symbol),
				financialDataService.getAnalystRatings(stock.symbol),
				financialDataService.getPriceTargets(stock.symbol),
				financialDataService.getCompanyInfo(stock.symbol),
			]);

			// Initialize enhanced stock with base data
			let enhancedStock: EnhancedStockData = { ...stock };

			// Add company info and sector data
			if (companyInfoResult.status === "fulfilled" && companyInfoResult.value) {
				enhancedStock.sector = companyInfoResult.value.sector || "Unknown";
			}

			// Add fundamental data
			if (fundamentalsResult.status === "fulfilled" && fundamentalsResult.value) {
				enhancedStock.fundamentals = fundamentalsResult.value;
			}

			// Add analyst data
			if (analystResult.status === "fulfilled" && analystResult.value) {
				enhancedStock.analystRating = analystResult.value;
			}

			// Add price target data
			if (priceTargetResult.status === "fulfilled" && priceTargetResult.value) {
				enhancedStock.priceTarget = priceTargetResult.value;
			}

			// Add sentiment analysis if service is available (with 20s timeout for parallel processing)
			if (sentiment && enhancedStock.sector) {
				try {
					const timeoutHandler = TimeoutHandler.getInstance();
					const sentimentImpact = await timeoutHandler.withTimeout(
						sentiment.analyzeStockSentimentImpact(
							stock.symbol,
							enhancedStock.sector,
							enhancedStock.price || 50 // base score for sentiment analysis
						),
						20000 // 20s timeout - allows parallel News (5s) + Reddit (15s) + Options (8s) = max 15s
					);

					if (sentimentImpact?.sentimentScore?.overall !== undefined) {
						enhancedStock.sentimentAnalysis = {
							score: sentimentImpact.sentimentScore.overall,
							impact:
								sentimentImpact.sentimentScore.overall >= 60
									? "positive"
									: sentimentImpact.sentimentScore.overall <= 40
										? "negative"
										: "neutral",
							confidence: sentimentImpact.sentimentScore.confidence || 0.5,
							newsVolume: 0, // Will be enhanced in future iterations
							adjustedScore: sentimentImpact.adjustedScore,
							summary: `${
								sentimentImpact.sentimentScore.overall >= 60
									? "Positive"
									: sentimentImpact.sentimentScore.overall <= 40
										? "Negative"
										: "Neutral"
							} sentiment with ${(sentimentImpact.sentimentScore.confidence || 0.5).toFixed(1)}% confidence`,
						};
					}
				} catch (error) {
					console.warn(`Sentiment analysis failed for ${stock.symbol}:`, error);
				}
			}

			// Add macroeconomic analysis if service is available and sector is known (with 10s timeout)
			if (macro && enhancedStock.sector) {
				try {
					const timeoutHandler = TimeoutHandler.getInstance();
					const macroImpact = await timeoutHandler.withTimeout(
						macro.analyzeStockMacroImpact(
							stock.symbol,
							enhancedStock.sector,
							enhancedStock.price || 50 // base score for macro analysis
						),
						10000 // 10s timeout for government APIs
					);

					if (macroImpact) {
						enhancedStock.macroeconomicAnalysis = {
							score: macroImpact.macroScore,
							cyclephase: "expansion", // Will be enhanced when cycle analysis is available
							sectorImpact: "neutral", // Simplified for now - using neutral default
							adjustedScore: macroImpact.adjustedScore,
							economicRisk: macroImpact.confidence,
							summary: `Economic outlook: ${macroImpact.impact} with ${Math.round(macroImpact.confidence * 100)}% confidence`,
						};
					}
				} catch (error) {
					console.warn(`Macroeconomic analysis failed for ${stock.symbol}:`, error);
				}
			}

			// Add ESG analysis if service is available and sector is known
			if (esg && enhancedStock.sector) {
				try {
					const esgImpact = await esg.getESGImpactForStock(
						stock.symbol,
						enhancedStock.sector,
						enhancedStock.price || 50 // base score for ESG analysis
					);

					if (esgImpact) {
						enhancedStock.esgAnalysis = {
							score: esgImpact.esgScore,
							impact: esgImpact.impact,
							factors: esgImpact.factors,
							confidence: esgImpact.confidence,
							adjustedScore: esgImpact.adjustedScore,
							summary: `ESG ${esgImpact.impact} impact with ${Math.round(esgImpact.confidence * 100)}% confidence`,
						};
					}
				} catch (error) {
					console.warn(`ESG analysis failed for ${stock.symbol}:`, error);
				}
			}

			// Add Short Interest analysis if service is available and sector is known
			// Service now returns null when no API keys available - NO MOCK DATA
			if (shortInterest && enhancedStock.sector) {
				try {
					const shortImpact = await shortInterest.getShortInterestImpactForStock(
						stock.symbol,
						enhancedStock.sector,
						enhancedStock.price || 50 // base score for short interest analysis
					);

					// Only add analysis if real data is available
					if (shortImpact && shortImpact.confidence > 0) {
						enhancedStock.shortInterestAnalysis = {
							score: shortImpact.score,
							impact: shortImpact.impact,
							factors: shortImpact.factors,
							confidence: shortImpact.confidence,
							shortInterestRatio: shortImpact.shortInterestScore,
							adjustedScore: shortImpact.adjustedScore,
							summary:
								shortImpact.shortInterestScore > 0
									? `Short interest ${shortImpact.impact} impact (${shortImpact.shortInterestScore}% ratio) with ${Math.round(shortImpact.confidence * 100)}% confidence`
									: "Short interest data unavailable - no API keys configured",
						};
					} else {
						// Log when short interest is unavailable but don't include it in analysis
						console.log(
							`Short interest data unavailable for ${stock.symbol} - no API keys or data not found`
						);
					}
				} catch (error) {
					console.warn(`Short interest analysis failed for ${stock.symbol}:`, error);
				}
			}

			// Add extended market data analysis if service is available
			if (extendedMarket) {
				try {
					const extendedData = await extendedMarket.getExtendedMarketData(stock.symbol);

					if (extendedData) {
						// Calculate extended market score and add to enhanced data
						const extendedScore =
							extendedMarket.calculateExtendedMarketScore(extendedData);

						// Add extended market fields to stock data
						if (extendedData.extendedHours) {
							enhancedStock.preMarketPrice =
								extendedData.extendedHours.preMarketPrice;
							enhancedStock.preMarketChange =
								extendedData.extendedHours.preMarketChange;
							enhancedStock.preMarketChangePercent =
								extendedData.extendedHours.preMarketChangePercent;
							enhancedStock.afterHoursPrice =
								extendedData.extendedHours.afterHoursPrice;
							enhancedStock.afterHoursChange =
								extendedData.extendedHours.afterHoursChange;
							enhancedStock.afterHoursChangePercent =
								extendedData.extendedHours.afterHoursChangePercent;
						}

						// Add bid/ask if available
						if (extendedData.bidAskSpread) {
							enhancedStock.bid = extendedData.bidAskSpread.bid;
							enhancedStock.ask = extendedData.bidAskSpread.ask;
						}
					}
				} catch (error) {
					console.warn(`Extended market analysis failed for ${stock.symbol}:`, error);
				}
			}

			// Add technical analysis if historical data is sufficient
			if (historicalResult.status === "fulfilled" && historicalResult.value.length >= 20) {
				// Convert to OHLCData format
				const ohlcData = convertToOHLCData(historicalResult.value);

				// Perform technical analysis
				const technicalResult = await technical.calculateAllIndicators({
					symbol: stock.symbol,
					ohlcData,
				});

				// Generate summary based on analysis
				const summary = generateTechnicalSummary(technicalResult);

				enhancedStock.technicalAnalysis = {
					score: technicalResult.score.total,
					trend: {
						direction: technicalResult.trend.direction,
						strength: technicalResult.trend.strength,
						confidence: technicalResult.trend.confidence,
					},
					momentum: {
						signal: technicalResult.momentum.signal,
						strength: technicalResult.momentum.strength,
					},
					summary,
				};
			} else {
				console.warn(
					`Insufficient historical data for ${stock.symbol}. Technical analysis disabled.`
				);
			}

			// 🎯 DISPLAY FORMATTING ONLY: Convert 0-1 scale to 0-100 for frontend display
			// All calculations happen in FactorLibrary.calculateMainComposite (SINGLE SOURCE OF TRUTH)
			let compositeScore: number;

			if (
				(enhancedStock as any).score !== undefined &&
				(enhancedStock as any).score !== null
			) {
				// AlgorithmEngine provides 0-1 scale from FactorLibrary - convert to 0-100 for display
				compositeScore = (enhancedStock as any).score * 100;
				console.log(
					`✅ Using AlgorithmEngine score for ${stock.symbol}: ${(enhancedStock as any).score.toFixed(4)} → ${compositeScore.toFixed(2)}`
				);
			} else {
				// Fallback only if AlgorithmEngine completely failed (should be rare)
				compositeScore = 50; // Neutral default
				console.warn(
					`⚠️ AlgorithmEngine score missing for ${stock.symbol}, using neutral fallback`
				);
			}

			enhancedStock.compositeScore = compositeScore;

			// Pass analyst data for recommendation upgrades
			const analystData = enhancedStock.analystRating
				? {
						totalAnalysts: enhancedStock.analystRating.totalAnalysts,
						sentimentScore: enhancedStock.analystRating.sentimentScore,
						distribution: {
							strongBuy: enhancedStock.analystRating.strongBuy,
							buy: enhancedStock.analystRating.buy,
							hold: enhancedStock.analystRating.hold,
							sell: enhancedStock.analystRating.sell,
							strongSell: enhancedStock.analystRating.strongSell,
						},
					}
				: undefined;

			enhancedStock.recommendation = getRecommendation(compositeScore, analystData);

			// Early Signal Detection
			if (esdEnabled) {
				try {
					console.log(`🚀 Calling Early Signal Service for ${stock.symbol}`);
					const earlySignalService = new EarlySignalService();
					const earlySignal = await earlySignalService.predictAnalystChange(
						stock.symbol,
						enhancedStock.sector || "Unknown"
					);
					if (earlySignal) {
						enhancedStock.early_signal = earlySignal;
						console.log(
							`✅ Early Signal for ${stock.symbol}: ${earlySignal.upgrade_likely ? "UPGRADE" : "DOWNGRADE"} (${(earlySignal.confidence * 100).toFixed(1)}%)`
						);
					} else {
						console.warn(`⚠️ Early Signal Service returned null for ${stock.symbol}`);
					}
				} catch (error) {
					console.error(`❌ Early signal prediction failed for ${stock.symbol}:`, error);
				}
			} else {
				console.log(`⏭️  ESD disabled - skipping Early Signal for ${stock.symbol}`);
			}

			return enhancedStock;
		} catch (error) {
			console.error(`Stock enhancement failed for ${stock.symbol}:`, error);
			// Only return the stock if it has a valid symbol
			if (stock && stock.symbol) {
				return { ...stock };
			}
			// Return null for invalid stocks - will be filtered out
			return null as any;
		}
	});

	// Wait for all stock enhancements to complete
	const enhancedStocksList = (await Promise.all(analysisPromises)).filter(s => s !== null);

	return { enhancedStocks: enhancedStocksList, earlySignalLatencyMs: 0 };
}

/**
 * Generate human-readable technical summary
 */
function generateTechnicalSummary(analysis: TechnicalAnalysisResult): string {
	const { score, trend, momentum } = analysis;
	const scoreCategory = score.total >= 70 ? "Strong" : score.total >= 50 ? "Moderate" : "Weak";

	return `${scoreCategory} technical outlook. Trend: ${trend.direction} (${Math.round(trend.strength * 100)}% strength). Momentum: ${momentum.signal}.`;
}

/**
 * Main POST endpoint - simplified with technical analysis integration
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
	try {
		// Parse and validate request
		const body = await request.json();
		const {
			mode,
			symbols,
			sector,
			limit,
			config,
			include_ml,
			ml_models,
			ml_horizon,
			ml_confidence_threshold,
			include_early_signal,
		} = RequestSchema.parse(body);

		let stocks: StockData[] = [];
		const sources = new Set<string>();

		// Handle test format where symbol is in config
		const symbolToUse = config?.symbol || symbols?.[0];
		const preferredSources = config?.preferredDataSources || [];

		// Determine preferred provider from data sources
		const preferredProvider = preferredSources.length > 0 ? preferredSources[0] : undefined;

		// Handle different selection modes
		switch (mode) {
			case "single":
				if (!symbolToUse) {
					return NextResponse.json(
						{
							success: false,
							error: "Symbol required for single mode (in symbols array or config.symbol)",
						},
						{ status: 400 }
					);
				}

				// Check if preferred data sources are disabled (for testing data source toggle)
				if (preferredSources.length > 0) {
					const { dataSourceConfigManager } = await import(
						"../../../services/admin/DataSourceConfigManager"
					);
					for (const sourceId of preferredSources) {
						const isEnabled = dataSourceConfigManager.isDataSourceEnabled(sourceId);
						if (!isEnabled) {
							return NextResponse.json(
								{
									success: false,
									error: `Preferred data source '${sourceId}' is currently disabled`,
									disabledSources: [sourceId],
								},
								{ status: 400 }
							);
						}
					}
				}

				const stockData = await financialDataService.getStockPrice(symbolToUse);
				if (stockData) {
					stocks = [stockData];
					sources.add(stockData.source);
				}
				break;

			case "sector":
				if (!sector) {
					return NextResponse.json(
						{
							success: false,
							error: "Sector required for sector mode",
						},
						{ status: 400 }
					);
				}

				stocks = await financialDataService.getStocksBySector(sector, limit);
				stocks.forEach(stock => sources.add(stock.source));
				break;

			case "multiple":
				if (!symbols?.length) {
					return NextResponse.json(
						{
							success: false,
							error: "Symbols required for multiple mode",
						},
						{ status: 400 }
					);
				}

				// Get multiple stocks in parallel
				stocks = await financialDataService.getMultipleStocks(symbols.slice(0));
				stocks.forEach(stock => sources.add(stock.source));
				break;

			default:
				return NextResponse.json(
					{
						success: false,
						error: "Invalid mode",
					},
					{ status: 400 }
				);
		}

		// ✅ CRITICAL FIX: Calculate AlgorithmEngine scores BEFORE enhanceStockData
		// This ensures stock.score is available for composite score calculation
		console.log(`🔬 Step 1: Calculating AlgorithmEngine scores for ${stocks.length} stocks...`);
		const scoreStartTime = Date.now();

		// Import AlgorithmEngine dependencies
		const { AlgorithmEngine } = await import("../../../services/algorithms/AlgorithmEngine");
		const { FactorLibrary } = await import("../../../services/algorithms/FactorLibrary");
		const { AlgorithmCache } = await import("../../../services/algorithms/AlgorithmCache");
		const { FinancialDataService } = await import(
			"../../../services/financial-data/FinancialDataService"
		);
		const { AlgorithmConfigManager } = await import(
			"../../../services/algorithms/AlgorithmConfigManager"
		);

		// Initialize services for AlgorithmEngine
		const factorLibrary = new FactorLibrary();
		const algorithmCache = new AlgorithmCache({
			redis: {
				host: process.env.REDIS_HOST || "localhost",
				port: parseInt(process.env.REDIS_PORT || "6379"),
				password: process.env.REDIS_PASSWORD,
				db: 0,
				keyPrefix: "algo:",
				maxRetries: 3,
				retryDelayOnFailover: 100,
			},
			ttl: {
				configuration: 3600,
				stockScores: 300,
				marketData: 60,
				fundamentalData: 3600,
				selectionResults: 1800,
				universe: 14400,
				factors: 300,
			},
			performance: {
				pipelineSize: 100,
				compressionThreshold: 1024,
				enableCompression: true,
			},
		});
		const financialDataServiceLocal = new FinancialDataService();
		const algorithmEngine = new AlgorithmEngine(
			financialDataServiceLocal,
			factorLibrary,
			algorithmCache,
			getSentimentService() || undefined
		);
		const configManager = new AlgorithmConfigManager(factorLibrary, algorithmCache);

		// Get composite algorithm configuration
		const compositeConfig = await configManager.getConfiguration("composite");
		if (!compositeConfig) {
			console.warn(
				"⚠️  Composite algorithm config not found, scores will use legacy calculation"
			);
		} else {
			// Build context with symbols for single-stock analysis
			const context = {
				algorithmId: "composite",
				runId: `run_${Date.now()}`,
				startTime: Date.now(),
				symbols: symbols || [],
				scope: {
					mode: mode as any,
					symbols: symbols || [],
					maxResults: limit,
				},
				marketData: {
					timestamp: Date.now(),
					marketOpen: true,
					volatilityIndex: 0.15,
					sectorRotation: {},
				},
				dataStatus: {},
			};

			try {
				// Execute algorithm to get scores
				const result = await algorithmEngine.executeAlgorithm(compositeConfig, context);
				console.log(
					`✅ AlgorithmEngine calculated scores for ${result.selections.length} stocks in ${Date.now() - scoreStartTime}ms`
				);

				// Attach scores to stock objects (0-1 scale from AlgorithmEngine)
				result.selections.forEach(selection => {
					const stock = stocks.find(s => s.symbol === selection.symbol);
					if (stock) {
						(stock as any).score = selection.score.overallScore;
						console.log(
							`✅ Attached score ${selection.score.overallScore.toFixed(4)} to ${stock.symbol}`
						);
					}
				});
			} catch (error) {
				console.warn(
					"⚠️  AlgorithmEngine execution failed, falling back to legacy scoring:",
					error
				);
			}
		}

		// Enhance stocks with comprehensive analysis
		console.log(`🔬 Step 2: Performing comprehensive analysis on ${stocks.length} stocks...`);
		const startTime = Date.now();

		const { enhancedStocks, earlySignalLatencyMs } = await enhanceStockData(stocks, {
			include_early_signal,
		});
		const analysisTime = Date.now() - startTime;

		console.log(`✅ Comprehensive analysis completed in ${analysisTime}ms`);

		// Step 3: Optional ML Enhancement (if include_ml is true)
		const warnings: string[] = [];
		let mlLatency = 0;

		if (include_ml) {
			console.log(`🤖 Step 3: ML enhancement requested (Phase 1.4 - API structure only)`);
			warnings.push(
				"ML enhancement requested but not yet fully implemented (available in Phase 2+)"
			);

			// Note: Full ML enhancement will be implemented in Phase 2 (ML Integration Layer)
			// Phase 1.4 is only for API structure and backward compatibility
		}

		// Return enhanced response - set timestamp after all processing is complete
		const response: SimpleStockResponse = {
			success: true,
			data: {
				stocks: enhancedStocks,
				metadata: {
					mode,
					count: enhancedStocks.length,
					timestamp: Date.now(), // Set timestamp after processing
					sources: Array.from(sources),
					technicalAnalysisEnabled: true,
					fundamentalDataEnabled: true,
					analystDataEnabled: true,
					sentimentAnalysisEnabled:
						OptimizedServiceFactory.isServiceAvailable("sentiment"),
					macroeconomicAnalysisEnabled:
						OptimizedServiceFactory.isServiceAvailable("macroeconomic"),
					esgAnalysisEnabled: OptimizedServiceFactory.isServiceAvailable("esg"),
					shortInterestAnalysisEnabled:
						OptimizedServiceFactory.isServiceAvailable("shortInterest"),
					extendedMarketDataEnabled:
						OptimizedServiceFactory.isServiceAvailable("extendedMarket"),
					// ML Enhancement Metadata (only if requested)
					...(include_ml && {
						mlEnhancementEnabled: true,
						mlModelsUsed: ml_models || ["default"],
						mlHorizon: ml_horizon,
						mlLatency,
					}),
					// Early Signal Detection Metadata - removed, now handled in StockSelectionService
				},
			},
			// Include warnings if any
			...(warnings.length > 0 && { warnings }),
		};

		return NextResponse.json(response);
	} catch (error) {
		console.error("Stock selection error:", error);

		// Return appropriate status codes for different error types
		if (error instanceof z.ZodError) {
			return NextResponse.json(
				{
					success: false,
					error: "Invalid request format",
				},
				{ status: 400 }
			);
		}

		return NextResponse.json(
			{
				success: false,
				error: "Internal server error",
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
		const health = await financialDataService.getProviderHealth();

		// Convert provider health to simple format
		const services: { [key: string]: boolean } = {};
		health.forEach((provider: { name: string; healthy: boolean }) => {
			services[provider.name.toLowerCase().replace(/\s+/g, "")] = provider.healthy;
		});

		return NextResponse.json({
			success: true,
			data: {
				status: "healthy",
				services,
				providers: health,
				timestamp: Date.now(),
			},
		});
	} catch (error) {
		return NextResponse.json(
			{
				success: false,
				error: "Health check failed",
			},
			{ status: 500 }
		);
	}
}
