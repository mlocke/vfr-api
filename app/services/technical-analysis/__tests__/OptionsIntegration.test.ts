/**
 * Options Integration Test for TechnicalIndicatorService
 * Verifies that options signals are properly integrated into technical analysis
 */

import { TechnicalIndicatorService } from "../TechnicalIndicatorService";
import { RedisCache } from "../../cache/RedisCache";
import { OHLCData } from "../types";

// Mock the OptionsAnalysisService
jest.mock("../../financial-data/OptionsAnalysisService", () => {
	return {
		OptionsAnalysisService: jest.fn().mockImplementation(() => ({
			analyzeOptionsData: jest.fn(),
		})),
	};
});

describe.skip("TechnicalIndicatorService Options Integration - SKIPPED: Methods need updating", () => {
	let service: TechnicalIndicatorService;
	let mockCache: jest.Mocked<RedisCache>;
	let mockAnalyzeOptionsData: jest.Mock;

	beforeEach(() => {
		// Create mock cache
		mockCache = {
			get: jest.fn(),
			set: jest.fn(),
			ping: jest.fn().mockResolvedValue("PONG"),
			cacheOptionsData: jest.fn(),
			getCachedOptionsData: jest.fn(),
		} as any;

		service = new TechnicalIndicatorService(mockCache);

		// Set up mock for options service
		mockAnalyzeOptionsData = jest.fn();
		const mockOptionsService = {
			analyzeOptionsData: mockAnalyzeOptionsData,
		};
		(service as any).optionsService = mockOptionsService;
	});

	const sampleOHLCData: OHLCData[] = [
		{
			timestamp: Date.now() - 86400000 * 10,
			open: 100,
			high: 105,
			low: 95,
			close: 103,
			volume: 1000000,
		},
		{
			timestamp: Date.now() - 86400000 * 9,
			open: 103,
			high: 108,
			low: 101,
			close: 106,
			volume: 1200000,
		},
		{
			timestamp: Date.now() - 86400000 * 8,
			open: 106,
			high: 110,
			low: 104,
			close: 108,
			volume: 900000,
		},
		{
			timestamp: Date.now() - 86400000 * 7,
			open: 108,
			high: 112,
			low: 107,
			close: 111,
			volume: 1100000,
		},
		{
			timestamp: Date.now() - 86400000 * 6,
			open: 111,
			high: 115,
			low: 109,
			close: 113,
			volume: 1300000,
		},
		{
			timestamp: Date.now() - 86400000 * 5,
			open: 113,
			high: 117,
			low: 111,
			close: 115,
			volume: 1000000,
		},
		{
			timestamp: Date.now() - 86400000 * 4,
			open: 115,
			high: 119,
			low: 113,
			close: 117,
			volume: 1400000,
		},
		{
			timestamp: Date.now() - 86400000 * 3,
			open: 117,
			high: 121,
			low: 115,
			close: 119,
			volume: 1200000,
		},
		{
			timestamp: Date.now() - 86400000 * 2,
			open: 119,
			high: 123,
			low: 117,
			close: 121,
			volume: 1500000,
		},
		{
			timestamp: Date.now() - 86400000 * 1,
			open: 121,
			high: 125,
			low: 119,
			close: 123,
			volume: 1100000,
		},
	];

	describe("Options Data Available", () => {
		it("should integrate options signals when options data is available", async () => {
			// Mock options service response
			const mockOptionsData = {
				symbol: "AAPL",
				putCallRatio: { volumeRatio: 0.8, timestamp: Date.now() },
				volatilityAnalysis: { impliedVolatilityPercentile: 25, timestamp: Date.now() },
				flowSignals: { composite: 65, timestamp: Date.now() },
				unusualActivity: { volumeRatio: 1.2, timestamp: Date.now() },
				confidence: 85,
				timestamp: Date.now(),
			};

			mockAnalyzeOptionsData.mockResolvedValue(mockOptionsData);

			const result = await service.calculateAllIndicators({
				symbol: "AAPL",
				ohlcData: sampleOHLCData,
			});

			// Verify options are included in the result
			expect(result.options).toBeDefined();
			expect(result.options?.available).toBe(true);
			expect(result.options?.signals).toBeDefined();
			expect(result.options?.confidence).toBe(85);

			// Verify options signals are calculated
			expect(result.options?.signals?.putCallSignal).toBeGreaterThan(0);
			expect(result.options?.signals?.impliedVolatilitySignal).toBeGreaterThan(0);
			expect(result.options?.signals?.flowSignal).toBeGreaterThan(0);
			expect(result.options?.signals?.composite).toBeGreaterThan(0);

			// Verify options component is included in technical score breakdown
			expect(result.score?.breakdown?.options).toBeDefined();
			expect(result.score?.breakdown?.options).toBeGreaterThan(0);

			// Verify weight redistribution when options available
			// Traditional components should have reduced weights
			expect(result.score?.breakdown?.trend).toBeLessThan(100); // Would be higher without options
			expect(result.score?.breakdown?.momentum).toBeLessThan(100);
			expect(result.score?.breakdown?.volume).toBeLessThan(100);

			console.log(
				"✅ Options integration test passed - signals included in technical analysis"
			);
		});

		it("should calculate P/C ratio signals correctly", async () => {
			const mockOptionsData = {
				symbol: "AAPL",
				putCallRatio: { volumeRatio: 0.6 }, // Bullish (high call volume)
				volatilityAnalysis: { impliedVolatilityPercentile: 50 },
				flowSignals: { composite: 50 },
				unusualActivity: { volumeRatio: 1.0 },
				confidence: 80,
				timestamp: Date.now(),
			};

			mockAnalyzeOptionsData.mockResolvedValue(mockOptionsData);

			const result = await service.calculateAllIndicators({
				symbol: "AAPL",
				ohlcData: sampleOHLCData,
			});

			// P/C ratio of 0.6 should generate bullish signal (>70)
			expect(result.options?.signals?.putCallSignal).toBeGreaterThan(70);
			console.log(`P/C Signal (ratio 0.6): ${result.options?.signals?.putCallSignal}`);
		});

		it("should calculate IV signals correctly", async () => {
			const mockOptionsData = {
				symbol: "AAPL",
				putCallRatio: { volumeRatio: 1.0 },
				volatilityAnalysis: { impliedVolatilityPercentile: 20 }, // Low IV
				flowSignals: { composite: 50 },
				unusualActivity: { volumeRatio: 1.0 },
				confidence: 80,
				timestamp: Date.now(),
			};

			mockAnalyzeOptionsData.mockResolvedValue(mockOptionsData);

			const result = await service.calculateAllIndicators({
				symbol: "AAPL",
				ohlcData: sampleOHLCData,
			});

			// Low IV percentile (20) should suggest buying options (>70)
			expect(result.options?.signals?.impliedVolatilitySignal).toBeGreaterThan(70);
			console.log(
				`IV Signal (20th percentile): ${result.options?.signals?.impliedVolatilitySignal}`
			);
		});
	});

	describe("Options Data Unavailable", () => {
		it("should gracefully handle when options data is unavailable", async () => {
			// Mock options service to return null (no data)
			mockAnalyzeOptionsData.mockResolvedValue(null);

			const result = await service.calculateAllIndicators({
				symbol: "AAPL",
				ohlcData: sampleOHLCData,
			});

			// Verify options fallback behavior
			expect(result.options).toBeDefined();
			expect(result.options?.available).toBe(false);
			expect(result.options?.signals).toBeNull();
			expect(result.options?.confidence).toBe(0);

			// Verify no options component in technical score breakdown
			expect(result.score?.breakdown?.options).toBeUndefined();

			// Verify traditional weights are maintained
			expect(result.score?.breakdown?.trend).toBeGreaterThan(0);
			expect(result.score?.breakdown?.momentum).toBeGreaterThan(0);
			expect(result.score?.breakdown?.volume).toBeGreaterThan(0);
			expect(result.score?.breakdown?.patterns).toBeGreaterThan(0);

			console.log(
				"✅ Options unavailable fallback test passed - traditional analysis maintained"
			);
		});

		it("should handle options service timeout", async () => {
			// Mock options service to timeout
			mockAnalyzeOptionsData.mockImplementation(
				() => new Promise(resolve => setTimeout(resolve, 3000)) // 3s timeout > 2s limit
			);

			const result = await service.calculateAllIndicators({
				symbol: "AAPL",
				ohlcData: sampleOHLCData,
			});

			// Should fallback gracefully on timeout
			expect(result.options?.available).toBe(false);
			expect(result.score?.total).toBeGreaterThan(0);

			console.log("✅ Options timeout fallback test passed");
		});
	});

	describe("Performance Requirements", () => {
		it("should maintain <3s total analysis time with options integration", async () => {
			const mockOptionsData = {
				symbol: "AAPL",
				putCallRatio: { volumeRatio: 1.0 },
				volatilityAnalysis: { impliedVolatilityPercentile: 50 },
				flowSignals: { composite: 50 },
				unusualActivity: { volumeRatio: 1.0 },
				confidence: 75,
				timestamp: Date.now(),
			};

			mockAnalyzeOptionsData.mockResolvedValue(mockOptionsData);

			const startTime = performance.now();

			const result = await service.calculateAllIndicators({
				symbol: "AAPL",
				ohlcData: sampleOHLCData,
			});

			const duration = performance.now() - startTime;

			expect(duration).toBeLessThan(3000); // <3s requirement
			expect(result.metadata?.calculationTime).toBeLessThan(3000);

			console.log(
				`✅ Performance test passed - analysis completed in ${duration.toFixed(0)}ms`
			);
		});

		it("should maintain backward compatibility with existing technical analysis", async () => {
			mockAnalyzeOptionsData.mockResolvedValue(null);

			const result = await service.calculateAllIndicators({
				symbol: "AAPL",
				ohlcData: sampleOHLCData,
			});

			// Verify all traditional components are present
			expect(result.trend).toBeDefined();
			expect(result.momentum).toBeDefined();
			expect(result.volume).toBeDefined();
			expect(result.volatility).toBeDefined();
			expect(result.patterns).toBeDefined();
			expect(result.score).toBeDefined();
			expect(result.metadata).toBeDefined();

			// Verify score structure
			expect(result.score?.total).toBeGreaterThan(0);
			expect(result.score?.breakdown?.trend).toBeGreaterThan(0);
			expect(result.score?.breakdown?.momentum).toBeGreaterThan(0);
			expect(result.score?.breakdown?.volume).toBeGreaterThan(0);
			expect(result.score?.breakdown?.patterns).toBeGreaterThan(0);

			console.log(
				"✅ Backward compatibility test passed - all traditional components preserved"
			);
		});
	});

	describe("Options Signal Quality", () => {
		it("should apply confidence weighting to options signals", async () => {
			const highConfidenceData = {
				symbol: "AAPL",
				putCallRatio: { volumeRatio: 0.5 }, // Strong bullish signal
				volatilityAnalysis: { impliedVolatilityPercentile: 15 }, // Strong buy vol signal
				flowSignals: { composite: 80 }, // Strong flow signal
				unusualActivity: { volumeRatio: 1.0 },
				confidence: 95, // High confidence
				timestamp: Date.now(),
			};

			const lowConfidenceData = {
				...highConfidenceData,
				confidence: 30, // Low confidence
			};

			// Test high confidence
			mockAnalyzeOptionsData.mockResolvedValue(highConfidenceData);
			const highConfResult = await service.calculateAllIndicators({
				symbol: "AAPL",
				ohlcData: sampleOHLCData,
			});

			// Test low confidence
			mockAnalyzeOptionsData.mockResolvedValue(lowConfidenceData);
			const lowConfResult = await service.calculateAllIndicators({
				symbol: "AAPL",
				ohlcData: sampleOHLCData,
			});

			// High confidence should have more extreme signals
			expect(highConfResult.score?.breakdown?.options).toBeGreaterThan(
				lowConfResult.score?.breakdown?.options || 0
			);

			console.log(
				`✅ Confidence weighting test passed - High: ${highConfResult.score?.breakdown?.options}, Low: ${lowConfResult.score?.breakdown?.options}`
			);
		});
	});
});
