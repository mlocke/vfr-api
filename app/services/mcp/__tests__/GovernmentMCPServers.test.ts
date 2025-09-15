/**
 * Government MCP Servers Test Suite
 * Tests specific government data source integrations: SEC EDGAR, Treasury, Data.gov
 *
 * Test Coverage:
 * - SEC EDGAR: Company filings, insider trading, corporate actions
 * - Treasury: Yield curves, debt data, economic indicators
 * - Data.gov: Economic data, employment statistics, inflation metrics
 * - Government API rate limiting and compliance
 * - Data quality validation for official sources
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { MCPClient } from '../MCPClient'
import { FusedMCPResponse } from '../types'

// Government MCP Server configurations
interface GovernmentServerConfig {
  name: string
  endpoint: string
  apiKey?: string
  rateLimit: number
  timeout: number
  retryAttempts: number
  dataTypes: string[]
  compliance: {
    rateLimitPerSecond: number
    requiresUserAgent: boolean
    termsOfService: string
  }
}

describe('Government MCP Servers Test Suite', () => {
  let mcpClient: MCPClient

  beforeEach(() => {
    // Reset singleton and create fresh instance
    (MCPClient as any).instance = undefined
    mcpClient = MCPClient.getInstance()
    mcpClient.stopHealthChecks()

    // Add government server configurations
    mcpClient.addGovernmentServers()
  })

  afterEach(() => {
    mcpClient.stopHealthChecks()
    jest.clearAllMocks()
  })

  describe('SEC EDGAR MCP Server Tests', () => {
    test('should_configure_sec_edgar_with_proper_rate_limiting', () => {
      // Arrange: SEC EDGAR rate limiting requirements (10 requests/second)
      const expectedConfig: Partial<GovernmentServerConfig> = {
        name: 'SEC EDGAR MCP',
        endpoint: 'https://data.sec.gov/api/xbrl',
        rateLimit: 600, // 10 requests/second = 600/minute
        compliance: {
          rateLimitPerSecond: 10,
          requiresUserAgent: true,
          termsOfService: 'https://www.sec.gov/developer'
        }
      }

      // Act: Get SEC EDGAR configuration
      const secConfig = mcpClient.getServerConfig('sec_edgar')

      // Assert: SEC EDGAR properly configured with compliance requirements
      expect(secConfig).toBeDefined()
      expect(secConfig.name).toBe(expectedConfig.name)
      expect(secConfig.rateLimit).toBeLessThanOrEqual(600)
      expect(secConfig.compliance.requiresUserAgent).toBe(true)
    })

    test('should_fetch_company_10k_filings_from_sec_edgar', async () => {
      // Arrange: Request 10-K filings for Apple Inc.
      const testCIK = '0000320193' // Apple's CIK
      const expectedFilingStructure = {
        success: true,
        data: expect.objectContaining({
          filings: expect.arrayContaining([
            expect.objectContaining({
              accessionNumber: expect.any(String),
              filingDate: expect.any(String),
              reportDate: expect.any(String),
              formType: '10-K',
              size: expect.any(Number),
              filingUrl: expect.stringMatching(/^https:\/\/www\.sec\.gov/)
            })
          ])
        }),
        source: 'sec_edgar'
      }

      // Act: Fetch 10-K filings from SEC EDGAR
      const response = await mcpClient.executeTool('get_company_filings', {
        cik: testCIK,
        form_types: ['10-K'],
        date_from: '2023-01-01',
        date_to: '2024-01-01',
        limit: 5
      }, {
        preferredServer: 'sec_edgar',
        timeout: 15000 // Government APIs can be slower
      })

      // Assert: SEC EDGAR provides official company filings
      expect(response).toMatchObject(expectedFilingStructure)
      expect(response.data.filings.length).toBeGreaterThan(0)
      expect(response.data.filings[0].formType).toBe('10-K')
    })

    test('should_fetch_insider_trading_data_from_sec_edgar', async () => {
      // Arrange: Request insider trading data
      const testCIK = '0001018724' // Amazon's CIK
      const expectedInsiderStructure = {
        success: true,
        data: expect.objectContaining({
          insider_transactions: expect.arrayContaining([
            expect.objectContaining({
              filingDate: expect.any(String),
              transactionDate: expect.any(String),
              ownerName: expect.any(String),
              transactionType: expect.any(String),
              sharesTraded: expect.any(Number),
              pricePerShare: expect.any(Number),
              totalValue: expect.any(Number)
            })
          ])
        }),
        source: 'sec_edgar'
      }

      // Act: Fetch insider trading data
      const response = await mcpClient.executeTool('get_insider_transactions', {
        cik: testCIK,
        date_from: '2024-01-01',
        transaction_types: ['P', 'S'], // Purchase, Sale
        limit: 20
      }, { preferredServer: 'sec_edgar' })

      // Assert: SEC EDGAR provides insider trading data
      expect(response).toMatchObject(expectedInsiderStructure)
      expect(response.data.insider_transactions.length).toBeGreaterThan(0)
    })

    test('should_fetch_company_facts_with_xbrl_data', async () => {
      // Arrange: Request company facts (XBRL standardized data)
      const testCIK = '0000789019' // Microsoft's CIK

      // Act: Fetch company facts from SEC EDGAR
      const response = await mcpClient.executeTool('get_company_facts', {
        cik: testCIK,
        facts: ['Assets', 'Revenues', 'NetIncomeLoss', 'SharesOutstanding'],
        fiscal_years: [2023, 2024]
      }, { preferredServer: 'sec_edgar' })

      // Assert: SEC EDGAR provides standardized XBRL financial data
      expect(response.success).toBe(true)
      expect(response.source).toBe('sec_edgar')
      expect(response.data).toHaveProperty('company_facts')
      expect(response.data.company_facts).toHaveProperty('Assets')
      expect(response.data.company_facts).toHaveProperty('Revenues')
    })

    test('should_handle_sec_rate_limiting_gracefully', async () => {
      // Arrange: Multiple rapid requests to test rate limiting
      const testCIK = '0000320193'
      const rapidRequests = Array.from({ length: 15 }, (_, i) =>
        mcpClient.executeTool('get_company_filings', {
          cik: testCIK,
          form_types: ['10-Q'],
          limit: 1
        }, {
          preferredServer: 'sec_edgar',
          timeout: 20000
        })
      )

      // Act: Execute rapid requests
      const responses = await Promise.allSettled(rapidRequests)

      // Assert: Rate limiting handled without failures
      const successfulResponses = responses.filter(r =>
        r.status === 'fulfilled' && (r.value as any).success
      )
      const rateLimitedResponses = responses.filter(r =>
        r.status === 'rejected' ||
        (r.status === 'fulfilled' && (r.value as any).error?.includes('rate limit'))
      )

      expect(successfulResponses.length).toBeGreaterThan(10) // Most requests successful
      expect(rateLimitedResponses.length).toBeLessThan(5) // Rate limiting graceful
    })
  })

  describe('US Treasury MCP Server Tests', () => {
    test('should_configure_treasury_server_for_economic_data', () => {
      // Arrange: Treasury Department API configuration
      const expectedConfig: Partial<GovernmentServerConfig> = {
        name: 'US Treasury MCP',
        endpoint: 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service',
        rateLimit: 1000, // Treasury is more generous with rate limits
        dataTypes: ['yield_curves', 'debt_data', 'exchange_rates', 'interest_rates']
      }

      // Act: Get Treasury configuration
      const treasuryConfig = mcpClient.getServerConfig('treasury')

      // Assert: Treasury server properly configured
      expect(treasuryConfig).toBeDefined()
      expect(treasuryConfig.name).toBe(expectedConfig.name)
      expect(treasuryConfig.dataTypes).toEqual(expect.arrayContaining(expectedConfig.dataTypes))
    })

    test('should_fetch_treasury_yield_curves', async () => {
      // Arrange: Request Treasury yield curve data
      const testDate = '2024-01-15'
      const expectedYieldStructure = {
        success: true,
        data: expect.objectContaining({
          yield_curve: expect.objectContaining({
            date: testDate,
            rates: expect.objectContaining({
              '1_month': expect.any(Number),
              '3_month': expect.any(Number),
              '6_month': expect.any(Number),
              '1_year': expect.any(Number),
              '2_year': expect.any(Number),
              '5_year': expect.any(Number),
              '10_year': expect.any(Number),
              '30_year': expect.any(Number)
            })
          })
        }),
        source: 'treasury'
      }

      // Act: Fetch yield curve data
      const response = await mcpClient.executeTool('get_daily_treasury_rates', {
        date: testDate,
        rate_types: ['1_month', '3_month', '6_month', '1_year', '2_year', '5_year', '10_year', '30_year']
      }, { preferredServer: 'treasury' })

      // Assert: Treasury provides official yield curve data
      expect(response).toMatchObject(expectedYieldStructure)
    })

    test('should_fetch_government_debt_data', async () => {
      // Arrange: Request federal debt data
      const fiscalYear = 2024

      // Act: Fetch debt data from Treasury
      const response = await mcpClient.executeTool('get_federal_debt', {
        fiscal_year: fiscalYear,
        data_types: ['total_debt', 'debt_held_by_public', 'intragovernmental_holdings'],
        frequency: 'monthly'
      }, { preferredServer: 'treasury' })

      // Assert: Treasury provides official debt statistics
      expect(response.success).toBe(true)
      expect(response.source).toBe('treasury')
      expect(response.data).toHaveProperty('debt_data')
      expect(response.data.debt_data).toHaveProperty('total_debt')
    })

    test('should_fetch_exchange_rate_data', async () => {
      // Arrange: Request exchange rate data
      const currencies = ['EUR', 'GBP', 'JPY', 'CAD']

      // Act: Fetch exchange rates from Treasury
      const response = await mcpClient.executeTool('get_exchange_rates', {
        base_currency: 'USD',
        target_currencies: currencies,
        date_from: '2024-01-01',
        date_to: '2024-01-31',
        frequency: 'daily'
      }, { preferredServer: 'treasury' })

      // Assert: Treasury provides official exchange rates
      expect(response.success).toBe(true)
      expect(response.data).toHaveProperty('exchange_rates')
      expect(Object.keys(response.data.exchange_rates)).toEqual(
        expect.arrayContaining(currencies)
      )
    })
  })

  describe('Data.gov MCP Server Tests', () => {
    test('should_configure_data_gov_for_economic_indicators', () => {
      // Arrange: Data.gov server configuration
      const expectedConfig: Partial<GovernmentServerConfig> = {
        name: 'Data.gov Economic MCP',
        endpoint: 'https://api.data.gov',
        dataTypes: ['economic_indicators', 'employment_data', 'inflation_data', 'gdp_data']
      }

      // Act: Get Data.gov configuration
      const dataGovConfig = mcpClient.getServerConfig('data_gov')

      // Assert: Data.gov server properly configured
      expect(dataGovConfig).toBeDefined()
      expect(dataGovConfig.name).toBe(expectedConfig.name)
      expect(dataGovConfig.dataTypes).toEqual(expect.arrayContaining(expectedConfig.dataTypes))
    })

    test('should_fetch_employment_statistics', async () => {
      // Arrange: Request employment data from Bureau of Labor Statistics
      const expectedEmploymentStructure = {
        success: true,
        data: expect.objectContaining({
          employment_data: expect.objectContaining({
            unemployment_rate: expect.any(Number),
            labor_force_participation: expect.any(Number),
            nonfarm_payrolls: expect.any(Number),
            date: expect.any(String)
          })
        }),
        source: 'data_gov'
      }

      // Act: Fetch employment statistics
      const response = await mcpClient.executeTool('get_employment_statistics', {
        date_from: '2024-01-01',
        date_to: '2024-06-01',
        frequency: 'monthly',
        seasonally_adjusted: true
      }, { preferredServer: 'data_gov' })

      // Assert: Data.gov provides official employment statistics
      expect(response).toMatchObject(expectedEmploymentStructure)
    })

    test('should_fetch_inflation_data_cpi', async () => {
      // Arrange: Request Consumer Price Index data

      // Act: Fetch CPI data from Data.gov
      const response = await mcpClient.executeTool('get_inflation_data', {
        index_type: 'CPI-U', // Consumer Price Index for Urban consumers
        date_from: '2023-01-01',
        date_to: '2024-01-01',
        categories: ['all_items', 'food', 'energy', 'core'],
        frequency: 'monthly'
      }, { preferredServer: 'data_gov' })

      // Assert: Data.gov provides official inflation metrics
      expect(response.success).toBe(true)
      expect(response.data).toHaveProperty('inflation_data')
      expect(response.data.inflation_data).toHaveProperty('cpi_data')
      expect(response.data.inflation_data.cpi_data).toHaveProperty('all_items')
    })

    test('should_fetch_gdp_data', async () => {
      // Arrange: Request GDP data from Bureau of Economic Analysis

      // Act: Fetch GDP data
      const response = await mcpClient.executeTool('get_gdp_data', {
        date_from: '2023-01-01',
        date_to: '2024-01-01',
        frequency: 'quarterly',
        components: ['total_gdp', 'personal_consumption', 'business_investment', 'government_spending', 'net_exports']
      }, { preferredServer: 'data_gov' })

      // Assert: Data.gov provides official GDP statistics
      expect(response.success).toBe(true)
      expect(response.data).toHaveProperty('gdp_data')
      expect(response.data.gdp_data).toHaveProperty('total_gdp')
    })
  })

  describe('Government Data Quality Validation Tests', () => {
    test('should_validate_government_data_has_higher_quality_scores', async () => {
      // Arrange: Compare data quality between government and commercial sources
      const testMetric = 'unemployment_rate'

      // Act: Get same metric from government and commercial sources
      const govResponse = await mcpClient.executeTool('get_employment_statistics', {
        metrics: [testMetric],
        date: '2024-01-01'
      }, { preferredServer: 'data_gov' })

      const commercialResponse = await mcpClient.executeTool('get_economic_data', {
        metrics: [testMetric],
        date: '2024-01-01'
      }, { preferredServer: 'alphavantage' })

      // Assert: Government data has higher quality score for official metrics
      expect(govResponse.success).toBe(true)
      expect(commercialResponse.success).toBe(true)

      // Government data should have higher accuracy and source reputation
      const govQuality = mcpClient.calculateDataQuality(govResponse.data, 'data_gov')
      const commercialQuality = mcpClient.calculateDataQuality(commercialResponse.data, 'alphavantage')

      expect(govQuality.metrics.sourceReputation).toBeGreaterThan(commercialQuality.metrics.sourceReputation)
      expect(govQuality.metrics.accuracy).toBeGreaterThanOrEqual(commercialQuality.metrics.accuracy)
    })

    test('should_validate_sec_data_freshness_for_recent_filings', async () => {
      // Arrange: Test data freshness for recent SEC filings
      const recentDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 days ago
      const testCIK = '0000320193'

      // Act: Fetch recent filings
      const response = await mcpClient.executeTool('get_company_filings', {
        cik: testCIK,
        date_from: recentDate.toISOString().split('T')[0],
        form_types: ['8-K'], // Current reports
        limit: 10
      }, { preferredServer: 'sec_edgar' })

      // Assert: Recent filings have high freshness scores
      expect(response.success).toBe(true)

      if (response.data.filings.length > 0) {
        const dataQuality = mcpClient.calculateDataQuality(response.data, 'sec_edgar')
        expect(dataQuality.metrics.freshness).toBeGreaterThan(0.8) // High freshness for recent data
      }
    })

    test('should_validate_treasury_data_completeness', async () => {
      // Arrange: Test data completeness for Treasury yield curves
      const testDate = '2024-01-15'

      // Act: Fetch complete yield curve
      const response = await mcpClient.executeTool('get_daily_treasury_rates', {
        date: testDate,
        rate_types: ['1_month', '3_month', '6_month', '1_year', '2_year', '5_year', '10_year', '30_year']
      }, { preferredServer: 'treasury' })

      // Assert: Treasury data has high completeness
      expect(response.success).toBe(true)

      const dataQuality = mcpClient.calculateDataQuality(response.data, 'treasury')
      expect(dataQuality.metrics.completeness).toBeGreaterThan(0.9) // High completeness expected
    })
  })

  describe('Government MCP Integration Tests', () => {
    test('should_integrate_all_government_sources_for_economic_analysis', async () => {
      // Arrange: Comprehensive economic analysis using all government sources
      const analysisDate = '2024-01-15'

      // Act: Fetch economic data from all government sources
      const [secData, treasuryData, dataGovData] = await Promise.allSettled([
        mcpClient.executeTool('get_market_insider_activity', {
          date: analysisDate,
          sectors: ['technology', 'financial']
        }, { preferredServer: 'sec_edgar' }),

        mcpClient.executeTool('get_daily_treasury_rates', {
          date: analysisDate
        }, { preferredServer: 'treasury' }),

        mcpClient.executeTool('get_employment_statistics', {
          date: analysisDate
        }, { preferredServer: 'data_gov' })
      ])

      // Assert: All government sources contribute to economic analysis
      expect(secData.status).toBe('fulfilled')
      expect(treasuryData.status).toBe('fulfilled')
      expect(dataGovData.status).toBe('fulfilled')

      if (secData.status === 'fulfilled') {
        expect((secData.value as any).success).toBe(true)
      }
      if (treasuryData.status === 'fulfilled') {
        expect((treasuryData.value as any).success).toBe(true)
      }
      if (dataGovData.status === 'fulfilled') {
        expect((dataGovData.value as any).success).toBe(true)
      }
    })

    test('should_fuse_government_and_commercial_data_effectively', async () => {
      // Arrange: Fusion of government and commercial economic data
      const fusionOptions = {
        sources: ['treasury', 'data_gov', 'alphavantage'],
        strategy: 'consensus' as const,
        validateData: true,
        prioritizeGovernmentSources: true
      }

      // Act: Execute data fusion
      const fusedResponse = await mcpClient.executeWithFusion('get_economic_indicators', {
        indicators: ['interest_rates', 'inflation_rate', 'unemployment_rate'],
        date: '2024-01-01'
      }, fusionOptions)

      // Assert: Government sources take priority in fusion
      expect(fusedResponse.success).toBe(true)
      expect(fusedResponse.fusion!.sources).toContain('treasury')
      expect(fusedResponse.fusion!.sources).toContain('data_gov')
      expect(fusedResponse.fusion!.primarySource).toMatch(/treasury|data_gov/) // Government source primary
    })
  })
})

// Extend MCPClient with government server support
declare module '../MCPClient' {
  interface MCPClient {
    addGovernmentServers(): void
    getServerConfig(serverId: string): GovernmentServerConfig
    calculateDataQuality(data: any, source: string): any
  }
}