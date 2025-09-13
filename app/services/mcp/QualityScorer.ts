/**
 * Quality Scorer for MCP Data Fusion
 * Evaluates data quality from multiple dimensions to enable intelligent source selection
 */

import {
  DataQualityMetrics,
  QualityScore,
  FusionSourceConfig
} from './types'

export class QualityScorer {
  private sourceReputations: Map<string, number> = new Map()
  private sourceHistory: Map<string, Array<{
    timestamp: number
    accuracy: number
    latency: number
    success: boolean
  }>> = new Map()

  private weights = {
    freshness: 0.3,
    completeness: 0.25,
    accuracy: 0.25,
    sourceReputation: 0.15,
    latency: 0.05
  }

  constructor(customWeights?: Partial<typeof QualityScorer.prototype.weights>) {
    if (customWeights) {
      this.weights = { ...this.weights, ...customWeights }
    }
    this.normalizeWeights()
  }

  /**
   * Calculate overall quality score for data from a source
   */
  calculateQualityScore(
    source: string,
    data: any,
    timestamp: number,
    latency: number,
    validationResult?: { accuracy: number }
  ): QualityScore {
    const metrics: DataQualityMetrics = {
      freshness: this.calculateFreshness(timestamp),
      completeness: this.calculateCompleteness(data),
      accuracy: validationResult?.accuracy ?? this.getHistoricalAccuracy(source),
      sourceReputation: this.getSourceReputation(source),
      latency: this.calculateLatencyScore(latency)
    }

    const overall = this.calculateWeightedScore(metrics)

    return {
      overall,
      metrics,
      timestamp: Date.now(),
      source
    }
  }

  /**
   * Calculate freshness score based on data timestamp
   */
  private calculateFreshness(timestamp: number): number {
    const now = Date.now()
    const ageMs = now - timestamp

    // Define freshness thresholds (in milliseconds)
    const thresholds = {
      realtime: 1000,        // 1 second
      nearRealtime: 60000,   // 1 minute
      recent: 300000,        // 5 minutes
      acceptable: 3600000,   // 1 hour
      stale: 86400000        // 24 hours
    }

    if (ageMs <= thresholds.realtime) return 1.0
    if (ageMs <= thresholds.nearRealtime) return 0.95
    if (ageMs <= thresholds.recent) return 0.85
    if (ageMs <= thresholds.acceptable) return 0.7
    if (ageMs <= thresholds.stale) return 0.5

    // Exponential decay for older data
    const hoursSinceStale = (ageMs - thresholds.stale) / (3600000)
    return Math.max(0.1, 0.5 * Math.exp(-hoursSinceStale / 24))
  }

  /**
   * Calculate completeness score based on data fields present
   */
  private calculateCompleteness(data: any): number {
    if (!data) return 0

    // For different data types, check expected fields
    if (this.isStockPriceData(data)) {
      return this.calculateStockPriceCompleteness(data)
    } else if (this.isCompanyInfoData(data)) {
      return this.calculateCompanyInfoCompleteness(data)
    } else if (this.isFinancialStatementData(data)) {
      return this.calculateFinancialStatementCompleteness(data)
    }

    // Generic completeness check
    return this.calculateGenericCompleteness(data)
  }

  private isStockPriceData(data: any): boolean {
    return 'open' in data || 'close' in data || 'high' in data || 'low' in data
  }

  private calculateStockPriceCompleteness(data: any): number {
    const requiredFields = ['open', 'high', 'low', 'close', 'volume']
    const optionalFields = ['adjustedClose', 'dividends', 'splits', 'timestamp']

    let score = 0
    let maxScore = requiredFields.length + optionalFields.length * 0.5

    requiredFields.forEach(field => {
      if (data[field] !== undefined && data[field] !== null) {
        score += 1
      }
    })

    optionalFields.forEach(field => {
      if (data[field] !== undefined && data[field] !== null) {
        score += 0.5
      }
    })

    return Math.min(1, score / maxScore)
  }

  private isCompanyInfoData(data: any): boolean {
    return 'name' in data || 'marketCap' in data || 'sector' in data
  }

  private calculateCompanyInfoCompleteness(data: any): number {
    const requiredFields = ['symbol', 'name', 'exchange']
    const importantFields = ['marketCap', 'sector', 'industry']
    const optionalFields = ['description', 'website', 'employees', 'headquarters', 'foundedYear']

    let score = 0
    let maxScore = requiredFields.length + importantFields.length * 0.8 + optionalFields.length * 0.3

    requiredFields.forEach(field => {
      if (data[field] !== undefined && data[field] !== null) {
        score += 1
      }
    })

    importantFields.forEach(field => {
      if (data[field] !== undefined && data[field] !== null) {
        score += 0.8
      }
    })

    optionalFields.forEach(field => {
      if (data[field] !== undefined && data[field] !== null) {
        score += 0.3
      }
    })

    return Math.min(1, score / maxScore)
  }

  private isFinancialStatementData(data: any): boolean {
    return 'revenue' in data || 'netIncome' in data || 'totalAssets' in data
  }

  private calculateFinancialStatementCompleteness(data: any): number {
    const criticalFields = ['revenue', 'netIncome', 'eps']
    const importantFields = ['totalAssets', 'totalLiabilities', 'totalEquity']
    const cashFlowFields = ['operatingCashFlow', 'freeCashFlow']

    let score = 0
    let maxScore = criticalFields.length + importantFields.length * 0.7 + cashFlowFields.length * 0.5

    criticalFields.forEach(field => {
      if (data[field] !== undefined && data[field] !== null) {
        score += 1
      }
    })

    importantFields.forEach(field => {
      if (data[field] !== undefined && data[field] !== null) {
        score += 0.7
      }
    })

    cashFlowFields.forEach(field => {
      if (data[field] !== undefined && data[field] !== null) {
        score += 0.5
      }
    })

    return Math.min(1, score / maxScore)
  }

  private calculateGenericCompleteness(data: any): number {
    if (typeof data !== 'object' || data === null) {
      return data !== undefined && data !== null ? 0.5 : 0
    }

    const keys = Object.keys(data)
    const nonNullValues = keys.filter(k => data[k] !== null && data[k] !== undefined)

    if (keys.length === 0) return 0

    // Ratio of non-null fields
    const basicScore = nonNullValues.length / keys.length

    // Bonus for having more fields
    const fieldBonus = Math.min(0.2, keys.length / 50)

    return Math.min(1, basicScore + fieldBonus)
  }

  /**
   * Calculate latency score (lower latency = higher score)
   */
  private calculateLatencyScore(latencyMs: number): number {
    // Define latency thresholds
    const excellent = 100   // < 100ms is excellent
    const good = 300       // < 300ms is good
    const acceptable = 1000 // < 1s is acceptable
    const poor = 3000      // < 3s is poor

    if (latencyMs <= excellent) return 1.0
    if (latencyMs <= good) return 0.9
    if (latencyMs <= acceptable) return 0.7
    if (latencyMs <= poor) return 0.5

    // Exponential decay for very high latency
    return Math.max(0.1, 0.5 * Math.exp(-(latencyMs - poor) / 5000))
  }

  /**
   * Get historical accuracy for a source
   */
  private getHistoricalAccuracy(source: string): number {
    const history = this.sourceHistory.get(source)
    if (!history || history.length === 0) {
      return 0.7 // Default neutral accuracy
    }

    // Weight recent history more heavily
    const now = Date.now()
    let weightedSum = 0
    let totalWeight = 0

    history.forEach(entry => {
      const ageHours = (now - entry.timestamp) / (3600000)
      const weight = Math.exp(-ageHours / 168) // Decay over a week

      weightedSum += entry.accuracy * weight
      totalWeight += weight
    })

    return totalWeight > 0 ? weightedSum / totalWeight : 0.7
  }

  /**
   * Get source reputation score
   */
  getSourceReputation(source: string): number {
    // Check if we have a stored reputation
    if (this.sourceReputations.has(source)) {
      return this.sourceReputations.get(source)!
    }

    // Default reputations for known sources
    const defaultReputations: Record<string, number> = {
      'polygon': 0.95,      // Institutional grade
      'alphavantage': 0.85, // Reliable, some limitations
      'fmp': 0.80,         // Good quality
      'yahoo': 0.75,       // Free but generally reliable
      'firecrawl': 0.70,   // Web scraping, variable quality
      'cache': 0.60        // Cached data, potentially stale
    }

    return defaultReputations[source] ?? 0.65
  }

  /**
   * Update source reputation based on performance
   */
  updateSourceReputation(source: string, performance: {
    success: boolean
    accuracy?: number
    latency: number
  }) {
    // Record in history
    const history = this.sourceHistory.get(source) || []
    history.push({
      timestamp: Date.now(),
      accuracy: performance.accuracy ?? (performance.success ? 0.8 : 0.2),
      latency: performance.latency,
      success: performance.success
    })

    // Keep only last 100 entries
    if (history.length > 100) {
      history.shift()
    }
    this.sourceHistory.set(source, history)

    // Update reputation
    const currentRep = this.getSourceReputation(source)
    const successRate = history.filter(h => h.success).length / history.length
    const avgAccuracy = history.reduce((sum, h) => sum + h.accuracy, 0) / history.length

    // Weighted combination of success rate and accuracy
    const newRep = (currentRep * 0.5) + (successRate * 0.3) + (avgAccuracy * 0.2)
    this.sourceReputations.set(source, Math.max(0.1, Math.min(1, newRep)))
  }

  /**
   * Calculate weighted overall score
   */
  private calculateWeightedScore(metrics: DataQualityMetrics): number {
    return (
      metrics.freshness * this.weights.freshness +
      metrics.completeness * this.weights.completeness +
      metrics.accuracy * this.weights.accuracy +
      metrics.sourceReputation * this.weights.sourceReputation +
      metrics.latency * this.weights.latency
    )
  }

  /**
   * Normalize weights to sum to 1
   */
  private normalizeWeights() {
    const sum = Object.values(this.weights).reduce((a, b) => a + b, 0)
    if (sum > 0) {
      Object.keys(this.weights).forEach(key => {
        this.weights[key as keyof typeof this.weights] /= sum
      })
    }
  }

  /**
   * Compare quality scores to determine best source
   */
  static selectBestSource(scores: QualityScore[]): string | null {
    if (scores.length === 0) return null

    let best = scores[0]
    for (let i = 1; i < scores.length; i++) {
      if (scores[i].overall > best.overall) {
        best = scores[i]
      }
    }

    return best.source
  }

  /**
   * Reset source history and reputations
   */
  reset() {
    this.sourceHistory.clear()
    this.sourceReputations.clear()
  }

  /**
   * Get statistics for monitoring
   */
  getStatistics(): {
    sources: Array<{
      source: string
      reputation: number
      historySize: number
      avgAccuracy?: number
      avgLatency?: number
    }>
  } {
    const sources: any[] = []

    for (const [source, history] of this.sourceHistory.entries()) {
      const avgAccuracy = history.length > 0
        ? history.reduce((sum, h) => sum + h.accuracy, 0) / history.length
        : undefined

      const avgLatency = history.length > 0
        ? history.reduce((sum, h) => sum + h.latency, 0) / history.length
        : undefined

      sources.push({
        source,
        reputation: this.getSourceReputation(source),
        historySize: history.length,
        avgAccuracy,
        avgLatency
      })
    }

    return { sources }
  }
}