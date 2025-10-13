/**
 * FMP Fundamentals API
 * Handles company information, financial statements, ratios, dividends, earnings, and ESG data
 */

import { BaseFinancialDataProvider } from "../BaseFinancialDataProvider";
import {
	CompanyInfo,
	FundamentalRatios,
	FinancialStatement,
	BalanceSheet,
	CashFlowStatement,
	DividendData,
	StockSplit,
	ESGRating,
	ApiResponse,
	StockData,
} from "../types";
import { createApiErrorHandler } from "../../error-handling";
import securityValidator from "../../security/SecurityValidator";

export class FMPFundamentalsAPI extends BaseFinancialDataProvider {
	name = "Financial Modeling Prep - Fundamentals";
	private errorHandler = createApiErrorHandler("fmp-fundamentals");

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
	 * Calculate optimal batch configuration
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
	 * Calculate utilization efficiency
	 */
	private calculateUtilizationEfficiency(config: any, batchResults: any[]): string {
		if (batchResults.length === 0) return "N/A";

		const totalRequests = batchResults.reduce((sum, result) => sum + result.processed, 0);
		const totalDuration = batchResults.reduce((sum, result) => sum + result.duration, 0);
		const averageDuration = totalDuration / batchResults.length;

		const theoreticalRate = ((config.utilizationTarget / 100) * 300) / 60;
		const actualRate = totalRequests / (averageDuration / 1000);
		const efficiency = Math.min((actualRate / theoreticalRate) * 100, 100);

		return `${efficiency.toFixed(1)}%`;
	}

	/**
	 * Get company information
	 */
	async getCompanyInfo(symbol: string): Promise<CompanyInfo | null> {
		try {
			this.validateApiKey();
			const normalizedSymbol = this.normalizeSymbol(symbol);

			const response = await this.makeRequest(`/profile/${normalizedSymbol}`);

			if (!this.validateResponse(response, "array")) {
				return null;
			}

			const profile = response.data[0];

			return {
				symbol: normalizedSymbol,
				name: profile.companyName || "",
				description: profile.description || "",
				sector: profile.sector || "",
				marketCap: this.parseInt(profile.mktCap),
				employees: this.parseInt(profile.fullTimeEmployees),
				website: profile.website || "",
			};
		} catch (error) {
			return this.handleApiError(error, symbol, "company info", null);
		}
	}

	/**
	 * Get fundamental ratios for a stock
	 */
	async getFundamentalRatios(symbol: string): Promise<FundamentalRatios | null> {
		try {
			const symbolValidation = securityValidator.validateSymbol(symbol);
			if (!symbolValidation.isValid) {
				this.errorHandler.logger.warn(`Invalid symbol for fundamental ratios: ${symbol}`, {
					errors: symbolValidation.errors,
				});
				return null;
			}

			return await this.errorHandler.handleApiCall(
				() => this.executeGetFundamentalRatios(symbolValidation.sanitized!),
				{
					timeout: this.timeout,
					retries: 2,
					context: "getFundamentalRatios",
				}
			);
		} catch (error) {
			if (this.throwErrors) throw error;
			this.errorHandler.logger.warn(`Failed to get fundamental ratios for ${symbol}`, {
				error,
			});
			return null;
		}
	}

	private async executeGetFundamentalRatios(symbol: string): Promise<FundamentalRatios | null> {
		const sanitizedSymbol = symbol.toUpperCase();

		if (!this.apiKey) {
			throw new Error("Financial Modeling Prep API key not configured");
		}

		const [ratiosResponse, metricsResponse] = await Promise.all([
			this.makeRequest(`/ratios/${sanitizedSymbol}?limit=1`),
			this.makeRequest(`/key-metrics/${sanitizedSymbol}?limit=1`),
		]);

		if (!ratiosResponse.success && !metricsResponse.success) {
			securityValidator.recordFailure(`fmp_fundamental_${sanitizedSymbol}`);
			const error = new Error("Failed to fetch fundamental data from FMP");
			const sanitizedError = securityValidator.sanitizeErrorMessage(error);
			console.error(sanitizedError);
			if (this.throwErrors) throw error;
			return null;
		}

		if (ratiosResponse.success) {
			const ratiosValidation = securityValidator.validateApiResponse(ratiosResponse.data, []);
			if (!ratiosValidation.isValid) {
				this.errorHandler.logger.warn("Invalid ratios response structure", {
					errors: ratiosValidation.errors,
					symbol: sanitizedSymbol,
				});
			}
		}

		if (metricsResponse.success) {
			const metricsValidation = securityValidator.validateApiResponse(
				metricsResponse.data,
				[]
			);
			if (!metricsValidation.isValid) {
				this.errorHandler.logger.warn("Invalid metrics response structure", {
					errors: metricsValidation.errors,
					symbol: sanitizedSymbol,
				});
			}
		}

		const ratiosData =
			ratiosResponse.success && Array.isArray(ratiosResponse.data) && ratiosResponse.data[0]
				? ratiosResponse.data[0]
				: {};

		const metricsData =
			metricsResponse.success &&
			Array.isArray(metricsResponse.data) &&
			metricsResponse.data[0]
				? metricsResponse.data[0]
				: {};

		const parseSecureNumeric = (
			value: any,
			fieldName: string,
			allowNegative: boolean = false
		): number | undefined => {
			if (value === null || value === undefined || value === "") {
				return undefined;
			}

			let numericValue: number;
			try {
				numericValue = parseFloat(value);
				if (isNaN(numericValue)) {
					return undefined;
				}
				numericValue = Math.round(numericValue * 1000000) / 1000000;
			} catch (error) {
				return undefined;
			}

			const validation = securityValidator.validateNumeric(numericValue, {
				allowNegative,
				allowZero: true,
				min: allowNegative ? undefined : 0,
				max: fieldName.includes("Margin") || fieldName === "payoutRatio" ? 100 : undefined,
				decimalPlaces: 6,
			});

			if (!validation.isValid) {
				this.errorHandler.logger.warn(`Invalid ${fieldName} value for ${sanitizedSymbol}`, {
					fieldName,
					value: numericValue,
					errors: validation.errors,
				});
				return undefined;
			}

			return numericValue;
		};

		const result: FundamentalRatios = {
			symbol: sanitizedSymbol,
			peRatio:
				parseSecureNumeric(metricsData.peRatio, "peRatio") ??
				parseSecureNumeric(ratiosData.priceEarningsRatio, "peRatio"),
			pegRatio:
				parseSecureNumeric(metricsData.pegRatio, "pegRatio") ??
				parseSecureNumeric(ratiosData.priceEarningsToGrowthRatio, "pegRatio"),
			pbRatio:
				parseSecureNumeric(metricsData.pbRatio, "pbRatio") ??
				parseSecureNumeric(ratiosData.priceToBookRatio, "pbRatio"),
			priceToSales:
				parseSecureNumeric(metricsData.priceToSalesRatio, "priceToSales") ??
				parseSecureNumeric(ratiosData.priceToSalesRatio, "priceToSales"),
			priceToFreeCashFlow:
				parseSecureNumeric(metricsData.priceToFreeCashFlowsRatio, "priceToFreeCashFlow") ??
				parseSecureNumeric(ratiosData.priceToFreeCashFlowsRatio, "priceToFreeCashFlow"),
			debtToEquity: parseSecureNumeric(ratiosData.debtEquityRatio, "debtToEquity"),
			currentRatio: parseSecureNumeric(ratiosData.currentRatio, "currentRatio"),
			quickRatio: parseSecureNumeric(ratiosData.quickRatio, "quickRatio"),
			roe: parseSecureNumeric(ratiosData.returnOnEquity, "roe", true),
			roa: parseSecureNumeric(ratiosData.returnOnAssets, "roa", true),
			grossProfitMargin: parseSecureNumeric(
				ratiosData.grossProfitMargin,
				"grossProfitMargin",
				true
			),
			operatingMargin: parseSecureNumeric(
				ratiosData.operatingProfitMargin,
				"operatingMargin",
				true
			),
			netProfitMargin: parseSecureNumeric(
				ratiosData.netProfitMargin,
				"netProfitMargin",
				true
			),
			dividendYield:
				parseSecureNumeric(metricsData.dividendYield, "dividendYield") ??
				parseSecureNumeric(ratiosData.dividendYield, "dividendYield"),
			payoutRatio: parseSecureNumeric(ratiosData.payoutRatio, "payoutRatio"),
			timestamp: Date.now(),
			source: "fmp",
			period: "ttm",
		};

		return result;
	}

	/**
	 * Get batch fundamental ratios
	 */
	async getBatchFundamentalRatios(
		symbols: string[],
		options?: {
			planType?: "basic" | "starter" | "professional";
			rateLimit?: number;
			priorityMode?: boolean;
		}
	): Promise<Map<string, FundamentalRatios>> {
		try {
			this.validateApiKey();

			const results = new Map<string, FundamentalRatios>();
			const normalizedSymbols = symbols.map((s) => this.normalizeSymbol(s)).filter(Boolean);

			if (normalizedSymbols.length === 0) {
				return results;
			}

			const planType = options?.planType || this.detectPlanType(options?.rateLimit);
			const dynamicBatchConfig = this.calculateOptimalBatchConfig(
				planType,
				normalizedSymbols.length,
				options?.priorityMode
			);

			const batches: string[][] = [];
			for (let i = 0; i < normalizedSymbols.length; i += dynamicBatchConfig.batchSize) {
				batches.push(normalizedSymbols.slice(i, i + dynamicBatchConfig.batchSize));
			}

			this.errorHandler.logger.info(
				`Enhanced batch processing for ${normalizedSymbols.length} symbols`,
				{
					planType,
					batchSize: dynamicBatchConfig.batchSize,
					totalBatches: batches.length,
					maxConcurrency: dynamicBatchConfig.maxConcurrentBatches,
					utilizationTarget: `${dynamicBatchConfig.utilizationTarget}%`,
				}
			);

			const processBatch = async (
				symbolBatch: string[],
				batchIndex: number
			): Promise<{
				processed: number;
				successful: number;
				errors: number;
				duration: number;
			}> => {
				const batchStartTime = Date.now();
				let successful = 0;
				let errors = 0;

				try {
					const promises = symbolBatch.map(async (symbol, index) => {
						const delay =
							index * dynamicBatchConfig.requestInterval + batchIndex * 50;
						if (delay > 0) {
							await new Promise((resolve) => setTimeout(resolve, delay));
						}

						try {
							const ratios = await this.getFundamentalRatios(symbol);
							if (ratios) {
								results.set(symbol, ratios);
								successful++;
								this.errorHandler.logger.debug(
									`✅ Ratios retrieved for ${symbol} (batch ${batchIndex + 1})`,
									{
										batchProgress: `${successful}/${symbolBatch.length}`,
									}
								);
								return { symbol, success: true };
							}
							errors++;
							return { symbol, success: false, reason: "No data" };
						} catch (error) {
							errors++;
							this.errorHandler.logger.warn(
								`❌ Failed to get ratios for ${symbol} (batch ${batchIndex + 1})`,
								{ error }
							);
							return { symbol, success: false, reason: "API error" };
						}
					});

					await Promise.allSettled(promises);

					const batchDuration = Date.now() - batchStartTime;
					this.errorHandler.logger.info(
						`Batch ${batchIndex + 1}/${batches.length} completed`,
						{
							symbols: symbolBatch.length,
							successful,
							errors,
							duration: `${batchDuration}ms`,
							successRate: `${((successful / symbolBatch.length) * 100).toFixed(1)}%`,
						}
					);

					return {
						processed: symbolBatch.length,
						successful,
						errors,
						duration: batchDuration,
					};
				} catch (error) {
					this.errorHandler.logger.error(`Batch ${batchIndex + 1} processing error`, {
						error,
						batch: symbolBatch,
					});
					return {
						processed: symbolBatch.length,
						successful: 0,
						errors: symbolBatch.length,
						duration: Date.now() - batchStartTime,
					};
				}
			};

			const batchResults: Awaited<ReturnType<typeof processBatch>>[] = [];
			for (let i = 0; i < batches.length; i += dynamicBatchConfig.maxConcurrentBatches) {
				const concurrentBatches = batches.slice(
					i,
					i + dynamicBatchConfig.maxConcurrentBatches
				);

				const concurrentPromises = concurrentBatches.map((batch, index) =>
					processBatch(batch, i + index)
				);

				const concurrentResults = await Promise.allSettled(concurrentPromises);
				batchResults.push(
					...concurrentResults
						.filter((r) => r.status === "fulfilled")
						.map(
							(r) =>
								(
									r as PromiseFulfilledResult<
										Awaited<ReturnType<typeof processBatch>>
									>
								).value
						)
				);

				if (i + dynamicBatchConfig.maxConcurrentBatches < batches.length) {
					const averageBatchDuration =
						batchResults.reduce((sum, result) => sum + result.duration, 0) /
						batchResults.length;
					const adaptiveDelay = Math.max(
						dynamicBatchConfig.batchInterval,
						Math.min(averageBatchDuration * 0.1, 1000)
					);

					this.errorHandler.logger.debug(
						`Adaptive delay between batch groups: ${adaptiveDelay}ms`
					);
					await new Promise((resolve) => setTimeout(resolve, adaptiveDelay));
				}
			}

			const totalProcessed = batchResults.reduce((sum, result) => sum + result.processed, 0);
			const totalSuccessful = batchResults.reduce(
				(sum, result) => sum + result.successful,
				0
			);
			const totalErrors = batchResults.reduce((sum, result) => sum + result.errors, 0);
			const totalDuration = batchResults.reduce((sum, result) => sum + result.duration, 0);
			const averageRequestTime = totalDuration / Math.max(totalProcessed, 1);

			this.errorHandler.logger.info(`Enhanced batch processing completed`, {
				planType,
				requested: normalizedSymbols.length,
				processed: totalProcessed,
				successful: totalSuccessful,
				errors: totalErrors,
				successRate: `${((totalSuccessful / normalizedSymbols.length) * 100).toFixed(1)}%`,
				totalDuration: `${totalDuration}ms`,
				averageRequestTime: `${averageRequestTime.toFixed(1)}ms`,
				utilizationEfficiency: this.calculateUtilizationEfficiency(
					dynamicBatchConfig,
					batchResults
				),
			});

			return results;
		} catch (error) {
			this.errorHandler.logger.error("Enhanced batch fundamental ratios failed", { error });
			if (this.throwErrors) throw error;
			return new Map();
		}
	}

	/**
	 * Get income statement for a symbol
	 */
	async getIncomeStatement(
		symbol: string,
		period: "annual" | "quarterly" = "annual",
		limit = 5
	): Promise<FinancialStatement[]> {
		try {
			this.validateApiKey();
			const normalizedSymbol = this.normalizeSymbol(symbol);

			const response = await this.makeRequest(
				`/income-statement/${normalizedSymbol}?period=${period}&limit=${limit}`
			);

			if (!this.validateResponse(response, "array")) {
				return [];
			}

			return response.data.map((statement: any) => ({
				symbol: normalizedSymbol,
				date: statement.date || "",
				period: statement.period || period,
				revenue: this.parseNumeric(statement.revenue),
				costOfRevenue: this.parseNumeric(statement.costOfRevenue),
				grossProfit: this.parseNumeric(statement.grossProfit),
				grossProfitRatio: this.parseNumeric(statement.grossProfitRatio),
				researchAndDevelopment: this.parseNumeric(statement.researchAndDevelopmentExpenses),
				generalAndAdministrativeExpenses: this.parseNumeric(
					statement.generalAndAdministrativeExpenses
				),
				sellingAndMarketingExpenses: this.parseNumeric(
					statement.sellingAndMarketingExpenses
				),
				sellingGeneralAndAdministrativeExpenses: this.parseNumeric(
					statement.sellingGeneralAndAdministrativeExpenses
				),
				operatingExpenses: this.parseNumeric(statement.operatingExpenses),
				operatingIncome: this.parseNumeric(statement.operatingIncome),
				operatingIncomeRatio: this.parseNumeric(statement.operatingIncomeRatio),
				totalOtherIncomeExpenses: this.parseNumeric(statement.totalOtherIncomeExpensesNet),
				incomeBeforeTax: this.parseNumeric(statement.incomeBeforeTax),
				incomeBeforeTaxRatio: this.parseNumeric(statement.incomeBeforeTaxRatio),
				incomeTaxExpense: this.parseNumeric(statement.incomeTaxExpense),
				netIncome: this.parseNumeric(statement.netIncome),
				netIncomeRatio: this.parseNumeric(statement.netIncomeRatio),
				eps: this.parseNumeric(statement.eps),
				epsdiluted: this.parseNumeric(statement.epsdiluted),
				weightedAverageShsOut: this.parseNumeric(statement.weightedAverageShsOut),
				weightedAverageShsOutDil: this.parseNumeric(statement.weightedAverageShsOutDil),
				timestamp: Date.now(),
				source: this.getSourceIdentifier(),
			}));
		} catch (error) {
			return this.handleApiError(error, symbol, "income statement", []);
		}
	}

	/**
	 * Get balance sheet for a symbol
	 */
	async getBalanceSheet(
		symbol: string,
		period: "annual" | "quarterly" = "annual",
		limit = 5
	): Promise<BalanceSheet[]> {
		try {
			this.validateApiKey();
			const normalizedSymbol = this.normalizeSymbol(symbol);

			const response = await this.makeRequest(
				`/balance-sheet-statement/${normalizedSymbol}?period=${period}&limit=${limit}`
			);

			if (!this.validateResponse(response, "array")) {
				return [];
			}

			return response.data.map((sheet: any) => ({
				symbol: normalizedSymbol,
				date: sheet.date || "",
				period: sheet.period || period,
				cashAndCashEquivalents: this.parseNumeric(sheet.cashAndCashEquivalents),
				shortTermInvestments: this.parseNumeric(sheet.shortTermInvestments),
				cashAndShortTermInvestments: this.parseNumeric(sheet.cashAndShortTermInvestments),
				netReceivables: this.parseNumeric(sheet.netReceivables),
				inventory: this.parseNumeric(sheet.inventory),
				otherCurrentAssets: this.parseNumeric(sheet.otherCurrentAssets),
				totalCurrentAssets: this.parseNumeric(sheet.totalCurrentAssets),
				propertyPlantEquipmentNet: this.parseNumeric(sheet.propertyPlantEquipmentNet),
				goodwill: this.parseNumeric(sheet.goodwill),
				intangibleAssets: this.parseNumeric(sheet.intangibleAssets),
				goodwillAndIntangibleAssets: this.parseNumeric(sheet.goodwillAndIntangibleAssets),
				longTermInvestments: this.parseNumeric(sheet.longTermInvestments),
				taxAssets: this.parseNumeric(sheet.taxAssets),
				otherNonCurrentAssets: this.parseNumeric(sheet.otherNonCurrentAssets),
				totalNonCurrentAssets: this.parseNumeric(sheet.totalNonCurrentAssets),
				totalAssets: this.parseNumeric(sheet.totalAssets),
				accountPayables: this.parseNumeric(sheet.accountPayables),
				shortTermDebt: this.parseNumeric(sheet.shortTermDebt),
				taxPayables: this.parseNumeric(sheet.taxPayables),
				deferredRevenue: this.parseNumeric(sheet.deferredRevenue),
				otherCurrentLiabilities: this.parseNumeric(sheet.otherCurrentLiabilities),
				totalCurrentLiabilities: this.parseNumeric(sheet.totalCurrentLiabilities),
				longTermDebt: this.parseNumeric(sheet.longTermDebt),
				deferredRevenueNonCurrent: this.parseNumeric(sheet.deferredRevenueNonCurrent),
				deferredTaxLiabilitiesNonCurrent: this.parseNumeric(
					sheet.deferredTaxLiabilitiesNonCurrent
				),
				otherNonCurrentLiabilities: this.parseNumeric(sheet.otherNonCurrentLiabilities),
				totalNonCurrentLiabilities: this.parseNumeric(sheet.totalNonCurrentLiabilities),
				totalLiabilities: this.parseNumeric(sheet.totalLiabilities),
				preferredStock: this.parseNumeric(sheet.preferredStock),
				commonStock: this.parseNumeric(sheet.commonStock),
				retainedEarnings: this.parseNumeric(sheet.retainedEarnings),
				accumulatedOtherComprehensiveIncomeLoss: this.parseNumeric(
					sheet.accumulatedOtherComprehensiveIncomeLoss
				),
				othertotalStockholdersEquity: this.parseNumeric(sheet.othertotalStockholdersEquity),
				totalStockholdersEquity: this.parseNumeric(sheet.totalStockholdersEquity),
				totalEquity: this.parseNumeric(sheet.totalEquity),
				totalLiabilitiesAndStockholdersEquity: this.parseNumeric(
					sheet.totalLiabilitiesAndStockholdersEquity
				),
				minorityInterest: this.parseNumeric(sheet.minorityInterest),
				totalLiabilitiesAndTotalEquity: this.parseNumeric(
					sheet.totalLiabilitiesAndTotalEquity
				),
				timestamp: Date.now(),
				source: this.getSourceIdentifier(),
			}));
		} catch (error) {
			return this.handleApiError(error, symbol, "balance sheet", []);
		}
	}

	/**
	 * Get cash flow statement for a symbol
	 */
	async getCashFlowStatement(
		symbol: string,
		period: "annual" | "quarterly" = "annual",
		limit = 5
	): Promise<CashFlowStatement[]> {
		try {
			this.validateApiKey();
			const normalizedSymbol = this.normalizeSymbol(symbol);

			const response = await this.makeRequest(
				`/cash-flow-statement/${normalizedSymbol}?period=${period}&limit=${limit}`
			);

			if (!this.validateResponse(response, "array")) {
				return [];
			}

			return response.data.map((statement: any) => ({
				symbol: normalizedSymbol,
				date: statement.date || "",
				period: statement.period || period,
				netIncome: this.parseNumeric(statement.netIncome),
				depreciationAndAmortization: this.parseNumeric(
					statement.depreciationAndAmortization
				),
				deferredIncomeTax: this.parseNumeric(statement.deferredIncomeTax),
				stockBasedCompensation: this.parseNumeric(statement.stockBasedCompensation),
				changeInWorkingCapital: this.parseNumeric(statement.changeInWorkingCapital),
				accountsReceivables: this.parseNumeric(statement.accountsReceivables),
				inventory: this.parseNumeric(statement.inventory),
				accountsPayables: this.parseNumeric(statement.accountsPayables),
				otherWorkingCapital: this.parseNumeric(statement.otherWorkingCapital),
				otherNonCashItems: this.parseNumeric(statement.otherNonCashItems),
				netCashProvidedByOperatingActivities: this.parseNumeric(
					statement.netCashProvidedByOperatingActivities
				),
				investmentsInPropertyPlantAndEquipment: this.parseNumeric(
					statement.investmentsInPropertyPlantAndEquipment
				),
				acquisitionsNet: this.parseNumeric(statement.acquisitionsNet),
				purchasesOfInvestments: this.parseNumeric(statement.purchasesOfInvestments),
				salesMaturitiesOfInvestments: this.parseNumeric(
					statement.salesMaturitiesOfInvestments
				),
				otherInvestingActivites: this.parseNumeric(statement.otherInvestingActivites),
				netCashUsedForInvestingActivites: this.parseNumeric(
					statement.netCashUsedForInvestingActivites
				),
				debtRepayment: this.parseNumeric(statement.debtRepayment),
				commonStockIssued: this.parseNumeric(statement.commonStockIssued),
				commonStockRepurchased: this.parseNumeric(statement.commonStockRepurchased),
				dividendsPaid: this.parseNumeric(statement.dividendsPaid),
				otherFinancingActivites: this.parseNumeric(statement.otherFinancingActivites),
				netCashUsedProvidedByFinancingActivities: this.parseNumeric(
					statement.netCashUsedProvidedByFinancingActivities
				),
				effectOfForexChangesOnCash: this.parseNumeric(statement.effectOfForexChangesOnCash),
				netChangeInCash: this.parseNumeric(statement.netChangeInCash),
				cashAtEndOfPeriod: this.parseNumeric(statement.cashAtEndOfPeriod),
				cashAtBeginningOfPeriod: this.parseNumeric(statement.cashAtBeginningOfPeriod),
				operatingCashFlow: this.parseNumeric(statement.operatingCashFlow),
				capitalExpenditure: this.parseNumeric(statement.capitalExpenditure),
				freeCashFlow: this.parseNumeric(statement.freeCashFlow),
				timestamp: Date.now(),
				source: this.getSourceIdentifier(),
			}));
		} catch (error) {
			return this.handleApiError(error, symbol, "cash flow statement", []);
		}
	}

	/**
	 * Get dividend data for a symbol
	 */
	async getDividendData(symbol: string, from?: string, to?: string): Promise<DividendData[]> {
		try {
			this.validateApiKey();
			const normalizedSymbol = this.normalizeSymbol(symbol);

			let endpoint = `/historical-price-full/stock_dividend/${normalizedSymbol}`;
			if (from && to) {
				endpoint += `?from=${from}&to=${to}`;
			}

			const response = await this.makeRequest(endpoint);

			if (!response.success || !response.data?.historical) {
				return [];
			}

			return response.data.historical.map((dividend: any) => ({
				symbol: normalizedSymbol,
				date: dividend.date || "",
				label: dividend.label || "",
				adjDividend: this.parseNumeric(dividend.adjDividend),
				dividend: this.parseNumeric(dividend.dividend),
				recordDate: dividend.recordDate || "",
				paymentDate: dividend.paymentDate || "",
				declarationDate: dividend.declarationDate || "",
				timestamp: Date.now(),
				source: this.getSourceIdentifier(),
			}));
		} catch (error) {
			return this.handleApiError(error, symbol, "dividend data", []);
		}
	}

	/**
	 * Get stock split data for a symbol
	 */
	async getStockSplitData(symbol: string, from?: string, to?: string): Promise<StockSplit[]> {
		try {
			this.validateApiKey();
			const normalizedSymbol = this.normalizeSymbol(symbol);

			let endpoint = `/historical-price-full/stock_split/${normalizedSymbol}`;
			if (from && to) {
				endpoint += `?from=${from}&to=${to}`;
			}

			const response = await this.makeRequest(endpoint);

			if (!response.success || !response.data?.historical) {
				return [];
			}

			return response.data.historical.map((split: any) => ({
				symbol: normalizedSymbol,
				date: split.date || "",
				label: split.label || "",
				numerator: this.parseNumeric(split.numerator),
				denominator: this.parseNumeric(split.denominator),
				timestamp: Date.now(),
				source: this.getSourceIdentifier(),
			}));
		} catch (error) {
			return this.handleApiError(error, symbol, "stock split data", []);
		}
	}

	/**
	 * Get ESG ratings for a symbol
	 */
	async getESGRating(symbol: string): Promise<ESGRating | null> {
		try {
			this.validateApiKey();
			const normalizedSymbol = this.normalizeSymbol(symbol);

			const response = await this.makeRequest(`/esg-score?symbol=${normalizedSymbol}`);

			if (!this.validateResponse(response, "array") || response.data.length === 0) {
				return null;
			}

			const esg = response.data[0];
			return {
				symbol: normalizedSymbol,
				companyName: esg.companyName || "",
				environmentalScore: this.parseNumeric(esg.environmentalScore),
				socialScore: this.parseNumeric(esg.socialScore),
				governanceScore: this.parseNumeric(esg.governanceScore),
				ESGScore: this.parseNumeric(esg.ESGScore),
				environmentalGrade: esg.environmentalGrade || "",
				socialGrade: esg.socialGrade || "",
				governanceGrade: esg.governanceGrade || "",
				ESGGrade: esg.ESGGrade || "",
				timestamp: Date.now(),
				source: this.getSourceIdentifier(),
			};
		} catch (error) {
			return this.handleApiError(error, symbol, "ESG rating", null);
		}
	}

	/**
	 * Get earnings surprises
	 */
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
		try {
			this.validateApiKey();
			const normalizedSymbol = this.normalizeSymbol(symbol);

			const response = await this.makeRequest(
				`/income-statement/${normalizedSymbol}?period=quarter&limit=${limit}`
			);

			if (!this.validateResponse(response, "array")) {
				return [];
			}

			const statements = response.data;
			const earningsData: {
				date: string;
				actualEarningResult: number;
				estimatedEarning: number;
			}[] = [];

			for (let i = 0; i < statements.length; i++) {
				const current = statements[i];
				const yearAgo = statements[i + 4];

				if (current.epsdiluted) {
					earningsData.push({
						date: current.date || current.fillingDate || "",
						actualEarningResult: this.parseNumeric(current.epsdiluted),
						estimatedEarning: yearAgo?.epsdiluted
							? this.parseNumeric(yearAgo.epsdiluted)
							: this.parseNumeric(current.epsdiluted) * 0.9,
					});
				}
			}

			return earningsData;
		} catch (error) {
			return this.handleApiError(error, symbol, "earnings data", []);
		}
	}

	/**
	 * Get earnings calendar for a symbol
	 */
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
		try {
			this.validateApiKey();
			const normalizedSymbol = this.normalizeSymbol(symbol);

			const response = await this.makeRequest(
				`/historical/earning_calendar/${normalizedSymbol}`
			);

			if (!this.validateResponse(response, "array")) {
				return [];
			}

			return response.data.map((event: any) => ({
				date: event.date || "",
				symbol: normalizedSymbol,
				eps: event.eps ? this.parseNumeric(event.eps) : undefined,
				epsEstimated: event.epsEstimated
					? this.parseNumeric(event.epsEstimated)
					: undefined,
				time: event.time || undefined,
				revenue: event.revenue ? this.parseNumeric(event.revenue) : undefined,
				revenueEstimated: event.revenueEstimated
					? this.parseNumeric(event.revenueEstimated)
					: undefined,
			}));
		} catch (error) {
			return this.handleApiError(error, symbol, "earnings calendar", []);
		}
	}

	/**
	 * Health check for FMP Fundamentals API
	 */
	async healthCheck(): Promise<boolean> {
		try {
			if (!this.apiKey) {
				this.errorHandler.logger.warn("FMP API key not configured");
				return false;
			}

			const response = await this.makeRequest("/profile/AAPL");

			if (!response.success) {
				this.errorHandler.logger.warn("FMP fundamentals health check failed", {
					error: response.error || "Unknown error",
				});
				return false;
			}

			return (
				response.success &&
				Array.isArray(response.data) &&
				response.data.length > 0 &&
				!!response.data[0]?.companyName
			);
		} catch (error) {
			this.errorHandler.logger.warn("FMP fundamentals health check failed", { error });
			return false;
		}
	}
}
