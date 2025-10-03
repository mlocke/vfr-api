/**
 * Factor Debug API - Detailed factor calculation debugging
 * Provides individual factor calculations and detailed breakdown for troubleshooting
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { FactorLibrary } from "../../../services/algorithms/FactorLibrary";
import { TechnicalIndicatorService } from "../../../services/technical-analysis/TechnicalIndicatorService";
import { FinancialDataService } from "../../../services/financial-data/FinancialDataService";
import { RedisCache } from "../../../services/cache/RedisCache";
import { financialDataService } from "../../../services/financial-data";

// Request validation schema
const FactorDebugRequestSchema = z.object({
	symbol: z.string(),
	factors: z
		.array(z.string())
		.optional()
		.default([
			"pe_ratio",
			"pb_ratio",
			"roe",
			"debt_equity",
			"current_ratio",
			"quality_composite",
			"value_composite",
			"momentum_composite",
			"momentum_1m",
			"momentum_3m",
			"revenue_growth",
			"earnings_growth",
		]),
});

interface FactorDebugResponse {
	success: boolean;
	data?: {
		symbol: string;
		timestamp: number;
		marketData: any;
		fundamentalData: any;
		factorCalculations: {
			[factorName: string]: {
				value: number | null;
				calculationTime: number;
				error?: string;
				dataUsed: {
					marketData?: any;
					fundamentalData?: any;
				};
			};
		};
		summary: {
			totalFactors: number;
			successfulFactors: number;
			failedFactors: number;
			averageCalculationTime: number;
		};
	};
	error?: string;
}

/**
 * POST endpoint for detailed factor debugging
 */
export async function POST(request: NextRequest): Promise<NextResponse<FactorDebugResponse>> {
	try {
		const startTime = Date.now();

		// Parse and validate request
		const body = await request.json();
		const debugRequest = FactorDebugRequestSchema.parse(body);

		console.log(`🔬 Factor Debug Request for ${debugRequest.symbol}:`, {
			symbol: debugRequest.symbol,
			factorsToTest: debugRequest.factors.length,
		});

		// Initialize services
		const cache = new RedisCache();
		const financialDataService = new FinancialDataService();
		let technicalService: TechnicalIndicatorService | undefined;

		try {
			technicalService = new TechnicalIndicatorService(cache);
		} catch (error) {
			console.warn("Technical service not available:", error);
		}

		const factorLibrary = new FactorLibrary(cache, technicalService);

		// Step 1: Get base stock data
		console.log(`📊 Fetching stock data for ${debugRequest.symbol}...`);
		const stockData = await financialDataService.getStockPrice(debugRequest.symbol);
		if (!stockData) {
			return NextResponse.json({
				success: false,
				error: `No stock data found for symbol: ${debugRequest.symbol}`,
			});
		}

		// Step 2: Get detailed fundamental data
		console.log(`📈 Fetching fundamental data for ${debugRequest.symbol}...`);
		let fundamentalRatios = null;
		let companyInfo = null;

		try {
			fundamentalRatios = await financialDataService.getFundamentalRatios(
				debugRequest.symbol
			);
			companyInfo = await financialDataService.getCompanyInfo(debugRequest.symbol);
		} catch (error) {
			console.warn(`Error fetching fundamental data:`, error);
		}

		// Step 3: Prepare market data point
		const marketDataPoint = {
			symbol: debugRequest.symbol,
			price: stockData.price || 0,
			volume: stockData.volume || 0,
			marketCap: companyInfo?.marketCap || fundamentalRatios?.marketCap || 0,
			sector: stockData.sector || "Unknown",
			exchange: "NASDAQ",
			timestamp: Date.now(),
		};

		// Step 4: Prepare fundamental data point
		const fundamentalDataPoint = fundamentalRatios
			? {
					symbol: debugRequest.symbol,
					peRatio: fundamentalRatios.peRatio,
					pbRatio: fundamentalRatios.pbRatio,
					debtToEquity: fundamentalRatios.debtToEquity,
					roe: fundamentalRatios.roe,
					revenueGrowth: fundamentalRatios.revenueGrowth,
					currentRatio: fundamentalRatios.currentRatio,
					operatingMargin: fundamentalRatios.operatingMargin,
					netProfitMargin: fundamentalRatios.netProfitMargin,
					grossProfitMargin: fundamentalRatios.grossProfitMargin,
					priceToSales: fundamentalRatios.priceToSales,
					evEbitda:
						fundamentalRatios.enterpriseValue && fundamentalRatios.eps
							? fundamentalRatios.enterpriseValue / fundamentalRatios.eps
							: undefined,
					interestCoverage: fundamentalRatios.interestCoverage,
					earningsGrowth: fundamentalRatios.earningsGrowth,
					dividendYield: fundamentalRatios.dividendYield,
					payoutRatio: fundamentalRatios.payoutRatio,
				}
			: null;

		// Step 5: Calculate each factor individually with timing and error tracking
		console.log(
			`🧮 Calculating ${debugRequest.factors.length} factors for ${debugRequest.symbol}...`
		);
		const factorCalculations: { [factorName: string]: any } = {};
		let totalFactors = debugRequest.factors.length;
		let successfulFactors = 0;
		let totalCalculationTime = 0;

		for (const factorName of debugRequest.factors) {
			const factorStartTime = Date.now();

			try {
				console.log(`Calculating factor: ${factorName}`);

				const factorValue = await factorLibrary.calculateFactor(
					factorName,
					debugRequest.symbol,
					marketDataPoint,
					fundamentalDataPoint || undefined
				);

				const calculationTime = Date.now() - factorStartTime;
				totalCalculationTime += calculationTime;

				factorCalculations[factorName] = {
					value: factorValue,
					calculationTime,
					dataUsed: {
						marketData: {
							price: marketDataPoint.price,
							volume: marketDataPoint.volume,
							marketCap: marketDataPoint.marketCap,
							sector: marketDataPoint.sector,
						},
						fundamentalData: fundamentalDataPoint
							? {
									peRatio: fundamentalDataPoint.peRatio,
									pbRatio: fundamentalDataPoint.pbRatio,
									roe: fundamentalDataPoint.roe,
									debtToEquity: fundamentalDataPoint.debtToEquity,
									currentRatio: fundamentalDataPoint.currentRatio,
								}
							: null,
					},
				};

				if (factorValue !== null && !isNaN(factorValue)) {
					successfulFactors++;
					console.log(`✅ ${factorName}: ${factorValue} (${calculationTime}ms)`);
				} else {
					console.log(`⚠️ ${factorName}: ${factorValue} (${calculationTime}ms)`);
				}
			} catch (error) {
				const calculationTime = Date.now() - factorStartTime;
				totalCalculationTime += calculationTime;

				factorCalculations[factorName] = {
					value: null,
					calculationTime,
					error: error instanceof Error ? error.message : String(error),
					dataUsed: {
						marketData: marketDataPoint,
						fundamentalData: fundamentalDataPoint,
					},
				};
				console.log(
					`❌ ${factorName}: ERROR - ${error instanceof Error ? error.message : String(error)} (${calculationTime}ms)`
				);
			}
		}

		const executionTime = Date.now() - startTime;
		console.log(`✅ Factor debug completed in ${executionTime}ms`);

		const response: FactorDebugResponse = {
			success: true,
			data: {
				symbol: debugRequest.symbol,
				timestamp: Date.now(),
				marketData: marketDataPoint,
				fundamentalData: fundamentalDataPoint,
				factorCalculations,
				summary: {
					totalFactors,
					successfulFactors,
					failedFactors: totalFactors - successfulFactors,
					averageCalculationTime: totalCalculationTime / totalFactors,
				},
			},
		};

		return NextResponse.json(response);
	} catch (error) {
		console.error("Factor debug error:", error);

		// Return appropriate error response
		if (error instanceof z.ZodError) {
			return NextResponse.json(
				{
					success: false,
					error:
						"Invalid request format: " +
						error.issues.map((e: any) => e.message).join(", "),
				},
				{ status: 400 }
			);
		}

		return NextResponse.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Factor debug failed",
			},
			{ status: 500 }
		);
	}
}

/**
 * GET endpoint for available factors list
 */
export async function GET(): Promise<NextResponse> {
	try {
		// Initialize factor library to get available factors
		const factorLibrary = new FactorLibrary();
		const availableFactors = factorLibrary.getAvailableFactors();

		return NextResponse.json({
			success: true,
			data: {
				availableFactors,
				categories: {
					momentum: availableFactors.filter(f => f.includes("momentum")),
					value: availableFactors.filter(
						f => f.includes("pe_ratio") || f.includes("pb_ratio") || f.includes("value")
					),
					quality: availableFactors.filter(
						f => f.includes("roe") || f.includes("debt") || f.includes("quality")
					),
					growth: availableFactors.filter(f => f.includes("growth")),
					technical: availableFactors.filter(
						f => f.includes("rsi") || f.includes("macd") || f.includes("sma")
					),
					volatility: availableFactors.filter(
						f => f.includes("volatility") || f.includes("atr")
					),
					composite: availableFactors.filter(f => f.includes("composite")),
				},
			},
		});
	} catch (error) {
		return NextResponse.json(
			{
				success: false,
				error: "Failed to get available factors",
			},
			{ status: 500 }
		);
	}
}
