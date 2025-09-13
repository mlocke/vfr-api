/**
 * Optimized Unit tests for MCP Data Fusion capabilities
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { DataFusionEngine } from '../DataFusionEngine'
import { QualityScorer } from '../QualityScorer'
import {
  ConflictResolutionStrategy,
  FusionOptions,
  QualityScore
} from '../types'

// Mock console to reduce test noise
const mockConsole = {
  log: jest.spyOn(console, 'log').mockImplementation(() => {}),
  error: jest.spyOn(console, 'error').mockImplementation(() => {}),
  warn: jest.spyOn(console, 'warn').mockImplementation(() => {})
}

describe('DataFusionEngine', () => {
  let fusionEngine: DataFusionEngine
  let qualityScorer: QualityScorer

  beforeEach(() => {
    jest.clearAllMocks()
    fusionEngine = new DataFusionEngine()
    qualityScorer = new QualityScorer()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  // Helper function to create test data points
  function createDataPoint(source: string, price: number, quality: number) {
    return {
      source,
      data: {
        symbol: 'AAPL',
        price,
        volume: 1000000
      },
      quality: {
        overall: quality,
        metrics: {
          freshness: quality,
          completeness: quality,
          accuracy: quality,
          sourceReputation: quality,
          latency: quality
        },
        timestamp: Date.now(),
        source
      },
      timestamp: Date.now(),
      latency: 100
    }
  }

  describe('Basic Fusion Operations', () => {
    it('should return data directly when only one source is provided', async () => {
      const dataPoint = {
        source: 'polygon',
        data: { price: 150.50, volume: 1000000 },
        quality: {
          overall: 0.95,
          metrics: {
            freshness: 1.0,
            completeness: 0.9,
            accuracy: 0.95,
            sourceReputation: 0.95,
            latency: 0.9
          },
          timestamp: Date.now(),
          source: 'polygon'
        },
        timestamp: Date.now(),
        latency: 100
      }

      const result = await fusionEngine.fuseData([dataPoint])

      expect(result.success).toBe(true)
      expect(result.data).toEqual(dataPoint.data)
      expect(result.source).toBe('polygon')
    }, 3000)

    it('should filter out low quality sources', async () => {
      const dataPoints = [
        {
          source: 'low_quality',
          data: { price: 150 },
          quality: {
            overall: 0.3, // Below default threshold
            metrics: {
              freshness: 0.3,
              completeness: 0.3,
              accuracy: 0.3,
              sourceReputation: 0.3,
              latency: 0.3
            },
            timestamp: Date.now(),
            source: 'low_quality'
          },
          timestamp: Date.now(),
          latency: 1000
        }
      ]

      const result = await fusionEngine.fuseData(dataPoints)

      expect(result.success).toBe(false)
      expect(result.error).toContain('No data sources meet minimum quality requirements')
    }, 3000)

    it('should use highest quality source by default', async () => {
      const dataPoints = [
        createDataPoint('polygon', 150.50, 0.95),
        createDataPoint('alphavantage', 150.45, 0.85),
        createDataPoint('yahoo', 150.55, 0.75)
      ]

      const result = await fusionEngine.fuseData(dataPoints)

      expect(result.success).toBe(true)
      expect(result.data).toEqual({ symbol: 'AAPL', price: 150.50, volume: 1000000 })
      expect(result.fusion?.primarySource).toBe('polygon')
    }, 3000)

    it('should use most recent data with MOST_RECENT strategy', async () => {
      const now = Date.now()
      const dataPoints = [
        { ...createDataPoint('polygon', 150.50, 0.95), timestamp: now - 5000 },
        { ...createDataPoint('alphavantage', 150.60, 0.85), timestamp: now - 1000 },
        { ...createDataPoint('yahoo', 150.55, 0.75), timestamp: now - 3000 }
      ]

      const result = await fusionEngine.fuseData(dataPoints, {
        strategy: ConflictResolutionStrategy.MOST_RECENT
      })

      expect(result.success).toBe(true)
      expect(result.data).toEqual({ symbol: 'AAPL', price: 150.60, volume: 1000000 })
    }, 3000)

    it('should use weighted average for numeric fields', async () => {
      const dataPoints = [
        createDataPoint('polygon', 150.00, 0.9),
        createDataPoint('alphavantage', 151.00, 0.8),
        createDataPoint('yahoo', 152.00, 0.7)
      ]

      const result = await fusionEngine.fuseData(dataPoints, {
        strategy: ConflictResolutionStrategy.WEIGHTED_AVERAGE
      })

      expect(result.success).toBe(true)
      expect(result.data?.price).toBeCloseTo(150.92, 2) // Weighted by quality scores
    }, 3000)

    it('should use consensus for majority vote', async () => {
      const dataPoints = [
        createDataPoint('polygon', 150.50, 0.9),
        createDataPoint('alphavantage', 150.50, 0.8),
        createDataPoint('yahoo', 151.00, 0.95)
      ]

      const result = await fusionEngine.fuseData(dataPoints, {
        strategy: ConflictResolutionStrategy.CONSENSUS
      })

      expect(result.success).toBe(true)
      // Two sources agree on 150.50
      expect(result.data?.price).toBe(150.50)
    }, 3000)
  })

  describe('Data Validation', () => {
    it('should detect and report discrepancies', async () => {
      const dataPoints = [
        createDataPoint('polygon', 150.00, 0.9),    // Base price
        createDataPoint('alphavantage', 155.00, 0.8), // 3.33% difference
        createDataPoint('yahoo', 160.00, 0.7)        // 6.67% difference
      ]

      const result = await fusionEngine.fuseData(dataPoints, {
        validateData: true
      })

      expect(result.success).toBe(true)
      expect(result.fusion?.conflicts).toBeGreaterThan(0)
      expect(result.fusion?.validationResult?.discrepancies.length).toBeGreaterThan(0)
    }, 3000)

    it('should fail when consensus is required but not met', async () => {
      const dataPoints = [
        createDataPoint('polygon', 150.00, 0.9),
        createDataPoint('alphavantage', 160.00, 0.8), // Large discrepancy
        createDataPoint('yahoo', 170.00, 0.7)         // Large discrepancy
      ]

      const result = await fusionEngine.fuseData(dataPoints, {
        requireConsensus: true,
        validateData: true
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('consensus requirements')
    }, 3000)
  })

  describe('Configuration and Statistics', () => {
    it('should return fusion statistics', () => {
      const stats = fusionEngine.getStatistics()

      expect(stats).toHaveProperty('qualityStats')
      expect(stats).toHaveProperty('config')
      expect(stats.config).toHaveProperty('defaultStrategy')
      expect(stats.config).toHaveProperty('validationEnabled')
    }, 3000)

    it('should handle custom quality thresholds', async () => {
      const dataPoints = [
        createDataPoint('polygon', 150.00, 0.6) // Above custom threshold but below default
      ]

      const result = await fusionEngine.fuseData(dataPoints, {
        minQualityScore: 0.55
      })

      expect(result.success).toBe(true)
      expect(result.data?.price).toBe(150.00)
    }, 3000)

    it('should include metadata when requested', async () => {
      const dataPoints = [
        createDataPoint('polygon', 150.00, 0.9),
        createDataPoint('alphavantage', 150.50, 0.8)
      ]

      const result = await fusionEngine.fuseData(dataPoints, {
        includeMetadata: true
      })

      expect(result.success).toBe(true)
      expect(result.fusion).toBeDefined()
      expect(result.fusion?.sources).toEqual(['polygon', 'alphavantage'])
      expect(result.fusion?.primarySource).toBe('polygon')
    }, 3000)

    it('should exclude metadata when not requested', async () => {
      const dataPoints = [
        createDataPoint('polygon', 150.00, 0.9)
      ]

      const result = await fusionEngine.fuseData(dataPoints, {
        includeMetadata: false
      })

      expect(result.success).toBe(true)
      expect(result.fusion).toBeUndefined()
    }, 3000)
  })
})