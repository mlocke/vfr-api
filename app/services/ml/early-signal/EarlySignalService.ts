/**
 * Early Signal Service
 *
 * Task 4.1: Implement EarlySignalService for analyst rating upgrade predictions
 * Purpose: Integrate ML predictions into /api/stocks/select endpoint
 * Target: <100ms additional latency with caching
 *
 * Features:
 * - Predicts analyst rating upgrades 2 weeks ahead
 * - Model loading with singleton pattern
 * - Feature extraction and normalization integration
 * - Confidence filtering (skip 0.35-0.65 low-confidence predictions)
 * - Human-readable reasoning generation
 * - Redis caching (5min TTL)
 */

import { EarlySignalFeatureExtractor } from './FeatureExtractor'
import { FeatureNormalizer, NormalizationParams } from './FeatureNormalizer'
import { RedisCache } from '../../cache/RedisCache'
import type { EarlySignalPrediction, FeatureVector } from './types'
import * as fs from 'fs'
import * as path from 'path'

export interface EarlySignalConfig {
  modelPath: string
  normalizerParamsPath: string
  cacheTTL: number // seconds
  confidenceThresholdLow: number // Skip predictions below this
  confidenceThresholdHigh: number // Skip predictions below this
  enableCaching: boolean
}

export class EarlySignalService {
  private static modelInstance: any = null
  private static modelVersion: string = 'v1.0.0'
  private featureExtractor: EarlySignalFeatureExtractor
  private normalizer: FeatureNormalizer
  private cache: RedisCache
  private config: EarlySignalConfig
  private featureImportance: Record<string, number> = {}

  constructor(config?: Partial<EarlySignalConfig>) {
    this.featureExtractor = new EarlySignalFeatureExtractor()
    this.normalizer = new FeatureNormalizer()
    this.cache = new RedisCache()

    // Default configuration
    this.config = {
      modelPath: path.join(process.cwd(), 'models', 'early-signal', 'v1.0.0', 'model.json'),
      normalizerParamsPath: path.join(process.cwd(), 'models', 'early-signal', 'v1.0.0', 'normalizer.json'),
      cacheTTL: 300, // 5 minutes
      confidenceThresholdLow: 0.35,
      confidenceThresholdHigh: 0.65,
      enableCaching: true,
      ...config
    }

    console.log('EarlySignalService initialized')
  }

  /**
   * Predict analyst rating change for a symbol
   * @param symbol Stock symbol (e.g., 'TSLA')
   * @param sector Stock sector for context
   * @returns Prediction or null if confidence too low
   */
  async predictAnalystChange(symbol: string, sector: string): Promise<EarlySignalPrediction | null> {
    const startTime = Date.now()

    try {
      // Check cache first
      const cacheKey = this.getCacheKey(symbol)
      if (this.config.enableCaching) {
        const cached = await this.cache.get(cacheKey)
        if (cached) {
          console.log(`Cache hit for ${symbol} (${Date.now() - startTime}ms)`)
          return JSON.parse(cached)
        }
      }

      // Load model if not already loaded
      if (!EarlySignalService.modelInstance) {
        await this.loadModel()
      }

      // Extract and normalize features
      const features = await this.featureExtractor.extractFeatures(symbol)
      const normalizedFeatures = this.normalizer.transform(features)

      // Make prediction
      const probability = await this.predict(normalizedFeatures)

      // Filter low-confidence predictions (35-65% range is too uncertain)
      if (probability > this.config.confidenceThresholdLow &&
          probability < this.config.confidenceThresholdHigh) {
        console.log(`Low confidence prediction for ${symbol}: ${probability.toFixed(3)}`)
        return null
      }

      // Generate human-readable reasoning
      const reasoning = this.generateReasoning(features, probability)

      // Build prediction result
      const prediction: EarlySignalPrediction = {
        upgrade_likely: probability >= this.config.confidenceThresholdHigh,
        downgrade_likely: probability <= this.config.confidenceThresholdLow,
        confidence: probability >= 0.5 ? probability : 1 - probability,
        horizon: '2_weeks',
        reasoning,
        feature_importance: this.featureImportance,
        prediction_timestamp: Date.now(),
        model_version: EarlySignalService.modelVersion
      }

      // Cache the result
      if (this.config.enableCaching) {
        await this.cache.set(cacheKey, JSON.stringify(prediction), this.config.cacheTTL)
      }

      const latencyMs = Date.now() - startTime
      console.log(`Prediction completed for ${symbol} (${latencyMs}ms)`)

      return prediction
    } catch (error) {
      console.error(`Failed to predict analyst change for ${symbol}:`, error)
      return null
    }
  }

  /**
   * Load ML model and normalizer parameters
   */
  private async loadModel(): Promise<void> {
    try {
      console.log('Loading ML model and normalizer...')

      // Load normalizer parameters
      if (fs.existsSync(this.config.normalizerParamsPath)) {
        const normalizerData = JSON.parse(fs.readFileSync(this.config.normalizerParamsPath, 'utf-8'))
        this.normalizer.loadParams(normalizerData.params)
        console.log(`Normalizer parameters loaded (${Object.keys(normalizerData.params).length} features)`)
      } else {
        console.warn(`Normalizer parameters not found: ${this.config.normalizerParamsPath}`)
      }

      // Load model (placeholder for actual model loading)
      // In production, this would load LightGBM/XGBoost/LSTM model
      // For now, use a simple scoring function based on features
      EarlySignalService.modelInstance = {
        predict: (features: number[]) => {
          // Simple weighted scoring as placeholder
          // TODO: Replace with actual LightGBM model loading
          const weights = [
            0.15, 0.15, 0.15, // momentum features (45% total)
            0.08, 0.07, // volume features (15% total)
            0.05, 0.05, 0.05, // sentiment features (15% total)
            0.08, 0.07, 0.05, // fundamental features (20% total)
            0.03, 0.02 // technical features (5% total)
          ]

          const score = features.reduce((sum, feat, idx) => sum + feat * weights[idx], 0)
          // Convert to probability (sigmoid function)
          return 1 / (1 + Math.exp(-score))
        }
      }

      // Set default feature importance (would come from trained model)
      this.featureImportance = {
        'price_change_20d': 0.15,
        'price_change_10d': 0.12,
        'earnings_surprise': 0.10,
        'revenue_growth_accel': 0.09,
        'price_change_5d': 0.08,
        'volume_ratio': 0.08,
        'analyst_coverage_change': 0.07,
        'volume_trend': 0.06,
        'sentiment_news_delta': 0.06,
        'sentiment_reddit_accel': 0.05,
        'rsi_momentum': 0.05,
        'sentiment_options_shift': 0.05,
        'macd_histogram_trend': 0.04
      }

      console.log(`Model loaded successfully (version ${EarlySignalService.modelVersion})`)
    } catch (error) {
      console.error('Failed to load model:', error)
      throw new Error(`Model loading failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Make prediction using loaded model
   */
  private async predict(normalizedFeatures: number[]): Promise<number> {
    if (!EarlySignalService.modelInstance) {
      throw new Error('Model not loaded')
    }

    try {
      const probability = EarlySignalService.modelInstance.predict(normalizedFeatures)
      return probability
    } catch (error) {
      console.error('Prediction failed:', error)
      throw error
    }
  }

  /**
   * Generate human-readable reasoning from features
   */
  private generateReasoning(features: FeatureVector, probability: number): string[] {
    const reasoning: string[] = []
    const isUpgrade = probability >= this.config.confidenceThresholdHigh

    // Analyze top contributing features
    const sortedFeatures = Object.entries(this.featureImportance)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5) // Top 5 features

    for (const [featureName, importance] of sortedFeatures) {
      const featureValue = features[featureName as keyof FeatureVector]

      if (Math.abs(featureValue) > 0.1) { // Only include significant features
        const direction = featureValue > 0 ? 'positive' : 'negative'
        reasoning.push(this.getFeatureExplanation(featureName, featureValue, direction, isUpgrade))
      }
    }

    // Add overall signal
    if (isUpgrade) {
      reasoning.unshift(`Strong positive signals detected (${(probability * 100).toFixed(1)}% confidence)`)
    } else {
      reasoning.unshift(`Strong negative signals detected (${((1 - probability) * 100).toFixed(1)}% confidence)`)
    }

    return reasoning.length > 1 ? reasoning : ['Insufficient strong signals for high-confidence prediction']
  }

  /**
   * Get human-readable explanation for a feature
   */
  private getFeatureExplanation(
    featureName: string,
    value: number,
    direction: string,
    isUpgrade: boolean
  ): string {
    const absValue = Math.abs(value)
    const strength = absValue > 0.5 ? 'Strong' : absValue > 0.2 ? 'Moderate' : 'Slight'

    const explanations: Record<string, string> = {
      'price_change_20d': `${strength} 20-day price ${direction} momentum (${(value * 100).toFixed(1)}%)`,
      'price_change_10d': `${strength} 10-day price ${direction} trend (${(value * 100).toFixed(1)}%)`,
      'price_change_5d': `${strength} 5-day price ${direction} movement (${(value * 100).toFixed(1)}%)`,
      'volume_ratio': value > 0 ? 'Above-average trading volume' : 'Below-average trading volume',
      'volume_trend': `${strength} volume ${direction} trend`,
      'earnings_surprise': value > 0 ? `Earnings beat by ${value.toFixed(1)}%` : `Earnings miss by ${Math.abs(value).toFixed(1)}%`,
      'revenue_growth_accel': value > 0 ? 'Revenue growth accelerating' : 'Revenue growth decelerating',
      'analyst_coverage_change': value > 0 ? 'Increasing analyst coverage' : 'Decreasing analyst coverage',
      'sentiment_news_delta': `${strength} ${direction} news sentiment shift`,
      'sentiment_reddit_accel': `${strength} ${direction} social media sentiment`,
      'sentiment_options_shift': `${strength} ${direction} options sentiment`,
      'rsi_momentum': value > 0 ? 'RSI showing overbought conditions' : 'RSI showing oversold conditions',
      'macd_histogram_trend': `MACD histogram ${direction} trend`
    }

    return explanations[featureName] || `${featureName}: ${direction} signal`
  }

  /**
   * Get cache key for symbol
   */
  private getCacheKey(symbol: string): string {
    const dateKey = new Date().toISOString().split('T')[0] // Daily granularity
    return `early_signal:${symbol}:${dateKey}:${EarlySignalService.modelVersion}`
  }

  /**
   * Clear cache for a symbol (for testing/manual refresh)
   */
  async clearCache(symbol?: string): Promise<void> {
    if (symbol) {
      const cacheKey = this.getCacheKey(symbol)
      await this.cache.delete(cacheKey)
      console.log(`Cache cleared for ${symbol}`)
    } else {
      // Clear all early signal cache entries
      console.warn('Cache clear all not implemented, clear individual symbols')
    }
  }

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<{
    modelLoaded: boolean
    normalizerFitted: boolean
    cacheConnected: boolean
    modelVersion: string
  }> {
    return {
      modelLoaded: EarlySignalService.modelInstance !== null,
      normalizerFitted: this.normalizer.isFitted(),
      cacheConnected: await this.cache.ping().then(() => true).catch(() => false),
      modelVersion: EarlySignalService.modelVersion
    }
  }
}
