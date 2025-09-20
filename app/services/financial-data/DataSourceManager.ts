/**
 * Centralized Data Source Manager
 * Provides complete control over which APIs are used for every data type
 * Supports easy switching between data sources for all financial data
 */

import { PolygonAPI } from './PolygonAPI'
import { AlphaVantageAPI } from './AlphaVantageAPI'
import { YahooFinanceAPI } from './YahooFinanceAPI'
import { FinancialModelingPrepAPI } from './FinancialModelingPrepAPI'
import { TwelveDataAPI } from './TwelveDataAPI'
import { SECEdgarAPI } from './SECEdgarAPI'
import { TreasuryAPI } from './TreasuryAPI'
import { FREDAPI } from './FREDAPI'
import { BLSAPI } from './BLSAPI'
import { EIAAPI } from './EIAAPI'
import { EODHDAPI } from './EODHDAPI'
import { StockData, CompanyInfo, FinancialDataProvider, OptionsContract, OptionsChain, PutCallRatio, OptionsAnalysis } from './types'

export type DataSourceProvider =
  | 'polygon'
  | 'alphavantage'
  | 'yahoo'
  | 'fmp'
  | 'twelvedata'
  | 'eodhd'
  | 'sec_edgar'
  | 'treasury'
  | 'fred'
  | 'bls'
  | 'eia'

export type DataType =
  | 'stock_price'
  | 'company_info'
  | 'options_data'
  | 'options_chain'
  | 'put_call_ratio'
  | 'options_analysis'
  | 'fundamentals'
  | 'market_data'
  | 'economic_data'
  | 'treasury_data'
  | 'earnings'
  | 'news'

interface DataSourceConfig {
  enabled: boolean
  priority: number
  costTier: 'free' | 'paid' | 'premium'
  reliability: number // 0-1 scale
  dataQuality: number // 0-1 scale
  rateLimit: string
  description: string
  supportedDataTypes: DataType[]
}

interface DataTypePreferences {
  primary: DataSourceProvider
  fallbacks: DataSourceProvider[]
  lastUpdated: number
}

export class DataSourceManager {
  private providers: Map<DataSourceProvider, FinancialDataProvider> = new Map()

  private providerConfigs: Record<DataSourceProvider, DataSourceConfig> = {
    polygon: {
      enabled: true,
      priority: 1,
      costTier: 'paid',
      reliability: 0.95,
      dataQuality: 0.98,
      rateLimit: '5 req/min (free), unlimited (paid)',
      description: 'Polygon.io - Premium real-time and historical market data',
      supportedDataTypes: ['stock_price', 'company_info', 'options_data', 'options_chain', 'put_call_ratio', 'options_analysis', 'fundamentals', 'market_data']
    },
    alphavantage: {
      enabled: true,
      priority: 2,
      costTier: 'free',
      reliability: 0.85,
      dataQuality: 0.90,
      rateLimit: '25 req/day (free)',
      description: 'Alpha Vantage - Comprehensive free/premium financial data',
      supportedDataTypes: ['stock_price', 'company_info', 'fundamentals', 'market_data', 'economic_data']
    },
    fmp: {
      enabled: true,
      priority: 3,
      costTier: 'free',
      reliability: 0.90,
      dataQuality: 0.88,
      rateLimit: '250 req/day (free)',
      description: 'Financial Modeling Prep - Free financial statements and ratios',
      supportedDataTypes: ['stock_price', 'company_info', 'fundamentals', 'earnings', 'market_data']
    },
    yahoo: {
      enabled: true,
      priority: 4,
      costTier: 'free',
      reliability: 0.70,
      dataQuality: 0.75,
      rateLimit: 'Rate limited, unreliable',
      description: 'Yahoo Finance - Free but unreliable for automation',
      supportedDataTypes: ['stock_price', 'company_info', 'market_data']
    },
    twelvedata: {
      enabled: true,
      priority: 5,
      costTier: 'free',
      reliability: 0.85,
      dataQuality: 0.85,
      rateLimit: '800 req/day (free)',
      description: 'TwelveData - Good free tier, excellent paid plans',
      supportedDataTypes: ['stock_price', 'company_info', 'market_data', 'options_data', 'options_chain', 'put_call_ratio']
    },
    eodhd: {
      enabled: true,
      priority: 3,
      costTier: 'paid',
      reliability: 0.92,
      dataQuality: 0.94,
      rateLimit: '100,000 req/day',
      description: 'EODHD - Premium EOD data with options add-on subscription',
      supportedDataTypes: ['stock_price', 'company_info', 'market_data', 'options_data', 'options_chain', 'put_call_ratio', 'options_analysis']
    },
    sec_edgar: {
      enabled: true,
      priority: 6,
      costTier: 'free',
      reliability: 0.95,
      dataQuality: 0.95,
      rateLimit: '10 req/sec per IP',
      description: 'SEC EDGAR - Official government filings',
      supportedDataTypes: ['company_info', 'fundamentals', 'earnings']
    },
    treasury: {
      enabled: true,
      priority: 1,
      costTier: 'free',
      reliability: 0.98,
      dataQuality: 0.98,
      rateLimit: 'No official limit',
      description: 'US Treasury - Official treasury rates and data',
      supportedDataTypes: ['treasury_data', 'economic_data']
    },
    fred: {
      enabled: true,
      priority: 1,
      costTier: 'free',
      reliability: 0.98,
      dataQuality: 0.98,
      rateLimit: '120 req/min',
      description: 'Federal Reserve Economic Data - Official economic data',
      supportedDataTypes: ['economic_data', 'treasury_data']
    },
    bls: {
      enabled: true,
      priority: 2,
      costTier: 'free',
      reliability: 0.95,
      dataQuality: 0.95,
      rateLimit: '500 req/day',
      description: 'Bureau of Labor Statistics - Employment and inflation data',
      supportedDataTypes: ['economic_data']
    },
    eia: {
      enabled: true,
      priority: 2,
      costTier: 'free',
      reliability: 0.90,
      dataQuality: 0.90,
      rateLimit: '5000 req/hour',
      description: 'Energy Information Administration - Energy data',
      supportedDataTypes: ['economic_data']
    }
  }

  private dataTypePreferences: Record<DataType, DataTypePreferences> = {
    stock_price: {
      primary: 'polygon',
      fallbacks: ['alphavantage', 'fmp', 'yahoo', 'twelvedata'],
      lastUpdated: Date.now()
    },
    company_info: {
      primary: 'polygon',
      fallbacks: ['alphavantage', 'fmp', 'sec_edgar', 'yahoo'],
      lastUpdated: Date.now()
    },
    options_data: {
      primary: 'polygon',
      fallbacks: ['eodhd', 'twelvedata'],
      lastUpdated: Date.now()
    },
    options_chain: {
      primary: 'polygon',
      fallbacks: ['eodhd', 'twelvedata'],
      lastUpdated: Date.now()
    },
    put_call_ratio: {
      primary: 'polygon',
      fallbacks: ['eodhd', 'twelvedata'],
      lastUpdated: Date.now()
    },
    options_analysis: {
      primary: 'polygon',
      fallbacks: ['eodhd', 'twelvedata'],
      lastUpdated: Date.now()
    },
    fundamentals: {
      primary: 'fmp',
      fallbacks: ['alphavantage', 'polygon', 'sec_edgar'],
      lastUpdated: Date.now()
    },
    market_data: {
      primary: 'polygon',
      fallbacks: ['alphavantage', 'fmp', 'twelvedata', 'yahoo'],
      lastUpdated: Date.now()
    },
    economic_data: {
      primary: 'fred',
      fallbacks: ['bls', 'eia', 'alphavantage'],
      lastUpdated: Date.now()
    },
    treasury_data: {
      primary: 'fred',
      fallbacks: ['treasury'],
      lastUpdated: Date.now()
    },
    earnings: {
      primary: 'fmp',
      fallbacks: ['sec_edgar', 'alphavantage'],
      lastUpdated: Date.now()
    },
    news: {
      primary: 'alphavantage',
      fallbacks: ['fmp'],
      lastUpdated: Date.now()
    }
  }

  constructor() {
    this.initializeProviders()
  }

  /**
   * Initialize all data provider instances
   */
  private initializeProviders(): void {
    this.providers.set('polygon', new PolygonAPI())
    this.providers.set('alphavantage', new AlphaVantageAPI())
    this.providers.set('yahoo', new YahooFinanceAPI())
    this.providers.set('fmp', new FinancialModelingPrepAPI())
    this.providers.set('twelvedata', new TwelveDataAPI())
    this.providers.set('eodhd', new EODHDAPI())
    this.providers.set('sec_edgar', new SECEdgarAPI())
    this.providers.set('treasury', new TreasuryAPI())
    this.providers.set('fred', new FREDAPI())
    this.providers.set('bls', new BLSAPI())
    this.providers.set('eia', new EIAAPI())
  }

  /**
   * Set preferred data source for a specific data type
   */
  setDataSourcePreference(dataType: DataType, primary: DataSourceProvider, fallbacks?: DataSourceProvider[]): void {
    if (!this.providerConfigs[primary]) {
      throw new Error(`Invalid data source provider: ${primary}`)
    }

    if (!this.providerConfigs[primary].supportedDataTypes.includes(dataType)) {
      throw new Error(`Provider ${primary} does not support data type ${dataType}`)
    }

    this.dataTypePreferences[dataType] = {
      primary,
      fallbacks: fallbacks || this.dataTypePreferences[dataType].fallbacks,
      lastUpdated: Date.now()
    }

    console.log(`📊 Set ${dataType} primary source to: ${primary}`)
  }

  /**
   * Get preferred providers for a data type in priority order
   */
  getProvidersForDataType(dataType: DataType): DataSourceProvider[] {
    const preferences = this.dataTypePreferences[dataType]
    if (!preferences) {
      throw new Error(`No preferences configured for data type: ${dataType}`)
    }

    return [preferences.primary, ...preferences.fallbacks].filter(provider =>
      this.providerConfigs[provider]?.enabled &&
      this.providerConfigs[provider]?.supportedDataTypes.includes(dataType)
    )
  }

  /**
   * Get stock price with automatic fallback
   */
  async getStockPrice(symbol: string): Promise<StockData | null> {
    const providers = this.getProvidersForDataType('stock_price')

    for (const providerName of providers) {
      const provider = this.providers.get(providerName)
      if (!provider) continue

      try {
        console.log(`📈 Trying ${providerName} for stock price of ${symbol}...`)
        const result = await provider.getStockPrice(symbol)
        if (result) {
          console.log(`✅ Got stock price from ${providerName}`)
          return result
        }
      } catch (error) {
        console.warn(`❌ ${providerName} failed for stock price:`, error instanceof Error ? error.message : error)
        continue
      }
    }

    console.warn(`⚠️ No stock price data available for ${symbol} from any configured source`)
    return null
  }

  /**
   * Get company info with automatic fallback
   */
  async getCompanyInfo(symbol: string): Promise<CompanyInfo | null> {
    const providers = this.getProvidersForDataType('company_info')

    for (const providerName of providers) {
      const provider = this.providers.get(providerName)
      if (!provider) continue

      try {
        console.log(`🏢 Trying ${providerName} for company info of ${symbol}...`)
        const result = await provider.getCompanyInfo(symbol)
        if (result) {
          console.log(`✅ Got company info from ${providerName}`)
          return result
        }
      } catch (error) {
        console.warn(`❌ ${providerName} failed for company info:`, error instanceof Error ? error.message : error)
        continue
      }
    }

    console.warn(`⚠️ No company info available for ${symbol} from any configured source`)
    return null
  }

  /**
   * Get current data source preferences
   */
  getDataSourcePreferences(): Record<DataType, DataTypePreferences> {
    return { ...this.dataTypePreferences }
  }

  /**
   * Get provider configurations
   */
  getProviderConfigs(): Record<DataSourceProvider, DataSourceConfig> {
    return { ...this.providerConfigs }
  }

  /**
   * Enable/disable a data source provider
   */
  setProviderEnabled(provider: DataSourceProvider, enabled: boolean): void {
    if (!this.providerConfigs[provider]) {
      throw new Error(`Invalid provider: ${provider}`)
    }

    this.providerConfigs[provider].enabled = enabled
    console.log(`${enabled ? '✅' : '❌'} ${provider} ${enabled ? 'enabled' : 'disabled'}`)
  }

  /**
   * Get status of all providers
   */
  async getProviderStatus(): Promise<Record<DataSourceProvider, { available: boolean; lastCheck: number }>> {
    const status: Record<DataSourceProvider, { available: boolean; lastCheck: number }> = {} as any

    for (const [providerName, provider] of this.providers) {
      try {
        // Quick health check - try to get a common stock price
        const result = await provider.getStockPrice('AAPL')
        status[providerName] = {
          available: result !== null,
          lastCheck: Date.now()
        }
      } catch (error) {
        status[providerName] = {
          available: false,
          lastCheck: Date.now()
        }
      }
    }

    return status
  }

  /**
   * Get comprehensive service status and recommendations
   */
  async getServiceStatus(): Promise<{
    dataTypePreferences: Record<DataType, DataTypePreferences>
    providerStatus: Record<DataSourceProvider, { available: boolean; lastCheck: number }>
    recommendations: string[]
    summary: {
      totalProviders: number
      availableProviders: number
      dataTypesConfigured: number
    }
  }> {
    const providerStatus = await this.getProviderStatus()
    const recommendations: string[] = []

    const availableCount = Object.values(providerStatus).filter(s => s.available).length
    const totalCount = Object.keys(providerStatus).length

    if (availableCount < totalCount / 2) {
      recommendations.push('⚠️ More than half of data providers are unavailable')
    }

    if (!providerStatus.polygon?.available) {
      recommendations.push('💡 Consider upgrading Polygon.io for better data quality and options support')
    }

    if (!providerStatus.alphavantage?.available) {
      recommendations.push('🔑 Check Alpha Vantage API key configuration')
    }

    return {
      dataTypePreferences: this.getDataSourcePreferences(),
      providerStatus,
      recommendations,
      summary: {
        totalProviders: totalCount,
        availableProviders: availableCount,
        dataTypesConfigured: Object.keys(this.dataTypePreferences).length
      }
    }
  }

  /**
   * Reset to default preferences
   */
  resetToDefaults(): void {
    this.dataTypePreferences = {
      stock_price: {
        primary: 'polygon',
        fallbacks: ['alphavantage', 'fmp', 'yahoo', 'twelvedata'],
        lastUpdated: Date.now()
      },
      company_info: {
        primary: 'polygon',
        fallbacks: ['alphavantage', 'fmp', 'sec_edgar', 'yahoo'],
        lastUpdated: Date.now()
      },
      options_data: {
        primary: 'polygon',
        fallbacks: ['twelvedata'],
        lastUpdated: Date.now()
      },
      options_chain: {
        primary: 'polygon',
        fallbacks: ['twelvedata'],
        lastUpdated: Date.now()
      },
      put_call_ratio: {
        primary: 'polygon',
        fallbacks: ['twelvedata'],
        lastUpdated: Date.now()
      },
      options_analysis: {
        primary: 'polygon',
        fallbacks: ['twelvedata'],
        lastUpdated: Date.now()
      },
      fundamentals: {
        primary: 'fmp',
        fallbacks: ['alphavantage', 'polygon', 'sec_edgar'],
        lastUpdated: Date.now()
      },
      market_data: {
        primary: 'polygon',
        fallbacks: ['alphavantage', 'fmp', 'twelvedata', 'yahoo'],
        lastUpdated: Date.now()
      },
      economic_data: {
        primary: 'fred',
        fallbacks: ['bls', 'eia', 'alphavantage'],
        lastUpdated: Date.now()
      },
      treasury_data: {
        primary: 'fred',
        fallbacks: ['treasury'],
        lastUpdated: Date.now()
      },
      earnings: {
        primary: 'fmp',
        fallbacks: ['sec_edgar', 'alphavantage'],
        lastUpdated: Date.now()
      },
      news: {
        primary: 'alphavantage',
        fallbacks: ['fmp'],
        lastUpdated: Date.now()
      }
    }

    console.log('🔄 Reset all data source preferences to defaults')
  }
}