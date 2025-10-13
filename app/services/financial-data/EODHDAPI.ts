/**
 * EODHD API implementation
 * Provides access to end-of-day historical data and real-time financial APIs
 * API Documentation: https://eodhd.com/financial-apis/
 */

import {
	StockData,
	CompanyInfo,
	MarketData,
	FinancialDataProvider,
	ApiResponse,
	OptionsContract,
	OptionsChain,
	PutCallRatio,
	OptionsAnalysis,
	FundamentalRatios,
} from "./types";
import { historicalCache } from "../cache/HistoricalDataCache";

interface EODHDQuote {
	code: string;
	timestamp: number;
	gmtoffset: number;
	open: number;
	high: number;
	low: number;
	close: number;
	volume: number;
	previousClose: number;
	change: number;
	change_p: number;
}

interface EODHDProfile {
	code: string;
	name: string;
	exchange: string;
	country: string;
	currency: string;
	type: string;
	isin: string;
}

interface EODHDOptionsContract {
	symbol: string;
	contractName: string;
	strike: number;
	expiration: string;
	type: "call" | "put";
	lastPrice: number;
	bid: number;
	ask: number;
	volume: number;
	openInterest: number;
	impliedVolatility: number;
	delta: number;
	gamma: number;
	theta: number;
	vega: number;
	change: number;
	changePercent: number;
	inTheMoney: boolean;
	contractSize: number;
	timestamp: number;
}

/**
 * UnicornBay Enhanced Options Contract Interface
 * Supports 40+ fields from UnicornBay Options API
 */
interface UnicornBayOptionsContract {
	// Basic Option Details
	symbol: string;
	underlying_symbol: string;
	exp_date: string;
	type: "Call" | "Put";
	strike: number;
	exchange: string;
	currency: string;

	// Price Metrics
	open: number;
	high: number;
	low: number;
	last: number;
	bid: number;
	ask: number;
	volume: number;
	open_interest: number;

	// Advanced Greeks
	delta: number;
	gamma: number;
	theta: number;
	vega: number;
	rho: number;

	// Volatility Metrics
	implied_volatility: number;
	iv_change: number;
	iv_change_percent: number;

	// Additional UnicornBay Fields
	midpoint: number;
	theoretical_price: number;
	moneyness_ratio: number;
	days_to_expiration: number;
	trade_count: number;
	bid_size: number;
	ask_size: number;
	spread: number;
	spread_percent: number;

	// Time and Trade Data
	last_trade_time: string;
	timestamp: number;

	// Quality Indicators
	liquidity_score?: number;
	bid_ask_spread_quality?: "tight" | "moderate" | "wide";
	volume_quality?: "high" | "medium" | "low";
}

interface UnicornBayOptionsResponse {
	symbol: string;
	timestamp: number;
	contracts: UnicornBayOptionsContract[];
	metadata?: {
		total_contracts: number;
		data_quality: "excellent" | "good" | "fair" | "poor";
		api_calls_consumed: number;
		rate_limit_remaining: number;
	};
}

interface EODHDOptionsData {
	symbol: string;
	expiration: string;
	calls: EODHDOptionsContract[];
	puts: EODHDOptionsContract[];
	timestamp: number;
}

export class EODHDAPI implements FinancialDataProvider {
	public readonly name = "EODHD API";
	private apiKey: string;
	private baseUrl = "https://eodhd.com/api";
	private timeout: number;
	private retryAttempts: number;
	private retryDelay: number;
	private lastOptionsRequestTime: number = 0;
	private optionsRateLimitDelay: number = 500; // 500ms delay between options requests to avoid HTTP 429

	constructor(apiKey?: string, timeout: number = 8000, debugMode: boolean = false) {
		this.apiKey = apiKey || process.env.EODHD_API_KEY || "";
		this.timeout = timeout;
		this.retryAttempts = 3;
		this.retryDelay = 1000;

		if (!this.apiKey) {
			console.warn("⚠️ EODHD API: No API key provided. Some requests may fail.");
		}

		if (debugMode) {
			console.log("🔧 EODHD API initialized:", {
				hasApiKey: !!this.apiKey,
				timeout: this.timeout,
				baseUrl: this.baseUrl,
			});
		}
	}

	async getStockPrice(symbol: string): Promise<StockData | null> {
		try {
			console.log(`📈 EODHD API: Fetching stock price for ${symbol}`);

			const normalizedSymbol = symbol.toUpperCase();
			const url = `${this.baseUrl}/real-time/${normalizedSymbol}.US?api_token=${this.apiKey}&fmt=json`;

			const response = await this.makeRequest(url);

			if (!response.success || !response.data) {
				console.warn(`⚠️ EODHD API: No data received for ${symbol}`);
				return null;
			}

			const data = response.data as EODHDQuote;

			return {
				symbol: normalizedSymbol,
				price: data.close || 0,
				change: data.change || 0,
				changePercent: data.change_p || 0,
				volume: data.volume || 0,
				timestamp: data.timestamp ? data.timestamp * 1000 : Date.now(),
				source: "eodhd",
			};
		} catch (error) {
			console.error(`❌ EODHD API: Error fetching stock price for ${symbol}:`, error);
			return null;
		}
	}

	async getCompanyInfo(symbol: string): Promise<CompanyInfo | null> {
		try {
			console.log(`🏢 EODHD API: Fetching company info for ${symbol}`);

			const normalizedSymbol = symbol.toUpperCase();
			const url = `${this.baseUrl}/fundamentals/${normalizedSymbol}.US?api_token=${this.apiKey}&fmt=json`;

			const response = await this.makeRequest(url);

			if (!response.success || !response.data) {
				console.warn(`⚠️ EODHD API: No company info received for ${symbol}`);
				return null;
			}

			const data = response.data as any;

			return {
				symbol: normalizedSymbol,
				name: data.General?.Name || symbol,
				description: data.General?.Description || "",
				sector: data.General?.Sector || "",
				marketCap: data.Highlights?.MarketCapitalization || 0,
				employees: data.General?.EmployeeCount || undefined,
				website: data.General?.WebURL || undefined,
			};
		} catch (error) {
			console.error(`❌ EODHD API: Error fetching company info for ${symbol}:`, error);
			return null;
		}
	}

	/**
	 * Get fundamental ratios for a stock using EODHD fundamentals API
	 * Provides comprehensive financial ratios and metrics
	 */
	async getFundamentalRatios(symbol: string): Promise<FundamentalRatios | null> {
		try {
			console.log(`📊 EODHD API: Fetching fundamental ratios for ${symbol}`);

			if (!this.apiKey) {
				console.warn("⚠️ EODHD API: No API key provided for fundamental data");
				return null;
			}

			const normalizedSymbol = symbol.toUpperCase();
			const url = `${this.baseUrl}/fundamentals/${normalizedSymbol}.US?api_token=${this.apiKey}&fmt=json`;

			const response = await this.makeRequest(url);

			if (!response.success || !response.data) {
				console.warn(`⚠️ EODHD API: No fundamental data received for ${symbol}`);
				return null;
			}

			const data = response.data as any;

			// Extract ratios from EODHD fundamentals response
			const highlights = data.Highlights || {};
			const technicals = data.Technicals || {};
			const valuation = data.Valuation || {};
			const sharesStats = data.SharesStats || {};
			const ratios = data.Financials?.Balance_Sheet?.quarterly?.[0] || {};
			const incomeStatement = data.Financials?.Income_Statement?.quarterly?.[0] || {};

			// Helper function to safely parse numeric values
			const parseNumeric = (value: any): number | undefined => {
				if (
					value === null ||
					value === undefined ||
					value === "" ||
					value === "None" ||
					value === "N/A"
				) {
					return undefined;
				}
				const parsed = typeof value === "string" ? parseFloat(value) : Number(value);
				return isNaN(parsed) ? undefined : parsed;
			};

			// Map EODHD data to our standard FundamentalRatios format
			const result: FundamentalRatios = {
				symbol: normalizedSymbol,
				// Valuation ratios
				peRatio: parseNumeric(highlights.PERatio) ?? parseNumeric(valuation.TrailingPE),
				pegRatio: parseNumeric(highlights.PEGRatio),
				pbRatio:
					parseNumeric(highlights.PriceBookMRQ) ?? parseNumeric(valuation.PriceBookMRQ),
				priceToSales:
					parseNumeric(highlights.PriceSalesTTM) ?? parseNumeric(valuation.PriceSalesTTM),
				priceToFreeCashFlow: parseNumeric(valuation.PriceCashFlowMRQ),

				// Financial strength ratios
				debtToEquity: parseNumeric(highlights.DebtToEquity),
				currentRatio: parseNumeric(highlights.CurrentRatio),
				quickRatio: parseNumeric(highlights.QuickRatio),

				// Profitability ratios
				roe: parseNumeric(highlights.ReturnOnEquityTTM),
				roa: parseNumeric(highlights.ReturnOnAssetsTTM),
				grossProfitMargin: parseNumeric(highlights.GrossProfitMarginTTM),
				operatingMargin: parseNumeric(highlights.OperatingMarginTTM),
				netProfitMargin: parseNumeric(highlights.ProfitMarginTTM),

				// Dividend ratios
				dividendYield: parseNumeric(highlights.DividendYield),
				payoutRatio: parseNumeric(highlights.PayoutRatio),

				// Metadata
				timestamp: Date.now(),
				source: "eodhd",
				period: "ttm", // EODHD provides trailing twelve months data
			};

			// Log successful retrieval with data quality info
			const definedRatios = Object.values(result).filter(
				v => typeof v === "number" && !isNaN(v)
			).length;
			console.log(
				`✅ EODHD API: Retrieved ${definedRatios} fundamental ratios for ${symbol}`
			);

			return result;
		} catch (error) {
			console.error(`❌ EODHD API: Error fetching fundamental ratios for ${symbol}:`, error);
			return null;
		}
	}

	async getMarketData(): Promise<MarketData | null> {
		try {
			console.log("📊 EODHD API: Fetching market data");

			// Get major indices data
			const spyUrl = `${this.baseUrl}/real-time/SPY.US?api_token=${this.apiKey}&fmt=json`;
			const response = await this.makeRequest(spyUrl);

			if (!response.success || !response.data) {
				console.warn("⚠️ EODHD API: No market data received");
				return null;
			}

			const spyData = response.data as EODHDQuote;

			return {
				symbol: "SPY",
				open: spyData.open || 0,
				high: spyData.high || 0,
				low: spyData.low || 0,
				close: spyData.close || 0,
				volume: spyData.volume || 0,
				timestamp: Date.now(),
				source: "eodhd",
			};
		} catch (error) {
			console.error("❌ EODHD API: Error fetching market data:", error);
			return null;
		}
	}

	async healthCheck(): Promise<boolean> {
		try {
			console.log("🔍 EODHD API: Performing health check");

			if (!this.apiKey) {
				console.warn("⚠️ EODHD API: Health check failed - no API key");
				return false;
			}

			const url = `${this.baseUrl}/real-time/AAPL.US?api_token=${this.apiKey}&fmt=json`;
			const response = await this.makeRequest(url);

			const isHealthy = response.success && !!response.data;
			console.log(
				`${isHealthy ? "✅" : "❌"} EODHD API: Health check ${isHealthy ? "passed" : "failed"}`
			);

			return isHealthy;
		} catch (error) {
			console.error("❌ EODHD API: Health check failed:", error);
			return false;
		}
	}

	/**
	 * Simple rate limiting for options API requests
	 * Ensures minimum delay between consecutive options calls
	 */
	private async waitForOptionsRateLimit(): Promise<void> {
		const now = Date.now();
		const timeSinceLastRequest = now - this.lastOptionsRequestTime;

		if (timeSinceLastRequest < this.optionsRateLimitDelay) {
			const delayNeeded = this.optionsRateLimitDelay - timeSinceLastRequest;
			console.log(`⏱️ EODHD API: Rate limiting - waiting ${delayNeeded}ms before options request`);
			await new Promise(resolve => setTimeout(resolve, delayNeeded));
		}

		this.lastOptionsRequestTime = Date.now();
	}

	private async makeRequest(url: string, retryCount: number = 0): Promise<ApiResponse<any>> {
		try {
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), this.timeout);

			const response = await fetch(url, {
				signal: controller.signal,
				headers: {
					"User-Agent": "VFR-API/1.0",
				},
			});

			clearTimeout(timeoutId);

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const data = await response.json();

			return {
				success: true,
				data,
				source: "eodhd",
				timestamp: Date.now(),
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Unknown error";
			console.error(`❌ EODHD API: Request failed (attempt ${retryCount + 1}):`, error);

			// Don't retry on permanent failures (404, 400, 401, 403)
			const isPermanentFailure =
				errorMessage.includes("HTTP 404") || // Not found - resource doesn't exist
				errorMessage.includes("HTTP 400") || // Bad request - malformed URL
				errorMessage.includes("HTTP 401") || // Unauthorized - bad API key
				errorMessage.includes("HTTP 403");   // Forbidden - no access

			if (isPermanentFailure) {
				console.log(`⚠️ EODHD API: Permanent failure (${errorMessage}), not retrying`);
				return {
					success: false,
					error: errorMessage,
					source: "eodhd",
					timestamp: Date.now(),
				};
			}

			// Only retry on transient errors (5xx, timeouts, network issues)
			if (retryCount < this.retryAttempts) {
				console.log(`🔄 EODHD API: Retrying in ${this.retryDelay}ms...`);
				await new Promise(resolve => setTimeout(resolve, this.retryDelay));
				return this.makeRequest(url, retryCount + 1);
			}

			return {
				success: false,
				error: errorMessage,
				source: "eodhd",
				timestamp: Date.now(),
			};
		}
	}

	/**
	 * Get enhanced options chain data using UnicornBay API
	 * Provides 40+ fields per contract including advanced Greeks and liquidity metrics
	 */
	async getUnicornBayOptionsChain(
		symbol: string,
		options?: {
			expiration?: string;
			strikeMin?: number;
			strikeMax?: number;
			type?: "call" | "put";
			compact?: boolean;
		}
	): Promise<OptionsChain | null> {
		try {
			console.log(`🦄 EODHD UnicornBay: Fetching enhanced options chain for ${symbol}`);

			if (!this.apiKey) {
				console.warn("⚠️ EODHD UnicornBay: No API key for enhanced options data");
				return null;
			}

			// Apply rate limiting for options requests
			await this.waitForOptionsRateLimit();

			const normalizedSymbol = symbol.toUpperCase();
			// Use URL-encoded square brackets as required by UnicornBay API
			let url = `${this.baseUrl}/mp/unicornbay/options/contracts?filter%5Bunderlying_symbol%5D=${normalizedSymbol}`;

			// Add optional parameters using URL-encoded square brackets for UnicornBay filter format
			if (options?.expiration) {
				url += `&filter%5Bexp_date%5D=${options.expiration}`;
			} else {
				// Filter for active contracts only - no expired options (use today's date)
				const today = new Date().toISOString().split("T")[0]; // Format: YYYY-MM-DD
				url += `&filter%5Bexp_date_from%5D=${today}`;
			}
			if (options?.strikeMin) {
				url += `&filter%5Bstrike_gte%5D=${options.strikeMin}`;
			}
			if (options?.strikeMax) {
				url += `&filter%5Bstrike_lte%5D=${options.strikeMax}`;
			}
			if (options?.type) {
				url += `&filter%5Btype%5D=${options.type.toUpperCase()}`;
			}

			// Set page limit with URL-encoded square brackets
			if (options?.compact) {
				url += `&page%5Blimit%5D=10`;
			} else {
				url += `&page%5Blimit%5D=200`; // Limit to 200 options for connection testing
			}

			// Add sorting like in working example
			url += `&sort=exp_date`;

			// Add API token at the end to match working example
			url += `&api_token=${this.apiKey}`;

			console.log(`🦄 EODHD UnicornBay: Constructed URL for ${symbol}:`, url);
			const response = await this.makeRequest(url);

			if (!response.success || !response.data) {
				console.warn(
					`⚠️ EODHD UnicornBay: No enhanced options data received for ${symbol}`
				);
				console.log(`🦄 EODHD UnicornBay: Response details:`, response);
				return null;
			}

			const responseData = response.data as any;
			console.log(`🦄 EODHD UnicornBay: Response structure for ${symbol}:`, {
				hasContracts: !!responseData.contracts,
				contractCount: responseData.contracts?.length || 0,
				hasData: !!responseData.data,
				dataLength: Array.isArray(responseData.data) ? responseData.data.length : 0,
				dataKeys: Object.keys(responseData || {}),
			});

			// UnicornBay API returns data in a different structure - contracts are in the 'data' array
			const contracts = responseData.data || responseData.contracts || [];

			console.log(`🦄 EODHD UnicornBay: Contracts debug for ${symbol}:`, {
				contractsType: typeof contracts,
				contractsLength: Array.isArray(contracts) ? contracts.length : "not array",
				firstContract:
					Array.isArray(contracts) && contracts.length > 0
						? Object.keys(contracts[0] || {})
						: "none",
			});

			if (!contracts || !Array.isArray(contracts) || contracts.length === 0) {
				console.warn(`⚠️ EODHD UnicornBay: No contracts in response for ${symbol}`);
				console.log(
					`🦄 EODHD UnicornBay: Full response:`,
					JSON.stringify(responseData, null, 2)
				);
				return null;
			}

			// Construct the data object in the expected format
			const data = {
				symbol: symbol.toUpperCase(),
				timestamp: responseData.meta?.timestamp || Date.now(),
				contracts: contracts,
				metadata: responseData.meta,
			};

			// Transform UnicornBay contracts to our standard format
			// UnicornBay uses JSON:API format with id, type, attributes structure
			const transformUnicornBayContract = (contractData: any): OptionsContract => {
				// Extract the actual contract data from the attributes field
				const contract = contractData.attributes || contractData;
				// Calculate liquidity score based on volume and spread
				const liquidityScore = this.calculateLiquidityScore(contract);

				// Determine bid-ask spread quality
				const spreadQuality =
					contract.spread_percent <= 2
						? "tight"
						: contract.spread_percent <= 5
							? "moderate"
							: "wide";

				return {
					symbol: contract.symbol,
					strike: contract.strike,
					expiration: contract.exp_date,
					type: contract.type.toLowerCase() as "call" | "put",
					volume: contract.volume || 0,
					openInterest: contract.open_interest || 0,
					impliedVolatility: contract.implied_volatility,
					delta: contract.delta,
					gamma: contract.gamma,
					theta: contract.theta,
					vega: contract.vega,
					bid: contract.bid,
					ask: contract.ask,
					lastPrice: contract.last,
					change: contract.iv_change,
					changePercent: contract.iv_change_percent,
					timestamp: contract.timestamp || Date.now(),
					source: "eodhd-unicornbay",
					// Enhanced UnicornBay fields
					rho: contract.rho,
					midpoint: contract.midpoint,
					theoreticalPrice: contract.theoretical_price,
					moneynessRatio: contract.moneyness_ratio,
					daysToExpiration: contract.days_to_expiration,
					tradeCount: contract.trade_count,
					bidSize: contract.bid_size,
					askSize: contract.ask_size,
					spread: contract.spread,
					spreadPercent: contract.spread_percent,
					liquidityScore,
					bidAskSpreadQuality: spreadQuality,
					volumeQuality:
						contract.volume >= 100 ? "high" : contract.volume >= 20 ? "medium" : "low",
				} as OptionsContract & {
					rho?: number;
					midpoint?: number;
					theoreticalPrice?: number;
					moneynessRatio?: number;
					daysToExpiration?: number;
					tradeCount?: number;
					bidSize?: number;
					askSize?: number;
					spread?: number;
					spreadPercent?: number;
					liquidityScore?: number;
					bidAskSpreadQuality?: string;
					volumeQuality?: string;
				};
			};

			// Filter for current/future contracts only (exclude expired contracts)
			const currentDate = new Date();
			const validContracts = data.contracts.filter(c => {
				const contract = c.attributes || c;
				if (!contract.exp_date) return false;
				const expDate = new Date(contract.exp_date);
				return expDate > currentDate; // Only include non-expired contracts
			});

			console.log(
				`🦄 EODHD UnicornBay: Filtered ${data.contracts.length} total to ${validContracts.length} current contracts for ${symbol}`
			);

			// Separate calls and puts - handle JSON:API format with date filtering
			const calls = validContracts
				.filter(c => {
					const contract = c.attributes || c;
					return contract.type?.toLowerCase() === "call";
				})
				.map(transformUnicornBayContract)
				.sort((a, b) => a.strike - b.strike);

			const puts = validContracts
				.filter(c => {
					const contract = c.attributes || c;
					return contract.type?.toLowerCase() === "put";
				})
				.map(transformUnicornBayContract)
				.sort((a, b) => a.strike - b.strike);

			// Extract unique expiration dates and strikes - handle JSON:API format with date filtering
			const expirationDates = Array.from(
				new Set(
					validContracts.map(c => {
						const contract = c.attributes || c;
						return contract.exp_date;
					})
				)
			).sort();
			const strikes = Array.from(
				new Set(
					validContracts.map(c => {
						const contract = c.attributes || c;
						return contract.strike;
					})
				)
			).sort((a, b) => a - b);

			console.log(
				`✅ EODHD UnicornBay: Retrieved ${calls.length} calls, ${puts.length} puts for ${symbol}`
			);

			return {
				symbol: normalizedSymbol,
				calls,
				puts,
				expirationDates,
				strikes,
				timestamp: data.timestamp || Date.now(),
				source: "eodhd-unicornbay",
				metadata: data.metadata,
			} as OptionsChain & { metadata?: any };
		} catch (error) {
			console.error(
				`❌ EODHD UnicornBay: Error fetching enhanced options chain for ${symbol}:`,
				error
			);
			return null;
		}
	}

	/**
	 * Calculate liquidity score for UnicornBay options contract
	 * Combines volume, open interest, and bid-ask spread metrics
	 */
	private calculateLiquidityScore(contract: any): number {
		const volumeScore = Math.min(contract.volume / 1000, 1); // Normalize to 0-1
		const oiScore = Math.min(contract.open_interest / 5000, 1); // Normalize to 0-1
		const spreadScore = Math.max(0, 1 - contract.spread_percent / 10); // Inverse of spread %

		// Weighted average: 40% volume, 40% open interest, 20% spread
		return (volumeScore * 0.4 + oiScore * 0.4 + spreadScore * 0.2) * 10;
	}

	/**
	 * Get enhanced put/call ratio with UnicornBay data
	 * Provides more accurate ratios with 40+ fields per contract
	 */
	async getUnicornBayPutCallRatio(symbol: string): Promise<PutCallRatio | null> {
		try {
			console.log(`📊 EODHD UnicornBay: Fetching enhanced put/call ratio for ${symbol}`);

			const optionsChain = await this.getUnicornBayOptionsChain(symbol);
			if (!optionsChain) {
				console.warn(
					`⚠️ EODHD UnicornBay: No options chain data for put/call ratio calculation`
				);
				return null;
			}

			if (
				!optionsChain.calls ||
				!optionsChain.puts ||
				optionsChain.calls.length === 0 ||
				optionsChain.puts.length === 0
			) {
				console.warn(`⚠️ EODHD UnicornBay: Incomplete options data for ${symbol}`);
				return null;
			}

			// Calculate enhanced put/call ratios with UnicornBay data
			const totalCallVolume = optionsChain.calls.reduce(
				(sum, call) => sum + (call.volume || 0),
				0
			);
			const totalPutVolume = optionsChain.puts.reduce(
				(sum, put) => sum + (put.volume || 0),
				0
			);
			const totalCallOpenInterest = optionsChain.calls.reduce(
				(sum, call) => sum + (call.openInterest || 0),
				0
			);
			const totalPutOpenInterest = optionsChain.puts.reduce(
				(sum, put) => sum + (put.openInterest || 0),
				0
			);

			// Calculate weighted ratios based on liquidity scores
			const callsWithLiquidity = optionsChain.calls.filter(
				c => (c as any).liquidityScore > 2
			);
			const putsWithLiquidity = optionsChain.puts.filter(p => (p as any).liquidityScore > 2);

			const liquidCallVolume = callsWithLiquidity.reduce(
				(sum, call) => sum + (call.volume || 0),
				0
			);
			const liquidPutVolume = putsWithLiquidity.reduce(
				(sum, put) => sum + (put.volume || 0),
				0
			);

			const volumeRatio = totalCallVolume > 0 ? totalPutVolume / totalCallVolume : 0;
			const openInterestRatio =
				totalCallOpenInterest > 0 ? totalPutOpenInterest / totalCallOpenInterest : 0;
			const liquidVolumeRatio = liquidCallVolume > 0 ? liquidPutVolume / liquidCallVolume : 0;

			return {
				symbol: symbol.toUpperCase(),
				volumeRatio,
				openInterestRatio,
				totalPutVolume,
				totalCallVolume,
				totalPutOpenInterest,
				totalCallOpenInterest,
				date: new Date().toISOString().split("T")[0],
				timestamp: optionsChain.timestamp,
				source: "eodhd-unicornbay",
				metadata: {
					dataCompleteness: totalCallVolume + totalPutVolume > 0 ? 1.0 : 0.0,
					contractsProcessed: optionsChain.calls.length + optionsChain.puts.length,
					freeTierOptimized: false,
					liquidityFilteredRatio: liquidVolumeRatio,
					highLiquidityContracts: callsWithLiquidity.length + putsWithLiquidity.length,
					enhancedMetrics: {
						avgCallLiquidity:
							callsWithLiquidity.length > 0
								? callsWithLiquidity.reduce(
										(sum, c) => sum + ((c as any).liquidityScore || 0),
										0
									) / callsWithLiquidity.length
								: 0,
						avgPutLiquidity:
							putsWithLiquidity.length > 0
								? putsWithLiquidity.reduce(
										(sum, p) => sum + ((p as any).liquidityScore || 0),
										0
									) / putsWithLiquidity.length
								: 0,
					},
				},
			};
		} catch (error) {
			console.error(
				`❌ EODHD UnicornBay: Error fetching enhanced put/call ratio for ${symbol}:`,
				error
			);
			return null;
		}
	}

	/**
	 * Get put/call ratio for a symbol with UnicornBay enhancement
	 * Primary: UnicornBay API (enhanced accuracy), Fallback: Standard EODHD
	 * Requires EODHD options add-on subscription
	 *
	 * @param symbol Stock symbol
	 * @param useEnhanced Use UnicornBay enhanced data (default: true)
	 * @param asOfDate Optional date for historical data (enables caching)
	 */
	async getPutCallRatio(
		symbol: string,
		useEnhanced: boolean = true,
		asOfDate?: Date
	): Promise<PutCallRatio | null> {
		try {
			// Check if requesting historical data (>1 day ago)
			const isHistorical = asOfDate && this.isHistoricalDate(asOfDate);
			const dateStr = asOfDate ? this.formatDate(asOfDate) : new Date().toISOString().split('T')[0];

			console.log(`📊 EODHD API: Fetching put/call ratio for ${symbol}${isHistorical ? ` (historical: ${dateStr})` : ''}`);

			if (!this.apiKey) {
				console.warn("⚠️ EODHD API: No API key for options data");
				return null;
			}

			// Use cache for historical data
			if (isHistorical) {
				return await historicalCache.getOrFetch(
					"options",
					symbol,
					dateStr,
					async () => {
						return await this.fetchPutCallRatioFromAPI(symbol, useEnhanced);
					},
					"eodhd"
				);
			}

			// Fetch directly for current data (no cache)
			return await this.fetchPutCallRatioFromAPI(symbol, useEnhanced);
		} catch (error) {
			console.error(`❌ EODHD API: Error in getPutCallRatio for ${symbol}:`, error);
			return null;
		}
	}

	/**
	 * Internal method to fetch put/call ratio from API
	 * Separated from getPutCallRatio to enable caching
	 */
	private async fetchPutCallRatioFromAPI(
		symbol: string,
		useEnhanced: boolean = true
	): Promise<PutCallRatio | null> {
		try {
			// Try UnicornBay enhanced put/call ratio first if enabled
			if (useEnhanced) {
				console.log(`🦄 Attempting UnicornBay enhanced put/call ratio for ${symbol}`);
				const enhancedRatio = await this.getUnicornBayPutCallRatio(symbol);
				if (enhancedRatio) {
					console.log(`✅ Using UnicornBay enhanced put/call ratio for ${symbol}`);
					return enhancedRatio;
				}
				// UnicornBay failed - don't fallback to standard API (requires higher tier)
				console.log(
					`⚠️ UnicornBay data unavailable for ${symbol}, skipping options data (standard endpoint requires higher tier)`
				);
				return null;
			}

			// Fallback to standard EODHD options API (only if not using UnicornBay)
			const normalizedSymbol = symbol.toUpperCase();
			const url = `${this.baseUrl}/options/${normalizedSymbol}.US?api_token=${this.apiKey}&fmt=json`;

			const response = await this.makeRequest(url);

			if (!response.success || !response.data) {
				console.warn(`⚠️ EODHD API: No options data received for ${symbol}`);
				return null;
			}

			const data = response.data as EODHDOptionsData;

			if (!data.calls || !data.puts || data.calls.length === 0 || data.puts.length === 0) {
				console.warn(`⚠️ EODHD API: Incomplete options data for ${symbol}`);
				return null;
			}

			// Calculate put/call ratios
			const totalCallVolume = data.calls.reduce((sum, call) => sum + (call.volume || 0), 0);
			const totalPutVolume = data.puts.reduce((sum, put) => sum + (put.volume || 0), 0);
			const totalCallOpenInterest = data.calls.reduce(
				(sum, call) => sum + (call.openInterest || 0),
				0
			);
			const totalPutOpenInterest = data.puts.reduce(
				(sum, put) => sum + (put.openInterest || 0),
				0
			);

			const volumeRatio = totalCallVolume > 0 ? totalPutVolume / totalCallVolume : 0;
			const openInterestRatio =
				totalCallOpenInterest > 0 ? totalPutOpenInterest / totalCallOpenInterest : 0;

			console.log(`✅ EODHD API: Calculated put/call ratio for ${symbol} (standard data)`);

			return {
				symbol: normalizedSymbol,
				volumeRatio,
				openInterestRatio,
				totalPutVolume,
				totalCallVolume,
				totalPutOpenInterest,
				totalCallOpenInterest,
				date: new Date().toISOString().split("T")[0],
				timestamp: data.timestamp || Date.now(),
				source: "eodhd",
				metadata: {
					dataCompleteness: totalCallVolume + totalPutVolume > 0 ? 1.0 : 0.0,
					contractsProcessed: data.calls.length + data.puts.length,
					freeTierOptimized: false, // EODHD options is a paid add-on
				},
			};
		} catch (error) {
			console.error(`❌ EODHD API: Error fetching put/call ratio for ${symbol}:`, error);
			return null;
		}
	}

	/**
	 * Get basic options analysis for free tier users
	 * Uses aggregated options data to provide insights
	 */
	async getOptionsAnalysisFreeTier(symbol: string): Promise<OptionsAnalysis | null> {
		try {
			console.log(`📈 EODHD API: Fetching options analysis for ${symbol}`);

			const putCallRatio = await this.getPutCallRatio(symbol);
			if (!putCallRatio) {
				return null;
			}

			// Analyze sentiment based on put/call ratios
			let trend: "bullish" | "bearish" | "neutral" = "neutral";
			let sentiment: "fear" | "greed" | "balanced" = "balanced";
			let confidence = 0.5;
			let analysis = "";

			// Volume-based analysis
			if (putCallRatio.volumeRatio > 1.2) {
				trend = "bearish";
				sentiment = "fear";
				confidence = Math.min(0.8, 0.5 + (putCallRatio.volumeRatio - 1.2) * 0.3);
				analysis = `High put/call volume ratio (${putCallRatio.volumeRatio.toFixed(2)}) suggests bearish sentiment and potential fear in the market.`;
			} else if (putCallRatio.volumeRatio < 0.8) {
				trend = "bullish";
				sentiment = "greed";
				confidence = Math.min(0.8, 0.5 + (0.8 - putCallRatio.volumeRatio) * 0.3);
				analysis = `Low put/call volume ratio (${putCallRatio.volumeRatio.toFixed(2)}) indicates bullish sentiment and market optimism.`;
			} else {
				analysis = `Balanced put/call volume ratio (${putCallRatio.volumeRatio.toFixed(2)}) suggests neutral market sentiment.`;
			}

			// Enhance analysis with open interest data
			if (putCallRatio.openInterestRatio !== putCallRatio.volumeRatio) {
				const oiDifference = Math.abs(
					putCallRatio.openInterestRatio - putCallRatio.volumeRatio
				);
				if (oiDifference > 0.3) {
					analysis += ` Open interest ratio (${putCallRatio.openInterestRatio.toFixed(2)}) differs significantly from volume ratio, indicating potential shift in positioning.`;
					confidence = Math.max(0.3, confidence - 0.2);
				}
			}

			return {
				symbol,
				currentRatio: putCallRatio,
				historicalRatios: [putCallRatio], // Limited historical data for free tier
				trend,
				sentiment,
				confidence,
				analysis,
				timestamp: Date.now(),
				source: "eodhd",
				freeTierLimited: false, // EODHD options is a paid add-on
			};
		} catch (error) {
			console.error(`❌ EODHD API: Error fetching options analysis for ${symbol}:`, error);
			return null;
		}
	}

	/**
	 * Get options chain data for a symbol with UnicornBay enhancement
	 * Primary: UnicornBay API (40+ fields), Fallback: Standard EODHD options
	 * Requires EODHD options add-on subscription
	 */
	async getOptionsChain(
		symbol: string,
		expiration?: string,
		useEnhanced: boolean = true
	): Promise<OptionsChain | null> {
		try {
			console.log(
				`🔗 EODHD API: Fetching options chain for ${symbol}${expiration ? ` expiring ${expiration}` : ""}`
			);

			if (!this.apiKey) {
				console.warn("⚠️ EODHD API: No API key for options data");
				return null;
			}

			// Try UnicornBay enhanced API first if enabled
			if (useEnhanced) {
				console.log(`🦄 Attempting UnicornBay enhanced options data for ${symbol}`);
				const enhancedData = await this.getUnicornBayOptionsChain(symbol, { expiration });
				if (enhancedData) {
					console.log(`✅ Using UnicornBay enhanced data for ${symbol}`);
					return enhancedData;
				}
				console.log(
					`⚠️ UnicornBay data unavailable, falling back to standard EODHD for ${symbol}`
				);
			}

			// Fallback to standard EODHD options API
			const normalizedSymbol = symbol.toUpperCase();
			let url = `${this.baseUrl}/options/${normalizedSymbol}.US?api_token=${this.apiKey}&fmt=json`;

			if (expiration) {
				url += `&date=${expiration}`;
			}

			const response = await this.makeRequest(url);

			if (!response.success || !response.data) {
				console.warn(`⚠️ EODHD API: No options chain data received for ${symbol}`);
				return null;
			}

			const data = response.data as EODHDOptionsData;

			if (!data.calls || !data.puts) {
				console.warn(`⚠️ EODHD API: Incomplete options chain data for ${symbol}`);
				return null;
			}

			// Transform EODHD contracts to our standard format
			const transformContract = (contract: EODHDOptionsContract): OptionsContract => ({
				symbol: contract.symbol,
				strike: contract.strike,
				expiration: contract.expiration,
				type: contract.type,
				volume: contract.volume || 0,
				openInterest: contract.openInterest || 0,
				impliedVolatility: contract.impliedVolatility,
				delta: contract.delta,
				gamma: contract.gamma,
				theta: contract.theta,
				vega: contract.vega,
				bid: contract.bid,
				ask: contract.ask,
				lastPrice: contract.lastPrice,
				change: contract.change,
				changePercent: contract.changePercent,
				timestamp: contract.timestamp || Date.now(),
				source: "eodhd",
			});

			const calls = data.calls.map(transformContract);
			const puts = data.puts.map(transformContract);

			// Extract unique expiration dates and strikes
			const expirationDates = Array.from(
				new Set([...calls, ...puts].map(c => c.expiration))
			).sort();
			const strikes = Array.from(new Set([...calls, ...puts].map(c => c.strike))).sort(
				(a, b) => a - b
			);

			console.log(
				`✅ EODHD API: Retrieved ${calls.length} calls, ${puts.length} puts for ${symbol} (standard data)`
			);

			return {
				symbol: normalizedSymbol,
				calls,
				puts,
				expirationDates,
				strikes,
				timestamp: data.timestamp || Date.now(),
				source: "eodhd",
			};
		} catch (error) {
			console.error(`❌ EODHD API: Error fetching options chain for ${symbol}:`, error);
			return null;
		}
	}

	/**
	 * Get UnicornBay options flow data for market sentiment analysis
	 * Provides aggregated options flow metrics for institutional sentiment
	 */
	async getUnicornBayOptionsFlow(
		symbols: string[],
		timeframe: "1D" | "5D" | "1M" = "1D"
	): Promise<
		| {
				symbol: string;
				flowMetrics: {
					callFlow: number;
					putFlow: number;
					netFlow: number;
					flowRatio: number;
					unusualActivity: boolean;
					institutionalSentiment: "bullish" | "bearish" | "neutral";
				};
				timestamp: number;
		  }[]
		| null
	> {
		try {
			console.log(
				`📊 EODHD UnicornBay: Fetching options flow data for ${symbols.length} symbols`
			);

			if (!this.apiKey) {
				console.warn("⚠️ EODHD UnicornBay: No API key for options flow data");
				return null;
			}

			const flowData = [];

			for (const symbol of symbols) {
				const optionsChain = await this.getUnicornBayOptionsChain(symbol);
				if (!optionsChain) continue;

				// Calculate options flow metrics
				const callFlow = optionsChain.calls.reduce((sum, c) => {
					const contract = c as any;
					return sum + (contract.volume || 0) * (contract.midpoint || c.lastPrice || 0);
				}, 0);

				const putFlow = optionsChain.puts.reduce((sum, p) => {
					const contract = p as any;
					return sum + (contract.volume || 0) * (contract.midpoint || p.lastPrice || 0);
				}, 0);

				const netFlow = callFlow - putFlow;
				const flowRatio = putFlow > 0 ? callFlow / putFlow : callFlow > 0 ? 10 : 1;

				// Detect unusual activity based on volume and liquidity scores
				const avgCallLiquidity =
					optionsChain.calls.length > 0
						? optionsChain.calls.reduce(
								(sum, c) => sum + ((c as any).liquidityScore || 0),
								0
							) / optionsChain.calls.length
						: 0;
				const avgPutLiquidity =
					optionsChain.puts.length > 0
						? optionsChain.puts.reduce(
								(sum, p) => sum + ((p as any).liquidityScore || 0),
								0
							) / optionsChain.puts.length
						: 0;

				const unusualActivity =
					avgCallLiquidity > 7 || avgPutLiquidity > 7 || Math.abs(flowRatio - 1) > 2;

				// Determine institutional sentiment
				let institutionalSentiment: "bullish" | "bearish" | "neutral" = "neutral";
				if (flowRatio > 1.5) {
					institutionalSentiment = "bullish";
				} else if (flowRatio < 0.67) {
					institutionalSentiment = "bearish";
				}

				flowData.push({
					symbol: symbol.toUpperCase(),
					flowMetrics: {
						callFlow,
						putFlow,
						netFlow,
						flowRatio,
						unusualActivity,
						institutionalSentiment,
					},
					timestamp: Date.now(),
				});
			}

			console.log(
				`✅ EODHD UnicornBay: Calculated options flow for ${flowData.length} symbols`
			);
			return flowData;
		} catch (error) {
			console.error("❌ EODHD UnicornBay: Error fetching options flow data:", error);
			return null;
		}
	}

	/**
	 * Get UnicornBay options Greeks analysis for risk management
	 * Provides portfolio-level Greeks aggregation
	 */
	async getUnicornBayGreeksAnalysis(
		symbol: string,
		expirations?: string[]
	): Promise<{
		symbol: string;
		portfolioGreeks: {
			totalDelta: number;
			totalGamma: number;
			totalTheta: number;
			totalVega: number;
			totalRho: number;
			netGamma: number; // calls - puts
			gammaExposure: number; // market maker exposure estimate
		};
		riskMetrics: {
			pinRisk: number; // clustering around strikes
			gammaSqueezeRisk: number; // potential for gamma squeeze
			volatilityRisk: "low" | "medium" | "high";
		};
		timestamp: number;
	} | null> {
		try {
			console.log(`📈 EODHD UnicornBay: Fetching Greeks analysis for ${symbol}`);

			const optionsChain = await this.getUnicornBayOptionsChain(symbol);
			if (!optionsChain) {
				console.warn(`⚠️ EODHD UnicornBay: No options data for Greeks analysis`);
				return null;
			}

			// Filter by expirations if specified
			let calls = optionsChain.calls;
			let puts = optionsChain.puts;

			if (expirations && expirations.length > 0) {
				calls = calls.filter(c => expirations.includes(c.expiration));
				puts = puts.filter(p => expirations.includes(p.expiration));
			}

			// Calculate portfolio-level Greeks
			const totalDelta =
				calls.reduce((sum, c) => sum + (c.delta || 0) * (c.volume || 0), 0) +
				puts.reduce((sum, p) => sum + (p.delta || 0) * (p.volume || 0), 0);

			const totalGamma =
				calls.reduce((sum, c) => sum + (c.gamma || 0) * (c.volume || 0), 0) +
				puts.reduce((sum, p) => sum + (p.gamma || 0) * (p.volume || 0), 0);

			const totalTheta =
				calls.reduce((sum, c) => sum + (c.theta || 0) * (c.volume || 0), 0) +
				puts.reduce((sum, p) => sum + (p.theta || 0) * (p.volume || 0), 0);

			const totalVega =
				calls.reduce((sum, c) => sum + (c.vega || 0) * (c.volume || 0), 0) +
				puts.reduce((sum, p) => sum + (p.vega || 0) * (p.volume || 0), 0);

			const callGamma = calls.reduce((sum, c) => sum + (c.gamma || 0) * (c.volume || 0), 0);
			const putGamma = puts.reduce((sum, p) => sum + (p.gamma || 0) * (p.volume || 0), 0);
			const netGamma = callGamma - putGamma;

			// Estimate market maker gamma exposure
			const gammaExposure = Math.abs(netGamma) * 100; // Simplified calculation

			// Calculate risk metrics
			const strikes = Array.from(new Set([...calls, ...puts].map(c => c.strike)));
			const strikeDistribution = strikes.map(strike => {
				const strikeVolume = [...calls, ...puts]
					.filter(c => c.strike === strike)
					.reduce((sum, c) => sum + (c.volume || 0), 0);
				return { strike, volume: strikeVolume };
			});

			// Pin risk: concentration around specific strikes
			const maxStrikeVolume = Math.max(...strikeDistribution.map(s => s.volume));
			const totalVolume = strikeDistribution.reduce((sum, s) => sum + s.volume, 0);
			const pinRisk = totalVolume > 0 ? maxStrikeVolume / totalVolume : 0;

			// Gamma squeeze risk: high gamma concentration
			const gammaSqueezeRisk = Math.abs(netGamma) / Math.max(totalGamma, 1);

			// Volatility risk based on implied volatility dispersion
			const ivs = [...calls, ...puts].map(c => c.impliedVolatility || 0).filter(iv => iv > 0);
			const avgIV = ivs.reduce((sum, iv) => sum + iv, 0) / ivs.length;
			const ivStdDev = Math.sqrt(
				ivs.reduce((sum, iv) => sum + Math.pow(iv - avgIV, 2), 0) / ivs.length
			);
			const volatilityRisk = ivStdDev > 0.3 ? "high" : ivStdDev > 0.15 ? "medium" : "low";

			// Extract Rho from enhanced contracts
			const totalRho = [...calls, ...puts].reduce((sum, contract) => {
				const enhancedContract = contract as any;
				return sum + (enhancedContract.rho || 0) * (contract.volume || 0);
			}, 0);

			console.log(`✅ EODHD UnicornBay: Calculated Greeks analysis for ${symbol}`);

			return {
				symbol: symbol.toUpperCase(),
				portfolioGreeks: {
					totalDelta,
					totalGamma,
					totalTheta,
					totalVega,
					totalRho,
					netGamma,
					gammaExposure,
				},
				riskMetrics: {
					pinRisk,
					gammaSqueezeRisk,
					volatilityRisk,
				},
				timestamp: Date.now(),
			};
		} catch (error) {
			console.error(
				`❌ EODHD UnicornBay: Error fetching Greeks analysis for ${symbol}:`,
				error
			);
			return null;
		}
	}

	/**
	 * Get UnicornBay implied volatility surface data
	 * Provides IV analysis across strikes and expirations
	 */
	async getUnicornBayIVSurface(symbol: string): Promise<{
		symbol: string;
		ivSurface: Array<{
			expiration: string;
			daysToExpiration: number;
			strikes: Array<{
				strike: number;
				callIV: number | null;
				putIV: number | null;
				callVolume: number;
				putVolume: number;
				moneyness: number;
			}>;
			avgIV: number;
			skew: number; // put vs call IV difference
		}>;
		marketMetrics: {
			atmIV: number; // at-the-money implied volatility
			ivRank: number; // IV percentile (estimated)
			termStructure: "normal" | "inverted" | "flat";
			skewDirection: "put" | "call" | "neutral";
		};
		timestamp: number;
	} | null> {
		try {
			console.log(`📊 EODHD UnicornBay: Fetching IV surface for ${symbol}`);

			const optionsChain = await this.getUnicornBayOptionsChain(symbol);
			if (!optionsChain) {
				console.warn(`⚠️ EODHD UnicornBay: No options data for IV surface`);
				return null;
			}

			// Get current stock price for moneyness calculation
			const stockData = await this.getStockPrice(symbol);
			const currentPrice = stockData?.price || 100; // fallback price

			// Group by expiration
			const expirationGroups = new Map<string, { calls: any[]; puts: any[] }>();

			optionsChain.calls.forEach(call => {
				if (!expirationGroups.has(call.expiration)) {
					expirationGroups.set(call.expiration, { calls: [], puts: [] });
				}
				expirationGroups.get(call.expiration)!.calls.push(call);
			});

			optionsChain.puts.forEach(put => {
				if (!expirationGroups.has(put.expiration)) {
					expirationGroups.set(put.expiration, { calls: [], puts: [] });
				}
				expirationGroups.get(put.expiration)!.puts.push(put);
			});

			const ivSurface = Array.from(expirationGroups.entries())
				.map(([expiration, { calls, puts }]) => {
					// Calculate days to expiration
					const daysToExpiration = Math.max(
						1,
						Math.round(
							(new Date(expiration).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
						)
					);

					// Get all strikes for this expiration
					const allStrikes = Array.from(
						new Set([...calls.map(c => c.strike), ...puts.map(p => p.strike)])
					).sort((a, b) => a - b);

					const strikes = allStrikes.map(strike => {
						const call = calls.find(c => c.strike === strike);
						const put = puts.find(p => p.strike === strike);

						return {
							strike,
							callIV: call?.impliedVolatility || null,
							putIV: put?.impliedVolatility || null,
							callVolume: call?.volume || 0,
							putVolume: put?.volume || 0,
							moneyness: strike / currentPrice,
						};
					});

					// Calculate average IV for this expiration
					const validIVs = strikes
						.flatMap(s => [s.callIV, s.putIV])
						.filter(iv => iv !== null) as number[];
					const avgIV =
						validIVs.length > 0
							? validIVs.reduce((sum, iv) => sum + iv, 0) / validIVs.length
							: 0;

					// Calculate skew (put vs call IV difference at similar moneyness)
					const atmStrikes = strikes.filter(
						s => s.moneyness >= 0.95 && s.moneyness <= 1.05
					);
					const atmCallIVs = atmStrikes
						.map(s => s.callIV)
						.filter(iv => iv !== null) as number[];
					const atmPutIVs = atmStrikes
						.map(s => s.putIV)
						.filter(iv => iv !== null) as number[];

					const avgCallIV =
						atmCallIVs.length > 0
							? atmCallIVs.reduce((sum, iv) => sum + iv, 0) / atmCallIVs.length
							: 0;
					const avgPutIV =
						atmPutIVs.length > 0
							? atmPutIVs.reduce((sum, iv) => sum + iv, 0) / atmPutIVs.length
							: 0;
					const skew = avgPutIV - avgCallIV;

					return {
						expiration,
						daysToExpiration,
						strikes,
						avgIV,
						skew,
					};
				})
				.sort((a, b) => a.daysToExpiration - b.daysToExpiration);

			// Calculate market-level metrics
			const allIVs = ivSurface
				.flatMap(exp => exp.strikes.flatMap(s => [s.callIV, s.putIV]))
				.filter(iv => iv !== null) as number[];
			const atmIV =
				allIVs.length > 0 ? allIVs.reduce((sum, iv) => sum + iv, 0) / allIVs.length : 0;

			// Simplified IV rank (would need historical data for accurate calculation)
			const ivRank = Math.min(100, Math.max(0, ((atmIV - 0.15) / 0.5) * 100));

			// Term structure analysis
			const shortTermIV = ivSurface.find(exp => exp.daysToExpiration <= 30)?.avgIV || 0;
			const longTermIV = ivSurface.find(exp => exp.daysToExpiration >= 60)?.avgIV || 0;
			const termStructure =
				shortTermIV > longTermIV
					? "inverted"
					: Math.abs(shortTermIV - longTermIV) < 0.02
						? "flat"
						: "normal";

			// Overall skew direction
			const avgSkew = ivSurface.reduce((sum, exp) => sum + exp.skew, 0) / ivSurface.length;
			const skewDirection = avgSkew > 0.02 ? "put" : avgSkew < -0.02 ? "call" : "neutral";

			console.log(`✅ EODHD UnicornBay: Calculated IV surface for ${symbol}`);

			return {
				symbol: symbol.toUpperCase(),
				ivSurface,
				marketMetrics: {
					atmIV,
					ivRank,
					termStructure,
					skewDirection,
				},
				timestamp: Date.now(),
			};
		} catch (error) {
			console.error(`❌ EODHD UnicornBay: Error fetching IV surface for ${symbol}:`, error);
			return null;
		}
	}

	/**
	 * Check options data availability including UnicornBay enhanced features
	 */
	async checkOptionsAvailability(): Promise<{ [key: string]: boolean | string }> {
		try {
			console.log("🔍 EODHD API: Checking options availability");

			if (!this.apiKey) {
				return {
					putCallRatio: false,
					optionsAnalysis: false,
					optionsChain: false,
					unicornBayEnhanced: false,
					unicornBayGreeks: false,
					unicornBayIVSurface: false,
					unicornBayOptionsFlow: false,
					error: false,
				};
			}

			// Test standard EODHD options with SPY - most liquid options
			console.log("🧪 Testing standard EODHD options availability...");
			const standardTestResult = await this.getPutCallRatio("SPY", false); // Force standard API
			const standardAvailable = standardTestResult !== null;

			// Test UnicornBay enhanced options
			console.log("🦄 Testing UnicornBay enhanced options availability...");
			const unicornBayTestResult = await this.getUnicornBayOptionsChain("SPY");
			const unicornBayAvailable = unicornBayTestResult !== null;

			// Test UnicornBay advanced features if basic is available
			let greeksAvailable = false;
			let ivSurfaceAvailable = false;
			let optionsFlowAvailable = false;

			if (unicornBayAvailable) {
				console.log("🧪 Testing UnicornBay advanced features...");

				try {
					const greeksTest = await this.getUnicornBayGreeksAnalysis("SPY");
					greeksAvailable = greeksTest !== null;
				} catch (error) {
					console.warn("⚠️ UnicornBay Greeks analysis test failed:", error);
				}

				try {
					const ivSurfaceTest = await this.getUnicornBayIVSurface("SPY");
					ivSurfaceAvailable = ivSurfaceTest !== null;
				} catch (error) {
					console.warn("⚠️ UnicornBay IV Surface test failed:", error);
				}

				try {
					const optionsFlowTest = await this.getUnicornBayOptionsFlow(["SPY"]);
					optionsFlowAvailable = optionsFlowTest !== null && optionsFlowTest.length > 0;
				} catch (error) {
					console.warn("⚠️ UnicornBay Options Flow test failed:", error);
				}
			}

			const availability = {
				// Standard EODHD options
				putCallRatio: standardAvailable,
				optionsAnalysis: standardAvailable,
				optionsChain: standardAvailable,

				// UnicornBay enhanced features
				unicornBayEnhanced: unicornBayAvailable,
				unicornBayGreeks: greeksAvailable,
				unicornBayIVSurface: ivSurfaceAvailable,
				unicornBayOptionsFlow: optionsFlowAvailable,

				// Metadata
				requiresSubscription: true, // EODHD options data requires add-on subscription
				unicornBayRequiresMarketplace: true, // UnicornBay is a marketplace add-on
				enhancedFeaturesRecommended: unicornBayAvailable,
				dataQuality: unicornBayAvailable
					? "enhanced"
					: standardAvailable
						? "standard"
						: "unavailable",
			};

			console.log(`✅ EODHD Options Availability Check Complete:`, {
				standard: standardAvailable,
				unicornBay: unicornBayAvailable,
				advancedFeatures: greeksAvailable || ivSurfaceAvailable || optionsFlowAvailable,
			});

			return availability;
		} catch (error) {
			console.error("❌ EODHD API: Error checking options availability:", error);
			return {
				putCallRatio: false,
				optionsAnalysis: false,
				optionsChain: false,
				unicornBayEnhanced: false,
				unicornBayGreeks: false,
				unicornBayIVSurface: false,
				unicornBayOptionsFlow: false,
				error: true,
				errorMessage: error instanceof Error ? error.message : "Unknown error",
			};
		}
	}

	/**
	 * Check if a date is historical (more than 1 day in the past)
	 */
	private isHistoricalDate(date: Date): boolean {
		const yesterday = new Date();
		yesterday.setDate(yesterday.getDate() - 1);
		return date < yesterday;
	}

	/**
	 * Format date as YYYY-MM-DD
	 */
	private formatDate(date: Date): string {
		return date.toISOString().split('T')[0];
	}

	getName(): string {
		return "EODHD API";
	}

	getSource(): string {
		return "eodhd";
	}
}
