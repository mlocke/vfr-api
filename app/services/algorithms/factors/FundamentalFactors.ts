/**
 * Fundamental Factors Module
 * Contains all fundamental valuation and quality calculations for the Factor Library
 */

import { RedisCache } from "../../cache/RedisCache";
import { getSectorBenchmarks, calculatePercentileScore } from "../SectorBenchmarks";

interface MarketDataPoint {
	symbol: string;
	price: number;
	volume: number;
	marketCap: number;
	sector: string;
	exchange: string;
	timestamp: number;
}

interface FundamentalDataPoint {
	symbol: string;
	peRatio?: number;
	pbRatio?: number;
	debtToEquity?: number;
	roe?: number;
	revenueGrowth?: number;
	currentRatio?: number;
	operatingMargin?: number;
	netProfitMargin?: number;
	grossProfitMargin?: number;
	priceToSales?: number;
	evEbitda?: number;
	evToEbitda?: number;
	interestCoverage?: number;
	earningsGrowth?: number;
	dividendYield?: number;
	payoutRatio?: number;
	dividendGrowth?: number;
	revenueGrowthQoQ?: number;
	revenueGrowthYoY?: number;
	revenue?: number;
	[key: string]: any;
}

export class FundamentalFactors {
	private cache: RedisCache;

	constructor(cache: RedisCache) {
		this.cache = cache;
	}

	// ==================== VALUE CALCULATIONS ====================

	calculatePEScore(peRatio?: number, sector?: string): number | null {
		if (!peRatio || peRatio <= 0) return null;

		const benchmarks = getSectorBenchmarks(sector);
		return calculatePercentileScore(peRatio, benchmarks.peRatio);
	}

	calculatePBScore(pbRatio?: number, sector?: string): number | null {
		if (!pbRatio || pbRatio <= 0) return null;

		const benchmarks = getSectorBenchmarks(sector);
		return calculatePercentileScore(pbRatio, benchmarks.pbRatio);
	}

	calculateEVEBITDAScore(
		fundamentalData?: FundamentalDataPoint,
		sector?: string
	): number | null {
		const evEbitda = fundamentalData?.evEbitda || fundamentalData?.evToEbitda;

		if (!evEbitda || evEbitda <= 0) return null;

		const benchmarks = getSectorBenchmarks(sector);
		return calculatePercentileScore(evEbitda, benchmarks.evEbitda);
	}

	calculatePriceToSalesScore(
		fundamentalData?: FundamentalDataPoint,
		marketData?: MarketDataPoint
	): number | null {
		if (!fundamentalData?.revenue || !marketData?.marketCap) return null;
		if (fundamentalData.revenue <= 0) return null;

		const priceToSales = marketData.marketCap / fundamentalData.revenue;

		// Lower P/S ratios get higher scores
		const normalizedPS = Math.max(0, Math.min(10, priceToSales));
		return 1 - normalizedPS / 10;
	}

	calculatePEGScore(
		fundamentalData?: FundamentalDataPoint,
		sector?: string
	): number | null {
		const peRatio = fundamentalData?.peRatio;
		const earningsGrowth = fundamentalData?.earningsGrowth || fundamentalData?.revenueGrowth;

		if (!peRatio || peRatio <= 0 || !earningsGrowth || earningsGrowth <= 0) {
			return null;
		}

		// Calculate PEG ratio
		const growthRate = earningsGrowth > 1 ? earningsGrowth / 100 : earningsGrowth;
		const pegRatio = peRatio / (growthRate * 100);

		// Get sector-specific PEG benchmarks
		const benchmarks = getSectorBenchmarks(sector);
		const pegBenchmarks = benchmarks.pegRatio;

		// Scoring logic
		if (pegRatio < 0.5) {
			return 1.0;
		} else if (pegRatio < 1.0) {
			return 1.0 - (pegRatio - 0.5) * 0.2;
		} else if (pegRatio <= pegBenchmarks.p25) {
			const range = pegBenchmarks.p25 - 1.0;
			const position = (pegRatio - 1.0) / range;
			return 0.9 - position * 0.15;
		} else if (pegRatio <= pegBenchmarks.median) {
			const range = pegBenchmarks.median - pegBenchmarks.p25;
			const position = (pegRatio - pegBenchmarks.p25) / range;
			return 0.75 - position * 0.15;
		} else if (pegRatio <= pegBenchmarks.p75) {
			const range = pegBenchmarks.p75 - pegBenchmarks.median;
			const position = (pegRatio - pegBenchmarks.median) / range;
			return 0.6 - position * 0.3;
		} else {
			const excessRatio = Math.min(2.0, (pegRatio - pegBenchmarks.p75) / pegBenchmarks.p75);
			return Math.max(0, 0.3 - excessRatio * 0.3);
		}
	}

	calculatePriceToSalesDirectScore(priceToSalesRatio?: number): number | null {
		if (
			priceToSalesRatio === undefined ||
			priceToSalesRatio <= 0 ||
			!isFinite(priceToSalesRatio)
		)
			return null;

		// Lower P/S ratios get higher scores
		const normalizedPS = Math.max(0.1, Math.min(15, priceToSalesRatio));
		const score = Math.max(0, Math.min(1, 1 - (normalizedPS - 0.1) / 14.9));

		return score;
	}

	// ==================== QUALITY CALCULATIONS ====================

	calculateROEScore(roe?: number): number | null {
		if (roe === undefined || !isFinite(roe)) return null;

		// Higher ROE gets higher scores
		const normalizedROE = Math.max(-0.5, Math.min(0.5, roe));
		const score = Math.max(0, Math.min(1, (normalizedROE + 0.5) / 1.0));

		return score;
	}

	calculateDebtToEquityScore(debtToEquity?: number): number | null {
		if (debtToEquity === undefined || debtToEquity < 0 || !isFinite(debtToEquity)) return null;

		// Lower debt-to-equity ratios get higher scores
		const normalizedDE = Math.max(0, Math.min(5, debtToEquity));
		const score = Math.max(0, Math.min(1, 1 - normalizedDE / 5));

		return score;
	}

	calculateCurrentRatioScore(fundamentalData?: FundamentalDataPoint): number | null {
		if (!fundamentalData?.currentRatio || !isFinite(fundamentalData.currentRatio)) return null;

		const currentRatio = fundamentalData.currentRatio;

		if (currentRatio < 0.5) return 0;
		if (currentRatio < 1) return 0.2;
		if (currentRatio > 10) return 0.3;

		// Optimal current ratio is around 1.5-4
		if (currentRatio >= 1.5 && currentRatio <= 4) {
			return Math.min(1, 0.8 + (Math.min(currentRatio, 2.5) - 1.5) * 0.2);
		}

		if (currentRatio < 1.5) {
			return Math.max(0.2, (currentRatio / 1.5) * 0.8);
		}

		// currentRatio > 4
		return Math.max(0.3, 1 - ((currentRatio - 4) / 6) * 0.7);
	}

	calculateInterestCoverageScore(fundamentalData?: FundamentalDataPoint): number | null {
		if (!fundamentalData?.interestCoverage) return null;

		const coverage = fundamentalData.interestCoverage;

		if (coverage < 1) return 0;
		if (coverage > 10) return 1;

		return Math.min(1, coverage / 10);
	}

	calculateOperatingMarginScore(operatingMargin?: number): number | null {
		if (operatingMargin === undefined) return null;

		// Higher operating margin is better
		const normalizedMargin = Math.max(0, Math.min(0.3, operatingMargin));
		return normalizedMargin / 0.3;
	}

	calculateNetMarginScore(netMargin?: number): number | null {
		if (netMargin === undefined) return null;

		// Higher net profit margin is better
		const normalizedMargin = Math.max(0, Math.min(0.25, netMargin));
		return normalizedMargin / 0.25;
	}

	// ==================== GROWTH CALCULATIONS ====================

	calculateRevenueGrowthScore(revenueGrowth?: number): number | null {
		if (revenueGrowth === undefined) return null;

		// Higher growth gets higher scores
		const normalizedGrowth = Math.max(-0.2, Math.min(0.5, revenueGrowth));
		return (normalizedGrowth + 0.2) / 0.7;
	}

	calculateEarningsGrowthScore(fundamentalData?: FundamentalDataPoint): number | null {
		if (!fundamentalData?.earningsGrowth) return null;

		const earningsGrowth = fundamentalData.earningsGrowth;

		if (earningsGrowth < -1) return 0;

		const normalizedGrowth = Math.max(-1, Math.min(1, earningsGrowth));
		return (normalizedGrowth + 1) / 2;
	}

	calculateRevenueAccelerationScore(
		fundamentalData?: FundamentalDataPoint
	): number | null {
		if (!fundamentalData?.revenueGrowthQoQ || !fundamentalData?.revenueGrowthYoY) return null;

		const qoqGrowth = fundamentalData.revenueGrowthQoQ;
		const yoyGrowth = fundamentalData.revenueGrowthYoY;

		// Revenue acceleration = QoQ growth > YoY growth
		const acceleration = qoqGrowth - yoyGrowth;

		// Normalize acceleration score
		return 1 / (1 + Math.exp(-acceleration * 10));
	}

	// ==================== DIVIDEND CALCULATIONS ====================

	calculateDividendYieldScore(fundamentalData?: FundamentalDataPoint): number | null {
		if (!fundamentalData?.dividendYield) return null;

		const dividendYield = fundamentalData.dividendYield;

		// Higher dividend yield gets higher scores
		const normalizedYield = Math.max(0, Math.min(0.08, dividendYield));
		return normalizedYield / 0.08;
	}

	calculateDividendGrowthScore(fundamentalData?: FundamentalDataPoint): number | null {
		if (!fundamentalData?.dividendGrowth) return null;

		const dividendGrowth = fundamentalData.dividendGrowth;

		// Higher dividend growth gets higher scores
		const normalizedGrowth = Math.max(-0.1, Math.min(0.2, dividendGrowth));
		return (normalizedGrowth + 0.1) / 0.3;
	}

	calculatePayoutRatioScore(fundamentalData?: FundamentalDataPoint): number | null {
		if (!fundamentalData?.payoutRatio) return null;

		const payoutRatio = fundamentalData.payoutRatio;

		if (payoutRatio < 0 || payoutRatio > 1) return 0;

		// Peak score around 0.4-0.6
		if (payoutRatio >= 0.4 && payoutRatio <= 0.6) return 1;

		if (payoutRatio < 0.4) return payoutRatio / 0.4;
		return 1 - (payoutRatio - 0.6) / 0.4;
	}

	// ==================== COMPOSITE CALCULATIONS ====================

	calculateQualityComposite(fundamentalData?: FundamentalDataPoint): number | null {
		if (!fundamentalData) {
			console.warn("No fundamental data available for quality composite calculation");
			return null;
		}

		console.log(`Calculating quality composite for data:`, {
			roe: fundamentalData.roe,
			debtToEquity: fundamentalData.debtToEquity,
			currentRatio: fundamentalData.currentRatio,
			operatingMargin: fundamentalData.operatingMargin,
			netProfitMargin: fundamentalData.netProfitMargin,
			grossProfitMargin: fundamentalData.grossProfitMargin,
		});

		const factors: { name: string; value: number | null; weight: number }[] = [
			{ name: "ROE", value: this.calculateROEScore(fundamentalData.roe), weight: 0.3 },
			{
				name: "Debt/Equity",
				value: this.calculateDebtToEquityScore(fundamentalData.debtToEquity),
				weight: 0.25,
			},
			{
				name: "Current Ratio",
				value: this.calculateCurrentRatioScore(fundamentalData),
				weight: 0.2,
			},
			{
				name: "Operating Margin",
				value: this.calculateOperatingMarginScore(fundamentalData.operatingMargin),
				weight: 0.15,
			},
			{
				name: "Net Margin",
				value: this.calculateNetMarginScore(fundamentalData.netProfitMargin),
				weight: 0.1,
			},
		];

		let totalScore = 0;
		let totalWeight = 0;
		const validFactors: string[] = [];

		factors.forEach(factor => {
			if (factor.value !== null) {
				totalScore += factor.value * factor.weight;
				totalWeight += factor.weight;
				validFactors.push(`${factor.name}=${factor.value.toFixed(3)}`);
				console.log(
					`  ✓ ${factor.name}: ${factor.value.toFixed(3)} (weight: ${factor.weight})`
				);
			} else {
				console.log(`  ✗ ${factor.name}: null (skipped)`);
			}
		});

		if (totalWeight === 0 || validFactors.length === 0) {
			console.warn("Quality composite: No valid fundamental metrics found");
			return null;
		}

		const compositeScore = totalScore / totalWeight;
		console.log(
			`Quality Composite: ${compositeScore.toFixed(3)} (based on ${validFactors.length}/${factors.length} metrics)`
		);
		console.log(`  Valid factors: ${validFactors.join(", ")}`);

		return compositeScore;
	}

	calculateValueComposite(
		fundamentalData?: FundamentalDataPoint,
		marketData?: MarketDataPoint
	): number | null {
		if (!fundamentalData || !marketData) {
			console.warn(
				"Value composite requires both fundamental and market data - missing data:",
				{
					hasFundamental: !!fundamentalData,
					hasMarket: !!marketData,
				}
			);
			return null;
		}

		console.log(`Calculating value composite for ${marketData.symbol} in ${marketData.sector}`);

		const factors: { name: string; value: number | null; weight: number }[] = [
			{
				name: "P/E Ratio",
				value: this.calculatePEScore(fundamentalData.peRatio, marketData.sector),
				weight: 0.35,
			},
			{
				name: "P/B Ratio",
				value: this.calculatePBScore(fundamentalData.pbRatio, marketData.sector),
				weight: 0.25,
			},
			{
				name: "EV/EBITDA",
				value: this.calculateEVEBITDAScore(fundamentalData, marketData.sector),
				weight: 0.25,
			},
			{
				name: "Price/Sales",
				value: this.calculatePriceToSalesScore(fundamentalData, marketData),
				weight: 0.15,
			},
		];

		let totalScore = 0;
		let totalWeight = 0;
		const validFactors: string[] = [];
		const invalidFactors: string[] = [];

		factors.forEach(factor => {
			if (factor.value !== null && isFinite(factor.value)) {
				totalScore += factor.value * factor.weight;
				totalWeight += factor.weight;
				validFactors.push(`${factor.name}=${factor.value.toFixed(3)}`);
				console.log(
					`  ✓ ${factor.name}: ${factor.value.toFixed(3)} (weight: ${factor.weight})`
				);
			} else {
				invalidFactors.push(factor.name);
				console.log(`  ✗ ${factor.name}: ${factor.value} (skipped)`);
			}
		});

		if (totalWeight === 0) {
			console.warn(
				`Value composite calculation failed: No valid valuation metrics for ${marketData.symbol}`,
				{
					invalidFactors,
					fundamentalData: {
						peRatio: fundamentalData.peRatio,
						pbRatio: fundamentalData.pbRatio,
						evEbitda: fundamentalData.evEbitda,
						evToEbitda: fundamentalData.evToEbitda,
						revenue: fundamentalData.revenue,
					},
					marketData: {
						marketCap: marketData.marketCap,
					},
				}
			);
			return null;
		}

		const compositeScore = totalScore / totalWeight;

		console.log(
			`Value Composite for ${marketData.symbol}: ${compositeScore.toFixed(3)} (based on ${validFactors.length}/${factors.length} metrics)`
		);
		if (invalidFactors.length > 0) {
			console.log(`  Missing factors: ${invalidFactors.join(", ")}`);
		}
		console.log(`  Valid factors: ${validFactors.join(", ")}`);

		return compositeScore;
	}
}
