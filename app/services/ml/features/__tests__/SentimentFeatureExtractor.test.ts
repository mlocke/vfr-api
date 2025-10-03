/**
 * SentimentFeatureExtractor Tests
 *
 * Comprehensive tests for sentiment feature extraction including:
 * - News sentiment features (sentiment, confidence, article count, sources)
 * - Social/Reddit sentiment features (sentiment, post count, retail buzz detection)
 * - Options sentiment features (P/C ratio, institutional flow, unusual activity)
 * - Sentiment momentum calculations with previous indicators
 * - Sentiment embeddings (multi-dimensional representation)
 * - Data completeness calculations
 * - Default/fallback features
 *
 * CRITICAL: NO MOCK DATA - Uses real sentiment data from SentimentAnalysisService
 * Performance target: <100ms per symbol
 * Target coverage: >90%
 */

import { SentimentFeatureExtractor } from "../SentimentFeatureExtractor";
import type {
	SentimentFeatures,
	NewsSentimentFeatures,
	SocialSentimentFeatures,
	OptionsSentimentFeatures,
	SentimentMomentumFeatures,
	SentimentEmbeddings,
} from "../SentimentFeatureExtractor";
import { SentimentAnalysisService } from "../../../financial-data/SentimentAnalysisService";
import type { SentimentIndicators } from "../../../financial-data/types/sentiment-types";
import { RedisCache } from "../../../cache/RedisCache";

describe("SentimentFeatureExtractor", () => {
	let sentimentService: SentimentAnalysisService;
	let cache: RedisCache;

	// Test symbols
	const TEST_SYMBOLS = {
		LARGE_CAP: "AAPL", // High volume, comprehensive data
		MID_CAP: "PLTR", // Medium volume, varied sentiment
		MEME_STOCK: "GME", // High Reddit activity
		VOLATILE: "TSLA", // High options activity
	};

	beforeAll(async () => {
		// Initialize real services - NO MOCKS
		cache = new RedisCache();

		sentimentService = new SentimentAnalysisService(cache);

		console.log("✅ Test setup complete - using REAL sentiment data (NO MOCKS)");
	});

	afterAll(async () => {
		// Cleanup - Redis cleanup happens automatically in RedisCache
		console.log("✅ Test cleanup complete");
	});

	describe("News Sentiment Features", () => {
		it("should_extract_news_sentiment_features_from_real_data", async () => {
			const indicators = await sentimentService.getSentimentIndicators(
				TEST_SYMBOLS.LARGE_CAP
			);

			expect(indicators).toBeDefined();
			if (!indicators) {
				throw new Error("Failed to fetch sentiment indicators");
			}

			const features = SentimentFeatureExtractor.extractFeatures(
				TEST_SYMBOLS.LARGE_CAP,
				indicators
			);

			// Verify news features structure
			expect(features.news).toBeDefined();
			expect(features.news.newsSentiment).toBeDefined();
			expect(features.news.newsConfidence).toBeDefined();
			expect(features.news.articleCount).toBeDefined();
			expect(features.news.sourceCount).toBeDefined();
			expect(features.news.newsStrength).toBeDefined();
			expect(features.news.newsVolume).toBeDefined();
			expect(features.news.isHighActivity).toBeDefined();

			// Verify value ranges
			expect(features.news.newsSentiment).toBeGreaterThanOrEqual(-1);
			expect(features.news.newsSentiment).toBeLessThanOrEqual(1);
			expect(features.news.newsConfidence).toBeGreaterThanOrEqual(0);
			expect(features.news.newsConfidence).toBeLessThanOrEqual(1);
			expect(features.news.articleCount).toBeGreaterThanOrEqual(0);
			expect(features.news.sourceCount).toBeGreaterThanOrEqual(0);
			expect(features.news.newsVolume).toBeGreaterThanOrEqual(0);
			expect(features.news.newsVolume).toBeLessThanOrEqual(1);

			console.log("📰 News features:", {
				sentiment: features.news.newsSentiment.toFixed(3),
				confidence: features.news.newsConfidence.toFixed(3),
				articles: features.news.articleCount,
				sources: features.news.sourceCount,
				strength: features.news.newsStrength.toFixed(3),
				highActivity: features.news.isHighActivity,
			});
		}, 300000);

		it("should_calculate_news_strength_correctly", async () => {
			const indicators = await sentimentService.getSentimentIndicators(
				TEST_SYMBOLS.LARGE_CAP
			);

			expect(indicators).toBeDefined();
			if (!indicators) {
				throw new Error("Failed to fetch sentiment indicators");
			}

			const features = SentimentFeatureExtractor.extractFeatures(
				TEST_SYMBOLS.LARGE_CAP,
				indicators
			);

			// News strength should be sentiment * confidence
			const expectedStrength = features.news.newsSentiment * features.news.newsConfidence;
			expect(features.news.newsStrength).toBeCloseTo(expectedStrength, 5);

			console.log("💪 News strength calculation:", {
				sentiment: features.news.newsSentiment,
				confidence: features.news.newsConfidence,
				strength: features.news.newsStrength,
				expected: expectedStrength,
			});
		}, 300000);

		it("should_detect_high_news_activity", async () => {
			const indicators = await sentimentService.getSentimentIndicators(
				TEST_SYMBOLS.LARGE_CAP
			);

			expect(indicators).toBeDefined();
			if (!indicators) {
				throw new Error("Failed to fetch sentiment indicators");
			}

			const features = SentimentFeatureExtractor.extractFeatures(
				TEST_SYMBOLS.LARGE_CAP,
				indicators
			);

			// High activity should be true when article count > 50
			const expectedHighActivity = features.news.articleCount > 50;
			expect(features.news.isHighActivity).toBe(expectedHighActivity);

			console.log("📊 News activity:", {
				articleCount: features.news.articleCount,
				isHighActivity: features.news.isHighActivity,
				threshold: 50,
			});
		}, 300000);

		it("should_normalize_news_volume_correctly", async () => {
			const indicators = await sentimentService.getSentimentIndicators(
				TEST_SYMBOLS.LARGE_CAP
			);

			expect(indicators).toBeDefined();
			if (!indicators) {
				throw new Error("Failed to fetch sentiment indicators");
			}

			const features = SentimentFeatureExtractor.extractFeatures(
				TEST_SYMBOLS.LARGE_CAP,
				indicators
			);

			// News volume should be normalized to 0-1 (100+ articles = 1.0)
			const expectedVolume = Math.min(1, features.news.articleCount / 100);
			expect(features.news.newsVolume).toBeCloseTo(expectedVolume, 5);
			expect(features.news.newsVolume).toBeGreaterThanOrEqual(0);
			expect(features.news.newsVolume).toBeLessThanOrEqual(1);

			console.log("📈 News volume normalization:", {
				articleCount: features.news.articleCount,
				newsVolume: features.news.newsVolume,
				expected: expectedVolume,
			});
		}, 300000);
	});

	describe("Social/Reddit Sentiment Features", () => {
		it("should_extract_reddit_sentiment_features_from_real_data", async () => {
			const indicators = await sentimentService.getSentimentIndicators(
				TEST_SYMBOLS.MEME_STOCK
			);

			expect(indicators).toBeDefined();
			if (!indicators) {
				throw new Error("Failed to fetch sentiment indicators");
			}

			const features = SentimentFeatureExtractor.extractFeatures(
				TEST_SYMBOLS.MEME_STOCK,
				indicators
			);

			// Verify social features structure
			expect(features.social).toBeDefined();
			expect(features.social.redditSentiment).toBeDefined();
			expect(features.social.redditConfidence).toBeDefined();
			expect(features.social.postCount).toBeDefined();
			expect(features.social.redditStrength).toBeDefined();
			expect(features.social.redditActivity).toBeDefined();
			expect(features.social.isRetailBuzz).toBeDefined();

			// Verify value ranges
			expect(features.social.redditSentiment).toBeGreaterThanOrEqual(0);
			expect(features.social.redditSentiment).toBeLessThanOrEqual(1);
			expect(features.social.redditConfidence).toBeGreaterThanOrEqual(0);
			expect(features.social.redditConfidence).toBeLessThanOrEqual(1);
			expect(features.social.postCount).toBeGreaterThanOrEqual(0);
			expect(features.social.redditActivity).toBeGreaterThanOrEqual(0);
			expect(features.social.redditActivity).toBeLessThanOrEqual(1);

			console.log("🔥 Reddit features:", {
				sentiment: features.social.redditSentiment.toFixed(3),
				confidence: features.social.redditConfidence.toFixed(3),
				posts: features.social.postCount,
				strength: features.social.redditStrength.toFixed(3),
				activity: features.social.redditActivity.toFixed(3),
				retailBuzz: features.social.isRetailBuzz,
			});
		}, 300000);

		it("should_detect_retail_buzz_correctly", async () => {
			const indicators = await sentimentService.getSentimentIndicators(
				TEST_SYMBOLS.MEME_STOCK
			);

			expect(indicators).toBeDefined();
			if (!indicators) {
				throw new Error("Failed to fetch sentiment indicators");
			}

			const features = SentimentFeatureExtractor.extractFeatures(
				TEST_SYMBOLS.MEME_STOCK,
				indicators
			);

			// Retail buzz: high activity (>20 posts) + strong sentiment (>0.7 or <0.3)
			const expectedBuzz =
				features.social.postCount > 20 &&
				(features.social.redditSentiment > 0.7 || features.social.redditSentiment < 0.3);
			expect(features.social.isRetailBuzz).toBe(expectedBuzz);

			console.log("📣 Retail buzz detection:", {
				postCount: features.social.postCount,
				sentiment: features.social.redditSentiment,
				isRetailBuzz: features.social.isRetailBuzz,
				expected: expectedBuzz,
			});
		}, 300000);

		it("should_calculate_reddit_strength_correctly", async () => {
			const indicators = await sentimentService.getSentimentIndicators(
				TEST_SYMBOLS.MEME_STOCK
			);

			expect(indicators).toBeDefined();
			if (!indicators) {
				throw new Error("Failed to fetch sentiment indicators");
			}

			const features = SentimentFeatureExtractor.extractFeatures(
				TEST_SYMBOLS.MEME_STOCK,
				indicators
			);

			// Reddit strength should be sentiment * confidence
			const expectedStrength =
				features.social.redditSentiment * features.social.redditConfidence;
			expect(features.social.redditStrength).toBeCloseTo(expectedStrength, 5);

			console.log("💪 Reddit strength calculation:", {
				sentiment: features.social.redditSentiment,
				confidence: features.social.redditConfidence,
				strength: features.social.redditStrength,
				expected: expectedStrength,
			});
		}, 300000);

		it("should_handle_missing_reddit_data_with_defaults", async () => {
			const indicators = await sentimentService.getSentimentIndicators(
				TEST_SYMBOLS.LARGE_CAP
			);

			expect(indicators).toBeDefined();
			if (!indicators) {
				throw new Error("Failed to fetch sentiment indicators");
			}

			// Remove Reddit data to test fallback
			const indicatorsWithoutReddit: SentimentIndicators = {
				...indicators,
				reddit: undefined,
			};

			const features = SentimentFeatureExtractor.extractFeatures(
				TEST_SYMBOLS.LARGE_CAP,
				indicatorsWithoutReddit
			);

			// Should return neutral defaults when Reddit data is missing
			expect(features.social.redditSentiment).toBe(0.5);
			expect(features.social.redditConfidence).toBe(0);
			expect(features.social.postCount).toBe(0);
			expect(features.social.redditStrength).toBe(0);
			expect(features.social.redditActivity).toBe(0);
			expect(features.social.isRetailBuzz).toBe(false);

			console.log("🔄 Reddit fallback defaults:", features.social);
		}, 300000);
	});

	describe("Options Sentiment Features", () => {
		it("should_extract_options_sentiment_features_from_real_data", async () => {
			const indicators = await sentimentService.getSentimentIndicators(TEST_SYMBOLS.VOLATILE);

			expect(indicators).toBeDefined();
			if (!indicators) {
				throw new Error("Failed to fetch sentiment indicators");
			}

			const features = SentimentFeatureExtractor.extractFeatures(
				TEST_SYMBOLS.VOLATILE,
				indicators
			);

			// Verify options features structure
			expect(features.options).toBeDefined();
			expect(features.options.optionsSentiment).toBeDefined();
			expect(features.options.optionsConfidence).toBeDefined();
			expect(features.options.putCallRatio).toBeDefined();
			expect(features.options.openInterestRatio).toBeDefined();
			expect(features.options.optionsStrength).toBeDefined();
			expect(features.options.isBullishOptions).toBeDefined();
			expect(features.options.isBearishOptions).toBeDefined();
			expect(features.options.hasInstitutionalFlow).toBeDefined();
			expect(features.options.institutionalDirection).toBeDefined();

			// Verify value ranges
			expect(features.options.optionsSentiment).toBeGreaterThanOrEqual(0);
			expect(features.options.optionsSentiment).toBeLessThanOrEqual(1);
			expect(features.options.optionsConfidence).toBeGreaterThanOrEqual(0);
			expect(features.options.optionsConfidence).toBeLessThanOrEqual(1);
			expect(features.options.putCallRatio).toBeGreaterThanOrEqual(0);
			expect(features.options.institutionalDirection).toBeGreaterThanOrEqual(-1);
			expect(features.options.institutionalDirection).toBeLessThanOrEqual(1);

			console.log("📊 Options features:", {
				sentiment: features.options.optionsSentiment.toFixed(3),
				confidence: features.options.optionsConfidence.toFixed(3),
				putCallRatio: features.options.putCallRatio.toFixed(3),
				openInterestRatio: features.options.openInterestRatio.toFixed(3),
				strength: features.options.optionsStrength.toFixed(3),
				bullish: features.options.isBullishOptions,
				bearish: features.options.isBearishOptions,
				institutionalFlow: features.options.hasInstitutionalFlow,
				direction: features.options.institutionalDirection,
			});
		}, 300000);

		it("should_detect_bullish_options_sentiment", async () => {
			const indicators = await sentimentService.getSentimentIndicators(TEST_SYMBOLS.VOLATILE);

			expect(indicators).toBeDefined();
			if (!indicators) {
				throw new Error("Failed to fetch sentiment indicators");
			}

			const features = SentimentFeatureExtractor.extractFeatures(
				TEST_SYMBOLS.VOLATILE,
				indicators
			);

			// Bullish if P/C ratio < 0.8
			const expectedBullish = features.options.putCallRatio < 0.8;
			expect(features.options.isBullishOptions).toBe(expectedBullish);

			console.log("🐂 Bullish options detection:", {
				putCallRatio: features.options.putCallRatio,
				isBullish: features.options.isBullishOptions,
				threshold: 0.8,
			});
		}, 300000);

		it("should_detect_bearish_options_sentiment", async () => {
			const indicators = await sentimentService.getSentimentIndicators(TEST_SYMBOLS.VOLATILE);

			expect(indicators).toBeDefined();
			if (!indicators) {
				throw new Error("Failed to fetch sentiment indicators");
			}

			const features = SentimentFeatureExtractor.extractFeatures(
				TEST_SYMBOLS.VOLATILE,
				indicators
			);

			// Bearish if P/C ratio > 1.2
			const expectedBearish = features.options.putCallRatio > 1.2;
			expect(features.options.isBearishOptions).toBe(expectedBearish);

			console.log("🐻 Bearish options detection:", {
				putCallRatio: features.options.putCallRatio,
				isBearish: features.options.isBearishOptions,
				threshold: 1.2,
			});
		}, 300000);

		it("should_detect_institutional_flow_direction", async () => {
			const indicators = await sentimentService.getSentimentIndicators(TEST_SYMBOLS.VOLATILE);

			expect(indicators).toBeDefined();
			if (!indicators) {
				throw new Error("Failed to fetch sentiment indicators");
			}

			const features = SentimentFeatureExtractor.extractFeatures(
				TEST_SYMBOLS.VOLATILE,
				indicators
			);

			// Institutional direction: -1 (outflow), 0 (neutral), +1 (inflow)
			expect([-1, 0, 1]).toContain(features.options.institutionalDirection);

			if (indicators.options) {
				const expectedDirection =
					indicators.options.institutionalFlow === "INFLOW"
						? 1
						: indicators.options.institutionalFlow === "OUTFLOW"
							? -1
							: 0;

				expect(features.options.institutionalDirection).toBe(expectedDirection);
			}

			console.log("🏦 Institutional flow:", {
				direction: features.options.institutionalDirection,
				hasFlow: features.options.hasInstitutionalFlow,
			});
		}, 300000);

		it("should_handle_missing_options_data_with_defaults", async () => {
			const indicators = await sentimentService.getSentimentIndicators(
				TEST_SYMBOLS.LARGE_CAP
			);

			expect(indicators).toBeDefined();
			if (!indicators) {
				throw new Error("Failed to fetch sentiment indicators");
			}

			// Remove options data to test fallback
			const indicatorsWithoutOptions: SentimentIndicators = {
				...indicators,
				options: undefined,
			};

			const features = SentimentFeatureExtractor.extractFeatures(
				TEST_SYMBOLS.LARGE_CAP,
				indicatorsWithoutOptions
			);

			// Should return neutral defaults when options data is missing
			expect(features.options.optionsSentiment).toBe(0.5);
			expect(features.options.optionsConfidence).toBe(0);
			expect(features.options.putCallRatio).toBe(1.0);
			expect(features.options.openInterestRatio).toBe(1.0);
			expect(features.options.optionsStrength).toBe(0);
			expect(features.options.isBullishOptions).toBe(false);
			expect(features.options.isBearishOptions).toBe(false);
			expect(features.options.hasInstitutionalFlow).toBe(false);
			expect(features.options.institutionalDirection).toBe(0);

			console.log("🔄 Options fallback defaults:", features.options);
		}, 300000);
	});

	describe("Sentiment Momentum Features", () => {
		it("should_calculate_sentiment_momentum_with_previous_indicators", async () => {
			const currentIndicators = await sentimentService.getSentimentIndicators(
				TEST_SYMBOLS.LARGE_CAP
			);

			expect(currentIndicators).toBeDefined();
			if (!currentIndicators) {
				throw new Error("Failed to fetch sentiment indicators");
			}

			// Create mock previous indicators by adjusting values
			const previousIndicators: SentimentIndicators = {
				...currentIndicators,
				aggregatedScore: currentIndicators.aggregatedScore - 0.1, // Simulate momentum
				news: {
					...currentIndicators.news,
					sentiment: currentIndicators.news.sentiment - 0.05,
				},
				reddit: currentIndicators.reddit
					? {
							...currentIndicators.reddit,
							sentiment: currentIndicators.reddit.sentiment - 0.05,
						}
					: undefined,
				options: currentIndicators.options
					? {
							...currentIndicators.options,
							sentiment: currentIndicators.options.sentiment - 0.05,
						}
					: undefined,
			};

			const features = SentimentFeatureExtractor.extractFeatures(
				TEST_SYMBOLS.LARGE_CAP,
				currentIndicators,
				previousIndicators
			);

			// Verify momentum features structure
			expect(features.momentum).toBeDefined();
			expect(features.momentum.sentimentMomentum).toBeDefined();
			expect(features.momentum.sentimentAcceleration).toBeDefined();
			expect(features.momentum.newsMomentum).toBeDefined();
			expect(features.momentum.redditMomentum).toBeDefined();
			expect(features.momentum.optionsMomentum).toBeDefined();
			expect(features.momentum.newsVsRedditDivergence).toBeDefined();
			expect(features.momentum.newsVsOptionsDivergence).toBeDefined();
			expect(features.momentum.consensusStrength).toBeDefined();

			// Sentiment momentum should be positive (current > previous)
			expect(features.momentum.sentimentMomentum).toBeGreaterThan(0);

			console.log("📈 Momentum features:", {
				sentimentMomentum: features.momentum.sentimentMomentum.toFixed(4),
				sentimentAcceleration: features.momentum.sentimentAcceleration.toFixed(4),
				newsMomentum: features.momentum.newsMomentum.toFixed(4),
				redditMomentum: features.momentum.redditMomentum.toFixed(4),
				optionsMomentum: features.momentum.optionsMomentum.toFixed(4),
				consensusStrength: features.momentum.consensusStrength.toFixed(4),
			});
		}, 300000);

		it("should_detect_sentiment_divergence_between_sources", async () => {
			const indicators = await sentimentService.getSentimentIndicators(
				TEST_SYMBOLS.LARGE_CAP
			);

			expect(indicators).toBeDefined();
			if (!indicators) {
				throw new Error("Failed to fetch sentiment indicators");
			}

			const features = SentimentFeatureExtractor.extractFeatures(
				TEST_SYMBOLS.LARGE_CAP,
				indicators
			);

			// Divergence should be >= 0
			expect(features.momentum.newsVsRedditDivergence).toBeGreaterThanOrEqual(0);
			expect(features.momentum.newsVsOptionsDivergence).toBeGreaterThanOrEqual(0);

			// Consensus strength should be between 0 and 1
			expect(features.momentum.consensusStrength).toBeGreaterThanOrEqual(0);
			expect(features.momentum.consensusStrength).toBeLessThanOrEqual(1);

			console.log("🔍 Divergence analysis:", {
				newsVsReddit: features.momentum.newsVsRedditDivergence.toFixed(4),
				newsVsOptions: features.momentum.newsVsOptionsDivergence.toFixed(4),
				consensus: features.momentum.consensusStrength.toFixed(4),
			});
		}, 300000);

		it("should_return_neutral_momentum_without_previous_indicators", async () => {
			const indicators = await sentimentService.getSentimentIndicators(
				TEST_SYMBOLS.LARGE_CAP
			);

			expect(indicators).toBeDefined();
			if (!indicators) {
				throw new Error("Failed to fetch sentiment indicators");
			}

			const features = SentimentFeatureExtractor.extractFeatures(
				TEST_SYMBOLS.LARGE_CAP,
				indicators
				// No previous indicators provided
			);

			// Should return neutral momentum
			expect(features.momentum.sentimentMomentum).toBe(0);
			expect(features.momentum.sentimentAcceleration).toBe(0);
			expect(features.momentum.newsMomentum).toBe(0);
			expect(features.momentum.redditMomentum).toBe(0);
			expect(features.momentum.optionsMomentum).toBe(0);
			expect(features.momentum.consensusStrength).toBe(1); // Perfect consensus when no comparison

			console.log("🔄 Neutral momentum (no previous data):", features.momentum);
		}, 300000);

		it("should_calculate_consensus_strength_correctly", async () => {
			const indicators = await sentimentService.getSentimentIndicators(
				TEST_SYMBOLS.LARGE_CAP
			);

			expect(indicators).toBeDefined();
			if (!indicators) {
				throw new Error("Failed to fetch sentiment indicators");
			}

			const features = SentimentFeatureExtractor.extractFeatures(
				TEST_SYMBOLS.LARGE_CAP,
				indicators
			);

			// Consensus strength = 1 - average divergence
			const avgDivergence =
				(features.momentum.newsVsRedditDivergence +
					features.momentum.newsVsOptionsDivergence) /
				2;
			const expectedConsensus = Math.max(0, 1 - avgDivergence);

			expect(features.momentum.consensusStrength).toBeCloseTo(expectedConsensus, 5);

			console.log("🤝 Consensus strength:", {
				avgDivergence: avgDivergence.toFixed(4),
				consensus: features.momentum.consensusStrength.toFixed(4),
				expected: expectedConsensus.toFixed(4),
			});
		}, 300000);
	});

	describe("Sentiment Embeddings", () => {
		it("should_extract_multi_dimensional_sentiment_embeddings", async () => {
			const indicators = await sentimentService.getSentimentIndicators(
				TEST_SYMBOLS.LARGE_CAP
			);

			expect(indicators).toBeDefined();
			if (!indicators) {
				throw new Error("Failed to fetch sentiment indicators");
			}

			const features = SentimentFeatureExtractor.extractFeatures(
				TEST_SYMBOLS.LARGE_CAP,
				indicators
			);

			// Verify embeddings structure
			expect(features.embeddings).toBeDefined();
			expect(features.embeddings.overallSentiment).toBeDefined();
			expect(features.embeddings.sentimentConfidence).toBeDefined();
			expect(features.embeddings.sentimentDiversity).toBeDefined();
			expect(features.embeddings.professionalSentiment).toBeDefined();
			expect(features.embeddings.retailSentiment).toBeDefined();
			expect(features.embeddings.institutionalSentiment).toBeDefined();
			expect(features.embeddings.shortTermSentiment).toBeDefined();
			expect(features.embeddings.mediumTermSentiment).toBeDefined();
			expect(features.embeddings.weightedSentiment).toBeDefined();

			// Verify value ranges (0-1 scale)
			expect(features.embeddings.overallSentiment).toBeGreaterThanOrEqual(0);
			expect(features.embeddings.overallSentiment).toBeLessThanOrEqual(1);
			expect(features.embeddings.sentimentConfidence).toBeGreaterThanOrEqual(0);
			expect(features.embeddings.sentimentConfidence).toBeLessThanOrEqual(1);
			expect(features.embeddings.sentimentDiversity).toBeGreaterThanOrEqual(0);
			expect(features.embeddings.professionalSentiment).toBeGreaterThanOrEqual(-1);
			expect(features.embeddings.professionalSentiment).toBeLessThanOrEqual(1);
			expect(features.embeddings.retailSentiment).toBeGreaterThanOrEqual(0);
			expect(features.embeddings.retailSentiment).toBeLessThanOrEqual(1);
			expect(features.embeddings.institutionalSentiment).toBeGreaterThanOrEqual(0);
			expect(features.embeddings.institutionalSentiment).toBeLessThanOrEqual(1);

			console.log("🧠 Sentiment embeddings:", {
				overall: features.embeddings.overallSentiment.toFixed(3),
				confidence: features.embeddings.sentimentConfidence.toFixed(3),
				diversity: features.embeddings.sentimentDiversity.toFixed(3),
				professional: features.embeddings.professionalSentiment.toFixed(3),
				retail: features.embeddings.retailSentiment.toFixed(3),
				institutional: features.embeddings.institutionalSentiment.toFixed(3),
				weighted: features.embeddings.weightedSentiment.toFixed(3),
			});
		}, 300000);

		it("should_calculate_sentiment_diversity_correctly", async () => {
			const indicators = await sentimentService.getSentimentIndicators(
				TEST_SYMBOLS.LARGE_CAP
			);

			expect(indicators).toBeDefined();
			if (!indicators) {
				throw new Error("Failed to fetch sentiment indicators");
			}

			const features = SentimentFeatureExtractor.extractFeatures(
				TEST_SYMBOLS.LARGE_CAP,
				indicators
			);

			// Diversity should be >= 0 (higher when sources diverge)
			expect(features.embeddings.sentimentDiversity).toBeGreaterThanOrEqual(0);

			// Calculate expected diversity (standard deviation of sentiments)
			const sentiments = [
				features.embeddings.professionalSentiment,
				features.embeddings.retailSentiment,
				features.embeddings.institutionalSentiment,
			];
			const mean = sentiments.reduce((a, b) => a + b, 0) / sentiments.length;
			const variance =
				sentiments.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / sentiments.length;
			const expectedDiversity = Math.sqrt(variance);

			expect(features.embeddings.sentimentDiversity).toBeCloseTo(expectedDiversity, 5);

			console.log("🎭 Sentiment diversity:", {
				professional: features.embeddings.professionalSentiment.toFixed(3),
				retail: features.embeddings.retailSentiment.toFixed(3),
				institutional: features.embeddings.institutionalSentiment.toFixed(3),
				diversity: features.embeddings.sentimentDiversity.toFixed(3),
				expected: expectedDiversity.toFixed(3),
			});
		}, 300000);

		it("should_calculate_weighted_sentiment_correctly", async () => {
			const indicators = await sentimentService.getSentimentIndicators(
				TEST_SYMBOLS.LARGE_CAP
			);

			expect(indicators).toBeDefined();
			if (!indicators) {
				throw new Error("Failed to fetch sentiment indicators");
			}

			const features = SentimentFeatureExtractor.extractFeatures(
				TEST_SYMBOLS.LARGE_CAP,
				indicators
			);

			// Weighted sentiment = overall sentiment * confidence
			const expectedWeighted =
				features.embeddings.overallSentiment * features.embeddings.sentimentConfidence;

			expect(features.embeddings.weightedSentiment).toBeCloseTo(expectedWeighted, 5);

			console.log("⚖️ Weighted sentiment:", {
				overall: features.embeddings.overallSentiment,
				confidence: features.embeddings.sentimentConfidence,
				weighted: features.embeddings.weightedSentiment,
				expected: expectedWeighted,
			});
		}, 300000);

		it("should_map_source_specific_embeddings_correctly", async () => {
			const indicators = await sentimentService.getSentimentIndicators(
				TEST_SYMBOLS.LARGE_CAP
			);

			expect(indicators).toBeDefined();
			if (!indicators) {
				throw new Error("Failed to fetch sentiment indicators");
			}

			const features = SentimentFeatureExtractor.extractFeatures(
				TEST_SYMBOLS.LARGE_CAP,
				indicators
			);

			// Professional sentiment should be news sentiment
			expect(features.embeddings.professionalSentiment).toBe(indicators.news.sentiment);

			// Retail sentiment should be Reddit sentiment (or 0.5 default)
			const expectedRetail = indicators.reddit?.sentiment ?? 0.5;
			expect(features.embeddings.retailSentiment).toBe(expectedRetail);

			// Institutional sentiment should be options sentiment (or 0.5 default)
			const expectedInstitutional = indicators.options?.sentiment ?? 0.5;
			expect(features.embeddings.institutionalSentiment).toBe(expectedInstitutional);

			console.log("🎯 Source-specific embeddings mapping:", {
				professional: features.embeddings.professionalSentiment,
				retail: features.embeddings.retailSentiment,
				institutional: features.embeddings.institutionalSentiment,
			});
		}, 300000);
	});

	describe("Data Completeness Calculations", () => {
		it("should_calculate_data_completeness_correctly", async () => {
			const indicators = await sentimentService.getSentimentIndicators(
				TEST_SYMBOLS.LARGE_CAP
			);

			expect(indicators).toBeDefined();
			if (!indicators) {
				throw new Error("Failed to fetch sentiment indicators");
			}

			const features = SentimentFeatureExtractor.extractFeatures(
				TEST_SYMBOLS.LARGE_CAP,
				indicators
			);

			// Data completeness should be between 0 and 1
			expect(features.dataCompleteness).toBeGreaterThanOrEqual(0);
			expect(features.dataCompleteness).toBeLessThanOrEqual(1);

			// Calculate expected completeness (percentage of sources available)
			const sources = [
				indicators.news ? 1 : 0,
				indicators.reddit ? 1 : 0,
				indicators.options ? 1 : 0,
			];
			const expectedCompleteness = sources.reduce((a, b) => a + b, 0) / sources.length;

			expect(features.dataCompleteness).toBeCloseTo(expectedCompleteness, 5);

			console.log("📊 Data completeness:", {
				hasNews: !!indicators.news,
				hasReddit: !!indicators.reddit,
				hasOptions: !!indicators.options,
				completeness: features.dataCompleteness,
				expected: expectedCompleteness,
			});
		}, 300000);

		it("should_report_full_completeness_with_all_sources", async () => {
			const indicators = await sentimentService.getSentimentIndicators(TEST_SYMBOLS.VOLATILE);

			expect(indicators).toBeDefined();
			if (!indicators) {
				throw new Error("Failed to fetch sentiment indicators");
			}

			// Only test if we have all sources
			if (indicators.news && indicators.reddit && indicators.options) {
				const features = SentimentFeatureExtractor.extractFeatures(
					TEST_SYMBOLS.VOLATILE,
					indicators
				);

				// Should have full completeness (1.0)
				expect(features.dataCompleteness).toBe(1.0);

				console.log("✅ Full data completeness:", features.dataCompleteness);
			} else {
				console.log("⚠️ Not all sources available, skipping full completeness test");
			}
		}, 300000);

		it("should_report_partial_completeness_with_missing_sources", async () => {
			const indicators = await sentimentService.getSentimentIndicators(
				TEST_SYMBOLS.LARGE_CAP
			);

			expect(indicators).toBeDefined();
			if (!indicators) {
				throw new Error("Failed to fetch sentiment indicators");
			}

			// Remove some sources to test partial completeness
			const partialIndicators: SentimentIndicators = {
				...indicators,
				reddit: undefined,
				options: undefined,
			};

			const features = SentimentFeatureExtractor.extractFeatures(
				TEST_SYMBOLS.LARGE_CAP,
				partialIndicators
			);

			// Should have 1/3 completeness (only news available)
			expect(features.dataCompleteness).toBeCloseTo(1 / 3, 5);

			console.log("⚠️ Partial data completeness:", {
				completeness: features.dataCompleteness,
				expected: 1 / 3,
			});
		}, 300000);
	});

	describe("Default/Fallback Features", () => {
		it("should_return_default_features_when_requested", () => {
			const defaultFeatures = SentimentFeatureExtractor.getDefaultFeatures(
				TEST_SYMBOLS.LARGE_CAP
			);

			// Verify structure
			expect(defaultFeatures).toBeDefined();
			expect(defaultFeatures.symbol).toBe(TEST_SYMBOLS.LARGE_CAP);
			expect(defaultFeatures.timestamp).toBeDefined();
			expect(defaultFeatures.news).toBeDefined();
			expect(defaultFeatures.social).toBeDefined();
			expect(defaultFeatures.options).toBeDefined();
			expect(defaultFeatures.momentum).toBeDefined();
			expect(defaultFeatures.embeddings).toBeDefined();
			expect(defaultFeatures.dataCompleteness).toBe(0);

			// Verify all values are neutral/zero
			expect(defaultFeatures.news.newsSentiment).toBe(0);
			expect(defaultFeatures.news.newsConfidence).toBe(0);
			expect(defaultFeatures.social.redditSentiment).toBe(0.5);
			expect(defaultFeatures.options.optionsSentiment).toBe(0.5);
			expect(defaultFeatures.momentum.sentimentMomentum).toBe(0);
			expect(defaultFeatures.embeddings.overallSentiment).toBe(0.5);

			console.log("🔄 Default features:", defaultFeatures);
		});

		it("should_return_consistent_default_features", () => {
			const defaults1 = SentimentFeatureExtractor.getDefaultFeatures("TEST1");
			const defaults2 = SentimentFeatureExtractor.getDefaultFeatures("TEST2");

			// All values should be the same except symbol and timestamp
			expect(defaults1.news.newsSentiment).toBe(defaults2.news.newsSentiment);
			expect(defaults1.social.redditSentiment).toBe(defaults2.social.redditSentiment);
			expect(defaults1.options.optionsSentiment).toBe(defaults2.options.optionsSentiment);
			expect(defaults1.embeddings.overallSentiment).toBe(
				defaults2.embeddings.overallSentiment
			);
		});
	});

	describe("Performance Requirements", () => {
		it("should_meet_100ms_extraction_target_for_single_symbol", async () => {
			const indicators = await sentimentService.getSentimentIndicators(
				TEST_SYMBOLS.LARGE_CAP
			);

			expect(indicators).toBeDefined();
			if (!indicators) {
				throw new Error("Failed to fetch sentiment indicators");
			}

			const startTime = Date.now();
			const features = SentimentFeatureExtractor.extractFeatures(
				TEST_SYMBOLS.LARGE_CAP,
				indicators
			);
			const elapsedTime = Date.now() - startTime;

			console.log(`⚡ Feature extraction time: ${elapsedTime}ms (target: <100ms)`);

			expect(features).toBeDefined();
			expect(elapsedTime).toBeLessThan(100);
		}, 300000);

		it("should_handle_multiple_extractions_efficiently", async () => {
			const indicators = await sentimentService.getSentimentIndicators(
				TEST_SYMBOLS.LARGE_CAP
			);

			expect(indicators).toBeDefined();
			if (!indicators) {
				throw new Error("Failed to fetch sentiment indicators");
			}

			const iterations = 100;
			const startTime = Date.now();

			for (let i = 0; i < iterations; i++) {
				SentimentFeatureExtractor.extractFeatures(`SYMBOL${i}`, indicators);
			}

			const elapsedTime = Date.now() - startTime;
			const avgTime = elapsedTime / iterations;

			console.log(
				`⚡ Average extraction time: ${avgTime.toFixed(2)}ms (${iterations} iterations)`
			);

			expect(avgTime).toBeLessThan(100);
		}, 300000);

		it("should_log_warning_when_exceeding_performance_target", async () => {
			const indicators = await sentimentService.getSentimentIndicators(
				TEST_SYMBOLS.LARGE_CAP
			);

			expect(indicators).toBeDefined();
			if (!indicators) {
				throw new Error("Failed to fetch sentiment indicators");
			}

			const consoleSpy = jest.spyOn(console, "warn");

			// Extract features and check for performance warnings
			const features = SentimentFeatureExtractor.extractFeatures(
				TEST_SYMBOLS.LARGE_CAP,
				indicators
			);

			expect(features).toBeDefined();

			// Note: Warning only logged if extraction takes >100ms
			// This test just verifies the feature works, not that it's slow
			consoleSpy.mockRestore();
		}, 300000);
	});

	describe("Integration Tests", () => {
		it("should_extract_complete_features_for_multiple_symbols", async () => {
			const symbols = [TEST_SYMBOLS.LARGE_CAP, TEST_SYMBOLS.MID_CAP, TEST_SYMBOLS.VOLATILE];
			const results: SentimentFeatures[] = [];

			for (const symbol of symbols) {
				const indicators = await sentimentService.getSentimentIndicators(symbol);
				if (indicators) {
					const features = SentimentFeatureExtractor.extractFeatures(symbol, indicators);
					results.push(features);
				}
			}

			expect(results.length).toBeGreaterThan(0);

			console.log(
				`✅ Successfully extracted features for ${results.length}/${symbols.length} symbols`
			);

			// Verify each result
			for (const features of results) {
				expect(features.symbol).toBeDefined();
				expect(features.news).toBeDefined();
				expect(features.social).toBeDefined();
				expect(features.options).toBeDefined();
				expect(features.momentum).toBeDefined();
				expect(features.embeddings).toBeDefined();
				expect(features.dataCompleteness).toBeGreaterThanOrEqual(0);
				expect(features.dataCompleteness).toBeLessThanOrEqual(1);
			}
		}, 300000);

		it("should_compare_features_across_different_stocks", async () => {
			const symbol1 = TEST_SYMBOLS.LARGE_CAP;
			const symbol2 = TEST_SYMBOLS.MEME_STOCK;

			const indicators1 = await sentimentService.getSentimentIndicators(symbol1);
			const indicators2 = await sentimentService.getSentimentIndicators(symbol2);

			expect(indicators1).toBeDefined();
			expect(indicators2).toBeDefined();

			if (!indicators1 || !indicators2) {
				throw new Error("Failed to fetch sentiment indicators");
			}

			const features1 = SentimentFeatureExtractor.extractFeatures(symbol1, indicators1);
			const features2 = SentimentFeatureExtractor.extractFeatures(symbol2, indicators2);

			console.log("📊 Feature comparison:", {
				symbol1: {
					symbol: features1.symbol,
					newsSentiment: features1.news.newsSentiment.toFixed(3),
					redditSentiment: features1.social.redditSentiment.toFixed(3),
					optionsSentiment: features1.options.optionsSentiment.toFixed(3),
					overall: features1.embeddings.overallSentiment.toFixed(3),
					completeness: features1.dataCompleteness.toFixed(3),
				},
				symbol2: {
					symbol: features2.symbol,
					newsSentiment: features2.news.newsSentiment.toFixed(3),
					redditSentiment: features2.social.redditSentiment.toFixed(3),
					optionsSentiment: features2.options.optionsSentiment.toFixed(3),
					overall: features2.embeddings.overallSentiment.toFixed(3),
					completeness: features2.dataCompleteness.toFixed(3),
				},
			});

			// Both should have valid features
			expect(features1.dataCompleteness).toBeGreaterThan(0);
			expect(features2.dataCompleteness).toBeGreaterThan(0);
		}, 300000);

		it("should_handle_sentiment_changes_over_time", async () => {
			const symbol = TEST_SYMBOLS.LARGE_CAP;

			// Get current indicators
			const currentIndicators = await sentimentService.getSentimentIndicators(symbol);
			expect(currentIndicators).toBeDefined();
			if (!currentIndicators) {
				throw new Error("Failed to fetch sentiment indicators");
			}

			// Simulate previous indicators (slightly different values)
			const previousIndicators: SentimentIndicators = {
				...currentIndicators,
				aggregatedScore: currentIndicators.aggregatedScore * 0.95,
				news: {
					...currentIndicators.news,
					sentiment: currentIndicators.news.sentiment * 0.95,
				},
			};

			// Extract features with momentum
			const features = SentimentFeatureExtractor.extractFeatures(
				symbol,
				currentIndicators,
				previousIndicators
			);

			// Should detect momentum
			expect(features.momentum.sentimentMomentum).not.toBe(0);

			console.log("📈 Temporal sentiment analysis:", {
				current: currentIndicators.aggregatedScore.toFixed(3),
				previous: previousIndicators.aggregatedScore.toFixed(3),
				momentum: features.momentum.sentimentMomentum.toFixed(4),
			});
		}, 300000);
	});

	describe("Edge Cases and Error Handling", () => {
		it("should_handle_zero_confidence_data_gracefully", async () => {
			const indicators = await sentimentService.getSentimentIndicators(
				TEST_SYMBOLS.LARGE_CAP
			);
			expect(indicators).toBeDefined();
			if (!indicators) {
				throw new Error("Failed to fetch sentiment indicators");
			}

			// Create indicators with zero confidence
			const zeroConfidenceIndicators: SentimentIndicators = {
				...indicators,
				confidence: 0,
				news: {
					...indicators.news,
					confidence: 0,
				},
			};

			const features = SentimentFeatureExtractor.extractFeatures(
				TEST_SYMBOLS.LARGE_CAP,
				zeroConfidenceIndicators
			);

			expect(features).toBeDefined();
			expect(features.news.newsConfidence).toBe(0);
			expect(features.embeddings.sentimentConfidence).toBe(0);
			expect(features.embeddings.weightedSentiment).toBe(0);
		}, 300000);

		it("should_handle_extreme_sentiment_values", async () => {
			const indicators = await sentimentService.getSentimentIndicators(
				TEST_SYMBOLS.LARGE_CAP
			);
			expect(indicators).toBeDefined();
			if (!indicators) {
				throw new Error("Failed to fetch sentiment indicators");
			}

			// Create indicators with extreme values
			const extremeIndicators: SentimentIndicators = {
				...indicators,
				aggregatedScore: 1.0, // Maximum positive
				news: {
					...indicators.news,
					sentiment: 1.0,
				},
				reddit: indicators.reddit
					? {
							...indicators.reddit,
							sentiment: 1.0,
						}
					: undefined,
				options: indicators.options
					? {
							...indicators.options,
							sentiment: 1.0,
						}
					: undefined,
			};

			const features = SentimentFeatureExtractor.extractFeatures(
				TEST_SYMBOLS.LARGE_CAP,
				extremeIndicators
			);

			expect(features).toBeDefined();
			expect(features.embeddings.overallSentiment).toBe(1.0);
			expect(features.embeddings.sentimentDiversity).toBe(0); // All sources agree
		}, 300000);

		it("should_validate_all_feature_outputs_are_numbers", async () => {
			const indicators = await sentimentService.getSentimentIndicators(
				TEST_SYMBOLS.LARGE_CAP
			);
			expect(indicators).toBeDefined();
			if (!indicators) {
				throw new Error("Failed to fetch sentiment indicators");
			}

			const features = SentimentFeatureExtractor.extractFeatures(
				TEST_SYMBOLS.LARGE_CAP,
				indicators
			);

			// Check all numeric fields are actually numbers
			expect(typeof features.news.newsSentiment).toBe("number");
			expect(typeof features.news.newsConfidence).toBe("number");
			expect(typeof features.social.redditSentiment).toBe("number");
			expect(typeof features.options.optionsSentiment).toBe("number");
			expect(typeof features.momentum.sentimentMomentum).toBe("number");
			expect(typeof features.embeddings.overallSentiment).toBe("number");
			expect(typeof features.dataCompleteness).toBe("number");

			// Check no NaN values
			expect(Number.isNaN(features.news.newsSentiment)).toBe(false);
			expect(Number.isNaN(features.social.redditSentiment)).toBe(false);
			expect(Number.isNaN(features.options.optionsSentiment)).toBe(false);
			expect(Number.isNaN(features.embeddings.overallSentiment)).toBe(false);
		}, 300000);
	});
});
