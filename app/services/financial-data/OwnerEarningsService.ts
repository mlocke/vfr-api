/**
 * Owner Earnings Service
 * Calculates and analyzes owner earnings (Buffett-style earnings analysis)
 * Focuses on true cash-generating capability of businesses
 */

import { OwnerEarnings, OwnerEarningsAnalysis } from "./types";
import { createServiceErrorHandler } from "../error-handling";
import SecurityValidator from "../security/SecurityValidator";
import { redisCache } from "../cache/RedisCache";

export class OwnerEarningsService {
	private readonly errorHandler: ReturnType<typeof createServiceErrorHandler>;
	private readonly cacheTTL = 7200000; // 2 hours cache for owner earnings data

	constructor() {
		this.errorHandler = createServiceErrorHandler("OwnerEarningsService");
	}

	/**
	 * Calculate owner earnings for a symbol and period
	 * @param symbol Stock symbol
	 * @param period Period identifier (e.g., 'TTM', '2024', 'Q3-2024')
	 * @returns Promise<OwnerEarnings | null>
	 */
	async getOwnerEarnings(symbol: string, period: string = "TTM"): Promise<OwnerEarnings | null> {
		try {
			SecurityValidator.validateSymbol(symbol);

			const cacheKey = `owner-earnings:${symbol.toUpperCase()}:${period}`;
			const cachedData = await redisCache.get<OwnerEarnings>(cacheKey);

			if (cachedData) {
				return cachedData;
			}

			// Mock calculation - would integrate with actual financial data APIs
			const mockData = this.generateMockOwnerEarnings(symbol, period);

			await redisCache.set(cacheKey, mockData, this.cacheTTL);
			return mockData;
		} catch (error) {
			this.errorHandler.errorHandler.createErrorResponse(error, "getOwnerEarnings");
			return null;
		}
	}

	/**
	 * Get comprehensive owner earnings analysis
	 * @param symbol Stock symbol
	 * @returns Promise<OwnerEarningsAnalysis>
	 */
	async getOwnerEarningsAnalysis(symbol: string): Promise<OwnerEarningsAnalysis> {
		try {
			SecurityValidator.validateSymbol(symbol);

			const cacheKey = `owner-earnings-analysis:${symbol.toUpperCase()}`;
			const cachedData = await redisCache.get<OwnerEarningsAnalysis>(cacheKey);

			if (cachedData) {
				return cachedData;
			}

			// Get historical data (mock)
			const periods = ["2024", "2023", "2022", "2021", "TTM"];
			const historicalData: OwnerEarnings[] = [];

			for (const period of periods) {
				const earnings = await this.getOwnerEarnings(symbol, period);
				if (earnings) {
					historicalData.push(earnings);
				}
			}

			// Calculate trends and analysis
			const yields = historicalData.map(d => d.ownerEarningsYield).filter(y => y > 0);
			const averageYield =
				yields.reduce((sum, currentYield) => sum + currentYield, 0) / yields.length || 0;

			const qualityScores = historicalData.map(d => d.qualityScore);
			const avgQualityScore =
				qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length || 5;

			// Determine trend
			const recentYields = yields.slice(0, 3);
			const olderYields = yields.slice(3);
			const recentAvg =
				recentYields.reduce((sum, y) => sum + y, 0) / recentYields.length || 0;
			const olderAvg = olderYields.reduce((sum, y) => sum + y, 0) / olderYields.length || 0;

			const trend: "IMPROVING" | "DECLINING" | "STABLE" =
				recentAvg > olderAvg * 1.1
					? "IMPROVING"
					: recentAvg < olderAvg * 0.9
						? "DECLINING"
						: "STABLE";

			const analysis: OwnerEarningsAnalysis = {
				symbol: symbol.toUpperCase(),
				historicalData,
				trend,
				averageYield,
				qualityAssessment:
					avgQualityScore > 7 ? "HIGH" : avgQualityScore > 4 ? "MEDIUM" : "LOW",
				keyInsights: this.generateKeyInsights(symbol, historicalData, trend, averageYield),
				investmentRating: this.determineInvestmentRating(
					averageYield,
					avgQualityScore,
					trend
				),
				confidence: 0.8,
				timestamp: Date.now(),
				source: "OwnerEarningsService",
			};

			await redisCache.set(cacheKey, analysis, this.cacheTTL);
			return analysis;
		} catch (error) {
			throw this.errorHandler.errorHandler.createErrorResponse(
				error,
				"getOwnerEarningsAnalysis"
			);
		}
	}

	/**
	 * Compare owner earnings across multiple symbols
	 * @param symbols Array of stock symbols
	 * @returns Promise<{ symbol: string; analysis: OwnerEarningsAnalysis }[]>
	 */
	async compareOwnerEarnings(
		symbols: string[]
	): Promise<{ symbol: string; analysis: OwnerEarningsAnalysis }[]> {
		try {
			if (!symbols || symbols.length === 0) {
				throw new Error("Symbols array is required");
			}

			const results = await Promise.allSettled(
				symbols.map(async symbol => ({
					symbol: symbol.toUpperCase(),
					analysis: await this.getOwnerEarningsAnalysis(symbol),
				}))
			);

			return results
				.filter(
					(
						result
					): result is PromiseFulfilledResult<{
						symbol: string;
						analysis: OwnerEarningsAnalysis;
					}> => result.status === "fulfilled"
				)
				.map(result => result.value);
		} catch (error) {
			throw this.errorHandler.errorHandler.createErrorResponse(error, "compareOwnerEarnings");
		}
	}

	/**
	 * Get owner earnings screening results
	 * @param minYield Minimum owner earnings yield
	 * @param minQuality Minimum quality score
	 * @returns Promise<OwnerEarningsAnalysis[]>
	 */
	async screenByOwnerEarnings(
		minYield: number = 5,
		minQuality: number = 6
	): Promise<OwnerEarningsAnalysis[]> {
		try {
			// Mock screening - would implement actual screening logic
			const mockSymbols = ["AAPL", "MSFT", "GOOGL", "BRK.B", "JNJ", "PG", "KO", "WMT"];

			const analyses = await Promise.allSettled(
				mockSymbols.map(symbol => this.getOwnerEarningsAnalysis(symbol))
			);

			const validAnalyses = analyses
				.filter(
					(result): result is PromiseFulfilledResult<OwnerEarningsAnalysis> =>
						result.status === "fulfilled"
				)
				.map(result => result.value);

			// Filter by criteria
			return validAnalyses.filter(
				analysis =>
					analysis.averageYield >= minYield &&
					(analysis.qualityAssessment === "HIGH"
						? 8
						: analysis.qualityAssessment === "MEDIUM"
							? 5
							: 2) >= minQuality
			);
		} catch (error) {
			throw this.errorHandler.errorHandler.createErrorResponse(
				error,
				"screenByOwnerEarnings"
			);
		}
	}

	/**
	 * Generate mock owner earnings data
	 * @private
	 */
	private generateMockOwnerEarnings(symbol: string, period: string): OwnerEarnings {
		// Generate consistent data based on symbol hash
		const hash = symbol.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
		const periodHash = period.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
		const seed = (hash + periodHash) % 1000;

		// Mock financial data
		const reportedEarnings = seed * 100 + Math.random() * 1000000; // Base earnings
		const depreciation = reportedEarnings * (0.05 + Math.random() * 0.05); // 5-10%
		const amortization = reportedEarnings * (0.02 + Math.random() * 0.03); // 2-5%
		const maintenanceCapex = reportedEarnings * (0.04 + Math.random() * 0.06); // 4-10%

		// Owner earnings = Net Income + Depreciation + Amortization - Maintenance CapEx
		const ownerEarnings = reportedEarnings + depreciation + amortization - maintenanceCapex;

		// Mock share count and price for calculations
		const sharesOutstanding = 1000000 + Math.random() * 4000000;
		const currentPrice = 50 + Math.random() * 200;

		const ownerEarningsPerShare = ownerEarnings / sharesOutstanding;
		const ownerEarningsYield = (ownerEarningsPerShare / currentPrice) * 100;

		const cashConversionRatio = ownerEarnings / reportedEarnings;

		// Quality score based on consistency and cash conversion
		const qualityScore = Math.min(
			10,
			Math.max(1, 5 + (cashConversionRatio - 1) * 5 + (Math.random() - 0.5) * 2)
		);

		return {
			symbol: symbol.toUpperCase(),
			period,
			reportedEarnings,
			depreciation,
			amortization,
			maintenanceCapex,
			ownerEarnings,
			ownerEarningsPerShare,
			ownerEarningsYield,
			cashConversionRatio,
			qualityScore,
			confidence: 0.8,
			timestamp: Date.now(),
			source: "OwnerEarningsService",
		};
	}

	/**
	 * Generate key insights for analysis
	 * @private
	 */
	private generateKeyInsights(
		symbol: string,
		data: OwnerEarnings[],
		trend: string,
		avgOwnerYield: number
	): string[] {
		const insights: string[] = [];

		if (trend === "IMPROVING") {
			insights.push("Owner earnings trend is improving over time");
		} else if (trend === "DECLINING") {
			insights.push("Owner earnings trend shows decline - investigate operational issues");
		}

		if (avgOwnerYield > 8) {
			insights.push("High owner earnings yield suggests potential value opportunity");
		} else if (avgOwnerYield < 3) {
			insights.push("Low owner earnings yield may indicate premium valuation");
		}

		if (data.length > 0) {
			const latest = data[0];
			if (latest.cashConversionRatio > 1.2) {
				insights.push("Strong cash conversion indicates high earnings quality");
			} else if (latest.cashConversionRatio < 0.8) {
				insights.push("Weak cash conversion suggests earnings quality concerns");
			}

			if (latest.qualityScore > 7) {
				insights.push("High quality score indicates consistent and reliable earnings");
			}
		}

		return insights;
	}

	/**
	 * Determine investment rating
	 * @private
	 */
	private determineInvestmentRating(
		ownerYield: number,
		quality: number,
		trend: "IMPROVING" | "DECLINING" | "STABLE"
	): "ATTRACTIVE" | "FAIR" | "UNATTRACTIVE" {
		if (ownerYield > 6 && quality > 6 && trend !== "DECLINING") {
			return "ATTRACTIVE";
		} else if (ownerYield < 3 || quality < 4 || trend === "DECLINING") {
			return "UNATTRACTIVE";
		}
		return "FAIR";
	}

	/**
	 * Health check for the service
	 * @returns Promise<boolean>
	 */
	async healthCheck(): Promise<boolean> {
		try {
			await this.getOwnerEarnings("AAPL");
			return true;
		} catch (error) {
			this.errorHandler.errorHandler.createErrorResponse(error, "healthCheck");
			return false;
		}
	}
}

// Export singleton instance
export const ownerEarningsService = new OwnerEarningsService();
export default ownerEarningsService;
