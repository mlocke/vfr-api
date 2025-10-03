/**
 * TechnicalFeatureExtractor Tests
 *
 * Tests for advanced technical feature extraction including:
 * - Momentum features (1d, 5d, 20d)
 * - Volatility features (realized volatility, z-scores)
 * - Mean reversion features (price/volume z-scores)
 *
 * Performance target: <100ms per symbol
 */

import { TechnicalFeatureExtractor } from "../TechnicalFeatureExtractor";
import type { OHLCData } from "../../../technical-analysis/types";

describe("TechnicalFeatureExtractor", () => {
	// Helper function to generate sample OHLC data
	function generateOHLCData(
		periods: number,
		basePrice: number = 100,
		volatility: number = 0.02
	): OHLCData[] {
		const data: OHLCData[] = [];
		const startDate = Date.now() - periods * 24 * 60 * 60 * 1000;

		let currentPrice = basePrice;

		for (let i = 0; i < periods; i++) {
			const randomChange = (Math.random() - 0.5) * 2 * volatility;
			const open = currentPrice;
			const close = open * (1 + randomChange);
			const high = Math.max(open, close) * (1 + Math.random() * volatility);
			const low = Math.min(open, close) * (1 - Math.random() * volatility);
			const volume = Math.floor(1000000 + Math.random() * 5000000);

			data.push({
				timestamp: startDate + i * 24 * 60 * 60 * 1000,
				open,
				high,
				low,
				close,
				volume,
			});

			currentPrice = close;
		}

		return data;
	}

	describe("Momentum Features", () => {
		it("should extract momentum features from OHLC data", () => {
			const ohlcData = generateOHLCData(100);
			const features = TechnicalFeatureExtractor.extractFeatures("AAPL", ohlcData);

			expect(features.momentum).toBeDefined();
			expect(features.momentum.momentum1d).toBeDefined();
			expect(features.momentum.momentum5d).toBeDefined();
			expect(features.momentum.momentum20d).toBeDefined();
			expect(features.momentum.momentumVelocity1d).toBeDefined();
			expect(features.momentum.momentumVelocity5d).toBeDefined();
			expect(features.momentum.momentumAcceleration).toBeDefined();
		});

		it("should calculate positive momentum for uptrend", () => {
			const ohlcData: OHLCData[] = [];
			const startDate = Date.now() - 100 * 24 * 60 * 60 * 1000;

			// Create uptrend data
			for (let i = 0; i < 100; i++) {
				const price = 100 + i * 0.5; // Steady uptrend
				ohlcData.push({
					timestamp: startDate + i * 24 * 60 * 60 * 1000,
					open: price,
					high: price + 0.2,
					low: price - 0.2,
					close: price,
					volume: 1000000,
				});
			}

			const features = TechnicalFeatureExtractor.extractFeatures("TEST", ohlcData);

			// All momentum should be positive
			expect(features.momentum.momentum1d).toBeGreaterThan(0);
			expect(features.momentum.momentum5d).toBeGreaterThan(0);
			expect(features.momentum.momentum20d).toBeGreaterThan(0);
		});

		it("should calculate negative momentum for downtrend", () => {
			const ohlcData: OHLCData[] = [];
			const startDate = Date.now() - 100 * 24 * 60 * 60 * 1000;

			// Create downtrend data
			for (let i = 0; i < 100; i++) {
				const price = 150 - i * 0.5; // Steady downtrend
				ohlcData.push({
					timestamp: startDate + i * 24 * 60 * 60 * 1000,
					open: price,
					high: price + 0.2,
					low: price - 0.2,
					close: price,
					volume: 1000000,
				});
			}

			const features = TechnicalFeatureExtractor.extractFeatures("TEST", ohlcData);

			// All momentum should be negative
			expect(features.momentum.momentum1d).toBeLessThan(0);
			expect(features.momentum.momentum5d).toBeLessThan(0);
			expect(features.momentum.momentum20d).toBeLessThan(0);
		});

		it("should return default momentum for insufficient data", () => {
			const ohlcData = generateOHLCData(10); // Less than 21 periods
			const features = TechnicalFeatureExtractor.extractFeatures("TEST", ohlcData);

			expect(features.momentum.momentum1d).toBe(0);
			expect(features.momentum.momentum5d).toBe(0);
			expect(features.momentum.momentum20d).toBe(0);
		});
	});

	describe("Volatility Features", () => {
		it("should extract volatility features from OHLC data", () => {
			const ohlcData = generateOHLCData(100);
			const features = TechnicalFeatureExtractor.extractFeatures("AAPL", ohlcData);

			expect(features.volatility).toBeDefined();
			expect(features.volatility.realizedVol5d).toBeDefined();
			expect(features.volatility.realizedVol20d).toBeDefined();
			expect(features.volatility.realizedVol60d).toBeDefined();
			expect(features.volatility.priceVolZScore).toBeDefined();
			expect(features.volatility.volumeVolZScore).toBeDefined();
			expect(features.volatility.volRegime).toBeDefined();
		});

		it("should calculate higher volatility for volatile data", () => {
			const lowVolData = generateOHLCData(100, 100, 0.01); // 1% volatility
			const highVolData = generateOHLCData(100, 100, 0.05); // 5% volatility

			const lowVolFeatures = TechnicalFeatureExtractor.extractFeatures("LOW", lowVolData);
			const highVolFeatures = TechnicalFeatureExtractor.extractFeatures("HIGH", highVolData);

			// High volatility data should have higher realized vol
			expect(highVolFeatures.volatility.realizedVol20d).toBeGreaterThan(
				lowVolFeatures.volatility.realizedVol20d
			);
		});

		it("should classify volatility regime correctly", () => {
			const ohlcData = generateOHLCData(100);
			const features = TechnicalFeatureExtractor.extractFeatures("TEST", ohlcData);

			// Volatility regime should be between 0 and 1
			expect(features.volatility.volRegime).toBeGreaterThanOrEqual(0);
			expect(features.volatility.volRegime).toBeLessThanOrEqual(1);
		});

		it("should return default volatility for insufficient data", () => {
			const ohlcData = generateOHLCData(50); // Less than 61 periods
			const features = TechnicalFeatureExtractor.extractFeatures("TEST", ohlcData);

			expect(features.volatility.realizedVol5d).toBe(0.25);
			expect(features.volatility.realizedVol20d).toBe(0.25);
			expect(features.volatility.realizedVol60d).toBe(0.25);
			expect(features.volatility.volRegime).toBe(0.5);
		});
	});

	describe("Mean Reversion Features", () => {
		it("should extract mean reversion features from OHLC data", () => {
			const ohlcData = generateOHLCData(100);
			const features = TechnicalFeatureExtractor.extractFeatures("AAPL", ohlcData);

			expect(features.meanReversion).toBeDefined();
			expect(features.meanReversion.priceZScore5d).toBeDefined();
			expect(features.meanReversion.priceZScore20d).toBeDefined();
			expect(features.meanReversion.priceZScore60d).toBeDefined();
			expect(features.meanReversion.volumeZScore5d).toBeDefined();
			expect(features.meanReversion.volumeZScore20d).toBeDefined();
			expect(features.meanReversion.overextended).toBeDefined();
			expect(features.meanReversion.reversionProbability).toBeDefined();
		});

		it("should detect overextended conditions", () => {
			const ohlcData: OHLCData[] = [];
			const startDate = Date.now() - 100 * 24 * 60 * 60 * 1000;

			// Create data with a spike at the end (overextended)
			for (let i = 0; i < 100; i++) {
				const price = i < 99 ? 100 : 130; // Big spike on last day
				ohlcData.push({
					timestamp: startDate + i * 24 * 60 * 60 * 1000,
					open: price,
					high: price + 0.2,
					low: price - 0.2,
					close: price,
					volume: 1000000,
				});
			}

			const features = TechnicalFeatureExtractor.extractFeatures("TEST", ohlcData);

			// Should detect overextended condition
			expect(Math.abs(features.meanReversion.priceZScore5d)).toBeGreaterThan(2);
			expect(features.meanReversion.overextended).toBeGreaterThan(0);
		});

		it("should calculate reversion probability", () => {
			const ohlcData = generateOHLCData(100);
			const features = TechnicalFeatureExtractor.extractFeatures("TEST", ohlcData);

			// Reversion probability should be between 0 and 1
			expect(features.meanReversion.reversionProbability).toBeGreaterThanOrEqual(0);
			expect(features.meanReversion.reversionProbability).toBeLessThanOrEqual(1);
		});

		it("should return default mean reversion for insufficient data", () => {
			const ohlcData = generateOHLCData(50); // Less than 61 periods
			const features = TechnicalFeatureExtractor.extractFeatures("TEST", ohlcData);

			expect(features.meanReversion.priceZScore5d).toBe(0);
			expect(features.meanReversion.priceZScore20d).toBe(0);
			expect(features.meanReversion.priceZScore60d).toBe(0);
			expect(features.meanReversion.overextended).toBe(0);
			expect(features.meanReversion.reversionProbability).toBe(0.5);
		});
	});

	describe("Feature Flattening", () => {
		it("should flatten features to flat key-value map", () => {
			const ohlcData = generateOHLCData(100);
			const features = TechnicalFeatureExtractor.extractFeatures("AAPL", ohlcData);
			const flatFeatures = TechnicalFeatureExtractor.flattenFeatures(features);

			// Check all expected keys exist
			expect(flatFeatures["adv_momentum_1d"]).toBeDefined();
			expect(flatFeatures["adv_momentum_5d"]).toBeDefined();
			expect(flatFeatures["adv_momentum_20d"]).toBeDefined();
			expect(flatFeatures["adv_momentum_velocity_1d"]).toBeDefined();
			expect(flatFeatures["adv_momentum_velocity_5d"]).toBeDefined();
			expect(flatFeatures["adv_momentum_acceleration"]).toBeDefined();

			expect(flatFeatures["adv_vol_5d"]).toBeDefined();
			expect(flatFeatures["adv_vol_20d"]).toBeDefined();
			expect(flatFeatures["adv_vol_60d"]).toBeDefined();
			expect(flatFeatures["adv_price_vol_zscore"]).toBeDefined();
			expect(flatFeatures["adv_volume_vol_zscore"]).toBeDefined();
			expect(flatFeatures["adv_vol_regime"]).toBeDefined();

			expect(flatFeatures["adv_price_zscore_5d"]).toBeDefined();
			expect(flatFeatures["adv_price_zscore_20d"]).toBeDefined();
			expect(flatFeatures["adv_price_zscore_60d"]).toBeDefined();
			expect(flatFeatures["adv_volume_zscore_5d"]).toBeDefined();
			expect(flatFeatures["adv_volume_zscore_20d"]).toBeDefined();
			expect(flatFeatures["adv_overextended"]).toBeDefined();
			expect(flatFeatures["adv_reversion_probability"]).toBeDefined();
		});

		it("should preserve feature values in flattened format", () => {
			const ohlcData = generateOHLCData(100);
			const features = TechnicalFeatureExtractor.extractFeatures("AAPL", ohlcData);
			const flatFeatures = TechnicalFeatureExtractor.flattenFeatures(features);

			expect(flatFeatures["adv_momentum_1d"]).toBe(features.momentum.momentum1d);
			expect(flatFeatures["adv_vol_20d"]).toBe(features.volatility.realizedVol20d);
			expect(flatFeatures["adv_price_zscore_20d"]).toBe(
				features.meanReversion.priceZScore20d
			);
		});
	});

	describe("Performance", () => {
		it("should meet <100ms extraction target", () => {
			const ohlcData = generateOHLCData(100);

			const startTime = Date.now();
			const features = TechnicalFeatureExtractor.extractFeatures("AAPL", ohlcData);
			const elapsedTime = Date.now() - startTime;

			console.log(`Feature extraction time: ${elapsedTime}ms (target: <100ms)`);

			expect(features).toBeDefined();
			expect(elapsedTime).toBeLessThan(100);
		});

		it("should handle large datasets efficiently", () => {
			const ohlcData = generateOHLCData(500); // 500 periods

			const startTime = Date.now();
			const features = TechnicalFeatureExtractor.extractFeatures("AAPL", ohlcData);
			const elapsedTime = Date.now() - startTime;

			console.log(`Large dataset extraction time: ${elapsedTime}ms`);

			expect(features).toBeDefined();
			expect(elapsedTime).toBeLessThan(200); // Allow more time for larger datasets
		});

		it("should process multiple extractions quickly", () => {
			const ohlcData = generateOHLCData(100);

			const startTime = Date.now();

			for (let i = 0; i < 10; i++) {
				TechnicalFeatureExtractor.extractFeatures(`SYMBOL${i}`, ohlcData);
			}

			const elapsedTime = Date.now() - startTime;
			const avgTime = elapsedTime / 10;

			console.log(`Average extraction time: ${avgTime.toFixed(2)}ms (10 iterations)`);

			expect(avgTime).toBeLessThan(100);
		});
	});

	describe("Edge Cases", () => {
		it("should handle empty OHLC data", () => {
			const features = TechnicalFeatureExtractor.extractFeatures("TEST", []);

			expect(features).toBeDefined();
			expect(features.momentum.momentum1d).toBe(0);
			expect(features.volatility.realizedVol20d).toBe(0.25);
			expect(features.meanReversion.priceZScore20d).toBe(0);
		});

		it("should handle minimal OHLC data", () => {
			const ohlcData = generateOHLCData(5);
			const features = TechnicalFeatureExtractor.extractFeatures("TEST", ohlcData);

			expect(features).toBeDefined();
			// Should return defaults for most features
		});

		it("should handle data with zero prices", () => {
			const ohlcData: OHLCData[] = [
				{ timestamp: Date.now(), open: 0, high: 0, low: 0, close: 0, volume: 0 },
				{
					timestamp: Date.now(),
					open: 100,
					high: 100,
					low: 100,
					close: 100,
					volume: 1000000,
				},
			];

			const features = TechnicalFeatureExtractor.extractFeatures("TEST", ohlcData);

			expect(features).toBeDefined();
			// Should handle gracefully without errors
		});

		it("should handle data with zero volumes", () => {
			const ohlcData: OHLCData[] = [];
			const startDate = Date.now() - 100 * 24 * 60 * 60 * 1000;

			for (let i = 0; i < 100; i++) {
				ohlcData.push({
					timestamp: startDate + i * 24 * 60 * 60 * 1000,
					open: 100 + i,
					high: 101 + i,
					low: 99 + i,
					close: 100 + i,
					volume: 0, // Zero volume
				});
			}

			const features = TechnicalFeatureExtractor.extractFeatures("TEST", ohlcData);

			expect(features).toBeDefined();
			// Should handle gracefully
		});

		it("should handle extremely volatile data", () => {
			const ohlcData = generateOHLCData(100, 100, 0.5); // 50% volatility

			const features = TechnicalFeatureExtractor.extractFeatures("TEST", ohlcData);

			expect(features).toBeDefined();
			expect(features.volatility.realizedVol20d).toBeGreaterThan(0);
			expect(features.volatility.volRegime).toBeGreaterThanOrEqual(0);
			expect(features.volatility.volRegime).toBeLessThanOrEqual(1);
		});
	});

	describe("Statistical Accuracy", () => {
		it("should calculate z-scores correctly", () => {
			const ohlcData: OHLCData[] = [];
			const startDate = Date.now() - 100 * 24 * 60 * 60 * 1000;

			// Create data with known mean and std dev
			const mean = 100;
			for (let i = 0; i < 99; i++) {
				ohlcData.push({
					timestamp: startDate + i * 24 * 60 * 60 * 1000,
					open: mean,
					high: mean,
					low: mean,
					close: mean,
					volume: 1000000,
				});
			}

			// Add a point exactly 2 std devs above mean
			ohlcData.push({
				timestamp: startDate + 99 * 24 * 60 * 60 * 1000,
				open: mean,
				high: mean,
				low: mean,
				close: mean + 2, // Simple example
				volume: 1000000,
			});

			const features = TechnicalFeatureExtractor.extractFeatures("TEST", ohlcData);

			// Z-score should be positive
			expect(features.meanReversion.priceZScore5d).toBeGreaterThan(0);
		});

		it("should calculate momentum correctly", () => {
			const ohlcData: OHLCData[] = [];
			const startDate = Date.now() - 100 * 24 * 60 * 60 * 1000;

			// Price goes from 100 to 110 (10% gain)
			for (let i = 0; i < 100; i++) {
				const price = 100 + (i / 99) * 10;
				ohlcData.push({
					timestamp: startDate + i * 24 * 60 * 60 * 1000,
					open: price,
					high: price,
					low: price,
					close: price,
					volume: 1000000,
				});
			}

			const features = TechnicalFeatureExtractor.extractFeatures("TEST", ohlcData);

			// All momentum should be positive
			expect(features.momentum.momentum1d).toBeGreaterThan(0);
			expect(features.momentum.momentum5d).toBeGreaterThan(0);
			expect(features.momentum.momentum20d).toBeGreaterThan(0);
		});
	});
});
