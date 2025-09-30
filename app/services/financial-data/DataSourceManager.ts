/**
 * Centralized Data Source Manager
 * Provides complete control over which APIs are used for every data type
 * Supports easy switching between data sources for all financial data
 */

import { FinancialModelingPrepAPI } from './FinancialModelingPrepAPI'
import { EODHDAPI } from './EODHDAPI'
import { StockData, CompanyInfo, FinancialDataProvider, OptionsContract, OptionsChain, PutCallRatio, OptionsAnalysis } from './types'

export type DataSourceProvider =
  | 'fmp'
  | 'eodhd'

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
    fmp: {
      enabled: true,
      priority: 1,
      costTier: 'paid',
      reliability: 0.95,
      dataQuality: 0.95,
      rateLimit: '300 req/min',
      description: 'Financial Modeling Prep - Primary data source for financial statements, ratios, and market data',
      supportedDataTypes: ['stock_price', 'company_info', 'fundamentals', 'earnings', 'market_data', 'news']
    },
    eodhd: {
      enabled: true,
      priority: 2,
      costTier: 'paid',
      reliability: 0.92,
      dataQuality: 0.94,
      rateLimit: '100 req/min',
      description: 'EODHD - Fallback data source with EOD pricing and options data',
      supportedDataTypes: ['stock_price', 'company_info', 'market_data', 'options_data', 'options_chain', 'put_call_ratio', 'options_analysis', 'fundamentals']
    }
  }

  private dataTypePreferences: Record<DataType, DataTypePreferences> = {
    stock_price: {
      primary: 'fmp',
      fallbacks: ['eodhd'],
      lastUpdated: Date.now()
    },
    company_info: {
      primary: 'fmp',
      fallbacks: ['eodhd'],
      lastUpdated: Date.now()
    },
    options_data: {
      primary: 'eodhd',
      fallbacks: ['fmp'],
      lastUpdated: Date.now()
    },
    options_chain: {
      primary: 'eodhd',
      fallbacks: ['fmp'],
      lastUpdated: Date.now()
    },
    put_call_ratio: {
      primary: 'eodhd',
      fallbacks: ['fmp'],
      lastUpdated: Date.now()
    },
    options_analysis: {
      primary: 'eodhd',
      fallbacks: ['fmp'],
      lastUpdated: Date.now()
    },
    fundamentals: {
      primary: 'fmp',
      fallbacks: ['eodhd'],
      lastUpdated: Date.now()
    },
    market_data: {
      primary: 'fmp',
      fallbacks: ['eodhd'],
      lastUpdated: Date.now()
    },
    economic_data: {
      primary: 'fmp',
      fallbacks: ['eodhd'],
      lastUpdated: Date.now()
    },
    treasury_data: {
      primary: 'fmp',
      fallbacks: ['eodhd'],
      lastUpdated: Date.now()
    },
    earnings: {
      primary: 'fmp',
      fallbacks: ['eodhd'],
      lastUpdated: Date.now()
    },
    news: {
      primary: 'fmp',
      fallbacks: [],
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
    this.providers.set('fmp', new FinancialModelingPrepAPI())
    this.providers.set('eodhd', new EODHDAPI(undefined, 30000))  // 30 second timeout for options chains
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

    if (!providerStatus.fmp?.available) {
      recommendations.push('⚠️ FMP (primary data source) is unavailable - check API key and connectivity')
    }

    if (!providerStatus.eodhd?.available) {
      recommendations.push('⚠️ EODHD (fallback data source) is unavailable - options data may be limited')
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
        primary: 'fmp',
        fallbacks: ['eodhd'],
        lastUpdated: Date.now()
      },
      company_info: {
        primary: 'fmp',
        fallbacks: ['eodhd'],
        lastUpdated: Date.now()
      },
      options_data: {
        primary: 'eodhd',
        fallbacks: ['fmp'],
        lastUpdated: Date.now()
      },
      options_chain: {
        primary: 'eodhd',
        fallbacks: ['fmp'],
        lastUpdated: Date.now()
      },
      put_call_ratio: {
        primary: 'eodhd',
        fallbacks: ['fmp'],
        lastUpdated: Date.now()
      },
      options_analysis: {
        primary: 'eodhd',
        fallbacks: ['fmp'],
        lastUpdated: Date.now()
      },
      fundamentals: {
        primary: 'fmp',
        fallbacks: ['eodhd'],
        lastUpdated: Date.now()
      },
      market_data: {
        primary: 'fmp',
        fallbacks: ['eodhd'],
        lastUpdated: Date.now()
      },
      economic_data: {
        primary: 'fmp',
        fallbacks: ['eodhd'],
        lastUpdated: Date.now()
      },
      treasury_data: {
        primary: 'fmp',
        fallbacks: ['eodhd'],
        lastUpdated: Date.now()
      },
      earnings: {
        primary: 'fmp',
        fallbacks: ['eodhd'],
        lastUpdated: Date.now()
      },
      news: {
        primary: 'fmp',
        fallbacks: [],
        lastUpdated: Date.now()
      }
    }

    console.log('🔄 Reset all data source preferences to defaults (FMP primary, EODHD fallback)')
  }
}