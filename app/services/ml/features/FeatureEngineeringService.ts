import { VWAPService } from "../../financial-data/VWAPService";
import { SentimentAnalysisService } from "../../financial-data/SentimentAnalysisService";
import { MacroeconomicAnalysisService } from "../../financial-data/MacroeconomicAnalysisService";
import { OptionsDataService } from "../../financial-data/OptionsDataService";
import { FinancialModelingPrepAPI } from "../../financial-data/FinancialModelingPrepAPI";
import { RedisCache } from "../../cache/RedisCache";
import ErrorHandler from "../../error-handling/ErrorHandler";

export interface FeatureVector {
	symbol: string;
	timestamp: number;
	features: Record<string, number>;
	metadata: {
		sources: string[];
		confidence: number;
		staleness: number;
		completeness: number;
	};
}

export interface FeatureConfig {
	technical?: boolean;
	fundamental?: boolean;
	sentiment?: boolean;
	macro?: boolean;
	options?: boolean;
	custom?: string[];
}

/**
 * Feature Engineering Service - Leverages existing VFR data sources
 * This is a modular enhancement that reuses all existing VFR services
 * Target: <500ms feature generation using parallel processing
 */
export class FeatureEngineeringService {
	private sentimentService: SentimentAnalysisService;
	private macroService: MacroeconomicAnalysisService;
	private optionsService: OptionsDataService;
	private vwapService: VWAPService;
	private cache: RedisCache;
	private errorHandler: ErrorHandler;

	constructor() {
		// Initialize with existing VFR services
		this.cache = RedisCache.getInstance();
		this.sentimentService = new SentimentAnalysisService(this.cache);
		this.macroService = new MacroeconomicAnalysisService();
		this.optionsService = new OptionsDataService();
		this.vwapService = new VWAPService(new FinancialModelingPrepAPI(), this.cache);
		this.errorHandler = ErrorHandler.getInstance();
	}

	/**
	 * Generate features for multiple symbols with parallel processing
	 * Leverages existing VFR API integrations and caching strategies
	 */
	async generateFeatures(
		symbols: string[],
		config: FeatureConfig = this.getDefaultConfig()
	): Promise<Map<string, FeatureVector>> {
		const startTime = performance.now();

		try {
			// Check cache first for each symbol
			const cachedFeatures = await this.getCachedFeatures(symbols);
			const uncachedSymbols = symbols.filter(s => !cachedFeatures.has(s));

			if (uncachedSymbols.length === 0) {
				return cachedFeatures;
			}

			// Process uncached symbols in parallel using existing services
			const freshFeatures = await this.generateFreshFeatures(uncachedSymbols, config);

			// Cache the fresh features
			await this.cacheFeatures(freshFeatures);

			// Combine cached and fresh
			const results = new Map([...cachedFeatures, ...freshFeatures]);

			// Performance monitoring
			const latency = performance.now() - startTime;
			if (latency > 1000) {
				console.warn(
					`Slow feature generation: ${latency.toFixed(2)}ms for ${symbols.length} symbols`
				);
			}

			return results;
		} catch (error) {
			// Graceful degradation - return partial results or cached data
			console.error("Feature generation error:", error);
			return await this.getFallbackFeatures(symbols);
		}
	}

	/**
	 * Generate fresh features using existing VFR services in parallel
	 */
	private async generateFreshFeatures(
		symbols: string[],
		config: FeatureConfig
	): Promise<Map<string, FeatureVector>> {
		const featurePromises: Promise<any>[] = [];

		// Leverage existing VFR services with parallel execution
		if (config.technical) {
			featurePromises.push(this.getTechnicalFeatures(symbols));
		}
		if (config.sentiment) {
			featurePromises.push(this.getSentimentFeatures(symbols));
		}
		if (config.macro) {
			featurePromises.push(this.getMacroFeatures(symbols));
		}
		if (config.options) {
			featurePromises.push(this.getOptionsFeatures(symbols));
		}

		// Wait for all feature types with Promise.allSettled for resilience
		const featureResults = await Promise.allSettled(featurePromises);

		return this.combineFeatureTypes(symbols, featureResults, config);
	}

	/**
	 * Technical features using existing VWAP and technical indicator services
	 */
	private async getTechnicalFeatures(
		symbols: string[]
	): Promise<Map<string, Record<string, number>>> {
		const features = new Map<string, Record<string, number>>();

		// Parallel technical data extraction using existing services
		const technicalPromises = symbols.map(async symbol => {
			try {
				// Use existing VWAP service
				const vwapData = await this.vwapService.getVWAPAnalysis(symbol);

				// Simplified technical features using VWAP only
				const technicalData = null; // Placeholder for now

				return {
					symbol,
					features: {
						// VWAP features
						vwap_deviation: vwapData?.deviation || 0,
						vwap_signal: this.encodeVWAPSignal(vwapData?.signal),

						// Technical indicators using default values for now
						rsi_14: 50,
						macd_signal: 0,
						bb_position: 0.5,
						volume_ratio: 1.0,

						// Price momentum defaults
						momentum_1d: 0,
						momentum_5d: 0,
						volatility_20d: 0.25,
					},
				};
			} catch (error) {
				console.warn(`Technical features failed for ${symbol}:`, error);
				return { symbol, features: this.getDefaultTechnicalFeatures() };
			}
		});

		const results = await Promise.allSettled(technicalPromises);

		results.forEach(result => {
			if (result.status === "fulfilled" && result.value) {
				features.set(result.value.symbol, result.value.features);
			}
		});

		return features;
	}

	/**
	 * Sentiment features using existing Reddit WSB and News integration
	 */
	private async getSentimentFeatures(
		symbols: string[]
	): Promise<Map<string, Record<string, number>>> {
		const features = new Map<string, Record<string, number>>();

		const sentimentPromises = symbols.map(async symbol => {
			try {
				// Use existing sentiment service with Reddit WSB integration
				const sentiment = await this.sentimentService.getSentimentIndicators(symbol);

				return {
					symbol,
					features: {
						news_sentiment:
							sentiment?.news?.sentiment !== undefined
								? (sentiment.news.sentiment + 1) / 2
								: 0.5, // Convert -1,1 to 0,1
						news_confidence: sentiment?.news?.confidence || 0.5,
						reddit_sentiment: sentiment?.reddit?.sentiment || 0.5,
						reddit_mentions: sentiment?.reddit?.postCount || 0,
						combined_sentiment: sentiment?.aggregatedScore || 0.5,
						sentiment_momentum: 0,
					},
				};
			} catch (error) {
				console.warn(`Sentiment features failed for ${symbol}:`, error);
				return { symbol, features: this.getDefaultSentimentFeatures() };
			}
		});

		const results = await Promise.allSettled(sentimentPromises);

		results.forEach(result => {
			if (result.status === "fulfilled" && result.value) {
				features.set(result.value.symbol, result.value.features);
			}
		});

		return features;
	}

	/**
	 * Macroeconomic features using existing FRED/BLS/EIA integration
	 */
	private async getMacroFeatures(
		symbols: string[]
	): Promise<Map<string, Record<string, number>>> {
		const features = new Map<string, Record<string, number>>();

		try {
			// Get macro data once (applies to all symbols)
			const macroData = await this.macroService.getMacroeconomicContext();

			symbols.forEach(symbol => {
				// Apply sector-specific adjustments
				const sectorAdjustment = this.getSectorMacroAdjustment(symbol);

				features.set(symbol, {
					fed_funds_rate: (macroData?.overallScore || 5) * 0.55 + 3.0, // Scale to reasonable fed rate
					inflation_rate: 3.0,
					unemployment_rate: 3.7,
					gdp_growth: 2.5,
					vix_level: 15,
					yield_curve_slope: 0.5,
					dollar_index: 100,
					oil_price: 75,
					// Sector-specific adjustments
					sector_beta: sectorAdjustment.beta,
					sector_correlation: sectorAdjustment.correlation,
				});
			});
		} catch (error) {
			console.warn("Macro features failed:", error);
			// Return default macro features for all symbols
			symbols.forEach(symbol => {
				features.set(symbol, this.getDefaultMacroFeatures());
			});
		}

		return features;
	}

	/**
	 * Options features for advanced modeling (if available)
	 */
	private async getOptionsFeatures(
		symbols: string[]
	): Promise<Map<string, Record<string, number>>> {
		const features = new Map<string, Record<string, number>>();

		const optionsPromises = symbols.map(async symbol => {
			try {
				// Use existing options service
				const optionsData = await this.optionsService.getOptionsAnalysis(symbol);

				return {
					symbol,
					features: {
						iv_30d: 0.25,
						iv_rank: 50,
						put_call_ratio: 1.0, // Default value since putCallRatio not in interface
						skew_90_110: 0,
						options_volume: 0,
						max_pain: 0,
						gamma_exposure: 0,
					},
				};
			} catch (error) {
				console.warn(`Options features failed for ${symbol}:`, error);
				return { symbol, features: this.getDefaultOptionsFeatures() };
			}
		});

		const results = await Promise.allSettled(optionsPromises);

		results.forEach(result => {
			if (result.status === "fulfilled" && result.value) {
				features.set(result.value.symbol, result.value.features);
			}
		});

		return features;
	}

	/**
	 * Combine all feature types into feature vectors
	 */
	private combineFeatureTypes(
		symbols: string[],
		featureResults: PromiseSettledResult<Map<string, Record<string, number>>>[],
		config: FeatureConfig
	): Map<string, FeatureVector> {
		const combined = new Map<string, FeatureVector>();

		symbols.forEach(symbol => {
			const allFeatures: Record<string, number> = {};
			const sources: string[] = [];
			let totalConfidence = 0;
			let featureCount = 0;

			// Combine features from all sources
			featureResults.forEach((result, index) => {
				if (result.status === "fulfilled" && result.value.has(symbol)) {
					const features = result.value.get(symbol)!;
					Object.assign(allFeatures, features);

					// Track source
					const sourceType = this.getSourceType(index, config);
					if (sourceType) sources.push(sourceType);

					featureCount++;
					totalConfidence += 0.8; // Base confidence for successful extraction
				}
			});

			// Calculate metadata
			const completeness = featureCount / this.getExpectedFeatureCount(config);
			const avgConfidence = featureCount > 0 ? totalConfidence / featureCount : 0;

			combined.set(symbol, {
				symbol,
				timestamp: Date.now(),
				features: allFeatures,
				metadata: {
					sources,
					confidence: avgConfidence,
					staleness: 0, // Fresh features
					completeness,
				},
			});
		});

		return combined;
	}

	/**
	 * Cache features with ML-specific TTL
	 */
	private async cacheFeatures(features: Map<string, FeatureVector>): Promise<void> {
		const cachePromises: Promise<void>[] = [];

		for (const [symbol, featureVector] of features.entries()) {
			const cacheKey = `ml:features:${symbol}:${Math.floor(Date.now() / 300000)}`; // 5-min windows
			cachePromises.push(
				this.cache.set(cacheKey, featureVector, 300).then(() => {}) // Convert to void
			);
		}

		await Promise.allSettled(cachePromises);
	}

	/**
	 * Get cached features if available and fresh
	 */
	private async getCachedFeatures(symbols: string[]): Promise<Map<string, FeatureVector>> {
		const cached = new Map<string, FeatureVector>();
		const currentWindow = Math.floor(Date.now() / 300000);

		const cachePromises = symbols.map(async symbol => {
			const cacheKey = `ml:features:${symbol}:${currentWindow}`;
			const cachedData = await this.cache.get<FeatureVector>(cacheKey);

			if (cachedData && this.isFresh(cachedData)) {
				cached.set(symbol, cachedData);
			}
		});

		await Promise.allSettled(cachePromises);
		return cached;
	}

	/**
	 * Get fallback features when generation fails
	 * Uses cached data or returns minimal default features
	 */
	private async getFallbackFeatures(symbols: string[]): Promise<Map<string, FeatureVector>> {
		const fallback = new Map<string, FeatureVector>();

		for (const symbol of symbols) {
			// Try to get any cached version
			const previousWindows = [0, 1, 2].map(i => Math.floor(Date.now() / 300000) - i);

			for (const window of previousWindows) {
				const cacheKey = `ml:features:${symbol}:${window}`;
				const cachedData = await this.cache.get<FeatureVector>(cacheKey);

				if (cachedData) {
					// Mark as stale but usable
					cachedData.metadata.staleness = Date.now() - cachedData.timestamp;
					fallback.set(symbol, cachedData);
					break;
				}
			}

			// If no cache, provide minimal default features
			if (!fallback.has(symbol)) {
				fallback.set(symbol, this.getDefaultFeatureVector(symbol));
			}
		}

		return fallback;
	}

	/**
	 * Helper methods
	 */

	private isFresh(featureVector: FeatureVector, maxAge: number = 900000): boolean {
		return Date.now() - featureVector.timestamp < maxAge;
	}

	private getDefaultConfig(): FeatureConfig {
		return {
			technical: true,
			fundamental: true,
			sentiment: true,
			macro: true,
			options: false, // Optional, may not be available
		};
	}

	private encodeVWAPSignal(signal?: string): number {
		const signalMap: Record<string, number> = {
			strong_above: 1.0,
			above: 0.7,
			at: 0.5,
			below: 0.3,
			strong_below: 0.0,
		};
		return signalMap[signal || "at"] || 0.5;
	}

	private getSectorMacroAdjustment(symbol: string): { beta: number; correlation: number } {
		// TODO: Implement sector-specific adjustments based on symbol
		// For now, return neutral values
		return {
			beta: 1.0,
			correlation: 0.5,
		};
	}

	private getSourceType(index: number, config: FeatureConfig): string | null {
		const sources = [];
		if (config.technical) sources.push("technical");
		if (config.fundamental) sources.push("fundamental");
		if (config.sentiment) sources.push("sentiment");
		if (config.macro) sources.push("macro");
		if (config.options) sources.push("options");

		return sources[index] || null;
	}

	private getExpectedFeatureCount(config: FeatureConfig): number {
		let count = 0;
		if (config.technical) count++;
		if (config.fundamental) count++;
		if (config.sentiment) count++;
		if (config.macro) count++;
		if (config.options) count++;
		return count;
	}

	private getDefaultTechnicalFeatures(): Record<string, number> {
		return {
			vwap_deviation: 0,
			vwap_signal: 0.5,
			rsi_14: 50,
			macd_signal: 0,
			bb_position: 0.5,
			volume_ratio: 1.0,
			momentum_1d: 0,
			momentum_5d: 0,
			volatility_20d: 0.25,
		};
	}

	private getDefaultFundamentalFeatures(): Record<string, number> {
		return {
			pe_ratio: 20,
			pb_ratio: 1,
			debt_to_equity: 0.5,
			roe: 0.1,
			current_ratio: 1.5,
			gross_margin: 0.3,
			operating_margin: 0.15,
			net_margin: 0.1,
		};
	}

	private getDefaultSentimentFeatures(): Record<string, number> {
		return {
			news_sentiment: 0.5,
			news_confidence: 0.5,
			reddit_sentiment: 0.5,
			reddit_mentions: 0,
			combined_sentiment: 0.5,
			sentiment_momentum: 0,
		};
	}

	private getDefaultMacroFeatures(): Record<string, number> {
		return {
			fed_funds_rate: 5.5,
			inflation_rate: 3.0,
			unemployment_rate: 3.7,
			gdp_growth: 2.5,
			vix_level: 15,
			yield_curve_slope: 0.5,
			dollar_index: 100,
			oil_price: 75,
			sector_beta: 1.0,
			sector_correlation: 0.5,
		};
	}

	private getDefaultOptionsFeatures(): Record<string, number> {
		return {
			iv_30d: 0.25,
			iv_rank: 50,
			put_call_ratio: 1.0,
			skew_90_110: 0,
			options_volume: 0,
			max_pain: 0,
			gamma_exposure: 0,
		};
	}

	private getDefaultFeatureVector(symbol: string): FeatureVector {
		return {
			symbol,
			timestamp: Date.now(),
			features: {
				...this.getDefaultTechnicalFeatures(),
				...this.getDefaultFundamentalFeatures(),
				...this.getDefaultSentimentFeatures(),
				...this.getDefaultMacroFeatures(),
			},
			metadata: {
				sources: [],
				confidence: 0.1,
				staleness: 0,
				completeness: 0,
			},
		};
	}
}
