/**
 * Data Source Card Component
 * Glassmorphism-styled card for displaying individual data source information
 * Includes status indicators, test controls, and configuration details
 */

import { useState } from 'react'
import { DataSourceInfo, DataSourceTestResult } from '../../services/admin/DataSourceConfigManager'

interface DataSourceCardProps {
  dataSource: DataSourceInfo
  isSelected: boolean
  testResult?: DataSourceTestResult
  isTestRunning: boolean
  onSelect: (selected: boolean) => void
  onTest: () => void
}

export function DataSourceCard({
  dataSource,
  isSelected,
  testResult,
  isTestRunning,
  onSelect,
  onTest
}: DataSourceCardProps) {
  const [showDetails, setShowDetails] = useState(false)

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'text-green-400 bg-green-400/20'
      case 'offline': return 'text-red-400 bg-red-400/20'
      case 'degraded': return 'text-yellow-400 bg-yellow-400/20'
      case 'maintenance': return 'text-blue-400 bg-blue-400/20'
      default: return 'text-gray-400 bg-gray-400/20'
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'commercial': return 'bg-purple-600/50 text-purple-200 border-purple-400/30'
      case 'government': return 'bg-blue-600/50 text-blue-200 border-blue-400/30'
      case 'free': return 'bg-green-600/50 text-green-200 border-green-400/30'
      default: return 'bg-gray-600/50 text-gray-200 border-gray-400/30'
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'stock_data': return '📈'
      case 'economic_data': return '🏛️'
      case 'web_intelligence': return '🌐'
      case 'filings': return '📋'
      default: return '📊'
    }
  }

  return (
    <div className={`
      relative overflow-hidden rounded-2xl border transition-all duration-300 hover:scale-[1.02]
      ${isSelected
        ? 'bg-white/20 border-blue-400/50 shadow-lg shadow-blue-500/25'
        : 'bg-white/10 border-white/20 hover:bg-white/15'
      }
      backdrop-blur-lg
    `}>
      {/* Selection Overlay */}
      {isSelected && (
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 pointer-events-none" />
      )}

      {/* Card Header */}
      <div className="p-6 border-b border-white/10">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-4">
            {/* Selection Checkbox */}
            <div className="mt-1">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={(e) => onSelect(e.target.checked)}
                className="w-5 h-5 rounded bg-white/10 border-white/30 text-blue-500 focus:ring-blue-500/50"
              />
            </div>

            {/* Data Source Info */}
            <div className="flex-1">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">{getCategoryIcon(dataSource.category)}</span>
                <div>
                  <h3 className="text-xl font-bold text-white">{dataSource.name}</h3>
                  <p className="text-sm text-gray-300">{dataSource.id}</p>
                </div>
              </div>

              {/* Status and Type Badges */}
              <div className="flex items-center space-x-2 mt-3">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(dataSource.status)}`}>
                  ● {dataSource.status.toUpperCase()}
                </span>
                <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getTypeColor(dataSource.type)}`}>
                  {dataSource.type.toUpperCase()}
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-600/50 text-gray-200 border border-gray-400/30">
                  {dataSource.category.replace('_', ' ').toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col space-y-2">
            <button
              onClick={onTest}
              disabled={isTestRunning}
              className={`
                px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
                ${isTestRunning
                  ? 'bg-gray-600/50 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600/80 hover:bg-blue-600 text-white shadow-lg hover:shadow-blue-500/25'
                }
              `}
            >
              {isTestRunning ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Testing...</span>
                </div>
              ) : (
                'Test Data Source'
              )}
            </button>

            <button
              onClick={() => setShowDetails(!showDetails)}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-lg text-sm transition-all duration-200"
            >
              {showDetails ? 'Hide Details' : 'Show Details'}
            </button>
          </div>
        </div>
      </div>

      {/* Test Results */}
      {testResult && (
        <div className="px-6 py-4 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className={`text-sm font-medium ${testResult.success ? 'text-green-400' : 'text-red-400'}`}>
                {testResult.success ? '✅ Test Passed' : '❌ Test Failed'}
              </span>
              <span className="text-sm text-gray-300">
                {testResult.responseTime}ms
              </span>
              <span className="text-xs text-gray-400">
                {new Date(testResult.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <span className="text-xs text-gray-400 bg-gray-700/50 px-2 py-1 rounded">
              {testResult.testType}
            </span>
          </div>
          {testResult.error && (
            <div className="mt-2 text-sm text-red-300 bg-red-900/20 border border-red-500/30 rounded-lg p-3">
              <strong>Error:</strong> {testResult.error}
            </div>
          )}
        </div>
      )}

      {/* Data Source Details */}
      {showDetails && (
        <div className="px-6 py-4 space-y-4">
          {/* Authentication Status */}
          <div className="flex items-center justify-between py-2 border-b border-white/10">
            <span className="text-sm text-gray-300">Authentication</span>
            <div className="flex items-center space-x-2">
              {dataSource.requiresAuth ? (
                <>
                  <span className={`text-sm ${dataSource.hasApiKey ? 'text-green-400' : 'text-red-400'}`}>
                    {dataSource.hasApiKey ? '🔑 API Key Configured' : '❌ API Key Missing'}
                  </span>
                </>
              ) : (
                <span className="text-sm text-blue-400">🔓 No Authentication Required</span>
              )}
            </div>
          </div>

          {/* Performance Metrics */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/5 rounded-lg p-3">
              <div className="text-xs text-gray-400 uppercase tracking-wide">Rate Limit</div>
              <div className="text-lg font-bold text-white">{dataSource.rateLimit}/min</div>
            </div>
            <div className="bg-white/5 rounded-lg p-3">
              <div className="text-xs text-gray-400 uppercase tracking-wide">Timeout</div>
              <div className="text-lg font-bold text-white">{dataSource.timeout}ms</div>
            </div>
          </div>

          {/* Features */}
          <div>
            <div className="text-sm text-gray-300 mb-2">Features</div>
            <div className="flex flex-wrap gap-2">
              {dataSource.features.map((feature) => (
                <span
                  key={feature}
                  className="text-xs bg-blue-600/30 text-blue-200 px-2 py-1 rounded border border-blue-400/30"
                >
                  {feature.replace('_', ' ')}
                </span>
              ))}
            </div>
          </div>

          {/* Additional Metrics */}
          {(dataSource.responseTime || dataSource.errorRate !== undefined) && (
            <div className="grid grid-cols-2 gap-4">
              {dataSource.responseTime && (
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="text-xs text-gray-400 uppercase tracking-wide">Avg Response</div>
                  <div className="text-lg font-bold text-white">{dataSource.responseTime.toFixed(0)}ms</div>
                </div>
              )}
              {dataSource.errorRate !== undefined && (
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="text-xs text-gray-400 uppercase tracking-wide">Error Rate</div>
                  <div className={`text-lg font-bold ${dataSource.errorRate > 0.1 ? 'text-red-400' : 'text-green-400'}`}>
                    {(dataSource.errorRate * 100).toFixed(1)}%
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Last Health Check */}
          {dataSource.lastHealthCheck && (
            <div className="text-xs text-gray-400 pt-2 border-t border-white/10">
              Last health check: {new Date(dataSource.lastHealthCheck).toLocaleString()}
            </div>
          )}
        </div>
      )}
    </div>
  )
}