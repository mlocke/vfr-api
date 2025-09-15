'use client'

import React, { useState, useCallback } from 'react'
import { SelectionOptions } from '../../services/stock-selection/types'
import { AlgorithmType } from '../../services/algorithms/types'

/**
 * Component props
 */
interface AlgorithmSelectorProps {
  options: SelectionOptions
  onChange: (options: Partial<SelectionOptions>) => void
  disabled?: boolean
  className?: string
}

/**
 * Algorithm configuration interface
 */
interface AlgorithmConfig {
  id: AlgorithmType
  name: string
  description: string
  category: 'technical' | 'fundamental' | 'hybrid' | 'custom'
  icon: string
  complexity: 'simple' | 'moderate' | 'advanced'
  timeframe: string
  strengths: string[]
  bestFor: string[]
}

/**
 * Available algorithms with metadata
 */
const ALGORITHMS: AlgorithmConfig[] = [
  {
    id: AlgorithmType.COMPOSITE,
    name: 'Smart Composite',
    description: 'Balanced approach combining multiple factors with dynamic weighting',
    category: 'hybrid',
    icon: '🧠',
    complexity: 'moderate',
    timeframe: 'Short to medium term',
    strengths: ['Diversified analysis', 'Risk-adjusted', 'Adaptive weighting'],
    bestFor: ['General investing', 'Balanced portfolios', 'Risk-conscious traders']
  },
  {
    id: AlgorithmType.MOMENTUM,
    name: 'Momentum',
    description: 'Identifies stocks with strong price and volume momentum trends',
    category: 'technical',
    icon: '🚀',
    complexity: 'simple',
    timeframe: 'Short term',
    strengths: ['Trend identification', 'Quick gains', 'Market timing'],
    bestFor: ['Day trading', 'Swing trading', 'Bull markets']
  },
  {
    id: AlgorithmType.VALUE,
    name: 'Value Investing',
    description: 'Focuses on undervalued stocks with strong fundamentals',
    category: 'fundamental',
    icon: '💎',
    complexity: 'moderate',
    timeframe: 'Long term',
    strengths: ['Fundamental analysis', 'Long-term growth', 'Margin of safety'],
    bestFor: ['Long-term investing', 'Conservative portfolios', 'Bear markets']
  },
  {
    id: AlgorithmType.GROWTH,
    name: 'Growth',
    description: 'Targets companies with high growth potential and expanding markets',
    category: 'fundamental',
    icon: '📈',
    complexity: 'moderate',
    timeframe: 'Medium to long term',
    strengths: ['Revenue growth', 'Market expansion', 'Innovation focus'],
    bestFor: ['Growth portfolios', 'Tech investing', 'Bull markets']
  },
  {
    id: AlgorithmType.QUALITY,
    name: 'Quality',
    description: 'Emphasizes companies with strong financial health and competitive advantages',
    category: 'fundamental',
    icon: '🏆',
    complexity: 'moderate',
    timeframe: 'Long term',
    strengths: ['Financial stability', 'Competitive moats', 'Consistent performance'],
    bestFor: ['Conservative growth', 'Dividend investing', 'All market conditions']
  },
  {
    id: AlgorithmType.DIVIDEND,
    name: 'Dividend Focus',
    description: 'Prioritizes stocks with sustainable dividend yields and growth',
    category: 'fundamental',
    icon: '💰',
    complexity: 'simple',
    timeframe: 'Long term',
    strengths: ['Income generation', 'Dividend growth', 'Capital preservation'],
    bestFor: ['Income investing', 'Retirement portfolios', 'Conservative strategies']
  },
  {
    id: AlgorithmType.MEAN_REVERSION,
    name: 'Mean Reversion',
    description: 'Identifies oversold stocks likely to bounce back to fair value',
    category: 'technical',
    icon: '🔄',
    complexity: 'advanced',
    timeframe: 'Short to medium term',
    strengths: ['Contrarian approach', 'Value timing', 'Risk management'],
    bestFor: ['Contrarian investing', 'Market corrections', 'Experienced traders']
  },
  {
    id: AlgorithmType.VOLATILITY,
    name: 'Volatility Trading',
    description: 'Exploits volatility patterns for risk-adjusted returns',
    category: 'technical',
    icon: '⚡',
    complexity: 'advanced',
    timeframe: 'Short term',
    strengths: ['Volatility analysis', 'Risk metrics', 'Market timing'],
    bestFor: ['Options trading', 'Hedge strategies', 'Advanced traders']
  }
]

/**
 * Risk tolerance configurations
 */
const RISK_PROFILES = [
  {
    id: 'conservative' as const,
    name: 'Conservative',
    description: 'Lower risk, stable returns, capital preservation focus',
    icon: '🛡️',
    color: 'green'
  },
  {
    id: 'moderate' as const,
    name: 'Moderate',
    description: 'Balanced risk-return, diversified approach',
    icon: '⚖️',
    color: 'blue'
  },
  {
    id: 'aggressive' as const,
    name: 'Aggressive',
    description: 'Higher risk, growth-focused, maximum returns',
    icon: '🎯',
    color: 'red'
  }
]

/**
 * Algorithm Selector Component
 */
export default function AlgorithmSelector({
  options,
  onChange,
  disabled = false,
  className = ''
}: AlgorithmSelectorProps) {
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [selectedAlgorithmDetails, setSelectedAlgorithmDetails] = useState<AlgorithmConfig | null>(null)

  /**
   * Get algorithm configuration by ID
   */
  const getAlgorithmConfig = useCallback((algorithmId?: string): AlgorithmConfig | null => {
    if (!algorithmId) return null
    return ALGORITHMS.find(alg => alg.id === algorithmId) || null
  }, [])

  /**
   * Handle algorithm selection
   */
  const handleAlgorithmChange = useCallback((algorithmId: AlgorithmType) => {
    onChange({ algorithmId })
    setSelectedAlgorithmDetails(getAlgorithmConfig(algorithmId))
  }, [onChange, getAlgorithmConfig])

  /**
   * Handle risk tolerance change
   */
  const handleRiskToleranceChange = useCallback((riskTolerance: 'conservative' | 'moderate' | 'aggressive') => {
    onChange({ riskTolerance })
  }, [onChange])

  /**
   * Handle custom weights change
   */
  const handleCustomWeightsChange = useCallback((weights: Partial<NonNullable<SelectionOptions['customWeights']>>) => {
    onChange({
      customWeights: {
        ...options.customWeights,
        ...weights
      }
    })
  }, [onChange, options.customWeights])

  /**
   * Handle data preferences change
   */
  const handleDataPreferencesChange = useCallback((preferences: Partial<NonNullable<SelectionOptions['dataPreferences']>>) => {
    onChange({
      dataPreferences: {
        ...options.dataPreferences,
        ...preferences
      }
    })
  }, [onChange, options.dataPreferences])

  /**
   * Toggle boolean options
   */
  const toggleOption = useCallback((key: keyof SelectionOptions) => {
    onChange({ [key]: !options[key] })
  }, [onChange, options])

  const currentAlgorithm = getAlgorithmConfig(options.algorithmId)

  return (
    <div className={`algorithm-selector ${className}`}>
      {/* Algorithm Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-300 mb-3">
          Trading Algorithm
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {ALGORITHMS.map((algorithm) => (
            <button
              key={algorithm.id}
              onClick={() => handleAlgorithmChange(algorithm.id)}
              disabled={disabled}
              className={`
                p-4 rounded-lg border text-left transition-all duration-200
                ${options.algorithmId === algorithm.id
                  ? 'bg-blue-900 border-blue-600 text-white'
                  : 'bg-gray-800 border-gray-600 text-gray-300 hover:border-gray-500'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-700'}
              `}
            >
              <div className="flex items-center mb-2">
                <span className="text-xl mr-2">{algorithm.icon}</span>
                <span className="font-medium">{algorithm.name}</span>
                <span className={`
                  ml-auto px-2 py-1 text-xs rounded
                  ${algorithm.complexity === 'simple' ? 'bg-green-800 text-green-300' :
                    algorithm.complexity === 'moderate' ? 'bg-yellow-800 text-yellow-300' :
                    'bg-red-800 text-red-300'}
                `}>
                  {algorithm.complexity}
                </span>
              </div>
              <p className="text-sm text-gray-400 line-clamp-2">
                {algorithm.description}
              </p>
              <div className="mt-2 text-xs text-gray-500">
                {algorithm.timeframe}
              </div>
            </button>
          ))}
        </div>

        {/* Selected Algorithm Details */}
        {currentAlgorithm && (
          <div className="mt-4 p-4 bg-gray-900 rounded-lg border border-gray-700">
            <div className="flex items-center mb-3">
              <span className="text-2xl mr-3">{currentAlgorithm.icon}</span>
              <div>
                <h4 className="text-lg font-medium text-white">{currentAlgorithm.name}</h4>
                <p className="text-sm text-gray-400">{currentAlgorithm.description}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h5 className="text-sm font-medium text-gray-300 mb-2">Strengths</h5>
                <ul className="space-y-1">
                  {currentAlgorithm.strengths.map((strength, idx) => (
                    <li key={idx} className="text-sm text-green-400 flex items-start">
                      <span className="mr-2">✓</span>
                      {strength}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h5 className="text-sm font-medium text-gray-300 mb-2">Best For</h5>
                <ul className="space-y-1">
                  {currentAlgorithm.bestFor.map((use, idx) => (
                    <li key={idx} className="text-sm text-blue-400 flex items-start">
                      <span className="mr-2">•</span>
                      {use}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Risk Tolerance */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-300 mb-3">
          Risk Tolerance
        </label>

        <div className="grid grid-cols-3 gap-3">
          {RISK_PROFILES.map((profile) => (
            <button
              key={profile.id}
              onClick={() => handleRiskToleranceChange(profile.id)}
              disabled={disabled}
              className={`
                p-4 rounded-lg border text-center transition-all duration-200
                ${options.riskTolerance === profile.id
                  ? `bg-${profile.color}-900 border-${profile.color}-600 text-white`
                  : 'bg-gray-800 border-gray-600 text-gray-300 hover:border-gray-500'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-700'}
              `}
            >
              <div className="text-2xl mb-2">{profile.icon}</div>
              <div className="font-medium mb-1">{profile.name}</div>
              <div className="text-xs text-gray-400">{profile.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Quick Options */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-300 mb-3">
          Analysis Options
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={options.useRealTimeData || false}
              onChange={() => toggleOption('useRealTimeData')}
              disabled={disabled}
              className="
                w-4 h-4 text-blue-600 bg-gray-800 border-gray-600 rounded
                focus:ring-blue-500 focus:ring-2
              "
            />
            <span className="ml-2 text-sm text-gray-300">Real-time data</span>
          </label>

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={options.includeSentiment || false}
              onChange={() => toggleOption('includeSentiment')}
              disabled={disabled}
              className="
                w-4 h-4 text-blue-600 bg-gray-800 border-gray-600 rounded
                focus:ring-blue-500 focus:ring-2
              "
            />
            <span className="ml-2 text-sm text-gray-300">Sentiment analysis</span>
          </label>

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={options.includeNews || false}
              onChange={() => toggleOption('includeNews')}
              disabled={disabled}
              className="
                w-4 h-4 text-blue-600 bg-gray-800 border-gray-600 rounded
                focus:ring-blue-500 focus:ring-2
              "
            />
            <span className="ml-2 text-sm text-gray-300">News impact</span>
          </label>

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={options.parallel || false}
              onChange={() => toggleOption('parallel')}
              disabled={disabled}
              className="
                w-4 h-4 text-blue-600 bg-gray-800 border-gray-600 rounded
                focus:ring-blue-500 focus:ring-2
              "
            />
            <span className="ml-2 text-sm text-gray-300">Parallel processing</span>
          </label>
        </div>
      </div>

      {/* Advanced Options Toggle */}
      <div className="mb-4">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          disabled={disabled}
          className="
            flex items-center text-sm font-medium text-gray-300 hover:text-white
            transition-colors duration-200
          "
        >
          <span className={`mr-2 transition-transform duration-200 ${showAdvanced ? 'rotate-90' : ''}`}>
            ▶
          </span>
          Advanced Configuration
        </button>
      </div>

      {/* Advanced Options */}
      {showAdvanced && (
        <div className="space-y-6 p-4 bg-gray-900 rounded-lg border border-gray-700">
          {/* Custom Factor Weights */}
          <div>
            <h4 className="text-sm font-medium text-gray-300 mb-3">Factor Weights</h4>
            <div className="grid grid-cols-2 gap-4">
              {[
                { key: 'technical', label: 'Technical Analysis', max: 1 },
                { key: 'fundamental', label: 'Fundamental Analysis', max: 1 },
                { key: 'sentiment', label: 'Sentiment Analysis', max: 1 },
                { key: 'momentum', label: 'Momentum Factors', max: 1 }
              ].map(({ key, label, max }) => (
                <div key={key}>
                  <label className="block text-sm text-gray-400 mb-1">{label}</label>
                  <input
                    type="range"
                    min="0"
                    max={max}
                    step="0.1"
                    value={options.customWeights?.[key as keyof NonNullable<SelectionOptions['customWeights']>] || 0.5}
                    onChange={(e) => handleCustomWeightsChange({
                      [key]: parseFloat(e.target.value)
                    })}
                    disabled={disabled}
                    className="w-full"
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    {((options.customWeights?.[key as keyof NonNullable<SelectionOptions['customWeights']>] || 0.5) * 100).toFixed(0)}%
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Data Quality Preferences */}
          <div>
            <h4 className="text-sm font-medium text-gray-300 mb-3">Data Quality</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Minimum Quality Score
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={options.dataPreferences?.minQualityScore || 0.7}
                  onChange={(e) => handleDataPreferencesChange({
                    minQualityScore: parseFloat(e.target.value)
                  })}
                  disabled={disabled}
                  className="w-full"
                />
                <div className="text-xs text-gray-500 mt-1">
                  {((options.dataPreferences?.minQualityScore || 0.7) * 100).toFixed(0)}%
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Max Data Age (minutes)
                </label>
                <input
                  type="number"
                  min="1"
                  max="1440"
                  value={Math.floor((options.dataPreferences?.maxLatency || 300000) / 60000)}
                  onChange={(e) => handleDataPreferencesChange({
                    maxLatency: parseInt(e.target.value) * 60000
                  })}
                  disabled={disabled}
                  className="
                    w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded
                    text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
                  "
                />
              </div>
            </div>
          </div>

          {/* Timeout Configuration */}
          <div>
            <h4 className="text-sm font-medium text-gray-300 mb-3">Performance</h4>
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Analysis Timeout (seconds)
              </label>
              <input
                type="number"
                min="10"
                max="300"
                value={Math.floor((options.timeout || 30000) / 1000)}
                onChange={(e) => onChange({
                  timeout: parseInt(e.target.value) * 1000
                })}
                disabled={disabled}
                className="
                  w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded
                  text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
                "
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}