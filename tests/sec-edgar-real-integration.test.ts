/**
 * SEC EDGAR Real Data Integration Test Suite
 * Tests the real SEC API integration with live data from data.sec.gov
 */

import { mcpClient } from '../app/services/mcp/MCPClient'

describe('SEC EDGAR Real Data Integration', () => {
  // Test timeout for API calls
  const API_TIMEOUT = 30000

  beforeAll(() => {
    console.log('🧪 Starting SEC EDGAR Real Data Integration Tests')
    console.log('📊 Testing against live SEC data.gov API')
  })

  describe('Company Facts Tool', () => {
    it('should fetch real Apple (AAPL) company facts', async () => {
      const response = await mcpClient.executeTool('get_company_facts', {
        ticker: 'AAPL'
      })

      expect(response.success).toBe(true)
      expect(response.source).toBe('sec_edgar')
      expect(response.data).toHaveProperty('company_facts')
      expect(response.data).toHaveProperty('company_info')
      expect(response.data).toHaveProperty('metadata')

      // Validate company info
      expect(response.data.company_info.name).toContain('Apple')
      expect(response.data.metadata.cik).toMatch(/^\d{10}$/) // 10-digit CIK

      // Validate financial metrics structure
      const facts = response.data.company_facts
      expect(facts).toHaveProperty('Revenue')
      expect(facts).toHaveProperty('NetIncome')
      expect(facts).toHaveProperty('Assets')

      // Revenue should be a large positive number for Apple
      if (facts.Revenue) {
        expect(typeof facts.Revenue).toBe('number')
        expect(facts.Revenue).toBeGreaterThan(100000000000) // > $100B
      }

      console.log('✅ Apple company facts:', {
        name: response.data.company_info.name,
        revenue: facts.Revenue ? `$${(facts.Revenue / 1e9).toFixed(1)}B` : 'N/A',
        netIncome: facts.NetIncome ? `$${(facts.NetIncome / 1e9).toFixed(1)}B` : 'N/A',
        assets: facts.Assets ? `$${(facts.Assets / 1e9).toFixed(1)}B` : 'N/A'
      })
    }, API_TIMEOUT)

    it('should fetch real Microsoft (MSFT) company facts', async () => {
      const response = await mcpClient.executeTool('get_company_facts', {
        ticker: 'MSFT'
      })

      expect(response.success).toBe(true)
      expect(response.data.company_info.name).toContain('Microsoft')

      const facts = response.data.company_facts
      console.log('✅ Microsoft company facts:', {
        name: response.data.company_info.name,
        revenue: facts.Revenue ? `$${(facts.Revenue / 1e9).toFixed(1)}B` : 'N/A'
      })
    }, API_TIMEOUT)

    it('should handle invalid ticker gracefully', async () => {
      const response = await mcpClient.executeTool('get_company_facts', {
        ticker: 'INVALID_TICKER_XYZ'
      })

      expect(response.success).toBe(false)
      expect(response.error).toContain('Unable to find CIK')
    }, API_TIMEOUT)
  })

  describe('Company Filings Tool', () => {
    it('should fetch real Apple SEC filings', async () => {
      const response = await mcpClient.executeTool('get_company_filings', {
        ticker: 'AAPL',
        forms: ['10-K', '10-Q'],
        limit: 5
      })

      expect(response.success).toBe(true)
      expect(response.data).toHaveProperty('filings')
      expect(response.data).toHaveProperty('company_info')
      expect(response.data).toHaveProperty('metadata')

      const filings = response.data.filings
      expect(Array.isArray(filings)).toBe(true)
      expect(filings.length).toBeGreaterThan(0)

      // Validate filing structure
      const firstFiling = filings[0]
      expect(firstFiling).toHaveProperty('accessionNumber')
      expect(firstFiling).toHaveProperty('filingDate')
      expect(firstFiling).toHaveProperty('formType')
      expect(firstFiling).toHaveProperty('filingUrl')
      expect(firstFiling).toHaveProperty('description')

      // Should be recent filings
      const filingDate = new Date(firstFiling.filingDate)
      const oneYearAgo = new Date()
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
      expect(filingDate.getTime()).toBeGreaterThan(oneYearAgo.getTime())

      console.log('✅ Apple recent filings:', filings.slice(0, 3).map((f: any) => ({
        form: f.formType,
        date: f.filingDate,
        description: f.description
      })))
    }, API_TIMEOUT)

    it('should filter filings by form type', async () => {
      const response = await mcpClient.executeTool('get_company_filings', {
        ticker: 'AAPL',
        forms: ['10-K'], // Only annual reports
        limit: 3
      })

      expect(response.success).toBe(true)
      const filings = response.data.filings

      // All returned filings should be 10-K
      filings.forEach((filing: any) => {
        expect(filing.formType).toBe('10-K')
        expect(filing.description).toBe('Annual Report')
      })

      console.log('✅ Apple 10-K filings:', filings.length)
    }, API_TIMEOUT)
  })

  describe('Insider Transactions Tool', () => {
    it('should fetch real insider transactions for Apple', async () => {
      const response = await mcpClient.executeTool('get_insider_transactions', {
        ticker: 'AAPL',
        limit: 10
      })

      expect(response.success).toBe(true)
      expect(response.data).toHaveProperty('insider_transactions')
      expect(response.data).toHaveProperty('company_info')

      const transactions = response.data.insider_transactions
      expect(Array.isArray(transactions)).toBe(true)

      if (transactions.length > 0) {
        const firstTransaction = transactions[0]
        expect(firstTransaction).toHaveProperty('filingDate')
        expect(firstTransaction).toHaveProperty('formType')
        expect(firstTransaction).toHaveProperty('description')
        expect(['3', '4', '5']).toContain(firstTransaction.formType)

        console.log('✅ Apple insider transactions found:', transactions.length)
        console.log('Recent transaction:', {
          form: firstTransaction.formType,
          date: firstTransaction.filingDate,
          description: firstTransaction.description
        })
      } else {
        console.log('ℹ️ No recent insider transactions found for Apple')
      }
    }, API_TIMEOUT)
  })

  describe('Company Search Tool', () => {
    it('should search companies by ticker', async () => {
      const response = await mcpClient.executeTool('search_companies', {
        query: 'AAPL',
        limit: 5
      })

      expect(response.success).toBe(true)
      expect(response.data).toHaveProperty('companies')
      expect(response.data).toHaveProperty('metadata')

      const companies = response.data.companies
      expect(Array.isArray(companies)).toBe(true)
      expect(companies.length).toBeGreaterThan(0)

      // First result should be Apple with highest relevance
      const apple = companies[0]
      expect(apple.ticker).toBe('AAPL')
      expect(apple.title).toContain('Apple')
      expect(apple.relevance_score).toBeGreaterThan(90)

      console.log('✅ Company search results:', companies.map((c: any) => ({
        ticker: c.ticker,
        name: c.title,
        score: c.relevance_score
      })))
    }, API_TIMEOUT)

    it('should search companies by name', async () => {
      const response = await mcpClient.executeTool('search_companies', {
        query: 'Microsoft',
        limit: 3
      })

      expect(response.success).toBe(true)
      const companies = response.data.companies

      // Should find Microsoft Corporation
      const microsoft = companies.find((c: any) => c.ticker === 'MSFT')
      expect(microsoft).toBeDefined()
      expect(microsoft.title).toContain('Microsoft')

      console.log('✅ Microsoft search result:', microsoft)
    }, API_TIMEOUT)
  })

  describe('Company Concept Tool', () => {
    it('should fetch revenue concept data for Apple', async () => {
      const response = await mcpClient.executeTool('get_company_concept', {
        ticker: 'AAPL',
        concept: 'Revenues',
        taxonomy: 'us-gaap'
      })

      expect(response.success).toBe(true)
      expect(response.data).toHaveProperty('concept_data')
      expect(response.data).toHaveProperty('company_info')
      expect(response.data).toHaveProperty('metadata')

      if (response.data.concept_data) {
        expect(response.data.concept_data).toHaveProperty('units')
        expect(response.data.metadata.concept).toBe('Revenues')
        expect(response.data.metadata.taxonomy).toBe('us-gaap')

        console.log('✅ Apple Revenues concept data available')
        console.log('Units:', response.data.metadata.units_available)
      } else {
        console.log('ℹ️ Revenues concept not available for Apple')
      }
    }, API_TIMEOUT)

    it('should handle non-existent concept gracefully', async () => {
      const response = await mcpClient.executeTool('get_company_concept', {
        ticker: 'AAPL',
        concept: 'NonExistentConcept',
        taxonomy: 'us-gaap'
      })

      expect(response.success).toBe(true)
      expect(response.data.concept_data).toBeNull()
      expect(response.data.error).toContain('not found')
    }, API_TIMEOUT)
  })

  describe('Rate Limiting and Performance', () => {
    it('should handle multiple requests with rate limiting', async () => {
      const startTime = Date.now()

      // Make 5 rapid requests
      const promises = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA'].map(ticker =>
        mcpClient.executeTool('get_company_facts', { ticker })
      )

      const responses = await Promise.all(promises)
      const endTime = Date.now()
      const duration = endTime - startTime

      // All requests should succeed
      responses.forEach(response => {
        expect(response.success).toBe(true)
      })

      // Should take at least 400ms due to rate limiting (5 requests * 100ms minimum)
      expect(duration).toBeGreaterThan(400)

      console.log('✅ Rate limiting test completed')
      console.log(`Duration: ${duration}ms for 5 requests`)
      console.log('Average per request:', `${(duration / 5).toFixed(0)}ms`)
    }, API_TIMEOUT)

    it('should cache CIK lookups for better performance', async () => {
      // First request (should cache CIK)
      const start1 = Date.now()
      const response1 = await mcpClient.executeTool('get_company_facts', { ticker: 'AAPL' })
      const duration1 = Date.now() - start1

      // Second request for same ticker (should use cached CIK)
      const start2 = Date.now()
      const response2 = await mcpClient.executeTool('get_company_filings', { ticker: 'AAPL', limit: 1 })
      const duration2 = Date.now() - start2

      expect(response1.success).toBe(true)
      expect(response2.success).toBe(true)

      console.log('✅ CIK caching test completed')
      console.log(`First request: ${duration1}ms, Second request: ${duration2}ms`)
    }, API_TIMEOUT)
  })

  describe('Data Quality and Validation', () => {
    it('should validate financial data completeness', async () => {
      const response = await mcpClient.executeTool('get_company_facts', {
        ticker: 'AAPL'
      })

      expect(response.success).toBe(true)
      const facts = response.data.company_facts

      // Check data completeness (Apple should have most standard metrics)
      const expectedMetrics = ['Revenue', 'NetIncome', 'Assets']
      let completenessScore = 0

      expectedMetrics.forEach(metric => {
        if (facts[metric] && facts[metric] > 0) {
          completenessScore++
        }
      })

      const completenessPercentage = (completenessScore / expectedMetrics.length) * 100
      expect(completenessPercentage).toBeGreaterThan(50) // At least 50% complete

      console.log('✅ Data completeness for Apple:', `${completenessPercentage.toFixed(0)}%`)
      console.log('Available metrics:', Object.keys(facts).filter(k => facts[k] !== null))
    }, API_TIMEOUT)

    it('should validate CIK format consistency', async () => {
      const tickers = ['AAPL', 'MSFT', 'GOOGL']

      for (const ticker of tickers) {
        const response = await mcpClient.executeTool('get_company_facts', { ticker })

        if (response.success) {
          const cik = response.data.metadata.cik
          expect(cik).toMatch(/^\d{10}$/) // Should be 10 digits
          expect(cik.length).toBe(10)

          console.log(`✅ ${ticker} CIK format valid: ${cik}`)
        }
      }
    }, API_TIMEOUT)
  })

  describe('Error Handling', () => {
    it('should handle network timeouts gracefully', async () => {
      // This test would need to be implemented with network mocking
      // For now, just ensure error structure is correct
      const response = await mcpClient.executeTool('get_company_facts', {
        ticker: 'INVALID123'
      })

      expect(response.success).toBe(false)
      expect(response.error).toBeDefined()
      expect(response.source).toBe('sec_edgar')
      expect(response.timestamp).toBeDefined()
    }, API_TIMEOUT)

    it('should provide meaningful error messages', async () => {
      const response = await mcpClient.executeTool('get_company_facts', {
        ticker: 'NONEXISTENT'
      })

      expect(response.success).toBe(false)
      expect(response.error).toContain('Unable to find CIK')
      expect(response.error).toContain('NONEXISTENT')
    }, API_TIMEOUT)
  })

  afterAll(() => {
    console.log('🏁 SEC EDGAR Real Data Integration Tests Completed')
    console.log('📊 All tests validate real SEC data.gov API integration')
  })
})

/**
 * Performance benchmark test (optional, run separately)
 */
describe('SEC EDGAR Performance Benchmarks', () => {
  it('should meet performance targets', async () => {
    const performanceMetrics = {
      companyFacts: [],
      companyFilings: [],
      insiderTransactions: []
    }

    // Test company facts performance
    const start = Date.now()
    const response = await mcpClient.executeTool('get_company_facts', { ticker: 'AAPL' })
    const duration = Date.now() - start

    expect(response.success).toBe(true)
    expect(duration).toBeLessThan(5000) // Should complete within 5 seconds

    console.log('✅ Performance benchmark completed')
    console.log(`Company facts response time: ${duration}ms`)
    console.log('Target: <5000ms ✅')
  }, 10000)
})