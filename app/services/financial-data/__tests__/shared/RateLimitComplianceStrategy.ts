/**
 * Rate Limit Compliance Testing Strategy for FMP Integration
 * Comprehensive testing framework for FMP API rate limits (300 req/min Starter plan)
 * Validates compliance, implements backoff strategies, and monitors API health
 */

import { performance } from 'perf_hooks'

export interface RateLimitPlan {
  name: string
  requestsPerMinute: number
  requestsPerSecond: number
  burstCapacity: number
  costPerRequest: number
}

export interface RateLimitState {
  requestCount: number
  windowStart: number
  lastRequestTime: number
  violations: number
  backoffUntil: number
}

export interface ComplianceTestResult {
  planType: string
  totalRequests: number
  timeWindow: number
  requestsPerSecond: number
  violations: RateLimitViolation[]
  compliance: boolean
  efficiency: number
  recommendations: string[]
}

export interface RateLimitViolation {
  timestamp: number
  requestNumber: number
  timeSinceLastRequest: number
  expectedMinDelay: number
  severity: 'minor' | 'moderate' | 'severe'
}

export class RateLimitComplianceStrategy {
  private static readonly FMP_PLANS: Record<string, RateLimitPlan> = {
    starter: {
      name: 'FMP Starter',
      requestsPerMinute: 300,
      requestsPerSecond: 5,
      burstCapacity: 10,
      costPerRequest: 1
    },
    professional: {
      name: 'FMP Professional',
      requestsPerMinute: 600,
      requestsPerSecond: 10,
      burstCapacity: 20,
      costPerRequest: 1
    },
    enterprise: {
      name: 'FMP Enterprise',
      requestsPerMinute: 2000,
      requestsPerSecond: 33,
      burstCapacity: 50,
      costPerRequest: 1
    }
  }

  private plan: RateLimitPlan
  private state: RateLimitState
  private requestLog: Array<{ timestamp: number; duration: number; success: boolean }> = []
  private startTime: number = 0

  constructor(planType: keyof typeof RateLimitComplianceStrategy.FMP_PLANS = 'starter') {
    this.plan = RateLimitComplianceStrategy.FMP_PLANS[planType]
    this.state = {
      requestCount: 0,
      windowStart: 0,
      lastRequestTime: 0,
      violations: 0,
      backoffUntil: 0
    }
  }

  /**
   * Initialize rate limit testing
   */
  startTesting(): void {
    this.startTime = performance.now()
    this.state = {
      requestCount: 0,
      windowStart: this.startTime,
      lastRequestTime: 0,
      violations: 0,
      backoffUntil: 0
    }
    this.requestLog = []
  }

  /**
   * Check if request is allowed under rate limit
   */
  async checkRequestPermission(): Promise<{
    allowed: boolean
    delayRequired: number
    reason?: string
  }> {
    const now = performance.now()

    // Check if in backoff period
    if (now < this.state.backoffUntil) {
      return {
        allowed: false,
        delayRequired: this.state.backoffUntil - now,
        reason: 'Exponential backoff active'
      }
    }

    // Reset window if needed (sliding window approach)
    if (now - this.state.windowStart >= 60000) { // 1 minute window
      this.state.windowStart = now
      this.state.requestCount = 0
    }

    // Check per-minute limit
    if (this.state.requestCount >= this.plan.requestsPerMinute) {
      const windowReset = this.state.windowStart + 60000
      return {
        allowed: false,
        delayRequired: windowReset - now,
        reason: 'Per-minute limit exceeded'
      }
    }

    // Check per-second limit (burst protection)
    const timeSinceLastRequest = now - this.state.lastRequestTime
    const minDelay = 1000 / this.plan.requestsPerSecond // Minimum delay in ms

    if (timeSinceLastRequest < minDelay && this.state.lastRequestTime > 0) {
      return {
        allowed: false,
        delayRequired: minDelay - timeSinceLastRequest,
        reason: 'Per-second limit protection'
      }
    }

    return { allowed: true, delayRequired: 0 }
  }

  /**
   * Record a request attempt
   */
  recordRequest(duration: number, success: boolean): void {
    const now = performance.now()

    this.state.requestCount++
    this.state.lastRequestTime = now

    this.requestLog.push({
      timestamp: now,
      duration,
      success
    })

    // Track violations if this request was too fast
    if (this.requestLog.length > 1) {
      const previousRequest = this.requestLog[this.requestLog.length - 2]
      const timeBetweenRequests = now - previousRequest.timestamp
      const minExpectedDelay = 1000 / this.plan.requestsPerSecond

      if (timeBetweenRequests < minExpectedDelay) {
        this.state.violations++
      }
    }
  }

  /**
   * Implement exponential backoff for violations
   */
  triggerBackoff(violationCount: number = this.state.violations): void {
    const baseDelay = 1000 // 1 second base
    const backoffDelay = Math.min(baseDelay * Math.pow(2, violationCount), 30000) // Max 30 seconds
    this.state.backoffUntil = performance.now() + backoffDelay
  }

  /**
   * Execute rate-limited API call with compliance checking
   */
  async executeWithRateLimit<T>(
    apiCall: () => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    let attempts = 0

    while (attempts < maxRetries) {
      const permission = await this.checkRequestPermission()

      if (!permission.allowed) {
        if (permission.delayRequired > 0) {
          await this.sleep(permission.delayRequired)
          continue
        }
      }

      try {
        const startTime = performance.now()
        const result = await apiCall()
        const duration = performance.now() - startTime

        this.recordRequest(duration, true)
        return result

      } catch (error) {
        attempts++
        this.recordRequest(performance.now() - performance.now(), false)

        // Check if error is rate limit related
        if (this.isRateLimitError(error)) {
          this.triggerBackoff()
        }

        if (attempts >= maxRetries) {
          throw error
        }

        // Wait before retry
        await this.sleep(1000 * attempts) // Progressive delay
      }
    }

    throw new Error(`Failed after ${maxRetries} attempts`)
  }

  /**
   * Batch execute multiple API calls with optimal rate limiting
   */
  async executeBatch<T>(
    apiCalls: (() => Promise<T>)[],
    options: {
      maxConcurrency?: number
      progressCallback?: (completed: number, total: number) => void
    } = {}
  ): Promise<T[]> {
    const { maxConcurrency = 3, progressCallback } = options
    const results: T[] = []
    let completed = 0

    // Calculate optimal delay between batches
    const optimalBatchDelay = this.calculateOptimalBatchDelay(maxConcurrency)

    for (let i = 0; i < apiCalls.length; i += maxConcurrency) {
      const batch = apiCalls.slice(i, i + maxConcurrency)

      const batchPromises = batch.map(apiCall =>
        this.executeWithRateLimit(apiCall)
      )

      const batchResults = await Promise.allSettled(batchPromises)

      batchResults.forEach(result => {
        if (result.status === 'fulfilled') {
          results.push(result.value)
        } else {
          console.warn('Batch request failed:', result.reason)
          results.push(null as any) // Placeholder for failed request
        }
      })

      completed += batch.length
      progressCallback?.(completed, apiCalls.length)

      // Delay between batches (except last batch)
      if (i + maxConcurrency < apiCalls.length) {
        await this.sleep(optimalBatchDelay)
      }
    }

    return results.filter(result => result !== null)
  }

  /**
   * Generate compliance test report
   */
  generateComplianceReport(): ComplianceTestResult {
    const now = performance.now()
    const totalTime = now - this.startTime
    const violations = this.analyzeViolations()

    const efficiency = this.calculateEfficiency()
    const requestsPerSecond = (this.requestLog.length / totalTime) * 1000

    const compliance = violations.length === 0 &&
                      requestsPerSecond <= this.plan.requestsPerSecond

    const recommendations = this.generateRecommendations(violations, efficiency)

    return {
      planType: this.plan.name,
      totalRequests: this.requestLog.length,
      timeWindow: totalTime,
      requestsPerSecond,
      violations,
      compliance,
      efficiency,
      recommendations
    }
  }

  /**
   * Test rate limit compliance with simulated load
   */
  async testComplianceUnderLoad(options: {
    duration: number // milliseconds
    targetRequestRate: number // requests per second
    burstTests: boolean
  }): Promise<ComplianceTestResult> {
    this.startTesting()

    const { duration, targetRequestRate, burstTests } = options
    const endTime = performance.now() + duration

    // Simulate steady load
    const steadyLoadPromise = this.simulateSteadyLoad(endTime, targetRequestRate)

    // Simulate burst load if requested
    const burstPromises: Promise<void>[] = []
    if (burstTests) {
      // Test burst at 25%, 50%, and 75% through the duration
      const burstTimes = [0.25, 0.5, 0.75].map(pct => performance.now() + (duration * pct))
      burstPromises.push(...burstTimes.map(time => this.simulateBurst(time)))
    }

    await Promise.all([steadyLoadPromise, ...burstPromises])

    return this.generateComplianceReport()
  }

  /**
   * Calculate optimal delay for API calls
   */
  calculateOptimalDelay(utilizationTarget: number = 80): number {
    const targetRate = (this.plan.requestsPerSecond * utilizationTarget) / 100
    return Math.ceil(1000 / targetRate) // Milliseconds between requests
  }

  /**
   * Get current rate limit status
   */
  getCurrentStatus(): {
    requestsInCurrentWindow: number
    requestsRemaining: number
    windowResetTime: number
    estimatedResetDelay: number
    inBackoff: boolean
  } {
    const now = performance.now()
    const windowAge = now - this.state.windowStart
    const windowResetTime = this.state.windowStart + 60000

    return {
      requestsInCurrentWindow: this.state.requestCount,
      requestsRemaining: Math.max(0, this.plan.requestsPerMinute - this.state.requestCount),
      windowResetTime,
      estimatedResetDelay: Math.max(0, windowResetTime - now),
      inBackoff: now < this.state.backoffUntil
    }
  }

  /**
   * Private helper methods
   */

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private isRateLimitError(error: any): boolean {
    if (typeof error === 'object' && error !== null) {
      const errorString = error.toString().toLowerCase()
      const errorMessage = error.message?.toLowerCase() || ''

      return errorString.includes('rate limit') ||
             errorString.includes('429') ||
             errorMessage.includes('rate limit') ||
             errorMessage.includes('too many requests')
    }
    return false
  }

  private analyzeViolations(): RateLimitViolation[] {
    const violations: RateLimitViolation[] = []
    const minDelay = 1000 / this.plan.requestsPerSecond

    for (let i = 1; i < this.requestLog.length; i++) {
      const current = this.requestLog[i]
      const previous = this.requestLog[i - 1]
      const timeBetween = current.timestamp - previous.timestamp

      if (timeBetween < minDelay) {
        const violation: RateLimitViolation = {
          timestamp: current.timestamp,
          requestNumber: i + 1,
          timeSinceLastRequest: timeBetween,
          expectedMinDelay: minDelay,
          severity: this.classifyViolationSeverity(timeBetween, minDelay)
        }
        violations.push(violation)
      }
    }

    return violations
  }

  private classifyViolationSeverity(actual: number, expected: number): 'minor' | 'moderate' | 'severe' {
    const ratio = actual / expected
    if (ratio < 0.5) return 'severe'    // Less than 50% of expected delay
    if (ratio < 0.75) return 'moderate' // Less than 75% of expected delay
    return 'minor'                      // Less than 100% but more than 75%
  }

  private calculateEfficiency(): number {
    if (this.requestLog.length === 0) return 0

    const totalTime = performance.now() - this.startTime
    const actualRate = (this.requestLog.length / totalTime) * 1000 // requests per second
    const maxSafeRate = this.plan.requestsPerSecond * 0.8 // 80% utilization

    return Math.min((actualRate / maxSafeRate) * 100, 100)
  }

  private generateRecommendations(violations: RateLimitViolation[], efficiency: number): string[] {
    const recommendations: string[] = []

    if (violations.length > 0) {
      const severeViolations = violations.filter(v => v.severity === 'severe').length
      const moderateViolations = violations.filter(v => v.severity === 'moderate').length

      if (severeViolations > 0) {
        recommendations.push(`Severe rate limit violations detected (${severeViolations}). Implement exponential backoff.`)
      }

      if (moderateViolations > 0) {
        recommendations.push(`Moderate violations detected (${moderateViolations}). Increase delay between requests.`)
      }

      recommendations.push(`Consider implementing request queuing with ${this.calculateOptimalDelay()}ms delays.`)
    }

    if (efficiency < 50) {
      recommendations.push('Low API utilization efficiency. Consider increasing request rate within limits.')
    }

    if (efficiency > 90) {
      recommendations.push('High utilization rate may risk rate limiting. Consider reducing to 80% target.')
    }

    if (this.state.violations > 0) {
      recommendations.push('Implement circuit breaker pattern to prevent cascade failures.')
    }

    return recommendations
  }

  private calculateOptimalBatchDelay(concurrency: number): number {
    // Calculate delay needed between batches to stay within rate limits
    const requestsPerBatch = concurrency
    const minBatchInterval = (requestsPerBatch / this.plan.requestsPerSecond) * 1000 * 1.2 // 20% safety margin
    return Math.max(minBatchInterval, 1000) // Minimum 1 second between batches
  }

  private async simulateSteadyLoad(endTime: number, targetRate: number): Promise<void> {
    const interval = 1000 / targetRate // milliseconds between requests

    while (performance.now() < endTime) {
      await this.executeWithRateLimit(async () => {
        // Simulate API call
        await this.sleep(Math.random() * 100 + 50) // 50-150ms simulated response time
        return { simulated: true }
      })

      await this.sleep(interval)
    }
  }

  private async simulateBurst(startTime: number): Promise<void> {
    // Wait until burst time
    const now = performance.now()
    if (startTime > now) {
      await this.sleep(startTime - now)
    }

    // Execute burst of requests
    const burstSize = Math.min(this.plan.burstCapacity, 5) // Max 5 requests in burst
    const burstPromises = Array(burstSize).fill(0).map(() =>
      this.executeWithRateLimit(async () => {
        await this.sleep(Math.random() * 50 + 25) // Fast responses for burst test
        return { burst: true }
      })
    )

    await Promise.allSettled(burstPromises)
  }
}

/**
 * Utility functions for test setup
 */

export function createRateLimitTestSuite(planType: keyof typeof RateLimitComplianceStrategy['FMP_PLANS'] = 'starter') {
  return {
    strategy: new RateLimitComplianceStrategy(planType),

    async testBasicCompliance(): Promise<ComplianceTestResult> {
      const strategy = new RateLimitComplianceStrategy(planType)
      return await strategy.testComplianceUnderLoad({
        duration: 30000, // 30 seconds
        targetRequestRate: 2, // Conservative rate
        burstTests: false
      })
    },

    async testBurstCompliance(): Promise<ComplianceTestResult> {
      const strategy = new RateLimitComplianceStrategy(planType)
      return await strategy.testComplianceUnderLoad({
        duration: 60000, // 1 minute
        targetRequestRate: 3, // Moderate rate
        burstTests: true
      })
    },

    async testMaxCapacity(): Promise<ComplianceTestResult> {
      const strategy = new RateLimitComplianceStrategy(planType)
      const plan = RateLimitComplianceStrategy['FMP_PLANS'][planType]
      return await strategy.testComplianceUnderLoad({
        duration: 120000, // 2 minutes
        targetRequestRate: plan.requestsPerSecond * 0.8, // 80% of max rate
        burstTests: true
      })
    }
  }
}

/**
 * Jest matcher for rate limit compliance
 */
export function expectRateLimitCompliance(result: ComplianceTestResult) {
  return {
    toBeCompliant() {
      if (result.compliance) {
        return {
          pass: true,
          message: () => `Rate limit compliance test passed for ${result.planType}`
        }
      } else {
        const violationsSummary = result.violations.length > 0
          ? `\nViolations: ${result.violations.length} (${result.violations.filter(v => v.severity === 'severe').length} severe)`
          : ''

        return {
          pass: false,
          message: () => `Rate limit compliance failed for ${result.planType}. Efficiency: ${result.efficiency.toFixed(1)}%${violationsSummary}\nRecommendations: ${result.recommendations.join(', ')}`
        }
      }
    },

    toMeetEfficiencyTarget(target: number = 60) {
      const meets = result.efficiency >= target
      return {
        pass: meets,
        message: () => meets
          ? `Efficiency target met: ${result.efficiency.toFixed(1)}% >= ${target}%`
          : `Efficiency below target: ${result.efficiency.toFixed(1)}% < ${target}%`
      }
    }
  }
}