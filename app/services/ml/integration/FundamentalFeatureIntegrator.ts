/**
 * FundamentalFeatureIntegrator
 *
 * Bridges VFR's existing FMP API fundamental data to the ML feature pipeline.
 * Transforms fundamental ratios into the flat feature format expected by ML models.
 *
 * Key Responsibilities:
 * - Extract fundamental features from FinancialModelingPrepAPI (NO CHANGES to existing API)
 * - Transform FundamentalRatios → MLFeatureVector format
 * - Provide parallel batch processing for multiple symbols
 * - Cache fundamental features with 15-minute TTL (ML cache patterns)
 * - Graceful fallback to default features on failure
 *
 * Performance Target: <1000ms for 25 symbols
 */

import { FinancialModelingPrepAPI } from '../../financial-data/FinancialModelingPrepAPI';
import { RedisCache } from '../../cache/RedisCache';
import { MLCacheService } from '../cache/MLCacheService';
import { FundamentalFeatureExtractor } from '../features/FundamentalFeatureExtractor';
import type { FundamentalRatios } from '../../financial-data/types';
import type { FundamentalFeatures } from '../features/FundamentalFeatureExtractor';

/**
 * Fundamental features extracted for ML models
 */
export interface FundamentalFeaturesML {
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
 * Configuration for fundamental feature extraction
 */
export interface FundamentalFeatureConfig {
  // Performance settings
  timeout: number; // Timeout for feature extraction
  enableCache: boolean;
  cacheTTL: number; // Cache TTL in seconds (default: 900 = 15 minutes)

  // Fallback settings
  enableFallback: boolean; // Use default features on failure
}

const DEFAULT_CONFIG: FundamentalFeatureConfig = {
  timeout: 5000,
  enableCache: true,
  cacheTTL: 900, // 15 minutes
  enableFallback: true
};

/**
 * Default feature values for fallback
 */
const DEFAULT_FEATURES: Record<string, number> = {
  // Valuation
  'pe_ratio': 0,
  'peg_ratio': 0,
  'pb_ratio': 0,
  'price_to_sales': 0,
  'price_to_fcf': 0,
  'valuation_score': 0.5,
  'is_premium_valuation': 0,
  'relative_valuation': 0.5,

  // Profitability
  'roe': 0,
  'roa': 0,
  'gross_margin': 0,
  'operating_margin': 0,
  'net_margin': 0,
  'profitability_score': 0,
  'margin_trend': 0,
  'is_high_quality': 0,

  // Financial Health
  'debt_to_equity': 0,
  'current_ratio': 1,
  'quick_ratio': 1,
  'health_score': 0.5,
  'leverage_risk': 0,
  'liquidity_strength': 0.5,
  'is_stressed': 0,

  // Shareholder Return
  'dividend_yield': 0,
  'payout_ratio': 0,
  'dividend_sustainability': 0.5,
  'is_income_focused': 0,
  'dividend_growth_potential': 0
};

export class FundamentalFeatureIntegrator {
  private fmpAPI: FinancialModelingPrepAPI;
  private mlCache: MLCacheService;
  private cache: RedisCache;
  private config: FundamentalFeatureConfig;

  constructor(
    cache?: RedisCache,
    config?: Partial<FundamentalFeatureConfig>
  ) {
    this.cache = cache || new RedisCache();
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialize services (NO CHANGES to existing services)
    this.fmpAPI = new FinancialModelingPrepAPI();
    this.mlCache = MLCacheService.getInstance();
  }

  /**
   * Extract fundamental features for a single symbol
   */
  async extractFundamentalFeatures(symbol: string): Promise<FundamentalFeaturesML> {
    const startTime = Date.now();

    try {
      // Check cache first (15-minute TTL)
      if (this.config.enableCache) {
        const cached = await this.getCachedFeatures(symbol);
        if (cached) {
          return cached;
        }
      }

      // Fetch fundamental ratios from FMP API
      const ratios = await this.fmpAPI.getFundamentalRatios(symbol);

      if (!ratios) {
        console.warn(`No fundamental ratios available for ${symbol}, using defaults`);
        return this.getDefaultFeatures(symbol, Date.now() - startTime);
      }

      // Extract features using FundamentalFeatureExtractor
      const extractedFeatures = FundamentalFeatureExtractor.extractFeatures(symbol, ratios);

      // Transform to ML feature vector format
      const features = this.transformToMLFeatures(extractedFeatures);

      const calculationTime = Date.now() - startTime;

      const result: FundamentalFeaturesML = {
        symbol,
        timestamp: Date.now(),
        features,
        metadata: {
          sources: [ratios.source],
          dataQuality: extractedFeatures.dataCompleteness,
          completeness: extractedFeatures.dataCompleteness,
          calculationTime
        }
      };

      // Cache the result
      if (this.config.enableCache) {
        await this.cacheFeatures(symbol, result);
      }

      return result;

    } catch (error) {
      console.error(`Error extracting fundamental features for ${symbol}:`, error);
      return this.getDefaultFeatures(symbol, Date.now() - startTime);
    }
  }

  /**
   * Extract fundamental features for multiple symbols in parallel
   */
  async extractBatchFeatures(symbols: string[]): Promise<FundamentalFeaturesML[]> {
    const startTime = Date.now();
    console.log(`📊 Extracting fundamental features for ${symbols.length} symbols in parallel...`);

    const results = await Promise.all(
      symbols.map(symbol => this.extractFundamentalFeatures(symbol))
    );

    const elapsed = Date.now() - startTime;
    console.log(`⚡ Fundamental batch extraction completed in ${elapsed}ms (${(elapsed / symbols.length).toFixed(0)}ms per symbol)`);

    return results;
  }

  /**
   * Transform FundamentalFeatures to flat ML feature vector
   */
  private transformToMLFeatures(features: FundamentalFeatures): Record<string, number> {
    return {
      // Valuation features
      'pe_ratio': features.valuation.peRatio,
      'peg_ratio': features.valuation.pegRatio,
      'pb_ratio': features.valuation.pbRatio,
      'price_to_sales': features.valuation.priceToSales,
      'price_to_fcf': features.valuation.priceToFreeCashFlow,
      'valuation_score': features.valuation.valuationScore,
      'is_premium_valuation': features.valuation.isPremiumValuation ? 1 : 0,
      'relative_valuation': features.valuation.relativeValuation,

      // Profitability features
      'roe': features.profitability.roe,
      'roa': features.profitability.roa,
      'gross_margin': features.profitability.grossProfitMargin,
      'operating_margin': features.profitability.operatingMargin,
      'net_margin': features.profitability.netProfitMargin,
      'profitability_score': features.profitability.profitabilityScore,
      'margin_trend': features.profitability.marginTrend,
      'is_high_quality': features.profitability.isHighQuality ? 1 : 0,

      // Financial health features
      'debt_to_equity': features.financialHealth.debtToEquity,
      'current_ratio': features.financialHealth.currentRatio,
      'quick_ratio': features.financialHealth.quickRatio,
      'health_score': features.financialHealth.healthScore,
      'leverage_risk': features.financialHealth.leverageRisk,
      'liquidity_strength': features.financialHealth.liquidityStrength,
      'is_stressed': features.financialHealth.isFinanciallyStressed ? 1 : 0,

      // Shareholder return features
      'dividend_yield': features.shareholderReturn.dividendYield,
      'payout_ratio': features.shareholderReturn.payoutRatio,
      'dividend_sustainability': features.shareholderReturn.dividendSustainability,
      'is_income_focused': features.shareholderReturn.isIncomeFocused ? 1 : 0,
      'dividend_growth_potential': features.shareholderReturn.dividendGrowthPotential
    };
  }

  /**
   * Get default features when data is unavailable
   */
  private getDefaultFeatures(symbol: string, calculationTime: number): FundamentalFeaturesML {
    return {
      symbol,
      timestamp: Date.now(),
      features: { ...DEFAULT_FEATURES },
      metadata: {
        sources: ['default'],
        dataQuality: 0,
        completeness: 0,
        calculationTime
      }
    };
  }

  /**
   * Get cached features
   */
  private async getCachedFeatures(symbol: string): Promise<FundamentalFeaturesML | null> {
    try {
      const cached = await this.mlCache.getCachedFeatureVector(symbol);

      if (cached) {
        return {
          symbol,
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
      console.warn(`Cache retrieval failed for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Cache features
   */
  private async cacheFeatures(symbol: string, features: FundamentalFeaturesML): Promise<void> {
    try {
      const featureVector = {
        symbol,
        features: features.features,
        featureNames: Object.keys(features.features),
        timestamp: features.timestamp,
        completeness: features.metadata.completeness,
        qualityScore: features.metadata.dataQuality
      };

      await this.mlCache.cacheFeatureVector(
        symbol,
        featureVector
      );
    } catch (error) {
      console.warn(`Failed to cache features for ${symbol}:`, error);
    }
  }

  /**
   * Get feature count
   */
  getFeatureCount(): number {
    return Object.keys(DEFAULT_FEATURES).length;
  }

  /**
   * Get feature names
   */
  getFeatureNames(): string[] {
    return Object.keys(DEFAULT_FEATURES);
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const fmpHealth = await this.fmpAPI.healthCheck();
      const cacheHealth = await this.cache.ping() === 'PONG';
      return fmpHealth && cacheHealth;
    } catch (error) {
      console.error('FundamentalFeatureIntegrator health check failed:', error);
      return false;
    }
  }
}
