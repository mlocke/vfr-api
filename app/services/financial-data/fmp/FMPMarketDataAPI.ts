/**
 * FMP Market Data API
 * Handles price quotes, market data, and historical OHLCV data
 */

import { BaseFinancialDataProvider } from "../BaseFinancialDataProvider";
import {
	StockData,
	MarketData,
	ApiResponse,
} from "../types";
import { redisCache } from "../../cache/RedisCache";
import { createApiErrorHandler } from "../../error-handling";
import securityValidator from "../../security/SecurityValidator";

export class FMPMarketDataAPI extends BaseFinancialDataProvider {
	name = "Financial Modeling Prep - Market Data";
	private errorHandler = createApiErrorHandler("fmp-market-data");

	constructor(apiKey?: string, timeout?: number, throwErrors?: boolean) {
		super({
			apiKey: apiKey || process.env.FMP_API_KEY || "",
			timeout: timeout || 15000,
			throwErrors: throwErrors || false,
			baseUrl: "https://financialmodelingprep.com/api/v3",
		});
	}

	protected getSourceIdentifier(): string {
		return "fmp";
	}

	/**
	 * Build cache key for historical data
	 * Historical data is immutable and cacheable for long periods
	 */
	private buildHistoricalCacheKey(symbol: string, limit: number, endDate?: Date): string {
		const dateKey = endDate ? endDate.toISOString().split("T")[0] : "latest";
		return `fmp:historical:${symbol.toUpperCase()}:${limit}:${dateKey}`;
	}

	/**
	 * Make HTTP request to FMP API
	 */
	private async makeRequest(
		endpoint: string,
		apiVersion: "v3" | "v4" = "v3"
	): Promise<ApiResponse<any>> {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), this.timeout);

		try {
			const baseUrl =
				apiVersion === "v4" ? "https://financialmodelingprep.com/api/v4" : this.baseUrl;
			const url = new URL(`${baseUrl}${endpoint}`);
			url.searchParams.append("apikey", this.apiKey);

			const response = await fetch(url.toString(), {
				signal: controller.signal,
				headers: {
					Accept: "application/json",
					"User-Agent": "VFR-API/1.0",
				},
			});

			clearTimeout(timeoutId);

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const data = await response.json();

			// Enhanced FMP error detection
			if (data?.["Error Message"]) {
				throw new Error(data["Error Message"]);
			}

			if (data?.error) {
				throw new Error(data.error);
			}

			// Enhanced rate limit detection
			if (typeof data === "string") {
				if (data.includes("limit") || data.includes("exceeded") || data.includes("quota")) {
					throw new Error("API rate limit exceeded");
				}
				if (data.includes("invalid") && data.includes("key")) {
					throw new Error("Invalid API key");
				}
				if (data.includes("not found") || data.includes("404")) {
					throw new Error("Symbol not found");
				}
			}

			// Check for empty or insufficient data responses
			if (Array.isArray(data) && data.length === 0) {
				this.errorHandler.logger.debug("FMP returned empty array response");
			}

			return {
				success: true,
				data,
				source: "fmp",
				timestamp: Date.now(),
			};
		} catch (error) {
			clearTimeout(timeoutId);

			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
				source: "fmp",
				timestamp: Date.now(),
			};
		}
	}

	/**
	 * Validate FMP response for stock price data
	 */
	private validateFMPStockPrice(
		data: any,
		symbol: string
	): { isValid: boolean; errors: string[] } {
		const errors: string[] = [];

		if (!data) {
			errors.push("No data received from FMP API");
			return { isValid: false, errors };
		}

		if (!data.price || typeof data.price !== "number" || data.price <= 0) {
			errors.push("Invalid or missing stock price");
		}

		if (!data.symbol || data.symbol.toUpperCase() !== symbol.toUpperCase()) {
			errors.push("Symbol mismatch in response");
		}

		if (
			data.timestamp &&
			(typeof data.timestamp !== "number" || data.timestamp > Date.now() + 86400000)
		) {
			errors.push("Invalid timestamp in response");
		}

		return { isValid: errors.length === 0, errors };
	}

	/**
	 * Detect FMP plan type based on rate limits or environment
	 */
	private detectPlanType(rateLimit?: number): "basic" | "starter" | "professional" {
		const envPlan = process.env.FMP_PLAN?.toLowerCase();
		if (envPlan === "professional" || (rateLimit && rateLimit >= 600))
			return "professional";
		if (envPlan === "starter" || (rateLimit && rateLimit >= 300)) return "starter";
		return "basic";
	}

	/**
	 * Calculate optimal batch configuration based on plan type and request volume
	 */
	private calculateOptimalBatchConfig(
		planType: "basic" | "starter" | "professional",
		totalSymbols: number,
		priorityMode = false
	): {
		batchSize: number;
		maxConcurrentBatches: number;
		requestInterval: number;
		batchInterval: number;
		utilizationTarget: number;
	} {
		const config = {
			basic: {
				batchSize: 10,
				maxConcurrentBatches: 1,
				requestInterval: 100,
				batchInterval: 250,
				utilizationTarget: 70,
			},
			starter: {
				batchSize: 25,
				maxConcurrentBatches: 2,
				requestInterval: 50,
				batchInterval: 150,
				utilizationTarget: 80,
			},
			professional: {
				batchSize: 50,
				maxConcurrentBatches: 3,
				requestInterval: 20,
				batchInterval: 75,
				utilizationTarget: 90,
			},
		};

		const baseConfig = config[planType];

		// Adjust for priority mode
		if (priorityMode) {
			return {
				...baseConfig,
				maxConcurrentBatches: Math.max(1, baseConfig.maxConcurrentBatches - 1),
				requestInterval: baseConfig.requestInterval * 1.5,
				utilizationTarget: baseConfig.utilizationTarget * 0.8,
			};
		}

		return baseConfig;
	}

	/**
	 * Get current stock price data
	 */
	async getStockPrice(symbol: string): Promise<StockData | null> {
		try {
			this.validateApiKey();
			const normalizedSymbol = this.normalizeSymbol(symbol);

			const response = await this.makeRequest(`/quote/${normalizedSymbol}`);

			if (!this.validateResponse(response, "array")) {
				return null;
			}

			const quote = response.data[0];

			// Enhanced FMP-specific validation
			const stockData = {
				symbol: normalizedSymbol,
				price: Number(this.parseNumeric(quote.price).toFixed(2)),
				change: Number(this.parseNumeric(quote.change).toFixed(2)),
				changePercent: Number(this.parseNumeric(quote.changesPercentage).toFixed(2)),
				volume: this.parseInt(quote.volume),
				timestamp: quote.timestamp
					? new Date(quote.timestamp * 1000).getTime()
					: Date.now(),
				source: this.getSourceIdentifier(),
			};

			const validation = this.validateFMPStockPrice(stockData, normalizedSymbol);
			if (!validation.isValid) {
				this.errorHandler.logger.warn("FMP stock price validation failed", {
					symbol: normalizedSymbol,
					errors: validation.errors,
				});
				return null;
			}

			return stockData;
		} catch (error) {
			return this.handleApiError(error, symbol, "stock price", null);
		}
	}

	/**
	 * Get detailed market data
	 */
	async getMarketData(symbol: string): Promise<MarketData | null> {
		try {
			if (!this.apiKey) {
				const error = new Error("Financial Modeling Prep API key not configured");
				console.warn(error.message);
				if (this.throwErrors) throw error;
				return null;
			}

			// Use the historical price endpoint for OHLC data - 1 year of data (~252 trading days)
			const response = await this.makeRequest(
				`/historical-price-full?symbol=${symbol.toUpperCase()}&limit=365`
			);

			if (!response.success) {
				const error = new Error(
					response.error || "Financial Modeling Prep API request failed"
				);
				if (this.throwErrors) throw error;
				return null;
			}

			if (
				!response.data?.historical ||
				!Array.isArray(response.data.historical) ||
				response.data.historical.length === 0
			) {
				const error = new Error(
					"Invalid historical data response from Financial Modeling Prep API"
				);
				if (this.throwErrors) throw error;
				return null;
			}

			// Get the most recent trading day (first item in the historical array)
			const historical = response.data.historical[0];

			// Store full historical data for future use (365 days now cached)
			this.errorHandler.logger.info(
				`FMP: Fetched ${response.data.historical.length} days of historical data for ${symbol}`,
				{
					symbol,
					daysRetrieved: response.data.historical.length,
				}
			);

			return {
				symbol: symbol.toUpperCase(),
				open: parseFloat(historical.open || "0"),
				high: parseFloat(historical.high || "0"),
				low: parseFloat(historical.low || "0"),
				close: parseFloat(historical.close || "0"),
				volume: parseInt(historical.volume || "0"),
				timestamp: new Date(historical.date).getTime(),
				source: "fmp",
			};
		} catch (error) {
			this.errorHandler.logger.logApiError("GET", "market_data", error, undefined, {
				symbol,
			});
			if (this.throwErrors) throw error;
			return null;
		}
	}

	/**
	 * Get historical data for a symbol (returns array of daily data)
	 * @param symbol Stock symbol
	 * @param limit Number of days to retrieve (default: 365)
	 * @param endDate Optional end date for historical data (default: today)
	 */
	async getHistoricalData(
		symbol: string,
		limit: number = 365,
		endDate?: Date
	): Promise<MarketData[]> {
		try {
			if (!this.apiKey) {
				const error = new Error("Financial Modeling Prep API key not configured");
				console.warn(error.message);
				if (this.throwErrors) throw error;
				return [];
			}

			// 1. BUILD CACHE KEY
			const cacheKey = this.buildHistoricalCacheKey(symbol, limit, endDate);

			// 2. CHECK REDIS CACHE FIRST (MANDATORY)
			const cached = await redisCache.get<MarketData[]>(cacheKey);
			if (cached) {
				console.log(
					`✅ Historical cache HIT: ${symbol} ${endDate?.toISOString().split("T")[0] || "latest"}`
				);
				return cached;
			}

			// 3. ONLY IF CACHE MISS: Make API call
			console.log(`❌ Historical cache MISS: ${symbol} - calling FMP API`);

			// Build URL with optional date range
			let url = `/historical-price-full/${symbol.toUpperCase()}`;

			if (endDate) {
				// Calculate start date based on limit and endDate
				const startDate = new Date(endDate);
				startDate.setDate(startDate.getDate() - limit);

				const fromStr = startDate.toISOString().split("T")[0];
				const toStr = endDate.toISOString().split("T")[0];

				url += `?from=${fromStr}&to=${toStr}`;
			} else {
				url += `?limit=${limit}`;
			}

			const response = await this.makeRequest(url);

			if (!response.success) {
				const error = new Error(
					response.error || "Financial Modeling Prep API request failed"
				);
				if (this.throwErrors) throw error;
				return [];
			}

			if (!response.data?.historical || !Array.isArray(response.data.historical)) {
				const error = new Error(
					"Invalid historical data response from Financial Modeling Prep API"
				);
				if (this.throwErrors) throw error;
				return [];
			}

			// Convert all historical data to MarketData format
			const data = response.data.historical.map((historical: any) => ({
				symbol: symbol.toUpperCase(),
				open: parseFloat(historical.open || "0"),
				high: parseFloat(historical.high || "0"),
				low: parseFloat(historical.low || "0"),
				close: parseFloat(historical.close || "0"),
				volume: parseInt(historical.volume || "0"),
				timestamp: new Date(historical.date).getTime(),
				source: "fmp",
			}));

			// 4. STORE IN CACHE (historical data = immutable, 30 day TTL)
			await redisCache.set(cacheKey, data, 2592000, { source: "fmp", version: "1.0.0" }); // 30 days

			return data;
		} catch (error) {
			this.errorHandler.logger.logApiError("GET", "historical_data", error, undefined, {
				symbol,
				limit,
				endDate: endDate?.toISOString(),
			});
			if (this.throwErrors) throw error;
			return [];
		}
	}

	/**
	 * Get batch stock prices efficiently
	 */
	async getBatchPrices(
		symbols: string[],
		options?: {
			planType?: "basic" | "starter" | "professional";
			priorityMode?: boolean;
		}
	): Promise<Map<string, StockData>> {
		try {
			this.validateApiKey();

			const results = new Map<string, StockData>();
			const normalizedSymbols = symbols.map((s) => this.normalizeSymbol(s)).filter(Boolean);

			if (normalizedSymbols.length === 0) {
				return results;
			}

			const planType = options?.planType || this.detectPlanType();
			const batchConfig = this.calculateOptimalBatchConfig(
				planType,
				normalizedSymbols.length,
				options?.priorityMode
			);

			// Use FMP bulk quote endpoint for efficient batch processing
			const endpoint = `/quote/${normalizedSymbols.join(",")}`;

			this.errorHandler.logger.info(
				`Batch price request for ${normalizedSymbols.length} symbols`,
				{
					planType,
					endpoint,
					utilizationTarget: `${batchConfig.utilizationTarget}%`,
				}
			);

			const response = await this.makeRequest(endpoint);

			if (response.success && Array.isArray(response.data)) {
				response.data.forEach((quote: any) => {
					if (quote.symbol && quote.price !== undefined) {
						const stockData = {
							symbol: quote.symbol,
							price: Number(this.parseNumeric(quote.price).toFixed(2)),
							change: Number(this.parseNumeric(quote.change || 0).toFixed(2)),
							changePercent: Number(
								this.parseNumeric(quote.changesPercentage || 0).toFixed(2)
							),
							volume: this.parseInt(quote.volume || 0),
							timestamp: quote.timestamp
								? new Date(quote.timestamp * 1000).getTime()
								: Date.now(),
							source: this.getSourceIdentifier(),
						};

						results.set(quote.symbol, stockData);
					}
				});

				this.errorHandler.logger.info(`Batch prices completed`, {
					requested: normalizedSymbols.length,
					retrieved: results.size,
					successRate: `${((results.size / normalizedSymbols.length) * 100).toFixed(1)}%`,
				});
			}

			return results;
		} catch (error) {
			this.errorHandler.logger.error("Batch prices failed", {
				error,
				symbolCount: symbols.length,
			});
			if (this.throwErrors) throw error;
			return new Map();
		}
	}

	/**
	 * Health check for FMP Market Data API
	 */
	async healthCheck(): Promise<boolean> {
		try {
			if (!this.apiKey) {
				this.errorHandler.logger.warn("FMP API key not configured");
				return false;
			}

			const response = await this.makeRequest("/quote/AAPL");

			if (!response.success) {
				this.errorHandler.logger.warn("FMP market data health check failed", {
					error: response.error || "Unknown error",
				});
				return false;
			}

			// Check for success, no error message, and presence of expected data structure
			return (
				response.success &&
				Array.isArray(response.data) &&
				response.data.length > 0 &&
				!!response.data[0]?.price
			);
		} catch (error) {
			this.errorHandler.logger.warn("FMP market data health check failed", { error });
			return false;
		}
	}
}
