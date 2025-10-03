/**
 * FundamentalFeatureExtractor Tests
 *
 * Comprehensive tests for fundamental feature extraction including:
 * - Valuation features (P/E, P/B, P/S, PEG, relativeValuation)
 * - Profitability features (ROE, ROA, margins, quality indicators)
 * - Financial health features (leverage, liquidity, stress indicators)
 * - Shareholder return features (dividends, sustainability, growth potential)
 * - Data completeness calculations
 * - Default/fallback features
 *
 * Performance target: <100ms per symbol
 *
 * CRITICAL: NO MOCK DATA - Uses real FMP API data per project policy
 */

import { FundamentalFeatureExtractor } from "../FundamentalFeatureExtractor";
import type { FundamentalRatios } from "../../../financial-data/types";
import { FinancialModelingPrepAPI } from "../../../financial-data/FinancialModelingPrepAPI";

describe("FundamentalFeatureExtractor", () => {
	let fmpApi: FinancialModelingPrepAPI;

	beforeAll(() => {
		// Initialize FMP API for real data testing
		fmpApi = new FinancialModelingPrepAPI();
	});

	describe("Real API Integration Tests", () => {
		describe("Valuation Features with Real Data", () => {
			it("should extract valuation features from real AAPL fundamental ratios", async () => {
				const ratios = await fmpApi.getFundamentalRatios("AAPL");
				expect(ratios).not.toBeNull();

				const features = FundamentalFeatureExtractor.extractFeatures("AAPL", ratios!);

				expect(features.valuation).toBeDefined();
				expect(features.valuation.peRatio).toBeDefined();
				expect(features.valuation.pbRatio).toBeDefined();
				expect(features.valuation.priceToSales).toBeDefined();
				expect(features.valuation.valuationScore).toBeGreaterThanOrEqual(0);
				expect(features.valuation.valuationScore).toBeLessThanOrEqual(1);
				expect(features.valuation.relativeValuation).toBeGreaterThanOrEqual(0);
				expect(features.valuation.relativeValuation).toBeLessThanOrEqual(1);
				expect(typeof features.valuation.isPremiumValuation).toBe("boolean");
			}, 30000);

			it("should extract valuation features from real MSFT fundamental ratios", async () => {
				const ratios = await fmpApi.getFundamentalRatios("MSFT");
				expect(ratios).not.toBeNull();

				const features = FundamentalFeatureExtractor.extractFeatures("MSFT", ratios!);

				expect(features.valuation).toBeDefined();
				expect(features.valuation.peRatio).toBeDefined();
				expect(features.valuation.valuationScore).toBeGreaterThanOrEqual(0);
				expect(features.valuation.valuationScore).toBeLessThanOrEqual(1);
				expect(features.valuation.relativeValuation).toBeGreaterThanOrEqual(0);
				expect(features.valuation.relativeValuation).toBeLessThanOrEqual(1);
			}, 30000);

			it("should extract valuation features from real GOOGL fundamental ratios", async () => {
				const ratios = await fmpApi.getFundamentalRatios("GOOGL");
				expect(ratios).not.toBeNull();

				const features = FundamentalFeatureExtractor.extractFeatures("GOOGL", ratios!);

				expect(features.valuation).toBeDefined();
				expect(features.valuation.peRatio).toBeDefined();
				expect(features.valuation.pbRatio).toBeDefined();
				expect(features.valuation.valuationScore).toBeGreaterThanOrEqual(0);
				expect(features.valuation.valuationScore).toBeLessThanOrEqual(1);
			}, 30000);
		});

		describe("Profitability Features with Real Data", () => {
			it("should extract profitability features from real AAPL fundamental ratios", async () => {
				const ratios = await fmpApi.getFundamentalRatios("AAPL");
				expect(ratios).not.toBeNull();

				const features = FundamentalFeatureExtractor.extractFeatures("AAPL", ratios!);

				expect(features.profitability).toBeDefined();
				expect(features.profitability.roe).toBeDefined();
				expect(features.profitability.roa).toBeDefined();
				expect(features.profitability.grossProfitMargin).toBeDefined();
				expect(features.profitability.operatingMargin).toBeDefined();
				expect(features.profitability.netProfitMargin).toBeDefined();
				expect(features.profitability.profitabilityScore).toBeGreaterThanOrEqual(0);
				expect(features.profitability.profitabilityScore).toBeLessThanOrEqual(1);
				expect(features.profitability.marginTrend).toBeGreaterThanOrEqual(-1);
				expect(features.profitability.marginTrend).toBeLessThanOrEqual(1);
				expect(typeof features.profitability.isHighQuality).toBe("boolean");
			}, 30000);

			it("should extract profitability features from real MSFT fundamental ratios", async () => {
				const ratios = await fmpApi.getFundamentalRatios("MSFT");
				expect(ratios).not.toBeNull();

				const features = FundamentalFeatureExtractor.extractFeatures("MSFT", ratios!);

				expect(features.profitability).toBeDefined();
				expect(features.profitability.roe).toBeDefined();
				expect(features.profitability.profitabilityScore).toBeGreaterThanOrEqual(0);
				expect(features.profitability.profitabilityScore).toBeLessThanOrEqual(1);
			}, 30000);
		});

		describe("Financial Health Features with Real Data", () => {
			it("should extract financial health features from real AAPL fundamental ratios", async () => {
				const ratios = await fmpApi.getFundamentalRatios("AAPL");
				expect(ratios).not.toBeNull();

				const features = FundamentalFeatureExtractor.extractFeatures("AAPL", ratios!);

				expect(features.financialHealth).toBeDefined();
				expect(features.financialHealth.debtToEquity).toBeDefined();
				expect(features.financialHealth.currentRatio).toBeDefined();
				expect(features.financialHealth.quickRatio).toBeDefined();
				expect(features.financialHealth.healthScore).toBeGreaterThanOrEqual(0);
				expect(features.financialHealth.healthScore).toBeLessThanOrEqual(1);
				expect(features.financialHealth.leverageRisk).toBeGreaterThanOrEqual(0);
				expect(features.financialHealth.leverageRisk).toBeLessThanOrEqual(1);
				expect(features.financialHealth.liquidityStrength).toBeGreaterThanOrEqual(0);
				expect(features.financialHealth.liquidityStrength).toBeLessThanOrEqual(1);
				expect(typeof features.financialHealth.isFinanciallyStressed).toBe("boolean");
			}, 30000);

			it("should extract financial health features from real GOOGL fundamental ratios", async () => {
				const ratios = await fmpApi.getFundamentalRatios("GOOGL");
				expect(ratios).not.toBeNull();

				const features = FundamentalFeatureExtractor.extractFeatures("GOOGL", ratios!);

				expect(features.financialHealth).toBeDefined();
				expect(features.financialHealth.healthScore).toBeGreaterThanOrEqual(0);
				expect(features.financialHealth.healthScore).toBeLessThanOrEqual(1);
			}, 30000);
		});

		describe("Shareholder Return Features with Real Data", () => {
			it("should extract shareholder return features from real AAPL fundamental ratios", async () => {
				const ratios = await fmpApi.getFundamentalRatios("AAPL");
				expect(ratios).not.toBeNull();

				const features = FundamentalFeatureExtractor.extractFeatures("AAPL", ratios!);

				expect(features.shareholderReturn).toBeDefined();
				expect(features.shareholderReturn.dividendYield).toBeDefined();
				expect(features.shareholderReturn.payoutRatio).toBeDefined();
				expect(features.shareholderReturn.dividendSustainability).toBeGreaterThanOrEqual(0);
				expect(features.shareholderReturn.dividendSustainability).toBeLessThanOrEqual(1);
				expect(typeof features.shareholderReturn.isIncomeFocused).toBe("boolean");
				expect(features.shareholderReturn.dividendGrowthPotential).toBeGreaterThanOrEqual(
					0
				);
				expect(features.shareholderReturn.dividendGrowthPotential).toBeLessThanOrEqual(1);
			}, 30000);

			it("should extract shareholder return features from real MSFT fundamental ratios", async () => {
				const ratios = await fmpApi.getFundamentalRatios("MSFT");
				expect(ratios).not.toBeNull();

				const features = FundamentalFeatureExtractor.extractFeatures("MSFT", ratios!);

				expect(features.shareholderReturn).toBeDefined();
				expect(features.shareholderReturn.dividendYield).toBeDefined();
				expect(features.shareholderReturn.dividendSustainability).toBeGreaterThanOrEqual(0);
			}, 30000);
		});

		describe("Data Completeness with Real Data", () => {
			it("should calculate data completeness for real AAPL fundamental ratios", async () => {
				const ratios = await fmpApi.getFundamentalRatios("AAPL");
				expect(ratios).not.toBeNull();

				const features = FundamentalFeatureExtractor.extractFeatures("AAPL", ratios!);

				expect(features.dataCompleteness).toBeDefined();
				expect(features.dataCompleteness).toBeGreaterThanOrEqual(0);
				expect(features.dataCompleteness).toBeLessThanOrEqual(1);

				// AAPL should have high data completeness (>80%)
				console.log(
					`AAPL data completeness: ${(features.dataCompleteness * 100).toFixed(1)}%`
				);
				expect(features.dataCompleteness).toBeGreaterThan(0.5);
			}, 30000);

			it("should calculate data completeness for real MSFT fundamental ratios", async () => {
				const ratios = await fmpApi.getFundamentalRatios("MSFT");
				expect(ratios).not.toBeNull();

				const features = FundamentalFeatureExtractor.extractFeatures("MSFT", ratios!);

				expect(features.dataCompleteness).toBeGreaterThanOrEqual(0);
				expect(features.dataCompleteness).toBeLessThanOrEqual(1);
				console.log(
					`MSFT data completeness: ${(features.dataCompleteness * 100).toFixed(1)}%`
				);
			}, 30000);

			it("should calculate data completeness for real GOOGL fundamental ratios", async () => {
				const ratios = await fmpApi.getFundamentalRatios("GOOGL");
				expect(ratios).not.toBeNull();

				const features = FundamentalFeatureExtractor.extractFeatures("GOOGL", ratios!);

				expect(features.dataCompleteness).toBeGreaterThanOrEqual(0);
				expect(features.dataCompleteness).toBeLessThanOrEqual(1);
				console.log(
					`GOOGL data completeness: ${(features.dataCompleteness * 100).toFixed(1)}%`
				);
			}, 30000);
		});
	});

	describe("Valuation Features - Detailed Logic Tests", () => {
		it("should calculate valuation score correctly for expensive stock", () => {
			const expensiveRatios: FundamentalRatios = {
				symbol: "EXPENSIVE",
				peRatio: 60, // High P/E
				pegRatio: 4, // High PEG
				pbRatio: 10, // High P/B
				priceToSales: 15, // High P/S
				priceToFreeCashFlow: 50,
				debtToEquity: 0.5,
				currentRatio: 2,
				quickRatio: 1.5,
				roe: 20,
				roa: 10,
				grossProfitMargin: 40,
				operatingMargin: 25,
				netProfitMargin: 20,
				dividendYield: 1,
				payoutRatio: 30,
				timestamp: Date.now(),
				source: "test",
				period: "ttm",
			};

			const features = FundamentalFeatureExtractor.extractFeatures(
				"EXPENSIVE",
				expensiveRatios
			);

			// Expensive stock should have high valuation score (closer to 1)
			expect(features.valuation.valuationScore).toBeGreaterThan(0.7);
			expect(features.valuation.isPremiumValuation).toBe(true);
			// Relative valuation should be low (inverted score)
			expect(features.valuation.relativeValuation).toBeLessThan(0.3);
		});

		it("should calculate valuation score correctly for cheap stock", () => {
			const cheapRatios: FundamentalRatios = {
				symbol: "CHEAP",
				peRatio: 10, // Low P/E
				pegRatio: 0.8, // Low PEG
				pbRatio: 1.5, // Low P/B
				priceToSales: 2, // Low P/S
				priceToFreeCashFlow: 8,
				debtToEquity: 0.5,
				currentRatio: 2,
				quickRatio: 1.5,
				roe: 15,
				roa: 8,
				grossProfitMargin: 30,
				operatingMargin: 15,
				netProfitMargin: 10,
				dividendYield: 3,
				payoutRatio: 50,
				timestamp: Date.now(),
				source: "test",
				period: "ttm",
			};

			const features = FundamentalFeatureExtractor.extractFeatures("CHEAP", cheapRatios);

			// Cheap stock should have low valuation score (closer to 0)
			expect(features.valuation.valuationScore).toBeLessThan(0.5);
			expect(features.valuation.isPremiumValuation).toBe(false);
			// Relative valuation should be high (inverted score)
			expect(features.valuation.relativeValuation).toBeGreaterThan(0.5);
		});

		it("should identify premium valuation correctly", () => {
			const premiumRatios: FundamentalRatios = {
				symbol: "PREMIUM",
				peRatio: 30,
				pegRatio: 2,
				pbRatio: 5,
				priceToSales: 8,
				priceToFreeCashFlow: 30,
				debtToEquity: 0.3,
				currentRatio: 2.5,
				quickRatio: 2,
				roe: 25,
				roa: 15,
				grossProfitMargin: 50,
				operatingMargin: 30,
				netProfitMargin: 25,
				dividendYield: 0.5,
				payoutRatio: 20,
				timestamp: Date.now(),
				source: "test",
				period: "ttm",
			};

			const features = FundamentalFeatureExtractor.extractFeatures("PREMIUM", premiumRatios);

			expect(features.valuation.isPremiumValuation).toBe(true);
		});

		it("should handle missing valuation ratios with defaults", () => {
			const incompleteRatios: FundamentalRatios = {
				symbol: "INCOMPLETE",
				// No valuation ratios provided
				debtToEquity: 0.5,
				currentRatio: 2,
				quickRatio: 1.5,
				roe: 15,
				roa: 8,
				grossProfitMargin: 30,
				operatingMargin: 15,
				netProfitMargin: 10,
				dividendYield: 2,
				payoutRatio: 40,
				timestamp: Date.now(),
				source: "test",
				period: "ttm",
			};

			const features = FundamentalFeatureExtractor.extractFeatures(
				"INCOMPLETE",
				incompleteRatios
			);

			expect(features.valuation.peRatio).toBe(0);
			expect(features.valuation.pegRatio).toBe(0);
			expect(features.valuation.pbRatio).toBe(0);
			expect(features.valuation.priceToSales).toBe(0);
			expect(features.valuation.valuationScore).toBeGreaterThanOrEqual(0);
			expect(features.valuation.isPremiumValuation).toBe(false);
		});
	});

	describe("Profitability Features - Detailed Logic Tests", () => {
		it("should identify high quality company correctly", () => {
			const highQualityRatios: FundamentalRatios = {
				symbol: "QUALITY",
				peRatio: 20,
				pegRatio: 1.5,
				pbRatio: 3,
				priceToSales: 5,
				priceToFreeCashFlow: 15,
				debtToEquity: 0.3,
				currentRatio: 2.5,
				quickRatio: 2,
				roe: 25, // High ROE > 15%
				roa: 15,
				grossProfitMargin: 50,
				operatingMargin: 25, // Healthy operating margin > 15%
				netProfitMargin: 20, // Healthy net margin > 10%
				dividendYield: 2,
				payoutRatio: 40,
				timestamp: Date.now(),
				source: "test",
				period: "ttm",
			};

			const features = FundamentalFeatureExtractor.extractFeatures(
				"QUALITY",
				highQualityRatios
			);

			expect(features.profitability.isHighQuality).toBe(true);
			expect(features.profitability.profitabilityScore).toBeGreaterThan(0.6);
		});

		it("should identify low quality company correctly", () => {
			const lowQualityRatios: FundamentalRatios = {
				symbol: "LOWQUALITY",
				peRatio: 15,
				pegRatio: 1,
				pbRatio: 1,
				priceToSales: 1,
				priceToFreeCashFlow: 10,
				debtToEquity: 1,
				currentRatio: 1.5,
				quickRatio: 1,
				roe: 8, // Low ROE < 15%
				roa: 4,
				grossProfitMargin: 20,
				operatingMargin: 8, // Low operating margin < 15%
				netProfitMargin: 5, // Low net margin < 10%
				dividendYield: 4,
				payoutRatio: 80,
				timestamp: Date.now(),
				source: "test",
				period: "ttm",
			};

			const features = FundamentalFeatureExtractor.extractFeatures(
				"LOWQUALITY",
				lowQualityRatios
			);

			expect(features.profitability.isHighQuality).toBe(false);
			expect(features.profitability.profitabilityScore).toBeLessThan(0.5);
		});

		it("should calculate profitability score correctly for excellent company", () => {
			const excellentRatios: FundamentalRatios = {
				symbol: "EXCELLENT",
				peRatio: 25,
				pegRatio: 2,
				pbRatio: 4,
				priceToSales: 6,
				priceToFreeCashFlow: 20,
				debtToEquity: 0.2,
				currentRatio: 3,
				quickRatio: 2.5,
				roe: 35, // Excellent ROE (>30%)
				roa: 18, // Excellent ROA (>15%)
				grossProfitMargin: 60,
				operatingMargin: 35,
				netProfitMargin: 30, // Excellent net margin (>30%)
				dividendYield: 1.5,
				payoutRatio: 30,
				timestamp: Date.now(),
				source: "test",
				period: "ttm",
			};

			const features = FundamentalFeatureExtractor.extractFeatures(
				"EXCELLENT",
				excellentRatios
			);

			expect(features.profitability.profitabilityScore).toBeGreaterThan(0.8);
			expect(features.profitability.isHighQuality).toBe(true);
		});

		it("should handle negative profitability metrics", () => {
			const unprofitableRatios: FundamentalRatios = {
				symbol: "UNPROFITABLE",
				peRatio: -10, // Negative P/E (loss-making)
				pegRatio: 0,
				pbRatio: 0.5,
				priceToSales: 3,
				priceToFreeCashFlow: 0,
				debtToEquity: 2,
				currentRatio: 1.2,
				quickRatio: 0.8,
				roe: -15, // Negative ROE
				roa: -8, // Negative ROA
				grossProfitMargin: 10,
				operatingMargin: -5, // Negative operating margin
				netProfitMargin: -10, // Negative net margin
				dividendYield: 0,
				payoutRatio: 0,
				timestamp: Date.now(),
				source: "test",
				period: "ttm",
			};

			const features = FundamentalFeatureExtractor.extractFeatures(
				"UNPROFITABLE",
				unprofitableRatios
			);

			expect(features.profitability.profitabilityScore).toBeLessThan(0.3);
			expect(features.profitability.isHighQuality).toBe(false);
		});
	});

	describe("Financial Health Features - Detailed Logic Tests", () => {
		it("should identify financially stressed company", () => {
			const stressedRatios: FundamentalRatios = {
				symbol: "STRESSED",
				peRatio: 8,
				pegRatio: 0.5,
				pbRatio: 0.8,
				priceToSales: 0.5,
				priceToFreeCashFlow: 5,
				debtToEquity: 2.5, // High leverage > 1.5
				currentRatio: 1.1, // Weak liquidity < 1.2
				quickRatio: 0.7,
				roe: 5,
				roa: 2,
				grossProfitMargin: 15,
				operatingMargin: 5,
				netProfitMargin: 2,
				dividendYield: 0,
				payoutRatio: 0,
				timestamp: Date.now(),
				source: "test",
				period: "ttm",
			};

			const features = FundamentalFeatureExtractor.extractFeatures(
				"STRESSED",
				stressedRatios
			);

			expect(features.financialHealth.isFinanciallyStressed).toBe(true);
			expect(features.financialHealth.leverageRisk).toBeGreaterThan(0.7);
			expect(features.financialHealth.healthScore).toBeLessThan(0.4);
		});

		it("should identify financially healthy company", () => {
			const healthyRatios: FundamentalRatios = {
				symbol: "HEALTHY",
				peRatio: 22,
				pegRatio: 1.5,
				pbRatio: 3.5,
				priceToSales: 5,
				priceToFreeCashFlow: 18,
				debtToEquity: 0.3, // Low leverage
				currentRatio: 2.8, // Strong liquidity
				quickRatio: 2.2, // Strong quick ratio
				roe: 28,
				roa: 16,
				grossProfitMargin: 55,
				operatingMargin: 30,
				netProfitMargin: 25,
				dividendYield: 1.8,
				payoutRatio: 35,
				timestamp: Date.now(),
				source: "test",
				period: "ttm",
			};

			const features = FundamentalFeatureExtractor.extractFeatures("HEALTHY", healthyRatios);

			expect(features.financialHealth.isFinanciallyStressed).toBe(false);
			expect(features.financialHealth.leverageRisk).toBeLessThan(0.3);
			expect(features.financialHealth.liquidityStrength).toBeGreaterThan(0.7);
			expect(features.financialHealth.healthScore).toBeGreaterThan(0.7);
		});

		it("should calculate liquidity strength correctly", () => {
			const liquidRatios: FundamentalRatios = {
				symbol: "LIQUID",
				peRatio: 18,
				pegRatio: 1.2,
				pbRatio: 2.5,
				priceToSales: 4,
				priceToFreeCashFlow: 12,
				debtToEquity: 0.5,
				currentRatio: 3, // Strong current ratio (2+)
				quickRatio: 2, // Strong quick ratio (1.5+)
				roe: 20,
				roa: 12,
				grossProfitMargin: 45,
				operatingMargin: 22,
				netProfitMargin: 18,
				dividendYield: 2.5,
				payoutRatio: 45,
				timestamp: Date.now(),
				source: "test",
				period: "ttm",
			};

			const features = FundamentalFeatureExtractor.extractFeatures("LIQUID", liquidRatios);

			expect(features.financialHealth.liquidityStrength).toBeGreaterThan(0.8);
		});

		it("should calculate leverage risk correctly", () => {
			const highDebtRatios: FundamentalRatios = {
				symbol: "HIGHDEBT",
				peRatio: 12,
				pegRatio: 0.8,
				pbRatio: 1.8,
				priceToSales: 2,
				priceToFreeCashFlow: 8,
				debtToEquity: 3, // Very high leverage (>2 is high risk)
				currentRatio: 1.5,
				quickRatio: 1,
				roe: 12,
				roa: 6,
				grossProfitMargin: 25,
				operatingMargin: 12,
				netProfitMargin: 8,
				dividendYield: 3,
				payoutRatio: 60,
				timestamp: Date.now(),
				source: "test",
				period: "ttm",
			};

			const features = FundamentalFeatureExtractor.extractFeatures(
				"HIGHDEBT",
				highDebtRatios
			);

			expect(features.financialHealth.leverageRisk).toBeGreaterThan(0.9);
			expect(features.financialHealth.healthScore).toBeLessThan(0.5);
		});
	});

	describe("Shareholder Return Features - Detailed Logic Tests", () => {
		it("should identify income-focused stock", () => {
			const incomeRatios: FundamentalRatios = {
				symbol: "INCOME",
				peRatio: 12,
				pegRatio: 1,
				pbRatio: 2,
				priceToSales: 2,
				priceToFreeCashFlow: 10,
				debtToEquity: 0.8,
				currentRatio: 1.8,
				quickRatio: 1.3,
				roe: 15,
				roa: 8,
				grossProfitMargin: 35,
				operatingMargin: 18,
				netProfitMargin: 12,
				dividendYield: 4.5, // High dividend yield > 3%
				payoutRatio: 65,
				timestamp: Date.now(),
				source: "test",
				period: "ttm",
			};

			const features = FundamentalFeatureExtractor.extractFeatures("INCOME", incomeRatios);

			expect(features.shareholderReturn.isIncomeFocused).toBe(true);
			expect(features.shareholderReturn.dividendYield).toBeGreaterThan(3);
		});

		it("should calculate dividend sustainability correctly for optimal payout", () => {
			const sustainableRatios: FundamentalRatios = {
				symbol: "SUSTAINABLE",
				peRatio: 18,
				pegRatio: 1.3,
				pbRatio: 2.8,
				priceToSales: 4,
				priceToFreeCashFlow: 14,
				debtToEquity: 0.4,
				currentRatio: 2.2,
				quickRatio: 1.7,
				roe: 22,
				roa: 13,
				grossProfitMargin: 48,
				operatingMargin: 24,
				netProfitMargin: 18,
				dividendYield: 2.5,
				payoutRatio: 50, // Optimal payout ratio (40-60%)
				timestamp: Date.now(),
				source: "test",
				period: "ttm",
			};

			const features = FundamentalFeatureExtractor.extractFeatures(
				"SUSTAINABLE",
				sustainableRatios
			);

			expect(features.shareholderReturn.dividendSustainability).toBeGreaterThan(0.8);
		});

		it("should calculate dividend sustainability correctly for high payout", () => {
			const highPayoutRatios: FundamentalRatios = {
				symbol: "HIGHPAYOUT",
				peRatio: 10,
				pegRatio: 0.7,
				pbRatio: 1.5,
				priceToSales: 1.5,
				priceToFreeCashFlow: 7,
				debtToEquity: 1,
				currentRatio: 1.5,
				quickRatio: 1,
				roe: 10,
				roa: 5,
				grossProfitMargin: 28,
				operatingMargin: 14,
				netProfitMargin: 9,
				dividendYield: 5,
				payoutRatio: 95, // Unsustainably high payout ratio (>80% falls back to 0.5)
				timestamp: Date.now(),
				source: "test",
				period: "ttm",
			};

			const features = FundamentalFeatureExtractor.extractFeatures(
				"HIGHPAYOUT",
				highPayoutRatios
			);

			// Payout ratio > 80% gets default sustainability of 0.5 per implementation
			expect(features.shareholderReturn.dividendSustainability).toBe(0.5);
		});

		it("should calculate dividend growth potential correctly", () => {
			const growthPotentialRatios: FundamentalRatios = {
				symbol: "GROWTH",
				peRatio: 24,
				pegRatio: 1.8,
				pbRatio: 4,
				priceToSales: 6,
				priceToFreeCashFlow: 20,
				debtToEquity: 0.2,
				currentRatio: 2.8,
				quickRatio: 2.3,
				roe: 30,
				roa: 18,
				grossProfitMargin: 58,
				operatingMargin: 32,
				netProfitMargin: 26,
				dividendYield: 1.2,
				payoutRatio: 25, // Low payout ratio = high growth potential
				timestamp: Date.now(),
				source: "test",
				period: "ttm",
			};

			const features = FundamentalFeatureExtractor.extractFeatures(
				"GROWTH",
				growthPotentialRatios
			);

			expect(features.shareholderReturn.dividendGrowthPotential).toBeGreaterThan(0.5);
		});

		it("should handle non-dividend paying stock", () => {
			const noDividendRatios: FundamentalRatios = {
				symbol: "NODIV",
				peRatio: 35,
				pegRatio: 2.5,
				pbRatio: 6,
				priceToSales: 10,
				priceToFreeCashFlow: 30,
				debtToEquity: 0.1,
				currentRatio: 3.5,
				quickRatio: 3,
				roe: 32,
				roa: 20,
				grossProfitMargin: 65,
				operatingMargin: 38,
				netProfitMargin: 30,
				dividendYield: 0,
				payoutRatio: 0,
				timestamp: Date.now(),
				source: "test",
				period: "ttm",
			};

			const features = FundamentalFeatureExtractor.extractFeatures("NODIV", noDividendRatios);

			expect(features.shareholderReturn.dividendYield).toBe(0);
			expect(features.shareholderReturn.payoutRatio).toBe(0);
			expect(features.shareholderReturn.isIncomeFocused).toBe(false);
			expect(features.shareholderReturn.dividendGrowthPotential).toBe(0);
		});
	});

	describe("Data Completeness Calculation", () => {
		it("should calculate 100% completeness for fully populated ratios", () => {
			const completeRatios: FundamentalRatios = {
				symbol: "COMPLETE",
				peRatio: 20,
				pegRatio: 1.5,
				pbRatio: 3,
				priceToSales: 5,
				priceToFreeCashFlow: 15,
				debtToEquity: 0.5,
				currentRatio: 2,
				quickRatio: 1.5,
				roe: 20,
				roa: 10,
				grossProfitMargin: 40,
				operatingMargin: 25,
				netProfitMargin: 20,
				dividendYield: 2,
				payoutRatio: 40,
				timestamp: Date.now(),
				source: "test",
				period: "ttm",
			};

			const features = FundamentalFeatureExtractor.extractFeatures(
				"COMPLETE",
				completeRatios
			);

			expect(features.dataCompleteness).toBe(1.0);
		});

		it("should calculate 0% completeness for empty ratios", () => {
			const emptyRatios: FundamentalRatios = {
				symbol: "EMPTY",
				timestamp: Date.now(),
				source: "test",
				period: "ttm",
			};

			const features = FundamentalFeatureExtractor.extractFeatures("EMPTY", emptyRatios);

			expect(features.dataCompleteness).toBe(0);
		});

		it("should calculate partial completeness correctly", () => {
			const partialRatios: FundamentalRatios = {
				symbol: "PARTIAL",
				peRatio: 20,
				pbRatio: 3,
				priceToSales: 5,
				// Missing: pegRatio, priceToFreeCashFlow
				debtToEquity: 0.5,
				currentRatio: 2,
				quickRatio: 1.5,
				roe: 20,
				roa: 10,
				// Missing: grossProfitMargin, operatingMargin, netProfitMargin
				dividendYield: 2,
				payoutRatio: 40,
				timestamp: Date.now(),
				source: "test",
				period: "ttm",
			};

			const features = FundamentalFeatureExtractor.extractFeatures("PARTIAL", partialRatios);

			// 10 out of 15 fields = 0.667
			expect(features.dataCompleteness).toBeGreaterThan(0.6);
			expect(features.dataCompleteness).toBeLessThan(0.7);
		});

		it("should not count NaN values as complete", () => {
			const nanRatios: FundamentalRatios = {
				symbol: "NAN",
				peRatio: NaN,
				pegRatio: NaN,
				pbRatio: 3,
				priceToSales: 5,
				priceToFreeCashFlow: 15,
				debtToEquity: 0.5,
				currentRatio: 2,
				quickRatio: 1.5,
				roe: 20,
				roa: 10,
				grossProfitMargin: 40,
				operatingMargin: 25,
				netProfitMargin: 20,
				dividendYield: 2,
				payoutRatio: 40,
				timestamp: Date.now(),
				source: "test",
				period: "ttm",
			};

			const features = FundamentalFeatureExtractor.extractFeatures("NAN", nanRatios);

			// Should exclude 2 NaN fields
			expect(features.dataCompleteness).toBeLessThan(1.0);
			expect(features.dataCompleteness).toBeCloseTo(13 / 15, 2);
		});
	});

	describe("Default Features", () => {
		it("should return default features with correct structure", () => {
			const defaultFeatures = FundamentalFeatureExtractor.getDefaultFeatures("TEST");

			expect(defaultFeatures.symbol).toBe("TEST");
			expect(defaultFeatures.timestamp).toBeDefined();
			expect(defaultFeatures.valuation).toBeDefined();
			expect(defaultFeatures.profitability).toBeDefined();
			expect(defaultFeatures.financialHealth).toBeDefined();
			expect(defaultFeatures.shareholderReturn).toBeDefined();
			expect(defaultFeatures.dataCompleteness).toBe(0);
			expect(defaultFeatures.source).toBe("default");
		});

		it("should return neutral values for default valuation features", () => {
			const defaultFeatures = FundamentalFeatureExtractor.getDefaultFeatures("TEST");

			expect(defaultFeatures.valuation.peRatio).toBe(0);
			expect(defaultFeatures.valuation.pegRatio).toBe(0);
			expect(defaultFeatures.valuation.pbRatio).toBe(0);
			expect(defaultFeatures.valuation.priceToSales).toBe(0);
			expect(defaultFeatures.valuation.valuationScore).toBe(0.5);
			expect(defaultFeatures.valuation.isPremiumValuation).toBe(false);
			expect(defaultFeatures.valuation.relativeValuation).toBe(0.5);
		});

		it("should return neutral values for default profitability features", () => {
			const defaultFeatures = FundamentalFeatureExtractor.getDefaultFeatures("TEST");

			expect(defaultFeatures.profitability.roe).toBe(0);
			expect(defaultFeatures.profitability.roa).toBe(0);
			expect(defaultFeatures.profitability.grossProfitMargin).toBe(0);
			expect(defaultFeatures.profitability.operatingMargin).toBe(0);
			expect(defaultFeatures.profitability.netProfitMargin).toBe(0);
			expect(defaultFeatures.profitability.profitabilityScore).toBe(0);
			expect(defaultFeatures.profitability.marginTrend).toBe(0);
			expect(defaultFeatures.profitability.isHighQuality).toBe(false);
		});

		it("should return neutral values for default financial health features", () => {
			const defaultFeatures = FundamentalFeatureExtractor.getDefaultFeatures("TEST");

			expect(defaultFeatures.financialHealth.debtToEquity).toBe(0);
			expect(defaultFeatures.financialHealth.currentRatio).toBe(1);
			expect(defaultFeatures.financialHealth.quickRatio).toBe(1);
			expect(defaultFeatures.financialHealth.healthScore).toBe(0.5);
			expect(defaultFeatures.financialHealth.leverageRisk).toBe(0);
			expect(defaultFeatures.financialHealth.liquidityStrength).toBe(0.5);
			expect(defaultFeatures.financialHealth.isFinanciallyStressed).toBe(false);
		});

		it("should return neutral values for default shareholder return features", () => {
			const defaultFeatures = FundamentalFeatureExtractor.getDefaultFeatures("TEST");

			expect(defaultFeatures.shareholderReturn.dividendYield).toBe(0);
			expect(defaultFeatures.shareholderReturn.payoutRatio).toBe(0);
			expect(defaultFeatures.shareholderReturn.dividendSustainability).toBe(0.5);
			expect(defaultFeatures.shareholderReturn.isIncomeFocused).toBe(false);
			expect(defaultFeatures.shareholderReturn.dividendGrowthPotential).toBe(0);
		});
	});

	describe("Performance Requirements", () => {
		it("should meet <100ms extraction target for typical data", () => {
			const typicalRatios: FundamentalRatios = {
				symbol: "PERF",
				peRatio: 22,
				pegRatio: 1.5,
				pbRatio: 3.5,
				priceToSales: 5,
				priceToFreeCashFlow: 18,
				debtToEquity: 0.6,
				currentRatio: 2.2,
				quickRatio: 1.7,
				roe: 23,
				roa: 13,
				grossProfitMargin: 48,
				operatingMargin: 24,
				netProfitMargin: 18,
				dividendYield: 2.2,
				payoutRatio: 42,
				timestamp: Date.now(),
				source: "test",
				period: "ttm",
			};

			const startTime = Date.now();
			const features = FundamentalFeatureExtractor.extractFeatures("PERF", typicalRatios);
			const elapsedTime = Date.now() - startTime;

			console.log(`Feature extraction time: ${elapsedTime}ms (target: <100ms)`);

			expect(features).toBeDefined();
			expect(elapsedTime).toBeLessThan(100);
		});

		it("should handle batch extraction efficiently", () => {
			const testSymbols = ["AAPL", "MSFT", "GOOGL", "AMZN", "META"];
			const testRatios: FundamentalRatios = {
				symbol: "TEST",
				peRatio: 20,
				pegRatio: 1.5,
				pbRatio: 3,
				priceToSales: 5,
				priceToFreeCashFlow: 15,
				debtToEquity: 0.5,
				currentRatio: 2,
				quickRatio: 1.5,
				roe: 20,
				roa: 10,
				grossProfitMargin: 40,
				operatingMargin: 25,
				netProfitMargin: 20,
				dividendYield: 2,
				payoutRatio: 40,
				timestamp: Date.now(),
				source: "test",
				period: "ttm",
			};

			const startTime = Date.now();

			for (const symbol of testSymbols) {
				FundamentalFeatureExtractor.extractFeatures(symbol, { ...testRatios, symbol });
			}

			const elapsedTime = Date.now() - startTime;
			const avgTime = elapsedTime / testSymbols.length;

			console.log(
				`Average extraction time: ${avgTime.toFixed(2)}ms (${testSymbols.length} symbols)`
			);

			expect(avgTime).toBeLessThan(100);
		});

		it("should meet performance target with real API data", async () => {
			const ratios = await fmpApi.getFundamentalRatios("AAPL");
			expect(ratios).not.toBeNull();

			const startTime = Date.now();
			const features = FundamentalFeatureExtractor.extractFeatures("AAPL", ratios!);
			const elapsedTime = Date.now() - startTime;

			console.log(`Real API extraction time: ${elapsedTime}ms (target: <100ms)`);

			expect(features).toBeDefined();
			expect(elapsedTime).toBeLessThan(100);
		}, 30000);
	});

	describe("Edge Cases and Error Handling", () => {
		it("should handle extreme valuation ratios", () => {
			const extremeRatios: FundamentalRatios = {
				symbol: "EXTREME",
				peRatio: 1000,
				pegRatio: 50,
				pbRatio: 100,
				priceToSales: 200,
				priceToFreeCashFlow: 500,
				debtToEquity: 10,
				currentRatio: 0.1,
				quickRatio: 0.05,
				roe: 100,
				roa: 50,
				grossProfitMargin: 99,
				operatingMargin: 95,
				netProfitMargin: 90,
				dividendYield: 20,
				payoutRatio: 200,
				timestamp: Date.now(),
				source: "test",
				period: "ttm",
			};

			const features = FundamentalFeatureExtractor.extractFeatures("EXTREME", extremeRatios);

			expect(features).toBeDefined();
			expect(features.valuation.valuationScore).toBeGreaterThanOrEqual(0);
			expect(features.valuation.valuationScore).toBeLessThanOrEqual(1);
			expect(features.profitability.profitabilityScore).toBeGreaterThanOrEqual(0);
			expect(features.profitability.profitabilityScore).toBeLessThanOrEqual(1);
		});

		it("should handle zero ratios", () => {
			const zeroRatios: FundamentalRatios = {
				symbol: "ZERO",
				peRatio: 0,
				pegRatio: 0,
				pbRatio: 0,
				priceToSales: 0,
				priceToFreeCashFlow: 0,
				debtToEquity: 0,
				currentRatio: 0,
				quickRatio: 0,
				roe: 0,
				roa: 0,
				grossProfitMargin: 0,
				operatingMargin: 0,
				netProfitMargin: 0,
				dividendYield: 0,
				payoutRatio: 0,
				timestamp: Date.now(),
				source: "test",
				period: "ttm",
			};

			const features = FundamentalFeatureExtractor.extractFeatures("ZERO", zeroRatios);

			expect(features).toBeDefined();
			expect(features.dataCompleteness).toBe(1.0); // Zero is valid data
			expect(features.valuation.valuationScore).toBeDefined();
			expect(features.profitability.profitabilityScore).toBeDefined();
		});

		it("should handle mixed valid and invalid data", () => {
			const mixedRatios: FundamentalRatios = {
				symbol: "MIXED",
				peRatio: 20,
				pegRatio: undefined,
				pbRatio: 3,
				priceToSales: null as any,
				priceToFreeCashFlow: NaN,
				debtToEquity: 0.5,
				currentRatio: 2,
				quickRatio: undefined,
				roe: 20,
				roa: null as any,
				grossProfitMargin: 40,
				operatingMargin: NaN,
				netProfitMargin: 20,
				dividendYield: 2,
				payoutRatio: undefined,
				timestamp: Date.now(),
				source: "test",
				period: "ttm",
			};

			const features = FundamentalFeatureExtractor.extractFeatures("MIXED", mixedRatios);

			expect(features).toBeDefined();
			expect(features.dataCompleteness).toBeGreaterThan(0);
			expect(features.dataCompleteness).toBeLessThan(1);
		});

		it("should preserve symbol and source metadata", () => {
			const testRatios: FundamentalRatios = {
				symbol: "METADATA",
				peRatio: 20,
				pegRatio: 1.5,
				pbRatio: 3,
				priceToSales: 5,
				priceToFreeCashFlow: 15,
				debtToEquity: 0.5,
				currentRatio: 2,
				quickRatio: 1.5,
				roe: 20,
				roa: 10,
				grossProfitMargin: 40,
				operatingMargin: 25,
				netProfitMargin: 20,
				dividendYield: 2,
				payoutRatio: 40,
				timestamp: Date.now(),
				source: "fmp",
				period: "ttm",
			};

			const features = FundamentalFeatureExtractor.extractFeatures("METADATA", testRatios);

			expect(features.symbol).toBe("METADATA");
			expect(features.source).toBe("fmp");
			expect(features.timestamp).toBeDefined();
			expect(features.timestamp).toBeLessThanOrEqual(Date.now());
		});
	});

	describe("Feature Consistency", () => {
		it("should produce consistent results for same input", () => {
			const testRatios: FundamentalRatios = {
				symbol: "CONSISTENT",
				peRatio: 22,
				pegRatio: 1.5,
				pbRatio: 3.5,
				priceToSales: 5,
				priceToFreeCashFlow: 18,
				debtToEquity: 0.6,
				currentRatio: 2.2,
				quickRatio: 1.7,
				roe: 23,
				roa: 13,
				grossProfitMargin: 48,
				operatingMargin: 24,
				netProfitMargin: 18,
				dividendYield: 2.2,
				payoutRatio: 42,
				timestamp: Date.now(),
				source: "test",
				period: "ttm",
			};

			const features1 = FundamentalFeatureExtractor.extractFeatures("CONSISTENT", testRatios);
			const features2 = FundamentalFeatureExtractor.extractFeatures("CONSISTENT", testRatios);

			expect(features1.valuation.valuationScore).toBe(features2.valuation.valuationScore);
			expect(features1.profitability.profitabilityScore).toBe(
				features2.profitability.profitabilityScore
			);
			expect(features1.financialHealth.healthScore).toBe(
				features2.financialHealth.healthScore
			);
			expect(features1.dataCompleteness).toBe(features2.dataCompleteness);
		});

		it("should ensure relativeValuation is inverse of valuationScore", () => {
			const testRatios: FundamentalRatios = {
				symbol: "INVERSE",
				peRatio: 25,
				pegRatio: 2,
				pbRatio: 4,
				priceToSales: 6,
				priceToFreeCashFlow: 20,
				debtToEquity: 0.5,
				currentRatio: 2,
				quickRatio: 1.5,
				roe: 20,
				roa: 10,
				grossProfitMargin: 40,
				operatingMargin: 25,
				netProfitMargin: 20,
				dividendYield: 2,
				payoutRatio: 40,
				timestamp: Date.now(),
				source: "test",
				period: "ttm",
			};

			const features = FundamentalFeatureExtractor.extractFeatures("INVERSE", testRatios);

			const sum = features.valuation.valuationScore + features.valuation.relativeValuation;
			expect(sum).toBeCloseTo(1.0, 10);
		});

		it("should ensure healthScore reflects leverage and liquidity correctly", () => {
			const testRatios: FundamentalRatios = {
				symbol: "HEALTH",
				peRatio: 20,
				pegRatio: 1.5,
				pbRatio: 3,
				priceToSales: 5,
				priceToFreeCashFlow: 15,
				debtToEquity: 0.5,
				currentRatio: 2,
				quickRatio: 1.5,
				roe: 20,
				roa: 10,
				grossProfitMargin: 40,
				operatingMargin: 25,
				netProfitMargin: 20,
				dividendYield: 2,
				payoutRatio: 40,
				timestamp: Date.now(),
				source: "test",
				period: "ttm",
			};

			const features = FundamentalFeatureExtractor.extractFeatures("HEALTH", testRatios);

			// Health score should be average of (1 - leverageRisk) and liquidityStrength
			const expectedHealth =
				(1 -
					features.financialHealth.leverageRisk +
					features.financialHealth.liquidityStrength) /
				2;
			expect(features.financialHealth.healthScore).toBeCloseTo(expectedHealth, 10);
		});
	});
});
