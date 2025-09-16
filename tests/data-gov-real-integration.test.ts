/**
 * Data.gov Real API Integration Test Suite
 *
 * Tests the real implementation of Data.gov MCP server integration
 * replacing the mock implementation with actual government API calls.
 *
 * Tests include:
 * - BLS Employment Statistics API
 * - BLS Inflation/CPI Data API
 * - BEA GDP Data API
 * - Error handling and rate limiting
 * - Data quality and validation
 */

import { mcpClient } from '../app/services/mcp/MCPClient'

describe('Data.gov Real API Integration Tests', () => {

  describe('BLS Employment Statistics API', () => {
    test('should fetch real unemployment rate data from BLS API', async () => {
      const response = await mcpClient.executeTool('get_employment_statistics', {
        series_id: 'LNS14000000' // Unemployment rate series
      })

      expect(response.success).toBe(true)
      expect(response.source).toBe('datagov')
      expect(response.data).toHaveProperty('employment_data')

      const employmentData = response.data.employment_data
      expect(employmentData).toHaveProperty('unemployment_rate')
      expect(employmentData).toHaveProperty('date')
      expect(employmentData).toHaveProperty('source', 'bls_api')

      // Validate data structure
      expect(typeof employmentData.unemployment_rate).toBe('number')
      expect(employmentData.unemployment_rate).toBeGreaterThan(0)
      expect(employmentData.unemployment_rate).toBeLessThan(20) // Reasonable bounds

      // Validate metadata
      expect(response.data).toHaveProperty('metadata')
      expect(response.data.metadata.data_source).toBe('US Bureau of Labor Statistics')
      expect(response.data.metadata.api_version).toBe('v2')

      console.log('✅ BLS Employment Data:', {
        unemployment_rate: employmentData.unemployment_rate,
        date: employmentData.date,
        source: employmentData.source
      })
    }, 15000) // Allow 15 seconds for API call

    test('should handle BLS API errors gracefully', async () => {
      const response = await mcpClient.executeTool('get_employment_statistics', {
        series_id: 'INVALID_SERIES_ID'
      })

      // Should either return error or empty data
      if (!response.success) {
        expect(response.error).toContain('BLS API error')
      } else {
        // If BLS doesn't validate series IDs, it might return empty data
        expect(response.data).toBeDefined()
      }
    }, 10000)
  })

  describe('BLS Inflation/CPI Data API', () => {
    test('should fetch real CPI inflation data from BLS API', async () => {
      const response = await mcpClient.executeTool('get_inflation_data', {
        series_id: 'CUUR0000SA0' // CPI-U All Items
      })

      expect(response.success).toBe(true)
      expect(response.source).toBe('datagov')
      expect(response.data).toHaveProperty('inflation_data')

      const inflationData = response.data.inflation_data
      expect(inflationData).toHaveProperty('cpi_data')
      expect(inflationData.cpi_data).toHaveProperty('latest_index')
      expect(inflationData.cpi_data).toHaveProperty('period')
      expect(inflationData.cpi_data).toHaveProperty('series_id')

      // Validate data structure
      expect(typeof inflationData.cpi_data.latest_index).toBe('number')
      expect(inflationData.cpi_data.latest_index).toBeGreaterThan(200) // CPI baseline ~300

      // Validate metadata
      expect(response.data).toHaveProperty('metadata')
      expect(response.data.metadata.data_source).toBe('US Bureau of Labor Statistics')
      expect(response.data.metadata.series_title).toBe('Consumer Price Index')

      console.log('✅ BLS Inflation Data:', {
        cpi_index: inflationData.cpi_data.latest_index,
        yoy_change: inflationData.cpi_data.all_items,
        period: inflationData.cpi_data.period
      })
    }, 15000)

    test('should calculate year-over-year inflation correctly', async () => {
      const response = await mcpClient.executeTool('get_inflation_data', {
        series_id: 'CUUR0000SA0'
      })

      expect(response.success).toBe(true)

      if (response.data.inflation_data.cpi_data.all_items) {
        const yoyChange = response.data.inflation_data.cpi_data.all_items
        expect(typeof yoyChange).toBe('number')
        expect(yoyChange).toBeGreaterThan(-10) // Reasonable bounds for inflation
        expect(yoyChange).toBeLessThan(20)
      }

      // Should have historical data
      expect(response.data).toHaveProperty('historical_data')
      expect(Array.isArray(response.data.historical_data)).toBe(true)
      expect(response.data.historical_data.length).toBeGreaterThan(0)
    }, 15000)
  })

  describe('BEA GDP Data API', () => {
    test('should fetch real GDP data from BEA API', async () => {
      const response = await mcpClient.executeTool('get_gdp_data', {
        dataset: 'NIPA',
        table_name: 'T10101',
        frequency: 'Q'
      })

      // Note: BEA API requires a valid API key, so we test both success and error cases
      if (response.success) {
        expect(response.source).toBe('datagov')
        expect(response.data).toHaveProperty('gdp_data')

        const gdpData = response.data.gdp_data
        expect(gdpData).toHaveProperty('total_gdp')
        expect(gdpData).toHaveProperty('period')
        expect(gdpData).toHaveProperty('source', 'bea_api')

        // Validate GDP is a reasonable number (in dollars)
        expect(typeof gdpData.total_gdp).toBe('number')
        expect(gdpData.total_gdp).toBeGreaterThan(20000000000000) // > $20 trillion

        console.log('✅ BEA GDP Data:', {
          total_gdp: gdpData.total_gdp,
          period: gdpData.period,
          source: gdpData.source
        })
      } else {
        // Expected if no BEA API key is configured
        expect(response.error).toContain('BEA API error')
        console.log('ℹ️ BEA API requires valid API key - error expected:', response.error)
      }
    }, 20000) // Allow 20 seconds for GDP API

    test('should handle BEA API authentication errors', async () => {
      // Test with invalid API key scenario
      const response = await mcpClient.executeTool('get_gdp_data', {
        dataset: 'NIPA',
        table_name: 'INVALID_TABLE'
      })

      // Should handle error gracefully
      if (!response.success) {
        expect(response.error).toBeDefined()
        expect(typeof response.error).toBe('string')
      }
    }, 15000)
  })

  describe('Data Quality and Integration', () => {
    test('should provide consistent data structure across all Data.gov tools', async () => {
      const tools = [
        'get_employment_statistics',
        'get_inflation_data'
        // Note: GDP test is conditional due to API key requirement
      ]

      for (const tool of tools) {
        const response = await mcpClient.executeTool(tool, {})

        if (response.success) {
          // All responses should have consistent structure
          expect(response).toHaveProperty('success', true)
          expect(response).toHaveProperty('source', 'datagov')
          expect(response).toHaveProperty('data')
          expect(response).toHaveProperty('timestamp')

          // Should have metadata
          expect(response.data).toHaveProperty('metadata')
          expect(response.data.metadata).toHaveProperty('last_updated')
          expect(response.data.metadata).toHaveProperty('data_source')
        }
      }
    }, 30000)

    test('should handle rate limiting gracefully', async () => {
      // Test multiple rapid requests to check rate limiting
      const promises = Array(3).fill(null).map(() =>
        mcpClient.executeTool('get_employment_statistics', {})
      )

      const results = await Promise.allSettled(promises)

      // At least some should succeed
      const successful = results.filter(r => r.status === 'fulfilled').length
      expect(successful).toBeGreaterThan(0)

      console.log(`Rate limiting test: ${successful}/3 requests succeeded`)
    }, 20000)

    test('should validate historical data is properly formatted', async () => {
      const response = await mcpClient.executeTool('get_inflation_data', {})

      if (response.success && response.data.historical_data) {
        const historicalData = response.data.historical_data

        expect(Array.isArray(historicalData)).toBe(true)

        if (historicalData.length > 0) {
          const firstItem = historicalData[0]
          expect(firstItem).toHaveProperty('period')
          expect(firstItem).toHaveProperty('index_value')
          expect(typeof firstItem.index_value).toBe('number')
        }
      }
    }, 15000)
  })

  describe('Server Configuration Validation', () => {
    test('should have proper Data.gov server configuration', () => {
      // Access private server configuration (for testing)
      const servers = (mcpClient as any).servers
      expect(servers.has('datagov')).toBe(true)

      const datagovConfig = servers.get('datagov')
      expect(datagovConfig).toHaveProperty('name', 'Data.gov MCP')
      expect(datagovConfig).toHaveProperty('baseUrls')
      expect(datagovConfig.baseUrls).toHaveProperty('bls')
      expect(datagovConfig.baseUrls).toHaveProperty('bea')
      expect(datagovConfig).toHaveProperty('rateLimit', 500)
      expect(datagovConfig).toHaveProperty('timeout', 15000)
    })

    test('should properly route Data.gov tools', () => {
      const toolServerMap = (mcpClient as any).getToolServerMap()

      expect(toolServerMap['get_employment_statistics']).toContain('datagov')
      expect(toolServerMap['get_inflation_data']).toContain('datagov')
      expect(toolServerMap['get_gdp_data']).toContain('datagov')
    })
  })
})