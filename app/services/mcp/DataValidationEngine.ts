/**
 * Data Validation Engine for MCP Financial Data
 * Comprehensive validation rules for financial data types with configurable thresholds
 */

import {
  UnifiedStockPrice,
  UnifiedCompanyInfo,
  UnifiedFinancialStatement,
  UnifiedTechnicalIndicator,
  UnifiedNewsItem,
  ValidationResult,
  DataDiscrepancy
} from './types'
import { ValidationThresholds } from './DataNormalizationPipeline'

export interface ValidationRule {
  name: string
  field: string
  validator: (value: any, data: any, context?: any) => boolean
  severity: 'error' | 'warning' | 'info'
  message: string
  threshold?: number
}

export interface ValidationContext {
  source: string
  timestamp: number
  symbol?: string
  metadata?: Record<string, any>
}

export interface ValidationStatistics {
  totalValidations: number
  passedValidations: number
  failedValidations: number
  validationsByType: Record<string, { passed: number; failed: number }>
  commonFailures: Array<{ rule: string; count: number }>
  averageValidationTime: number
}

export class DataValidationEngine {
  private thresholds: ValidationThresholds
  private statistics: ValidationStatistics
  private validationRules: Map<string, ValidationRule[]>

  constructor(thresholds: ValidationThresholds) {
    this.thresholds = thresholds
    this.statistics = this.initializeStatistics()
    this.validationRules = new Map()
    this.initializeValidationRules()
  }

  /**
   * Validate unified stock price data
   */
  async validateStockPrice(
    data: UnifiedStockPrice,
    context?: ValidationContext
  ): Promise<ValidationResult> {
    const startTime = Date.now()
    const discrepancies: DataDiscrepancy[] = []
    const rules = this.validationRules.get('stock_price') || []

    // Required fields validation
    const requiredFields = this.thresholds.stockPrice.requiredFields
    for (const field of requiredFields) {
      if (!this.hasValidValue(data, field)) {
        discrepancies.push({
          field,
          sources: { [data.source]: 'missing' },
          variance: 1.0,
          resolution: {
            strategy: 'custom',
            resolvedValue: null,
            reason: `Required field '${field}' is missing or invalid`
          }
        })
      }
    }

    // Price validation rules
    if (data.open && data.close && data.high && data.low) {
      // High should be >= max(open, close)
      if (data.high < Math.max(data.open, data.close)) {
        discrepancies.push(this.createDiscrepancy(
          'high',
          data.source,
          data.high,
          Math.max(data.open, data.close),
          'High price should be >= max(open, close)'
        ))
      }

      // Low should be <= min(open, close)
      if (data.low > Math.min(data.open, data.close)) {
        discrepancies.push(this.createDiscrepancy(
          'low',
          data.source,
          data.low,
          Math.min(data.open, data.close),
          'Low price should be <= min(open, close)'
        ))
      }

      // Reasonable price variance (no > 50% intraday moves)
      const priceRange = data.high - data.low
      const avgPrice = (data.high + data.low) / 2
      const dailyVariance = priceRange / avgPrice

      if (dailyVariance > 0.5) {
        discrepancies.push(this.createDiscrepancy(
          'price_variance',
          data.source,
          dailyVariance,
          0.5,
          'Excessive daily price variance detected'
        ))
      }
    }

    // Volume validation
    if (data.volume !== undefined && data.volume < 0) {
      discrepancies.push(this.createDiscrepancy(
        'volume',
        data.source,
        data.volume,
        0,
        'Volume cannot be negative'
      ))
    }

    // Timestamp validation
    const timestampAge = Date.now() - data.timestamp
    if (timestampAge > this.thresholds.stockPrice.timestampTolerance) {
      discrepancies.push(this.createDiscrepancy(
        'timestamp',
        data.source,
        timestampAge,
        this.thresholds.stockPrice.timestampTolerance,
        'Data timestamp exceeds tolerance threshold'
      ))
    }

    // Apply custom validation rules
    for (const rule of rules) {
      if (!rule.validator(this.getFieldValue(data, rule.field), data, context)) {
        discrepancies.push(this.createDiscrepancy(
          rule.field,
          data.source,
          'failed_rule',
          'passed_rule',
          rule.message
        ))
      }
    }

    this.updateStatistics('stock_price', discrepancies.length === 0, Date.now() - startTime)

    return {
      isValid: discrepancies.length === 0,
      discrepancies,
      confidence: this.calculateConfidence(discrepancies, rules.length)
    }
  }

  /**
   * Validate unified company information
   */
  async validateCompanyInfo(
    data: UnifiedCompanyInfo,
    context?: ValidationContext
  ): Promise<ValidationResult> {
    const startTime = Date.now()
    const discrepancies: DataDiscrepancy[] = []
    const rules = this.validationRules.get('company_info') || []

    // Required fields validation
    const requiredFields = this.thresholds.companyInfo.requiredFields
    for (const field of requiredFields) {
      if (!this.hasValidValue(data, field)) {
        discrepancies.push({
          field,
          sources: { [data.source]: 'missing' },
          variance: 1.0,
          resolution: {
            strategy: 'custom',
            resolvedValue: null,
            reason: `Required field '${field}' is missing or invalid`
          }
        })
      }
    }

    // Symbol format validation
    if (data.symbol && !/^[A-Z]{1,5}(\.[A-Z]{1,2})?$/.test(data.symbol)) {
      discrepancies.push(this.createDiscrepancy(
        'symbol',
        data.source,
        data.symbol,
        'VALID_FORMAT',
        'Invalid stock symbol format'
      ))
    }

    // Market cap validation
    if (data.marketCap !== undefined && data.marketCap <= 0) {
      discrepancies.push(this.createDiscrepancy(
        'marketCap',
        data.source,
        data.marketCap,
        'positive_value',
        'Market cap must be positive'
      ))
    }

    // Employee count validation
    if (data.employees !== undefined && data.employees < 0) {
      discrepancies.push(this.createDiscrepancy(
        'employees',
        data.source,
        data.employees,
        0,
        'Employee count cannot be negative'
      ))
    }

    // Founded year validation
    const currentYear = new Date().getFullYear()
    if (data.foundedYear && (data.foundedYear < 1600 || data.foundedYear > currentYear)) {
      discrepancies.push(this.createDiscrepancy(
        'foundedYear',
        data.source,
        data.foundedYear,
        `1600-${currentYear}`,
        'Invalid founded year'
      ))
    }

    // Apply custom validation rules
    for (const rule of rules) {
      if (!rule.validator(this.getFieldValue(data, rule.field), data, context)) {
        discrepancies.push(this.createDiscrepancy(
          rule.field,
          data.source,
          'failed_rule',
          'passed_rule',
          rule.message
        ))
      }
    }

    this.updateStatistics('company_info', discrepancies.length === 0, Date.now() - startTime)

    return {
      isValid: discrepancies.length === 0,
      discrepancies,
      confidence: this.calculateConfidence(discrepancies, rules.length)
    }
  }

  /**
   * Validate technical indicator data
   */
  async validateTechnicalIndicator(
    data: UnifiedTechnicalIndicator,
    context?: ValidationContext
  ): Promise<ValidationResult> {
    const startTime = Date.now()
    const discrepancies: DataDiscrepancy[] = []
    const rules = this.validationRules.get('technical_indicator') || []

    // Required fields validation
    const requiredFields = this.thresholds.technicalIndicator.requiredFields
    for (const field of requiredFields) {
      if (!this.hasValidValue(data, field)) {
        discrepancies.push({
          field,
          sources: { [data.source]: 'missing' },
          variance: 1.0,
          resolution: {
            strategy: 'custom',
            resolvedValue: null,
            reason: `Required field '${field}' is missing or invalid`
          }
        })
      }
    }

    // Indicator-specific validation
    const indicatorName = data.indicator.toUpperCase()
    switch (indicatorName) {
      case 'RSI':
        if (typeof data.value === 'number') {
          if (data.value < 0 || data.value > 100) {
            discrepancies.push(this.createDiscrepancy(
              'value',
              data.source,
              data.value,
              '0-100',
              'RSI value must be between 0 and 100'
            ))
          }
        }
        break

      case 'MACD':
        if (typeof data.value === 'object') {
          const macdValue = data.value as { [key: string]: number }
          const requiredKeys = ['MACD', 'MACD_Signal', 'MACD_Hist']
          for (const key of requiredKeys) {
            if (!(key in macdValue) || typeof macdValue[key] !== 'number') {
              discrepancies.push(this.createDiscrepancy(
                `value.${key}`,
                data.source,
                'missing',
                'number',
                `MACD requires ${key} value`
              ))
            }
          }
        }
        break

      case 'SMA':
      case 'EMA':
        if (typeof data.value === 'number' && data.value <= 0) {
          discrepancies.push(this.createDiscrepancy(
            'value',
            data.source,
            data.value,
            'positive_value',
            'Moving average must be positive'
          ))
        }
        break
    }

    // Timestamp validation
    const timestampAge = Date.now() - data.timestamp
    if (timestampAge > this.thresholds.technicalIndicator.timestampTolerance) {
      discrepancies.push(this.createDiscrepancy(
        'timestamp',
        data.source,
        timestampAge,
        this.thresholds.technicalIndicator.timestampTolerance,
        'Indicator timestamp exceeds tolerance threshold'
      ))
    }

    // Apply custom validation rules
    for (const rule of rules) {
      if (!rule.validator(this.getFieldValue(data, rule.field), data, context)) {
        discrepancies.push(this.createDiscrepancy(
          rule.field,
          data.source,
          'failed_rule',
          'passed_rule',
          rule.message
        ))
      }
    }

    this.updateStatistics('technical_indicator', discrepancies.length === 0, Date.now() - startTime)

    return {
      isValid: discrepancies.length === 0,
      discrepancies,
      confidence: this.calculateConfidence(discrepancies, rules.length)
    }
  }

  /**
   * Validate financial statement data
   */
  async validateFinancialStatement(
    data: UnifiedFinancialStatement,
    context?: ValidationContext
  ): Promise<ValidationResult> {
    const startTime = Date.now()
    const discrepancies: DataDiscrepancy[] = []
    const rules = this.validationRules.get('financial_statement') || []

    // Required fields validation
    const requiredFields = this.thresholds.financialStatement.requiredFields
    for (const field of requiredFields) {
      if (!this.hasValidValue(data, field)) {
        discrepancies.push({
          field,
          sources: { [data.source]: 'missing' },
          variance: 1.0,
          resolution: {
            strategy: 'custom',
            resolvedValue: null,
            reason: `Required field '${field}' is missing or invalid`
          }
        })
      }
    }

    // Fiscal year validation
    const currentYear = new Date().getFullYear()
    if (data.fiscalYear && (data.fiscalYear < 1900 || data.fiscalYear > currentYear + 1)) {
      discrepancies.push(this.createDiscrepancy(
        'fiscalYear',
        data.source,
        data.fiscalYear,
        `1900-${currentYear + 1}`,
        'Fiscal year outside reasonable range'
      ))
    }

    // Fiscal quarter validation
    if (data.fiscalQuarter && (data.fiscalQuarter < 1 || data.fiscalQuarter > 4)) {
      discrepancies.push(this.createDiscrepancy(
        'fiscalQuarter',
        data.source,
        data.fiscalQuarter,
        '1-4',
        'Fiscal quarter must be between 1 and 4'
      ))
    }

    // Period consistency validation
    if (data.period === 'quarterly' && !data.fiscalQuarter) {
      discrepancies.push(this.createDiscrepancy(
        'fiscalQuarter',
        data.source,
        'missing',
        'required',
        'Quarterly period requires fiscal quarter'
      ))
    }

    // Financial metrics validation
    const financialFields = ['revenue', 'netIncome', 'totalAssets', 'totalLiabilities', 'totalEquity']
    financialFields.forEach(field => {
      const value = this.getFieldValue(data, field)
      if (value !== undefined && value < 0 && field !== 'netIncome') {
        // Net income can be negative (losses), others typically should not be
        discrepancies.push(this.createDiscrepancy(
          field,
          data.source,
          value,
          'non-negative',
          `${field} should typically be non-negative`
        ))
      }
    })

    // Balance sheet equation validation (Assets = Liabilities + Equity)
    if (data.totalAssets && data.totalLiabilities && data.totalEquity) {
      const calculatedAssets = data.totalLiabilities + data.totalEquity
      const variance = Math.abs((data.totalAssets - calculatedAssets) / data.totalAssets)

      if (variance > this.thresholds.financialStatement.revenueVariance) {
        discrepancies.push(this.createDiscrepancy(
          'balance_sheet_equation',
          data.source,
          variance,
          this.thresholds.financialStatement.revenueVariance,
          'Balance sheet equation (Assets = Liabilities + Equity) does not balance'
        ))
      }
    }

    // Revenue vs net income relationship
    if (data.revenue && data.netIncome && data.revenue > 0) {
      const profitMargin = data.netIncome / data.revenue
      // Extreme profit margins might indicate data issues
      if (profitMargin > 1 || profitMargin < -2) {
        discrepancies.push(this.createDiscrepancy(
          'profit_margin',
          data.source,
          profitMargin,
          '-2 to 1',
          'Unusual profit margin may indicate data quality issues'
        ))
      }
    }

    // EPS validation
    if (data.eps && data.netIncome && Math.abs(data.eps) > Math.abs(data.netIncome)) {
      // EPS should generally be less than total net income
      discrepancies.push(this.createDiscrepancy(
        'eps',
        data.source,
        Math.abs(data.eps),
        Math.abs(data.netIncome),
        'EPS appears unusually high relative to net income'
      ))
    }

    // Cash flow validation
    if (data.operatingCashFlow !== undefined && data.freeCashFlow !== undefined) {
      if (data.freeCashFlow > data.operatingCashFlow) {
        discrepancies.push(this.createDiscrepancy(
          'free_cash_flow',
          data.source,
          data.freeCashFlow,
          data.operatingCashFlow,
          'Free cash flow should not exceed operating cash flow'
        ))
      }
    }

    // Apply custom validation rules
    for (const rule of rules) {
      if (!rule.validator(this.getFieldValue(data, rule.field), data, context)) {
        discrepancies.push(this.createDiscrepancy(
          rule.field,
          data.source,
          'failed_rule',
          'passed_rule',
          rule.message
        ))
      }
    }

    this.updateStatistics('financial_statement', discrepancies.length === 0, Date.now() - startTime)

    return {
      isValid: discrepancies.length === 0,
      discrepancies,
      confidence: this.calculateConfidence(discrepancies, rules.length)
    }
  }

  /**
   * Validate news items array
   */
  async validateNews(
    data: UnifiedNewsItem[],
    context?: ValidationContext
  ): Promise<ValidationResult> {
    const startTime = Date.now()
    const discrepancies: DataDiscrepancy[] = []
    const rules = this.validationRules.get('news') || []

    if (!Array.isArray(data)) {
      return {
        isValid: false,
        discrepancies: [{
          field: 'data',
          sources: { unknown: 'invalid_type' },
          variance: 1.0,
          resolution: {
            strategy: 'custom',
            resolvedValue: null,
            reason: 'News data must be an array'
          }
        }],
        confidence: 0
      }
    }

    // Validate each news item
    for (let i = 0; i < data.length; i++) {
      const item = data[i]
      const itemPrefix = `item[${i}]`

      // Required fields validation
      const requiredFields = this.thresholds.newsItem.requiredFields
      for (const field of requiredFields) {
        if (!this.hasValidValue(item, field)) {
          discrepancies.push({
            field: `${itemPrefix}.${field}`,
            sources: { [item.source]: 'missing' },
            variance: 1.0,
            resolution: {
              strategy: 'custom',
              resolvedValue: null,
              reason: `Required field '${field}' is missing in news item ${i}`
            }
          })
        }
      }

      // URL validation
      if (item.url && !this.isValidUrl(item.url)) {
        discrepancies.push(this.createDiscrepancy(
          `${itemPrefix}.url`,
          item.source,
          item.url,
          'valid_url',
          'Invalid URL format'
        ))
      }

      // Timestamp validation
      const timestampAge = Date.now() - item.publishedAt
      if (timestampAge > this.thresholds.newsItem.timestampTolerance) {
        discrepancies.push(this.createDiscrepancy(
          `${itemPrefix}.publishedAt`,
          item.source,
          timestampAge,
          this.thresholds.newsItem.timestampTolerance,
          'News timestamp exceeds tolerance threshold'
        ))
      }

      // Sentiment validation
      if (item.sentiment) {
        if (item.sentiment.score < -1 || item.sentiment.score > 1) {
          discrepancies.push(this.createDiscrepancy(
            `${itemPrefix}.sentiment.score`,
            item.source,
            item.sentiment.score,
            '-1 to 1',
            'Sentiment score must be between -1 and 1'
          ))
        }

        const validLabels = ['positive', 'negative', 'neutral']
        if (!validLabels.includes(item.sentiment.label)) {
          discrepancies.push(this.createDiscrepancy(
            `${itemPrefix}.sentiment.label`,
            item.source,
            item.sentiment.label,
            validLabels.join('|'),
            'Invalid sentiment label'
          ))
        }
      }

      // Apply custom validation rules
      for (const rule of rules) {
        if (!rule.validator(this.getFieldValue(item, rule.field), item, context)) {
          discrepancies.push(this.createDiscrepancy(
            `${itemPrefix}.${rule.field}`,
            item.source,
            'failed_rule',
            'passed_rule',
            rule.message
          ))
        }
      }
    }

    this.updateStatistics('news', discrepancies.length === 0, Date.now() - startTime)

    return {
      isValid: discrepancies.length === 0,
      discrepancies,
      confidence: this.calculateConfidence(discrepancies, rules.length * data.length)
    }
  }

  /**
   * Add custom validation rule for a data type
   */
  addValidationRule(dataType: string, rule: ValidationRule): void {
    if (!this.validationRules.has(dataType)) {
      this.validationRules.set(dataType, [])
    }
    this.validationRules.get(dataType)!.push(rule)
  }

  /**
   * Remove validation rule
   */
  removeValidationRule(dataType: string, ruleName: string): boolean {
    const rules = this.validationRules.get(dataType)
    if (!rules) return false

    const index = rules.findIndex(rule => rule.name === ruleName)
    if (index === -1) return false

    rules.splice(index, 1)
    return true
  }

  /**
   * Update validation thresholds
   */
  updateThresholds(newThresholds: ValidationThresholds): void {
    this.thresholds = { ...this.thresholds, ...newThresholds }
  }

  /**
   * Get validation statistics
   */
  getStatistics(): ValidationStatistics {
    return { ...this.statistics }
  }

  /**
   * Reset statistics
   */
  reset(): void {
    this.statistics = this.initializeStatistics()
  }

  /**
   * Initialize default validation rules
   */
  private initializeValidationRules(): void {
    // Stock price rules
    this.validationRules.set('stock_price', [
      {
        name: 'positive_prices',
        field: 'close',
        validator: (value) => typeof value === 'number' && value > 0,
        severity: 'error',
        message: 'Stock prices must be positive numbers'
      },
      {
        name: 'reasonable_volume',
        field: 'volume',
        validator: (value, data) => !value || (value >= 0 && value < 1e12),
        severity: 'warning',
        message: 'Volume appears unreasonably high'
      }
    ])

    // Company info rules
    this.validationRules.set('company_info', [
      {
        name: 'valid_exchange',
        field: 'exchange',
        validator: (value) => !value || /^[A-Z]{2,10}$/.test(value),
        severity: 'warning',
        message: 'Exchange code format may be invalid'
      }
    ])

    // Technical indicator rules
    this.validationRules.set('technical_indicator', [
      {
        name: 'recent_timestamp',
        field: 'timestamp',
        validator: (value) => (Date.now() - value) < 86400000, // 24 hours
        severity: 'warning',
        message: 'Technical indicator data is more than 24 hours old'
      }
    ])

    // Financial statement rules
    this.validationRules.set('financial_statement', [
      {
        name: 'positive_revenue',
        field: 'revenue',
        validator: (value) => !value || value >= 0,
        severity: 'warning',
        message: 'Revenue should typically be non-negative'
      },
      {
        name: 'reasonable_eps',
        field: 'eps',
        validator: (value, data) => !value || !data.revenue || Math.abs(value) <= data.revenue,
        severity: 'warning',
        message: 'EPS appears unreasonably high relative to revenue'
      }
    ])

    // News rules
    this.validationRules.set('news', [
      {
        name: 'title_length',
        field: 'title',
        validator: (value) => typeof value === 'string' && value.length > 5 && value.length < 200,
        severity: 'warning',
        message: 'News title length appears unusual'
      }
    ])
  }

  /**
   * Initialize statistics object
   */
  private initializeStatistics(): ValidationStatistics {
    return {
      totalValidations: 0,
      passedValidations: 0,
      failedValidations: 0,
      validationsByType: {},
      commonFailures: [],
      averageValidationTime: 0
    }
  }

  /**
   * Update validation statistics
   */
  private updateStatistics(dataType: string, passed: boolean, processingTime: number): void {
    this.statistics.totalValidations++
    if (passed) {
      this.statistics.passedValidations++
    } else {
      this.statistics.failedValidations++
    }

    if (!this.statistics.validationsByType[dataType]) {
      this.statistics.validationsByType[dataType] = { passed: 0, failed: 0 }
    }

    if (passed) {
      this.statistics.validationsByType[dataType].passed++
    } else {
      this.statistics.validationsByType[dataType].failed++
    }

    // Update average processing time
    this.statistics.averageValidationTime =
      (this.statistics.averageValidationTime * (this.statistics.totalValidations - 1) + processingTime) /
      this.statistics.totalValidations
  }

  /**
   * Check if object has valid value for field
   */
  private hasValidValue(obj: any, field: string): boolean {
    const value = this.getFieldValue(obj, field)
    return value !== undefined && value !== null && value !== ''
  }

  /**
   * Get field value with dot notation support
   */
  private getFieldValue(obj: any, field: string): any {
    const keys = field.split('.')
    let current = obj

    for (const key of keys) {
      if (current === null || current === undefined || !(key in current)) {
        return undefined
      }
      current = current[key]
    }

    return current
  }

  /**
   * Create a data discrepancy object
   */
  private createDiscrepancy(
    field: string,
    source: string,
    actualValue: any,
    expectedValue: any,
    reason: string
  ): DataDiscrepancy {
    return {
      field,
      sources: { [source]: actualValue },
      variance: this.calculateVariance(actualValue, expectedValue),
      resolution: {
        strategy: 'custom',
        resolvedValue: expectedValue,
        reason
      }
    }
  }

  /**
   * Calculate variance between actual and expected values
   */
  private calculateVariance(actual: any, expected: any): number {
    if (typeof actual === 'number' && typeof expected === 'number') {
      return Math.abs((actual - expected) / expected)
    }
    return actual === expected ? 0 : 1
  }

  /**
   * Calculate validation confidence score
   */
  private calculateConfidence(discrepancies: DataDiscrepancy[], totalRules: number): number {
    if (totalRules === 0) return 1.0
    const errorCount = discrepancies.filter(d =>
      d.resolution.reason.includes('error') ||
      d.resolution.reason.includes('required') ||
      d.resolution.reason.includes('invalid')
    ).length

    return Math.max(0, 1 - (errorCount / totalRules))
  }

  /**
   * Validate URL format
   */
  private isValidUrl(url: string): boolean {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }
}