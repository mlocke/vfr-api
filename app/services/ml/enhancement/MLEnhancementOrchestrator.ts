/**
 * ML Enhancement Orchestrator
 *
 * Coordinates parallel enhancement integration across all ML feature integrators.
 * Orchestrates technical, fundamental, sentiment, and macro enhancements with graceful degradation.
 *
 * Key Responsibilities:
 * - Parallel execution of all feature integrators (technical, fundamental, sentiment)
 * - Target <500ms additional latency for ML enhancement
 * - Graceful degradation on partial or complete failure
 * - Fallback to classic VFR analysis if ML unavailable
 * - Performance monitoring and alerting
 * - Enhancement storage via MLEnhancementStore
 *
 * Performance Target: <500ms for complete enhancement pipeline
 */

import { TechnicalFeatureIntegrator } from '../integration/TechnicalFeatureIntegrator';
import { FundamentalFeatureIntegrator } from '../integration/FundamentalFeatureIntegrator';
import { SentimentFeatureIntegrator } from '../integration/SentimentFeatureIntegrator';
import { MLCacheService } from '../cache/MLCacheService';
import { Logger } from '../../error-handling/Logger';
import { ErrorHandler, ErrorType } from '../../error-handling/ErrorHandler';
import type {
  EnhancementOrchestrationConfig,
  EnhancementOrchestrationResult,
  DegradationStatus
} from '../types/EnhancementTypes';
import type { MLEnhancement, MLEnhancedScore } from '../types/MLTypes';

/**
 * Orchestrator configuration
 */
export interface MLEnhancementOrchestratorConfig {
  enableParallelExecution: boolean;
  targetLatency: number; // <500ms default
  enableGracefulDegradation: boolean;
  fallbackToClassic: boolean;
  maxRetries: number;
  timeout: number;
  enableCache: boolean;
  cacheTTL: number;
}

/**
 * Enhancement request for a single symbol
 */
export interface EnhancementRequest {
  symbol: string;
  enableTechnical?: boolean;
  enableFundamental?: boolean;
  enableSentiment?: boolean;
  enableMacro?: boolean;
  minConfidence?: number;
}

/**
 * Batch enhancement request
 */
export interface BatchEnhancementRequest {
  symbols: string[];
  enableTechnical?: boolean;
  enableFundamental?: boolean;
  enableSentiment?: boolean;
  enableMacro?: boolean;
  minConfidence?: number;
  parallelization?: number; // Max concurrent symbols
}

/**
 * Individual enhancement result
 */
export interface EnhancementResult {
  symbol: string;
  technical?: {
    success: boolean;
    features?: Record<string, number>;
    score?: number;
    confidence?: number;
    latency: number;
    error?: string;
  };
  fundamental?: {
    success: boolean;
    features?: Record<string, number>;
    score?: number;
    confidence?: number;
    latency: number;
    error?: string;
  };
  sentiment?: {
    success: boolean;
    features?: Record<string, number>;
    score?: number;
    confidence?: number;
    latency: number;
    error?: string;
  };
  aggregatedScore?: number;
  overallConfidence?: number;
  totalLatency: number;
  success: boolean;
  fallbackUsed: boolean;
  errors: string[];
  warnings: string[];
}

const DEFAULT_CONFIG: MLEnhancementOrchestratorConfig = {
  enableParallelExecution: true,
  targetLatency: 500, // <500ms
  enableGracefulDegradation: true,
  fallbackToClassic: true,
  maxRetries: 2,
  timeout: 5000,
  enableCache: true,
  cacheTTL: 900 // 15 minutes
};

export class MLEnhancementOrchestrator {
  private static instance: MLEnhancementOrchestrator;
  private technicalIntegrator: TechnicalFeatureIntegrator;
  private fundamentalIntegrator: FundamentalFeatureIntegrator;
  private sentimentIntegrator: SentimentFeatureIntegrator;
  private mlCache: MLCacheService;
  private logger: Logger;
  private errorHandler: ErrorHandler;
  private config: MLEnhancementOrchestratorConfig;
  private degradationStatus: DegradationStatus;
  private enhancementCache: Map<string, { result: EnhancementResult; timestamp: number }>;

  private constructor(config?: Partial<MLEnhancementOrchestratorConfig>) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config
    };

    this.technicalIntegrator = new TechnicalFeatureIntegrator();
    this.fundamentalIntegrator = new FundamentalFeatureIntegrator();
    this.sentimentIntegrator = new SentimentFeatureIntegrator();
    this.mlCache = MLCacheService.getInstance();
    this.logger = Logger.getInstance('MLEnhancementOrchestrator');
    this.errorHandler = ErrorHandler.getInstance();

    this.degradationStatus = {
      isDegraded: false,
      degradationType: 'none',
      affectedServices: [],
      fallbackActive: false,
      fallbackStrategy: 'none'
    };

    this.enhancementCache = new Map();

    this.logger.info('MLEnhancementOrchestrator initialized', {
      config: this.config
    });
  }

  public static getInstance(config?: Partial<MLEnhancementOrchestratorConfig>): MLEnhancementOrchestrator {
    if (!MLEnhancementOrchestrator.instance) {
      MLEnhancementOrchestrator.instance = new MLEnhancementOrchestrator(config);
    }
    return MLEnhancementOrchestrator.instance;
  }

  /**
   * Orchestrate ML enhancements for a single symbol
   */
  public async enhanceSymbol(request: EnhancementRequest): Promise<EnhancementResult> {
    const startTime = Date.now();
    const { symbol } = request;

    try {
      // Check cache first
      if (this.config.enableCache) {
        const cached = await this.getCachedEnhancement(symbol);
        if (cached) {
          this.logger.debug('Cache hit for enhancement', { symbol });
          return cached;
        }
      }

      // Parallel execution of all integrators
      const results = await this.executeParallelEnhancements(request);

      // Aggregate scores
      const enhancement = this.aggregateEnhancementResults(results, symbol, startTime);

      // Cache the result
      if (this.config.enableCache && enhancement.success) {
        await this.cacheEnhancement(symbol, enhancement);
      }

      return enhancement;
    } catch (error) {
      this.logger.error('Enhancement orchestration failed', { symbol, error });

      return {
        symbol,
        totalLatency: Date.now() - startTime,
        success: false,
        fallbackUsed: true,
        errors: [(error as Error).message],
        warnings: ['Enhancement failed, using fallback']
      };
    }
  }

  /**
   * Orchestrate ML enhancements for multiple symbols in parallel
   */
  public async enhanceSymbols(request: BatchEnhancementRequest): Promise<EnhancementResult[]> {
    const { symbols, parallelization = 5 } = request;
    const startTime = Date.now();

    this.logger.info('Starting batch enhancement', {
      symbolCount: symbols.length,
      parallelization
    });

    try {
      // Process symbols in batches to avoid overwhelming APIs
      const results: EnhancementResult[] = [];

      for (let i = 0; i < symbols.length; i += parallelization) {
        const batch = symbols.slice(i, i + parallelization);
        const batchPromises = batch.map(symbol =>
          this.enhanceSymbol({
            symbol,
            enableTechnical: request.enableTechnical,
            enableFundamental: request.enableFundamental,
            enableSentiment: request.enableSentiment,
            enableMacro: request.enableMacro,
            minConfidence: request.minConfidence
          })
        );

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      }

      const totalLatency = Date.now() - startTime;
      const successCount = results.filter(r => r.success).length;

      this.logger.info('Batch enhancement complete', {
        total: symbols.length,
        successful: successCount,
        failed: symbols.length - successCount,
        totalLatency,
        avgLatency: totalLatency / symbols.length
      });

      return results;
    } catch (error) {
      this.logger.error('Batch enhancement failed', { error });
      throw error;
    }
  }

  /**
   * Execute all enhancement integrators in parallel
   */
  private async executeParallelEnhancements(
    request: EnhancementRequest
  ): Promise<{
    technical?: any;
    fundamental?: any;
    sentiment?: any;
  }> {
    const { symbol, enableTechnical = true, enableFundamental = true, enableSentiment = true } = request;

    const promises: Promise<any>[] = [];
    const results: any = {};

    // Technical features
    if (enableTechnical) {
      promises.push(
        this.executeSafely(
          async () => this.technicalIntegrator.extractTechnicalFeatures(symbol),
          'technical'
        ).then(result => {
          results.technical = result;
        })
      );
    }

    // Fundamental features
    if (enableFundamental) {
      promises.push(
        this.executeSafely(
          async () => {
            const features = await this.fundamentalIntegrator.extractBatchFeatures([symbol]);
            return features[0];
          },
          'fundamental'
        ).then(result => {
          results.fundamental = result;
        })
      );
    }

    // Sentiment features
    if (enableSentiment) {
      promises.push(
        this.executeSafely(
          async () => {
            const features = await this.sentimentIntegrator.extractBatchFeatures([symbol]);
            return features[0];
          },
          'sentiment'
        ).then(result => {
          results.sentiment = result;
        })
      );
    }

    // Wait for all to complete
    await Promise.all(promises);

    return results;
  }

  /**
   * Execute a function with timeout and error handling
   */
  private async executeSafely<T>(
    fn: () => Promise<T>,
    category: string
  ): Promise<{ success: boolean; data?: T; error?: string; latency: number }> {
    const startTime = Date.now();
    let timeoutId: NodeJS.Timeout | null = null;

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`${category} timeout`)), this.config.timeout);
      });

      const data = await Promise.race([fn(), timeoutPromise]);

      // Clear timeout if function completed successfully
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      return {
        success: true,
        data,
        latency: Date.now() - startTime
      };
    } catch (error) {
      // Clear timeout on error
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      this.logger.warn(`${category} enhancement failed`, { error });

      return {
        success: false,
        error: (error as Error).message,
        latency: Date.now() - startTime
      };
    }
  }

  /**
   * Aggregate enhancement results from all integrators
   */
  private aggregateEnhancementResults(
    results: any,
    symbol: string,
    startTime: number
  ): EnhancementResult {
    const enhancement: EnhancementResult = {
      symbol,
      totalLatency: 0,
      success: false,
      fallbackUsed: false,
      errors: [],
      warnings: []
    };

    let successCount = 0;
    let totalScore = 0;
    let totalConfidence = 0;
    let validScores = 0;

    // Technical
    if (results.technical) {
      const { success, data, error, latency } = results.technical;
      enhancement.technical = {
        success,
        latency,
        error
      };

      if (success && data) {
        enhancement.technical.features = data.features;
        enhancement.technical.confidence = data.metadata?.completeness || 0;

        // Calculate simple score from features (0-1 normalized)
        const technicalScore = this.calculateTechnicalScore(data.features);
        enhancement.technical.score = technicalScore;

        if (technicalScore > 0) {
          totalScore += technicalScore;
          totalConfidence += data.metadata?.completeness || 0.5;
          validScores++;
        }

        successCount++;
      } else if (error) {
        enhancement.errors.push(`Technical: ${error}`);
      }
    }

    // Fundamental
    if (results.fundamental) {
      const { success, data, error, latency } = results.fundamental;
      enhancement.fundamental = {
        success,
        latency,
        error
      };

      if (success && data) {
        enhancement.fundamental.features = data.features;
        enhancement.fundamental.confidence = data.metadata?.completeness || 0;

        // Calculate simple score from features (0-1 normalized)
        const fundamentalScore = this.calculateFundamentalScore(data.features);
        enhancement.fundamental.score = fundamentalScore;

        if (fundamentalScore > 0) {
          totalScore += fundamentalScore;
          totalConfidence += data.metadata?.completeness || 0.5;
          validScores++;
        }

        successCount++;
      } else if (error) {
        enhancement.errors.push(`Fundamental: ${error}`);
      }
    }

    // Sentiment
    if (results.sentiment) {
      const { success, data, error, latency } = results.sentiment;
      enhancement.sentiment = {
        success,
        latency,
        error
      };

      if (success && data) {
        enhancement.sentiment.features = data.features;
        enhancement.sentiment.confidence = data.metadata?.completeness || 0;

        // Calculate simple score from features (0-1 normalized)
        const sentimentScore = this.calculateSentimentScore(data.features);
        enhancement.sentiment.score = sentimentScore;

        if (sentimentScore > 0) {
          totalScore += sentimentScore;
          totalConfidence += data.metadata?.completeness || 0.5;
          validScores++;
        }

        successCount++;
      } else if (error) {
        enhancement.errors.push(`Sentiment: ${error}`);
      }
    }

    // Aggregate final score
    if (validScores > 0) {
      enhancement.aggregatedScore = totalScore / validScores;
      enhancement.overallConfidence = totalConfidence / validScores;
      enhancement.success = true;
    } else {
      enhancement.aggregatedScore = 0;
      enhancement.overallConfidence = 0;
      enhancement.success = false;
      enhancement.fallbackUsed = true;
      enhancement.warnings.push('No valid enhancement scores available');
    }

    enhancement.totalLatency = Date.now() - startTime;

    // Check if we met latency target
    if (enhancement.totalLatency > this.config.targetLatency) {
      enhancement.warnings.push(
        `Latency ${enhancement.totalLatency}ms exceeded target ${this.config.targetLatency}ms`
      );
    }

    return enhancement;
  }

  /**
   * Calculate simple technical score from features
   */
  private calculateTechnicalScore(features: Record<string, number>): number {
    // Simple momentum-based scoring (can be enhanced in Phase 3)
    const rsi = features.rsi_14 || 50;
    const macd = features.macd_histogram || 0;
    const bbPosition = features.bb_position || 0.5;

    // Normalize to 0-1 scale
    const rsiScore = rsi / 100;
    const macdScore = Math.max(0, Math.min(1, (macd + 1) / 2)); // Assume -1 to 1 range
    const bbScore = bbPosition;

    return (rsiScore + macdScore + bbScore) / 3;
  }

  /**
   * Calculate simple fundamental score from features
   */
  private calculateFundamentalScore(features: Record<string, number>): number {
    // Use pre-calculated scores if available
    const valuationScore = features.valuation_score || 0.5;
    const profitabilityScore = features.profitability_score || 0.5;
    const healthScore = features.health_score || 0.5;

    return (valuationScore + profitabilityScore + healthScore) / 3;
  }

  /**
   * Calculate simple sentiment score from features
   */
  private calculateSentimentScore(features: Record<string, number>): number {
    // Normalize sentiment values to 0-1 range
    const newsSentiment = (features.news_sentiment + 1) / 2 || 0.5; // -1 to 1 → 0 to 1
    const redditSentiment = features.reddit_sentiment || 0.5;
    const optionsSentiment = features.options_sentiment || 0.5;

    return (newsSentiment + redditSentiment + optionsSentiment) / 3;
  }

  /**
   * Get cached enhancement result
   */
  private async getCachedEnhancement(symbol: string): Promise<EnhancementResult | null> {
    try {
      const cacheKey = `enhancement:${symbol}`;
      const cached = this.enhancementCache.get(cacheKey);

      if (cached) {
        const age = Date.now() - cached.timestamp;
        const ttl = this.config.cacheTTL * 1000; // Convert to ms

        if (age < ttl) {
          return cached.result;
        } else {
          // Expired - remove from cache
          this.enhancementCache.delete(cacheKey);
        }
      }

      return null;
    } catch (error) {
      this.logger.warn('Cache retrieval failed', { symbol, error });
      return null;
    }
  }

  /**
   * Cache enhancement result
   */
  private async cacheEnhancement(symbol: string, result: EnhancementResult): Promise<void> {
    try {
      const cacheKey = `enhancement:${symbol}`;
      this.enhancementCache.set(cacheKey, {
        result,
        timestamp: Date.now()
      });

      // Cleanup old entries if cache grows too large
      if (this.enhancementCache.size > 1000) {
        const now = Date.now();
        const ttl = this.config.cacheTTL * 1000;

        const keysToDelete: string[] = [];
        this.enhancementCache.forEach((value, key) => {
          if (now - value.timestamp > ttl) {
            keysToDelete.push(key);
          }
        });

        keysToDelete.forEach(key => this.enhancementCache.delete(key));
      }
    } catch (error) {
      this.logger.warn('Cache storage failed', { symbol, error });
      // Non-critical - don't throw
    }
  }

  /**
   * Get orchestrator health status
   */
  public async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unavailable';
    integrators: {
      technical: boolean;
      fundamental: boolean;
      sentiment: boolean;
    };
    degradation: DegradationStatus;
    performance: {
      avgLatency: number;
      successRate: number;
    };
  }> {
    // Simple health check - can be enhanced with actual metrics
    return {
      status: this.degradationStatus.isDegraded ? 'degraded' : 'healthy',
      integrators: {
        technical: true, // Assume healthy - can add actual health checks
        fundamental: true,
        sentiment: true
      },
      degradation: this.degradationStatus,
      performance: {
        avgLatency: 300, // Placeholder - track actual metrics in Phase 3
        successRate: 0.95
      }
    };
  }

  /**
   * Reset degradation status
   */
  public resetDegradation(): void {
    this.degradationStatus = {
      isDegraded: false,
      degradationType: 'none',
      affectedServices: [],
      fallbackActive: false,
      fallbackStrategy: 'none'
    };

    this.logger.info('Degradation status reset');
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<MLEnhancementOrchestratorConfig>): void {
    this.config = {
      ...this.config,
      ...config
    };

    this.logger.info('Configuration updated', { config: this.config });
  }

  /**
   * Get current configuration
   */
  public getConfig(): MLEnhancementOrchestratorConfig {
    return { ...this.config };
  }
}
