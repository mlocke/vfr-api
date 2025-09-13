/**
 * Data Transformation Layer for MCP Sources
 * Converts raw MCP responses into unified data models
 */

import {
  UnifiedStockPrice,
  UnifiedCompanyInfo,
  UnifiedFinancialStatement,
  UnifiedTechnicalIndicator,
  UnifiedNewsItem,
  QualityScore
} from './types'

export class DataTransformationLayer {
  /**
   * Transform stock price data from various MCP sources
   */
  static transformStockPrice(
    rawData: any,
    source: string,
    symbol: string,
    quality: QualityScore
  ): UnifiedStockPrice {
    switch (source) {
      case 'polygon':
        return this.transformPolygonPrice(rawData, symbol, quality)
      case 'alphavantage':
        return this.transformAlphaVantagePrice(rawData, symbol, quality)
      case 'yahoo':
        return this.transformYahooPrice(rawData, symbol, quality)
      default:
        return this.transformGenericPrice(rawData, source, symbol, quality)
    }
  }

  /**
   * Transform Polygon.io price data
   */
  private static transformPolygonPrice(
    data: any,
    symbol: string,
    quality: QualityScore
  ): UnifiedStockPrice {
    // Polygon format: { o, c, h, l, v, t }
    const result = data.results?.[0] || data

    return {
      symbol,
      open: result.o || result.open || 0,
      high: result.h || result.high || 0,
      low: result.l || result.low || 0,
      close: result.c || result.close || 0,
      volume: result.v || result.volume || 0,
      timestamp: result.t || result.timestamp || Date.now(),
      adjustedClose: result.vw, // Volume weighted average price
      source: 'polygon',
      quality
    }
  }

  /**
   * Transform Alpha Vantage price data
   */
  private static transformAlphaVantagePrice(
    data: any,
    symbol: string,
    quality: QualityScore
  ): UnifiedStockPrice {
    // Alpha Vantage Time Series format
    const timeSeries = data['Time Series (Daily)'] || data['Time Series (Intraday)']
    if (!timeSeries) {
      return this.createEmptyPrice(symbol, 'alphavantage', quality)
    }

    const latestDate = Object.keys(timeSeries)[0]
    const latest = timeSeries[latestDate]

    return {
      symbol,
      open: parseFloat(latest['1. open']),
      high: parseFloat(latest['2. high']),
      low: parseFloat(latest['3. low']),
      close: parseFloat(latest['4. close']),
      volume: parseInt(latest['5. volume']),
      timestamp: new Date(latestDate).getTime(),
      adjustedClose: parseFloat(latest['5. adjusted close'] || latest['4. close']),
      dividends: parseFloat(latest['7. dividend amount'] || '0'),
      splits: parseFloat(latest['8. split coefficient'] || '1'),
      source: 'alphavantage',
      quality
    }
  }

  /**
   * Transform Yahoo Finance price data
   */
  private static transformYahooPrice(
    data: any,
    symbol: string,
    quality: QualityScore
  ): UnifiedStockPrice {
    // Yahoo Finance format varies
    const quote = data.chart?.result?.[0]?.indicators?.quote?.[0] || data
    const meta = data.chart?.result?.[0]?.meta || {}

    const length = quote.open?.length || 1
    const index = length - 1 // Get latest data

    return {
      symbol,
      open: quote.open?.[index] || meta.regularMarketPrice || 0,
      high: quote.high?.[index] || meta.regularMarketDayHigh || 0,
      low: quote.low?.[index] || meta.regularMarketDayLow || 0,
      close: quote.close?.[index] || meta.regularMarketPrice || 0,
      volume: quote.volume?.[index] || meta.regularMarketVolume || 0,
      timestamp: data.chart?.result?.[0]?.timestamp?.[index] * 1000 || Date.now(),
      adjustedClose: data.chart?.result?.[0]?.indicators?.adjclose?.[0]?.adjclose?.[index],
      source: 'yahoo',
      quality
    }
  }

  /**
   * Transform generic price data
   */
  private static transformGenericPrice(
    data: any,
    source: string,
    symbol: string,
    quality: QualityScore
  ): UnifiedStockPrice {
    return {
      symbol,
      open: this.extractNumber(data, ['open', 'o', 'openPrice']),
      high: this.extractNumber(data, ['high', 'h', 'highPrice']),
      low: this.extractNumber(data, ['low', 'l', 'lowPrice']),
      close: this.extractNumber(data, ['close', 'c', 'closePrice', 'price']),
      volume: this.extractNumber(data, ['volume', 'v', 'vol']),
      timestamp: this.extractNumber(data, ['timestamp', 't', 'time', 'date']) || Date.now(),
      source,
      quality
    }
  }

  /**
   * Transform company information from various sources
   */
  static transformCompanyInfo(
    rawData: any,
    source: string,
    symbol: string,
    quality: QualityScore
  ): UnifiedCompanyInfo {
    switch (source) {
      case 'polygon':
        return this.transformPolygonCompany(rawData, symbol, quality)
      case 'fmp':
        return this.transformFMPCompany(rawData, symbol, quality)
      case 'yahoo':
        return this.transformYahooCompany(rawData, symbol, quality)
      default:
        return this.transformGenericCompany(rawData, source, symbol, quality)
    }
  }

  /**
   * Transform Polygon company data
   */
  private static transformPolygonCompany(
    data: any,
    symbol: string,
    quality: QualityScore
  ): UnifiedCompanyInfo {
    const result = data.results || data

    return {
      symbol,
      name: result.name || result.companyName || '',
      exchange: result.primary_exchange || result.exchange || '',
      marketCap: result.market_cap || result.marketCap,
      sector: result.sic_description || result.sector,
      industry: result.industry,
      description: result.description,
      website: result.homepage_url || result.website,
      employees: result.total_employees || result.employees,
      headquarters: `${result.address?.city || ''}, ${result.address?.state || ''}`.trim(),
      foundedYear: result.list_date ? new Date(result.list_date).getFullYear() : undefined,
      source: 'polygon',
      quality
    }
  }

  /**
   * Transform FMP company data
   */
  private static transformFMPCompany(
    data: any,
    symbol: string,
    quality: QualityScore
  ): UnifiedCompanyInfo {
    const company = Array.isArray(data) ? data[0] : data

    return {
      symbol,
      name: company.companyName || company.name || '',
      exchange: company.exchangeShortName || company.exchange || '',
      marketCap: company.mktCap || company.marketCapitalization,
      sector: company.sector,
      industry: company.industry,
      description: company.description,
      website: company.website,
      employees: company.fullTimeEmployees,
      headquarters: `${company.city || ''}, ${company.state || ''} ${company.country || ''}`.trim(),
      source: 'fmp',
      quality
    }
  }

  /**
   * Transform Yahoo company data
   */
  private static transformYahooCompany(
    data: any,
    symbol: string,
    quality: QualityScore
  ): UnifiedCompanyInfo {
    const info = data.quoteSummary?.result?.[0] || data

    return {
      symbol,
      name: info.price?.longName || info.quoteType?.longName || '',
      exchange: info.price?.exchangeName || '',
      marketCap: info.price?.marketCap?.raw || info.summaryDetail?.marketCap?.raw,
      sector: info.summaryProfile?.sector,
      industry: info.summaryProfile?.industry,
      description: info.summaryProfile?.longBusinessSummary,
      website: info.summaryProfile?.website,
      employees: info.summaryProfile?.fullTimeEmployees,
      headquarters: `${info.summaryProfile?.city || ''}, ${info.summaryProfile?.state || ''} ${info.summaryProfile?.country || ''}`.trim(),
      source: 'yahoo',
      quality
    }
  }

  /**
   * Transform generic company data
   */
  private static transformGenericCompany(
    data: any,
    source: string,
    symbol: string,
    quality: QualityScore
  ): UnifiedCompanyInfo {
    return {
      symbol,
      name: this.extractString(data, ['name', 'companyName', 'longName']),
      exchange: this.extractString(data, ['exchange', 'exchangeName', 'market']),
      marketCap: this.extractNumber(data, ['marketCap', 'mktCap', 'market_cap']),
      sector: this.extractString(data, ['sector', 'sectorName']),
      industry: this.extractString(data, ['industry', 'industryName']),
      description: this.extractString(data, ['description', 'summary', 'overview']),
      website: this.extractString(data, ['website', 'homepage_url', 'url']),
      employees: this.extractNumber(data, ['employees', 'fullTimeEmployees', 'total_employees']),
      source,
      quality
    }
  }

  /**
   * Transform technical indicator data
   */
  static transformTechnicalIndicator(
    rawData: any,
    source: string,
    symbol: string,
    indicator: string,
    quality: QualityScore
  ): UnifiedTechnicalIndicator {
    let value: number | { [key: string]: number }
    let timestamp = Date.now()
    let parameters: { [key: string]: any } = {}

    switch (source) {
      case 'alphavantage':
        // Alpha Vantage technical indicators format
        const series = rawData[`Technical Analysis: ${indicator.toUpperCase()}`]
        if (series) {
          const latestDate = Object.keys(series)[0]
          const latest = series[latestDate]
          timestamp = new Date(latestDate).getTime()

          if (indicator.toLowerCase() === 'macd') {
            value = {
              MACD: parseFloat(latest.MACD),
              MACD_Hist: parseFloat(latest.MACD_Hist),
              MACD_Signal: parseFloat(latest.MACD_Signal)
            }
          } else {
            value = parseFloat(latest[indicator.toUpperCase()] || latest.value || latest)
          }
        } else {
          value = 0
        }
        break

      case 'polygon':
        // Polygon technical indicators format
        value = this.extractNumber(rawData, ['value', 'result', indicator])
        timestamp = this.extractNumber(rawData, ['timestamp', 't', 'time']) || Date.now()
        break

      default:
        value = this.extractNumber(rawData, ['value', indicator, 'result'])
        break
    }

    return {
      symbol,
      indicator: indicator.toUpperCase(),
      timestamp,
      value,
      parameters,
      source,
      quality
    }
  }

  /**
   * Transform news data
   */
  static transformNews(
    rawData: any,
    source: string,
    quality: QualityScore
  ): UnifiedNewsItem[] {
    switch (source) {
      case 'alphavantage':
        return this.transformAlphaVantageNews(rawData, quality)
      case 'firecrawl':
        return this.transformFirecrawlNews(rawData, quality)
      case 'yahoo':
        return this.transformYahooNews(rawData, quality)
      default:
        return this.transformGenericNews(rawData, source, quality)
    }
  }

  /**
   * Transform Alpha Vantage news
   */
  private static transformAlphaVantageNews(
    data: any,
    quality: QualityScore
  ): UnifiedNewsItem[] {
    const feed = data.feed || []

    return feed.map((article: any, index: number) => ({
      id: `av-${article.time_published}-${index}`,
      title: article.title,
      description: article.summary || article.description || '',
      url: article.url,
      publishedAt: new Date(article.time_published).getTime(),
      source: 'alphavantage',
      symbols: article.ticker_sentiment?.map((t: any) => t.ticker) || [],
      sentiment: article.overall_sentiment_score !== undefined ? {
        score: parseFloat(article.overall_sentiment_score),
        label: article.overall_sentiment_label?.toLowerCase() as 'positive' | 'negative' | 'neutral'
      } : undefined,
      quality
    }))
  }

  /**
   * Transform Firecrawl news
   */
  private static transformFirecrawlNews(
    data: any,
    quality: QualityScore
  ): UnifiedNewsItem[] {
    const results = data.results || []

    return results.map((article: any, index: number) => ({
      id: `fc-${Date.now()}-${index}`,
      title: article.title,
      description: article.description || article.markdown?.substring(0, 200) || '',
      url: article.url,
      publishedAt: Date.now(), // Firecrawl doesn't provide timestamps
      source: 'firecrawl',
      symbols: [], // Extract from content if needed
      quality
    }))
  }

  /**
   * Transform Yahoo news
   */
  private static transformYahooNews(
    data: any,
    quality: QualityScore
  ): UnifiedNewsItem[] {
    const news = data.news || []

    return news.map((article: any) => ({
      id: `yf-${article.uuid}`,
      title: article.title,
      description: article.summary || article.description || '',
      url: article.link,
      publishedAt: article.providerPublishTime * 1000,
      source: 'yahoo',
      symbols: article.relatedTickers || [],
      quality
    }))
  }

  /**
   * Transform generic news
   */
  private static transformGenericNews(
    data: any,
    source: string,
    quality: QualityScore
  ): UnifiedNewsItem[] {
    const articles = Array.isArray(data) ? data : [data]

    return articles.map((article: any, index: number) => ({
      id: `${source}-${Date.now()}-${index}`,
      title: this.extractString(article, ['title', 'headline']),
      description: this.extractString(article, ['description', 'summary', 'content']),
      url: this.extractString(article, ['url', 'link', 'href']),
      publishedAt: this.extractNumber(article, ['publishedAt', 'timestamp', 'date']) || Date.now(),
      source,
      symbols: article.symbols || [],
      quality
    }))
  }

  /**
   * Helper: Extract number from nested object
   */
  private static extractNumber(obj: any, keys: string[]): number {
    for (const key of keys) {
      if (obj && typeof obj[key] === 'number') {
        return obj[key]
      }
      // Try nested access
      const parts = key.split('.')
      let current = obj
      for (const part of parts) {
        if (current && current[part] !== undefined) {
          current = current[part]
        } else {
          current = undefined
          break
        }
      }
      if (typeof current === 'number') {
        return current
      }
    }
    return 0
  }

  /**
   * Helper: Extract string from nested object
   */
  private static extractString(obj: any, keys: string[]): string {
    for (const key of keys) {
      if (obj && typeof obj[key] === 'string') {
        return obj[key]
      }
      // Try nested access
      const parts = key.split('.')
      let current = obj
      for (const part of parts) {
        if (current && current[part] !== undefined) {
          current = current[part]
        } else {
          current = undefined
          break
        }
      }
      if (typeof current === 'string') {
        return current
      }
    }
    return ''
  }

  /**
   * Helper: Create empty price object
   */
  private static createEmptyPrice(
    symbol: string,
    source: string,
    quality: QualityScore
  ): UnifiedStockPrice {
    return {
      symbol,
      open: 0,
      high: 0,
      low: 0,
      close: 0,
      volume: 0,
      timestamp: Date.now(),
      source,
      quality
    }
  }
}