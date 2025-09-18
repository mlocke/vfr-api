/**
 * Core shared types for stock selection services
 * Replaces MCP dependencies with simple local types
 */

export interface QualityScore {
  overall: number
  metrics: {
    freshness: number
    completeness: number
    accuracy: number
    sourceReputation: number
    latency: number
  }
  timestamp: number
  source: string
}

export interface FusionResult {
  success: boolean
  data: any
  quality: QualityScore
  sources: string[]
  conflicts?: string[]
  fusedData: any
  qualityScore: QualityScore
}

export interface FusedMCPResponse {
  success: boolean
  data: any
  quality: QualityScore
  sources: string[]
  conflicts?: string[]
}

export type ConflictResolutionStrategy = 'highest_quality' | 'consensus' | 'weighted_average'

// Mock data fusion engine for basic functionality
export class MockDataFusionEngine {
  async fuseData(dataPoints: any[], options: any): Promise<FusedMCPResponse> {
    // Simple mock implementation
    return {
      success: true,
      data: dataPoints[0]?.data || {},
      quality: {
        overall: 0.8,
        metrics: {
          freshness: 0.9,
          completeness: 0.8,
          accuracy: 0.85,
          sourceReputation: 0.7,
          latency: 150
        },
        timestamp: Date.now(),
        source: 'mock_fusion'
      },
      sources: dataPoints.map(dp => dp.source || 'unknown')
    }
  }

  async fuseStockData(dataArray: any[], options: any): Promise<FusionResult> {
    return {
      success: true,
      data: dataArray[0] || {},
      quality: {
        overall: 0.8,
        metrics: {
          freshness: 0.9,
          completeness: 0.8,
          accuracy: 0.85,
          sourceReputation: 0.7,
          latency: 150
        },
        timestamp: Date.now(),
        source: 'mock_fusion'
      },
      sources: ['mock'],
      fusedData: dataArray[0] || {},
      qualityScore: {
        overall: 0.8,
        metrics: {
          freshness: 0.9,
          completeness: 0.8,
          accuracy: 0.85,
          sourceReputation: 0.7,
          latency: 150
        },
        timestamp: Date.now(),
        source: 'mock_fusion'
      }
    }
  }

  getStatistics() {
    return {
      totalRequests: 0,
      successRate: 1.0,
      averageResponseTime: 100
    }
  }
}

// Mock MCP client for basic functionality
export class MockMCPClient {
  async executeRequest(source: string, method: string, params: any): Promise<any> {
    // Simple mock responses
    return {
      success: true,
      data: {
        results: [],
        status: 'success'
      }
    }
  }

  async executeTool(tool: string, params: any): Promise<any> {
    return {
      success: true,
      data: {},
      error: null
    }
  }

  async performHealthChecks(): Promise<boolean> {
    return true
  }
}

// Mock data normalization pipeline
export class MockDataNormalizationPipeline {
  async processStockData(symbol: string, sourceData: any): Promise<any> {
    return {
      symbol,
      price: 100 + Math.random() * 200,
      volume: Math.floor(Math.random() * 1000000),
      marketCap: Math.floor(Math.random() * 500000000000),
      sector: 'Technology',
      timestamp: Date.now(),
      normalized: true
    }
  }
}

// Mock quality scorer
export class MockQualityScorer {
  async scoreStockData(data: any): Promise<QualityScore> {
    return {
      overall: 0.8,
      metrics: {
        freshness: 0.9,
        completeness: 0.8,
        accuracy: 0.85,
        sourceReputation: 0.7,
        latency: 150
      },
      timestamp: Date.now(),
      source: 'mock_scorer'
    }
  }
}