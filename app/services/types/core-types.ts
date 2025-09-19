/**
 * Core Types and Interfaces for Financial Platform
 * NO MOCK IMPLEMENTATIONS - Real implementations only
 */

export interface QualityMetrics {
  freshness: number
  completeness: number
  accuracy: number
  sourceReputation: number
  latency: number
}

export interface QualityScore {
  overall: number
  metrics: QualityMetrics
  timestamp: number
  source: string
}

export interface FusedMCPResponse {
  success: boolean
  data: any
  quality: QualityScore
  sources: string[]
}

export interface FusionResult {
  success: boolean
  data: any
  quality: QualityScore
  sources: string[]
  fusedData: any
  qualityScore: QualityScore
}

export type ConflictResolutionStrategy = 'highest_quality' | 'consensus' | 'weighted_average'

// NO MOCK CLASSES - REAL IMPLEMENTATIONS ONLY