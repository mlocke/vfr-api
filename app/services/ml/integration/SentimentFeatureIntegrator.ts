/**
 * SentimentFeatureIntegrator
 *
 * Bridges VFR's existing SentimentAnalysisService to the ML feature pipeline.
 * Transforms sentiment indicators into the flat feature format expected by ML models.
 *
 * Key Responsibilities:
 * - Extract sentiment features from SentimentAnalysisService (NO CHANGES to existing service)
 * - Transform SentimentIndicators → MLFeatureVector format
 * - Provide parallel batch processing for multiple symbols
 * - Cache sentiment features with 15-minute TTL (ML cache patterns)
 * - Graceful fallback to default features on failure
 *
 * Performance Target: <1500ms for 25 symbols (sentiment APIs can be slower)
 */

import { SentimentAnalysisService } from '../../financial-data/SentimentAnalysisService';
import { RedisCache } from '../../cache/RedisCache';
import { MLCacheService } from '../cache/MLCacheService';
import { SentimentFeatureExtractor } from '../features/SentimentFeatureExtractor';
import type { SentimentIndicators } from '../../financial-data/types/sentiment-types';
import type { SentimentFeatures } from '../features/SentimentFeatureExtractor';

/**
 * Sentiment features extracted for ML models
 */
export interface SentimentFeaturesML {
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
 * Configuration for sentiment feature extraction
 */
export interface SentimentFeatureConfig {
  // Performance settings
  timeout: number; // Timeout for feature extraction
  enableCache: boolean;
  cacheTTL: number; // Cache TTL in seconds (default: 900 = 15 minutes)

  // Fallback settings
  enableFallback: boolean; // Use default features on failure

  // Analyst data integration
  includeAnalystData: boolean; // Include analyst consensus in sentiment
}

const DEFAULT_CONFIG: SentimentFeatureConfig = {
  timeout: 15000, // 15 seconds (sentiment can be slower due to multiple APIs)
  enableCache: true,
  cacheTTL: 900, // 15 minutes
  enableFallback: true,
  includeAnalystData: false // Optional analyst integration
};

/**
 * Default feature values for fallback
 */
const DEFAULT_FEATURES: Record<string, number> = {
  // News features
  'news_sentiment': 0,
  'news_confidence': 0,
  'article_count': 0,
  'source_count': 0,
  'news_strength': 0,
  'news_volume': 0,
  'is_high_activity': 0,

  // Social/Reddit features
  'reddit_sentiment': 0.5,
  'reddit_confidence': 0,
  'post_count': 0,
  'reddit_strength': 0,
  'reddit_activity': 0,
  'is_retail_buzz': 0,

  // Options features
  'options_sentiment': 0.5,
  'options_confidence': 0,
  'put_call_ratio': 1.0,
  'open_interest_ratio': 1.0,
  'options_strength': 0,
  'is_bullish_options': 0,
  'is_bearish_options': 0,
  'has_institutional_flow': 0,
  'institutional_direction': 0,

  // Momentum features
  'sentiment_momentum': 0,
  'sentiment_acceleration': 0,
  'news_momentum': 0,
  'reddit_momentum': 0,
  'options_momentum': 0,
  'news_reddit_divergence': 0,
  'news_options_divergence': 0,
  'consensus_strength': 1,

  // Embeddings
  'overall_sentiment': 0.5,
  'sentiment_confidence': 0,
  'sentiment_diversity': 0,
  'professional_sentiment': 0.5,
  'retail_sentiment': 0.5,
  'institutional_sentiment': 0.5,
  'short_term_sentiment': 0.5,
  'medium_term_sentiment': 0.5,
  'weighted_sentiment': 0.5
};

export class SentimentFeatureIntegrator {
  private sentimentService: SentimentAnalysisService;
  private mlCache: MLCacheService;
  private cache: RedisCache;
  private config: SentimentFeatureConfig;
  private previousIndicators: Map<string, SentimentIndicators>; // For momentum calculation

  constructor(
    cache?: RedisCache,
    config?: Partial<SentimentFeatureConfig>
  ) {
    this.cache = cache || new RedisCache();
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialize services (NO CHANGES to existing services)
    this.sentimentService = new SentimentAnalysisService(this.cache);
    this.mlCache = MLCacheService.getInstance();
    this.previousIndicators = new Map();
  }

  /**
   * Extract sentiment features for a single symbol
   */
  async extractSentimentFeatures(
    symbol: string,
    analystData?: any // Optional analyst consensus data
  ): Promise<SentimentFeaturesML> {
    const startTime = Date.now();

    try {
      // Check cache first (15-minute TTL)
      if (this.config.enableCache) {
        const cached = await this.getCachedFeatures(symbol);
        if (cached) {
          return cached;
        }
      }

      // Fetch sentiment indicators from SentimentAnalysisService
      const indicators = await this.sentimentService.getSentimentIndicators(
        symbol,
        this.config.includeAnalystData ? analystData : undefined
      );

      if (!indicators) {
        console.warn(`No sentiment indicators available for ${symbol}, using defaults`);
        return this.getDefaultFeatures(symbol, Date.now() - startTime);
      }

      // Get previous indicators for momentum calculation
      const previousIndicators = this.previousIndicators.get(symbol);

      // Extract features using SentimentFeatureExtractor
      const extractedFeatures = SentimentFeatureExtractor.extractFeatures(
        symbol,
        indicators,
        previousIndicators
      );

      // Store current indicators for future momentum calculations
      this.previousIndicators.set(symbol, indicators);

      // Transform to ML feature vector format
      const features = this.transformToMLFeatures(extractedFeatures);

      const calculationTime = Date.now() - startTime;

      // Determine sources
      const sources: string[] = ['news'];
      if (indicators.reddit) sources.push('reddit');
      if (indicators.options) sources.push('options');

      const result: SentimentFeaturesML = {
        symbol,
        timestamp: Date.now(),
        features,
        metadata: {
          sources,
          dataQuality: indicators.confidence,
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
      console.error(`Error extracting sentiment features for ${symbol}:`, error);
      return this.getDefaultFeatures(symbol, Date.now() - startTime);
    }
  }

  /**
   * Extract sentiment features for multiple symbols in parallel
   */
  async extractBatchFeatures(
    symbols: string[],
    analystDataMap?: Map<string, any>
  ): Promise<SentimentFeaturesML[]> {
    const startTime = Date.now();
    console.log(`📊 Extracting sentiment features for ${symbols.length} symbols in parallel...`);

    const results = await Promise.all(
      symbols.map(symbol =>
        this.extractSentimentFeatures(
          symbol,
          analystDataMap?.get(symbol)
        )
      )
    );

    const elapsed = Date.now() - startTime;
    console.log(`⚡ Sentiment batch extraction completed in ${elapsed}ms (${(elapsed / symbols.length).toFixed(0)}ms per symbol)`);

    return results;
  }

  /**
   * Transform SentimentFeatures to flat ML feature vector
   */
  private transformToMLFeatures(features: SentimentFeatures): Record<string, number> {
    return {
      // News features
      'news_sentiment': features.news.newsSentiment,
      'news_confidence': features.news.newsConfidence,
      'article_count': features.news.articleCount,
      'source_count': features.news.sourceCount,
      'news_strength': features.news.newsStrength,
      'news_volume': features.news.newsVolume,
      'is_high_activity': features.news.isHighActivity ? 1 : 0,

      // Social/Reddit features
      'reddit_sentiment': features.social.redditSentiment,
      'reddit_confidence': features.social.redditConfidence,
      'post_count': features.social.postCount,
      'reddit_strength': features.social.redditStrength,
      'reddit_activity': features.social.redditActivity,
      'is_retail_buzz': features.social.isRetailBuzz ? 1 : 0,

      // Options features
      'options_sentiment': features.options.optionsSentiment,
      'options_confidence': features.options.optionsConfidence,
      'put_call_ratio': features.options.putCallRatio,
      'open_interest_ratio': features.options.openInterestRatio,
      'options_strength': features.options.optionsStrength,
      'is_bullish_options': features.options.isBullishOptions ? 1 : 0,
      'is_bearish_options': features.options.isBearishOptions ? 1 : 0,
      'has_institutional_flow': features.options.hasInstitutionalFlow ? 1 : 0,
      'institutional_direction': features.options.institutionalDirection,

      // Momentum features
      'sentiment_momentum': features.momentum.sentimentMomentum,
      'sentiment_acceleration': features.momentum.sentimentAcceleration,
      'news_momentum': features.momentum.newsMomentum,
      'reddit_momentum': features.momentum.redditMomentum,
      'options_momentum': features.momentum.optionsMomentum,
      'news_reddit_divergence': features.momentum.newsVsRedditDivergence,
      'news_options_divergence': features.momentum.newsVsOptionsDivergence,
      'consensus_strength': features.momentum.consensusStrength,

      // Embeddings
      'overall_sentiment': features.embeddings.overallSentiment,
      'sentiment_confidence': features.embeddings.sentimentConfidence,
      'sentiment_diversity': features.embeddings.sentimentDiversity,
      'professional_sentiment': features.embeddings.professionalSentiment,
      'retail_sentiment': features.embeddings.retailSentiment,
      'institutional_sentiment': features.embeddings.institutionalSentiment,
      'short_term_sentiment': features.embeddings.shortTermSentiment,
      'medium_term_sentiment': features.embeddings.mediumTermSentiment,
      'weighted_sentiment': features.embeddings.weightedSentiment
    };
  }

  /**
   * Get default features when data is unavailable
   */
  private getDefaultFeatures(symbol: string, calculationTime: number): SentimentFeaturesML {
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
  private async getCachedFeatures(symbol: string): Promise<SentimentFeaturesML | null> {
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
  private async cacheFeatures(symbol: string, features: SentimentFeaturesML): Promise<void> {
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
   * Clear momentum history for a symbol (useful for testing)
   */
  clearMomentumHistory(symbol?: string): void {
    if (symbol) {
      this.previousIndicators.delete(symbol);
    } else {
      this.previousIndicators.clear();
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const sentimentHealth = await this.sentimentService.healthCheck();
      const cacheHealth = await this.cache.ping() === 'PONG';
      return sentimentHealth.status === 'healthy' && cacheHealth;
    } catch (error) {
      console.error('SentimentFeatureIntegrator health check failed:', error);
      return false;
    }
  }
}
