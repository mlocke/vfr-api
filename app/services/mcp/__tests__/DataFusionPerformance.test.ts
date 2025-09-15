/**
 * Data Fusion and Performance Validation Test Suite
 * Tests comprehensive data fusion across all MCP sources with performance validation
 *
 * Test Coverage:
 * - Cross-server data consistency validation (>90% target)
 * - Multi-source fusion algorithm effectiveness
 * - Performance benchmarks for each data type
 * - Quality scoring and source selection optimization
 * - Conflict resolution strategy validation
 * - End-to-end analysis pipeline performance
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { MCPClient } from '../MCPClient'
import {
  FusionOptions,
  ConflictResolutionStrategy,
  QualityScore,
  UnifiedStockPrice,
  UnifiedCompanyInfo,
  UnifiedTechnicalIndicator,
  UnifiedNewsItem
} from '../types'
import { DataFusionEngine } from '../DataFusionEngine'
import { QualityScorer } from '../QualityScorer'

// Performance benchmarks for different data types
interface PerformanceBenchmarks {
  realtimeData: number // <500ms
  historicalData: number // <2000ms
  fundamentalData: number // <3000ms
  newsData: number // <1000ms
  technicalIndicators: number // <1500ms
}

interface DataConsistencyMetrics {
  priceVariance: number // Percentage variance across sources
  volumeVariance: number
  marketCapVariance: number
  consensusScore: number // 0-1 agreement across sources
}

describe('Data Fusion and Performance Validation Test Suite', () => {
  let mcpClient: MCPClient
  let fusionEngine: DataFusionEngine
  let qualityScorer: QualityScorer
  let performanceBenchmarks: PerformanceBenchmarks

  beforeEach(() => {
    // Reset singleton and create fresh instance
    (MCPClient as any).instance = undefined
    mcpClient = MCPClient.getInstance()
    fusionEngine = new DataFusionEngine()
    qualityScorer = new QualityScorer()

    // Define performance benchmarks
    performanceBenchmarks = {
      realtimeData: 500,     // 500ms for real-time data
      historicalData: 2000,  // 2s for historical data
      fundamentalData: 3000, // 3s for fundamental analysis
      newsData: 1000,        // 1s for news aggregation
      technicalIndicators: 1500 // 1.5s for technical analysis
    }

    mcpClient.stopHealthChecks()
  })

  afterEach(() => {
    mcpClient.stopHealthChecks()
    jest.clearAllMocks()
  })

  describe('Multi-Source Data Fusion Tests', () => {
    test('should_fuse_stock_price_data_from_all_commercial_sources', async () => {
      // Arrange: Multi-source stock price fusion
      const testSymbol = 'AAPL'
      const fusionOptions: FusionOptions = {
        sources: ['polygon', 'alphavantage', 'yahoo'],
        strategy: ConflictResolutionStrategy.HIGHEST_QUALITY,
        validateData: true,
        parallel: true,
        includeMetadata: true
      }

      const startTime = Date.now()

      // Act: Execute multi-source fusion for stock price
      const fusedResponse = await mcpClient.executeWithFusion('get_aggs', {
        ticker: testSymbol,
        multiplier: 1,
        timespan: 'day',
        from_: '2024-01-01',
        to: '2024-01-31'
      }, fusionOptions)

      const responseTime = Date.now() - startTime

      // Assert: Successful fusion with quality metadata
      expect(fusedResponse.success).toBe(true)
      expect(fusedResponse.fusion).toBeDefined()
      expect(fusedResponse.fusion!.sources.length).toBeGreaterThanOrEqual(2)
      expect(fusedResponse.fusion!.qualityScore.overall).toBeGreaterThan(0.6)
      expect(fusedResponse.fusion!.conflicts).toBeGreaterThanOrEqual(0)
      expect(responseTime).toBeLessThan(performanceBenchmarks.historicalData)
    })

    test('should_fuse_company_fundamentals_with_government_and_commercial_data', async () => {
      // Arrange: Government + commercial fusion for company data
      const testSymbol = 'MSFT'
      const fusionOptions: FusionOptions = {
        sources: ['sec_edgar', 'polygon', 'yahoo', 'alphavantage'],
        strategy: ConflictResolutionStrategy.CONSENSUS,
        validateData: true,
        requireConsensus: true,
        minQualityScore: 0.7
      }

      // Act: Execute comprehensive company data fusion
      const fusedResponse = await mcpClient.executeWithFusion('get_comprehensive_company_data', {
        symbol: testSymbol,
        include_sec_filings: true,
        include_market_data: true,
        include_fundamentals: true
      }, fusionOptions)

      // Assert: Government and commercial data successfully fused
      expect(fusedResponse.success).toBe(true)
      expect(fusedResponse.fusion!.sources).toContain('sec_edgar')
      expect(fusedResponse.fusion!.sources.length).toBeGreaterThanOrEqual(3)
      expect(fusedResponse.fusion!.qualityScore.overall).toBeGreaterThan(0.7)
    })

    test('should_fuse_economic_indicators_from_all_government_sources', async () => {
      // Arrange: All government sources for economic data
      const fusionOptions: FusionOptions = {
        sources: ['treasury', 'data_gov', 'sec_edgar'],
        strategy: ConflictResolutionStrategy.WEIGHTED_AVERAGE,
        validateData: true,
        parallel: true
      }

      // Act: Execute government economic data fusion
      const fusedResponse = await mcpClient.executeWithFusion('get_economic_analysis', {
        indicators: ['interest_rates', 'inflation_rate', 'employment_rate', 'gdp_growth'],
        date_range: { from: '2024-01-01', to: '2024-06-01' },
        frequency: 'monthly'
      }, fusionOptions)

      // Assert: All government sources contribute effectively
      expect(fusedResponse.success).toBe(true)
      expect(fusedResponse.fusion!.sources).toContain('treasury')
      expect(fusedResponse.fusion!.sources).toContain('data_gov')
      expect(fusedResponse.fusion!.resolutionStrategy).toBe(ConflictResolutionStrategy.WEIGHTED_AVERAGE)
    })

    test('should_handle_technical_indicator_fusion_with_quality_weighting', async () => {
      // Arrange: Technical indicator fusion from specialized sources
      const testSymbol = 'GOOGL'
      const fusionOptions: FusionOptions = {
        sources: ['alphavantage', 'polygon'],
        strategy: ConflictResolutionStrategy.HIGHEST_QUALITY,
        validateData: true
      }

      const startTime = Date.now()

      // Act: Execute technical indicator fusion
      const fusedResponse = await mcpClient.executeWithFusion('get_technical_analysis', {
        symbol: testSymbol,
        indicators: ['RSI', 'MACD', 'SMA_20', 'SMA_50', 'Bollinger_Bands'],
        period: 'daily',
        lookback_days: 100
      }, fusionOptions)

      const responseTime = Date.now() - startTime

      // Assert: Technical indicators fused with quality prioritization
      expect(fusedResponse.success).toBe(true)
      expect(fusedResponse.fusion!.qualityScore.overall).toBeGreaterThan(0.8)
      expect(responseTime).toBeLessThan(performanceBenchmarks.technicalIndicators)
    })
  })

  describe('Cross-Server Data Consistency Tests', () => {
    test('should_achieve_price_consistency_above_90_percent_across_sources', async () => {
      // Arrange: Price consistency validation across multiple sources
      const testSymbol = 'AAPL'
      const testDate = '2024-01-15'
      const consistencyThreshold = 0.90

      // Act: Get same day's price from multiple sources
      const [polygonResponse, yahooResponse, alphaResponse] = await Promise.allSettled([
        mcpClient.executeTool('get_daily_open_close_agg', {
          ticker: testSymbol,
          date: testDate
        }, { preferredServer: 'polygon' }),

        mcpClient.executeTool('get_historical_price', {
          symbol: testSymbol,
          date: testDate
        }, { preferredServer: 'yahoo' }),

        mcpClient.executeTool('get_daily_adjusted', {
          symbol: testSymbol,
          date: testDate
        }, { preferredServer: 'alphavantage' })
      ])

      // Extract prices and calculate consistency
      const prices = []
      if (polygonResponse.status === 'fulfilled' && (polygonResponse.value as any).success) {
        prices.push((polygonResponse.value as any).data.close)
      }
      if (yahooResponse.status === 'fulfilled' && (yahooResponse.value as any).success) {
        prices.push((yahooResponse.value as any).data.close)
      }
      if (alphaResponse.status === 'fulfilled' && (alphaResponse.value as any).success) {
        prices.push((alphaResponse.value as any).data.close)
      }

      // Calculate price variance
      if (prices.length >= 2) {
        const avgPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length
        const maxVariance = Math.max(...prices.map(price => Math.abs(price - avgPrice) / avgPrice))
        const consistency = 1 - maxVariance

        // Assert: Price consistency meets threshold
        expect(consistency).toBeGreaterThan(consistencyThreshold)
      }
    })

    test('should_validate_volume_consistency_across_commercial_sources', async () => {
      // Arrange: Volume data consistency test
      const testSymbol = 'TSLA'
      const testDate = '2024-01-15'

      // Act: Get volume data from multiple sources
      const volumeData = await Promise.allSettled([
        mcpClient.executeTool('get_aggs', {
          ticker: testSymbol,
          multiplier: 1,
          timespan: 'day',
          from_: testDate,
          to: testDate
        }, { preferredServer: 'polygon' }),

        mcpClient.executeTool('get_stock_info', {
          symbol: testSymbol,
          date: testDate
        }, { preferredServer: 'yahoo' })
      ])

      // Extract and validate volume consistency
      const volumes = []
      volumeData.forEach(result => {
        if (result.status === 'fulfilled' && (result.value as any).success) {
          const volume = (result.value as any).data.volume || (result.value as any).data.results?.[0]?.v
          if (volume) volumes.push(volume)
        }
      })

      if (volumes.length >= 2) {
        const avgVolume = volumes.reduce((sum, vol) => sum + vol, 0) / volumes.length
        const maxVariance = Math.max(...volumes.map(vol => Math.abs(vol - avgVolume) / avgVolume))

        // Assert: Volume variance within acceptable range (10%)
        expect(maxVariance).toBeLessThan(0.10)
      }
    })

    test('should_validate_market_cap_consistency_across_sources', async () => {
      // Arrange: Market cap consistency validation
      const testSymbol = 'AMZN'

      // Act: Get market cap from multiple sources
      const marketCapData = await Promise.allSettled([
        mcpClient.executeTool('get_ticker_details', {
          ticker: testSymbol
        }, { preferredServer: 'polygon' }),

        mcpClient.executeTool('get_company_profile', {
          symbol: testSymbol
        }, { preferredServer: 'alphavantage' }),

        mcpClient.executeTool('get_stock_info', {
          symbol: testSymbol
        }, { preferredServer: 'yahoo' })
      ])

      // Extract market cap values
      const marketCaps = []
      marketCapData.forEach(result => {
        if (result.status === 'fulfilled' && (result.value as any).success) {
          const marketCap = (result.value as any).data.market_cap ||
                          (result.value as any).data.results?.market_cap ||
                          (result.value as any).data.marketCap
          if (marketCap) marketCaps.push(marketCap)
        }
      })

      if (marketCaps.length >= 2) {
        const avgMarketCap = marketCaps.reduce((sum, cap) => sum + cap, 0) / marketCaps.length
        const maxVariance = Math.max(...marketCaps.map(cap => Math.abs(cap - avgMarketCap) / avgMarketCap))

        // Assert: Market cap variance within reasonable range (5%)
        expect(maxVariance).toBeLessThan(0.05)
      }
    })

    test('should_calculate_overall_consensus_score_above_90_percent', async () => {
      // Arrange: Overall consensus calculation across all data types
      const testSymbol = 'META'
      const dataPoints = []

      // Act: Collect consensus data from multiple sources and data types
      const responses = await Promise.allSettled([
        mcpClient.executeWithFusion('get_ticker_details', { ticker: testSymbol }, {
          sources: ['polygon', 'yahoo', 'alphavantage'],
          strategy: ConflictResolutionStrategy.CONSENSUS
        }),
        mcpClient.executeWithFusion('get_aggs', {
          ticker: testSymbol,
          multiplier: 1,
          timespan: 'day',
          from_: '2024-01-01',
          to: '2024-01-01'
        }, {
          sources: ['polygon', 'yahoo'],
          strategy: ConflictResolutionStrategy.CONSENSUS
        })
      ])

      // Calculate consensus scores
      responses.forEach(result => {
        if (result.status === 'fulfilled' && (result.value as any).success) {
          const fusion = (result.value as any).fusion
          if (fusion && fusion.validationResult) {
            dataPoints.push(fusion.validationResult.confidence)
          }
        }
      })

      if (dataPoints.length > 0) {
        const avgConsensus = dataPoints.reduce((sum, score) => sum + score, 0) / dataPoints.length

        // Assert: Overall consensus above 90%
        expect(avgConsensus).toBeGreaterThan(0.90)
      }
    })
  })

  describe('Performance Validation Tests', () => {
    test('should_meet_real_time_data_performance_under_500ms', async () => {
      // Arrange: Real-time data performance test
      const testSymbol = 'NVDA'
      const startTime = Date.now()

      // Act: Request real-time data
      const response = await mcpClient.executeTool('get_last_quote', {
        ticker: testSymbol
      }, {
        preferredServer: 'polygon',
        timeout: performanceBenchmarks.realtimeData
      })

      const responseTime = Date.now() - startTime

      // Assert: Real-time data under 500ms
      expect(response.success).toBe(true)
      expect(responseTime).toBeLessThan(performanceBenchmarks.realtimeData)
    })

    test('should_meet_historical_data_performance_under_2_seconds', async () => {
      // Arrange: Historical data performance test
      const testSymbol = 'IBM'
      const startTime = Date.now()

      // Act: Request historical data
      const response = await mcpClient.executeTool('get_aggs', {
        ticker: testSymbol,
        multiplier: 1,
        timespan: 'day',
        from_: '2023-01-01',
        to: '2023-12-31'
      }, {
        preferredServer: 'polygon',
        timeout: performanceBenchmarks.historicalData
      })

      const responseTime = Date.now() - startTime

      // Assert: Historical data under 2 seconds
      expect(response.success).toBe(true)
      expect(responseTime).toBeLessThan(performanceBenchmarks.historicalData)
    })

    test('should_meet_news_aggregation_performance_under_1_second', async () => {
      // Arrange: News aggregation performance test
      const keywords = 'AAPL earnings'
      const startTime = Date.now()

      // Act: Request news aggregation
      const response = await mcpClient.executeWithFusion('news_sentiment', {
        topics: keywords,
        max_results: 20,
        sources: ['firecrawl', 'dappier', 'yahoo']
      }, {
        sources: ['firecrawl', 'dappier', 'yahoo'],
        parallel: true,
        timeout: performanceBenchmarks.newsData
      })

      const responseTime = Date.now() - startTime

      // Assert: News aggregation under 1 second
      expect(response.success).toBe(true)
      expect(responseTime).toBeLessThan(performanceBenchmarks.newsData)
    })

    test('should_handle_concurrent_requests_efficiently', async () => {
      // Arrange: Concurrent request performance test
      const testSymbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA', 'NFLX']
      const startTime = Date.now()

      // Act: Execute concurrent requests
      const promises = testSymbols.map(symbol =>
        mcpClient.executeTool('get_ticker_details', {
          ticker: symbol
        }, {
          timeout: 5000,
          preferredServer: 'polygon'
        })
      )

      const responses = await Promise.all(promises)
      const totalTime = Date.now() - startTime

      // Assert: All concurrent requests successful and efficient
      expect(responses.every(r => r.success)).toBe(true)
      expect(totalTime).toBeLessThan(8000) // 8 seconds for 8 concurrent requests
      expect(totalTime / testSymbols.length).toBeLessThan(1000) // Average under 1s per request
    })

    test('should_optimize_data_fusion_performance_with_parallel_execution', async () => {
      // Arrange: Parallel vs sequential fusion performance comparison
      const testSymbol = 'AAPL'
      const fusionOptions: FusionOptions = {
        sources: ['polygon', 'alphavantage', 'yahoo'],
        strategy: ConflictResolutionStrategy.HIGHEST_QUALITY,
        validateData: true
      }

      // Act: Test parallel execution
      const parallelStartTime = Date.now()
      const parallelResponse = await mcpClient.executeWithFusion('get_ticker_details', {
        ticker: testSymbol
      }, { ...fusionOptions, parallel: true })
      const parallelTime = Date.now() - parallelStartTime

      // Test sequential execution
      const sequentialStartTime = Date.now()
      const sequentialResponse = await mcpClient.executeWithFusion('get_ticker_details', {
        ticker: testSymbol
      }, { ...fusionOptions, parallel: false })
      const sequentialTime = Date.now() - sequentialStartTime

      // Assert: Parallel execution significantly faster
      expect(parallelResponse.success).toBe(true)
      expect(sequentialResponse.success).toBe(true)
      expect(parallelTime).toBeLessThan(sequentialTime * 0.7) // At least 30% improvement
    })
  })

  describe('Quality Scoring and Source Selection Tests', () => {
    test('should_prioritize_government_sources_for_official_data', async () => {
      // Arrange: Official data request with government vs commercial sources
      const testSymbol = 'AAPL'
      const fusionOptions: FusionOptions = {
        sources: ['sec_edgar', 'polygon', 'yahoo'],
        strategy: ConflictResolutionStrategy.HIGHEST_QUALITY,
        validateData: true
      }

      // Act: Request official company data
      const response = await mcpClient.executeWithFusion('get_company_filings', {
        ticker: testSymbol,
        form_types: ['10-K', '10-Q']
      }, fusionOptions)

      // Assert: Government source selected as primary for official data
      expect(response.success).toBe(true)
      expect(response.fusion!.primarySource).toBe('sec_edgar')
      expect(response.fusion!.qualityScore.metrics.sourceReputation).toBeGreaterThan(0.9)
    })

    test('should_adapt_source_selection_based_on_historical_performance', async () => {
      // Arrange: Source selection adaptation test
      const testSymbol = 'MSFT'

      // Simulate multiple requests to build performance history
      for (let i = 0; i < 5; i++) {
        await mcpClient.executeTool('get_ticker_details', {
          ticker: testSymbol
        }, { preferredServer: 'polygon' })
      }

      // Act: Request with adaptive source selection
      const response = await mcpClient.executeWithFusion('get_ticker_details', {
        ticker: testSymbol
      }, {
        sources: ['polygon', 'alphavantage', 'yahoo'],
        strategy: ConflictResolutionStrategy.HIGHEST_QUALITY,
        validateData: true
      })

      // Assert: Source selection reflects performance history
      expect(response.success).toBe(true)
      expect(response.fusion!.qualityScore.overall).toBeGreaterThan(0.7)
    })

    test('should_handle_source_failures_gracefully_with_fallbacks', async () => {
      // Arrange: Source failure scenario
      const testSymbol = 'GOOGL'

      // Act: Request with potential source failures
      const response = await mcpClient.executeWithFusion('get_ticker_details', {
        ticker: testSymbol
      }, {
        sources: ['polygon', 'alphavantage', 'yahoo'],
        strategy: ConflictResolutionStrategy.HIGHEST_QUALITY,
        validateData: true,
        timeout: 10000
      })

      // Assert: Graceful handling of source failures
      expect(response.success).toBe(true)
      expect(response.fusion!.sources.length).toBeGreaterThanOrEqual(1) // At least one source succeeded
    })

    test('should_calculate_accurate_quality_scores_across_all_sources', async () => {
      // Arrange: Quality score calculation test across all sources
      const testSymbol = 'AMZN'
      const allSources = ['polygon', 'alphavantage', 'yahoo', 'sec_edgar', 'treasury', 'data_gov']

      // Act: Test quality scoring for each source
      const qualityTests = await Promise.allSettled(
        allSources.map(source =>
          mcpClient.executeTool('health_check', {}, {
            preferredServer: source,
            timeout: 5000
          })
        )
      )

      const qualityScores = qualityTests.map((result, index) => {
        if (result.status === 'fulfilled' && (result.value as any).success) {
          return qualityScorer.calculateQualityScore(
            allSources[index],
            (result.value as any).data,
            (result.value as any).timestamp,
            Date.now() - (result.value as any).timestamp
          )
        }
        return null
      }).filter(score => score !== null)

      // Assert: Quality scores calculated for available sources
      expect(qualityScores.length).toBeGreaterThan(0)
      qualityScores.forEach(score => {
        expect(score!.overall).toBeGreaterThanOrEqual(0)
        expect(score!.overall).toBeLessThanOrEqual(1)
        expect(score!.metrics.freshness).toBeGreaterThanOrEqual(0)
        expect(score!.metrics.completeness).toBeGreaterThanOrEqual(0)
        expect(score!.metrics.accuracy).toBeGreaterThanOrEqual(0)
        expect(score!.metrics.sourceReputation).toBeGreaterThanOrEqual(0)
      })
    })
  })

  describe('End-to-End Analysis Pipeline Tests', () => {
    test('should_execute_complete_stock_analysis_within_performance_targets', async () => {
      // Arrange: Complete stock analysis pipeline
      const testSymbol = 'AAPL'
      const startTime = Date.now()

      // Act: Execute comprehensive analysis
      const analysisResult = await mcpClient.getUnifiedSymbolData(testSymbol, {
        includePrice: true,
        includeCompany: true,
        includeTechnicals: ['RSI', 'MACD', 'SMA_20'],
        includeNews: true,
        fusionOptions: {
          sources: ['polygon', 'alphavantage', 'yahoo', 'sec_edgar'],
          strategy: ConflictResolutionStrategy.HIGHEST_QUALITY,
          validateData: true,
          parallel: true
        }
      })

      const totalTime = Date.now() - startTime

      // Assert: Complete analysis within performance targets
      expect(analysisResult.price).toBeDefined()
      expect(analysisResult.company).toBeDefined()
      expect(analysisResult.technicals).toBeDefined()
      expect(analysisResult.news).toBeDefined()
      expect(analysisResult.errors).toBeUndefined()
      expect(totalTime).toBeLessThan(10000) // Complete analysis under 10 seconds
    })

    test('should_demonstrate_effective_government_commercial_integration', async () => {
      // Arrange: Government + commercial integration test
      const testSymbol = 'MSFT'

      // Act: Execute integrated analysis
      const integratedAnalysis = await mcpClient.executeIntegratedAnalysis(testSymbol, {
        government_sources: ['sec_edgar', 'treasury', 'data_gov'],
        commercial_sources: ['polygon', 'alphavantage', 'yahoo'],
        analysis_types: ['fundamental', 'technical', 'economic', 'regulatory'],
        fusion_strategy: ConflictResolutionStrategy.CONSENSUS
      })

      // Assert: Effective integration of all source types
      expect(integratedAnalysis.success).toBe(true)
      expect(integratedAnalysis.government_data).toBeDefined()
      expect(integratedAnalysis.commercial_data).toBeDefined()
      expect(integratedAnalysis.fusion_metadata.sources.length).toBeGreaterThanOrEqual(4)
      expect(integratedAnalysis.fusion_metadata.consensus_score).toBeGreaterThan(0.85)
    })

    test('should_maintain_data_lineage_and_audit_trail', async () => {
      // Arrange: Data lineage tracking test
      const testSymbol = 'GOOGL'

      // Act: Execute analysis with lineage tracking
      const response = await mcpClient.executeWithFusion('get_comprehensive_analysis', {
        symbol: testSymbol,
        include_lineage: true
      }, {
        sources: ['polygon', 'sec_edgar', 'treasury'],
        strategy: ConflictResolutionStrategy.HIGHEST_QUALITY,
        includeMetadata: true
      })

      // Assert: Complete data lineage maintained
      expect(response.success).toBe(true)
      expect(response.fusion!.sources).toBeDefined()
      expect(response.fusion!.fusionTimestamp).toBeDefined()
      expect(response.fusion!.qualityScore).toBeDefined()
      expect(response.fusion!.validationResult).toBeDefined()
    })
  })
})

// Extend MCPClient with integration analysis support
declare module '../MCPClient' {
  interface MCPClient {
    executeIntegratedAnalysis(symbol: string, options: {
      government_sources: string[]
      commercial_sources: string[]
      analysis_types: string[]
      fusion_strategy: ConflictResolutionStrategy
    }): Promise<any>
  }
}