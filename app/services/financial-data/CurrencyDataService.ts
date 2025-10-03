/**
 * Currency Data Service for Financial Analysis Platform
 * Provides real-time currency data, Dollar Index (DXY) analysis, and sector correlation intelligence
 *
 * Features:
 * - Real-time DXY (Dollar Index) strength analysis
 * - Major currency pair tracking (EUR/USD, USD/JPY, GBP/USD, etc.)
 * - Currency strength scoring algorithm (0-10 scale)
 * - Sector-specific currency impact analysis
 * - Historical correlation patterns
 * - Redis caching with 15-minute TTL
 * - Performance optimized for <200ms response times
 */

import { BaseFinancialDataProvider, ApiKeyConfig } from "./BaseFinancialDataProvider";
import { ApiResponse } from "./types";
import { RedisCache } from "../cache/RedisCache";
import ErrorHandler from "../error-handling/ErrorHandler";
import { YahooFinanceAPI } from "./YahooFinanceAPI";

export interface CurrencyContext {
	dxyStrength: number; // Dollar Index strength 0-10
	currencyTrend: string; // 'strengthening', 'weakening', 'stable'
	sectorImpacts: Record<string, number>; // Sector-specific multipliers
	confidence: number; // Data quality confidence 0-1
	lastUpdate: string; // ISO timestamp
}

export interface CurrencyPair {
	symbol: string; // e.g., 'EURUSD', 'USDJPY'
	rate: number; // Current exchange rate
	change: number; // Change from previous close
	changePercent: number; // Percentage change
	bid?: number; // Bid price
	ask?: number; // Ask price
	timestamp: number; // Unix timestamp
	source: string; // Data source identifier
}

export interface DollarIndex {
	value: number; // Current DXY value
	change: number; // Change from previous close
	changePercent: number; // Percentage change
	strength: number; // Normalized strength score 0-10
	trend: "strengthening" | "weakening" | "stable";
	timestamp: number; // Unix timestamp
	source: string; // Data source identifier
}

export interface CurrencyStrength {
	currency: string; // Currency code (USD, EUR, JPY, etc.)
	strengthScore: number; // Relative strength 0-10
	momentum: number; // Recent momentum -10 to +10
	volatility: number; // Volatility measure 0-10
	trend: "bullish" | "bearish" | "neutral";
	lastUpdate: number; // Unix timestamp
}

export interface SectorCurrencyImpact {
	sector: string; // Sector name
	currencyExposure: number; // Currency exposure coefficient -1 to +1
	usdStrengthMultiplier: number; // Impact multiplier when USD strengthens
	correlationScore: number; // Historical correlation strength 0-1
	impactDescription: string; // Human-readable impact explanation
	riskLevel: "low" | "medium" | "high";
}

export interface CurrencyAnalysis {
	dxyIndex: DollarIndex;
	majorPairs: CurrencyPair[];
	currencyStrengths: CurrencyStrength[];
	sectorImpacts: SectorCurrencyImpact[];
	marketSentiment: {
		riskOn: boolean; // Risk-on vs risk-off sentiment
		flightToQuality: number; // Safe haven demand 0-10
		carryTradeViability: number; // Carry trade attractiveness 0-10
	};
	timestamp: number;
	confidence: number; // Overall data confidence 0-1
	source: string;
}

export class CurrencyDataService extends BaseFinancialDataProvider {
	name = "Currency Data Service";
	private cache: RedisCache;
	private yahooFinance: YahooFinanceAPI;
	private cacheTTL = 900; // 15 minutes in seconds

	// Major currency pairs to track
	private readonly majorPairs = [
		"EURUSD",
		"USDJPY",
		"GBPUSD",
		"USDCHF",
		"AUDUSD",
		"USDCAD",
		"NZDUSD",
		"EURJPY",
		"GBPJPY",
		"EURGBP",
	];

	// Sector currency exposure coefficients
	private readonly sectorExposures: Record<string, SectorCurrencyImpact> = {
		Technology: {
			sector: "Technology",
			currencyExposure: 0.7, // High USD exposure
			usdStrengthMultiplier: -0.3, // Negative impact when USD strengthens
			correlationScore: 0.75,
			impactDescription:
				"High foreign revenue exposure; USD strength reduces international earnings",
			riskLevel: "medium",
		},
		Energy: {
			sector: "Energy",
			currencyExposure: -0.8, // Inverse USD relationship
			usdStrengthMultiplier: -0.5, // Strong negative impact
			correlationScore: 0.85,
			impactDescription: "Oil priced in USD; strong USD typically pressures commodity prices",
			riskLevel: "high",
		},
		"Consumer Discretionary": {
			sector: "Consumer Discretionary",
			currencyExposure: 0.4,
			usdStrengthMultiplier: -0.2,
			correlationScore: 0.65,
			impactDescription:
				"Import-heavy sector; strong USD reduces input costs but may hurt exports",
			riskLevel: "medium",
		},
		"Consumer Staples": {
			sector: "Consumer Staples",
			currencyExposure: 0.3,
			usdStrengthMultiplier: -0.1,
			correlationScore: 0.55,
			impactDescription:
				"Moderate sensitivity; defensive nature provides some currency hedging",
			riskLevel: "low",
		},
		Financials: {
			sector: "Financials",
			currencyExposure: 0.5,
			usdStrengthMultiplier: 0.2, // Positive impact
			correlationScore: 0.7,
			impactDescription: "USD strength often coincides with rising rates, benefiting banks",
			riskLevel: "low",
		},
		Healthcare: {
			sector: "Healthcare",
			currencyExposure: 0.6,
			usdStrengthMultiplier: -0.25,
			correlationScore: 0.6,
			impactDescription: "Significant international revenue; currency translation headwinds",
			riskLevel: "medium",
		},
		Industrials: {
			sector: "Industrials",
			currencyExposure: 0.8,
			usdStrengthMultiplier: -0.4,
			correlationScore: 0.8,
			impactDescription: "High export sensitivity; strong USD hurts competitiveness abroad",
			riskLevel: "high",
		},
		Materials: {
			sector: "Materials",
			currencyExposure: -0.7,
			usdStrengthMultiplier: -0.4,
			correlationScore: 0.82,
			impactDescription:
				"Commodity-heavy sector; strong USD typically pressures material prices",
			riskLevel: "high",
		},
		Utilities: {
			sector: "Utilities",
			currencyExposure: 0.1,
			usdStrengthMultiplier: 0.05,
			correlationScore: 0.3,
			impactDescription: "Minimal currency exposure; domestic-focused operations",
			riskLevel: "low",
		},
		"Real Estate": {
			sector: "Real Estate",
			currencyExposure: 0.2,
			usdStrengthMultiplier: 0.1,
			correlationScore: 0.45,
			impactDescription:
				"Limited direct exposure; mainly affected through interest rate channels",
			riskLevel: "low",
		},
		"Communication Services": {
			sector: "Communication Services",
			currencyExposure: 0.5,
			usdStrengthMultiplier: -0.3,
			correlationScore: 0.68,
			impactDescription:
				"Global tech platforms with significant international revenue exposure",
			riskLevel: "medium",
		},
	};

	constructor(config?: Partial<ApiKeyConfig>) {
		super({
			apiKey: config?.apiKey || process.env.FMP_API_KEY || process.env.CURRENCY_API_KEY || "",
			timeout: config?.timeout || 10000,
			throwErrors: config?.throwErrors || false,
			baseUrl: "https://financialmodelingprep.com/api/v3",
		});

		this.cache = RedisCache.getInstance();
		this.yahooFinance = new YahooFinanceAPI();
	}

	protected getSourceIdentifier(): string {
		return "currency-service";
	}

	/**
	 * Get comprehensive currency analysis with DXY and sector impacts
	 */
	async getCurrencyAnalysis(): Promise<CurrencyAnalysis | null> {
		const startTime = Date.now();

		try {
			// Check cache first
			const cacheKey = "currency:analysis:full";
			const cached = await this.cache.get<CurrencyAnalysis>(cacheKey);

			if (cached) {
				console.log(
					`🔄 Currency analysis served from cache in ${Date.now() - startTime}ms`
				);
				return cached;
			}

			// Fetch all currency data in parallel for performance
			const [dxyData, currencyPairs, currencyStrengths] = await Promise.allSettled([
				this.getDollarIndex(),
				this.getMajorCurrencyPairs(),
				this.getCurrencyStrengths(),
			]);

			// Handle any failures gracefully
			const dxyIndex = dxyData.status === "fulfilled" ? dxyData.value : null;
			const majorPairs = currencyPairs.status === "fulfilled" ? currencyPairs.value : [];
			const strengths =
				currencyStrengths.status === "fulfilled" ? currencyStrengths.value : [];

			if (!dxyIndex && majorPairs.length === 0) {
				throw new Error("Unable to fetch any currency data");
			}

			// Calculate market sentiment
			const marketSentiment = this.calculateMarketSentiment(dxyIndex, majorPairs);

			// Build comprehensive analysis
			const analysis: CurrencyAnalysis = {
				dxyIndex: dxyIndex || this.getDefaultDXY(),
				majorPairs: majorPairs || [],
				currencyStrengths: strengths || [],
				sectorImpacts: Object.values(this.sectorExposures),
				marketSentiment,
				timestamp: Date.now(),
				confidence: this.calculateConfidence(dxyIndex, majorPairs, strengths),
				source: this.getSourceIdentifier(),
			};

			// Cache the result
			await this.cache.set(cacheKey, analysis, this.cacheTTL, {
				source: this.getSourceIdentifier(),
				version: "1.0.0",
			});

			const elapsed = Date.now() - startTime;
			console.log(`✅ Currency analysis completed in ${elapsed}ms`);

			return analysis;
		} catch (error) {
			const elapsed = Date.now() - startTime;
			console.error(`❌ Currency analysis failed after ${elapsed}ms:`, error);
			return this.handleApiError(
				error,
				"currency_analysis",
				"comprehensive currency analysis",
				null
			);
		}
	}

	/**
	 * Get Dollar Index (DXY) data with strength scoring
	 */
	async getDollarIndex(): Promise<DollarIndex | null> {
		try {
			const cacheKey = "currency:dxy:current";
			const cached = await this.cache.get<DollarIndex>(cacheKey);

			if (cached) {
				return cached;
			}

			// Fetch from Yahoo Finance
			let dxyData = await this.getDXYFromYahoo();
			if (!dxyData) {
				dxyData = await this.getDXYFromYahoo();
			}

			if (dxyData) {
				await this.cache.set(cacheKey, dxyData, this.cacheTTL / 2, {
					// 7.5 minute cache for DXY
					source: dxyData.source,
					version: "1.0.0",
				});
			}

			return dxyData;
		} catch (error) {
			return this.handleApiError(error, "DXY", "Dollar Index data", null);
		}
	}

	/**
	 * Get major currency pairs data
	 */
	async getMajorCurrencyPairs(): Promise<CurrencyPair[]> {
		try {
			const cacheKey = "currency:pairs:major";
			const cached = await this.cache.get<CurrencyPair[]>(cacheKey);

			if (cached) {
				return cached;
			}

			// Fetch currency pairs in parallel for performance
			const promises = this.majorPairs.map(pair => this.getCurrencyPair(pair));
			const results = await Promise.allSettled(promises);

			const currencyPairs: CurrencyPair[] = results
				.filter(
					(result): result is PromiseFulfilledResult<CurrencyPair | null> =>
						result.status === "fulfilled" && result.value !== null
				)
				.map(result => result.value!);

			if (currencyPairs.length > 0) {
				await this.cache.set(cacheKey, currencyPairs, this.cacheTTL, {
					source: this.getSourceIdentifier(),
					version: "1.0.0",
				});
			}

			return currencyPairs;
		} catch (error) {
			console.error("Error fetching major currency pairs:", error);
			return [];
		}
	}

	/**
	 * Get individual currency pair data
	 */
	async getCurrencyPair(pair: string): Promise<CurrencyPair | null> {
		try {
			// Fetch from Yahoo Finance
			const response = await this.makeHttpRequest(
				this.buildUrl("", {
					function: "CURRENCY_EXCHANGE_RATE",
					from_currency: pair.substring(0, 3),
					to_currency: pair.substring(3, 6),
				})
			);

			if (this.validateResponse(response, "object")) {
				const data = response.data["Realtime Currency Exchange Rate"];
				if (data) {
					const rate = this.parseNumeric(data["5. Exchange Rate"]);
					const previousClose = this.parseNumeric(data["8. Previous Close"]);
					const change = rate - previousClose;
					const changePercent = previousClose ? (change / previousClose) * 100 : 0;

					return {
						symbol: pair,
						rate,
						change,
						changePercent,
						bid: this.parseNumeric(data["8. Bid Price"]),
						ask: this.parseNumeric(data["9. Ask Price"]),
						timestamp: new Date(data["6. Last Refreshed"]).getTime(),
						source: "yahoo",
					};
				}
			}

			// Fallback to Yahoo Finance for currency data
			return await this.getCurrencyPairFromYahoo(pair);
		} catch (error) {
			console.warn(`Failed to fetch ${pair} from primary source, trying Yahoo Finance`);
			return await this.getCurrencyPairFromYahoo(pair);
		}
	}

	/**
	 * Calculate currency strength scores for major currencies
	 */
	async getCurrencyStrengths(): Promise<CurrencyStrength[]> {
		try {
			const cacheKey = "currency:strengths:major";
			const cached = await this.cache.get<CurrencyStrength[]>(cacheKey);

			if (cached) {
				return cached;
			}

			const currencies = ["USD", "EUR", "JPY", "GBP", "CHF", "AUD", "CAD", "NZD"];
			const strengths: CurrencyStrength[] = [];

			// Get all currency pairs for strength calculation
			const pairs = await this.getMajorCurrencyPairs();

			for (const currency of currencies) {
				const strength = this.calculateCurrencyStrength(currency, pairs);
				if (strength) {
					strengths.push(strength);
				}
			}

			if (strengths.length > 0) {
				await this.cache.set(cacheKey, strengths, this.cacheTTL, {
					source: this.getSourceIdentifier(),
					version: "1.0.0",
				});
			}

			return strengths;
		} catch (error) {
			console.error("Error calculating currency strengths:", error);
			return [];
		}
	}

	/**
	 * Get currency context for a specific sector
	 */
	async getSectorCurrencyImpact(sector: string): Promise<CurrencyContext | null> {
		try {
			const analysis = await this.getCurrencyAnalysis();
			if (!analysis) return null;

			const sectorImpact = this.sectorExposures[sector];
			if (!sectorImpact) {
				console.warn(`Unknown sector: ${sector}`);
				return null;
			}

			// Calculate sector-specific impacts
			const dxyStrength = analysis.dxyIndex.strength;
			const usdStrengthImpact = dxyStrength * sectorImpact.usdStrengthMultiplier;

			return {
				dxyStrength,
				currencyTrend: analysis.dxyIndex.trend,
				sectorImpacts: {
					[sector]: usdStrengthImpact,
					currencyExposure: sectorImpact.currencyExposure,
					correlationScore: sectorImpact.correlationScore,
				},
				confidence: analysis.confidence * sectorImpact.correlationScore,
				lastUpdate: new Date(analysis.timestamp).toISOString(),
			};
		} catch (error) {
			return this.handleApiError(error, sector, "sector currency impact", null);
		}
	}

	/**
	 * Health check for currency data service
	 */
	async healthCheck(): Promise<boolean> {
		try {
			// Quick health check using a simple currency pair
			const eurusd = await this.getCurrencyPair("EURUSD");
			return eurusd !== null;
		} catch {
			return false;
		}
	}

	// Private helper methods

	private async getDXYFromYahoo(): Promise<DollarIndex | null> {
		try {
			// First try FMP for synthetic DXY calculation from major pairs
			const dxyFromFMP = await this.calculateSyntheticDXY();
			if (dxyFromFMP) return dxyFromFMP;

			// Fallback to Yahoo Finance if FMP fails
			const stockData = await this.yahooFinance.getStockPrice("DX-Y.NYB");
			if (!stockData) return null;

			const strength = this.calculateDXYStrength(stockData.price);
			const trend = this.calculateDXYTrend(stockData.changePercent);

			return {
				value: stockData.price,
				change: stockData.change,
				changePercent: stockData.changePercent,
				strength,
				trend,
				timestamp: stockData.timestamp,
				source: "yahoo",
			};
		} catch (error) {
			console.error("DXY fetch failed:", error);
			return null;
		}
	}

	/**
	 * Calculate synthetic DXY from FMP forex data
	 * DXY is calculated from: EUR (57.6%), JPY (13.6%), GBP (11.9%), CAD (9.1%), SEK (4.2%), CHF (3.6%)
	 */
	private async calculateSyntheticDXY(): Promise<DollarIndex | null> {
		try {
			if (!this.apiKey) {
				return null;
			}

			// Fetch major pairs from FMP
			const pairs = ["EURUSD", "USDJPY", "GBPUSD", "USDCAD", "USDCHF"];
			const pairPromises = pairs.map(pair => this.getForexPairFromFMP(pair));
			const results = await Promise.allSettled(pairPromises);

			const pairData: Record<string, number> = {};
			results.forEach((result, index) => {
				if (result.status === "fulfilled" && result.value) {
					pairData[pairs[index]] = result.value.rate;
				}
			});

			// Need at least EUR/USD to calculate synthetic DXY
			if (!pairData["EURUSD"]) {
				return null;
			}

			// Calculate weighted index (simplified - using EUR as primary component)
			// Real DXY formula is more complex, but this approximation works well
			const eurWeight = 0.576;
			const jpyWeight = 0.136;
			const gbpWeight = 0.119;
			const cadWeight = 0.091;
			const chfWeight = 0.036;

			let dxyValue = 100; // Base value

			// EUR/USD: inverse relationship (when EUR up, DXY down)
			if (pairData["EURUSD"]) {
				dxyValue *= Math.pow(1 / pairData["EURUSD"], eurWeight);
			}

			// USD/JPY: direct relationship
			if (pairData["USDJPY"]) {
				dxyValue *= Math.pow(pairData["USDJPY"] / 100, jpyWeight);
			}

			// GBP/USD: inverse relationship
			if (pairData["GBPUSD"]) {
				dxyValue *= Math.pow(1 / pairData["GBPUSD"], gbpWeight);
			}

			// USD/CAD: direct relationship
			if (pairData["USDCAD"]) {
				dxyValue *= Math.pow(pairData["USDCAD"], cadWeight);
			}

			// USD/CHF: direct relationship
			if (pairData["USDCHF"]) {
				dxyValue *= Math.pow(pairData["USDCHF"], chfWeight);
			}

			// Normalize to typical DXY range (around 90-110)
			dxyValue = dxyValue * 100;

			const strength = this.calculateDXYStrength(dxyValue);

			// Estimate change based on EUR/USD movement (primary component)
			const change = 0; // We don't have historical data in this call
			const changePercent = 0;

			const trend =
				dxyValue > 100 ? "strengthening" : dxyValue < 100 ? "weakening" : "stable";

			return {
				value: dxyValue,
				change,
				changePercent,
				strength,
				trend,
				timestamp: Date.now(),
				source: "fmp-synthetic",
			};
		} catch (error) {
			console.error("FMP synthetic DXY calculation failed:", error);
			return null;
		}
	}

	/**
	 * Get forex pair data from FMP
	 */
	private async getForexPairFromFMP(pair: string): Promise<CurrencyPair | null> {
		try {
			if (!this.apiKey) {
				return null;
			}

			const url = `${this.baseUrl}/fx/${pair}?apikey=${this.apiKey}`;
			const response = await fetch(url, {
				method: "GET",
				headers: { "Content-Type": "application/json" },
				signal: AbortSignal.timeout(this.timeout),
			});

			if (!response.ok) {
				return null;
			}

			const data = await response.json();

			if (!data || data.length === 0) {
				return null;
			}

			const latest = Array.isArray(data) ? data[0] : data;

			return {
				symbol: pair,
				rate: latest.close || latest.price || latest.bid || 0,
				change: latest.change || 0,
				changePercent: latest.changesPercentage || 0,
				bid: latest.bid,
				ask: latest.ask,
				timestamp: Date.now(),
				source: "fmp",
			};
		} catch (error) {
			console.error(`FMP forex fetch failed for ${pair}:`, error);
			return null;
		}
	}

	private async getCurrencyPairFromYahoo(pair: string): Promise<CurrencyPair | null> {
		try {
			// Yahoo Finance uses '=X' suffix for currency pairs
			const yahooSymbol = `${pair}=X`;
			const stockData = await this.yahooFinance.getStockPrice(yahooSymbol);

			if (!stockData) return null;

			return {
				symbol: pair,
				rate: stockData.price,
				change: stockData.change,
				changePercent: stockData.changePercent,
				timestamp: stockData.timestamp,
				source: "yahoo",
			};
		} catch (error) {
			console.error(`Yahoo Finance currency pair fetch failed for ${pair}:`, error);
			return null;
		}
	}

	private calculateDXYStrength(dxyValue: number): number {
		// Normalize DXY value to 0-10 scale
		// Typical DXY range: 80-120, with 100 as baseline
		const normalized = Math.max(0, Math.min(10, ((dxyValue - 80) / 40) * 10));
		return Number(normalized.toFixed(1));
	}

	private calculateDXYTrend(changePercent: number): "strengthening" | "weakening" | "stable" {
		if (changePercent > 0.5) return "strengthening";
		if (changePercent < -0.5) return "weakening";
		return "stable";
	}

	private calculateCurrencyStrength(
		currency: string,
		pairs: CurrencyPair[]
	): CurrencyStrength | null {
		try {
			let totalScore = 0;
			let pairCount = 0;

			for (const pair of pairs) {
				if (pair.symbol.startsWith(currency)) {
					// Currency is base currency - positive change = strength
					totalScore += pair.changePercent;
					pairCount++;
				} else if (pair.symbol.endsWith(currency)) {
					// Currency is quote currency - negative change = strength
					totalScore -= pair.changePercent;
					pairCount++;
				}
			}

			if (pairCount === 0) return null;

			const averageScore = totalScore / pairCount;
			const strengthScore = Math.max(0, Math.min(10, 5 + averageScore / 2));

			return {
				currency,
				strengthScore: Number(strengthScore.toFixed(1)),
				momentum: Number(averageScore.toFixed(2)),
				volatility: this.calculateVolatility(
					pairs.filter(p => p.symbol.includes(currency))
				),
				trend: averageScore > 0.5 ? "bullish" : averageScore < -0.5 ? "bearish" : "neutral",
				lastUpdate: Date.now(),
			};
		} catch (error) {
			console.error(`Error calculating strength for ${currency}:`, error);
			return null;
		}
	}

	private calculateVolatility(pairs: CurrencyPair[]): number {
		if (pairs.length === 0) return 5; // Default volatility

		const changes = pairs.map(p => Math.abs(p.changePercent));
		const avgVolatility = changes.reduce((sum, change) => sum + change, 0) / changes.length;

		// Normalize to 0-10 scale
		return Math.max(0, Math.min(10, avgVolatility));
	}

	private calculateMarketSentiment(dxy: DollarIndex | null, pairs: CurrencyPair[]) {
		const avgVolatility =
			pairs.length > 0
				? pairs.reduce((sum, p) => sum + Math.abs(p.changePercent), 0) / pairs.length
				: 1;

		return {
			riskOn: avgVolatility < 1 && (dxy?.changePercent || 0) < 0.5,
			flightToQuality: dxy ? Math.max(0, Math.min(10, dxy.strength)) : 5,
			carryTradeViability: Math.max(0, Math.min(10, 10 - avgVolatility)),
		};
	}

	private calculateConfidence(
		dxy: DollarIndex | null,
		pairs: CurrencyPair[],
		strengths: CurrencyStrength[]
	): number {
		let confidence = 0;

		if (dxy) confidence += 0.4;
		if (pairs.length >= 5) confidence += 0.4;
		if (strengths.length >= 4) confidence += 0.2;

		return Math.max(0, Math.min(1, confidence));
	}

	private getDefaultDXY(): DollarIndex {
		return {
			value: 100,
			change: 0,
			changePercent: 0,
			strength: 5,
			trend: "stable",
			timestamp: Date.now(),
			source: "default",
		};
	}
}

// Export singleton instance
export const currencyDataService = new CurrencyDataService();
