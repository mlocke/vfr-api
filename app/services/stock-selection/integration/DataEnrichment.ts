/**
 * Data Enrichment Module
 * Handles data enrichment, score calculations, and transformations for stock selection
 * Extracted from StockSelectionService to reduce file size and improve maintainability
 */

import { StockScore } from "../../algorithms/types";
import { SelectionOptions } from "../types";

/**
 * Additional stock data interface
 */
export interface AdditionalStockData {
	sector?: string;
	priceChange24h?: number;
	volumeChange24h?: number;
	beta?: number;
	analystData?: any;
	priceTargets?: any;
	fundamentalRatios?: any;
	vwapAnalysis?: any;
	sourceBreakdown?: any;
}

/**
 * DataEnrichment class
 * Centralizes all data enrichment and transformation logic
 */
export class DataEnrichment {
	/**
	 * Extract primary factors from stock score for utilization tracking
	 */
	extractPrimaryFactors(stockScore: StockScore): string[] {
		const factors = Object.entries(stockScore.factorScores)
			.sort(([, a], [, b]) => b - a)
			.slice(0, 3)
			.map(([factor]) => factor);

		// Enhanced factor mapping for utilization tracking
		const enhancedFactors: string[] = [];

		factors.forEach(factor => {
			enhancedFactors.push(factor);

			// Map composite factors to their underlying service types
			if (factor === "quality_composite" || factor === "value_composite") {
				enhancedFactors.push("fundamentalData", "fundamentals");
			}
			if (factor === "momentum_composite") {
				enhancedFactors.push("technicalAnalysis", "technical");
			}
			if (factor === "composite" && Object.keys(stockScore.factorScores).length === 1) {
				// Main composite includes all services
				enhancedFactors.push(
					"fundamentalData",
					"technicalAnalysis",
					"fundamentals",
					"technical"
				);
			}

			// Map specific factors to services
			if (
				factor.includes("rsi") ||
				factor.includes("macd") ||
				factor.includes("momentum") ||
				factor.includes("technical") ||
				factor.includes("bollinger") ||
				factor.includes("sma") ||
				factor.includes("ema") ||
				factor.includes("stochastic") ||
				factor.includes("volatility")
			) {
				enhancedFactors.push("technicalAnalysis", "technical");
			}

			if (
				factor.includes("pe_") ||
				factor.includes("pb_") ||
				factor.includes("roe") ||
				factor.includes("debt") ||
				factor.includes("current_ratio") ||
				factor.includes("revenue")
			) {
				enhancedFactors.push("fundamentalData", "fundamentals");
			}
		});

		const uniqueFactors = [...new Set(enhancedFactors)];
		console.log(`Enhanced factors for utilization: [${uniqueFactors.join(", ")}]`);
		return uniqueFactors;
	}

	/**
	 * Identify warnings based on stock analysis
	 */
	identifyWarnings(
		stockScore: StockScore,
		additionalData?: AdditionalStockData,
		macroImpact?: any,
		sentimentImpact?: any,
		esgImpact?: any,
		shortInterestImpact?: any,
		optionsAnalysis?: any,
		mlPrediction?: any
	): string[] {
		const warnings = [];

		if (stockScore.dataQuality.overall < 0.6) {
			warnings.push("Low data quality detected");
		}

		if (stockScore.marketData.volume < 100000) {
			warnings.push("Low trading volume");
		}

		// Analyst-based warnings
		if (additionalData?.analystData) {
			const { sentimentScore, totalAnalysts, distribution } = additionalData.analystData;

			if (sentimentScore < 2.5 && totalAnalysts >= 3) {
				warnings.push("Analysts are bearish on this stock");
			}

			if (
				distribution.sell + distribution.strongSell >
				distribution.buy + distribution.strongBuy
			) {
				warnings.push("More sell recommendations than buy recommendations");
			}

			if (totalAnalysts < 3) {
				warnings.push("Limited analyst coverage - higher uncertainty");
			}
		}

		// Fundamental ratio warnings
		if (additionalData?.fundamentalRatios) {
			const ratios = additionalData.fundamentalRatios;

			if (ratios.peRatio && ratios.peRatio > 40) {
				warnings.push("High P/E ratio suggests potential overvaluation");
			}

			if (ratios.debtToEquity && ratios.debtToEquity > 2.0) {
				warnings.push("High debt-to-equity ratio indicates financial risk");
			}

			if (ratios.currentRatio && ratios.currentRatio < 1.0) {
				warnings.push("Poor liquidity - current ratio below 1.0");
			}

			if (ratios.roe && ratios.roe < 0) {
				warnings.push("Negative return on equity indicates poor profitability");
			}

			if (ratios.grossProfitMargin && ratios.grossProfitMargin < 0.1) {
				warnings.push("Low gross profit margin suggests pricing pressure");
			}
		}

		// Price target warnings
		if (additionalData?.priceTargets?.upside && additionalData.priceTargets.upside < -15) {
			warnings.push("Stock trading significantly above analyst price targets");
		}

		// VWAP-based warnings
		if (additionalData?.vwapAnalysis) {
			const vwap = additionalData.vwapAnalysis;

			if (vwap.signal === "below" && vwap.strength === "strong") {
				warnings.push(
					`Price significantly below VWAP (${vwap.deviationPercent.toFixed(1)}%) - potential downward pressure`
				);
			}

			if (
				vwap.signal === "above" &&
				vwap.strength === "strong" &&
				vwap.deviationPercent > 5
			) {
				warnings.push(
					`Price far above VWAP (${vwap.deviationPercent.toFixed(1)}%) - potential overextension`
				);
			}
		}

		// Macroeconomic warnings
		if (macroImpact?.macroScore?.warnings) {
			warnings.push(...macroImpact.macroScore.warnings);
		}

		if (
			macroImpact?.sectorImpact?.outlook === "negative" ||
			macroImpact?.sectorImpact?.outlook === "very_negative"
		) {
			warnings.push(
				`Unfavorable macroeconomic environment for ${macroImpact.sectorImpact.sector} sector`
			);
		}

		// Sentiment-based warnings
		if (sentimentImpact?.sentimentScore?.warnings) {
			warnings.push(...sentimentImpact.sentimentScore.warnings);
		}
		if (sentimentImpact?.sentimentScore?.overall < 0.3) {
			warnings.push("Negative news sentiment creates downward pressure");
		}

		// ESG-based warnings
		if (esgImpact?.factors) {
			const esgWarnings = esgImpact.factors.filter(
				(factor: string) =>
					factor.toLowerCase().includes("risk") ||
					factor.toLowerCase().includes("controversies") ||
					factor.toLowerCase().includes("regulatory")
			);
			warnings.push(...esgWarnings);
		}
		if (esgImpact?.impact === "negative") {
			warnings.push(
				"Poor ESG practices may impact long-term sustainability and investor appeal"
			);
		}

		// Options-based warnings
		if (optionsAnalysis?.putCallRatio > 1.5) {
			warnings.push("High put/call ratio indicates bearish options sentiment");
		}
		if (optionsAnalysis?.impliedVolatility && optionsAnalysis.impliedVolatility > 50) {
			warnings.push("Elevated implied volatility suggests increased market uncertainty");
		}

		return warnings;
	}

	/**
	 * Identify opportunities based on stock analysis
	 */
	identifyOpportunities(
		stockScore: StockScore,
		additionalData?: AdditionalStockData,
		macroImpact?: any,
		sentimentImpact?: any,
		esgImpact?: any,
		shortInterestImpact?: any,
		optionsAnalysis?: any,
		mlPrediction?: any
	): string[] {
		const opportunities = [];

		if (stockScore.overallScore > 0.8) {
			opportunities.push("Strong fundamental performance");
		}

		// Analyst-based opportunities
		if (additionalData?.analystData) {
			const { sentimentScore, totalAnalysts, distribution } = additionalData.analystData;

			if (sentimentScore >= 4.0 && totalAnalysts >= 5) {
				opportunities.push("Strong analyst consensus with high conviction");
			}

			if (
				distribution.strongBuy >
				distribution.hold + distribution.sell + distribution.strongSell
			) {
				opportunities.push("Dominated by Strong Buy recommendations");
			}
		}

		// Price target opportunities
		if (additionalData?.priceTargets?.upside && additionalData.priceTargets.upside > 20) {
			opportunities.push(
				`Significant upside potential: ${additionalData.priceTargets.upside.toFixed(1)}%`
			);
		}

		// Fundamental ratio opportunities
		if (additionalData?.fundamentalRatios) {
			const ratios = additionalData.fundamentalRatios;

			if (ratios.peRatio && ratios.pegRatio && ratios.pegRatio < 1.0 && ratios.peRatio < 20) {
				opportunities.push("Attractive PEG ratio suggests undervalued growth stock");
			}

			if (ratios.roe && ratios.roe > 0.15) {
				opportunities.push("Strong return on equity indicates efficient management");
			}

			if (
				ratios.currentRatio &&
				ratios.currentRatio > 2.0 &&
				ratios.quickRatio &&
				ratios.quickRatio > 1.5
			) {
				opportunities.push("Strong liquidity position provides financial flexibility");
			}

			if (ratios.grossProfitMargin && ratios.grossProfitMargin > 0.4) {
				opportunities.push("High gross margin indicates strong pricing power");
			}

			if (
				ratios.dividendYield &&
				ratios.dividendYield > 0.03 &&
				ratios.payoutRatio &&
				ratios.payoutRatio < 0.6
			) {
				opportunities.push("Attractive dividend yield with sustainable payout ratio");
			}
		}

		// VWAP-based opportunities
		if (additionalData?.vwapAnalysis) {
			const vwap = additionalData.vwapAnalysis;

			if (
				vwap.signal === "above" &&
				vwap.strength === "moderate" &&
				vwap.deviationPercent > 1 &&
				vwap.deviationPercent < 3
			) {
				opportunities.push(
					`Price above VWAP (${vwap.deviationPercent.toFixed(1)}%) suggests positive momentum`
				);
			}

			if (
				vwap.signal === "below" &&
				vwap.strength === "moderate" &&
				vwap.deviationPercent < -2 &&
				vwap.deviationPercent > -5
			) {
				opportunities.push(
					`Price below VWAP (${Math.abs(vwap.deviationPercent).toFixed(1)}%) - potential entry opportunity`
				);
			}
		}

		// Macroeconomic opportunities
		if (macroImpact?.macroScore?.opportunities) {
			opportunities.push(...macroImpact.macroScore.opportunities);
		}

		if (
			macroImpact?.sectorImpact?.outlook === "positive" ||
			macroImpact?.sectorImpact?.outlook === "very_positive"
		) {
			opportunities.push(
				`Favorable macroeconomic environment for ${macroImpact.sectorImpact.sector} sector`
			);
		}

		// Sentiment-based opportunities
		if (sentimentImpact?.sentimentScore?.opportunities) {
			opportunities.push(...sentimentImpact.sentimentScore.opportunities);
		}
		if (sentimentImpact?.sentimentScore?.overall > 0.7) {
			opportunities.push("Strong positive news sentiment creates upward momentum");
		}

		// ESG-based opportunities
		if (esgImpact?.impact === "positive") {
			opportunities.push("Strong ESG profile attracts institutional investors");
		}
		if (esgImpact?.factors) {
			const esgOpportunities = esgImpact.factors.filter(
				(factor: string) =>
					factor.toLowerCase().includes("leader") ||
					factor.toLowerCase().includes("sustainability") ||
					factor.toLowerCase().includes("best practices")
			);
			opportunities.push(...esgOpportunities);
		}

		// Short interest opportunities
		if (shortInterestImpact?.squeezeScore > 0.7) {
			opportunities.push("High short squeeze potential detected");
		}

		// Options-based opportunities
		if (optionsAnalysis?.putCallRatio < 0.7) {
			opportunities.push("Low put/call ratio indicates bullish options sentiment");
		}
		if (optionsAnalysis?.maxPain && optionsAnalysis.currentPrice < optionsAnalysis.maxPain) {
			opportunities.push(
				`Stock below max pain point - potential upward price movement to $${optionsAnalysis.maxPain}`
			);
		}

		return opportunities;
	}

	/**
	 * Calculate average score from selections
	 */
	calculateAverageScore(selections: any[]): number {
		if (selections.length === 0) return 0;
		const sum = selections.reduce((acc, sel) => acc + sel.score.overallScore, 0);
		return sum / selections.length;
	}

	/**
	 * Calculate valuation score from sector metrics
	 */
	calculateValuationScore(sectorMetrics: any): number {
		if (!sectorMetrics?.quality?.value) return 0;
		return sectorMetrics.quality.value;
	}

	/**
	 * Calculate portfolio metrics for multi-stock analysis
	 */
	calculatePortfolioMetrics(results: any[]): any {
		if (results.length === 0) {
			return {
				overallScore: 0,
				diversificationScore: 0,
				riskScore: 0,
				sectorBreakdown: {},
				marketCapBreakdown: { large: 0, mid: 0, small: 0 },
			};
		}

		// Calculate overall score
		const overallScore = results.reduce((sum, r) => sum + r.score.overallScore, 0) / results.length;

		// Calculate sector breakdown
		const sectorBreakdown: { [sector: string]: number } = {};
		results.forEach(r => {
			const sector = r.context.sector || "Unknown";
			sectorBreakdown[sector] = (sectorBreakdown[sector] || 0) + 1;
		});

		// Calculate diversification score (higher = more diversified)
		const uniqueSectors = Object.keys(sectorBreakdown).length;
		const diversificationScore = Math.min(uniqueSectors / 5, 1); // Normalized to max 5 sectors

		// Calculate market cap breakdown
		const marketCapBreakdown = {
			large: results.filter(r => r.context.marketCap > 10000000000).length / results.length,
			mid: results.filter(r => r.context.marketCap > 2000000000 && r.context.marketCap <= 10000000000).length / results.length,
			small: results.filter(r => r.context.marketCap <= 2000000000).length / results.length,
		};

		// Calculate risk score (inverse of diversification and quality)
		const avgQuality = results.reduce((sum, r) => sum + r.dataQuality.overall, 0) / results.length;
		const riskScore = 1 - (diversificationScore * 0.5 + avgQuality * 0.5);

		return {
			overallScore,
			diversificationScore,
			riskScore,
			sectorBreakdown,
			marketCapBreakdown,
		};
	}

	/**
	 * Generate portfolio recommendations
	 */
	generatePortfolioRecommendations(results: any[], portfolioMetrics: any): any {
		const allocation: { [symbol: string]: number } = {};
		const rebalancing: any[] = [];
		const riskWarnings: string[] = [];

		// Simple equal-weight allocation based on scores
		const totalScore = results.reduce((sum, r) => sum + r.score.overallScore, 0);
		results.forEach(r => {
			allocation[r.symbol] = totalScore > 0 ? r.score.overallScore / totalScore : 1 / results.length;
		});

		// Risk warnings based on portfolio metrics
		if (portfolioMetrics.diversificationScore < 0.3) {
			riskWarnings.push("Low diversification - consider adding stocks from different sectors");
		}

		if (portfolioMetrics.riskScore > 0.7) {
			riskWarnings.push("High risk portfolio - consider adding more stable, large-cap stocks");
		}

		if (portfolioMetrics.marketCapBreakdown.small > 0.5) {
			riskWarnings.push("Over-weighted in small-cap stocks - consider balancing with larger companies");
		}

		return {
			allocation,
			rebalancing,
			riskWarnings,
		};
	}
}
