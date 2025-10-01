/**
 * TechnicalFeatureIntegrator
 *
 * Bridges VFR's existing TechnicalIndicatorService and VWAPService to the ML feature pipeline.
 * Transforms rich technical analysis data into the flat feature format expected by ML models.
 *
 * Key Responsibilities:
 * - Extract technical features from TechnicalIndicatorService (NO CHANGES to existing service)
 * - Extract VWAP features from VWAPService (NO CHANGES to existing service)
 * - Transform TechnicalAnalysisResult → MLFeatureVector format
 * - Provide parallel batch processing for multiple symbols
 * - Cache technical features with 15-minute TTL (ML cache patterns)
 * - Graceful fallback to default features on failure
 *
 * Performance Target: <500ms for 25 symbols
 */

import { TechnicalIndicatorService } from '../../technical-analysis/TechnicalIndicatorService';
import { VWAPService } from '../../financial-data/VWAPService';
import { RedisCache } from '../../cache/RedisCache';
import { FinancialModelingPrepAPI } from '../../financial-data/FinancialModelingPrepAPI';
import { MLCacheService } from '../cache/MLCacheService';
import type { OHLCData } from '../../technical-analysis/types';
import type { MarketData } from '../../financial-data/types';

/**
 * Technical features extracted for ML models
 */
export interface TechnicalFeatures {
  symbol: string;
  timestamp: number;
  features: Record<string, number>;
  metadata: {
    sources: string[];
    dataQuality: number;
    completeness: number;
    calculationTime: number;
  };
}

/**
 * Configuration for technical feature extraction
 */
export interface TechnicalFeatureConfig {
  // Historical data settings
  historicalPeriods: number; // Number of days of history to fetch

  // Feature groups to extract
  enableTrend: boolean;
  enableMomentum: boolean;
  enableVolume: boolean;
  enableVolatility: boolean;
  enableVWAP: boolean;

  // Performance settings
  timeout: number; // Timeout for feature extraction
  enableCache: boolean;
  cacheTTL: number; // Cache TTL in seconds (default: 900 = 15 minutes)

  // Fallback settings
  enableFallback: boolean; // Use default features on failure
}

const DEFAULT_CONFIG: TechnicalFeatureConfig = {
  historicalPeriods: 250, // Support long-term SMAs (200-day)
  enableTrend: true,
  enableMomentum: true,
  enableVolume: true,
  enableVolatility: true,
  enableVWAP: true,
  timeout: 5000,
  enableCache: true,
  cacheTTL: 900, // 15 minutes
  enableFallback: true
};

/**
 * Default feature values for fallback
 */
const DEFAULT_FEATURES: Record<string, number> = {
  // Trend
  'sma_5': 0,
  'sma_10': 0,
  'sma_20': 0,
  'sma_50': 0,
  'sma_200': 0,
  'ema_12': 0,
  'ema_26': 0,
  'macd_signal': 0,
  'macd_histogram': 0,
  'bb_position': 0.5,
  'bb_width': 0,

  // Momentum
  'rsi_14': 50,
  'stochastic_k': 50,
  'stochastic_d': 50,
  'williams_r': -50,
  'roc': 0,

  // Volume
  'obv': 0,
  'volume_ratio': 1.0,

  // Volatility
  'atr': 0,
  'volatility_20d': 0.25,

  // Price momentum (calculated features)
  'momentum_1d': 0,
  'momentum_5d': 0,
  'momentum_20d': 0,

  // VWAP
  'vwap_deviation': 0,
  'vwap_signal': 0.5
};

export class TechnicalFeatureIntegrator {
  private technicalService: TechnicalIndicatorService;
  private vwapService: VWAPService;
  private fmpAPI: FinancialModelingPrepAPI;
  private mlCache: MLCacheService;
  private cache: RedisCache;
  private config: TechnicalFeatureConfig;

  constructor(
    cache?: RedisCache,
    config?: Partial<TechnicalFeatureConfig>
  ) {
    this.cache = cache || new RedisCache();
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialize services (NO CHANGES to existing services)
    this.fmpAPI = new FinancialModelingPrepAPI();
    this.technicalService = new TechnicalIndicatorService(this.cache);
    this.vwapService = new VWAPService(this.fmpAPI, this.cache);
    this.mlCache = MLCacheService.getInstance();
  }

  /**
   * Extract technical features for a single symbol
   */
  async extractTechnicalFeatures(symbol: string): Promise<TechnicalFeatures> {
    const startTime = Date.now();

    try {
      // Check cache first (15-minute TTL)
      if (this.config.enableCache) {
        const cached = await this.getCachedFeatures(symbol);
        if (cached) {
          return cached;
        }
      }

      // Fetch historical data for technical calculations
      const historicalData = await this.getHistoricalData(
        symbol,
        this.config.historicalPeriods
      );

      if (!historicalData || historicalData.length < 50) {
        console.warn(`Insufficient historical data for ${symbol}, using defaults`);
        return this.getDefaultFeatures(symbol, startTime);
      }

      // Convert to OHLC format for TechnicalIndicatorService
      const ohlcData = this.convertToOHLC(historicalData);

      // Extract features in parallel
      const [technicalFeatures, vwapFeatures, momentumFeatures] = await Promise.all([
        this.extractFromTechnicalService(symbol, ohlcData),
        this.config.enableVWAP ? this.extractFromVWAPService(symbol) : Promise.resolve({}),
        this.calculateMomentumFeatures(ohlcData)
      ]);

      // Combine all features
      const features: Record<string, number> = {
        ...technicalFeatures,
        ...vwapFeatures,
        ...momentumFeatures
      };

      // Calculate metadata
      const calculationTime = Date.now() - startTime;
      const completeness = this.calculateCompleteness(features);
      const dataQuality = this.calculateDataQuality(historicalData, features);

      const result: TechnicalFeatures = {
        symbol,
        timestamp: Date.now(),
        features,
        metadata: {
          sources: ['TechnicalIndicatorService', 'VWAPService', 'FinancialModelingPrepAPI'],
          dataQuality,
          completeness,
          calculationTime
        }
      };

      // Cache the result
      if (this.config.enableCache) {
        await this.cacheFeatures(symbol, result);
      }

      // Performance warning
      if (calculationTime > 1000) {
        console.warn(`Technical feature extraction for ${symbol} took ${calculationTime}ms (target: <500ms)`);
      }

      return result;

    } catch (error) {
      console.error(`Error extracting technical features for ${symbol}:`, error);

      if (this.config.enableFallback) {
        return this.getDefaultFeatures(symbol, startTime);
      }

      throw error;
    }
  }

  /**
   * Extract features for multiple symbols in parallel
   * Performance Target: <500ms for 25 symbols
   */
  async extractBatchFeatures(symbols: string[]): Promise<Map<string, TechnicalFeatures>> {
    const startTime = Date.now();

    try {
      // Process all symbols in parallel
      const results = await Promise.allSettled(
        symbols.map(symbol => this.extractTechnicalFeatures(symbol))
      );

      // Collect successful results
      const featureMap = new Map<string, TechnicalFeatures>();

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          featureMap.set(symbols[index], result.value);
        } else {
          console.error(`Failed to extract features for ${symbols[index]}:`, result.reason);

          // Use default features for failed symbols
          if (this.config.enableFallback) {
            featureMap.set(symbols[index], this.getDefaultFeatures(symbols[index], startTime));
          }
        }
      });

      const totalTime = Date.now() - startTime;
      const avgTime = totalTime / symbols.length;

      // Performance monitoring
      console.log(`Batch technical feature extraction: ${symbols.length} symbols in ${totalTime}ms (avg: ${avgTime.toFixed(0)}ms/symbol)`);

      if (totalTime > 5000) {
        console.warn(`Batch feature extraction took ${totalTime}ms for ${symbols.length} symbols (target: <5s for 25 symbols)`);
      }

      return featureMap;

    } catch (error) {
      console.error('Error in batch feature extraction:', error);
      throw error;
    }
  }

  /**
   * Extract features from TechnicalIndicatorService
   */
  private async extractFromTechnicalService(
    symbol: string,
    ohlcData: OHLCData[]
  ): Promise<Record<string, number>> {
    try {
      const analysis = await this.technicalService.calculateAllIndicators({
        symbol,
        ohlcData
      });

      const features: Record<string, number> = {};

      // Trend indicators
      if (this.config.enableTrend && analysis.trend) {
        const sma = analysis.trend.indicators.sma || [];
        features['sma_5'] = sma.find(s => s.period === 5)?.value || 0;
        features['sma_10'] = sma.find(s => s.period === 10)?.value || 0;
        features['sma_20'] = sma.find(s => s.period === 20)?.value || 0;
        features['sma_50'] = sma.find(s => s.period === 50)?.value || 0;
        features['sma_200'] = sma.find(s => s.period === 200)?.value || 0;

        const ema = analysis.trend.indicators.ema || [];
        features['ema_12'] = ema.find(e => e.period === 12)?.value || 0;
        features['ema_26'] = ema.find(e => e.period === 26)?.value || 0;

        const macd = analysis.trend.indicators.macd;
        if (macd) {
          features['macd_signal'] = macd.signal || 0;
          features['macd_histogram'] = macd.histogram || 0;
        }

        const bollinger = analysis.trend.indicators.bollinger;
        if (bollinger) {
          features['bb_position'] = bollinger.position || 0.5;
          // Calculate Bollinger Band width (normalized)
          const currentPrice = ohlcData[ohlcData.length - 1]?.close || 1;
          const width = currentPrice > 0
            ? (bollinger.upper - bollinger.lower) / currentPrice
            : 0;
          features['bb_width'] = width;
        }
      }

      // Momentum indicators
      if (this.config.enableMomentum && analysis.momentum) {
        const rsi = analysis.momentum.indicators.rsi;
        if (rsi) {
          features['rsi_14'] = rsi.value || 50;
        }

        const stochastic = analysis.momentum.indicators.stochastic;
        if (stochastic) {
          features['stochastic_k'] = stochastic.k || 50;
          features['stochastic_d'] = stochastic.d || 50;
        }

        const williams = analysis.momentum.indicators.williams;
        if (williams) {
          features['williams_r'] = williams.value || -50;
        }

        const roc = analysis.momentum.indicators.roc;
        if (roc) {
          features['roc'] = roc.value || 0;
        }
      }

      // Volume indicators
      if (this.config.enableVolume && analysis.volume) {
        const obv = analysis.volume.indicators.obv;
        if (obv) {
          features['obv'] = obv.value || 0;
        }

        // Volume ratio (current vs average)
        const recentVolumes = ohlcData.slice(-20).map(d => d.volume);
        const avgVolume = recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length;
        const currentVolume = ohlcData[ohlcData.length - 1]?.volume || avgVolume;
        features['volume_ratio'] = avgVolume > 0 ? currentVolume / avgVolume : 1.0;
      }

      // Volatility indicators
      if (this.config.enableVolatility && analysis.volatility) {
        const atr = analysis.volatility.indicators.atr;
        if (atr) {
          features['atr'] = atr.value || 0;
        }

        // Calculate 20-day realized volatility
        const volatility = this.calculateRealizedVolatility(ohlcData, 20);
        features['volatility_20d'] = volatility;
      }

      return features;

    } catch (error) {
      console.error(`Error extracting features from TechnicalIndicatorService for ${symbol}:`, error);
      return {};
    }
  }

  /**
   * Extract features from VWAPService
   */
  private async extractFromVWAPService(symbol: string): Promise<Record<string, number>> {
    try {
      const vwapAnalysis = await this.vwapService.getVWAPAnalysis(symbol);

      if (!vwapAnalysis) {
        return {
          'vwap_deviation': 0,
          'vwap_signal': 0.5
        };
      }

      // Convert VWAP signal to numeric (0-1)
      let vwapSignal = 0.5;
      if (vwapAnalysis.signal === 'above') {
        vwapSignal = 0.75;
      } else if (vwapAnalysis.signal === 'below') {
        vwapSignal = 0.25;
      }

      // Adjust by strength
      if (vwapAnalysis.strength === 'strong') {
        vwapSignal = vwapAnalysis.signal === 'above' ? 1.0 : 0.0;
      } else if (vwapAnalysis.strength === 'moderate') {
        vwapSignal = vwapAnalysis.signal === 'above' ? 0.75 : 0.25;
      }

      return {
        'vwap_deviation': vwapAnalysis.deviationPercent,
        'vwap_signal': vwapSignal
      };

    } catch (error) {
      console.error(`Error extracting VWAP features for ${symbol}:`, error);
      return {
        'vwap_deviation': 0,
        'vwap_signal': 0.5
      };
    }
  }

  /**
   * Calculate momentum features from price data
   */
  private calculateMomentumFeatures(ohlcData: OHLCData[]): Record<string, number> {
    if (ohlcData.length < 20) {
      return {
        'momentum_1d': 0,
        'momentum_5d': 0,
        'momentum_20d': 0
      };
    }

    const currentPrice = ohlcData[ohlcData.length - 1].close;

    // 1-day momentum
    const price1d = ohlcData[ohlcData.length - 2]?.close || currentPrice;
    const momentum1d = price1d > 0 ? (currentPrice - price1d) / price1d : 0;

    // 5-day momentum
    const price5d = ohlcData[ohlcData.length - 6]?.close || currentPrice;
    const momentum5d = price5d > 0 ? (currentPrice - price5d) / price5d : 0;

    // 20-day momentum
    const price20d = ohlcData[ohlcData.length - 21]?.close || currentPrice;
    const momentum20d = price20d > 0 ? (currentPrice - price20d) / price20d : 0;

    return {
      'momentum_1d': momentum1d,
      'momentum_5d': momentum5d,
      'momentum_20d': momentum20d
    };
  }

  /**
   * Calculate realized volatility
   */
  private calculateRealizedVolatility(ohlcData: OHLCData[], periods: number): number {
    if (ohlcData.length < periods + 1) {
      return 0.25; // Default volatility
    }

    // Calculate log returns
    const returns: number[] = [];
    for (let i = ohlcData.length - periods; i < ohlcData.length; i++) {
      const prevClose = ohlcData[i - 1]?.close;
      const currClose = ohlcData[i]?.close;
      if (prevClose && currClose && prevClose > 0) {
        returns.push(Math.log(currClose / prevClose));
      }
    }

    if (returns.length === 0) {
      return 0.25;
    }

    // Calculate standard deviation of returns
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    // Annualize (252 trading days)
    return stdDev * Math.sqrt(252);
  }

  /**
   * Get historical data using FinancialModelingPrepAPI
   */
  private async getHistoricalData(
    symbol: string,
    periods: number
  ): Promise<MarketData[] | null> {
    try {
      const data = await this.fmpAPI.getHistoricalData(symbol, periods);
      return data;
    } catch (error) {
      console.error(`Error fetching historical data for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Convert MarketData to OHLCData format
   */
  private convertToOHLC(historicalData: MarketData[]): OHLCData[] {
    return historicalData.map(h => ({
      timestamp: h.timestamp,
      open: h.open,
      high: h.high,
      low: h.low,
      close: h.close,
      volume: h.volume
    }));
  }

  /**
   * Calculate feature completeness (0-1)
   */
  private calculateCompleteness(features: Record<string, number>): number {
    const expectedFeatures = Object.keys(DEFAULT_FEATURES).length;
    const actualFeatures = Object.keys(features).length;
    return Math.min(actualFeatures / expectedFeatures, 1.0);
  }

  /**
   * Calculate data quality score (0-1)
   */
  private calculateDataQuality(
    historicalData: MarketData[],
    features: Record<string, number>
  ): number {
    let qualityScore = 0;

    // Historical data availability (40% weight)
    const dataAvailability = Math.min(historicalData.length / this.config.historicalPeriods, 1.0);
    qualityScore += dataAvailability * 0.4;

    // Feature completeness (30% weight)
    const completeness = this.calculateCompleteness(features);
    qualityScore += completeness * 0.3;

    // Data freshness (30% weight)
    const latestTimestamp = historicalData[historicalData.length - 1]?.timestamp || 0;
    const ageMinutes = (Date.now() - latestTimestamp) / (1000 * 60);
    const freshness = ageMinutes < 60 ? 1.0 : Math.max(1.0 - (ageMinutes / 1440), 0); // Decay over 24 hours
    qualityScore += freshness * 0.3;

    return Math.max(0, Math.min(1.0, qualityScore));
  }

  /**
   * Get cached features
   */
  private async getCachedFeatures(symbol: string): Promise<TechnicalFeatures | null> {
    try {
      // Use ML cache pattern: vfr:ml:feature:vector:{SYMBOL}
      const cacheKey = `vfr:ml:feature:vector:${symbol.toUpperCase()}`;
      const cached = await this.mlCache.getCachedFeatureVector(symbol);

      if (cached && this.isFresh(cached, this.config.cacheTTL * 1000)) {
        // Convert MLFeatureVector to TechnicalFeatures format
        return {
          symbol: cached.symbol,
          timestamp: cached.timestamp,
          features: cached.features,
          metadata: {
            sources: ['cache'],
            dataQuality: cached.qualityScore,
            completeness: cached.completeness,
            calculationTime: 0
          }
        };
      }

      return null;
    } catch (error) {
      console.error(`Error reading cache for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Cache features
   */
  private async cacheFeatures(symbol: string, features: TechnicalFeatures): Promise<void> {
    try {
      // Convert TechnicalFeatures to MLFeatureVector format
      const featureVector = {
        symbol: features.symbol,
        features: features.features,
        featureNames: Object.keys(features.features),
        timestamp: features.timestamp,
        completeness: features.metadata.completeness,
        qualityScore: features.metadata.dataQuality
      };

      await this.mlCache.cacheFeatureVector(symbol, featureVector);
    } catch (error) {
      console.error(`Error caching features for ${symbol}:`, error);
    }
  }

  /**
   * Check if cached data is fresh
   */
  private isFresh(cached: any, maxAgeMs: number): boolean {
    return (Date.now() - cached.timestamp) < maxAgeMs;
  }

  /**
   * Get default features for fallback
   */
  private getDefaultFeatures(symbol: string, startTime: number): TechnicalFeatures {
    return {
      symbol,
      timestamp: Date.now(),
      features: { ...DEFAULT_FEATURES },
      metadata: {
        sources: ['default'],
        dataQuality: 0.1, // Low quality for defaults
        completeness: 1.0, // All default features present
        calculationTime: Date.now() - startTime
      }
    };
  }

  /**
   * Get configuration
   */
  getConfig(): TechnicalFeatureConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<TechnicalFeatureConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
