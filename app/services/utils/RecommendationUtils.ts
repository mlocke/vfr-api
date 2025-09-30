/**
 * Centralized Recommendation Utility - SINGLE SOURCE OF TRUTH
 * All recommendation calculations must use this utility to ensure consistency
 */

export interface AnalystData {
  consensus?: string
  strongBuy?: number
  buy?: number
  hold?: number
  sell?: number
  strongSell?: number
  totalAnalysts?: number
  sentimentScore?: number
  distribution?: {
    strongBuy?: number
    buy?: number
    hold?: number
    sell?: number
    strongSell?: number
  }
}

export type RecommendationTier =
  | 'STRONG_BUY'
  | 'BUY'
  | 'MODERATE_BUY'
  | 'HOLD'
  | 'MODERATE_SELL'
  | 'SELL'
  | 'STRONG_SELL'

/**
 * 🎯 SINGLE SOURCE OF TRUTH: Enhanced 7-tier recommendation system with analyst integration
 *
 * @param score - Composite score (MUST be 0-1 scale, defensive normalization from 0-100 included)
 * @param analystData - Optional analyst consensus data for recommendation upgrades
 * @returns 7-tier recommendation
 */
export function getRecommendation(score: number, analystData?: AnalystData): RecommendationTier {
  // 🚨 DEFENSIVE NORMALIZATION: Should not be needed if architecture is correct
  // Scores should ALWAYS arrive in 0-1 scale from FactorLibrary → AlgorithmEngine
  const normalizedScore = score > 1 ? score / 100 : score

  // 🔍 VALIDATION WARNING: Log if normalization was actually needed (indicates architecture violation)
  if (score > 1) {
    console.warn(`⚠️ RecommendationUtils: Received score ${score} > 1, normalized to ${normalizedScore}. This indicates KISS architecture violation!`)
    console.warn(`   Expected: 0-1 scale from FactorLibrary → AlgorithmEngine → API`)
  }

  // Base recommendation from score (7-tier system)
  let recommendation: RecommendationTier

  if (normalizedScore >= 0.85) {
    recommendation = 'STRONG_BUY'
  } else if (normalizedScore >= 0.70) {
    recommendation = 'BUY'
  } else if (normalizedScore >= 0.60) {
    recommendation = 'MODERATE_BUY'
  } else if (normalizedScore >= 0.40) {
    recommendation = 'HOLD'
  } else if (normalizedScore >= 0.30) {
    recommendation = 'MODERATE_SELL'
  } else if (normalizedScore >= 0.20) {
    recommendation = 'SELL'
  } else {
    recommendation = 'STRONG_SELL'
  }

  // Apply analyst rating adjustments if available
  if (analystData && analystData.totalAnalysts && analystData.totalAnalysts >= 5) {
    // ✅ FIX: distribution is nested inside analystData.distribution
    const { totalAnalysts = 0, sentimentScore, distribution, consensus } = analystData
    const { strongBuy = 0, buy = 0, hold = 0, sell = 0, strongSell = 0 } = distribution || {}

    // Calculate buy/sell/hold percentages
    const buyPercentage = ((strongBuy + buy) / totalAnalysts) * 100
    const sellPercentage = ((sell + strongSell) / totalAnalysts) * 100
    const holdPercentage = (hold / totalAnalysts) * 100

    // 🔍 DEBUG: Log analyst data for diagnosis
    console.log(`📊 Analyst Consensus Data:`, {
      consensus,
      sentimentScore,
      totalAnalysts,
      distribution: { strongBuy, buy, hold, sell, strongSell },
      percentages: {
        buy: buyPercentage.toFixed(1),
        hold: holdPercentage.toFixed(1),
        sell: sellPercentage.toFixed(1)
      },
      baseRecommendation: recommendation,
      normalizedScore
    })

    // ✅ CALIBRATED THRESHOLDS: Aligned with real-world FMP analyst data (MSFT: score ~4.0 with 70% buy = Strong Buy)
    // Strong Buy Consensus (sentiment >= 4.0, buy% >= 70%) - Calibrated for FMP data scale
    if (sentimentScore && sentimentScore >= 4.0 && buyPercentage >= 70) {
      if (recommendation === 'BUY') recommendation = 'STRONG_BUY'
      else if (recommendation === 'MODERATE_BUY') recommendation = 'STRONG_BUY' // ✅ FIX: Allow MODERATE_BUY → STRONG_BUY upgrade
      else if (recommendation === 'HOLD') recommendation = 'MODERATE_BUY'
    }
    // Buy Consensus (sentiment >= 3.8, buy% >= 65%) - CALIBRATED for FMP analyst data
    else if (sentimentScore && sentimentScore >= 3.8 && buyPercentage >= 65) {
      if (recommendation === 'MODERATE_BUY') recommendation = 'BUY'
      else if (recommendation === 'HOLD' && normalizedScore >= 0.45) recommendation = 'MODERATE_BUY'
    }
    // Moderate Buy Consensus (sentiment >= 3.5, buy% >= 60%)
    else if (sentimentScore && sentimentScore >= 3.5 && buyPercentage >= 60) {
      if (recommendation === 'HOLD' && normalizedScore >= 0.40) recommendation = 'MODERATE_BUY'
    }
    // 🔻 DOWNGRADE LOGIC: Handle bearish/neutral analyst consensus
    // Hold/Neutral Consensus (sentiment 2.8-3.2, hold% >= 40% OR low buy%)
    else if (sentimentScore && sentimentScore >= 2.8 && sentimentScore <= 3.2 && (holdPercentage >= 40 || buyPercentage < 50)) {
      console.log(`⚠️ Neutral/Hold consensus detected - downgrading recommendation`)
      if (recommendation === 'STRONG_BUY') recommendation = 'BUY'
      else if (recommendation === 'BUY') recommendation = 'MODERATE_BUY'
      else if (recommendation === 'MODERATE_BUY') recommendation = 'HOLD'
    }
    // Bearish Consensus (sentiment < 2.8, hold% > buy% OR high sell%)
    else if (sentimentScore && sentimentScore < 2.8 && (holdPercentage > buyPercentage || sellPercentage >= 30)) {
      console.log(`🔻 Bearish consensus detected - strong downgrade`)
      if (recommendation === 'STRONG_BUY') recommendation = 'MODERATE_BUY'
      else if (recommendation === 'BUY') recommendation = 'HOLD'
      else if (recommendation === 'MODERATE_BUY') recommendation = 'HOLD'
      else if (recommendation === 'HOLD') recommendation = 'MODERATE_SELL'
    }
    // Sell Consensus (sentiment <= 2.5, sell% >= 60%)
    else if (sentimentScore && sentimentScore <= 2.5 && sellPercentage >= 60) {
      console.log(`❌ Strong sell consensus detected`)
      if (recommendation === 'SELL') recommendation = 'STRONG_SELL'
      else if (recommendation === 'MODERATE_SELL') recommendation = 'SELL'
      else if (recommendation === 'HOLD') recommendation = 'MODERATE_SELL'
    }
  }

  return recommendation
}

/**
 * Get recommendation color for UI display
 */
export function getRecommendationColor(recommendation: RecommendationTier): {
  bg: string
  text: string
  border: string
} {
  const rec = recommendation.toUpperCase()

  if (rec.includes('BUY')) {
    return {
      bg: 'rgba(34, 197, 94, 0.2)',
      text: 'rgba(34, 197, 94, 0.9)',
      border: 'rgba(34, 197, 94, 0.5)'
    }
  }

  if (rec.includes('SELL')) {
    return {
      bg: 'rgba(239, 68, 68, 0.2)',
      text: 'rgba(239, 68, 68, 0.9)',
      border: 'rgba(239, 68, 68, 0.5)'
    }
  }

  // HOLD
  return {
    bg: 'rgba(251, 191, 36, 0.2)',
    text: 'rgba(251, 191, 36, 0.9)',
    border: 'rgba(251, 191, 36, 0.5)'
  }
}