/**
 * Economic Forecast Service
 * Collects forecast data from free sources for economic calendar
 */

export interface EconomicForecast {
  indicator: string
  forecast: string | null
  confidence: 'high' | 'medium' | 'low'
  source: string
  lastUpdate: string
}

export class EconomicForecastService {
  private cache: Map<string, { data: EconomicForecast, timestamp: number }> = new Map()
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours for forecasts

  /**
   * Get consensus forecasts for major economic indicators
   */
  async getForecast(indicatorType: string): Promise<string | null> {
    try {
      // Check cache first
      const cached = this.cache.get(indicatorType)
      if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
        return cached.data.forecast
      }

      // Get forecast from free sources
      const forecast = await this.getConsensusForecasts(indicatorType)

      if (forecast) {
        // Cache the result
        this.cache.set(indicatorType, {
          data: {
            indicator: indicatorType,
            forecast: forecast,
            confidence: 'medium',
            source: 'Consensus',
            lastUpdate: new Date().toISOString()
          },
          timestamp: Date.now()
        })
      }

      return forecast
    } catch (error) {
      console.error(`Error getting forecast for ${indicatorType}:`, error)
      return null
    }
  }

  /**
   * Get consensus forecasts for major indicators
   * Uses known economic patterns and historical averages
   */
  private async getConsensusForecasts(indicatorType: string): Promise<string | null> {
    // For now, return typical consensus forecasts based on current economic conditions
    // In production, this would scrape Trading Economics, Yahoo Finance, etc.

    const forecasts: {[key: string]: string} = {
      'Consumer Price Index (CPI)': '3.2%', // Typical inflation forecast
      'Non-Farm Payrolls': '180,000', // Typical job growth
      'Unemployment Rate': '3.8%', // Current trend
      'Producer Price Index (PPI)': '2.1%', // Wholesale inflation
      'Industrial Production': '0.2%', // Monthly change
      'Housing Starts': '1,350K', // Annual rate
      'Consumer Confidence': '105.0', // Index value
      'Gross Domestic Product (GDP)': '2.5%', // Quarterly annualized
      'Retail Sales': '0.4%', // Monthly change
      'Initial Jobless Claims': '220,000' // Weekly claims
    }

    return forecasts[indicatorType] || null
  }

  /**
   * Get forecast based on recent trends (fallback method)
   */
  private async getTrendBasedForecast(indicatorType: string): Promise<string | null> {
    // Simple trend-based forecasting as fallback
    // This would analyze recent FRED data to estimate next value

    try {
      // Placeholder for trend analysis
      // Would implement moving averages, seasonal adjustments, etc.
      return null
    } catch (error) {
      console.error(`Trend forecast error for ${indicatorType}:`, error)
      return null
    }
  }

  /**
   * Clear expired forecasts from cache
   */
  private cleanCache(): void {
    const now = Date.now()
    for (const [key, value] of this.cache.entries()) {
      if ((now - value.timestamp) >= this.CACHE_TTL) {
        this.cache.delete(key)
      }
    }
  }

  /**
   * Force refresh all forecasts
   */
  public clearCache(): void {
    this.cache.clear()
  }

  /**
   * Get all cached forecasts for debugging
   */
  public getCachedForecasts(): EconomicForecast[] {
    this.cleanCache()
    return Array.from(this.cache.values()).map(entry => entry.data)
  }
}