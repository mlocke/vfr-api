/**
 * Smart Money Data Service
 *
 * Provides access to insider trading, institutional ownership, congressional trades,
 * and ETF holdings data from Financial Modeling Prep API.
 *
 * Data Sources:
 * - Insider Trading: /v4/insider-trading
 * - Institutional Ownership: /v4/institutional-ownership/symbol-ownership
 * - Congressional Trading: /v4/senate-trading & /v4/house-disclosure
 * - ETF Holdings: /v3/etf-holder/{symbol}
 *
 * Rate Limiting: 300 requests/minute (FMP Starter Plan)
 */

import {
	InsiderTransaction,
	InstitutionalHolding,
	CongressionalTrade,
	ETFHolding,
} from '../ml/smart-money-flow/types';
import { BaseFinancialDataProvider } from './BaseFinancialDataProvider';
import { createApiErrorHandler } from '../error-handling';

export class SmartMoneyDataService extends BaseFinancialDataProvider {
	name = 'Smart Money Data Service';
	private errorHandler = createApiErrorHandler('smart-money-data');

	// Rate limiting: Track requests per minute
	private requestCount = 0;
	private requestWindowStart = Date.now();
	private readonly MAX_REQUESTS_PER_MINUTE = 300;

	// Feature flag: Respect ENABLE_FMP env var
	private readonly isFmpEnabled: boolean;

	constructor(apiKey?: string, timeout = 15000) {
		super({
			apiKey: apiKey || process.env.FMP_API_KEY || '',
			timeout,
			throwErrors: false,
			baseUrl: 'https://financialmodelingprep.com/api',
		});

		// Check if FMP is enabled via feature flag
		this.isFmpEnabled = process.env.ENABLE_FMP === 'true';

		if (!this.isFmpEnabled) {
			this.errorHandler.logger.warn('FMP disabled via ENABLE_FMP flag', {
				service: 'SmartMoneyDataService',
				message: 'All methods will return empty arrays. Use alternative sources (SEC EDGAR, Polygon).',
			});
		}
	}

	protected getSourceIdentifier(): string {
		return 'fmp-smart-money';
	}

	/**
	 * Check rate limit before making request
	 * Implements 300 requests/minute limit with sliding window
	 */
	private async checkRateLimit(): Promise<void> {
		const now = Date.now();
		const windowDuration = 60000; // 1 minute

		// Reset window if more than 1 minute has passed
		if (now - this.requestWindowStart > windowDuration) {
			this.requestCount = 0;
			this.requestWindowStart = now;
		}

		// If we've hit the limit, wait until the window resets
		if (this.requestCount >= this.MAX_REQUESTS_PER_MINUTE) {
			const waitTime = windowDuration - (now - this.requestWindowStart);
			if (waitTime > 0) {
				this.errorHandler.logger.warn('Rate limit reached, waiting...', {
					waitTimeMs: waitTime,
					requestCount: this.requestCount,
				});
				await new Promise(resolve => setTimeout(resolve, waitTime));
				// Reset after waiting
				this.requestCount = 0;
				this.requestWindowStart = Date.now();
			}
		}

		this.requestCount++;
	}

	/**
	 * Make HTTP request to FMP API
	 * @param endpoint - API endpoint path
	 */
	private async makeRequest(endpoint: string): Promise<any> {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), this.timeout);

		try {
			// Determine API version from endpoint
			const apiVersion = endpoint.includes('/v4/') ? 'v4' : 'v3';
			const baseUrl =
				apiVersion === 'v4'
					? 'https://financialmodelingprep.com/api/v4'
					: 'https://financialmodelingprep.com/api/v3';

			// Clean endpoint (remove leading /v3/ or /v4/ if present)
			const cleanEndpoint = endpoint.replace(/^\/(v3|v4)/, '');

			const url = new URL(`${baseUrl}${cleanEndpoint}`);
			url.searchParams.append('apikey', this.apiKey);

			const response = await fetch(url.toString(), {
				signal: controller.signal,
				headers: {
					Accept: 'application/json',
					'User-Agent': 'VFR-API/1.0',
				},
			});

			clearTimeout(timeoutId);

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const data = await response.json();

			// Error detection
			if (data?.['Error Message']) {
				throw new Error(data['Error Message']);
			}

			if (data?.error) {
				throw new Error(data.error);
			}

			// Rate limit detection
			if (typeof data === 'string') {
				if (data.includes('limit') || data.includes('exceeded')) {
					throw new Error('API rate limit exceeded');
				}
				if (data.includes('invalid') && data.includes('key')) {
					throw new Error('Invalid API key');
				}
			}

			return {
				success: true,
				data,
				source: 'fmp-smart-money',
				timestamp: Date.now(),
			};
		} catch (error) {
			clearTimeout(timeoutId);

			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
				source: 'fmp-smart-money',
				timestamp: Date.now(),
			};
		}
	}

	/**
	 * Get Insider Trading transactions
	 *
	 * @param symbol - Stock symbol
	 * @param startDate - Start date (YYYY-MM-DD) - optional
	 * @param endDate - End date (YYYY-MM-DD) - optional
	 * @param limit - Maximum number of results (default: 100)
	 * @returns Array of insider transactions
	 *
	 * Endpoint: /v4/insider-trading?symbol={symbol}&from={startDate}&to={endDate}&limit={limit}
	 */
	async getInsiderTrading(
		symbol: string,
		startDate?: string,
		endDate?: string,
		limit = 100
	): Promise<InsiderTransaction[]> {
		// Return empty array if FMP is disabled
		if (!this.isFmpEnabled) {
			return [];
		}

		try {
			this.validateApiKey();
			await this.checkRateLimit();

			const normalizedSymbol = this.normalizeSymbol(symbol);
			let endpoint = `/v4/insider-trading?symbol=${normalizedSymbol}&limit=${limit}`;

			if (startDate) {
				endpoint += `&from=${startDate}`;
			}
			if (endDate) {
				endpoint += `&to=${endDate}`;
			}

			const response = await this.makeRequest(endpoint);

			if (!this.validateResponse(response, 'array')) {
				this.errorHandler.logger.warn('No insider trading data returned', { symbol });
				return [];
			}

			// Map FMP response to InsiderTransaction interface
			return response.data.map((item: any) => ({
				symbol: item.symbol || normalizedSymbol,
				filingDate: item.filingDate || '',
				transactionDate: item.transactionDate || '',
				transactionType: item.transactionType || 'S',
				securitiesTransacted: this.parseNumeric(item.securitiesTransacted),
				price: this.parseNumeric(item.price),
				securitiesOwned: this.parseNumeric(item.securitiesOwned),
				typeOfOwner: item.typeOfOwner || '',
				reportingName: item.reportingName || '',
			}));
		} catch (error) {
			return this.handleApiError(error, symbol, 'insider trading', []);
		}
	}

	/**
	 * Get Institutional Ownership holdings
	 *
	 * @param symbol - Stock symbol
	 * @param limit - Maximum number of results (default: 100)
	 * @returns Array of institutional holdings
	 *
	 * Endpoint: /v4/institutional-ownership/symbol-ownership?symbol={symbol}&limit={limit}
	 */
	async getInstitutionalOwnership(
		symbol: string,
		limit = 100
	): Promise<InstitutionalHolding[]> {
		// Return empty array if FMP is disabled
		if (!this.isFmpEnabled) {
			return [];
		}

		try {
			this.validateApiKey();
			await this.checkRateLimit();

			const normalizedSymbol = this.normalizeSymbol(symbol);
			const endpoint = `/v4/institutional-ownership/symbol-ownership?symbol=${normalizedSymbol}&limit=${limit}`;

			const response = await this.makeRequest(endpoint);

			if (!this.validateResponse(response, 'array')) {
				this.errorHandler.logger.warn('No institutional ownership data returned', {
					symbol,
				});
				return [];
			}

			// Map FMP response to InstitutionalHolding interface
			return response.data.map((item: any) => ({
				symbol: item.symbol || normalizedSymbol,
				date: item.date || '',
				investorName: item.investorName || '',
				shares: this.parseInt(item.shares),
				change: this.parseInt(item.change),
				changePercent: this.parseNumeric(item.changePercent),
				marketValue: this.parseNumeric(item.marketValue),
				putCallShare: item.putCallShare || 'New',
			}));
		} catch (error) {
			return this.handleApiError(error, symbol, 'institutional ownership', []);
		}
	}

	/**
	 * Get Congressional Trading disclosures
	 * Combines both Senate and House trading data
	 *
	 * @param symbol - Stock symbol
	 * @param startDate - Start date (YYYY-MM-DD) - optional
	 * @param endDate - End date (YYYY-MM-DD) - optional
	 * @returns Array of congressional trades
	 *
	 * Endpoints:
	 * - /v4/senate-trading?symbol={symbol}&from={startDate}&to={endDate}
	 * - /v4/house-disclosure?symbol={symbol}&from={startDate}&to={endDate}
	 */
	async getCongressionalTrades(
		symbol: string,
		startDate?: string,
		endDate?: string
	): Promise<CongressionalTrade[]> {
		// Return empty array if FMP is disabled
		if (!this.isFmpEnabled) {
			return [];
		}

		try {
			this.validateApiKey();

			const normalizedSymbol = this.normalizeSymbol(symbol);
			const trades: CongressionalTrade[] = [];

			// Fetch Senate trading data
			await this.checkRateLimit();
			let senateEndpoint = `/v4/senate-trading?symbol=${normalizedSymbol}`;
			if (startDate) senateEndpoint += `&from=${startDate}`;
			if (endDate) senateEndpoint += `&to=${endDate}`;

			const senateResponse = await this.makeRequest(senateEndpoint);
			if (this.validateResponse(senateResponse, 'array')) {
				const senateTrades = senateResponse.data.map((item: any) => ({
					symbol: item.symbol || normalizedSymbol,
					transactionDate: item.transactionDate || '',
					transactionType: item.type === 'purchase' ? 'Purchase' : 'Sale',
					amount: item.amount || '',
					representative: item.representative || item.senator || '',
					chamber: 'Senate' as const,
				}));
				trades.push(...senateTrades);
			}

			// Fetch House trading data
			await this.checkRateLimit();
			let houseEndpoint = `/v4/house-disclosure?symbol=${normalizedSymbol}`;
			if (startDate) houseEndpoint += `&from=${startDate}`;
			if (endDate) houseEndpoint += `&to=${endDate}`;

			const houseResponse = await this.makeRequest(houseEndpoint);
			if (this.validateResponse(houseResponse, 'array')) {
				const houseTrades = houseResponse.data.map((item: any) => ({
					symbol: item.symbol || normalizedSymbol,
					transactionDate: item.transactionDate || '',
					transactionType: item.type === 'purchase' ? 'Purchase' : 'Sale',
					amount: item.amount || '',
					representative: item.representative || '',
					chamber: 'House' as const,
				}));
				trades.push(...houseTrades);
			}

			return trades;
		} catch (error) {
			return this.handleApiError(error, symbol, 'congressional trades', []);
		}
	}

	/**
	 * Get ETF Holdings for a symbol
	 *
	 * @param symbol - Stock symbol
	 * @returns Array of ETF holdings
	 *
	 * Endpoint: /v3/etf-holder/{symbol}
	 */
	async getETFHoldings(symbol: string): Promise<ETFHolding[]> {
		// Return empty array if FMP is disabled
		if (!this.isFmpEnabled) {
			return [];
		}

		try {
			this.validateApiKey();
			await this.checkRateLimit();

			const normalizedSymbol = this.normalizeSymbol(symbol);
			const endpoint = `/v3/etf-holder/${normalizedSymbol}`;

			const response = await this.makeRequest(endpoint);

			if (!this.validateResponse(response, 'array')) {
				this.errorHandler.logger.warn('No ETF holdings data returned', { symbol });
				return [];
			}

			// Map FMP response to ETFHolding interface
			return response.data.map((item: any) => ({
				symbol: item.symbol || normalizedSymbol,
				date: item.updated || item.date || '',
				etfSymbol: item.etfSymbol || '',
				etfName: item.etfName || item.name || '',
				shares: this.parseInt(item.sharesNumber || item.shares),
				weightPercentage: this.parseNumeric(item.weightPercentage),
				marketValue: this.parseNumeric(item.marketValue),
			}));
		} catch (error) {
			return this.handleApiError(error, symbol, 'ETF holdings', []);
		}
	}

	/**
	 * Get all smart money data for a symbol at once
	 * Useful for batch feature extraction
	 *
	 * @param symbol - Stock symbol
	 * @param startDate - Start date for insider/congressional trades (YYYY-MM-DD)
	 * @param endDate - End date for insider/congressional trades (YYYY-MM-DD)
	 * @returns Object containing all smart money data
	 */
	async getAllSmartMoneyData(
		symbol: string,
		startDate?: string,
		endDate?: string
	): Promise<{
		insiderTrading: InsiderTransaction[];
		institutionalOwnership: InstitutionalHolding[];
		congressionalTrades: CongressionalTrade[];
		etfHoldings: ETFHolding[];
	}> {
		// Return empty arrays if FMP is disabled
		if (!this.isFmpEnabled) {
			return {
				insiderTrading: [],
				institutionalOwnership: [],
				congressionalTrades: [],
				etfHoldings: [],
			};
		}

		const normalizedSymbol = this.normalizeSymbol(symbol);

		// Fetch all data sources in parallel (rate limiting handled per request)
		const [insiderTrading, institutionalOwnership, congressionalTrades, etfHoldings] =
			await Promise.all([
				this.getInsiderTrading(normalizedSymbol, startDate, endDate, 200),
				this.getInstitutionalOwnership(normalizedSymbol, 200),
				this.getCongressionalTrades(normalizedSymbol, startDate, endDate),
				this.getETFHoldings(normalizedSymbol),
			]);

		return {
			insiderTrading,
			institutionalOwnership,
			congressionalTrades,
			etfHoldings,
		};
	}
}
