/**
 * Options Data Service - Centralized options data management with fallback strategy
 * Now integrated with DataSourceManager for consistent API switching
 */

import { DataSourceManager, DataSourceProvider } from './DataSourceManager'
import { PolygonAPI } from './PolygonAPI'
import { TwelveDataAPI } from './TwelveDataAPI'
import { OptionsContract, OptionsChain, PutCallRatio, OptionsAnalysis } from './types'

export class OptionsDataService {
  private dataSourceManager: DataSourceManager
  private polygonAPI: PolygonAPI
  private twelveDataAPI: TwelveDataAPI

  constructor(dataSourceManager?: DataSourceManager) {
    this.dataSourceManager = dataSourceManager || new DataSourceManager()
    this.polygonAPI = new PolygonAPI()
    this.twelveDataAPI = new TwelveDataAPI()
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

          case 'twelvedata':
            const twelveDataRatio = await this.getTwelveDataPutCallRatio(symbol)
            if (twelveDataRatio) return twelveDataRatio
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
    const sources = [this.preferredSource, ...this.getAvailableProviders()]

    for (const source of sources) {
      if (!this.providers[source].enabled) continue

      try {
        console.log(`📈 Trying ${source} for options analysis...`)

        switch (source) {
          case 'polygon':
            const polygonAnalysis = await this.polygonAPI.getOptionsAnalysis(symbol)
            if (polygonAnalysis) return polygonAnalysis
            break

          case 'twelvedata':
            // TwelveData options analysis (ready for paid plan)
            const twelveDataAnalysis = await this.getTwelveDataOptionsAnalysis(symbol)
            if (twelveDataAnalysis) return twelveDataAnalysis
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
    const sources = [this.preferredSource, ...this.getAvailableProviders()]

    for (const source of sources) {
      if (!this.providers[source].enabled) continue

      try {
        console.log(`🔗 Trying ${source} for options chain...`)

        switch (source) {
          case 'polygon':
            const polygonChain = await this.polygonAPI.getOptionsChain(symbol, expiration)
            if (polygonChain) return polygonChain
            break

          case 'twelvedata':
            // TwelveData options chain (ready for paid plan)
            const twelveDataChain = await this.getTwelveDataOptionsChain(symbol, expiration)
            if (twelveDataChain) return twelveDataChain
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
  async checkOptionsAvailability(): Promise<{ [key in OptionsDataSource]: boolean }> {
    const availability: { [key in OptionsDataSource]: boolean } = {
      polygon: false,
      twelvedata: false,
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

    // Test TwelveData (will be false until paid plan)
    availability.twelvedata = false

    // Yahoo disabled for now
    availability.yahoo = false

    return availability
  }

  /**
   * Get service status and recommendations
   */
  async getServiceStatus() {
    return await this.dataSourceManager.getServiceStatus()
  }
}