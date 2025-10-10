/**
 * Polygon.io API implementation
 * Primary news source for sentiment analysis with 5-year historical data
 */

import { BaseFinancialDataProvider } from "./BaseFinancialDataProvider";
import { createApiErrorHandler } from "../error-handling";
import { historicalCache } from "../cache/HistoricalDataCache";

export interface PolygonNewsArticle {
	id: string;
	publisher: {
		name: string;
		homepage_url?: string;
		logo_url?: string;
		favicon_url?: string;
	};
	title: string;
	author?: string;
	published_utc: string; // ISO 8601 timestamp
	article_url: string;
	tickers: string[];
	amp_url?: string;
	image_url?: string;
	description: string;
	keywords?: string[];
	insights?: Array<{
		ticker: string;
		sentiment: "positive" | "negative" | "neutral";
		sentiment_reasoning: string;
	}>;
}

export interface PolygonNewsResponse {
	status: string;
	results: PolygonNewsArticle[];
	count: number;
	next_url?: string;
}

export interface PolygonNewsQuery {
	ticker?: string;
	publishedUtcGte?: Date; // Start date
	publishedUtcLte?: Date; // End date
	order?: "asc" | "desc";
	limit?: number; // Max 1000
	sort?: "published_utc";
}

/**
 * Polygon.io API Client
 * Provides financial news with sentiment insights and publisher information
 */
export class PolygonAPI extends BaseFinancialDataProvider {
	name = "Polygon.io";
	private errorHandler = createApiErrorHandler("polygon");
	private readonly MAX_LIMIT = 1000;

	constructor(apiKey?: string, timeout = 15000, throwErrors = false) {
		super({
			apiKey: apiKey || process.env.POLYGON_API_KEY || "",
			timeout,
			throwErrors,
			baseUrl: "https://api.polygon.io",
		});
	}

	protected getSourceIdentifier(): string {
		return "polygon";
	}

	/**
	 * Format date for Polygon API (YYYY-MM-DD format)
	 */
	private formatDate(date: Date): string {
		return date.toISOString().split("T")[0];
	}

	/**
	 * Build query parameters for news endpoint
	 */
	private buildNewsQueryParams(query: PolygonNewsQuery): URLSearchParams {
		const params = new URLSearchParams();

		if (query.ticker) {
			params.append("ticker", query.ticker.toUpperCase());
		}

		if (query.publishedUtcGte) {
			params.append("published_utc.gte", this.formatDate(query.publishedUtcGte));
		}

		if (query.publishedUtcLte) {
			params.append("published_utc.lte", this.formatDate(query.publishedUtcLte));
		}

		if (query.order) {
			params.append("order", query.order);
		}

		if (query.limit) {
			const limit = Math.min(query.limit, this.MAX_LIMIT);
			params.append("limit", limit.toString());
		}

		if (query.sort) {
			params.append("sort", query.sort);
		}

		params.append("apiKey", this.apiKey);

		return params;
	}

	/**
	 * Get financial news articles for a symbol or general market news
	 *
	 * @param query Query parameters for news search
	 * @returns Promise<PolygonNewsResponse | null>
	 *
	 * @example
	 * // Get news for AAPL from last 7 days
	 * const news = await polygon.getNews({
	 *   ticker: 'AAPL',
	 *   publishedUtcGte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
	 *   limit: 100
	 * });
	 */
	async getNews(query: PolygonNewsQuery): Promise<PolygonNewsResponse | null> {
		try {
			this.validateApiKey();

			const params = this.buildNewsQueryParams(query);
			const url = `${this.baseUrl}/v2/reference/news?${params.toString()}`;

			this.errorHandler.logger.debug("Fetching news from Polygon", {
				ticker: query.ticker,
				dateRange: {
					from: query.publishedUtcGte?.toISOString().split("T")[0],
					to: query.publishedUtcLte?.toISOString().split("T")[0],
				},
				limit: query.limit,
			});

			const response = await this.makeHttpRequest(url);

			if (!response.success || !response.data) {
				this.errorHandler.logger.warn("Polygon news request failed", {
					error: response.error,
					ticker: query.ticker,
				});
				return null;
			}

			const newsData = response.data as PolygonNewsResponse;

			// Validate response structure
			if (newsData.status !== "OK" && newsData.status !== "DELAYED") {
				this.errorHandler.logger.warn("Polygon returned non-OK status", {
					status: newsData.status,
					ticker: query.ticker,
				});
				return null;
			}

			if (!newsData.results || !Array.isArray(newsData.results)) {
				this.errorHandler.logger.warn("Polygon returned invalid results format", {
					ticker: query.ticker,
				});
				return null;
			}

			this.errorHandler.logger.info("Successfully fetched news from Polygon", {
				ticker: query.ticker,
				articleCount: newsData.count || newsData.results.length,
				hasNextPage: !!newsData.next_url,
			});

			return newsData;
		} catch (error) {
			return this.handleApiError(
				error,
				query.ticker || "market",
				"news fetch",
				null
			);
		}
	}

	/**
	 * Get news for a symbol within a date range (commonly used for historical training data)
	 *
	 * @param symbol Stock symbol
	 * @param startDate Start date for news search
	 * @param endDate End date for news search
	 * @param limit Maximum number of articles (default: 100, max: 1000)
	 * @returns Promise<PolygonNewsArticle[]>
	 */
	async getNewsForSymbol(
		symbol: string,
		startDate: Date,
		endDate: Date,
		limit = 100
	): Promise<PolygonNewsArticle[]> {
		const response = await this.getNews({
			ticker: symbol,
			publishedUtcGte: startDate,
			publishedUtcLte: endDate,
			limit,
			order: "desc",
			sort: "published_utc",
		});

		return response?.results || [];
	}

	/**
	 * Get recent news for a symbol (last N days)
	 *
	 * @param symbol Stock symbol
	 * @param days Number of days to look back (default: 7)
	 * @param limit Maximum number of articles (default: 50)
	 * @returns Promise<PolygonNewsArticle[]>
	 */
	async getRecentNews(
		symbol: string,
		days = 7,
		limit = 50
	): Promise<PolygonNewsArticle[]> {
		const endDate = new Date();
		const startDate = new Date();
		startDate.setDate(startDate.getDate() - days);

		return this.getNewsForSymbol(symbol, startDate, endDate, limit);
	}

	/**
	 * Extract sentiment summary from news articles
	 * Aggregates sentiment insights from Polygon's built-in sentiment analysis
	 *
	 * @param articles Array of news articles
	 * @param symbol Optional symbol to filter insights
	 * @returns Sentiment summary object
	 */
	extractSentimentSummary(
		articles: PolygonNewsArticle[],
		symbol?: string
	): {
		positive: number;
		negative: number;
		neutral: number;
		totalArticles: number;
		sentimentScore: number; // -1 to 1 scale
	} {
		let positive = 0;
		let negative = 0;
		let neutral = 0;

		articles.forEach((article) => {
			if (article.insights && article.insights.length > 0) {
				// Filter by symbol if provided
				const relevantInsights = symbol
					? article.insights.filter((i) => i.ticker.toUpperCase() === symbol.toUpperCase())
					: article.insights;

				relevantInsights.forEach((insight) => {
					if (insight.sentiment === "positive") positive++;
					else if (insight.sentiment === "negative") negative++;
					else neutral++;
				});
			} else {
				// If no insights, count as neutral
				neutral++;
			}
		});

		const total = positive + negative + neutral;
		const sentimentScore = total > 0 ? (positive - negative) / total : 0;

		return {
			positive,
			negative,
			neutral,
			totalArticles: articles.length,
			sentimentScore,
		};
	}

	/**
	 * Get aggregate bars (OHLC) for a symbol over a date range
	 *
	 * @param symbol Stock symbol
	 * @param multiplier Size of timespan multiplier (e.g., 1)
	 * @param timespan Time window size (day, week, month, etc.)
	 * @param from Start date (YYYY-MM-DD) or timestamp
	 * @param to End date (YYYY-MM-DD) or timestamp
	 * @param adjusted Adjust for splits (default: true)
	 * @param sort Sort order (asc or desc, default: asc)
	 * @param limit Limit base aggregates (max: 50000, default: 5000)
	 * @returns Promise<Array of OHLC bars> or null
	 *
	 * @example
	 * // Get daily OHLC for AAPL in 2024
	 * const bars = await polygon.getAggregates('AAPL', 1, 'day', '2024-01-01', '2024-12-31');
	 */
	async getAggregates(
		symbol: string,
		multiplier: number,
		timespan: string,
		from: string | Date,
		to: string | Date,
		adjusted: boolean = true,
		sort: "asc" | "desc" = "asc",
		limit: number = 5000
	): Promise<Array<{
		timestamp: number; // Unix ms timestamp
		open: number;
		high: number;
		low: number;
		close: number;
		volume: number;
		vwap?: number;
		transactions?: number;
	}> | null> {
		try {
			this.validateApiKey();

			// Format dates
			const fromStr = typeof from === "string" ? from : this.formatDate(from);
			const toStr = typeof to === "string" ? to : this.formatDate(to);

			// Check if data is historical (end date is >1 day in past)
			const toDate = new Date(toStr);
			const yesterday = new Date();
			yesterday.setDate(yesterday.getDate() - 1);
			const isHistorical = toDate < yesterday;

			// Use cache for historical data
			if (isHistorical) {
				return await historicalCache.getOrFetch(
					"ohlcv",
					symbol,
					toStr,
					async () => {
						return await this.fetchAggregatesFromAPI(symbol, multiplier, timespan, fromStr, toStr, adjusted, sort, limit);
					},
					"polygon"
				);
			}

			// Fetch current/future data directly (no caching)
			return await this.fetchAggregatesFromAPI(symbol, multiplier, timespan, fromStr, toStr, adjusted, sort, limit);
		} catch (error) {
			return this.handleApiError(
				error,
				symbol,
				"aggregates fetch",
				null
			);
		}
	}

	/**
	 * Internal method to fetch aggregates from Polygon API
	 */
	private async fetchAggregatesFromAPI(
		symbol: string,
		multiplier: number,
		timespan: string,
		fromStr: string,
		toStr: string,
		adjusted: boolean,
		sort: "asc" | "desc",
		limit: number
	): Promise<Array<{
		timestamp: number;
		open: number;
		high: number;
		low: number;
		close: number;
		volume: number;
		vwap?: number;
		transactions?: number;
	}> | null> {
		// Build URL
		const url = new URL(
			`${this.baseUrl}/v2/aggs/ticker/${symbol.toUpperCase()}/range/${multiplier}/${timespan}/${fromStr}/${toStr}`
		);

		url.searchParams.append("adjusted", adjusted.toString());
		url.searchParams.append("sort", sort);
		url.searchParams.append("limit", Math.min(limit, 50000).toString());
		url.searchParams.append("apiKey", this.apiKey);

		this.errorHandler.logger.debug("Fetching aggregates from Polygon", {
			symbol,
			timespan,
			dateRange: { from: fromStr, to: toStr },
		});

		const response = await this.makeHttpRequest(url.toString());

		if (!response.success || !response.data) {
			this.errorHandler.logger.warn("Polygon aggregates request failed", {
				error: response.error,
				symbol,
			});
			return null;
		}

		const data = response.data as any;

		// Validate response
		if (data.status !== "OK" && data.status !== "DELAYED") {
			this.errorHandler.logger.warn("Polygon returned non-OK status", {
				status: data.status,
				symbol,
			});
			return null;
		}

		if (!data.results || !Array.isArray(data.results)) {
			this.errorHandler.logger.warn("Polygon returned no results", {
				symbol,
				dateRange: { from: fromStr, to: toStr },
			});
			return null;
		}

		// Map results to standard format
		const bars = data.results.map((bar: any) => ({
			timestamp: bar.t, // Unix ms timestamp
			open: bar.o,
			high: bar.h,
			low: bar.l,
			close: bar.c,
			volume: bar.v,
			vwap: bar.vw,
			transactions: bar.n,
		}));

		this.errorHandler.logger.info("Successfully fetched aggregates from Polygon", {
			symbol,
			barsCount: bars.length,
			dateRange: { from: fromStr, to: toStr },
		});

		return bars;
	}

	/**
	 * Get historical OHLC data for a symbol (simplified helper)
	 *
	 * @param symbol Stock symbol
	 * @param days Number of days of historical data (default: 30)
	 * @param asOfDate Optional end date (default: today)
	 * @returns Promise<Array of OHLC bars> or null
	 */
	async getHistoricalData(
		symbol: string,
		days: number = 30,
		asOfDate?: Date
	): Promise<Array<{
		timestamp: number;
		open: number;
		high: number;
		low: number;
		close: number;
		volume: number;
	}> | null> {
		const endDate = asOfDate || new Date();
		const startDate = new Date(endDate);
		startDate.setDate(startDate.getDate() - days);

		return this.getAggregates(
			symbol,
			1,
			"day",
			startDate,
			endDate,
			true,
			"asc"
		);
	}
}

// Singleton export
export const polygonAPI = new PolygonAPI();
