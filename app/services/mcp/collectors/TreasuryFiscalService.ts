/**
 * Treasury Fiscal Data Service
 *
 * Provides real-time access to U.S. Treasury fiscal data including federal debt,
 * daily treasury operations, government spending, revenue, and exchange rates.
 *
 * API Documentation: https://fiscaldata.treasury.gov/api-documentation/
 * No authentication required - public API
 * Rate limit: 5 requests per second recommended
 */

import { redisCache } from '../../cache/RedisCache'

// Treasury API Configuration
const TREASURY_BASE_URL = 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service'
const RATE_LIMIT_DELAY = 200 // 5 req/sec = 200ms between requests
const DEFAULT_TIMEOUT = 10000 // 10 seconds

// Treasury API Endpoints - Updated with working endpoints
const ENDPOINTS = {
  debtToPenny: '/v2/accounting/od/debt_to_penny',
  exchangeRates: '/v1/accounting/od/rates_of_exchange',
  operatingCash: '/v1/accounting/dts/operating_cash_balance',
  // Monthly Treasury Statement tables (all working)
  monthlyOverview: '/v1/accounting/mts/mts_table_1',
  monthlyBudget: '/v1/accounting/mts/mts_table_2',
  monthlyReceipts: '/v1/accounting/mts/mts_table_3',
  federalRevenue: '/v1/accounting/mts/mts_table_4',
  federalSpending: '/v1/accounting/mts/mts_table_5'
} as const

// Treasury Data Interfaces
export interface TreasuryDebtData {
  amount: number
  date: string
  formattedAmount: string
  amountTrillions: string
}

export interface TreasuryOperationsData {
  date: string
  openingBalance: number
  closingBalance: number
  receipts: number
  withdrawals: number
  netChange: number
}

export interface TreasurySpendingData {
  fiscalYear: string
  category: string
  amount: number
  formattedAmount: string
}

export interface TreasuryRevenueData {
  fiscalYear: string
  source: string
  amount: number
  formattedAmount: string
}

export interface TreasuryExchangeRateData {
  date: string
  currency: string
  exchangeRate: number
}

export interface TreasuryFiscalResponse {
  dataType: string
  source: string
  timestamp: string
  data: any
  metadata: {
    totalRecords: number
    queryParams: Record<string, any>
    endpointUsed: string
    responseTimeMs: number
  }
}

export interface TreasuryApiError extends Error {
  status?: number
  code?: string
  endpoint?: string
}

/**
 * Treasury Fiscal Data Service
 * Handles all interactions with the Treasury Fiscal Data API
 */
export class TreasuryFiscalService {
  private lastRequestTime = 0
  private requestQueue: Promise<any> = Promise.resolve()

  constructor() {
    console.log('🏛️ Treasury Fiscal Service initialized')
  }

  /**
   * Rate-limited request wrapper
   */
  private async makeRequest(
    endpoint: string,
    params: Record<string, any> = {},
    description = ''
  ): Promise<any> {
    // Generate cache key
    const cacheKey = `treasury:${endpoint}:${JSON.stringify(params)}`

    // Check cache first
    const cached = await redisCache.get(cacheKey)
    if (cached) {
      console.log(`💰 Treasury cache hit: ${endpoint}`)
      return JSON.parse(cached)
    }

    // Rate limiting
    return this.requestQueue = this.requestQueue.then(async () => {
      const now = Date.now()
      const timeSinceLastRequest = now - this.lastRequestTime

      if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
        const delay = RATE_LIMIT_DELAY - timeSinceLastRequest
        console.log(`⏳ Treasury rate limiting: waiting ${delay}ms`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }

      this.lastRequestTime = Date.now()

      try {
        // Fix URL construction - use string concatenation instead of new URL()
        const baseUrl = `${TREASURY_BASE_URL}${endpoint}`
        const searchParams = new URLSearchParams()

        // Add query parameters
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            searchParams.set(key, String(value))
          }
        })

        const fullUrl = `${baseUrl}?${searchParams.toString()}`

        console.log(`🏛️ Treasury API request: ${description || endpoint}`)
        console.log(`🔗 URL: ${fullUrl}`)

        const startTime = Date.now()
        const response = await fetch(fullUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Stock-Picker Financial Analysis Platform v1.0'
          },
          signal: AbortSignal.timeout(DEFAULT_TIMEOUT)
        })

        if (!response.ok) {
          const error = new Error(`Treasury API error: ${response.status} ${response.statusText}`) as TreasuryApiError
          error.status = response.status
          error.endpoint = endpoint
          throw error
        }

        const data = await response.json()
        const responseTime = Date.now() - startTime

        // Cache successful response
        const ttl = this.getCacheTTL(endpoint)
        await redisCache.set(cacheKey, JSON.stringify(data), ttl)

        console.log(`✅ Treasury API success: ${responseTime}ms`)
        return data

      } catch (error) {
        console.error(`❌ Treasury API error:`, error)
        throw error
      }
    })
  }

  /**
   * Get cache TTL based on endpoint type
   */
  private getCacheTTL(endpoint: string): number {
    if (endpoint.includes('debt_to_penny')) return 4 * 60 * 60 // 4 hours - daily updates
    if (endpoint.includes('dts_table_1')) return 1 * 60 * 60 // 1 hour - frequent updates
    if (endpoint.includes('rates_of_exchange')) return 2 * 60 * 60 // 2 hours - regular updates
    return 3 * 60 * 60 // 3 hours default
  }

  /**
   * Format currency amounts
   */
  private formatAmount(amount: number): { formatted: string; trillions: string } {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)

    const trillions = (amount / 1_000_000_000_000).toFixed(2)

    return {
      formatted,
      trillions: `$${trillions}T`
    }
  }

  /**
   * Get Federal Debt to the Penny
   * Returns current federal debt outstanding
   */
  async getDebtToPenny(
    startDate?: string,
    endDate?: string,
    limit = 30
  ): Promise<TreasuryFiscalResponse> {
    const params: Record<string, any> = {
      'sort': '-record_date',
      'page[size]': limit
    }

    if (startDate) params['filter'] = `record_date:gte:${startDate}`
    if (endDate) params['filter'] = `${params['filter']},record_date:lte:${endDate}`

    const startTime = Date.now()
    const response = await this.makeRequest(
      ENDPOINTS.debtToPenny,
      params,
      'Debt to the Penny'
    )

    const records = response.data || []
    const latest = records[0] || {}

    const latestAmount = parseFloat(latest.tot_pub_debt_out_amt) || 0
    const formatted = this.formatAmount(latestAmount)

    // Calculate trend if multiple records
    let trendAnalysis = null
    if (records.length > 1) {
      const oldest = records[records.length - 1]
      const oldestAmount = parseFloat(oldest.tot_pub_debt_out_amt) || 0
      const change = latestAmount - oldestAmount
      const changePercent = oldestAmount > 0 ? ((change / oldestAmount) * 100) : 0

      trendAnalysis = {
        periodChange: change,
        periodChangePercent: changePercent,
        direction: change > 0 ? 'increasing' : change < 0 ? 'decreasing' : 'stable',
        dailyAverageChange: change / Math.max(records.length - 1, 1)
      }
    }

    const result = {
      dataType: 'Treasury Debt to the Penny',
      source: 'U.S. Treasury Fiscal Data',
      timestamp: new Date().toISOString(),
      data: {
        latestDebt: {
          amount: latestAmount,
          date: latest.record_date,
          formattedAmount: formatted.formatted,
          amountTrillions: formatted.trillions
        },
        trendAnalysis,
        records: records.slice(0, 10) // Limit returned records
      },
      metadata: {
        totalRecords: response.meta?.total_count || records.length,
        queryParams: params,
        endpointUsed: ENDPOINTS.debtToPenny,
        responseTimeMs: Date.now() - startTime
      }
    }

    return result
  }

  /**
   * Get Monthly Treasury Statement (Table 1)
   * Returns government monthly financial overview
   */
  async getMonthlyTreasuryStatement(
    startDate?: string,
    limit = 12
  ): Promise<TreasuryFiscalResponse> {
    const params: Record<string, any> = {
      'sort': '-record_date',
      'page[size]': limit
    }

    if (startDate) params['filter'] = `record_date:gte:${startDate}`

    const startTime = Date.now()
    const response = await this.makeRequest(
      ENDPOINTS.monthlyOverview,
      params,
      'Monthly Treasury Statement'
    )

    const records = response.data || []
    const latest = records[0] || {}

    const result = {
      dataType: 'Monthly Treasury Statement',
      source: 'U.S. Treasury Fiscal Data',
      timestamp: new Date().toISOString(),
      data: {
        summary: {
          latestDate: latest.record_date,
          grossReceipts: parseFloat(latest.current_month_gross_rcpt_amt) || 0,
          grossOutlays: parseFloat(latest.current_month_gross_outly_amt) || 0,
          deficitSurplus: parseFloat(latest.current_month_dfct_sur_amt) || 0
        },
        monthlyData: records.map((record: any) => ({
          date: record.record_date,
          classification: record.classification_desc,
          grossReceipts: parseFloat(record.current_month_gross_rcpt_amt) || 0,
          grossOutlays: parseFloat(record.current_month_gross_outly_amt) || 0,
          deficitSurplus: parseFloat(record.current_month_dfct_sur_amt) || 0
        }))
      },
      metadata: {
        totalRecords: response.meta?.total_count || records.length,
        queryParams: params,
        endpointUsed: ENDPOINTS.monthlyOverview,
        responseTimeMs: Date.now() - startTime
      }
    }

    return result
  }

  /**
   * Get Federal Spending Data (MTS Table 5)
   */
  async getFederalSpending(
    fiscalYear?: string,
    limit = 50
  ): Promise<TreasuryFiscalResponse> {
    const currentYear = new Date().getFullYear()
    const params: Record<string, any> = {
      'sort': '-record_date',
      'page[size]': limit
    }

    if (fiscalYear) {
      params['filter'] = `record_fiscal_year:eq:${fiscalYear}`
    } else {
      params['filter'] = `record_fiscal_year:eq:${currentYear}`
    }

    const startTime = Date.now()
    const response = await this.makeRequest(
      ENDPOINTS.federalSpending,
      params,
      'Federal Spending'
    )

    const records = response.data || []

    const result = {
      dataType: 'Federal Spending',
      source: 'U.S. Treasury Fiscal Data',
      timestamp: new Date().toISOString(),
      data: {
        fiscalYear: fiscalYear || currentYear.toString(),
        spendingData: records.map((record: any) => ({
          date: record.record_date,
          classification: record.classification_desc,
          grossOutlays: parseFloat(record.current_month_gross_outly_amt) || 0,
          netOutlays: parseFloat(record.current_month_net_outly_amt) || 0,
          fyToDateGross: parseFloat(record.current_fytd_gross_outly_amt) || 0,
          formattedAmount: this.formatAmount(parseFloat(record.current_month_gross_outly_amt) || 0).formatted
        }))
      },
      metadata: {
        totalRecords: response.meta?.total_count || records.length,
        queryParams: params,
        endpointUsed: ENDPOINTS.federalSpending,
        responseTimeMs: Date.now() - startTime
      }
    }

    return result
  }

  /**
   * Get Federal Revenue Data (MTS Table 4)
   */
  async getFederalRevenue(
    fiscalYear?: string,
    limit = 50
  ): Promise<TreasuryFiscalResponse> {
    const currentYear = new Date().getFullYear()
    const params: Record<string, any> = {
      'sort': '-record_date',
      'page[size]': limit
    }

    if (fiscalYear) {
      params['filter'] = `record_fiscal_year:eq:${fiscalYear}`
    } else {
      params['filter'] = `record_fiscal_year:eq:${currentYear}`
    }

    const startTime = Date.now()
    const response = await this.makeRequest(
      ENDPOINTS.federalRevenue,
      params,
      'Federal Revenue'
    )

    const records = response.data || []

    const result = {
      dataType: 'Federal Revenue',
      source: 'U.S. Treasury Fiscal Data',
      timestamp: new Date().toISOString(),
      data: {
        fiscalYear: fiscalYear || currentYear.toString(),
        revenueData: records.map((record: any) => ({
          date: record.record_date,
          classification: record.classification_desc,
          grossReceipts: parseFloat(record.current_month_gross_rcpt_amt) || 0,
          netReceipts: parseFloat(record.current_month_net_rcpt_amt) || 0,
          fyToDateGross: parseFloat(record.current_fytd_gross_rcpt_amt) || 0,
          formattedAmount: this.formatAmount(parseFloat(record.current_month_gross_rcpt_amt) || 0).formatted
        }))
      },
      metadata: {
        totalRecords: response.meta?.total_count || records.length,
        queryParams: params,
        endpointUsed: ENDPOINTS.federalRevenue,
        responseTimeMs: Date.now() - startTime
      }
    }

    return result
  }

  /**
   * Get Exchange Rates
   */
  async getExchangeRates(
    date?: string,
    limit = 20
  ): Promise<TreasuryFiscalResponse> {
    const params: Record<string, any> = {
      'sort': '-record_date',
      'page[size]': limit
    }

    if (date) params['filter'] = `record_date:eq:${date}`

    const startTime = Date.now()
    const response = await this.makeRequest(
      ENDPOINTS.exchangeRates,
      params,
      'Exchange Rates'
    )

    const records = response.data || []

    const result = {
      dataType: 'Treasury Exchange Rates',
      source: 'U.S. Treasury Fiscal Data',
      timestamp: new Date().toISOString(),
      data: {
        exchangeRates: records.map((record: any) => ({
          date: record.record_date,
          currency: record.currency,
          exchangeRate: parseFloat(record.exchange_rate) || 0
        }))
      },
      metadata: {
        totalRecords: response.meta?.total_count || records.length,
        queryParams: params,
        endpointUsed: ENDPOINTS.exchangeRates,
        responseTimeMs: Date.now() - startTime
      }
    }

    return result
  }

  /**
   * Get Operating Cash Balance
   */
  async getOperatingCashBalance(
    startDate?: string,
    limit = 30
  ): Promise<TreasuryFiscalResponse> {
    const params: Record<string, any> = {
      'sort': '-record_date',
      'page[size]': limit
    }

    if (startDate) params['filter'] = `record_date:gte:${startDate}`

    const startTime = Date.now()
    const response = await this.makeRequest(
      ENDPOINTS.operatingCash,
      params,
      'Operating Cash Balance'
    )

    const records = response.data || []

    const result = {
      dataType: 'Treasury Operating Cash Balance',
      source: 'U.S. Treasury Fiscal Data',
      timestamp: new Date().toISOString(),
      data: {
        cashBalances: records.map((record: any) => ({
          date: record.record_date,
          openingBalance: parseFloat(record.open_today_bal) || 0,
          closingBalance: parseFloat(record.close_today_bal) || 0,
          formattedClosingBalance: this.formatAmount(parseFloat(record.close_today_bal) || 0).formatted
        }))
      },
      metadata: {
        totalRecords: response.meta?.total_count || records.length,
        queryParams: params,
        endpointUsed: ENDPOINTS.operatingCash,
        responseTimeMs: Date.now() - startTime
      }
    }

    return result
  }

  /**
   * Get Comprehensive Fiscal Summary
   * Combines multiple endpoints for a complete fiscal overview
   */
  async getComprehensiveFiscalSummary(
    dateRangeDays = 30
  ): Promise<TreasuryFiscalResponse> {
    const startTime = Date.now()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - dateRangeDays)
    const startDateStr = startDate.toISOString().split('T')[0]

    try {
      // Make parallel requests
      const [debtData, operationsData, spendingData, revenueData] = await Promise.allSettled([
        this.getDebtToPenny(startDateStr, undefined, 10),
        this.getMonthlyTreasuryStatement(startDateStr, 10),
        this.getFederalSpending(undefined, 10),
        this.getFederalRevenue(undefined, 10)
      ])

      const result = {
        dataType: 'Comprehensive Fiscal Summary',
        source: 'U.S. Treasury Fiscal Data',
        timestamp: new Date().toISOString(),
        data: {
          federalDebt: debtData.status === 'fulfilled' ? debtData.value.data : null,
          monthlyOperations: operationsData.status === 'fulfilled' ? operationsData.value.data : null,
          spending: spendingData.status === 'fulfilled' ? spendingData.value.data : null,
          revenue: revenueData.status === 'fulfilled' ? revenueData.value.data : null,
          summary: {
            dataPointsCollected: [debtData, operationsData, spendingData, revenueData].filter(p => p.status === 'fulfilled').length,
            errors: [debtData, operationsData, spendingData, revenueData].filter(p => p.status === 'rejected').length
          }
        },
        metadata: {
          totalRecords: 0,
          queryParams: { dateRangeDays, startDate: startDateStr },
          endpointUsed: 'comprehensive_summary',
          responseTimeMs: Date.now() - startTime
        }
      }

      return result

    } catch (error) {
      console.error('❌ Treasury comprehensive summary error:', error)
      throw error
    }
  }
}

// Export singleton instance
export const treasuryFiscalService = new TreasuryFiscalService()