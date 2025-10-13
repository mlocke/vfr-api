/**
 * Financial Modeling Prep API - Main Orchestrator
 * Delegates to domain-specific modules for market data, fundamentals, and institutional data
 * Maintains backward compatibility while providing organized, maintainable architecture
 */

import {
	StockData,
	CompanyInfo,
	MarketData,
	FinancialDataProvider,
	ApiResponse,
	FundamentalRatios,
	AnalystRatings,
	PriceTarget,
	RatingChange,
	FinancialStatement,
	BalanceSheet,
	CashFlowStatement,
	EconomicEvent,
	DividendData,
	StockSplit,
	ESGRating,
	TreasuryRate,
} from "./types";
import { BaseFinancialDataProvider } from "./BaseFinancialDataProvider";
import { createApiErrorHandler } from "../error-handling";
import { FMPMarketDataAPI } from "./fmp/FMPMarketDataAPI";
import { FMPFundamentalsAPI } from "./fmp/FMPFundamentalsAPI";
import { FMPInstitutionalAPI } from "./fmp/FMPInstitutionalAPI";

export class FinancialModelingPrepAPI
	extends BaseFinancialDataProvider
	implements FinancialDataProvider
{
	name = "Financial Modeling Prep";
	private errorHandler = createApiErrorHandler("financial-modeling-prep");

	// Domain-specific API modules
	private marketDataAPI: FMPMarketDataAPI;
	private fundamentalsAPI: FMPFundamentalsAPI;
	private institutionalAPI: FMPInstitutionalAPI;

	constructor(apiKey?: string, timeout = 15000, throwErrors = false) {
		super({
			apiKey: apiKey || process.env.FMP_API_KEY || "",
			timeout,
			throwErrors,
			baseUrl: "https://financialmodelingprep.com/api/v3",
		});

		// Initialize domain-specific modules
		this.marketDataAPI = new FMPMarketDataAPI(apiKey, timeout, throwErrors);
		this.fundamentalsAPI = new FMPFundamentalsAPI(apiKey, timeout, throwErrors);
		this.institutionalAPI = new FMPInstitutionalAPI(apiKey, timeout, throwErrors);
	}

	protected getSourceIdentifier(): string {
		return "fmp";
	}

	/**
	 * Make HTTP request to FMP API (for economic/treasury endpoints)
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

			if (data?.["Error Message"]) {
				throw new Error(data["Error Message"]);
			}

			if (data?.error) {
				throw new Error(data.error);
			}

			if (typeof data === "string") {
				if (data.includes("limit") || data.includes("exceeded") || data.includes("quota")) {
					throw new Error("API rate limit exceeded");
				}
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

	// ==================== MARKET DATA METHODS (Delegated) ====================

	async getStockPrice(symbol: string): Promise<StockData | null> {
		return this.marketDataAPI.getStockPrice(symbol);
	}

	async getMarketData(symbol: string): Promise<MarketData | null> {
		return this.marketDataAPI.getMarketData(symbol);
	}

	async getHistoricalData(
		symbol: string,
		limit: number = 365,
		endDate?: Date
	): Promise<MarketData[]> {
		return this.marketDataAPI.getHistoricalData(symbol, limit, endDate);
	}

	async getBatchPrices(
		symbols: string[],
		options?: {
			planType?: "basic" | "starter" | "professional";
			priorityMode?: boolean;
		}
	): Promise<Map<string, StockData>> {
		return this.marketDataAPI.getBatchPrices(symbols, options);
	}

	// ==================== FUNDAMENTALS METHODS (Delegated) ====================

	async getCompanyInfo(symbol: string): Promise<CompanyInfo | null> {
		return this.fundamentalsAPI.getCompanyInfo(symbol);
	}

	async getFundamentalRatios(symbol: string): Promise<FundamentalRatios | null> {
		return this.fundamentalsAPI.getFundamentalRatios(symbol);
	}

	async getBatchFundamentalRatios(
		symbols: string[],
		options?: {
			planType?: "basic" | "starter" | "professional";
			rateLimit?: number;
			priorityMode?: boolean;
		}
	): Promise<Map<string, FundamentalRatios>> {
		return this.fundamentalsAPI.getBatchFundamentalRatios(symbols, options);
	}

	async getIncomeStatement(
		symbol: string,
		period: "annual" | "quarterly" = "annual",
		limit = 5
	): Promise<FinancialStatement[]> {
		return this.fundamentalsAPI.getIncomeStatement(symbol, period, limit);
	}

	async getBalanceSheet(
		symbol: string,
		period: "annual" | "quarterly" = "annual",
		limit = 5
	): Promise<BalanceSheet[]> {
		return this.fundamentalsAPI.getBalanceSheet(symbol, period, limit);
	}

	async getCashFlowStatement(
		symbol: string,
		period: "annual" | "quarterly" = "annual",
		limit = 5
	): Promise<CashFlowStatement[]> {
		return this.fundamentalsAPI.getCashFlowStatement(symbol, period, limit);
	}

	async getDividendData(symbol: string, from?: string, to?: string): Promise<DividendData[]> {
		return this.fundamentalsAPI.getDividendData(symbol, from, to);
	}

	async getStockSplitData(symbol: string, from?: string, to?: string): Promise<StockSplit[]> {
		return this.fundamentalsAPI.getStockSplitData(symbol, from, to);
	}

	async getESGRating(symbol: string): Promise<ESGRating | null> {
		return this.fundamentalsAPI.getESGRating(symbol);
	}

	async getEarningsSurprises(
		symbol: string,
		limit = 60
	): Promise<
		{
			date: string;
			actualEarningResult: number;
			estimatedEarning: number;
		}[]
	> {
		return this.fundamentalsAPI.getEarningsSurprises(symbol, limit);
	}

	async getEarningsCalendar(
		symbol: string
	): Promise<
		Array<{
			date: string;
			symbol: string;
			eps?: number;
			epsEstimated?: number;
			time?: "bmo" | "amc";
			revenue?: number;
			revenueEstimated?: number;
		}>
	> {
		return this.fundamentalsAPI.getEarningsCalendar(symbol);
	}

	// ==================== INSTITUTIONAL METHODS (Delegated) ====================

	async getAnalystRatings(symbol: string): Promise<AnalystRatings | null> {
		return this.institutionalAPI.getAnalystRatings(symbol);
	}

	async getPriceTargets(symbol: string): Promise<PriceTarget | null> {
		return this.institutionalAPI.getPriceTargets(symbol);
	}

	async getRecentRatingChanges(symbol: string, limit = 10): Promise<RatingChange[]> {
		return this.institutionalAPI.getRecentRatingChanges(symbol, limit);
	}

	async getInstitutionalOwnership(
		symbol: string,
		limit = 20
	): Promise<{
		symbol: string;
		institutionalHolders: Array<{
			managerName: string;
			managerId: string;
			shares: number;
			marketValue: number;
			percentOfShares: number;
			reportDate: string;
			changeType?: "NEW" | "ADDED" | "REDUCED" | "SOLD_OUT";
			changePercent?: number;
		}>;
		timestamp: number;
	} | null> {
		return this.institutionalAPI.getInstitutionalOwnership(symbol, limit);
	}

	async getInsiderTrading(
		symbol: string,
		limit = 100
	): Promise<{
		symbol: string;
		insiderTransactions: Array<{
			reportingOwnerName: string;
			reportingOwnerId: string;
			relationship: string[];
			transactionType: "BUY" | "SELL";
			transactionDate: string;
			filingDate: string;
			shares: number;
			transactionValue: number;
			pricePerShare: number;
			sharesOwned: number;
			significance: "LOW" | "MEDIUM" | "HIGH";
		}>;
		timestamp: number;
	} | null> {
		return this.institutionalAPI.getInsiderTrading(symbol, limit);
	}

	async get13FFilingDates(
		symbol: string,
		limit = 20
	): Promise<{
		symbol: string;
		filingDates: Array<{
			date: string;
			reportDate: string;
			totalInstitutions: number;
			totalShares: number;
			totalValue: number;
		}>;
		timestamp: number;
	} | null> {
		return this.institutionalAPI.get13FFilingDates(symbol, limit);
	}

	async getComprehensiveInstitutionalData(symbol: string): Promise<any> {
		return this.institutionalAPI.getComprehensiveInstitutionalData(symbol);
	}

	async getSocialSentiment(
		symbol: string,
		page = 0
	): Promise<
		{
			date: string;
			symbol: string;
			stocktwitsPosts: number;
			twitterPosts: number;
			stocktwitsComments: number;
			twitterComments: number;
			stocktwitsLikes: number;
			twitterLikes: number;
			stocktwitsImpressions: number;
			twitterImpressions: number;
			stocktwitsSentiment: number;
			twitterSentiment: number;
		}[]
	> {
		return this.institutionalAPI.getSocialSentiment(symbol, page);
	}

	async getStockNews(
		symbol: string,
		limit = 50
	): Promise<
		{
			publishedDate: string;
			title: string;
			image: string;
			site: string;
			text: string;
			url: string;
			symbol: string;
		}[]
	> {
		return this.institutionalAPI.getStockNews(symbol, limit);
	}

	// ==================== ECONOMIC DATA METHODS (Direct Implementation) ====================

	async getEconomicCalendar(from?: string, to?: string): Promise<EconomicEvent[]> {
		try {
			this.validateApiKey();

			const today = new Date().toISOString().split("T")[0];
			const fromDate = from || today;
			const toDate =
				to || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

			const response = await this.makeRequest(`/economic_calendar?from=${fromDate}&to=${toDate}`);

			if (!this.validateResponse(response, "array")) {
				return [];
			}

			return response.data.map((event: any) => ({
				date: event.date || "",
				time: event.time || "",
				country: event.country || "",
				event: event.event || "",
				currency: event.currency || "",
				previous: event.previous !== null ? parseFloat(event.previous) : null,
				estimate: event.estimate !== null ? parseFloat(event.estimate) : null,
				actual: event.actual !== null ? parseFloat(event.actual) : null,
				change: event.change !== null ? parseFloat(event.change) : null,
				changePercentage:
					event.changePercentage !== null ? parseFloat(event.changePercentage) : null,
				impact: event.impact || "Low",
				unit: event.unit || undefined,
				timestamp: Date.now(),
				source: this.getSourceIdentifier(),
			}));
		} catch (error) {
			return this.handleApiError(error, "economic calendar", "economic calendar", []);
		}
	}

	async getTreasuryRates(from?: string, to?: string): Promise<TreasuryRate[]> {
		try {
			this.validateApiKey();

			let endpoint = "/treasury";
			if (from && to) {
				endpoint += `?from=${from}&to=${to}`;
			}

			const response = await this.makeRequest(endpoint);

			if (!this.validateResponse(response, "array")) {
				return [];
			}

			return response.data.map((rate: any) => ({
				date: rate.date || "",
				month1: this.parseNumeric(rate.month1),
				month2: this.parseNumeric(rate.month2),
				month3: this.parseNumeric(rate.month3),
				month6: this.parseNumeric(rate.month6),
				year1: this.parseNumeric(rate.year1),
				year2: this.parseNumeric(rate.year2),
				year3: this.parseNumeric(rate.year3),
				year5: this.parseNumeric(rate.year5),
				year7: this.parseNumeric(rate.year7),
				year10: this.parseNumeric(rate.year10),
				year20: this.parseNumeric(rate.year20),
				year30: this.parseNumeric(rate.year30),
				timestamp: Date.now(),
				source: this.getSourceIdentifier(),
			}));
		} catch (error) {
			return this.handleApiError(error, "treasury rates", "treasury rates", []);
		}
	}

	async getFederalFundsRate(
		from?: string,
		to?: string
	): Promise<Array<{ date: string; value: number }>> {
		try {
			this.validateApiKey();

			let endpoint = "/economic?name=federalFunds";
			if (from && to) {
				endpoint += `&from=${from}&to=${to}`;
			}

			const response = await this.makeRequest(endpoint, "v4");

			if (!this.validateResponse(response, "array")) {
				return [];
			}

			return response.data.map((item: any) => ({
				date: item.date || "",
				value: this.parseNumeric(item.value),
			}));
		} catch (error) {
			return this.handleApiError(error, "federal funds rate", "federal funds rate", []);
		}
	}

	async getFederalFundsRateAtDate(
		date: Date
	): Promise<{ date: string; value: string } | null> {
		try {
			this.validateApiKey();

			const targetDate = date.toISOString().split("T")[0];

			const startDate = new Date(date);
			startDate.setDate(startDate.getDate() - 90);
			const fromDate = startDate.toISOString().split("T")[0];

			const data = await this.getFederalFundsRate(fromDate, targetDate);

			if (!data || data.length === 0) {
				return null;
			}

			const observation = data[0];

			return {
				date: observation.date,
				value: observation.value.toString(),
			};
		} catch (error) {
			return this.handleApiError(
				error,
				"federal funds rate at date",
				"federal funds rate at date",
				null
			);
		}
	}

	// ==================== SECTOR SCREENING (Direct Implementation) ====================

	async getStocksBySector(sector: string, limit = 20): Promise<StockData[]> {
		try {
			if (!this.apiKey) {
				console.warn("Financial Modeling Prep API key not configured");
				return [];
			}

			const response = await this.makeRequest(
				`/stock-screener?sector=${encodeURIComponent(sector)}&limit=${limit}`
			);

			if (!response.success || !response.data || !Array.isArray(response.data)) {
				return [];
			}

			return response.data
				.map((stock: any) => ({
					symbol: stock.symbol || "",
					price: parseFloat(stock.price || "0"),
					change: parseFloat(stock.change || "0"),
					changePercent: parseFloat(stock.changesPercentage || "0"),
					volume: parseInt(stock.volume || "0"),
					timestamp: Date.now(),
					source: "fmp",
				}))
				.filter((stock) => stock.symbol && stock.price > 0)
				.slice(0, limit);
		} catch (error) {
			this.errorHandler.logger.logApiError("GET", "sector_data", error, undefined, {
				sector,
			});
			return [];
		}
	}

	// ==================== COMPREHENSIVE DATA (Multi-Module Orchestration) ====================

	async getComprehensiveFinancialData(
		symbol: string,
		options?: {
			includeAnnual?: boolean;
			includeQuarterly?: boolean;
			includeDividends?: boolean;
			includeSplits?: boolean;
			includeESG?: boolean;
			limit?: number;
		}
	): Promise<{
		symbol: string;
		incomeStatement?: {
			annual: FinancialStatement[];
			quarterly: FinancialStatement[];
		};
		balanceSheet?: {
			annual: BalanceSheet[];
			quarterly: BalanceSheet[];
		};
		cashFlow?: {
			annual: CashFlowStatement[];
			quarterly: CashFlowStatement[];
		};
		dividends?: DividendData[];
		splits?: StockSplit[];
		esg?: ESGRating;
		timestamp: number;
	}> {
		try {
			this.validateApiKey();
			const normalizedSymbol = this.normalizeSymbol(symbol);
			const limit = options?.limit || 3;

			const {
				includeAnnual = true,
				includeQuarterly = false,
				includeDividends = false,
				includeSplits = false,
				includeESG = false,
			} = options || {};

			this.errorHandler.logger.info("Fetching comprehensive financial data", {
				symbol: normalizedSymbol,
				includeAnnual,
				includeQuarterly,
				includeDividends,
				includeSplits,
				includeESG,
				limit,
			});

			const promises: Promise<any>[] = [];
			const requestTypes: string[] = [];

			if (includeAnnual) {
				promises.push(this.getIncomeStatement(normalizedSymbol, "annual", limit));
				requestTypes.push("incomeAnnual");
				promises.push(this.getBalanceSheet(normalizedSymbol, "annual", limit));
				requestTypes.push("balanceAnnual");
				promises.push(this.getCashFlowStatement(normalizedSymbol, "annual", limit));
				requestTypes.push("cashFlowAnnual");
			}

			if (includeQuarterly) {
				promises.push(this.getIncomeStatement(normalizedSymbol, "quarterly", limit));
				requestTypes.push("incomeQuarterly");
				promises.push(this.getBalanceSheet(normalizedSymbol, "quarterly", limit));
				requestTypes.push("balanceQuarterly");
				promises.push(this.getCashFlowStatement(normalizedSymbol, "quarterly", limit));
				requestTypes.push("cashFlowQuarterly");
			}

			if (includeDividends) {
				promises.push(this.getDividendData(normalizedSymbol));
				requestTypes.push("dividends");
			}

			if (includeSplits) {
				promises.push(this.getStockSplitData(normalizedSymbol));
				requestTypes.push("splits");
			}

			if (includeESG) {
				promises.push(this.getESGRating(normalizedSymbol));
				requestTypes.push("esg");
			}

			const results = await Promise.allSettled(promises);

			const successfulResults: Record<string, any> = {};
			const errors: string[] = [];

			results.forEach((result, index) => {
				const requestType = requestTypes[index];
				if (result.status === "fulfilled") {
					successfulResults[requestType] = result.value;
				} else {
					errors.push(`${requestType}: ${result.reason}`);
					this.errorHandler.logger.warn(
						`Failed to fetch ${requestType} for ${normalizedSymbol}`,
						{
							error: result.reason,
						}
					);
				}
			});

			const comprehensiveData: any = {
				symbol: normalizedSymbol,
				timestamp: Date.now(),
			};

			if (includeAnnual || includeQuarterly) {
				if (successfulResults.incomeAnnual || successfulResults.incomeQuarterly) {
					comprehensiveData.incomeStatement = {
						annual: successfulResults.incomeAnnual || [],
						quarterly: successfulResults.incomeQuarterly || [],
					};
				}

				if (successfulResults.balanceAnnual || successfulResults.balanceQuarterly) {
					comprehensiveData.balanceSheet = {
						annual: successfulResults.balanceAnnual || [],
						quarterly: successfulResults.balanceQuarterly || [],
					};
				}

				if (successfulResults.cashFlowAnnual || successfulResults.cashFlowQuarterly) {
					comprehensiveData.cashFlow = {
						annual: successfulResults.cashFlowAnnual || [],
						quarterly: successfulResults.cashFlowQuarterly || [],
					};
				}
			}

			if (includeDividends && successfulResults.dividends) {
				comprehensiveData.dividends = successfulResults.dividends;
			}

			if (includeSplits && successfulResults.splits) {
				comprehensiveData.splits = successfulResults.splits;
			}

			if (includeESG && successfulResults.esg) {
				comprehensiveData.esg = successfulResults.esg;
			}

			if (errors.length > 0) {
				this.errorHandler.logger.info(
					`Comprehensive data fetched with ${errors.length} partial failures`,
					{
						symbol: normalizedSymbol,
						errors,
					}
				);
			}

			return comprehensiveData;
		} catch (error) {
			this.errorHandler.logger.error("Comprehensive financial data failed", {
				error,
				symbol,
			});
			if (this.throwErrors) throw error;
			return {
				symbol,
				timestamp: Date.now(),
			};
		}
	}

	// ==================== HEALTH CHECK ====================

	async healthCheck(): Promise<boolean> {
		try {
			const [marketHealth, fundamentalsHealth, institutionalHealth] = await Promise.all([
				this.marketDataAPI.healthCheck(),
				this.fundamentalsAPI.healthCheck(),
				this.institutionalAPI.healthCheck(),
			]);

			const allHealthy = marketHealth && fundamentalsHealth && institutionalHealth;

			this.errorHandler.logger.info("FMP health check complete", {
				market: marketHealth,
				fundamentals: fundamentalsHealth,
				institutional: institutionalHealth,
				overall: allHealthy,
			});

			return allHealthy;
		} catch (error) {
			this.errorHandler.logger.warn("FMP health check failed", { error });
			return false;
		}
	}
}
