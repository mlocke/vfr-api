/**
 * Options Data Service - Centralized options data management with fallback strategy
 * Now integrated with DataSourceManager for consistent API switching
 */

import { DataSourceManager, DataSourceProvider } from './DataSourceManager'
import { PolygonAPI } from './PolygonAPI'
import { TwelveDataAPI } from './TwelveDataAPI'
import { AlphaVantageAPI } from './AlphaVantageAPI'
import { YahooFinanceAPI } from './YahooFinanceAPI'
import { EODHDAPI } from './EODHDAPI'
import { OptionsContract, OptionsChain, PutCallRatio, OptionsAnalysis } from './types'

export class OptionsDataService {
  private dataSourceManager: DataSourceManager
  private polygonAPI: PolygonAPI
  private twelveDataAPI: TwelveDataAPI
  private alphaVantageAPI: AlphaVantageAPI
  private yahooFinanceAPI: YahooFinanceAPI
  private eodhdAPI: EODHDAPI

  constructor(dataSourceManager?: DataSourceManager) {
    this.dataSourceManager = dataSourceManager || new DataSourceManager()
    this.polygonAPI = new PolygonAPI()
    this.twelveDataAPI = new TwelveDataAPI()
    this.alphaVantageAPI = new AlphaVantageAPI()
    this.yahooFinanceAPI = new YahooFinanceAPI()
    this.eodhdAPI = new EODHDAPI()
  }

  /**
   * Set preferred options data source
   */
  setPreferredSource(source: DataSourceProvider): void {
    this.dataSourceManager.setDataSourcePreference('options_data', source)
    this.dataSourceManager.setDataSourcePreference('options_chain', source)
    this.dataSourceManager.setDataSourcePreference('put_call_ratio', source)
    this.dataSourceManager.setDataSourcePreference('options_analysis', source)
    console.log(`📊 Options data source set to: ${source}`)
  }

  /**
   * Get current provider configuration
   */
  getProviderConfig() {
    return this.dataSourceManager.getProviderConfigs()
  }

  /**
   * Get available providers for options data
   */
  getAvailableProviders(): DataSourceProvider[] {
    return this.dataSourceManager.getProvidersForDataType('options_data')
  }

  /**
   * Get put/call ratio with automatic fallback
   */
  async getPutCallRatio(symbol: string): Promise<PutCallRatio | null> {
    const sources = this.dataSourceManager.getProvidersForDataType('put_call_ratio')

    for (const source of sources) {
      try {
        console.log(`📊 Trying ${source} for put/call ratio...`)

        switch (source) {
          case 'polygon':
            const polygonRatio = await this.polygonAPI.getPutCallRatio(symbol)
            if (polygonRatio) return polygonRatio
            break

          case 'eodhd':
            const eodhdRatio = await this.eodhdAPI.getPutCallRatio(symbol)
            if (eodhdRatio) return eodhdRatio
            break

          case 'twelvedata':
            const twelveDataRatio = await this.getTwelveDataPutCallRatio(symbol)
            if (twelveDataRatio) return twelveDataRatio
            break

          case 'alphavantage':
            const alphaVantageRatio = await this.alphaVantageAPI.getPutCallRatio(symbol)
            if (alphaVantageRatio) return alphaVantageRatio
            break

          case 'yahoo':
            const yahooRatio = await this.yahooFinanceAPI.getPutCallRatio(symbol)
            if (yahooRatio) return yahooRatio
            break

          default:
            continue
        }
      } catch (error) {
        console.warn(`❌ ${source} failed for put/call ratio:`, error instanceof Error ? error.message : error)
        continue
      }
    }

    console.warn(`⚠️ No put/call ratio data available for ${symbol} from any source`)
    return null
  }

  /**
   * Get options analysis with automatic fallback
   */
  async getOptionsAnalysis(symbol: string): Promise<OptionsAnalysis | null> {
    const sources = this.dataSourceManager.getProvidersForDataType('options_analysis')

    for (const source of sources) {
      try {
        console.log(`📈 Trying ${source} for options analysis...`)

        switch (source) {
          case 'polygon':
            const polygonAnalysis = await this.polygonAPI.getOptionsAnalysis(symbol)
            if (polygonAnalysis) return polygonAnalysis
            break

          case 'eodhd':
            const eodhdAnalysis = await this.eodhdAPI.getOptionsAnalysisFreeTier(symbol)
            if (eodhdAnalysis) return eodhdAnalysis
            break

          case 'twelvedata':
            // TwelveData options analysis (ready for paid plan)
            const twelveDataAnalysis = await this.getTwelveDataOptionsAnalysis(symbol)
            if (twelveDataAnalysis) return twelveDataAnalysis
            break

          case 'alphavantage':
            const alphaVantageAnalysis = await this.alphaVantageAPI.getOptionsAnalysisFreeTier(symbol)
            if (alphaVantageAnalysis) return alphaVantageAnalysis
            break

          case 'yahoo':
            const yahooAnalysis = await this.yahooFinanceAPI.getOptionsAnalysisFreeTier(symbol)
            if (yahooAnalysis) return yahooAnalysis
            break

          default:
            continue
        }
      } catch (error) {
        console.warn(`❌ ${source} failed for options analysis:`, error instanceof Error ? error.message : error)
        continue
      }
    }

    console.warn(`⚠️ No options analysis available for ${symbol} from any source`)
    return null
  }

  /**
   * Get options chain with automatic fallback
   */
  async getOptionsChain(symbol: string, expiration?: string): Promise<OptionsChain | null> {
    const sources = this.dataSourceManager.getProvidersForDataType('options_chain')

    for (const source of sources) {
      try {
        console.log(`🔗 Trying ${source} for options chain...`)

        switch (source) {
          case 'polygon':
            const polygonChain = await this.polygonAPI.getOptionsChain(symbol, expiration)
            if (polygonChain) return polygonChain
            break

          case 'eodhd':
            const eodhdChain = await this.eodhdAPI.getOptionsChain(symbol, expiration)
            if (eodhdChain) return eodhdChain
            break

          case 'twelvedata':
            // TwelveData options chain (ready for paid plan)
            const twelveDataChain = await this.getTwelveDataOptionsChain(symbol, expiration)
            if (twelveDataChain) return twelveDataChain
            break

          case 'alphavantage':
            const alphaVantageChain = await this.alphaVantageAPI.getOptionsChain(symbol, expiration)
            if (alphaVantageChain) return alphaVantageChain
            break

          case 'yahoo':
            const yahooChain = await this.yahooFinanceAPI.getOptionsChain(symbol, expiration)
            if (yahooChain) return yahooChain
            break

          default:
            continue
        }
      } catch (error) {
        console.warn(`❌ ${source} failed for options chain:`, error instanceof Error ? error.message : error)
        continue
      }
    }

    console.warn(`⚠️ No options chain available for ${symbol} from any source`)
    return null
  }

  /**
   * TwelveData put/call ratio (ready for paid plan implementation)
   */
  private async getTwelveDataPutCallRatio(symbol: string): Promise<PutCallRatio | null> {
    // This method is ready for implementation when TwelveData pro plan is available
    // For now, return null to trigger fallback
    console.log(`📊 TwelveData put/call ratio requires pro plan for ${symbol}`)
    return null
  }

  /**
   * TwelveData options analysis (ready for paid plan implementation)
   */
  private async getTwelveDataOptionsAnalysis(symbol: string): Promise<OptionsAnalysis | null> {
    // This method is ready for implementation when TwelveData pro plan is available
    // For now, return null to trigger fallback
    console.log(`📈 TwelveData options analysis requires pro plan for ${symbol}`)
    return null
  }

  /**
   * TwelveData options chain (ready for paid plan implementation)
   */
  private async getTwelveDataOptionsChain(symbol: string, expiration?: string): Promise<OptionsChain | null> {
    // This method is ready for implementation when TwelveData pro plan is available
    // For now, return null to trigger fallback
    console.log(`🔗 TwelveData options chain requires pro plan for ${symbol}`)
    return null
  }

  /**
   * Check if any options data source is available
   */
  async checkOptionsAvailability(): Promise<{ [key: string]: boolean }> {
    const availability: { [key: string]: boolean } = {
      polygon: false,
      eodhd: false,
      twelvedata: false,
      alphavantage: false,
      yahoo: false,
      disabled: false
    }

    // Test Polygon
    try {
      const polygonTest = await this.polygonAPI.getPutCallRatio('SPY')
      availability.polygon = polygonTest !== null
    } catch (error) {
      availability.polygon = false
    }

    // Test EODHD (requires options add-on subscription)
    try {
      const eodhdAvailability = await this.eodhdAPI.checkOptionsAvailability()
      availability.eodhd = (typeof eodhdAvailability.putCallRatio === 'boolean') ? eodhdAvailability.putCallRatio : false
    } catch (error) {
      availability.eodhd = false
    }

    // Test TwelveData (will be false until paid plan)
    availability.twelvedata = false

    // Test Alpha Vantage (will be false - premium required)
    try {
      const alphaVantageAvailability = await this.alphaVantageAPI.checkOptionsAvailability()
      availability.alphavantage = (typeof alphaVantageAvailability.putCallRatio === 'boolean') ? alphaVantageAvailability.putCallRatio : false
    } catch (error) {
      availability.alphavantage = false
    }

    // Test Yahoo Finance (unofficial API - may work)
    try {
      const yahooAvailability = await this.yahooFinanceAPI.checkOptionsAvailability()
      availability.yahoo = (typeof yahooAvailability.putCallRatio === 'boolean') ? yahooAvailability.putCallRatio : false
    } catch (error) {
      availability.yahoo = false
    }

    return availability
  }

  /**
   * Get service status and recommendations
   */
  async getServiceStatus() {
    return await this.dataSourceManager.getServiceStatus()
  }
}