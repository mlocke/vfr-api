/**
 * Comprehensive Unit Tests for DataLineageTracker
 * Tests lineage tracking, graph management, querying, and statistics
 */

import {
  DataLineageTracker,
  LineageNode,
  LineageGraph,
  LineageQuery,
  LineageStatistics
} from '../DataLineageTracker'
import {
  DataLineageInfo,
  TransformationStep,
  ValidationStep,
  QualityCheck
} from '../DataNormalizationPipeline'

describe('DataLineageTracker', () => {
  let lineageTracker: DataLineageTracker

  beforeEach(() => {
    lineageTracker = new DataLineageTracker()
  })

  afterEach(() => {
    lineageTracker.reset()
  })

  describe('Constructor and Initialization', () => {
    it('should initialize empty tracker', () => {
      expect(lineageTracker).toBeInstanceOf(DataLineageTracker)

      const stats = lineageTracker.getStatistics()
      expect(stats.totalOperations).toBe(0)
      expect(stats.averageProcessingTime).toBe(0)
      expect(stats.successRate).toBe(0)
      expect(Object.keys(stats.sourceUsage)).toHaveLength(0)
      expect(Object.keys(stats.dataTypeMetrics)).toHaveLength(0)
    })

    it('should have empty lineage graph initially', () => {
      const graph = lineageTracker.getLineageGraph()
      expect(graph.nodes.size).toBe(0)
      expect(graph.edges.size).toBe(0)
    })

    it('should return zero for aggregated metrics initially', () => {
      expect(lineageTracker.getTotalOperations()).toBe(0)
      expect(lineageTracker.getAverageProcessingTime()).toBe(0)
      expect(lineageTracker.getSuccessRate()).toBe(0)
    })
  })

  describe('Lineage Tracking Lifecycle', () => {
    const createSampleTransformation = (step: string, timestamp: number = Date.now()): TransformationStep => ({
      step,
      inputSchema: { symbol: 'string', price: 'number' },
      outputSchema: { symbol: 'string', normalizedPrice: 'number' },
      timestamp,
      duration: 50,
      metadata: { processor: 'test_processor' }
    })

    const createSampleValidation = (rule: string, passed: boolean = true): ValidationStep => ({
      rule,
      passed,
      timestamp: Date.now(),
      severity: passed ? 'info' : 'warning',
      message: `Validation rule ${rule} ${passed ? 'passed' : 'failed'}`
    })

    const createSampleQualityCheck = (metric: string, score: number = 0.9): QualityCheck => ({
      metric,
      score,
      threshold: 0.7,
      passed: score >= 0.7,
      timestamp: Date.now()
    })

    it('should start tracking and return tracking ID', () => {
      const trackingId = lineageTracker.startTracking(
        'polygon_api',
        'stock_price',
        { symbol: 'AAPL', exchange: 'NASDAQ' }
      )

      expect(trackingId).toBeDefined()
      expect(typeof trackingId).toBe('string')
      expect(trackingId).toContain('lineage_')
      expect(trackingId).toContain('polygon_api')
      expect(trackingId).toContain('stock_price')
    })

    it('should add source node to lineage graph when starting tracking', () => {
      const trackingId = lineageTracker.startTracking(
        'polygon_api',
        'stock_price',
        { symbol: 'AAPL' }
      )

      const graph = lineageTracker.getLineageGraph()
      expect(graph.nodes.size).toBe(1)

      const sourceNode = Array.from(graph.nodes.values())[0]
      expect(sourceNode.type).toBe('source')
      expect(sourceNode.name).toBe('polygon_api')
      expect(sourceNode.metadata.dataType).toBe('stock_price')
      expect(sourceNode.metadata.symbol).toBe('AAPL')
    })

    it('should add transformation steps to tracking', () => {
      const trackingId = lineageTracker.startTracking('polygon_api', 'stock_price', {})
      const transformation = createSampleTransformation('normalize_prices')

      expect(() => {
        lineageTracker.addTransformation(trackingId, transformation)
      }).not.toThrow()

      const graph = lineageTracker.getLineageGraph()
      expect(graph.nodes.size).toBe(2) // source + transformation

      const transformationNode = Array.from(graph.nodes.values())
        .find(node => node.type === 'transformation')
      expect(transformationNode).toBeDefined()
      expect(transformationNode?.name).toBe('normalize_prices')
    })

    it('should add validation steps to tracking', () => {
      const trackingId = lineageTracker.startTracking('polygon_api', 'stock_price', {})
      const validation = createSampleValidation('price_range_check', true)

      expect(() => {
        lineageTracker.addValidation(trackingId, validation)
      }).not.toThrow()

      const graph = lineageTracker.getLineageGraph()
      expect(graph.nodes.size).toBe(2) // source + validation

      const validationNode = Array.from(graph.nodes.values())
        .find(node => node.type === 'validation')
      expect(validationNode).toBeDefined()
      expect(validationNode?.name).toBe('price_range_check')
      expect(validationNode?.metadata.passed).toBe(true)
    })

    it('should add quality checks to tracking', () => {
      const trackingId = lineageTracker.startTracking('polygon_api', 'stock_price', {})
      const qualityCheck = createSampleQualityCheck('freshness', 0.95)

      expect(() => {
        lineageTracker.addQualityCheck(trackingId, qualityCheck)
      }).not.toThrow()

      const graph = lineageTracker.getLineageGraph()
      expect(graph.nodes.size).toBe(2) // source + quality_check

      const qualityNode = Array.from(graph.nodes.values())
        .find(node => node.type === 'quality_check')
      expect(qualityNode).toBeDefined()
      expect(qualityNode?.name).toBe('freshness')
      expect(qualityNode?.metadata.score).toBe(0.95)
    })

    it('should finalize tracking and create lineage info', () => {
      const trackingId = lineageTracker.startTracking('polygon_api', 'stock_price', { symbol: 'AAPL' })

      // Add various tracking steps
      lineageTracker.addTransformation(trackingId, createSampleTransformation('normalize_prices'))
      lineageTracker.addValidation(trackingId, createSampleValidation('price_validation'))
      lineageTracker.addQualityCheck(trackingId, createSampleQualityCheck('accuracy'))

      const result = { success: true, processingTime: 150 }
      const lineageInfo = lineageTracker.finalizeTracking(trackingId, result)

      expect(lineageInfo).toBeDefined()
      expect(lineageInfo.sourceId).toBe('polygon_api')
      expect(lineageInfo.transformations).toHaveLength(1)
      expect(lineageInfo.validationSteps).toHaveLength(1)
      expect(lineageInfo.qualityChecks).toHaveLength(1)
      expect(lineageInfo.processingLatency).toBe(150)
    })

    it('should add output node when finalizing', () => {
      const trackingId = lineageTracker.startTracking('polygon_api', 'stock_price', {})

      const result = { success: true, processingTime: 100 }
      lineageTracker.finalizeTracking(trackingId, result)

      const graph = lineageTracker.getLineageGraph()
      const outputNode = Array.from(graph.nodes.values())
        .find(node => node.type === 'output')

      expect(outputNode).toBeDefined()
      expect(outputNode?.name).toBe('success')
      expect(outputNode?.metadata.success).toBe(true)
      expect(outputNode?.metadata.processingTime).toBe(100)
    })

    it('should handle failure cases in finalization', () => {
      const trackingId = lineageTracker.startTracking('polygon_api', 'stock_price', {})

      const result = { success: false, processingTime: 200 }
      const lineageInfo = lineageTracker.finalizeTracking(trackingId, result)

      expect(lineageInfo).toBeDefined()
      expect(lineageInfo.processingLatency).toBe(200)

      const graph = lineageTracker.getLineageGraph()
      const outputNode = Array.from(graph.nodes.values())
        .find(node => node.type === 'output')

      expect(outputNode?.name).toBe('failure')
      expect(outputNode?.metadata.success).toBe(false)
    })

    it('should throw error when finalizing non-existent tracking', () => {
      expect(() => {
        lineageTracker.finalizeTracking('non_existent_id', { success: true, processingTime: 100 })
      }).toThrow('No active tracking found for ID: non_existent_id')
    })
  })

  describe('Edge Connection Management', () => {
    it('should create edges between connected nodes', () => {
      const trackingId = lineageTracker.startTracking('polygon_api', 'stock_price', {})

      // Add steps in sequence
      lineageTracker.addTransformation(trackingId, {
        step: 'step1',
        inputSchema: {},
        outputSchema: {},
        timestamp: Date.now(),
        duration: 10,
        metadata: {}
      })

      lineageTracker.addValidation(trackingId, {
        rule: 'validation1',
        passed: true,
        timestamp: Date.now() + 100,
        severity: 'info',
        message: 'validation passed'
      })

      lineageTracker.finalizeTracking(trackingId, { success: true, processingTime: 50 })

      const graph = lineageTracker.getLineageGraph()
      expect(graph.edges.size).toBeGreaterThan(0)

      // Check that edges exist between nodes
      const edgeExists = Array.from(graph.edges.values()).some(targets => targets.length > 0)
      expect(edgeExists).toBe(true)
    })

    it('should maintain chronological order in node connections', () => {
      const trackingId = lineageTracker.startTracking('polygon_api', 'stock_price', {})

      const baseTime = Date.now()
      lineageTracker.addTransformation(trackingId, {
        step: 'first_transform',
        inputSchema: {},
        outputSchema: {},
        timestamp: baseTime + 100,
        duration: 10,
        metadata: {}
      })

      lineageTracker.addTransformation(trackingId, {
        step: 'second_transform',
        inputSchema: {},
        outputSchema: {},
        timestamp: baseTime + 200,
        duration: 10,
        metadata: {}
      })

      lineageTracker.finalizeTracking(trackingId, { success: true, processingTime: 50 })

      const graph = lineageTracker.getLineageGraph()
      const nodes = Array.from(graph.nodes.values()).sort((a, b) => a.timestamp - b.timestamp)

      expect(nodes[0].type).toBe('source')
      expect(nodes[1].name).toBe('first_transform')
      expect(nodes[2].name).toBe('second_transform')
      expect(nodes[3].type).toBe('output')
    })
  })

  describe('Lineage Querying', () => {
    const setupComplexLineage = () => {
      const trackingIds: string[] = []

      // Create multiple lineages with different sources and data types
      const configs = [
        { source: 'polygon_api', dataType: 'stock_price', symbol: 'AAPL', success: true },
        { source: 'yahoo_finance', dataType: 'stock_price', symbol: 'AAPL', success: true },
        { source: 'polygon_api', dataType: 'company_info', symbol: 'GOOGL', success: false },
        { source: 'alpha_vantage', dataType: 'news', symbol: 'TSLA', success: true }
      ]

      configs.forEach((config, index) => {
        const trackingId = lineageTracker.startTracking(
          config.source,
          config.dataType,
          { symbol: config.symbol }
        )

        lineageTracker.addTransformation(trackingId, {
          step: 'normalize_data',
          inputSchema: {},
          outputSchema: {},
          timestamp: Date.now() + (index * 1000),
          duration: 50,
          metadata: { symbol: config.symbol }
        })

        lineageTracker.finalizeTracking(trackingId, {
          success: config.success,
          processingTime: 100 + (index * 10)
        })

        trackingIds.push(trackingId)
      })

      return trackingIds
    }

    it('should query lineage by source ID', () => {
      setupComplexLineage()

      const query: LineageQuery = { sourceId: 'polygon_api' }
      const results = lineageTracker.queryLineage(query)

      expect(results).toHaveLength(2) // polygon_api appears twice
      results.forEach(lineage => {
        expect(lineage.sourceId).toBe('polygon_api')
      })
    })

    it('should query lineage by symbol in metadata', () => {
      setupComplexLineage()

      const query: LineageQuery = { symbol: 'AAPL' }
      const results = lineageTracker.queryLineage(query)

      expect(results).toHaveLength(2) // AAPL appears in 2 lineages
      results.forEach(lineage => {
        const hasAppleSymbol = lineage.transformations.some(t =>
          t.metadata && t.metadata.symbol === 'AAPL'
        )
        expect(hasAppleSymbol).toBe(true)
      })
    })

    it('should query lineage by time range', () => {
      const startTime = Date.now()
      setupComplexLineage()
      const endTime = Date.now()

      const query: LineageQuery = {
        timeRange: { start: startTime - 1000, end: endTime + 1000 }
      }
      const results = lineageTracker.queryLineage(query)

      expect(results.length).toBeGreaterThan(0)
      results.forEach(lineage => {
        expect(lineage.timestamp).toBeGreaterThanOrEqual(startTime - 1000)
        expect(lineage.timestamp).toBeLessThanOrEqual(endTime + 1000)
      })
    })

    it('should filter content based on inclusion flags', () => {
      setupComplexLineage()

      // Test excluding transformations
      const query1: LineageQuery = { includeTransformations: false }
      const results1 = lineageTracker.queryLineage(query1)
      results1.forEach(lineage => {
        expect(lineage.transformations).toHaveLength(0)
      })

      // Test excluding validations
      const query2: LineageQuery = { includeValidations: false }
      const results2 = lineageTracker.queryLineage(query2)
      results2.forEach(lineage => {
        expect(lineage.validationSteps).toHaveLength(0)
      })

      // Test excluding quality checks
      const query3: LineageQuery = { includeQualityChecks: false }
      const results3 = lineageTracker.queryLineage(query3)
      results3.forEach(lineage => {
        expect(lineage.qualityChecks).toHaveLength(0)
      })
    })

    it('should return results sorted by timestamp (most recent first)', () => {
      setupComplexLineage()

      const results = lineageTracker.queryLineage({})

      expect(results.length).toBeGreaterThan(1)
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].timestamp).toBeGreaterThanOrEqual(results[i].timestamp)
      }
    })

    it('should handle empty query gracefully', () => {
      setupComplexLineage()

      const results = lineageTracker.queryLineage({})
      expect(results.length).toBe(4) // All lineages should be returned
    })

    it('should handle query with no matches', () => {
      setupComplexLineage()

      const query: LineageQuery = { sourceId: 'non_existent_source' }
      const results = lineageTracker.queryLineage(query)

      expect(results).toHaveLength(0)
    })
  })

  describe('Lineage Graph Management', () => {
    it('should return complete lineage graph without query', () => {
      const trackingId = lineageTracker.startTracking('polygon_api', 'stock_price', {})
      lineageTracker.addTransformation(trackingId, {
        step: 'normalize',
        inputSchema: {},
        outputSchema: {},
        timestamp: Date.now(),
        duration: 50,
        metadata: {}
      })
      lineageTracker.finalizeTracking(trackingId, { success: true, processingTime: 100 })

      const graph = lineageTracker.getLineageGraph()

      expect(graph.nodes.size).toBe(3) // source + transformation + output
      expect(graph.edges.size).toBeGreaterThan(0)
    })

    it('should filter lineage graph by query parameters', () => {
      // Setup data with different sources
      const trackingId1 = lineageTracker.startTracking('polygon_api', 'stock_price', {})
      lineageTracker.finalizeTracking(trackingId1, { success: true, processingTime: 100 })

      const trackingId2 = lineageTracker.startTracking('yahoo_finance', 'company_info', {})
      lineageTracker.finalizeTracking(trackingId2, { success: true, processingTime: 100 })

      const query: LineageQuery = { sourceId: 'polygon_api' }
      const filteredGraph = lineageTracker.getLineageGraph(query)

      // Should only contain nodes related to polygon_api
      const sourceNodes = Array.from(filteredGraph.nodes.values())
        .filter(node => node.type === 'source')

      expect(sourceNodes).toHaveLength(1)
      expect(sourceNodes[0].name).toBe('polygon_api')
    })

    it('should filter graph by data type', () => {
      const trackingId1 = lineageTracker.startTracking('polygon_api', 'stock_price', {})
      lineageTracker.finalizeTracking(trackingId1, { success: true, processingTime: 100 })

      const trackingId2 = lineageTracker.startTracking('polygon_api', 'company_info', {})
      lineageTracker.finalizeTracking(trackingId2, { success: true, processingTime: 100 })

      const query: LineageQuery = { dataType: 'stock_price' }
      const filteredGraph = lineageTracker.getLineageGraph(query)

      const relevantNodes = Array.from(filteredGraph.nodes.values())
        .filter(node => node.metadata.dataType === 'stock_price' || !node.metadata.dataType)

      expect(relevantNodes.length).toBeGreaterThan(0)
    })

    it('should maintain edge consistency in filtered graphs', () => {
      const trackingId = lineageTracker.startTracking('polygon_api', 'stock_price', {})
      lineageTracker.addTransformation(trackingId, {
        step: 'transform',
        inputSchema: {},
        outputSchema: {},
        timestamp: Date.now(),
        duration: 50,
        metadata: {}
      })
      lineageTracker.finalizeTracking(trackingId, { success: true, processingTime: 100 })

      const graph = lineageTracker.getLineageGraph()

      // Verify edges only reference existing nodes
      for (const [sourceId, targets] of graph.edges.entries()) {
        expect(graph.nodes.has(sourceId)).toBe(true)
        targets.forEach(targetId => {
          expect(graph.nodes.has(targetId)).toBe(true)
        })
      }
    })
  })

  describe('Statistics and Metrics', () => {
    const createTestLineage = (sourceId: string, success: boolean, processingTime: number) => {
      const trackingId = lineageTracker.startTracking(sourceId, 'stock_price', { symbol: 'TEST' })

      // Add some transformations and quality checks
      for (let i = 0; i < 2; i++) {
        lineageTracker.addTransformation(trackingId, {
          step: `transform_${i}`,
          inputSchema: {},
          outputSchema: {},
          timestamp: Date.now() + i,
          duration: 25,
          metadata: {}
        })
      }

      lineageTracker.addQualityCheck(trackingId, {
        metric: 'accuracy',
        score: success ? 0.9 : 0.4,
        threshold: 0.7,
        passed: success,
        timestamp: Date.now()
      })

      lineageTracker.finalizeTracking(trackingId, { success, processingTime })
    }

    it('should track total operations correctly', () => {
      createTestLineage('source1', true, 100)
      createTestLineage('source2', false, 200)
      createTestLineage('source3', true, 150)

      expect(lineageTracker.getTotalOperations()).toBe(3)

      const stats = lineageTracker.getStatistics()
      expect(stats.totalOperations).toBe(3)
    })

    it('should calculate success rate correctly', () => {
      createTestLineage('source1', true, 100)   // success
      createTestLineage('source2', false, 200)  // failure
      createTestLineage('source3', true, 150)   // success

      const successRate = lineageTracker.getSuccessRate()
      expect(successRate).toBeCloseTo(2/3, 2) // 2 successes out of 3

      const stats = lineageTracker.getStatistics()
      expect(stats.successRate).toBeCloseTo(2/3, 2)
    })

    it('should calculate average processing time correctly', () => {
      createTestLineage('source1', true, 100)
      createTestLineage('source2', false, 200)
      createTestLineage('source3', true, 300)

      const avgTime = lineageTracker.getAverageProcessingTime()
      const expectedAvg = (100 + 200 + 300) / 3
      expect(avgTime).toBeCloseTo(expectedAvg, 1)

      const stats = lineageTracker.getStatistics()
      expect(stats.averageProcessingTime).toBeCloseTo(expectedAvg, 1)
    })

    it('should track operations by data type', () => {
      const trackingId1 = lineageTracker.startTracking('source1', 'stock_price', {})
      const trackingId2 = lineageTracker.startTracking('source2', 'company_info', {})
      const trackingId3 = lineageTracker.startTracking('source3', 'stock_price', {})

      lineageTracker.finalizeTracking(trackingId1, { success: true, processingTime: 100 })
      lineageTracker.finalizeTracking(trackingId2, { success: true, processingTime: 100 })
      lineageTracker.finalizeTracking(trackingId3, { success: true, processingTime: 100 })

      const stats = lineageTracker.getStatistics()
      expect(stats.operationsByType['stock_price']).toBe(2)
      expect(stats.operationsByType['company_info']).toBe(1)
    })

    it('should track source usage statistics', () => {
      createTestLineage('polygon', true, 100)
      createTestLineage('polygon', false, 200)
      createTestLineage('yahoo', true, 150)

      const stats = lineageTracker.getStatistics()

      expect(stats.sourceUsage['polygon']).toBeDefined()
      expect(stats.sourceUsage['polygon'].operationCount).toBe(2)
      expect(stats.sourceUsage['polygon'].successRate).toBe(0.5) // 1 success out of 2
      expect(stats.sourceUsage['polygon'].averageLatency).toBeCloseTo(150, 1) // (100 + 200) / 2

      expect(stats.sourceUsage['yahoo']).toBeDefined()
      expect(stats.sourceUsage['yahoo'].operationCount).toBe(1)
      expect(stats.sourceUsage['yahoo'].successRate).toBe(1.0)
    })

    it('should track data type metrics including quality scores', () => {
      createTestLineage('source1', true, 100)  // Quality score: 0.9
      createTestLineage('source2', false, 200) // Quality score: 0.4

      const stats = lineageTracker.getStatistics()

      expect(stats.dataTypeMetrics['stock_price']).toBeDefined()
      expect(stats.dataTypeMetrics['stock_price'].operationCount).toBe(2)
      expect(stats.dataTypeMetrics['stock_price'].averageTransformationSteps).toBe(2) // Each lineage has 2 transformations
      expect(stats.dataTypeMetrics['stock_price'].averageQualityScore).toBeCloseTo(0.65, 2) // (0.9 + 0.4) / 2
    })
  })

  describe('Data Export and Persistence', () => {
    const setupExportData = () => {
      const trackingId = lineageTracker.startTracking('polygon_api', 'stock_price', { symbol: 'AAPL' })

      lineageTracker.addTransformation(trackingId, {
        step: 'normalize_prices',
        inputSchema: { price: 'number' },
        outputSchema: { normalizedPrice: 'number' },
        timestamp: Date.now(),
        duration: 50,
        metadata: { version: '1.0' }
      })

      lineageTracker.addValidation(trackingId, {
        rule: 'price_validation',
        passed: true,
        timestamp: Date.now(),
        severity: 'info',
        message: 'Price validation passed'
      })

      lineageTracker.finalizeTracking(trackingId, { success: true, processingTime: 125 })
    }

    it('should export lineage data as JSON', () => {
      setupExportData()

      const jsonData = lineageTracker.exportLineageData('json')
      expect(typeof jsonData).toBe('string')

      const parsed = JSON.parse(jsonData)
      expect(parsed.completedLineage).toBeDefined()
      expect(parsed.statistics).toBeDefined()
      expect(parsed.graph).toBeDefined()
      expect(parsed.graph.nodes).toBeDefined()
      expect(parsed.graph.edges).toBeDefined()
    })

    it('should export lineage data as CSV', () => {
      setupExportData()

      const csvData = lineageTracker.exportLineageData('csv')
      expect(typeof csvData).toBe('string')

      const lines = csvData.split('\n')
      expect(lines[0]).toContain('TrackingId') // Header row
      expect(lines[0]).toContain('SourceId')
      expect(lines[0]).toContain('ProcessingLatency')

      expect(lines[1]).toContain('polygon_api') // Data row
      expect(lines[1]).toContain('125') // Processing latency
    })

    it('should throw error for unsupported export format', () => {
      setupExportData()

      expect(() => {
        lineageTracker.exportLineageData('xml' as any)
      }).toThrow('Unsupported export format: xml')
    })

    it('should handle empty data export gracefully', () => {
      const jsonData = lineageTracker.exportLineageData('json')
      const parsed = JSON.parse(jsonData)

      expect(parsed.completedLineage).toEqual([])
      expect(parsed.statistics.totalOperations).toBe(0)

      const csvData = lineageTracker.exportLineageData('csv')
      const lines = csvData.split('\n').filter(line => line.trim())
      expect(lines).toHaveLength(1) // Only header row
    })
  })

  describe('Lineage History Management', () => {
    it('should maintain lineage history within limits', () => {
      // Since maxLineageHistory is 10000, we can't easily test the limit in unit tests
      // but we can verify the basic functionality
      const trackingId = lineageTracker.startTracking('test_source', 'stock_price', {})
      lineageTracker.finalizeTracking(trackingId, { success: true, processingTime: 100 })

      const lineageInfo = lineageTracker.getLineageById(trackingId)
      expect(lineageInfo).toBeDefined()
      expect(lineageInfo?.sourceId).toBe('test_source')
    })

    it('should return null for non-existent lineage ID', () => {
      const lineageInfo = lineageTracker.getLineageById('non_existent_id')
      expect(lineageInfo).toBeNull()
    })

    it('should remove tracking from active list after finalization', () => {
      const trackingId = lineageTracker.startTracking('test_source', 'stock_price', {})

      // Before finalization, we can add steps (no error thrown)
      expect(() => {
        lineageTracker.addTransformation(trackingId, {
          step: 'test_transform',
          inputSchema: {},
          outputSchema: {},
          timestamp: Date.now(),
          duration: 50,
          metadata: {}
        })
      }).not.toThrow()

      lineageTracker.finalizeTracking(trackingId, { success: true, processingTime: 100 })

      // After finalization, adding steps should log warning (but not throw)
      expect(() => {
        lineageTracker.addTransformation(trackingId, {
          step: 'another_transform',
          inputSchema: {},
          outputSchema: {},
          timestamp: Date.now(),
          duration: 50,
          metadata: {}
        })
      }).not.toThrow() // Should just log warning
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle adding steps to non-existent tracking gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

      lineageTracker.addTransformation('non_existent_id', {
        step: 'test_transform',
        inputSchema: {},
        outputSchema: {},
        timestamp: Date.now(),
        duration: 50,
        metadata: {}
      })

      expect(consoleSpy).toHaveBeenCalledWith('No active tracking found for ID: non_existent_id')
      consoleSpy.mockRestore()
    })

    it('should handle validation steps with non-existent tracking', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

      lineageTracker.addValidation('non_existent_id', {
        rule: 'test_rule',
        passed: true,
        timestamp: Date.now(),
        severity: 'info',
        message: 'test message'
      })

      expect(consoleSpy).toHaveBeenCalledWith('No active tracking found for ID: non_existent_id')
      consoleSpy.mockRestore()
    })

    it('should handle quality checks with non-existent tracking', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

      lineageTracker.addQualityCheck('non_existent_id', {
        metric: 'test_metric',
        score: 0.8,
        threshold: 0.7,
        passed: true,
        timestamp: Date.now()
      })

      expect(consoleSpy).toHaveBeenCalledWith('No active tracking found for ID: non_existent_id')
      consoleSpy.mockRestore()
    })

    it('should generate unique tracking IDs', () => {
      const ids = new Set<string>()

      for (let i = 0; i < 100; i++) {
        const trackingId = lineageTracker.startTracking('test_source', 'test_type', {})
        expect(ids.has(trackingId)).toBe(false)
        ids.add(trackingId)

        // Clean up
        lineageTracker.finalizeTracking(trackingId, { success: true, processingTime: 100 })
      }
    })

    it('should handle rapid concurrent tracking operations', () => {
      const trackingIds: string[] = []

      // Start multiple tracking operations quickly
      for (let i = 0; i < 50; i++) {
        const trackingId = lineageTracker.startTracking(`source_${i}`, 'stock_price', { index: i })
        trackingIds.push(trackingId)

        lineageTracker.addTransformation(trackingId, {
          step: `transform_${i}`,
          inputSchema: {},
          outputSchema: {},
          timestamp: Date.now() + i,
          duration: 10,
          metadata: { index: i }
        })
      }

      // Finalize all tracking operations
      trackingIds.forEach((trackingId, index) => {
        expect(() => {
          lineageTracker.finalizeTracking(trackingId, { success: true, processingTime: 50 })
        }).not.toThrow()
      })

      expect(lineageTracker.getTotalOperations()).toBe(50)
    })
  })

  describe('State Management and Reset', () => {
    it('should reset all tracker state', () => {
      // Setup some tracking data
      const trackingId = lineageTracker.startTracking('test_source', 'stock_price', {})
      lineageTracker.addTransformation(trackingId, {
        step: 'test_transform',
        inputSchema: {},
        outputSchema: {},
        timestamp: Date.now(),
        duration: 50,
        metadata: {}
      })
      lineageTracker.finalizeTracking(trackingId, { success: true, processingTime: 100 })

      // Verify data exists
      expect(lineageTracker.getTotalOperations()).toBe(1)
      expect(lineageTracker.getLineageGraph().nodes.size).toBeGreaterThan(0)

      // Reset and verify clean state
      lineageTracker.reset()

      expect(lineageTracker.getTotalOperations()).toBe(0)
      expect(lineageTracker.getAverageProcessingTime()).toBe(0)
      expect(lineageTracker.getSuccessRate()).toBe(0)
      expect(lineageTracker.getLineageGraph().nodes.size).toBe(0)
      expect(lineageTracker.getLineageGraph().edges.size).toBe(0)
      expect(lineageTracker.queryLineage({})).toHaveLength(0)
    })

    it('should maintain immutable statistics objects', () => {
      const trackingId = lineageTracker.startTracking('test_source', 'stock_price', {})
      lineageTracker.finalizeTracking(trackingId, { success: true, processingTime: 100 })

      const stats1 = lineageTracker.getStatistics()
      const stats2 = lineageTracker.getStatistics()

      expect(stats1).not.toBe(stats2) // Different object references
      expect(stats1).toEqual(stats2) // Same content
    })

    it('should maintain immutable graph objects', () => {
      const trackingId = lineageTracker.startTracking('test_source', 'stock_price', {})
      lineageTracker.finalizeTracking(trackingId, { success: true, processingTime: 100 })

      const graph1 = lineageTracker.getLineageGraph()
      const graph2 = lineageTracker.getLineageGraph()

      expect(graph1.nodes).not.toBe(graph2.nodes) // Different Map objects
      expect(graph1.edges).not.toBe(graph2.edges)
      expect(graph1.nodes.size).toBe(graph2.nodes.size) // Same content
    })
  })

  describe('Performance Testing', () => {
    it('should handle large-scale lineage tracking efficiently', () => {
      const startTime = Date.now()
      const operationCount = 1000

      for (let i = 0; i < operationCount; i++) {
        const trackingId = lineageTracker.startTracking(`source_${i % 10}`, 'stock_price', { index: i })

        // Add minimal transformations for performance testing
        lineageTracker.addTransformation(trackingId, {
          step: 'normalize',
          inputSchema: {},
          outputSchema: {},
          timestamp: Date.now() + i,
          duration: 1,
          metadata: {}
        })

        lineageTracker.finalizeTracking(trackingId, { success: i % 10 !== 0, processingTime: 10 })
      }

      const endTime = Date.now()
      const totalTime = endTime - startTime

      expect(totalTime).toBeLessThan(5000) // Should complete within 5 seconds
      expect(lineageTracker.getTotalOperations()).toBe(operationCount)
    })

    it('should query large datasets efficiently', () => {
      // Setup data
      for (let i = 0; i < 500; i++) {
        const trackingId = lineageTracker.startTracking(`source_${i % 5}`, `type_${i % 3}`, { index: i })
        lineageTracker.finalizeTracking(trackingId, { success: true, processingTime: 50 })
      }

      const startTime = Date.now()

      // Perform complex query
      const results = lineageTracker.queryLineage({
        sourceId: 'source_1',
        timeRange: { start: Date.now() - 10000, end: Date.now() + 10000 }
      })

      const endTime = Date.now()
      const queryTime = endTime - startTime

      expect(queryTime).toBeLessThan(100) // Should complete within 100ms
      expect(results.length).toBeGreaterThan(0)
    })
  })
})