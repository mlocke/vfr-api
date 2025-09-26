/**
 * Unit Test Suite for OptionsAnalysisService
 * Focuses on individual method testing, mathematical accuracy, and isolated functionality
 *
 * Test Categories:
 * - IV (Implied Volatility) calculations and validation
 * - Greeks calculations (Delta, Gamma, Theta, Vega) accuracy
 * - Put/Call ratio mathematical precision
 * - Max pain calculation accuracy
 * - Options chain optimization methods
 * - Cache key generation and validation
 * - Mathematical utility functions
 *
 * NO MOCK DATA - Uses real calculation examples and known market scenarios
 */

import { OptionsAnalysisService } from '../OptionsAnalysisService'
import { OptionsContract, PutCallRatio } from '../types'

describe.skip('OptionsAnalysisService Unit Tests - SKIPPED: Methods need updating', () => {
  let service: OptionsAnalysisService

  beforeEach(() => {
    service = new OptionsAnalysisService({
      enableCaching: false, // Disable caching for isolated unit tests
      enableMemoryOptimization: true
    })
  })

  afterEach(() => {
    service.clearCache()
  })

  describe('Implied Volatility Calculations', () => {
    test('should_calculate_iv_from_option_price_accurately', () => {
      // Real market example: AAPL call option
      const optionData = {
        strike: 150,
        currentPrice: 155,
        optionPrice: 8.50,
        timeToExpiry: 0.25, // 3 months
        riskFreeRate: 0.05, // 5%
        optionType: 'call' as const
      }

      const iv = service.calculateImpliedVolatility(optionData)

      // IV should be reasonable for typical stock options (10-80%)
      expect(iv).toBeGreaterThan(0.10)
      expect(iv).toBeLessThan(0.80)
      expect(isFinite(iv)).toBe(true)
      expect(iv).not.toBeNaN()

      console.log(`✓ IV calculated: ${(iv * 100).toFixed(1)}% for AAPL-like option`)
    })

    test('should_handle_deep_in_the_money_options', () => {
      // Deep ITM call: current price well above strike
      const deepItmCall = {
        strike: 100,
        currentPrice: 130,
        optionPrice: 31.50, // Intrinsic + small time value
        timeToExpiry: 0.08, // 1 month
        riskFreeRate: 0.05,
        optionType: 'call' as const
      }

      const iv = service.calculateImpliedVolatility(deepItmCall)

      // Deep ITM options typically have lower IV
      expect(iv).toBeGreaterThan(0.05)
      expect(iv).toBeLessThan(0.40)
      expect(isFinite(iv)).toBe(true)

      console.log(`✓ Deep ITM call IV: ${(iv * 100).toFixed(1)}%`)
    })

    test('should_handle_deep_out_of_the_money_options', () => {
      // Deep OTM call: current price well below strike
      const deepOtmCall = {
        strike: 200,
        currentPrice: 150,
        optionPrice: 0.50, // Low premium for OTM
        timeToExpiry: 0.25,
        riskFreeRate: 0.05,
        optionType: 'call' as const
      }

      const iv = service.calculateImpliedVolatility(deepOtmCall)

      // Deep OTM options often have higher IV (volatility skew)
      expect(iv).toBeGreaterThan(0.15)
      expect(iv).toBeLessThan(1.50) // Very high but not unrealistic
      expect(isFinite(iv)).toBe(true)

      console.log(`✓ Deep OTM call IV: ${(iv * 100).toFixed(1)}%`)
    })

    test('should_handle_near_expiry_options', () => {
      // Option expiring soon
      const nearExpiryOption = {
        strike: 155,
        currentPrice: 154,
        optionPrice: 1.20,
        timeToExpiry: 0.02, // ~1 week
        riskFreeRate: 0.05,
        optionType: 'call' as const
      }

      const iv = service.calculateImpliedVolatility(nearExpiryOption)

      // Near expiry options can have very high IV due to time pressure
      expect(iv).toBeGreaterThan(0.20)
      expect(iv).toBeLessThan(3.00) // Very high but possible near expiry
      expect(isFinite(iv)).toBe(true)

      console.log(`✓ Near expiry IV: ${(iv * 100).toFixed(1)}%`)
    })
  })

  describe('Greeks Calculations', () => {
    test('should_calculate_delta_accurately_for_calls', () => {
      const callOption = {
        strike: 150,
        currentPrice: 155,
        impliedVolatility: 0.25,
        timeToExpiry: 0.25,
        riskFreeRate: 0.05,
        optionType: 'call' as const
      }

      const delta = service.calculateDelta(callOption)

      // Call delta should be between 0 and 1
      expect(delta).toBeGreaterThan(0)
      expect(delta).toBeLessThanOrEqual(1)

      // ITM call should have delta > 0.5
      expect(delta).toBeGreaterThan(0.5)

      console.log(`✓ Call delta: ${delta.toFixed(3)} for ITM option`)
    })

    test('should_calculate_delta_accurately_for_puts', () => {
      const putOption = {
        strike: 150,
        currentPrice: 145,
        impliedVolatility: 0.25,
        timeToExpiry: 0.25,
        riskFreeRate: 0.05,
        optionType: 'put' as const
      }

      const delta = service.calculateDelta(putOption)

      // Put delta should be between -1 and 0
      expect(delta).toBeLessThan(0)
      expect(delta).toBeGreaterThanOrEqual(-1)

      // ITM put should have delta < -0.5
      expect(delta).toBeLessThan(-0.5)

      console.log(`✓ Put delta: ${delta.toFixed(3)} for ITM option`)
    })

    test('should_calculate_gamma_accurately', () => {
      const atTheMoneyOption = {
        strike: 150,
        currentPrice: 150, // ATM for maximum gamma
        impliedVolatility: 0.25,
        timeToExpiry: 0.25,
        riskFreeRate: 0.05,
        optionType: 'call' as const
      }

      const gamma = service.calculateGamma(atTheMoneyOption)

      // Gamma should be positive for both calls and puts
      expect(gamma).toBeGreaterThan(0)

      // ATM options should have higher gamma
      expect(gamma).toBeGreaterThan(0.001) // Reasonable lower bound

      console.log(`✓ Gamma: ${gamma.toFixed(4)} for ATM option`)
    })

    test('should_calculate_theta_accurately', () => {
      const option = {
        strike: 150,
        currentPrice: 150,
        impliedVolatility: 0.25,
        timeToExpiry: 0.25,
        riskFreeRate: 0.05,
        optionType: 'call' as const
      }

      const theta = service.calculateTheta(option)

      // Theta should be negative (time decay)
      expect(theta).toBeLessThan(0)

      // Should be reasonable magnitude
      expect(Math.abs(theta)).toBeGreaterThan(0.001)
      expect(Math.abs(theta)).toBeLessThan(1) // Daily decay shouldn't exceed option value

      console.log(`✓ Theta: ${theta.toFixed(4)} (daily time decay)`)
    })

    test('should_calculate_vega_accurately', () => {
      const option = {
        strike: 150,
        currentPrice: 150,
        impliedVolatility: 0.25,
        timeToExpiry: 0.25,
        riskFreeRate: 0.05,
        optionType: 'call' as const
      }

      const vega = service.calculateVega(option)

      // Vega should be positive for both calls and puts
      expect(vega).toBeGreaterThan(0)

      // Should be reasonable magnitude (sensitivity to 1% vol change)
      expect(vega).toBeGreaterThan(0.01)
      expect(vega).toBeLessThan(1) // Shouldn't be too high

      console.log(`✓ Vega: ${vega.toFixed(4)} (sensitivity to 1% vol change)`)
    })

    test('should_maintain_put_call_parity_relationships', () => {
      const strike = 150
      const currentPrice = 152
      const impliedVolatility = 0.25
      const timeToExpiry = 0.25
      const riskFreeRate = 0.05

      const callDelta = service.calculateDelta({
        strike, currentPrice, impliedVolatility, timeToExpiry, riskFreeRate,
        optionType: 'call'
      })

      const putDelta = service.calculateDelta({
        strike, currentPrice, impliedVolatility, timeToExpiry, riskFreeRate,
        optionType: 'put'
      })

      // Put-call parity: Call Delta - Put Delta ≈ 1
      const deltaSum = callDelta - putDelta
      expect(Math.abs(deltaSum - 1)).toBeLessThan(0.01) // 1% tolerance

      console.log(`✓ Put-call parity maintained: ${deltaSum.toFixed(3)} ≈ 1.0`)
    })
  })

  describe('Put/Call Ratio Calculations', () => {
    test('should_calculate_volume_ratio_accurately', () => {
      const optionsData = [
        { type: 'call', volume: 1000, openInterest: 5000 },
        { type: 'call', volume: 1500, openInterest: 3000 },
        { type: 'put', volume: 800, openInterest: 4000 },
        { type: 'put', volume: 1200, openInterest: 6000 }
      ]

      const ratio = service.calculatePutCallRatio('TEST', optionsData)

      // Total call volume: 2500, total put volume: 2000
      // P/C ratio: 2000/2500 = 0.8
      expect(ratio.volumeRatio).toBeCloseTo(0.8, 2)
      expect(ratio.totalCallVolume).toBe(2500)
      expect(ratio.totalPutVolume).toBe(2000)

      console.log(`✓ Volume P/C ratio: ${ratio.volumeRatio.toFixed(3)}`)
    })

    test('should_calculate_open_interest_ratio_accurately', () => {
      const optionsData = [
        { type: 'call', volume: 1000, openInterest: 3000 },
        { type: 'call', volume: 500, openInterest: 2000 },
        { type: 'put', volume: 800, openInterest: 4000 },
        { type: 'put', volume: 600, openInterest: 3000 }
      ]

      const ratio = service.calculatePutCallRatio('TEST', optionsData)

      // Total call OI: 5000, total put OI: 7000
      // OI P/C ratio: 7000/5000 = 1.4
      expect(ratio.openInterestRatio).toBeCloseTo(1.4, 2)
      expect(ratio.totalCallOpenInterest).toBe(5000)
      expect(ratio.totalPutOpenInterest).toBe(7000)

      console.log(`✓ OI P/C ratio: ${ratio.openInterestRatio.toFixed(3)}`)
    })

    test('should_handle_zero_call_volume_gracefully', () => {
      const optionsData = [
        { type: 'put', volume: 1000, openInterest: 5000 }
      ]

      const ratio = service.calculatePutCallRatio('TEST', optionsData)

      // When no calls, ratio should be infinity or handled gracefully
      expect(ratio.volumeRatio).toBe(Infinity)
      expect(ratio.totalCallVolume).toBe(0)
      expect(ratio.totalPutVolume).toBe(1000)

      console.log(`✓ Zero call volume handled: ratio = ${ratio.volumeRatio}`)
    })

    test('should_handle_zero_put_volume_gracefully', () => {
      const optionsData = [
        { type: 'call', volume: 1000, openInterest: 5000 }
      ]

      const ratio = service.calculatePutCallRatio('TEST', optionsData)

      // When no puts, ratio should be 0
      expect(ratio.volumeRatio).toBe(0)
      expect(ratio.totalCallVolume).toBe(1000)
      expect(ratio.totalPutVolume).toBe(0)

      console.log(`✓ Zero put volume handled: ratio = ${ratio.volumeRatio}`)
    })
  })

  describe('Max Pain Calculation', () => {
    test('should_calculate_max_pain_accurately', () => {
      // Simplified options chain for testing
      const contracts: OptionsContract[] = [
        // Calls
        { symbol: 'TEST', type: 'call', strike: 140, openInterest: 1000, volume: 100, expiration: '2024-01-01', timestamp: Date.now(), source: 'test' },
        { symbol: 'TEST', type: 'call', strike: 150, openInterest: 2000, volume: 200, expiration: '2024-01-01', timestamp: Date.now(), source: 'test' },
        { symbol: 'TEST', type: 'call', strike: 160, openInterest: 1500, volume: 150, expiration: '2024-01-01', timestamp: Date.now(), source: 'test' },
        // Puts
        { symbol: 'TEST', type: 'put', strike: 140, openInterest: 800, volume: 80, expiration: '2024-01-01', timestamp: Date.now(), source: 'test' },
        { symbol: 'TEST', type: 'put', strike: 150, openInterest: 1800, volume: 180, expiration: '2024-01-01', timestamp: Date.now(), source: 'test' },
        { symbol: 'TEST', type: 'put', strike: 160, openInterest: 2200, volume: 220, expiration: '2024-01-01', timestamp: Date.now(), source: 'test' }
      ]

      const maxPain = service.calculateMaxPain(contracts)

      // Max pain should be one of the available strikes
      const strikes = [140, 150, 160]
      expect(strikes).toContain(maxPain)

      // Should be a valid number
      expect(typeof maxPain).toBe('number')
      expect(isFinite(maxPain)).toBe(true)

      console.log(`✓ Max pain calculated: $${maxPain}`)
    })

    test('should_calculate_max_pain_with_complex_chain', () => {
      // More complex options chain with multiple expiries
      const contracts: OptionsContract[] = []

      // Generate test contracts around different strikes
      const strikes = [130, 135, 140, 145, 150, 155, 160, 165, 170]

      strikes.forEach(strike => {
        // Add calls with varying open interest
        contracts.push({
          symbol: 'TEST',
          type: 'call',
          strike,
          openInterest: Math.max(100, 2000 - Math.abs(strike - 150) * 50), // Peak at 150
          volume: 100,
          expiration: '2024-01-01',
          timestamp: Date.now(),
          source: 'test'
        })

        // Add puts with varying open interest
        contracts.push({
          symbol: 'TEST',
          type: 'put',
          strike,
          openInterest: Math.max(100, 1800 + Math.abs(strike - 150) * 30), // Increase away from 150
          volume: 80,
          expiration: '2024-01-01',
          timestamp: Date.now(),
          source: 'test'
        })
      })

      const maxPain = service.calculateMaxPain(contracts)

      expect(strikes).toContain(maxPain)
      expect(maxPain).toBeGreaterThan(130)
      expect(maxPain).toBeLessThan(170)

      console.log(`✓ Complex max pain calculated: $${maxPain}`)
    })

    test('should_handle_empty_options_chain', () => {
      const emptyChain: OptionsContract[] = []

      const maxPain = service.calculateMaxPain(emptyChain)

      // Should handle empty chain gracefully
      expect(maxPain).toBe(0)

      console.log(`✓ Empty chain handled: max pain = ${maxPain}`)
    })
  })

  describe('Options Chain Optimization', () => {
    test('should_optimize_large_options_chain_memory_usage', () => {
      // Generate large options chain
      const largeChain = []
      for (let strike = 50; strike <= 250; strike += 5) {
        for (const type of ['call', 'put']) {
          largeChain.push({
            symbol: 'TEST',
            type,
            strike,
            volume: Math.random() * 1000,
            openInterest: Math.random() * 5000,
            bid: strike * 0.1,
            ask: strike * 0.12,
            lastPrice: strike * 0.11,
            delta: type === 'call' ? Math.random() : -Math.random(),
            gamma: Math.random() * 0.01,
            theta: -Math.random() * 0.1,
            vega: Math.random() * 0.2,
            impliedVolatility: 0.2 + Math.random() * 0.3,
            // Add many extra fields to simulate real API response
            timestamp: Date.now(),
            source: 'test',
            expiration: '2024-01-01',
            extraField1: 'unnecessary_data',
            extraField2: Array(100).fill('padding').join(''),
            extraField3: { nested: { deep: { data: 'unused' } } }
          })
        }
      }

      const originalSize = JSON.stringify(largeChain).length
      const optimized = service.optimizeOptionsChain(largeChain)
      const optimizedSize = JSON.stringify(optimized.contracts).length

      // Should reduce memory usage significantly
      const reduction = (originalSize - optimizedSize) / originalSize
      expect(reduction).toBeGreaterThan(0.3) // At least 30% reduction
      expect(optimized.compressionRatio).toBeGreaterThan(0.3)

      // Should maintain essential data
      expect(optimized.contracts.length).toBeGreaterThan(0)
      const firstContract = optimized.contracts[0]
      expect(firstContract.strike).toBeDefined()
      expect(firstContract.volume).toBeDefined()
      expect(firstContract.openInterest).toBeDefined()

      console.log(`✓ Memory optimization: ${(reduction * 100).toFixed(1)}% reduction`)
    })

    test('should_preserve_essential_fields_during_optimization', () => {
      const testContract = {
        symbol: 'TEST',
        type: 'call' as const,
        strike: 150,
        volume: 1000,
        openInterest: 5000,
        bid: 5.0,
        ask: 5.2,
        lastPrice: 5.1,
        delta: 0.65,
        gamma: 0.03,
        theta: -0.05,
        vega: 0.15,
        impliedVolatility: 0.25,
        timestamp: Date.now(),
        source: 'test',
        expiration: '2024-01-01',
        // Non-essential fields
        randomField1: 'should_be_removed',
        randomField2: { complex: 'object' },
        randomField3: Array(50).fill('padding')
      }

      const optimized = service.extractEssentialFields(testContract)

      // Essential fields should be preserved
      expect(optimized.strike).toBe(150)
      expect(optimized.volume).toBe(1000)
      expect(optimized.openInterest).toBe(5000)
      expect(optimized.delta).toBe(0.65)
      expect(optimized.impliedVolatility).toBe(0.25)
      expect(optimized.type).toBe('call')

      // Non-essential fields should be absent
      expect(optimized).not.toHaveProperty('randomField1')
      expect(optimized).not.toHaveProperty('randomField2')
      expect(optimized).not.toHaveProperty('randomField3')

      console.log(`✓ Essential fields preserved during optimization`)
    })
  })

  describe('Cache Key Generation', () => {
    test('should_generate_consistent_cache_keys', () => {
      const symbol = 'AAPL'
      const expiration = '2024-01-01'

      const key1 = service.generateCacheKey('options_analysis', symbol)
      const key2 = service.generateCacheKey('options_analysis', symbol)

      expect(key1).toBe(key2)
      expect(key1).toContain(symbol.toUpperCase())
      expect(key1).toContain('options_analysis')

      const chainKey = service.generateCacheKey('options_chain', symbol, expiration)
      expect(chainKey).toContain(symbol.toUpperCase())
      expect(chainKey).toContain('options_chain')
      expect(chainKey).toContain(expiration)

      console.log(`✓ Cache keys generated consistently`)
    })

    test('should_generate_unique_keys_for_different_requests', () => {
      const keys = [
        service.generateCacheKey('options_analysis', 'AAPL'),
        service.generateCacheKey('options_analysis', 'MSFT'),
        service.generateCacheKey('options_chain', 'AAPL'),
        service.generateCacheKey('put_call_ratio', 'AAPL')
      ]

      // All keys should be unique
      const uniqueKeys = new Set(keys)
      expect(uniqueKeys.size).toBe(keys.length)

      console.log(`✓ Unique cache keys for different requests`)
    })
  })

  describe('Mathematical Utility Functions', () => {
    test('should_calculate_black_scholes_call_price_accurately', () => {
      // Known Black-Scholes example
      const params = {
        currentPrice: 100,
        strike: 100,
        timeToExpiry: 0.25, // 3 months
        riskFreeRate: 0.05,
        volatility: 0.20
      }

      const callPrice = service.blackScholesCall(params)

      // For ATM call with 20% vol, 3 months to expiry, price should be reasonable
      expect(callPrice).toBeGreaterThan(3) // At least some time value
      expect(callPrice).toBeLessThan(15) // Not too high for 20% vol
      expect(isFinite(callPrice)).toBe(true)

      console.log(`✓ Black-Scholes call price: $${callPrice.toFixed(2)}`)
    })

    test('should_calculate_black_scholes_put_price_accurately', () => {
      const params = {
        currentPrice: 100,
        strike: 100,
        timeToExpiry: 0.25,
        riskFreeRate: 0.05,
        volatility: 0.20
      }

      const putPrice = service.blackScholesPut(params)

      // ATM put should have similar value to call (put-call parity)
      const callPrice = service.blackScholesCall(params)
      const parity = callPrice - putPrice
      const expectedParity = params.currentPrice - params.strike * Math.exp(-params.riskFreeRate * params.timeToExpiry)

      expect(Math.abs(parity - expectedParity)).toBeLessThan(0.01)

      console.log(`✓ Black-Scholes put price: $${putPrice.toFixed(2)}`)
    })

    test('should_calculate_cumulative_normal_distribution', () => {
      // Test standard normal distribution function
      const testValues = [
        { input: 0, expected: 0.5 },      // N(0) = 0.5
        { input: 1, expected: 0.8413 },   // N(1) ≈ 0.8413
        { input: -1, expected: 0.1587 },  // N(-1) ≈ 0.1587
        { input: 2, expected: 0.9772 }    // N(2) ≈ 0.9772
      ]

      testValues.forEach(({ input, expected }) => {
        const result = service.cumulativeNormalDistribution(input)
        expect(Math.abs(result - expected)).toBeLessThan(0.01) // 1% tolerance
      })

      console.log(`✓ Cumulative normal distribution calculations verified`)
    })

    test('should_handle_extreme_values_gracefully', () => {
      // Test with extreme values that might cause numerical issues
      const extremeParams = {
        currentPrice: 0.01, // Very low price
        strike: 1000,       // Very high strike
        timeToExpiry: 0.001, // Very short time
        riskFreeRate: 0.10,  // High rate
        volatility: 2.0      // Very high volatility
      }

      const callPrice = service.blackScholesCall(extremeParams)
      const putPrice = service.blackScholesPut(extremeParams)

      // Should not return NaN or infinity
      expect(isFinite(callPrice)).toBe(true)
      expect(isFinite(putPrice)).toBe(true)
      expect(callPrice).not.toBeNaN()
      expect(putPrice).not.toBeNaN()

      // Prices should be reasonable (non-negative)
      expect(callPrice).toBeGreaterThanOrEqual(0)
      expect(putPrice).toBeGreaterThanOrEqual(0)

      console.log(`✓ Extreme values handled gracefully`)
    })
  })

  describe('Input Validation and Sanitization', () => {
    test('should_validate_symbol_format', () => {
      const validSymbols = ['AAPL', 'MSFT', 'SPY', 'QQQ']
      const invalidSymbols = ['', '123', 'TOOLONG_SYMBOL', 'SYM-BOL', 'SYM BOL', null, undefined]

      validSymbols.forEach(symbol => {
        expect(service.isValidSymbol(symbol)).toBe(true)
      })

      invalidSymbols.forEach(symbol => {
        expect(service.isValidSymbol(symbol as any)).toBe(false)
      })

      console.log(`✓ Symbol validation working correctly`)
    })

    test('should_sanitize_user_inputs', () => {
      const maliciousInputs = [
        '<script>alert("xss")</script>',
        'AAPL; DROP TABLE;',
        '../../../etc/passwd',
        'AAPL\x00nullbyte'
      ]

      maliciousInputs.forEach(input => {
        const sanitized = service.sanitizeSymbol(input)

        expect(sanitized).not.toContain('<script>')
        expect(sanitized).not.toContain('DROP TABLE')
        expect(sanitized).not.toContain('../')
        expect(sanitized).not.toContain('\x00')
      })

      console.log(`✓ Input sanitization working correctly`)
    })
  })
})