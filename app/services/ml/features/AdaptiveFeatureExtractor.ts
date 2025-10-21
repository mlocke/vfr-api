/**
 * Adaptive Feature Extraction Registry
 *
 * Purpose: Dynamically extract features based on model metadata requirements
 * - Reads model's metadata.json to determine required features
 * - Only extracts features that the model actually needs
 * - Automatically adapts to new features without code changes
 * - Shared across all ML models for consistency
 *
 * Design:
 * - Registry pattern: Maps feature names to extraction functions
 * - Lazy loading: Only fetches data when needed
 * - Caching: Reuses fetched data across multiple feature extractions
 */

import { CongressionalTradingService } from '../../financial-data/CongressionalTradingService';
import { PolygonAPI } from '../../financial-data/PolygonAPI';
import { EODHDAPI } from '../../financial-data/EODHDAPI';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Feature extraction function signature
 */
type FeatureExtractorFn = (
	symbol: string,
	asOfDate: Date,
	dataCache: DataCache
) => Promise<number>;

/**
 * Cache for fetched data to avoid redundant API calls
 */
interface DataCache {
	congressionalTrades?: any[];
	ohlcvBars?: any[];
	darkPoolMetrics?: any;
	optionsData?: any;
}

/**
 * Model metadata structure
 */
interface ModelMetadata {
	features: string[];
	num_features: number;
	model_version: string;
}

/**
 * Adaptive Feature Extractor
 * Extracts only the features required by a specific model version
 */
export class AdaptiveFeatureExtractor {
	private static featureRegistry: Map<string, FeatureExtractorFn> = new Map();
	private static initialized = false;

	private congressService: CongressionalTradingService;
	private polygonAPI: PolygonAPI;
	private eodhdAPI: EODHDAPI;

	constructor() {
		this.congressService = new CongressionalTradingService();
		this.polygonAPI = new PolygonAPI();
		this.eodhdAPI = new EODHDAPI();

		// Initialize the feature registry on first instantiation
		if (!AdaptiveFeatureExtractor.initialized) {
			this.initializeFeatureRegistry();
			AdaptiveFeatureExtractor.initialized = true;
		}
	}

	/**
	 * Extract features for a model based on its metadata
	 * @param modelPath Path to the model directory (e.g., "models/smart-money-flow/v2.0.0")
	 * @param symbol Stock symbol
	 * @param asOfDate Date to extract features for
	 * @returns Array of feature values in the order specified by metadata
	 */
	async extractFeaturesForModel(
		modelPath: string,
		symbol: string,
		asOfDate: Date
	): Promise<number[]> {
		const startTime = Date.now();

		// Load model metadata
		const metadata = this.loadModelMetadata(modelPath);
		console.log(
			`[AdaptiveFeatureExtractor] Extracting ${metadata.num_features} features for ${symbol} (model: ${metadata.model_version})`
		);

		// Create data cache to avoid redundant API calls
		const dataCache: DataCache = {};

		// Extract each feature in order
		const featureValues: number[] = [];
		for (const featureName of metadata.features) {
			const extractor = AdaptiveFeatureExtractor.featureRegistry.get(featureName);

			if (!extractor) {
				console.warn(
					`[AdaptiveFeatureExtractor] No extractor found for feature: ${featureName}, using 0.0`
				);
				featureValues.push(0.0);
				continue;
			}

			try {
				const value = await extractor(symbol, asOfDate, dataCache);
				featureValues.push(value);
			} catch (error) {
				console.error(
					`[AdaptiveFeatureExtractor] Failed to extract ${featureName} for ${symbol}:`,
					error
				);
				// Use 0.0 as fallback for failed extractions
				featureValues.push(0.0);
			}
		}

		const duration = Date.now() - startTime;
		console.log(
			`[AdaptiveFeatureExtractor] Extracted ${featureValues.length} features for ${symbol} in ${duration}ms`
		);

		return featureValues;
	}

	/**
	 * Get feature names required by a model
	 */
	getRequiredFeatures(modelPath: string): string[] {
		const metadata = this.loadModelMetadata(modelPath);
		return metadata.features;
	}

	/**
	 * Load model metadata from file
	 */
	private loadModelMetadata(modelPath: string): ModelMetadata {
		const metadataPath = path.join(modelPath, 'metadata.json');

		if (!fs.existsSync(metadataPath)) {
			throw new Error(`Model metadata not found: ${metadataPath}`);
		}

		const metadataContent = fs.readFileSync(metadataPath, 'utf-8');
		const metadata = JSON.parse(metadataContent);

		if (!metadata.features || !Array.isArray(metadata.features)) {
			throw new Error(`Invalid metadata: missing features array in ${metadataPath}`);
		}

		return {
			features: metadata.features,
			num_features: metadata.num_features || metadata.features.length,
			model_version: metadata.model_version || 'unknown',
		};
	}

	/**
	 * Initialize the feature extraction registry
	 * Maps feature names to extraction functions
	 */
	private initializeFeatureRegistry(): void {
		const registry = AdaptiveFeatureExtractor.featureRegistry;

		// ===== INSIDER TRADING FEATURES =====
		registry.set('insider_buy_volume_30d', async (symbol, asOfDate, cache) => {
			// TODO: Implement insider buy volume extraction
			return 0.0;
		});

		registry.set('insider_sell_volume_30d', async (symbol, asOfDate, cache) => {
			// TODO: Implement insider sell volume extraction
			return 0.0;
		});

		registry.set('insider_buy_ratio_30d', async (symbol, asOfDate, cache) => {
			// TODO: Implement insider buy ratio extraction
			return 0.0;
		});

		registry.set('insider_transaction_count_30d', async (symbol, asOfDate, cache) => {
			// TODO: Implement insider transaction count extraction
			return 0.0;
		});

		// ===== CONGRESSIONAL TRADING FEATURES =====
		registry.set('congress_buy_count_90d', async (symbol, asOfDate, cache) => {
			const trades = await this.getCongressionalTrades(symbol, asOfDate, cache, 90);
			return trades.filter((t) => t.type === 'purchase').length;
		});

		registry.set('congress_sell_count_90d', async (symbol, asOfDate, cache) => {
			const trades = await this.getCongressionalTrades(symbol, asOfDate, cache, 90);
			return trades.filter((t) => t.type === 'sale').length;
		});

		registry.set('congress_net_sentiment_90d', async (symbol, asOfDate, cache) => {
			const trades = await this.getCongressionalTrades(symbol, asOfDate, cache, 90);
			const buys = trades.filter((t) => t.type === 'purchase').length;
			const sells = trades.filter((t) => t.type === 'sale').length;
			const total = buys + sells;
			return total === 0 ? 0 : (buys - sells) / total;
		});

		// ===== PRICE MOMENTUM FEATURES =====
		registry.set('price_momentum_14d', async (symbol, asOfDate, cache) => {
			const bars = await this.getOHLCVBars(symbol, asOfDate, cache, 14);
			if (bars.length < 2) return 0.0;
			const currentPrice = bars[bars.length - 1].close;
			const startPrice = bars[0].close;
			return (currentPrice - startPrice) / startPrice;
		});

		registry.set('price_momentum_20d', async (symbol, asOfDate, cache) => {
			const bars = await this.getOHLCVBars(symbol, asOfDate, cache, 20);
			if (bars.length < 2) return 0.0;
			const currentPrice = bars[bars.length - 1].close;
			const startPrice = bars[0].close;
			return (currentPrice - startPrice) / startPrice;
		});

		// ===== VOLATILITY FEATURES =====
		registry.set('price_volatility_30d', async (symbol, asOfDate, cache) => {
			const bars = await this.getOHLCVBars(symbol, asOfDate, cache, 30);
			if (bars.length < 2) return 0.0;

			// Calculate daily returns
			const returns = [];
			for (let i = 1; i < bars.length; i++) {
				const dailyReturn = (bars[i].close - bars[i - 1].close) / bars[i - 1].close;
				returns.push(dailyReturn);
			}

			// Calculate standard deviation
			const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
			const variance =
				returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
			return Math.sqrt(variance);
		});

		console.log(
			`[AdaptiveFeatureExtractor] Initialized registry with ${registry.size} feature extractors`
		);
	}

	// ===== HELPER METHODS FOR DATA FETCHING =====

	private async getCongressionalTrades(
		symbol: string,
		asOfDate: Date,
		cache: DataCache,
		daysBack: number
	): Promise<any[]> {
		if (cache.congressionalTrades) {
			return cache.congressionalTrades;
		}

		try {
			const trades = await this.congressService.getCongressionalTrades(symbol);
			// Filter trades by date range
			const startDate = new Date(asOfDate.getTime() - daysBack * 24 * 60 * 60 * 1000);
			const filtered = trades.filter((t: any) => {
				const tradeDate = new Date(t.date || t.transactionDate);
				return tradeDate >= startDate && tradeDate <= asOfDate;
			});
			cache.congressionalTrades = filtered;
			return filtered;
		} catch (error) {
			console.error(`Failed to fetch congressional trades for ${symbol}:`, error);
			cache.congressionalTrades = [];
			return [];
		}
	}

	private async getOHLCVBars(
		symbol: string,
		asOfDate: Date,
		cache: DataCache,
		daysBack: number
	): Promise<any[]> {
		if (cache.ohlcvBars) {
			return cache.ohlcvBars;
		}

		const startDate = new Date(asOfDate.getTime() - daysBack * 24 * 60 * 60 * 1000);
		try {
			const bars = await this.polygonAPI.getAggregates(
				symbol,
				1,
				'day',
				startDate.toISOString().split('T')[0],
				asOfDate.toISOString().split('T')[0]
			);
			// Handle both array and object with results property
			const barsArray = Array.isArray(bars) ? bars : [];
			cache.ohlcvBars = barsArray;
			return barsArray;
		} catch (error) {
			console.error(`Failed to fetch OHLCV bars for ${symbol}:`, error);
			cache.ohlcvBars = [];
			return [];
		}
	}

	/**
	 * Register a new feature extractor
	 * Allows models to add custom features
	 */
	static registerFeature(featureName: string, extractor: FeatureExtractorFn): void {
		AdaptiveFeatureExtractor.featureRegistry.set(featureName, extractor);
		console.log(`[AdaptiveFeatureExtractor] Registered custom feature: ${featureName}`);
	}

	/**
	 * Check if a feature is supported
	 */
	static hasFeature(featureName: string): boolean {
		return AdaptiveFeatureExtractor.featureRegistry.has(featureName);
	}
}
