/**
 * Smart Money Flow ML Model - Type Definitions
 *
 * This file defines all TypeScript interfaces for the Smart Money Flow model,
 * which analyzes insider trading, institutional ownership, congressional trades,
 * and hedge fund holdings to generate conviction signals.
 */

/**
 * Lean Smart Money Flow Features (27 total)
 * Used by LeanSmartMoneyFeatureExtractor - matches smart-money-flow v3.0.0 model
 */
export interface LeanSmartMoneyFeatures {
	// === Congressional Trading Features (4) ===
	congress_buy_count_90d: number;
	congress_sell_count_90d: number;
	congress_net_sentiment: number;
	congress_recent_activity_7d: number;

	// === Volume & Dark Pool Features (3) ===
	institutional_volume_ratio: number;
	volume_concentration: number;
	dark_pool_volume_30d: number;

	// === Price & Volume Momentum Features (3) ===
	price_momentum_20d: number;
	volume_trend_30d: number;
	price_volatility_30d: number;

	// === Detailed Options Flow Features from EODHD (17) ===
	put_call_volume_ratio: number;           // Put volume / Call volume
	put_call_oi_ratio: number;               // Put open interest / Call open interest
	large_block_call_pct: number;            // % of call contracts with volume > 100
	large_block_put_pct: number;             // % of put contracts with volume > 100
	avg_call_premium_above_mid: number;      // Avg (last - mid) / mid for calls
	avg_put_premium_above_mid: number;       // Avg (last - mid) / mid for puts
	oi_skew_call_put: number;                // (Call OI - Put OI) / (Call OI + Put OI)
	near_money_call_concentration: number;   // ATM call volume / total call volume
	far_otm_call_activity: number;           // Far OTM call volume / total call volume
	protective_put_ratio: number;            // ATM put volume / total put volume
	high_delta_call_volume_pct: number;      // ITM call volume / total call volume
	long_dated_call_ratio: number;           // Calls expiring >30d / total call volume
	net_gamma_exposure: number;              // (Call gamma - Put gamma) / (Call + Put gamma)
	iv_rank_percentile: number;              // Average implied volatility rank
	iv_skew_25delta: number;                 // Put IV - Call IV (25 delta)
	avg_call_vol_oi_ratio: number;           // Call volume / Call open interest
	avg_put_vol_oi_ratio: number;            // Put volume / Put open interest
}

/**
 * Smart Money Flow Features (27 total)
 * Extracted from FMP API insider/institutional data
 */
export interface SmartMoneyFeatures {
	// === Insider Trading Features (8) ===
	insider_buy_ratio_30d: number;           // Buy transactions / total transactions (30 days)
	insider_buy_volume_30d: number;          // Total shares purchased (30 days)
	insider_sell_volume_30d: number;         // Total shares sold (30 days)
	insider_net_flow_30d: number;            // Buy volume - Sell volume
	insider_cluster_score: number;           // Clustering metric (multiple insiders buying within 7 days)
	insider_ownership_change_90d: number;    // Change in total insider ownership (90 days)
	insider_avg_premium: number;             // Average % premium paid above market price
	c_suite_activity_ratio: number;          // C-level transactions / all insider transactions

	// === Institutional Ownership Features (7) ===
	inst_ownership_pct: number;              // % of shares held by institutions
	inst_ownership_change_1q: number;        // Change in ownership (1 quarter)
	inst_new_positions_count: number;        // Number of new institutional buyers
	inst_closed_positions_count: number;     // Number of institutions that exited
	inst_avg_position_size_change: number;   // Average % change in position sizes
	inst_concentration_top10: number;        // % held by top 10 institutions
	inst_momentum_score: number;             // Weighted score based on recent changes

	// === Congressional Trading Features (4) ===
	congress_buy_count_90d: number;          // Number of buy transactions (90 days)
	congress_sell_count_90d: number;         // Number of sell transactions (90 days)
	congress_net_sentiment: number;          // Buy count - Sell count
	congress_recent_activity_7d: number;     // Boolean: 1 if activity in past 7 days, 0 otherwise

	// === Hedge Fund Holdings Features (5) ===
	hedgefund_top20_exposure: number;        // % ownership by top 20 hedge funds
	hedgefund_net_change_1q: number;         // Net change in hedge fund holdings (1 quarter)
	hedgefund_new_entry_count: number;       // Number of new hedge fund positions
	hedgefund_exit_count: number;            // Number of hedge funds that exited
	hedgefund_conviction_score: number;      // Weighted score (larger funds = higher weight)

	// === ETF Holdings Features (3) ===
	etf_ownership_pct: number;               // % held by ETFs
	etf_flow_30d: number;                    // Net ETF buying/selling
	etf_concentration: number;               // % held by top 5 ETFs
}

/**
 * Insider Trading Transaction (FMP API)
 * From: /v4/insider-trading
 */
export interface InsiderTransaction {
	symbol: string;
	filingDate: string;                      // Form 4 filing date
	transactionDate: string;                 // Actual transaction date
	transactionType: 'P' | 'S' | 'A' | 'M' | 'G' | 'D'; // P=Purchase, S=Sale, A=Award, M=Exercise, G=Gift, D=Disposition
	securitiesTransacted: number;            // Number of shares
	price: number;                           // Transaction price
	securitiesOwned: number;                 // Total ownership after transaction
	typeOfOwner: string;                     // Director, Officer, 10% Owner
	reportingName: string;                   // Name of insider
}

/**
 * Institutional Ownership Holding (FMP API)
 * From: /v4/institutional-ownership/symbol-ownership
 */
export interface InstitutionalHolding {
	symbol: string;
	date: string;                            // Quarter end date
	investorName: string;                    // Institution name
	shares: number;                          // Number of shares held
	change: number;                          // Change in shares from previous quarter
	changePercent: number;                   // % change in position
	marketValue: number;                     // Dollar value of holding
	putCallShare: 'New' | 'Add' | 'Reduce' | 'SoldOut'; // Position change type
}

/**
 * Congressional Trading Disclosure (FMP API)
 * From: /v4/senate-trading & /v4/house-disclosure
 */
export interface CongressionalTrade {
	symbol: string;
	transactionDate: string;
	transactionType: 'Purchase' | 'Sale';
	amount: string;                          // Amount range (e.g., "$1,001 - $15,000")
	representative: string;                  // Member of Congress
	chamber: 'Senate' | 'House';
}

/**
 * ETF Holding (FMP API)
 * From: /v3/etf-holder/{symbol}
 */
export interface ETFHolding {
	symbol: string;
	date: string;
	etfSymbol: string;                       // ETF ticker
	etfName: string;                         // ETF name
	shares: number;                          // Shares held by ETF
	weightPercentage: number;                // % of ETF's portfolio
	marketValue: number;                     // Dollar value
}

/**
 * Smart Money Flow Prediction
 * Output from SmartMoneyFlowService
 */
export interface SmartMoneyFlowPrediction {
	symbol: string;
	predicted_conviction: 'BULLISH' | 'BEARISH';
	conviction_score: number;                // 0-100
	confidence: 'HIGH' | 'MEDIUM' | 'LOW';
	features: SmartMoneyFeatures;
	signals: {
		insider_activity: 'bullish' | 'neutral' | 'bearish';
		institutional_flow: 'accumulation' | 'distribution' | 'neutral';
		congressional_sentiment: 'positive' | 'neutral' | 'negative';
		hedge_fund_positioning: 'long' | 'short' | 'neutral';
	};
	model: {
		version: string;
		algorithm: 'LightGBM';
		accuracy: number;
	};
	timestamp: number;
}

/**
 * Dark Pool Metrics for volume analysis
 */
export interface DarkPoolMetrics {
	institutionalVolumeRatio: number;
	darkPoolVolume30d: number;
	volumeConcentration: number;
}

/**
 * OHLCV Bar data from Polygon
 */
export interface OHLCVBar {
	timestamp: number;
	open: number;
	high: number;
	low: number;
	close: number;
	volume: number;
	vwap?: number;
}

/**
 * Historical data cache entry
 */
export interface CachedSmartMoneyData {
	symbol: string;
	startDate: string;
	endDate: string;
	dataType: 'insider' | 'institutional' | 'congressional' | 'etf';
	data: InsiderTransaction[] | InstitutionalHolding[] | CongressionalTrade[] | ETFHolding[];
	cachedAt: number;                        // Timestamp when cached
}

/**
 * Dataset generation sample
 */
export interface SmartMoneyTrainingSample {
	symbol: string;
	date: string;                            // Sample date
	features: SmartMoneyFeatures;
	label: 0 | 1;                            // 0=BEARISH, 1=BULLISH
	label_method: 'price-based' | 'composite';
	forward_return_14d: number;              // Actual 14-day forward return
}
