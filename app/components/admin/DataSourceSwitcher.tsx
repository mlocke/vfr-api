'use client'

import { useState, useEffect } from 'react'

interface DataSourcePreference {
  primary: string
  fallbacks: string[]
  lastUpdated: number
}

interface DataSourcePreferences {
  [dataType: string]: DataSourcePreference
}

interface ProviderConfig {
  enabled: boolean
  priority: number
  costTier: 'free' | 'paid' | 'premium'
  reliability: number
  dataQuality: number
  rateLimit: string
  description: string
  supportedDataTypes: string[]
}

interface ProviderConfigs {
  [provider: string]: ProviderConfig
}

interface SwitchingRecommendations {
  costOptimization: string[]
  qualityImprovement: string[]
  reliabilityImprovement: string[]
}

interface ServiceStatus {
  dataTypePreferences: DataSourcePreferences
  providerConfigurations: ProviderConfigs
  switchingRecommendations: SwitchingRecommendations
  capabilities: {
    totalDataTypes: number
    totalProviders: number
    availableProviders: number
  }
}

const DATA_TYPE_NAMES: { [key: string]: string } = {
  stock_price: 'Stock Prices',
  company_info: 'Company Info',
  options_data: 'Options Data',
  options_chain: 'Options Chain',
  put_call_ratio: 'Put/Call Ratio',
  options_analysis: 'Options Analysis',
  fundamentals: 'Fundamentals',
  market_data: 'Market Data',
  economic_data: 'Economic Data',
  treasury_data: 'Treasury Data',
  earnings: 'Earnings',
  news: 'News'
}

const PROVIDER_NAMES: { [key: string]: string } = {
  polygon: 'Polygon.io',
  fmp: 'Financial Modeling Prep',
  yahoo: 'Yahoo Finance',
  twelvedata: 'TwelveData',
  sec_edgar: 'SEC EDGAR',
  treasury: 'Treasury API',
  fred: 'FRED',
  bls: 'BLS',
  eia: 'EIA',
  reddit: 'Reddit WSB Sentiment API'
}

export default function DataSourceSwitcher() {
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updating, setUpdating] = useState<string | null>(null)

  useEffect(() => {
    loadServiceStatus()
  }, [])

  const loadServiceStatus = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/test-data-sources', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          dataSourceIds: ['enhanced'],
          testType: 'data',
          timeout: 10000
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      if (data.success && data.results?.[0]?.data) {
        setServiceStatus(data.results[0].data)
        setError(null)
      } else {
        throw new Error('Failed to load service status')
      }
    } catch (err) {
      console.error('Error loading service status:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const applyQuickConfig = async (configType: 'free' | 'development' | 'premium') => {
    try {
      setUpdating(configType)
      const response = await fetch('/api/admin/data-source-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'quick-config',
          configType
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      // Reload service status after configuration change
      await loadServiceStatus()
    } catch (err) {
      console.error('Error applying quick config:', err)
      setError(err instanceof Error ? err.message : 'Failed to apply configuration')
    } finally {
      setUpdating(null)
    }
  }

  const changeDataSourcePreference = async (dataType: string, newPrimary: string) => {
    try {
      setUpdating(`${dataType}-${newPrimary}`)
      const response = await fetch('/api/admin/data-source-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'set-preference',
          dataType,
          primary: newPrimary
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      // Reload service status after preference change
      await loadServiceStatus()
    } catch (err) {
      console.error('Error changing data source preference:', err)
      setError(err instanceof Error ? err.message : 'Failed to change preference')
    } finally {
      setUpdating(null)
    }
  }

  const getCostTierColor = (tier: 'free' | 'paid' | 'premium') => {
    switch (tier) {
      case 'free': return 'bg-green-100 text-green-800'
      case 'paid': return 'bg-yellow-100 text-yellow-800'
      case 'premium': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getReliabilityColor = (reliability: number) => {
    if (reliability >= 0.9) return 'text-green-600'
    if (reliability >= 0.7) return 'text-yellow-600'
    return 'text-red-600'
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Data Source Switching Control</h2>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Loading data source configurations...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Data Source Switching Control</h2>
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error loading data source configuration</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
              <button
                onClick={loadServiceStatus}
                className="mt-2 bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded text-sm"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!serviceStatus) {
    return null
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Data Source Switching Control</h2>
        <div className="flex space-x-2">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            {serviceStatus.capabilities.totalDataTypes} Data Types
          </span>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            {serviceStatus.capabilities.availableProviders}/{serviceStatus.capabilities.totalProviders} Providers Available
          </span>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Quick Configuration</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button
            onClick={() => applyQuickConfig('free')}
            disabled={updating === 'free'}
            className="p-3 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="text-sm font-medium text-green-800">
              {updating === 'free' ? 'Applying...' : 'Free Tier'}
            </div>
            <div className="text-xs text-green-600">Use all free APIs</div>
          </button>
          <button
            onClick={() => applyQuickConfig('development')}
            disabled={updating === 'development'}
            className="p-3 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="text-sm font-medium text-blue-800">
              {updating === 'development' ? 'Applying...' : 'Development'}
            </div>
            <div className="text-xs text-blue-600">Balanced configuration</div>
          </button>
          <button
            onClick={() => applyQuickConfig('premium')}
            disabled={updating === 'premium'}
            className="p-3 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="text-sm font-medium text-purple-800">
              {updating === 'premium' ? 'Applying...' : 'Premium'}
            </div>
            <div className="text-xs text-purple-600">Best quality APIs</div>
          </button>
        </div>
      </div>

      {/* Current Data Source Preferences */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Current Data Source Preferences</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {serviceStatus.dataTypePreferences && Object.entries(serviceStatus.dataTypePreferences).map(([dataType, preference]) => {
            // Get available providers for this data type
            const availableProviders = serviceStatus.providerConfigurations
              ? Object.entries(serviceStatus.providerConfigurations).filter(([provider, config]) =>
                  config.enabled && config.supportedDataTypes.includes(dataType as any)
                )
              : []

            return (
              <div key={dataType} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-900">{DATA_TYPE_NAMES[dataType] || dataType}</h4>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    serviceStatus.providerConfigurations?.[preference.primary]?.costTier
                      ? getCostTierColor(serviceStatus.providerConfigurations[preference.primary].costTier)
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {serviceStatus.providerConfigurations?.[preference.primary]?.costTier || 'unknown'}
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <label className="text-sm text-gray-600 w-16">Primary:</label>
                    <select
                      value={preference.primary}
                      onChange={(e) => changeDataSourcePreference(dataType, e.target.value)}
                      disabled={updating === `${dataType}-${preference.primary}` || availableProviders.length === 0}
                      className="flex-1 text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {availableProviders.map(([provider]) => (
                        <option key={provider} value={provider}>
                          {PROVIDER_NAMES[provider] || provider}
                        </option>
                      ))}
                    </select>
                    {updating === `${dataType}-${preference.primary}` && (
                      <div className="text-xs text-blue-600">Updating...</div>
                    )}
                  </div>

                  <div className="text-sm">
                    <span className="text-gray-600">Fallbacks:</span>
                    <span className="ml-1 text-gray-700">
                      {preference.fallbacks.map(fb => PROVIDER_NAMES[fb] || fb).join(', ')}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Provider Status */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Provider Status & Configuration</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Provider</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cost</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reliability</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quality</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rate Limit</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data Types</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {serviceStatus.providerConfigurations && Object.entries(serviceStatus.providerConfigurations).map(([provider, config]) => (
                <tr key={provider} className={config.enabled ? '' : 'opacity-50'}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className={`h-2 w-2 rounded-full mr-2 ${config.enabled ? 'bg-green-400' : 'bg-gray-400'}`}></div>
                      <span className="text-sm font-medium text-gray-900">
                        {PROVIDER_NAMES[provider] || provider}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getCostTierColor(config.costTier)}`}>
                      {config.costTier}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`text-sm font-medium ${getReliabilityColor(config.reliability)}`}>
                      {(config.reliability * 100).toFixed(0)}%
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`text-sm font-medium ${getReliabilityColor(config.dataQuality)}`}>
                      {(config.dataQuality * 100).toFixed(0)}%
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {config.rateLimit}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800">
                      {config.supportedDataTypes.length} types
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Switching Recommendations */}
      {serviceStatus.switchingRecommendations && (serviceStatus.switchingRecommendations.costOptimization?.length > 0 ||
        serviceStatus.switchingRecommendations.qualityImprovement?.length > 0 ||
        serviceStatus.switchingRecommendations.reliabilityImprovement?.length > 0) && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Smart Recommendations</h3>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Cost Optimization */}
            {serviceStatus.switchingRecommendations.costOptimization?.length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-medium text-green-800 mb-2">💰 Cost Optimization</h4>
                <ul className="space-y-1">
                  {serviceStatus.switchingRecommendations.costOptimization.slice(0, 3).map((rec, idx) => (
                    <li key={idx} className="text-sm text-green-700">{rec}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Quality Improvement */}
            {serviceStatus.switchingRecommendations.qualityImprovement?.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-800 mb-2">📈 Quality Improvement</h4>
                <ul className="space-y-1">
                  {serviceStatus.switchingRecommendations.qualityImprovement.slice(0, 3).map((rec, idx) => (
                    <li key={idx} className="text-sm text-blue-700">{rec}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Reliability Improvement */}
            {serviceStatus.switchingRecommendations.reliabilityImprovement?.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="font-medium text-yellow-800 mb-2">⚠️ Reliability Issues</h4>
                <ul className="space-y-1">
                  {serviceStatus.switchingRecommendations.reliabilityImprovement.slice(0, 3).map((rec, idx) => (
                    <li key={idx} className="text-sm text-yellow-700">{rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}