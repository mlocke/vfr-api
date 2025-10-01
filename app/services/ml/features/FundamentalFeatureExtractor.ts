/**
 * FundamentalFeatureExtractor
 *
 * Extracts fundamental features for ML models including:
 * - Valuation ratios (P/E, P/B, P/S, PEG)
 * - Profitability metrics (ROE, ROA, margins)
 * - Financial health (D/E, current ratio, quick ratio)
 * - Growth metrics (revenue growth, earnings growth)
 *
 * This service complements FundamentalFeatureIntegrator by providing derived
 * features that are specifically useful for ML model prediction.
 *
 * Performance Target: <100ms per symbol
 */

import type { FundamentalRatios } from '../../financial-data/types';

/**
 * Valuation features
 */
export interface ValuationFeatures {
  // Core valuation ratios
  peRatio: number;
  pegRatio: number;
  pbRatio: number;
  priceToSales: number;
  priceToFreeCashFlow: number;

  // Derived valuation metrics
  valuationScore: number; // 0-1 scale, lower is cheaper
  isPremiumValuation: boolean; // True if trading at premium multiples
  relativeValuation: number; // Normalized composite valuation score
}

/**
 * Profitability features
 */
export interface ProfitabilityFeatures {
  // Returns
  roe: number; // Return on Equity
  roa: number; // Return on Assets

  // Margins
  grossProfitMargin: number;
  operatingMargin: number;
  netProfitMargin: number;

  // Derived profitability metrics
  profitabilityScore: number; // 0-1 scale, higher is better
  marginTrend: number; // -1 to +1, positive indicates improving margins
  isHighQuality: boolean; // True if ROE > 15% and margins healthy
}

/**
 * Financial health features
 */
export interface FinancialHealthFeatures {
  // Leverage ratios
  debtToEquity: number;

  // Liquidity ratios
  currentRatio: number;
  quickRatio: number;

  // Derived health metrics
  healthScore: number; // 0-1 scale, higher is healthier
  leverageRisk: number; // 0-1 scale, higher is riskier
  liquidityStrength: number; // 0-1 scale, higher is more liquid
  isFinanciallyStressed: boolean; // True if showing signs of financial stress
}

/**
 * Shareholder return features
 */
export interface ShareholderReturnFeatures {
  // Dividend metrics
  dividendYield: number;
  payoutRatio: number;

  // Derived metrics
  dividendSustainability: number; // 0-1 scale, based on payout ratio
  isIncomeFocused: boolean; // True if dividend yield > 3%
  dividendGrowthPotential: number; // 0-1 scale
}

/**
 * Complete set of fundamental features
 */
export interface FundamentalFeatures {
  symbol: string;
  timestamp: number;
  valuation: ValuationFeatures;
  profitability: ProfitabilityFeatures;
  financialHealth: FinancialHealthFeatures;
  shareholderReturn: ShareholderReturnFeatures;
  dataCompleteness: number; // 0-1 scale, percentage of fields with data
  source: string;
}

/**
 * FundamentalFeatureExtractor - Extract fundamental features for ML
 */
export class FundamentalFeatureExtractor {
  /**
   * Extract all fundamental features from ratios data
   */
  static extractFeatures(
    symbol: string,
    ratios: FundamentalRatios
  ): FundamentalFeatures {
    const startTime = Date.now();

    const valuation = this.extractValuationFeatures(ratios);
    const profitability = this.extractProfitabilityFeatures(ratios);
    const financialHealth = this.extractFinancialHealthFeatures(ratios);
    const shareholderReturn = this.extractShareholderReturnFeatures(ratios);

    // Calculate data completeness
    const dataCompleteness = this.calculateDataCompleteness(ratios);

    const calculationTime = Date.now() - startTime;

    if (calculationTime > 100) {
      console.warn(
        `FundamentalFeatureExtractor exceeded target time for ${symbol}: ${calculationTime}ms`
      );
    }

    return {
      symbol,
      timestamp: Date.now(),
      valuation,
      profitability,
      financialHealth,
      shareholderReturn,
      dataCompleteness,
      source: ratios.source
    };
  }

  /**
   * Extract valuation features
   */
  private static extractValuationFeatures(
    ratios: FundamentalRatios
  ): ValuationFeatures {
    const peRatio = ratios.peRatio ?? 0;
    const pegRatio = ratios.pegRatio ?? 0;
    const pbRatio = ratios.pbRatio ?? 0;
    const priceToSales = ratios.priceToSales ?? 0;
    const priceToFreeCashFlow = ratios.priceToFreeCashFlow ?? 0;

    // Calculate valuation score (0-1, lower is cheaper/better)
    // Normalize each ratio and average them
    const peScore = peRatio > 0 ? Math.min(1, peRatio / 50) : 0.5; // 50+ is expensive
    const pegScore = pegRatio > 0 ? Math.min(1, pegRatio / 3) : 0.5; // 3+ is expensive
    const pbScore = pbRatio > 0 ? Math.min(1, pbRatio / 5) : 0.5; // 5+ is expensive
    const psScore = priceToSales > 0 ? Math.min(1, priceToSales / 10) : 0.5; // 10+ is expensive

    const valuationScore = (peScore + pegScore + pbScore + psScore) / 4;

    // Premium valuation if most ratios are high
    const isPremiumValuation = peRatio > 25 && pbRatio > 3 && priceToSales > 5;

    // Relative valuation (inverted so higher is better for ML)
    const relativeValuation = 1 - valuationScore;

    return {
      peRatio,
      pegRatio,
      pbRatio,
      priceToSales,
      priceToFreeCashFlow,
      valuationScore,
      isPremiumValuation,
      relativeValuation
    };
  }

  /**
   * Extract profitability features
   */
  private static extractProfitabilityFeatures(
    ratios: FundamentalRatios
  ): ProfitabilityFeatures {
    const roe = ratios.roe ?? 0;
    const roa = ratios.roa ?? 0;
    const grossProfitMargin = ratios.grossProfitMargin ?? 0;
    const operatingMargin = ratios.operatingMargin ?? 0;
    const netProfitMargin = ratios.netProfitMargin ?? 0;

    // Calculate profitability score (0-1, higher is better)
    const roeScore = roe > 0 ? Math.min(1, roe / 30) : 0; // 30%+ is excellent
    const roaScore = roa > 0 ? Math.min(1, roa / 15) : 0; // 15%+ is excellent
    const marginScore = netProfitMargin > 0 ? Math.min(1, netProfitMargin / 30) : 0; // 30%+ is excellent

    const profitabilityScore = (roeScore + roaScore + marginScore) / 3;

    // Margin trend (simplified - would need historical data for true trend)
    // For now, use margin levels as proxy
    const marginTrend = netProfitMargin > operatingMargin * 0.9 ? 0.5 : -0.5;

    // High quality if ROE > 15% and healthy margins
    const isHighQuality = roe > 15 && netProfitMargin > 10 && operatingMargin > 15;

    return {
      roe,
      roa,
      grossProfitMargin,
      operatingMargin,
      netProfitMargin,
      profitabilityScore,
      marginTrend,
      isHighQuality
    };
  }

  /**
   * Extract financial health features
   */
  private static extractFinancialHealthFeatures(
    ratios: FundamentalRatios
  ): FinancialHealthFeatures {
    const debtToEquity = ratios.debtToEquity ?? 0;
    const currentRatio = ratios.currentRatio ?? 1;
    const quickRatio = ratios.quickRatio ?? 1;

    // Leverage risk (0-1, higher is riskier)
    const leverageRisk = Math.min(1, debtToEquity / 2); // D/E > 2 is high risk

    // Liquidity strength (0-1, higher is better)
    const currentRatioScore = Math.min(1, currentRatio / 2); // 2+ is strong
    const quickRatioScore = Math.min(1, quickRatio / 1.5); // 1.5+ is strong
    const liquidityStrength = (currentRatioScore + quickRatioScore) / 2;

    // Health score (0-1, higher is healthier)
    const healthScore = (1 - leverageRisk + liquidityStrength) / 2;

    // Financial stress if high leverage and weak liquidity
    const isFinanciallyStressed = debtToEquity > 1.5 && currentRatio < 1.2;

    return {
      debtToEquity,
      currentRatio,
      quickRatio,
      healthScore,
      leverageRisk,
      liquidityStrength,
      isFinanciallyStressed
    };
  }

  /**
   * Extract shareholder return features
   */
  private static extractShareholderReturnFeatures(
    ratios: FundamentalRatios
  ): ShareholderReturnFeatures {
    const dividendYield = ratios.dividendYield ?? 0;
    const payoutRatio = ratios.payoutRatio ?? 0;

    // Dividend sustainability (0-1, based on payout ratio)
    // Optimal payout ratio is 40-60%, too high or too low is concerning
    const dividendSustainability = payoutRatio > 0 && payoutRatio <= 80
      ? Math.max(0, 1 - Math.abs(payoutRatio - 50) / 50)
      : 0.5;

    // Income focused if yield > 3%
    const isIncomeFocused = dividendYield > 3;

    // Dividend growth potential (higher if low payout ratio but paying dividends)
    const dividendGrowthPotential = dividendYield > 0 && payoutRatio < 60
      ? Math.min(1, (60 - payoutRatio) / 60)
      : 0;

    return {
      dividendYield,
      payoutRatio,
      dividendSustainability,
      isIncomeFocused,
      dividendGrowthPotential
    };
  }

  /**
   * Calculate data completeness (percentage of fields with valid data)
   */
  private static calculateDataCompleteness(ratios: FundamentalRatios): number {
    const fields = [
      ratios.peRatio,
      ratios.pegRatio,
      ratios.pbRatio,
      ratios.priceToSales,
      ratios.priceToFreeCashFlow,
      ratios.debtToEquity,
      ratios.currentRatio,
      ratios.quickRatio,
      ratios.roe,
      ratios.roa,
      ratios.grossProfitMargin,
      ratios.operatingMargin,
      ratios.netProfitMargin,
      ratios.dividendYield,
      ratios.payoutRatio
    ];

    const validFields = fields.filter(
      (field) => field !== undefined && field !== null && !isNaN(field)
    ).length;

    return validFields / fields.length;
  }

  /**
   * Get default/fallback features when data is unavailable
   */
  static getDefaultFeatures(symbol: string): FundamentalFeatures {
    return {
      symbol,
      timestamp: Date.now(),
      valuation: {
        peRatio: 0,
        pegRatio: 0,
        pbRatio: 0,
        priceToSales: 0,
        priceToFreeCashFlow: 0,
        valuationScore: 0.5,
        isPremiumValuation: false,
        relativeValuation: 0.5
      },
      profitability: {
        roe: 0,
        roa: 0,
        grossProfitMargin: 0,
        operatingMargin: 0,
        netProfitMargin: 0,
        profitabilityScore: 0,
        marginTrend: 0,
        isHighQuality: false
      },
      financialHealth: {
        debtToEquity: 0,
        currentRatio: 1,
        quickRatio: 1,
        healthScore: 0.5,
        leverageRisk: 0,
        liquidityStrength: 0.5,
        isFinanciallyStressed: false
      },
      shareholderReturn: {
        dividendYield: 0,
        payoutRatio: 0,
        dividendSustainability: 0.5,
        isIncomeFocused: false,
        dividendGrowthPotential: 0
      },
      dataCompleteness: 0,
      source: 'default'
    };
  }
}
