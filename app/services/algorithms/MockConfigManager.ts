/**
 * Mock Algorithm Configuration Manager
 * Loads algorithm configurations from file system for development testing
 */

import { AlgorithmConfiguration } from './types'
import fs from 'fs'
import path from 'path'

export class MockConfigManager {
  private static instance: MockConfigManager
  private configs: Map<string, AlgorithmConfiguration> = new Map()
  private configPath: string

  constructor() {
    this.configPath = path.join(process.cwd(), 'data', 'algorithm-configs.json')
    this.loadConfigurations()
  }

  static getInstance(): MockConfigManager {
    if (!MockConfigManager.instance) {
      MockConfigManager.instance = new MockConfigManager()
    }
    return MockConfigManager.instance
  }

  private loadConfigurations() {
    try {
      if (fs.existsSync(this.configPath)) {
        const configData = fs.readFileSync(this.configPath, 'utf8')
        const parsedConfigs = JSON.parse(configData)

        for (const [id, config] of Object.entries(parsedConfigs)) {
          this.configs.set(id, config as AlgorithmConfiguration)
        }

        console.log(`📚 Loaded ${this.configs.size} algorithm configurations`)
      } else {
        console.warn('⚠️  No algorithm configurations found, creating default configurations...')
        this.createDefaultConfigurations()
      }
    } catch (error) {
      console.error('❌ Failed to load algorithm configurations:', error)
      this.createDefaultConfigurations()
    }
  }

  private createDefaultConfigurations() {
    // Create minimal default configurations
    const defaultComposite: AlgorithmConfiguration = {
      id: 'composite',
      name: 'Default Composite Strategy',
      description: 'Default multi-factor strategy',
      type: 'COMPOSITE' as any,
      enabled: true,
      selectionCriteria: 'SCORE_BASED' as any,

      universe: {
        maxPositions: 50,
        marketCapMin: 100000000,
        sectors: [],
        exchanges: ['NYSE', 'NASDAQ'],
        excludeSymbols: []
      },

      weights: [
        { factor: 'momentum_3m', weight: 0.3, enabled: true },
        { factor: 'quality_composite', weight: 0.3, enabled: true },
        { factor: 'value_composite', weight: 0.2, enabled: true },
        { factor: 'revenue_growth', weight: 0.2, enabled: true }
      ],

      selection: {
        topN: 25,
        rebalanceFrequency: 604800,
        minHoldingPeriod: 259200,
        threshold: 0.7
      },

      risk: {
        maxSectorWeight: 0.25,
        maxSinglePosition: 0.08,
        maxTurnover: 1.0,
        riskModel: 'factor_based'
      },

      dataFusion: {
        minQualityScore: 0.75,
        requiredSources: ['yahoo', 'polygon'],
        conflictResolution: 'highest_quality',
        cacheTTL: 1800
      },

      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: 'system_default',
        version: 1
      }
    }

    const defaultQuality: AlgorithmConfiguration = {
      id: 'quality',
      name: 'Default Quality Strategy',
      description: 'Default quality-focused strategy',
      type: 'QUALITY' as any,
      enabled: true,
      selectionCriteria: 'SCORE_BASED' as any,

      universe: {
        maxPositions: 30,
        marketCapMin: 1000000000,
        sectors: [],
        exchanges: ['NYSE', 'NASDAQ'],
        excludeSymbols: []
      },

      weights: [
        { factor: 'quality_composite', weight: 0.4, enabled: true },
        { factor: 'roe', weight: 0.2, enabled: true },
        { factor: 'debt_equity', weight: 0.2, enabled: true },
        { factor: 'current_ratio', weight: 0.2, enabled: true }
      ],

      selection: {
        topN: 20,
        rebalanceFrequency: 2592000,
        minHoldingPeriod: 604800,
        threshold: 0.8
      },

      risk: {
        maxSectorWeight: 0.3,
        maxSinglePosition: 0.1,
        maxTurnover: 0.5,
        riskModel: 'conservative'
      },

      dataFusion: {
        minQualityScore: 0.8,
        requiredSources: ['yahoo', 'polygon'],
        conflictResolution: 'highest_quality',
        cacheTTL: 3600
      },

      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: 'system_default',
        version: 1
      }
    }

    this.configs.set('composite', defaultComposite)
    this.configs.set('quality', defaultQuality)

    console.log('✅ Created default algorithm configurations')
  }

  async getConfiguration(configId: string): Promise<AlgorithmConfiguration | null> {
    const config = this.configs.get(configId)
    if (!config) {
      console.warn(`⚠️  Algorithm configuration '${configId}' not found`)
      return null
    }
    return { ...config } // Return a copy
  }

  async listConfigurations(): Promise<AlgorithmConfiguration[]> {
    return Array.from(this.configs.values())
  }

  getAvailableConfigurations(): string[] {
    return Array.from(this.configs.keys())
  }

  hasConfiguration(configId: string): boolean {
    return this.configs.has(configId)
  }

  getConfigurationCount(): number {
    return this.configs.size
  }

  // For development/testing purposes
  async createConfiguration(config: AlgorithmConfiguration): Promise<AlgorithmConfiguration> {
    this.configs.set(config.id, config)
    console.log(`💾 Created configuration: ${config.name} (${config.id})`)
    return { ...config }
  }

  // Add support for getting template configurations
  getTemplateConfiguration(templateId: string): AlgorithmConfiguration | null {
    switch (templateId) {
      case 'conservative':
        return this.configs.get('quality') || null
      case 'balanced':
        return this.configs.get('composite') || null
      case 'aggressive':
        // Create an aggressive momentum template
        const aggressive = this.configs.get('composite')
        if (aggressive) {
          return {
            ...aggressive,
            id: 'aggressive_momentum',
            name: 'Aggressive Momentum',
            type: 'MOMENTUM' as any,
            risk: {
              ...aggressive.risk,
              maxTurnover: 2.0,
              maxSinglePosition: 0.05
            },
            selection: {
              ...aggressive.selection,
              rebalanceFrequency: 86400 // Daily
            }
          }
        }
        return null
      default:
        return this.configs.get(templateId) || null
    }
  }
}

// Export singleton instance
export const mockConfigManager = MockConfigManager.getInstance()