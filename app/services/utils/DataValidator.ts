/**
 * Data Validation Utility
 *
 * Provides comprehensive validation for financial data to prevent
 * invalid values (0, null, undefined) from causing scoring errors.
 *
 * CRITICAL: Replaces `|| 0` pattern with proper null handling
 */

export interface ValidationResult<T> {
  value: T | null
  isValid: boolean
  error?: string
}

export class DataValidator {
  /**
   * Validate market cap
   * MSFT bug fix: marketCap of 0 is invalid (should be ~$3T)
   */
  static validateMarketCap(marketCap: any): ValidationResult<number> {
    if (typeof marketCap !== 'number' || marketCap <= 0 || !isFinite(marketCap)) {
      return {
        value: null,
        isValid: false,
        error: `Invalid market cap: ${marketCap} (must be positive number)`
      }
    }

    // Sanity check: market cap should be at least $1M for public companies
    if (marketCap < 1_000_000) {
      return {
        value: null,
        isValid: false,
        error: `Market cap too low: ${marketCap} (minimum $1M expected)`
      }
    }

    return { value: marketCap, isValid: true }
  }

  /**
   * Validate stock price
   * Price must be positive and reasonable
   */
  static validatePrice(price: any): ValidationResult<number> {
    if (typeof price !== 'number' || price <= 0 || !isFinite(price)) {
      return {
        value: null,
        isValid: false,
        error: `Invalid price: ${price} (must be positive number)`
      }
    }

    // Sanity check: price should be between $0.01 and $100,000
    if (price < 0.01 || price > 100_000) {
      return {
        value: null,
        isValid: false,
        error: `Price out of range: ${price} (expected $0.01-$100,000)`
      }
    }

    return { value: price, isValid: true }
  }

  /**
   * Validate implied volatility
   * MSFT bug fix: IV of 0% is impossible for options
   */
  static validateImpliedVolatility(iv: any): ValidationResult<number> {
    if (typeof iv !== 'number' || !isFinite(iv)) {
      return {
        value: null,
        isValid: false,
        error: `Invalid IV: ${iv} (must be number)`
      }
    }

    // IV of exactly 0 is impossible - indicates missing data
    if (iv === 0) {
      return {
        value: null,
        isValid: false,
        error: 'IV of 0% impossible - missing data'
      }
    }

    // Sanity check: IV should be 0.1% to 200% (0.001 to 2.0)
    if (iv < 0.001 || iv > 2.0) {
      return {
        value: null,
        isValid: false,
        error: `IV out of range: ${iv * 100}% (expected 0.1%-200%)`
      }
    }

    return { value: iv, isValid: true }
  }

  /**
   * Validate P/E ratio
   */
  static validatePERatio(pe: any): ValidationResult<number> {
    if (typeof pe !== 'number' || !isFinite(pe)) {
      return { value: null, isValid: false, error: 'Invalid P/E type' }
    }

    // Negative P/E is valid (negative earnings) but handle separately
    if (pe < 0) {
      return { value: null, isValid: false, error: 'Negative P/E' }
    }

    // P/E of 0 is invalid
    if (pe === 0) {
      return { value: null, isValid: false, error: 'P/E of 0 invalid' }
    }

    // Sanity check: P/E should be 0.1 to 500
    if (pe < 0.1 || pe > 500) {
      return { value: null, isValid: false, error: `P/E out of range: ${pe}` }
    }

    return { value: pe, isValid: true }
  }

  /**
   * Validate volume
   */
  static validateVolume(volume: any): ValidationResult<number> {
    if (typeof volume !== 'number' || !isFinite(volume) || volume < 0) {
      return { value: null, isValid: false, error: 'Invalid volume' }
    }

    // Volume of 0 is technically valid (no trading) but flag it
    if (volume === 0) {
      return { value: 0, isValid: true, error: 'Zero volume - low liquidity' }
    }

    return { value: volume, isValid: true }
  }

  /**
   * Validate growth rate (earnings, revenue, etc.)
   */
  static validateGrowthRate(growth: any): ValidationResult<number> {
    if (typeof growth !== 'number' || !isFinite(growth)) {
      return { value: null, isValid: false, error: 'Invalid growth rate' }
    }

    // Sanity check: growth between -100% and +1000% (-1.0 to 10.0)
    if (growth < -1.0 || growth > 10.0) {
      return { value: null, isValid: false, error: `Growth out of range: ${growth * 100}%` }
    }

    return { value: growth, isValid: true }
  }

  /**
   * Validate ratio (generic positive ratio like P/B, debt/equity)
   */
  static validateRatio(ratio: any, name: string = 'ratio'): ValidationResult<number> {
    if (typeof ratio !== 'number' || !isFinite(ratio)) {
      return { value: null, isValid: false, error: `Invalid ${name}` }
    }

    if (ratio < 0) {
      return { value: null, isValid: false, error: `Negative ${name}` }
    }

    // Ratio of 0 might be valid but flag it
    if (ratio === 0) {
      return { value: null, isValid: false, error: `${name} of 0 - check data` }
    }

    return { value: ratio, isValid: true }
  }

  /**
   * Get numeric value with validation or return null
   * Replaces the dangerous `|| 0` pattern
   */
  static getValidNumber(
    value: any,
    validator?: (v: number) => ValidationResult<number>
  ): number | null {
    if (value === null || value === undefined) {
      return null
    }

    const num = typeof value === 'number' ? value : Number(value)

    if (!isFinite(num)) {
      return null
    }

    if (validator) {
      const result = validator(num)
      return result.isValid ? result.value : null
    }

    return num
  }

  /**
   * Calculate data completeness percentage
   * Used for confidence scoring
   */
  static calculateDataCompleteness(
    data: Record<string, any>,
    requiredFields: string[]
  ): { completeness: number; missingFields: string[]; invalidFields: string[] } {
    const missingFields: string[] = []
    const invalidFields: string[] = []
    let validCount = 0

    for (const field of requiredFields) {
      const value = data[field]

      if (value === null || value === undefined) {
        missingFields.push(field)
      } else if (typeof value === 'number' && (!isFinite(value) || value === 0)) {
        invalidFields.push(field)
      } else {
        validCount++
      }
    }

    const completeness = requiredFields.length > 0
      ? validCount / requiredFields.length
      : 0

    return { completeness, missingFields, invalidFields }
  }
}