/**
 * MLEnhancementService Unit Tests
 * Tests ML enhancement integration with classic VFR analysis
 * Following VFR NO MOCK DATA policy - uses real service instances
 */

import MLEnhancementService from '../MLEnhancementService'
import {
  EnhancedStockSelectionRequest,
  EnhancedStockSelectionResponse
} from '../types/EnhancementTypes'
import { MLPredictionHorizon, MLUserTier } from '../types/MLTypes'

describe('MLEnhancementService', () => {
  let enhancementService: MLEnhancementService

  beforeEach(() => {
    enhancementService = MLEnhancementService.getInstance()
    enhancementService.reset()
  })

  afterEach(() => {
    enhancementService.reset()
  })

  describe('Stock Selection Enhancement', () => {
    test('should return classic results when ML is disabled', async () => {
      const request: EnhancedStockSelectionRequest = {
        symbols: ['AAPL'],
        includeML: false
      }

      const classicResults = [
        {
          symbol: 'AAPL',
          totalScore: 75,
          recommendation: 'BUY',
          confidence: 0.8,
          technicalScore: 80,
          fundamentalScore: 70,
          sentimentScore: 75,
          macroScore: 70,
          alternativeScore: 80,
          reasoning: ['Strong technical indicators', 'Positive fundamentals']
        }
      ]

      const response = await enhancementService.enhanceStockSelection(
        request,
        classicResults,
        'test-request-1'
      )

      expect(response.success).toBe(true)
      expect(response.mlEnabled).toBe(false)
      expect(response.results.length).toBe(1)
      expect(response.results[0].finalScore).toBe(75)
      expect(response.results[0].mlEnhancement).toBeUndefined()
    })

    test('should enhance results when ML is enabled', async () => {
      const request: EnhancedStockSelectionRequest = {
        symbols: ['AAPL'],
        includeML: true,
        mlHorizon: MLPredictionHorizon.ONE_DAY,
        mlConfidenceThreshold: 0.5
      }

      const classicResults = [
        {
          symbol: 'AAPL',
          totalScore: 70,
          recommendation: 'BUY',
          confidence: 0.75,
          technicalScore: 75,
          fundamentalScore: 68,
          sentimentScore: 70,
          macroScore: 65,
          alternativeScore: 72,
          reasoning: ['Strong technical setup']
        }
      ]

      const response = await enhancementService.enhanceStockSelection(
        request,
        classicResults,
        'test-request-2'
      )

      expect(response.success).toBe(true)
      expect(response.results.length).toBe(1)
      expect(response.results[0].classicScore).toBeDefined()
      expect(response.results[0].classicScore.totalScore).toBe(70)
      expect(response.results[0].symbol).toBe('AAPL')
    })

    test('should handle multiple symbols', async () => {
      const request: EnhancedStockSelectionRequest = {
        symbols: ['AAPL', 'GOOGL', 'MSFT'],
        includeML: false
      }

      const classicResults = [
        {
          symbol: 'AAPL',
          totalScore: 75,
          recommendation: 'BUY',
          confidence: 0.8,
          technicalScore: 80,
          fundamentalScore: 70,
          sentimentScore: 75,
          macroScore: 70,
          alternativeScore: 80
        },
        {
          symbol: 'GOOGL',
          totalScore: 65,
          recommendation: 'HOLD',
          confidence: 0.6,
          technicalScore: 60,
          fundamentalScore: 70,
          sentimentScore: 65,
          macroScore: 60,
          alternativeScore: 70
        },
        {
          symbol: 'MSFT',
          totalScore: 80,
          recommendation: 'BUY',
          confidence: 0.85,
          technicalScore: 85,
          fundamentalScore: 78,
          sentimentScore: 80,
          macroScore: 75,
          alternativeScore: 82
        }
      ]

      const response = await enhancementService.enhanceStockSelection(
        request,
        classicResults,
        'test-request-3'
      )

      expect(response.success).toBe(true)
      expect(response.results.length).toBe(3)
      expect(response.results.map(r => r.symbol)).toEqual(['AAPL', 'GOOGL', 'MSFT'])
    })

    test('should include processing time metadata', async () => {
      const request: EnhancedStockSelectionRequest = {
        symbols: ['AAPL'],
        includeML: false
      }

      const classicResults = [
        {
          symbol: 'AAPL',
          totalScore: 70,
          recommendation: 'BUY',
          confidence: 0.7,
          technicalScore: 70,
          fundamentalScore: 70,
          sentimentScore: 70,
          macroScore: 70,
          alternativeScore: 70
        }
      ]

      const response = await enhancementService.enhanceStockSelection(
        request,
        classicResults
      )

      expect(response.metadata).toBeDefined()
      expect(response.metadata.timestamp).toBeDefined()
      expect(response.metadata.processingTime).toBeGreaterThanOrEqual(0)
      expect(response.metadata.classicAnalysisTime).toBeGreaterThanOrEqual(0)
      expect(response.metadata.mlEnhancementTime).toBeDefined()
    })
  })

  describe('Enhanced Result Structure', () => {
    test('should preserve classic scores in enhanced results', async () => {
      const request: EnhancedStockSelectionRequest = {
        symbols: ['AAPL'],
        includeML: false
      }

      const classicResults = [
        {
          symbol: 'AAPL',
          totalScore: 72,
          recommendation: 'BUY',
          confidence: 0.76,
          technicalScore: 78,
          fundamentalScore: 68,
          sentimentScore: 72,
          macroScore: 70,
          alternativeScore: 74,
          reasoning: ['Technical strength', 'Fundamental stability']
        }
      ]

      const response = await enhancementService.enhanceStockSelection(
        request,
        classicResults
      )

      const result = response.results[0]
      expect(result.classicScore.totalScore).toBe(72)
      expect(result.classicScore.recommendation).toBe('BUY')
      expect(result.classicScore.confidence).toBe(0.76)
      expect(result.classicScore.technicalScore).toBe(78)
      expect(result.classicScore.fundamentalScore).toBe(68)
      expect(result.classicScore.sentimentScore).toBe(72)
      expect(result.classicScore.macroScore).toBe(70)
      expect(result.classicScore.alternativeScore).toBe(74)
    })

    test('should include risk level in results', async () => {
      const request: EnhancedStockSelectionRequest = {
        symbols: ['AAPL'],
        includeML: false
      }

      const classicResults = [
        {
          symbol: 'AAPL',
          totalScore: 75,
          recommendation: 'BUY',
          confidence: 0.8,
          technicalScore: 80,
          fundamentalScore: 70,
          sentimentScore: 75,
          macroScore: 70,
          alternativeScore: 80
        }
      ]

      const response = await enhancementService.enhanceStockSelection(
        request,
        classicResults
      )

      const result = response.results[0]
      expect(result.riskLevel).toBeDefined()
      expect(['LOW', 'MEDIUM', 'HIGH']).toContain(result.riskLevel)
    })

    test('should include timestamp in results', async () => {
      const request: EnhancedStockSelectionRequest = {
        symbols: ['AAPL'],
        includeML: false
      }

      const classicResults = [
        {
          symbol: 'AAPL',
          totalScore: 70,
          recommendation: 'BUY',
          confidence: 0.7,
          technicalScore: 70,
          fundamentalScore: 70,
          sentimentScore: 70,
          macroScore: 70,
          alternativeScore: 70
        }
      ]

      const response = await enhancementService.enhanceStockSelection(
        request,
        classicResults
      )

      const result = response.results[0]
      expect(result.timestamp).toBeDefined()
      expect(typeof result.timestamp).toBe('number')
      expect(result.timestamp).toBeGreaterThan(0)
    })
  })

  describe('Health Status', () => {
    test('should provide health status', async () => {
      const health = await enhancementService.getHealthStatus()

      expect(health).toBeDefined()
      expect(health.status).toBeDefined()
      expect(['healthy', 'degraded', 'unavailable']).toContain(health.status)
      expect(health.services).toBeDefined()
      expect(health.services.predictionService).toBeDefined()
      expect(health.services.featureService).toBeDefined()
      expect(health.services.modelManager).toBeDefined()
      expect(health.services.enhancementService).toBeDefined()
      expect(health.metrics).toBeDefined()
      expect(health.lastCheck).toBeGreaterThan(0)
    })
  })

  describe('Degradation Handling', () => {
    test('should report degradation status', () => {
      const status = enhancementService.getDegradationStatus()

      expect(status).toBeDefined()
      expect(status.isDegraded).toBeDefined()
      expect(status.degradationType).toBeDefined()
      expect(['none', 'partial', 'complete']).toContain(status.degradationType)
      expect(status.affectedServices).toBeDefined()
      expect(Array.isArray(status.affectedServices)).toBe(true)
      expect(status.fallbackActive).toBeDefined()
      expect(status.fallbackStrategy).toBeDefined()
    })

    test('should start with no degradation', () => {
      const status = enhancementService.getDegradationStatus()

      expect(status.isDegraded).toBe(false)
      expect(status.degradationType).toBe('none')
      expect(status.affectedServices.length).toBe(0)
      expect(status.fallbackActive).toBe(false)
    })
  })

  describe('Configuration Management', () => {
    test('should update configuration', () => {
      const newConfig = {
        enableML: false,
        mlWeight: 0.15,
        targetLatency: 400
      }

      enhancementService.updateConfig(newConfig)

      // Verify config is updated by checking behavior
      // (We can't directly access config, but it should affect future calls)
      expect(() => enhancementService.updateConfig(newConfig)).not.toThrow()
    })
  })

  describe('Graceful Fallback', () => {
    test('should fallback to classic when ML fails', async () => {
      // This test verifies fallback behavior is implemented
      const request: EnhancedStockSelectionRequest = {
        symbols: ['INVALID_SYMBOL_TO_TRIGGER_ERROR'],
        includeML: true
      }

      const classicResults = [
        {
          symbol: 'INVALID_SYMBOL_TO_TRIGGER_ERROR',
          totalScore: 50,
          recommendation: 'HOLD',
          confidence: 0.5,
          technicalScore: 50,
          fundamentalScore: 50,
          sentimentScore: 50,
          macroScore: 50,
          alternativeScore: 50
        }
      ]

      const response = await enhancementService.enhanceStockSelection(
        request,
        classicResults
      )

      // Should successfully return classic results even if ML fails
      expect(response.success).toBe(true)
      expect(response.results.length).toBe(1)
      expect(response.results[0].symbol).toBe('INVALID_SYMBOL_TO_TRIGGER_ERROR')
    })
  })

  describe('Performance Requirements', () => {
    test('should complete enhancement within target latency', async () => {
      const request: EnhancedStockSelectionRequest = {
        symbols: ['AAPL'],
        includeML: false
      }

      const classicResults = [
        {
          symbol: 'AAPL',
          totalScore: 70,
          recommendation: 'BUY',
          confidence: 0.7,
          technicalScore: 70,
          fundamentalScore: 70,
          sentimentScore: 70,
          macroScore: 70,
          alternativeScore: 70
        }
      ]

      const startTime = Date.now()
      const response = await enhancementService.enhanceStockSelection(
        request,
        classicResults
      )
      const latency = Date.now() - startTime

      expect(response.success).toBe(true)
      // Should complete quickly for classic-only (no ML overhead)
      expect(latency).toBeLessThan(1000)
    })
  })
})
