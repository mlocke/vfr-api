/**
 * Types for direct financial API services
 * Simplified data models following KISS principles
 */

export interface StockData {
	symbol: string;
	price: number;
	change: number;
	changePercent: number;
	volume: number;
	averageVolume?: number;
	bid?: number;
	ask?: number;
	vwap?: number;
	preMarketPrice?: number;
	preMarketChange?: number;
	preMarketChangePercent?: number;
	afterHoursPrice?: number;
	afterHoursChange?: number;
	afterHoursChangePercent?: number;
	sector?: string;
	timestamp: number;
	source: string;
}

export interface CompanyInfo {
	symbol: string;
	name: string;
	description: string;
	sector: string;
	marketCap: number;
	employees?: number;
	website?: string;
	source?: string;
}

export interface MarketData {
	symbol: string;
	open: number;
	high: number;
	low: number;
	close: number;
	volume: number;
	timestamp: number;
	source: string;
}

export interface FundamentalRatios {
	symbol: string;
	peRatio?: number;
	pegRatio?: number;
	pbRatio?: number;
	priceToSales?: number;
	priceToFreeCashFlow?: number;
	debtToEquity?: number;
	currentRatio?: number;
	quickRatio?: number;
	roe?: number; // Return on Equity
	roa?: number; // Return on Assets
	grossProfitMargin?: number;
	operatingMargin?: number;
	netProfitMargin?: number;
	dividendYield?: number;
	payoutRatio?: number;
	interestCoverage?: number;
	revenueGrowth?: number;
	earningsGrowth?: number;
	eps?: number;
	bookValuePerShare?: number;
	beta?: number;
	marketCap?: number;
	enterpriseValue?: number;
	sharesOutstanding?: number;
	sector?: string;
	industry?: string;
	lastUpdated?: string;
	timestamp: number;
	source: string;
	period?: "annual" | "quarterly" | "ttm";
}

export interface AnalystRatings {
	symbol: string;
	consensus: string; // 'Strong Buy' | 'Buy' | 'Hold' | 'Sell' | 'Strong Sell'
	strongBuy: number;
	buy: number;
	hold: number;
	sell: number;
	strongSell: number;
	totalAnalysts: number;
	sentimentScore: number; // 1-5 scale (1=Strong Sell, 5=Strong Buy)
	timestamp: number;
	source: string;
}

export interface PriceTarget {
	symbol: string;
	targetHigh: number;
	targetLow: number;
	targetConsensus: number;
	targetMedian: number;
	currentPrice?: number;
	upside?: number; // percentage upside to consensus target
	lastMonthCount?: number;
	lastQuarterCount?: number;
	lastYearCount?: number;
	timestamp: number;
	source: string;
}

export interface RatingChange {
	symbol: string;
	publishedDate: string;
	analystName: string;
	analystCompany: string;
	newGrade?: string;
	previousGrade?: string;
	action: "upgrade" | "downgrade" | "initiate" | "maintain";
	priceTarget?: number;
	priceWhenPosted?: number;
	newsTitle?: string;
	newsURL?: string;
	timestamp: number;
	source: string;
}

/**
 * FMP-specific Financial Statements
 * Comprehensive financial data unique to FMP
 */
export interface FinancialStatement {
	symbol: string;
	date: string;
	period: "annual" | "quarterly";
	revenue: number;
	costOfRevenue: number;
	grossProfit: number;
	grossProfitRatio: number;
	researchAndDevelopment: number;
	generalAndAdministrativeExpenses: number;
	sellingAndMarketingExpenses: number;
	sellingGeneralAndAdministrativeExpenses: number;
	operatingExpenses: number;
	operatingIncome: number;
	operatingIncomeRatio: number;
	totalOtherIncomeExpenses: number;
	incomeBeforeTax: number;
	incomeBeforeTaxRatio: number;
	incomeTaxExpense: number;
	netIncome: number;
	netIncomeRatio: number;
	eps: number;
	epsdiluted: number;
	weightedAverageShsOut: number;
	weightedAverageShsOutDil: number;
	timestamp: number;
	source: string;
}

/**
 * FMP Balance Sheet Data
 * Enhanced balance sheet information
 */
export interface BalanceSheet {
	symbol: string;
	date: string;
	period: "annual" | "quarterly";
	cashAndCashEquivalents: number;
	shortTermInvestments: number;
	cashAndShortTermInvestments: number;
	netReceivables: number;
	inventory: number;
	otherCurrentAssets: number;
	totalCurrentAssets: number;
	propertyPlantEquipmentNet: number;
	goodwill: number;
	intangibleAssets: number;
	goodwillAndIntangibleAssets: number;
	longTermInvestments: number;
	taxAssets: number;
	otherNonCurrentAssets: number;
	totalNonCurrentAssets: number;
	totalAssets: number;
	accountPayables: number;
	shortTermDebt: number;
	taxPayables: number;
	deferredRevenue: number;
	otherCurrentLiabilities: number;
	totalCurrentLiabilities: number;
	longTermDebt: number;
	deferredRevenueNonCurrent: number;
	deferredTaxLiabilitiesNonCurrent: number;
	otherNonCurrentLiabilities: number;
	totalNonCurrentLiabilities: number;
	totalLiabilities: number;
	preferredStock: number;
	commonStock: number;
	retainedEarnings: number;
	accumulatedOtherComprehensiveIncomeLoss: number;
	othertotalStockholdersEquity: number;
	totalStockholdersEquity: number;
	totalEquity: number;
	totalLiabilitiesAndStockholdersEquity: number;
	minorityInterest: number;
	totalLiabilitiesAndTotalEquity: number;
	timestamp: number;
	source: string;
}

/**
 * FMP Cash Flow Statement
 * Complete cash flow analysis
 */
export interface CashFlowStatement {
	symbol: string;
	date: string;
	period: "annual" | "quarterly";
	netIncome: number;
	depreciationAndAmortization: number;
	deferredIncomeTax: number;
	stockBasedCompensation: number;
	changeInWorkingCapital: number;
	accountsReceivables: number;
	inventory: number;
	accountsPayables: number;
	otherWorkingCapital: number;
	otherNonCashItems: number;
	netCashProvidedByOperatingActivities: number;
	investmentsInPropertyPlantAndEquipment: number;
	acquisitionsNet: number;
	purchasesOfInvestments: number;
	salesMaturitiesOfInvestments: number;
	otherInvestingActivites: number;
	netCashUsedForInvestingActivites: number;
	debtRepayment: number;
	commonStockIssued: number;
	commonStockRepurchased: number;
	dividendsPaid: number;
	otherFinancingActivites: number;
	netCashUsedProvidedByFinancingActivities: number;
	effectOfForexChangesOnCash: number;
	netChangeInCash: number;
	cashAtEndOfPeriod: number;
	cashAtBeginningOfPeriod: number;
	operatingCashFlow: number;
	capitalExpenditure: number;
	freeCashFlow: number;
	timestamp: number;
	source: string;
}

/**
 * FMP Economics Data
 * Economic calendar and events
 */
export interface EconomicEvent {
	date: string;
	time: string;
	country: string;
	event: string;
	currency: string;
	previous: number | null;
	estimate: number | null;
	actual: number | null;
	change: number | null;
	changePercentage: number | null;
	impact: "Low" | "Medium" | "High";
	unit?: string;
	timestamp: number;
	source: string;
}

/**
 * FMP Dividend Data
 * Enhanced dividend information
 */
export interface DividendData {
	symbol: string;
	date: string;
	label: string;
	adjDividend: number;
	dividend: number;
	recordDate: string;
	paymentDate: string;
	declarationDate: string;
	timestamp: number;
	source: string;
}

/**
 * FMP Stock Split Data
 */
export interface StockSplit {
	symbol: string;
	date: string;
	label: string;
	numerator: number;
	denominator: number;
	timestamp: number;
	source: string;
}

/**
 * FMP ESG Ratings
 * Environmental, Social, and Governance scores
 */
export interface ESGRating {
	symbol: string;
	companyName: string;
	environmentalScore: number;
	socialScore: number;
	governanceScore: number;
	ESGScore: number;
	environmentalGrade: string;
	socialGrade: string;
	governanceGrade: string;
	ESGGrade: string;
	timestamp: number;
	source: string;
}

/**
 * FMP Treasury Rates
 * Government bond yields and rates
 */
export interface TreasuryRate {
	date: string;
	month1: number;
	month2: number;
	month3: number;
	month6: number;
	year1: number;
	year2: number;
	year3: number;
	year5: number;
	year7: number;
	year10: number;
	year20: number;
	year30: number;
	timestamp: number;
	source: string;
}

export interface HistoricalOHLC {
	timestamp: number;
	open: number;
	high: number;
	low: number;
	close: number;
	volume: number;
	date: string; // ISO date string for convenience
}

export interface FinancialDataProvider {
	name: string;
	getStockPrice(symbol: string): Promise<StockData | null>;
	getCompanyInfo(symbol: string): Promise<CompanyInfo | null>;
	getMarketData(symbol: string): Promise<MarketData | null>;
	getHistoricalOHLC?(symbol: string, days?: number, endDate?: Date): Promise<HistoricalOHLC[]>;
	getFundamentalRatios?(symbol: string): Promise<FundamentalRatios | null>;
	getAnalystRatings?(symbol: string): Promise<AnalystRatings | null>;
	getPriceTargets?(symbol: string): Promise<PriceTarget | null>;
	getRecentRatingChanges?(symbol: string, limit?: number): Promise<RatingChange[]>;
	getStocksBySector?(sector: string, limit?: number): Promise<StockData[]>;
	// Enhanced FMP-specific methods
	getIncomeStatement?(
		symbol: string,
		period?: "annual" | "quarterly",
		limit?: number
	): Promise<FinancialStatement[]>;
	getBalanceSheet?(
		symbol: string,
		period?: "annual" | "quarterly",
		limit?: number
	): Promise<BalanceSheet[]>;
	getCashFlowStatement?(
		symbol: string,
		period?: "annual" | "quarterly",
		limit?: number
	): Promise<CashFlowStatement[]>;
	getEconomicCalendar?(from?: string, to?: string): Promise<EconomicEvent[]>;
	getDividendData?(symbol: string, from?: string, to?: string): Promise<DividendData[]>;
	getStockSplitData?(symbol: string, from?: string, to?: string): Promise<StockSplit[]>;
	getESGRating?(symbol: string): Promise<ESGRating | null>;
	getTreasuryRates?(from?: string, to?: string): Promise<TreasuryRate[]>;
	healthCheck(): Promise<boolean>;
}

export interface ProviderConfig {
	apiKey: string;
	baseUrl: string;
	timeout: number;
	rateLimit: {
		requests: number;
		window: number; // in milliseconds
	};
}

export interface OptionsContract {
	symbol: string;
	strike: number;
	expiration: string; // ISO date string
	type: "call" | "put";
	volume: number;
	openInterest: number;
	impliedVolatility?: number;
	delta?: number;
	gamma?: number;
	theta?: number;
	vega?: number;
	bid?: number;
	ask?: number;
	lastPrice?: number;
	change?: number;
	changePercent?: number;
	timestamp: number;
	source: string;
}

export interface OptionsChain {
	symbol: string;
	calls: OptionsContract[];
	puts: OptionsContract[];
	expirationDates: string[];
	strikes: number[];
	timestamp: number;
	source: string;
}

export interface PutCallRatio {
	symbol: string;
	volumeRatio: number; // puts volume / calls volume
	openInterestRatio: number; // puts OI / calls OI
	totalPutVolume: number;
	totalCallVolume: number;
	totalPutOpenInterest: number;
	totalCallOpenInterest: number;
	date: string; // ISO date string
	timestamp: number;
	source: string;
	metadata?: {
		dataCompleteness?: number; // 0-1 scale
		contractsProcessed?: number;
		freeTierOptimized?: boolean;
		rateLimitStatus?: {
			requestsInLastMinute: number;
			remainingRequests: number;
			resetTime: number;
		};
		// UnicornBay enhanced metadata
		liquidityFilteredRatio?: number;
		highLiquidityContracts?: number;
		enhancedMetrics?: {
			avgCallLiquidity?: number;
			avgPutLiquidity?: number;
		};
	};
}

export interface OptionsAnalysis {
	symbol: string;
	currentRatio: PutCallRatio;
	historicalRatios: PutCallRatio[];
	trend: "bullish" | "bearish" | "neutral";
	sentiment: "fear" | "greed" | "balanced";
	confidence: number; // 0-1 scale
	analysis: string;
	timestamp: number;
	source: string;
	freeTierLimited?: boolean;
	timeBasedAnalysis?: TimeBasedOptionsAnalysis;
}

/**
 * Time-based options analysis for detecting institutional sentiment patterns
 * Based on expiration timing strategy: short-term (sentiment/volatility),
 * medium-term (institutional positioning), long-term (strategic confidence)
 */
export interface TimeBasedOptionsAnalysis {
	shortTerm: {
		daysToExpiry: number;
		sentiment: "bullish" | "bearish" | "neutral";
		volumeRatio: number;
		impliedVolatility: number;
		confidence: number;
		description: string;
	};
	mediumTerm: {
		daysToExpiry: number;
		sentiment: "bullish" | "bearish" | "neutral";
		volumeRatio: number;
		impliedVolatility: number;
		confidence: number;
		institutionalSignals: string[];
		description: string;
	};
	longTerm: {
		daysToExpiry: number;
		sentiment: "bullish" | "bearish" | "neutral";
		volumeRatio: number;
		impliedVolatility: number;
		confidence: number;
		leapsAnalysis: string;
		description: string;
	};
	strikePositioning: {
		heavyCallActivity: number[];
		heavyPutActivity: number[];
		institutionalHedges: number[];
		unusualActivity: string[];
	};
}

/**
 * Institutional Holdings Interface for 13F Filings
 * Tracks quarterly holdings of institutional investment managers
 */
export interface InstitutionalHolding {
	symbol: string;
	cusip: string;
	securityName: string;
	managerName: string;
	managerId: string; // SEC CIK number
	reportDate: string; // ISO date string for quarter end
	filingDate: string; // ISO date string when filed
	shares: number;
	marketValue: number; // in USD
	percentOfPortfolio: number; // 0-100 percentage
	sharesChange?: number; // change from previous quarter
	sharesChangePercent?: number; // percentage change from previous quarter
	valueChange?: number; // dollar change from previous quarter
	valueChangePercent?: number; // percentage change from previous quarter
	isNewPosition: boolean;
	isClosedPosition: boolean;
	rank: number; // position rank in manager's portfolio
	securityType: "COM" | "PRF" | "PUT" | "CALL" | "NOTE" | "BOND" | "OTHER";
	votingAuthority?: {
		sole: number;
		shared: number;
		none: number;
	};
	investmentDiscretion: "SOLE" | "SHARED" | "OTHER";
	timestamp: number;
	source: string;
	accessionNumber?: string; // SEC filing identifier
}

/**
 * Insider Transaction Interface for Form 4 Filings
 * Tracks insider trading activity within companies
 */
export interface InsiderTransaction {
	symbol: string;
	companyName: string;
	reportingOwnerName: string;
	reportingOwnerTitle?: string;
	reportingOwnerId: string; // CIK or other identifier
	relationship: string[]; // Director, Officer, 10% Owner, etc.
	transactionDate: string; // ISO date string
	filingDate: string; // ISO date string
	transactionCode:
		| "A"
		| "D"
		| "F"
		| "G"
		| "J"
		| "K"
		| "L"
		| "M"
		| "P"
		| "S"
		| "U"
		| "V"
		| "W"
		| "X"
		| "Z";
	transactionType: "BUY" | "SELL" | "GRANT" | "EXERCISE" | "GIFT" | "OTHER";
	securityTitle: string;
	shares: number;
	pricePerShare?: number;
	transactionValue?: number; // shares * price
	sharesOwnedAfter: number;
	ownershipType: "D" | "I"; // Direct or Indirect
	ownershipNature?: string; // Nature of beneficial ownership
	isAmendment: boolean;
	isDerivative: boolean;
	exercisePrice?: number; // for derivative securities
	expirationDate?: string; // for derivative securities
	underlyingSecurityTitle?: string; // for derivative securities
	underlyingShares?: number; // for derivative securities
	confidence: number; // 0-1 confidence score for data quality
	timestamp: number;
	source: string;
	accessionNumber?: string; // SEC filing identifier
	formType: "3" | "4" | "4/A" | "5" | "5/A";
}

/**
 * Aggregated Institutional Sentiment for a Security
 * Derived from multiple 13F filings and position changes
 */
export interface InstitutionalSentiment {
	symbol: string;
	reportDate: string; // quarter end date
	totalInstitutions: number;
	totalShares: number;
	totalValue: number;
	averagePosition: number; // average position size in USD
	institutionalOwnership: number; // percentage of float owned by institutions
	quarterlyChange: {
		newPositions: number; // count of new institutional positions
		closedPositions: number; // count of closed institutional positions
		increasedPositions: number; // count of increased positions
		decreasedPositions: number; // count of decreased positions
		netSharesChange: number; // net change in institutional shares
		netValueChange: number; // net change in institutional value
		flowScore: number; // -1 to 1 sentiment score based on flows
	};
	topHolders: Array<{
		managerName: string;
		managerId: string;
		shares: number;
		value: number;
		percentOfTotal: number;
		changeFromPrevious?: number;
	}>;
	sentiment: "BULLISH" | "BEARISH" | "NEUTRAL";
	sentimentScore: number; // 0-10 scale (0=Very Bearish, 10=Very Bullish)
	confidence: number; // 0-1 confidence score
	timestamp: number;
	source: string;
}

/**
 * Aggregated Insider Sentiment for a Security
 * Derived from Form 4 insider trading patterns
 */
export interface InsiderSentiment {
	symbol: string;
	period: string; // time period analyzed (e.g., '90D', '180D', '1Y')
	totalTransactions: number;
	totalInsiders: number;
	netShares: number; // net shares bought/sold
	netValue: number; // net dollar value bought/sold
	buyTransactions: number;
	sellTransactions: number;
	buyValue: number;
	sellValue: number;
	averageTransactionSize: number;
	insiderTypes: {
		officers: { transactions: number; netShares: number; netValue: number };
		directors: { transactions: number; netShares: number; netValue: number };
		tenPercentOwners: { transactions: number; netShares: number; netValue: number };
		other: { transactions: number; netShares: number; netValue: number };
	};
	recentActivity: Array<{
		date: string;
		insiderName: string;
		relationship: string;
		transactionType: "BUY" | "SELL";
		shares: number;
		value?: number;
		significance: "HIGH" | "MEDIUM" | "LOW"; // based on size relative to position
	}>;
	sentiment: "BULLISH" | "BEARISH" | "NEUTRAL";
	sentimentScore: number; // 0-10 scale (0=Very Bearish, 10=Very Bullish)
	confidence: number; // 0-1 confidence score
	timestamp: number;
	source: string;
}

/**
 * Combined Institutional & Insider Intelligence
 * Composite view for investment decision support
 */
export interface InstitutionalIntelligence {
	symbol: string;
	reportDate: string;
	institutionalSentiment?: InstitutionalSentiment;
	insiderSentiment?: InsiderSentiment;
	compositeScore: number; // 0-10 combined sentiment score
	weightedSentiment: "VERY_BULLISH" | "BULLISH" | "NEUTRAL" | "BEARISH" | "VERY_BEARISH";
	keyInsights: string[]; // array of narrative insights
	riskFactors: string[]; // potential concerns or risks
	opportunities: string[]; // potential opportunities
	dataQuality: {
		institutionalDataAvailable: boolean;
		insiderDataAvailable: boolean;
		dataFreshness: number; // days since last update
		completeness: number; // 0-1 score for data completeness
	};
	timestamp: number;
	source: string;
}

export interface ApiResponse<T> {
	success: boolean;
	data?: T;
	error?: string;
	source: string;
	timestamp: number;
	cached?: boolean;
}

// Missing types for InstitutionalDataService
export interface InstitutionalAnalysis {
	symbol: string;
	institutionalOwnership: number;
	topHolders: Array<{
		name: string;
		shares: number;
		percentage: number;
		marketValue: number;
	}>;
	recentChanges: Array<{
		institution: string;
		changeType: string;
		changeShares: number;
		changePercent: number;
		newPercentage: number;
	}>;
	insiderActivity: any;
	confidenceScore: number;
	lastUpdated: number;
	dataCompleteness: {
		thirteenFCoverage: number;
		insiderCoverage: number;
		totalInstitutions: number;
		totalInsiders: number;
	};
}

export interface InsiderTrading {
	type: "BUY" | "SELL";
	shares: number;
	value: number;
	date: string;
	insider: string;
}

/**
 * Currency Data Service Types
 * Supporting currency analysis and sector correlation intelligence
 */

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

/**
 * Sector Performance Ranking Types
 * Supporting comprehensive sector performance analysis with multi-timeframe rankings
 */

export interface SectorPerformanceRanking {
	sector: string;
	symbol: string; // ETF symbol representing the sector
	name: string; // Human readable sector name
	ranking: number; // Overall ranking (1 = best performing)
	returns: {
		oneDay: number; // 1-day return %
		fiveDay: number; // 5-day return %
		oneMonth: number; // 1-month return %
		threeMonth: number; // 3-month return %
		yearToDate: number; // Year-to-date return %
	};
	rankings: {
		oneDay: number; // 1-day ranking (1-11)
		fiveDay: number; // 5-day ranking (1-11)
		oneMonth: number; // 1-month ranking (1-11)
		threeMonth: number; // 3-month ranking (1-11)
		yearToDate: number; // YTD ranking (1-11)
	};
	momentum: {
		direction: "up" | "down" | "neutral";
		strength: "weak" | "moderate" | "strong";
		velocity: number; // Rate of change acceleration
		consistency: number; // Consistency score 0-1
	};
	technicalSignals: {
		trend: "bullish" | "bearish" | "neutral";
		support: number; // Support level price
		resistance: number; // Resistance level price
		rsi: number; // Relative Strength Index
		macdSignal: "buy" | "sell" | "hold";
	};
	relativeStrength: number; // vs S&P 500 baseline
	volatility: number; // Volatility measure
	volume: {
		current: number; // Current volume
		average: number; // Average volume (20-day)
		ratio: number; // Current/average ratio
	};
	marketCap: number; // ETF Assets Under Management
	confidence: number; // Data quality confidence 0-1
	timestamp: number; // Unix timestamp
	source: string; // Data source identifier
}

export interface SectorRankingResponse {
	rankings: SectorPerformanceRanking[];
	marketContext: {
		phase: "bull" | "bear" | "sideways";
		sentiment: "risk-on" | "risk-off" | "neutral";
		volatility: "low" | "medium" | "high";
		trend: "up" | "down" | "sideways";
	};
	rotationSignals: {
		intoSectors: string[]; // Sectors showing inflow momentum
		outOfSectors: string[]; // Sectors showing outflow momentum
		strength: number; // Rotation strength 0-10
	};
	bestPerformers: {
		oneDay: SectorPerformanceRanking[];
		fiveDay: SectorPerformanceRanking[];
		oneMonth: SectorPerformanceRanking[];
	};
	worstPerformers: {
		oneDay: SectorPerformanceRanking[];
		fiveDay: SectorPerformanceRanking[];
		oneMonth: SectorPerformanceRanking[];
	};
	dataQuality: "excellent" | "good" | "fair" | "poor";
	timestamp: number;
	source: string;
	errors?: string[];
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

/**
 * VWAP (Volume Weighted Average Price) Data Types
 * Supporting advanced trading features and execution analysis
 */

export interface VWAPData {
	symbol: string;
	vwap: number;
	timestamp: number;
	volume: number;
	timespan: "minute" | "hour" | "day";
	source: string;
}

export interface VWAPAnalysis {
	symbol: string;
	currentPrice: number;
	vwap: number;
	deviation: number;
	deviationPercent: number;
	signal: "above" | "below" | "at";
	strength: "weak" | "moderate" | "strong";
	timestamp: number;
}

/**
 * Historical VWAP Trend Analysis Types
 * Supporting trend analysis over different timeframes
 */
export interface HistoricalVWAP {
	symbol: string;
	date: string; // ISO date string
	vwap: number;
	currentPrice: number;
	deviation: number;
	deviationPercent: number;
	volume: number;
	timestamp: number;
}

export interface VWAPTrendAnalysis {
	symbol: string;
	timeframe: "1D" | "5D" | "1M" | "3M";
	trendDirection: "uptrend" | "downtrend" | "sideways";
	trendStrength: "weak" | "moderate" | "strong";
	trendScore: number; // -1 to 1 (-1=strong downtrend, 1=strong uptrend)
	averageDeviation: number;
	volatility: number;
	momentum: number; // Rate of change in trend
	historicalData: HistoricalVWAP[];
	confidence: number; // 0-1 confidence in trend analysis
	timestamp: number;
	source: string;
}

export interface VWAPTrendInsights {
	symbol: string;
	currentTrend: VWAPTrendAnalysis;
	multiTimeframeTrends: {
		oneDay: VWAPTrendAnalysis | null;
		fiveDay: VWAPTrendAnalysis | null;
		oneMonth: VWAPTrendAnalysis | null;
	};
	trendConvergence: "bullish" | "bearish" | "mixed" | "neutral";
	trendScore: number; // Combined multi-timeframe score
	keyInsights: string[];
	tradingSignals: Array<{
		signal: "BUY" | "SELL" | "HOLD";
		timeframe: string;
		reasoning: string;
		confidence: number;
	}>;
	timestamp: number;
}

/**
 * Extended Market Data Types
 * Supporting advanced trading features with bid/ask spreads and liquidity analysis
 */

export interface BidAskSpread {
	symbol: string;
	bid: number;
	ask: number;
	spread: number;
	spreadPercent: number;
	midpoint: number;
	timestamp: number;
	source: string;
}

export interface LiquidityMetrics {
	symbol: string;
	bidAskSpread: number;
	spreadPercent: number;
	averageSpread: number; // Average spread over time window
	spreadVolatility: number; // Volatility of spread measurements
	liquidityScore: number; // 0-10 liquidity score (10 = most liquid)
	marketMakingActivity: number; // Estimated market making activity
	timestamp: number;
	source: string;
}

export interface ExtendedHoursData {
	symbol: string;
	marketStatus: "pre-market" | "market-hours" | "after-hours" | "closed";
	preMarketPrice?: number;
	preMarketChange?: number;
	preMarketChangePercent?: number;
	preMarketVolume?: number;
	afterHoursPrice?: number;
	afterHoursChange?: number;
	afterHoursChangePercent?: number;
	afterHoursVolume?: number;
	regularHoursClose?: number;
	timestamp: number;
	source: string;
}

export interface ExtendedMarketData {
	symbol: string;
	regularData: StockData;
	extendedHours: ExtendedHoursData;
	bidAskSpread: BidAskSpread | null;
	liquidityMetrics: LiquidityMetrics | null;
	timestamp: number;
	source: string;
}

/**
 * Congressional Trading Service Types
 * For tracking political insider trading and congressional stock transactions
 */

export interface CongressionalTrade {
	symbol: string;
	politician: string;
	house: "Senate" | "House" | "Other";
	state: string;
	party: "Republican" | "Democrat" | "Independent" | "Other";
	transactionType: "Purchase" | "Sale" | "Exchange" | "Other";
	transactionDate: string;
	disclosureDate: string;
	amount: string; // Range like "$1,001-$15,000"
	amountMin?: number; // Estimated minimum value
	amountMax?: number; // Estimated maximum value
	asset: string; // Asset description
	ticker?: string; // If available
	confidence: number; // 0-1 data quality score
	source: string;
	timestamp: number;
}

export interface PoliticalInsiderSignal {
	symbol: string;
	totalTransactions: number;
	recentPurchases: number;
	recentSales: number;
	netSentiment: "BULLISH" | "BEARISH" | "NEUTRAL";
	sentimentScore: number; // -10 to +10
	bipartisanSupport: boolean;
	significantTrades: CongressionalTrade[];
	timeframe: string; // e.g., '90D', '180D'
	confidence: number;
	lastUpdated: number;
	analysis: string;
	source: string;
}

export interface CongressionalAnalysis {
	symbol: string;
	trades: CongressionalTrade[];
	politicalSentiment: PoliticalInsiderSignal;
	insights: string[];
	riskFactors: string[];
	opportunities: string[];
	overallRating: "POSITIVE" | "NEGATIVE" | "NEUTRAL";
	confidence: number;
	timestamp: number;
	source: string;
}

/**
 * Earnings Transcript Service Types
 * For analyzing earnings call transcripts and extracting sentiment
 */

export interface EarningsTranscript {
	symbol: string;
	quarter: string;
	year: number;
	fiscalPeriod: string;
	date: string;
	participants: Array<{
		name: string;
		title: string;
		company: string;
		type: "Executive" | "Analyst";
	}>;
	transcript: string;
	keyTopics: string[];
	sentiment: "POSITIVE" | "NEGATIVE" | "NEUTRAL";
	confidence: number;
	source: string;
	timestamp: number;
}

export interface TranscriptAnalysis {
	symbol: string;
	transcript: EarningsTranscript;
	sentimentBreakdown: {
		overall: number; // -1 to +1
		guidance: number;
		performance: number;
		outlook: number;
	};
	keyInsights: NLPInsight[];
	managementTone: "CONFIDENT" | "CAUTIOUS" | "DEFENSIVE" | "OPTIMISTIC" | "NEUTRAL";
	analystSentiment: "POSITIVE" | "NEGATIVE" | "MIXED" | "NEUTRAL";
	redFlags: string[];
	positiveSignals: string[];
	timestamp: number;
	source: string;
}

export interface EarningsSentiment {
	symbol: string;
	recentTranscripts: TranscriptAnalysis[];
	trendingSentiment: "IMPROVING" | "DECLINING" | "STABLE";
	sentimentScore: number; // 0-10
	confidence: number;
	keyThemes: string[];
	timestamp: number;
	source: string;
}

export interface NLPInsight {
	topic: string;
	sentiment: number; // -1 to +1
	confidence: number;
	mentions: number;
	keyPhrases: string[];
	context: string;
}

/**
 * Enhanced Sentiment Analysis Types
 * Multi-source sentiment aggregation and analysis
 */

export interface SentimentAnalysis {
	symbol: string;
	sources: Array<{
		name: string;
		sentiment: number; // -1 to +1
		confidence: number;
		weight: number;
		lastUpdated: number;
	}>;
	aggregatedSentiment: number; // -1 to +1
	sentimentCategory: "VERY_POSITIVE" | "POSITIVE" | "NEUTRAL" | "NEGATIVE" | "VERY_NEGATIVE";
	volatility: number; // Sentiment volatility measure
	trend: "IMPROVING" | "DECLINING" | "STABLE";
	confidence: number;
	timestamp: number;
	source: string;
}

export interface MultiSourceSentiment {
	symbol: string;
	news: SentimentAnalysis;
	social: SentimentAnalysis;
	analyst: SentimentAnalysis;
	insider: SentimentAnalysis;
	composite: {
		score: number; // -1 to +1
		confidence: number;
		category: "VERY_POSITIVE" | "POSITIVE" | "NEUTRAL" | "NEGATIVE" | "VERY_NEGATIVE";
	};
	timestamp: number;
	source: string;
}

export interface SentimentSignal {
	symbol: string;
	signal: "BUY" | "SELL" | "HOLD";
	strength: "WEAK" | "MODERATE" | "STRONG";
	sentiment: MultiSourceSentiment;
	reasoning: string[];
	confidence: number;
	timestamp: number;
	source: string;
}

/**
 * Institutional Performance Service Types
 * Performance benchmarking and analysis
 */

export interface InstitutionalPerformance {
	symbol: string;
	institution: string;
	performanceMetrics: PerformanceMetric[];
	benchmarkComparison: BenchmarkComparison;
	riskMetrics: {
		volatility: number;
		sharpeRatio: number;
		maxDrawdown: number;
		beta: number;
	};
	holdingPeriod: string;
	confidence: number;
	timestamp: number;
	source: string;
}

export interface PerformanceMetric {
	metric: string;
	value: number;
	percentile: number;
	period: string;
	benchmark?: number;
}

export interface BenchmarkComparison {
	symbol: string;
	benchmarkReturn: number;
	institutionalReturn: number;
	alpha: number;
	trackingError: number;
	informationRatio: number;
	outperformance: number; // percentage points
	period: string;
}

/**
 * Owner Earnings Service Types
 * Calculating and analyzing owner earnings
 */

export interface OwnerEarnings {
	symbol: string;
	period: string;
	reportedEarnings: number;
	depreciation: number;
	amortization: number;
	maintenanceCapex: number;
	ownerEarnings: number;
	ownerEarningsPerShare: number;
	ownerEarningsYield: number;
	cashConversionRatio: number;
	qualityScore: number; // 0-10
	confidence: number;
	timestamp: number;
	source: string;
}

export interface OwnerEarningsAnalysis {
	symbol: string;
	historicalData: OwnerEarnings[];
	trend: "IMPROVING" | "DECLINING" | "STABLE";
	averageYield: number;
	qualityAssessment: "HIGH" | "MEDIUM" | "LOW";
	keyInsights: string[];
	investmentRating: "ATTRACTIVE" | "FAIR" | "UNATTRACTIVE";
	confidence: number;
	timestamp: number;
	source: string;
}

/**
 * Revenue Segmentation Service Types
 * Revenue analysis by geographic and product segments
 */

export interface RevenueSegmentation {
	symbol: string;
	period: string;
	totalRevenue: number;
	geographicSegments: GeographicRevenue[];
	productSegments: ProductRevenue[];
	segmentAnalysis: SegmentAnalysis;
	timestamp: number;
	source: string;
}

export interface GeographicRevenue {
	region: string;
	revenue: number;
	percentage: number;
	growthRate: number;
	margin?: number;
	currency: string;
}

export interface ProductRevenue {
	product: string;
	revenue: number;
	percentage: number;
	growthRate: number;
	margin?: number;
	category: string;
}

export interface SegmentAnalysis {
	symbol: string;
	diversificationScore: number; // 0-10
	geographicRisk: "LOW" | "MEDIUM" | "HIGH";
	productConcentration: number; // 0-1 (1 = highly concentrated)
	growthSegments: string[];
	riskSegments: string[];
	opportunities: string[];
	keyInsights: string[];
	confidence: number;
}

/**
 * Historical Sector Performance Data
 * Multi-timeframe historical data for ranking calculations
 */

export interface SectorHistoricalData {
	symbol: string;
	sector: string;
	prices: Array<{
		date: string; // ISO date string
		open: number;
		high: number;
		low: number;
		close: number;
		volume: number;
		adjustedClose: number;
	}>;
	calculatedReturns: {
		oneDay: number;
		fiveDay: number;
		oneMonth: number;
		threeMonth: number;
		yearToDate: number;
	};
	technicalIndicators: {
		sma20: number; // 20-day Simple Moving Average
		sma50: number; // 50-day Simple Moving Average
		rsi: number; // 14-day RSI
		macd: {
			value: number;
			signal: number;
			histogram: number;
		};
	};
	timestamp: number;
	source: string;
}

/**
 * Sector Rotation Service Types
 * Sector rotation analysis and momentum tracking
 */

export interface SectorRotation {
	period: string;
	rotationPhase: "EARLY_CYCLE" | "MID_CYCLE" | "LATE_CYCLE" | "RECESSION";
	leadingSectors: string[];
	laggingSectors: string[];
	rotationStrength: number; // 0-10
	confidence: number;
	timestamp: number;
	source: string;
}

export interface SectorPerformance {
	sector: string;
	returns: {
		oneWeek: number;
		oneMonth: number;
		threeMonths: number;
		oneYear: number;
		oneDay?: number; // Added for consistency with SectorPerformanceRanking
		fiveDay?: number; // Added for consistency with SectorPerformanceRanking
		yearToDate?: number; // Added for consistency with SectorPerformanceRanking
	};
	momentum: SectorMomentum;
	relativeStrength: number; // vs S&P 500
	volatility: number;
	trend: "OUTPERFORMING" | "UNDERPERFORMING" | "INLINE";
	timestamp: number;
}

export interface SectorMomentum {
	sector: string;
	momentum: number; // -10 to +10
	acceleration: number;
	volume: number;
	breadth: number; // percentage of stocks outperforming
	technicalRating: "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL";
}

export interface RotationPattern {
	fromSector: string;
	toSector: string;
	strength: number; // 0-10
	duration: string;
	confidence: number;
	historicalAccuracy: number;
	triggers: string[];
}
