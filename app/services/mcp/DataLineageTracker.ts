/**
 * Data Lineage Tracker for MCP Financial Intelligence Platform
 * Tracks data sources, transformations, and quality checkpoints for complete data lineage
 */

import {
  DataLineageInfo,
  TransformationStep,
  ValidationStep,
  QualityCheck
} from './DataNormalizationPipeline'

export interface LineageNode {
  id: string
  type: 'source' | 'transformation' | 'validation' | 'quality_check' | 'output'
  name: string
  timestamp: number
  metadata: Record<string, any>
  inputs?: string[]
  outputs?: string[]
}

export interface LineageGraph {
  nodes: Map<string, LineageNode>
  edges: Map<string, string[]> // nodeId -> [connectedNodeIds]
}

export interface LineageQuery {
  sourceId?: string
  dataType?: string
  symbol?: string
  timeRange?: { start: number; end: number }
  includeTransformations?: boolean
  includeValidations?: boolean
  includeQualityChecks?: boolean
}

export interface LineageStatistics {
  totalOperations: number
  operationsByType: Record<string, number>
  averageProcessingTime: number
  successRate: number
  sourceUsage: Record<string, {
    operationCount: number
    successRate: number
    averageLatency: number
  }>
  dataTypeMetrics: Record<string, {
    operationCount: number
    averageTransformationSteps: number
    averageQualityScore: number
  }>
}

export class DataLineageTracker {
  private activeTracking: Map<string, LineageTracking> = new Map()
  private completedLineage: Map<string, DataLineageInfo> = new Map()
  private lineageGraph: LineageGraph = {
    nodes: new Map(),
    edges: new Map()
  }
  private statistics: LineageStatistics
  private readonly maxLineageHistory = 10000 // Keep last 10,000 completed lineages

  constructor() {
    this.statistics = this.initializeStatistics()
  }

  /**
   * Start tracking a new data lineage
   */
  startTracking(
    sourceId: string,
    dataType: string,
    context: Record<string, any>
  ): string {
    const trackingId = this.generateTrackingId(sourceId, dataType)
    const startTime = Date.now()

    const tracking: LineageTracking = {
      id: trackingId,
      sourceId,
      dataType,
      startTime,
      transformations: [],
      validationSteps: [],
      qualityChecks: [],
      context,
      status: 'active'
    }

    this.activeTracking.set(trackingId, tracking)

    // Add source node to lineage graph
    const sourceNodeId = `source_${sourceId}_${startTime}`
    this.lineageGraph.nodes.set(sourceNodeId, {
      id: sourceNodeId,
      type: 'source',
      name: sourceId,
      timestamp: startTime,
      metadata: { dataType, ...context }
    })

    return trackingId
  }

  /**
   * Add a transformation step to active tracking
   */
  addTransformation(trackingId: string, transformation: TransformationStep): void {
    const tracking = this.activeTracking.get(trackingId)
    if (!tracking) {
      console.warn(`No active tracking found for ID: ${trackingId}`)
      return
    }

    tracking.transformations.push(transformation)

    // Add transformation node to lineage graph
    const nodeId = `transform_${trackingId}_${transformation.step}_${transformation.timestamp}`
    this.lineageGraph.nodes.set(nodeId, {
      id: nodeId,
      type: 'transformation',
      name: transformation.step,
      timestamp: transformation.timestamp,
      metadata: {
        inputSchema: transformation.inputSchema,
        outputSchema: transformation.outputSchema,
        duration: transformation.duration,
        ...transformation.metadata
      }
    })

    // Add edge from previous node
    this.addEdgeToGraph(tracking, nodeId)
  }

  /**
   * Add a validation step to active tracking
   */
  addValidation(trackingId: string, validation: ValidationStep): void {
    const tracking = this.activeTracking.get(trackingId)
    if (!tracking) {
      console.warn(`No active tracking found for ID: ${trackingId}`)
      return
    }

    tracking.validationSteps.push(validation)

    // Add validation node to lineage graph
    const nodeId = `validation_${trackingId}_${validation.rule}_${validation.timestamp}`
    this.lineageGraph.nodes.set(nodeId, {
      id: nodeId,
      type: 'validation',
      name: validation.rule,
      timestamp: validation.timestamp,
      metadata: {
        passed: validation.passed,
        severity: validation.severity,
        message: validation.message
      }
    })

    // Add edge from previous node
    this.addEdgeToGraph(tracking, nodeId)
  }

  /**
   * Add a quality check to active tracking
   */
  addQualityCheck(trackingId: string, qualityCheck: QualityCheck): void {
    const tracking = this.activeTracking.get(trackingId)
    if (!tracking) {
      console.warn(`No active tracking found for ID: ${trackingId}`)
      return
    }

    tracking.qualityChecks.push(qualityCheck)

    // Add quality check node to lineage graph
    const nodeId = `quality_${trackingId}_${qualityCheck.metric}_${qualityCheck.timestamp}`
    this.lineageGraph.nodes.set(nodeId, {
      id: nodeId,
      type: 'quality_check',
      name: qualityCheck.metric,
      timestamp: qualityCheck.timestamp,
      metadata: {
        score: qualityCheck.score,
        threshold: qualityCheck.threshold,
        passed: qualityCheck.passed
      }
    })

    // Add edge from previous node
    this.addEdgeToGraph(tracking, nodeId)
  }

  /**
   * Finalize tracking and create lineage info
   */
  finalizeTracking(
    trackingId: string,
    result: { success: boolean; processingTime: number }
  ): DataLineageInfo {
    const tracking = this.activeTracking.get(trackingId)
    if (!tracking) {
      throw new Error(`No active tracking found for ID: ${trackingId}`)
    }

    const lineageInfo: DataLineageInfo = {
      sourceId: tracking.sourceId,
      transformations: tracking.transformations,
      validationSteps: tracking.validationSteps,
      qualityChecks: tracking.qualityChecks,
      timestamp: tracking.startTime,
      processingLatency: result.processingTime
    }

    // Add output node to lineage graph
    const outputNodeId = `output_${trackingId}_${Date.now()}`
    this.lineageGraph.nodes.set(outputNodeId, {
      id: outputNodeId,
      type: 'output',
      name: result.success ? 'success' : 'failure',
      timestamp: Date.now(),
      metadata: {
        success: result.success,
        processingTime: result.processingTime,
        dataType: tracking.dataType
      }
    })

    // Add final edge
    this.addEdgeToGraph(tracking, outputNodeId)

    // Store completed lineage
    this.completedLineage.set(trackingId, lineageInfo)
    this.maintainLineageHistory()

    // Update statistics
    this.updateStatistics(tracking, result.success, result.processingTime)

    // Remove from active tracking
    this.activeTracking.delete(trackingId)

    return lineageInfo
  }

  /**
   * Query lineage data
   */
  queryLineage(query: LineageQuery): DataLineageInfo[] {
    const results: DataLineageInfo[] = []

    this.completedLineage.forEach((lineage, trackingId) => {
      let matches = true

      // Filter by source
      if (query.sourceId && lineage.sourceId !== query.sourceId) {
        matches = false
      }

      // Filter by time range
      if (query.timeRange) {
        if (lineage.timestamp < query.timeRange.start || lineage.timestamp > query.timeRange.end) {
          matches = false
        }
      }

      // Filter by symbol (if present in context)
      if (query.symbol) {
        const hasSymbol = lineage.transformations.some(t =>
          t.metadata && t.metadata.symbol === query.symbol
        )
        if (!hasSymbol) {
          matches = false
        }
      }

      if (matches) {
        let filteredLineage = { ...lineage }

        // Apply content filters
        if (query.includeTransformations === false) {
          filteredLineage.transformations = []
        }
        if (query.includeValidations === false) {
          filteredLineage.validationSteps = []
        }
        if (query.includeQualityChecks === false) {
          filteredLineage.qualityChecks = []
        }

        results.push(filteredLineage)
      }
    })

    return results.sort((a, b) => b.timestamp - a.timestamp) // Most recent first
  }

  /**
   * Get lineage graph for visualization
   */
  getLineageGraph(query?: LineageQuery): LineageGraph {
    if (!query) {
      return {
        nodes: new Map(this.lineageGraph.nodes),
        edges: new Map(this.lineageGraph.edges)
      }
    }

    // Filter graph based on query
    const filteredNodes = new Map<string, LineageNode>()
    const filteredEdges = new Map<string, string[]>()

    this.lineageGraph.nodes.forEach((node, nodeId) => {
      let include = true

      // Filter by source
      if (query.sourceId && node.type === 'source' && node.name !== query.sourceId) {
        include = false
      }

      // Filter by time range
      if (query.timeRange) {
        if (node.timestamp < query.timeRange.start || node.timestamp > query.timeRange.end) {
          include = false
        }
      }

      // Filter by data type
      if (query.dataType && node.metadata.dataType && node.metadata.dataType !== query.dataType) {
        include = false
      }

      if (include) {
        filteredNodes.set(nodeId, node)
        if (this.lineageGraph.edges.has(nodeId)) {
          filteredEdges.set(nodeId, this.lineageGraph.edges.get(nodeId)!)
        }
      }
    })

    return {
      nodes: filteredNodes,
      edges: filteredEdges
    }
  }

  /**
   * Get data lineage for a specific operation
   */
  getLineageById(trackingId: string): DataLineageInfo | null {
    return this.completedLineage.get(trackingId) || null
  }

  /**
   * Get lineage statistics
   */
  getStatistics(): LineageStatistics {
    return { ...this.statistics }
  }

  /**
   * Get total operations tracked
   */
  getTotalOperations(): number {
    return this.statistics.totalOperations
  }

  /**
   * Get average processing time
   */
  getAverageProcessingTime(): number {
    return this.statistics.averageProcessingTime
  }

  /**
   * Get success rate
   */
  getSuccessRate(): number {
    return this.statistics.successRate
  }

  /**
   * Reset tracker state
   */
  reset(): void {
    this.activeTracking.clear()
    this.completedLineage.clear()
    this.lineageGraph = { nodes: new Map(), edges: new Map() }
    this.statistics = this.initializeStatistics()
  }

  /**
   * Export lineage data for external analysis
   */
  exportLineageData(format: 'json' | 'csv' = 'json'): string {
    if (format === 'json') {
      return JSON.stringify({
        completedLineage: Array.from(this.completedLineage.entries()),
        statistics: this.statistics,
        graph: {
          nodes: Array.from(this.lineageGraph.nodes.entries()),
          edges: Array.from(this.lineageGraph.edges.entries())
        }
      }, null, 2)
    }

    if (format === 'csv') {
      const headers = [
        'TrackingId', 'SourceId', 'Timestamp', 'ProcessingLatency',
        'TransformationCount', 'ValidationCount', 'QualityCheckCount'
      ]

      const rows = Array.from(this.completedLineage.entries()).map(([id, lineage]) => [
        id,
        lineage.sourceId,
        new Date(lineage.timestamp).toISOString(),
        lineage.processingLatency,
        lineage.transformations.length,
        lineage.validationSteps.length,
        lineage.qualityChecks.length
      ])

      return [headers.join(','), ...rows.map(row => row.join(','))].join('\n')
    }

    throw new Error(`Unsupported export format: ${format}`)
  }

  /**
   * Generate tracking ID
   */
  private generateTrackingId(sourceId: string, dataType: string): string {
    return `lineage_${sourceId}_${dataType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Add edge to lineage graph
   */
  private addEdgeToGraph(tracking: LineageTracking, nodeId: string): void {
    // Find the most recent node for this tracking ID to create edge
    const trackingNodes = Array.from(this.lineageGraph.nodes.entries())
      .filter(([id, node]) => id.includes(tracking.id))
      .sort((a, b) => b[1].timestamp - a[1].timestamp)

    if (trackingNodes.length > 1) {
      const previousNodeId = trackingNodes[1][0] // Second most recent
      if (!this.lineageGraph.edges.has(previousNodeId)) {
        this.lineageGraph.edges.set(previousNodeId, [])
      }
      this.lineageGraph.edges.get(previousNodeId)!.push(nodeId)
    }
  }

  /**
   * Initialize statistics
   */
  private initializeStatistics(): LineageStatistics {
    return {
      totalOperations: 0,
      operationsByType: {},
      averageProcessingTime: 0,
      successRate: 0,
      sourceUsage: {},
      dataTypeMetrics: {}
    }
  }

  /**
   * Update statistics
   */
  private updateStatistics(
    tracking: LineageTracking,
    success: boolean,
    processingTime: number
  ): void {
    this.statistics.totalOperations++

    // Update operation counts by type
    if (!this.statistics.operationsByType[tracking.dataType]) {
      this.statistics.operationsByType[tracking.dataType] = 0
    }
    this.statistics.operationsByType[tracking.dataType]++

    // Update average processing time
    this.statistics.averageProcessingTime =
      (this.statistics.averageProcessingTime * (this.statistics.totalOperations - 1) + processingTime) /
      this.statistics.totalOperations

    // Update success rate
    const totalSuccess = Math.floor(this.statistics.successRate * (this.statistics.totalOperations - 1))
    const newSuccessCount = success ? totalSuccess + 1 : totalSuccess
    this.statistics.successRate = newSuccessCount / this.statistics.totalOperations

    // Update source usage
    if (!this.statistics.sourceUsage[tracking.sourceId]) {
      this.statistics.sourceUsage[tracking.sourceId] = {
        operationCount: 0,
        successRate: 0,
        averageLatency: 0
      }
    }

    const sourceStats = this.statistics.sourceUsage[tracking.sourceId]
    const sourceSuccessCount = Math.floor(sourceStats.successRate * sourceStats.operationCount)
    const newSourceSuccessCount = success ? sourceSuccessCount + 1 : sourceSuccessCount

    sourceStats.averageLatency =
      (sourceStats.averageLatency * sourceStats.operationCount + processingTime) /
      (sourceStats.operationCount + 1)
    sourceStats.operationCount++
    sourceStats.successRate = newSourceSuccessCount / sourceStats.operationCount

    // Update data type metrics
    if (!this.statistics.dataTypeMetrics[tracking.dataType]) {
      this.statistics.dataTypeMetrics[tracking.dataType] = {
        operationCount: 0,
        averageTransformationSteps: 0,
        averageQualityScore: 0
      }
    }

    const typeStats = this.statistics.dataTypeMetrics[tracking.dataType]
    typeStats.averageTransformationSteps =
      (typeStats.averageTransformationSteps * typeStats.operationCount + tracking.transformations.length) /
      (typeStats.operationCount + 1)
    typeStats.operationCount++

    // Calculate average quality score from quality checks
    if (tracking.qualityChecks.length > 0) {
      const avgQualityScore = tracking.qualityChecks.reduce((sum, check) => sum + check.score, 0) / tracking.qualityChecks.length
      typeStats.averageQualityScore =
        (typeStats.averageQualityScore * (typeStats.operationCount - 1) + avgQualityScore) /
        typeStats.operationCount
    }
  }

  /**
   * Maintain lineage history within limits
   */
  private maintainLineageHistory(): void {
    if (this.completedLineage.size > this.maxLineageHistory) {
      // Remove oldest entries
      const entries = Array.from(this.completedLineage.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)

      const toRemove = entries.slice(0, entries.length - this.maxLineageHistory)
      toRemove.forEach(([id]) => {
        this.completedLineage.delete(id)
        // Also remove associated graph nodes
        this.removeGraphNodes(id)
      })
    }
  }

  /**
   * Remove graph nodes for a tracking ID
   */
  private removeGraphNodes(trackingId: string): void {
    const nodesToRemove: string[] = []

    this.lineageGraph.nodes.forEach((node, nodeId) => {
      if (nodeId.includes(trackingId)) {
        nodesToRemove.push(nodeId)
      }
    })

    nodesToRemove.forEach(nodeId => {
      this.lineageGraph.nodes.delete(nodeId)
      this.lineageGraph.edges.delete(nodeId)

      // Remove edges pointing to this node
      this.lineageGraph.edges.forEach((targets, sourceId) => {
        const filteredTargets = targets.filter(target => target !== nodeId)
        if (filteredTargets.length !== targets.length) {
          this.lineageGraph.edges.set(sourceId, filteredTargets)
        }
      })
    })
  }
}

/**
 * Internal tracking state
 */
interface LineageTracking {
  id: string
  sourceId: string
  dataType: string
  startTime: number
  transformations: TransformationStep[]
  validationSteps: ValidationStep[]
  qualityChecks: QualityCheck[]
  context: Record<string, any>
  status: 'active' | 'completed' | 'failed'
}