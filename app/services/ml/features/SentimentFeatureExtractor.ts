/**
 * SentimentFeatureExtractor
 *
 * Extracts sentiment features for ML models including:
 * - News sentiment (aggregated score, confidence, article count)
 * - Reddit sentiment (WSB community sentiment, post volume)
 * - Options sentiment (put/call ratio, institutional flow)
 * - Sentiment momentum (rate of change in sentiment)
 * - Sentiment embeddings (multi-dimensional sentiment representation)
 *
 * This service complements SentimentFeatureIntegrator by providing derived
 * features that are specifically useful for ML model prediction.
 *
 * Performance Target: <100ms per symbol
 */

import type { SentimentIndicators, RedditSentimentData, OptionsSentimentData } from '../../financial-data/types/sentiment-types';

/**
 * News sentiment features
 */
export interface NewsSentimentFeatures {
  // Core news metrics
  newsSentiment: number; // Normalized -1 to +1
  newsConfidence: number; // 0-1 scale
  articleCount: number;
  sourceCount: number;

  // Derived metrics
  newsStrength: number; // Sentiment * confidence
  newsVolume: number; // Normalized article count (0-1)
  isHighActivity: boolean; // True if article count > 50
}

/**
 * Reddit/Social sentiment features
 */
export interface SocialSentimentFeatures {
  // Core Reddit metrics
  redditSentiment: number; // 0-1 scale
  redditConfidence: number;
  postCount: number;

  // Derived metrics
  redditStrength: number; // Sentiment * confidence
  redditActivity: number; // Normalized post count (0-1)
  isRetailBuzz: boolean; // True if high post count + strong sentiment
}

/**
 * Options sentiment features
 */
export interface OptionsSentimentFeatures {
  // Core options metrics
  optionsSentiment: number; // 0-1 scale
  optionsConfidence: number;
  putCallRatio: number;
  openInterestRatio: number;

  // Derived metrics
  optionsStrength: number; // Sentiment * confidence
  isBullishOptions: boolean; // P/C < 0.8
  isBearishOptions: boolean; // P/C > 1.2
  hasInstitutionalFlow: boolean; // Large transactions detected
  institutionalDirection: number; // -1 (outflow), 0 (neutral), +1 (inflow)
}

/**
 * Sentiment momentum features
 */
export interface SentimentMomentumFeatures {
  // Overall sentiment momentum
  sentimentMomentum: number; // Change in aggregated sentiment
  sentimentAcceleration: number; // Change in momentum

  // Component momentum
  newsMomentum: number;
  redditMomentum: number;
  optionsMomentum: number;

  // Divergence signals
  newsVsRedditDivergence: number; // Difference between news and reddit
  newsVsOptionsDivergence: number; // Difference between news and options
  consensusStrength: number; // 0-1, higher when all sources agree
}

/**
 * Sentiment embeddings (multi-dimensional representation)
 */
export interface SentimentEmbeddings {
  // Aggregate dimensions
  overallSentiment: number; // 0-1 scale
  sentimentConfidence: number; // 0-1 scale
  sentimentDiversity: number; // 0-1, higher when sources diverge

  // Source-specific embeddings
  professionalSentiment: number; // News sources
  retailSentiment: number; // Reddit
  institutionalSentiment: number; // Options flow

  // Temporal embeddings
  shortTermSentiment: number; // Recent sentiment (1d)
  mediumTermSentiment: number; // Weekly trend (estimated)

  // Confidence-weighted aggregate
  weightedSentiment: number; // Confidence-weighted average
}

/**
 * Complete set of sentiment features
 */
export interface SentimentFeatures {
  symbol: string;
  timestamp: number;
  news: NewsSentimentFeatures;
  social: SocialSentimentFeatures;
  options: OptionsSentimentFeatures;
  momentum: SentimentMomentumFeatures;
  embeddings: SentimentEmbeddings;
  dataCompleteness: number; // 0-1 scale, percentage of sources available
}

/**
 * SentimentFeatureExtractor - Extract sentiment features for ML
 */
export class SentimentFeatureExtractor {
  /**
   * Extract all sentiment features from sentiment indicators
   */
  static extractFeatures(
    symbol: string,
    indicators: SentimentIndicators,
    previousIndicators?: SentimentIndicators // For momentum calculation
  ): SentimentFeatures {
    const startTime = Date.now();

    const news = this.extractNewsFeatures(indicators);
    const social = this.extractSocialFeatures(indicators);
    const options = this.extractOptionsFeatures(indicators);
    const momentum = this.extractMomentumFeatures(indicators, previousIndicators);
    const embeddings = this.extractEmbeddings(indicators);

    // Calculate data completeness
    const dataCompleteness = this.calculateDataCompleteness(indicators);

    const calculationTime = Date.now() - startTime;

    if (calculationTime > 100) {
      console.warn(
        `SentimentFeatureExtractor exceeded target time for ${symbol}: ${calculationTime}ms`
      );
    }

    return {
      symbol,
      timestamp: Date.now(),
      news,
      social,
      options,
      momentum,
      embeddings,
      dataCompleteness
    };
  }

  /**
   * Extract news sentiment features
   */
  private static extractNewsFeatures(
    indicators: SentimentIndicators
  ): NewsSentimentFeatures {
    const newsData = indicators.news;

    const newsSentiment = newsData.sentiment;
    const newsConfidence = newsData.confidence;
    const articleCount = newsData.articleCount;
    const sourceCount = newsData.sources.length;

    // News strength (sentiment * confidence)
    const newsStrength = newsSentiment * newsConfidence;

    // Normalize article count (0-1 scale, 100+ articles = 1.0)
    const newsVolume = Math.min(1, articleCount / 100);

    // High activity if > 50 articles
    const isHighActivity = articleCount > 50;

    return {
      newsSentiment,
      newsConfidence,
      articleCount,
      sourceCount,
      newsStrength,
      newsVolume,
      isHighActivity
    };
  }

  /**
   * Extract social/Reddit sentiment features
   */
  private static extractSocialFeatures(
    indicators: SentimentIndicators
  ): SocialSentimentFeatures {
    const redditData = indicators.reddit;

    if (!redditData) {
      return {
        redditSentiment: 0.5,
        redditConfidence: 0,
        postCount: 0,
        redditStrength: 0,
        redditActivity: 0,
        isRetailBuzz: false
      };
    }

    const redditSentiment = redditData.sentiment;
    const redditConfidence = redditData.confidence;
    const postCount = redditData.postCount;

    // Reddit strength
    const redditStrength = redditSentiment * redditConfidence;

    // Normalize post count (0-1 scale, 100+ posts = 1.0)
    const redditActivity = Math.min(1, postCount / 100);

    // Retail buzz if high activity + strong sentiment
    const isRetailBuzz = postCount > 20 && (redditSentiment > 0.7 || redditSentiment < 0.3);

    return {
      redditSentiment,
      redditConfidence,
      postCount,
      redditStrength,
      redditActivity,
      isRetailBuzz
    };
  }

  /**
   * Extract options sentiment features
   */
  private static extractOptionsFeatures(
    indicators: SentimentIndicators
  ): OptionsSentimentFeatures {
    const optionsData = indicators.options;

    if (!optionsData) {
      return {
        optionsSentiment: 0.5,
        optionsConfidence: 0,
        putCallRatio: 1.0,
        openInterestRatio: 1.0,
        optionsStrength: 0,
        isBullishOptions: false,
        isBearishOptions: false,
        hasInstitutionalFlow: false,
        institutionalDirection: 0
      };
    }

    const optionsSentiment = optionsData.sentiment;
    const optionsConfidence = optionsData.confidence;
    const putCallRatio = optionsData.putCallRatio;
    const openInterestRatio = optionsData.openInterestRatio;

    // Options strength
    const optionsStrength = optionsSentiment * optionsConfidence;

    // Bullish/bearish signals
    const isBullishOptions = putCallRatio < 0.8;
    const isBearishOptions = putCallRatio > 1.2;

    // Institutional flow
    const hasInstitutionalFlow = optionsData.unusualActivity;
    const institutionalDirection = optionsData.institutionalFlow === 'INFLOW' ? 1 :
                                    optionsData.institutionalFlow === 'OUTFLOW' ? -1 : 0;

    return {
      optionsSentiment,
      optionsConfidence,
      putCallRatio,
      openInterestRatio,
      optionsStrength,
      isBullishOptions,
      isBearishOptions,
      hasInstitutionalFlow,
      institutionalDirection
    };
  }

  /**
   * Extract sentiment momentum features
   */
  private static extractMomentumFeatures(
    indicators: SentimentIndicators,
    previousIndicators?: SentimentIndicators
  ): SentimentMomentumFeatures {
    if (!previousIndicators) {
      // No previous data, return neutral momentum
      return {
        sentimentMomentum: 0,
        sentimentAcceleration: 0,
        newsMomentum: 0,
        redditMomentum: 0,
        optionsMomentum: 0,
        newsVsRedditDivergence: 0,
        newsVsOptionsDivergence: 0,
        consensusStrength: 1
      };
    }

    // Calculate momentum (change in sentiment)
    const sentimentMomentum = indicators.aggregatedScore - previousIndicators.aggregatedScore;

    // Acceleration (would need 3 data points for true acceleration, using simplified)
    const sentimentAcceleration = sentimentMomentum;

    // Component momentum
    const newsMomentum = indicators.news.sentiment - previousIndicators.news.sentiment;
    const redditMomentum = indicators.reddit && previousIndicators.reddit
      ? indicators.reddit.sentiment - previousIndicators.reddit.sentiment
      : 0;
    const optionsMomentum = indicators.options && previousIndicators.options
      ? indicators.options.sentiment - previousIndicators.options.sentiment
      : 0;

    // Divergence calculations
    const newsVsRedditDivergence = indicators.reddit
      ? Math.abs(indicators.news.sentiment - indicators.reddit.sentiment)
      : 0;

    const newsVsOptionsDivergence = indicators.options
      ? Math.abs(indicators.news.sentiment - indicators.options.sentiment)
      : 0;

    // Consensus strength (inverse of average divergence, 0-1 scale)
    const avgDivergence = (newsVsRedditDivergence + newsVsOptionsDivergence) / 2;
    const consensusStrength = Math.max(0, 1 - avgDivergence);

    return {
      sentimentMomentum,
      sentimentAcceleration,
      newsMomentum,
      redditMomentum,
      optionsMomentum,
      newsVsRedditDivergence,
      newsVsOptionsDivergence,
      consensusStrength
    };
  }

  /**
   * Extract sentiment embeddings (multi-dimensional representation)
   */
  private static extractEmbeddings(
    indicators: SentimentIndicators
  ): SentimentEmbeddings {
    const overallSentiment = indicators.aggregatedScore;
    const sentimentConfidence = indicators.confidence;

    // Source-specific embeddings
    const professionalSentiment = indicators.news.sentiment; // News = professional
    const retailSentiment = indicators.reddit?.sentiment ?? 0.5; // Reddit = retail
    const institutionalSentiment = indicators.options?.sentiment ?? 0.5; // Options = institutional

    // Sentiment diversity (variance across sources)
    const sentiments = [professionalSentiment, retailSentiment, institutionalSentiment];
    const mean = sentiments.reduce((a, b) => a + b, 0) / sentiments.length;
    const variance = sentiments.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / sentiments.length;
    const sentimentDiversity = Math.sqrt(variance);

    // Temporal embeddings (simplified - would need historical data for true temporal analysis)
    const shortTermSentiment = overallSentiment; // Current sentiment
    const mediumTermSentiment = overallSentiment; // Placeholder (would use 7-day average)

    // Confidence-weighted aggregate
    const weightedSentiment = overallSentiment * sentimentConfidence;

    return {
      overallSentiment,
      sentimentConfidence,
      sentimentDiversity,
      professionalSentiment,
      retailSentiment,
      institutionalSentiment,
      shortTermSentiment,
      mediumTermSentiment,
      weightedSentiment
    };
  }

  /**
   * Calculate data completeness (percentage of sources available)
   */
  private static calculateDataCompleteness(indicators: SentimentIndicators): number {
    const sources = [
      indicators.news ? 1 : 0,
      indicators.reddit ? 1 : 0,
      indicators.options ? 1 : 0
    ];

    return sources.reduce((a, b) => a + b, 0) / sources.length;
  }

  /**
   * Get default/fallback features when data is unavailable
   */
  static getDefaultFeatures(symbol: string): SentimentFeatures {
    return {
      symbol,
      timestamp: Date.now(),
      news: {
        newsSentiment: 0,
        newsConfidence: 0,
        articleCount: 0,
        sourceCount: 0,
        newsStrength: 0,
        newsVolume: 0,
        isHighActivity: false
      },
      social: {
        redditSentiment: 0.5,
        redditConfidence: 0,
        postCount: 0,
        redditStrength: 0,
        redditActivity: 0,
        isRetailBuzz: false
      },
      options: {
        optionsSentiment: 0.5,
        optionsConfidence: 0,
        putCallRatio: 1.0,
        openInterestRatio: 1.0,
        optionsStrength: 0,
        isBullishOptions: false,
        isBearishOptions: false,
        hasInstitutionalFlow: false,
        institutionalDirection: 0
      },
      momentum: {
        sentimentMomentum: 0,
        sentimentAcceleration: 0,
        newsMomentum: 0,
        redditMomentum: 0,
        optionsMomentum: 0,
        newsVsRedditDivergence: 0,
        newsVsOptionsDivergence: 0,
        consensusStrength: 1
      },
      embeddings: {
        overallSentiment: 0.5,
        sentimentConfidence: 0,
        sentimentDiversity: 0,
        professionalSentiment: 0.5,
        retailSentiment: 0.5,
        institutionalSentiment: 0.5,
        shortTermSentiment: 0.5,
        mediumTermSentiment: 0.5,
        weightedSentiment: 0.5
      },
      dataCompleteness: 0
    };
  }
}
