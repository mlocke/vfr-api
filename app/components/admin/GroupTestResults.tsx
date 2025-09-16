/**
 * Group Test Results Component
 * Displays aggregate test results for server groups with glassmorphism styling
 * Includes success rates, response times, and individual server breakdowns
 */

import { ServerGroupTestResult } from '../../services/admin/ServerConfigManager'

interface GroupTestResultsProps {
  results: ServerGroupTestResult[]
  onRetestGroup?: (groupName: string) => void
  isTestRunning?: boolean
}

export function GroupTestResults({
  results,
  onRetestGroup,
  isTestRunning = false
}: GroupTestResultsProps) {
  if (results.length === 0) {
    return null
  }

  const getGroupIcon = (groupName: string) => {
    switch (groupName) {
      case 'commercial': return '🏢'
      case 'government': return '🏛️'
      case 'free': return '🆓'
      case 'all': return '🌐'
      default: return '📊'
    }
  }

  const getSuccessRateColor = (rate: number) => {
    if (rate >= 0.9) return 'text-green-400'
    if (rate >= 0.7) return 'text-yellow-400'
    return 'text-red-400'
  }

  const getSuccessRateBgColor = (rate: number) => {
    if (rate >= 0.9) return 'bg-green-400/20 border-green-400/30'
    if (rate >= 0.7) return 'bg-yellow-400/20 border-yellow-400/30'
    return 'bg-red-400/20 border-red-400/30'
  }

  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">Group Test Results</h2>
        <div className="text-sm text-gray-300">
          Last updated: {new Date(Math.max(...results.map(r => r.timestamp))).toLocaleTimeString()}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {results.map((result) => (
          <div
            key={result.groupName}
            className="bg-white/5 backdrop-blur rounded-xl border border-white/10 p-5 hover:bg-white/10 transition-all duration-300"
          >
            {/* Group Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <span className="text-2xl">{getGroupIcon(result.groupName)}</span>
                <h3 className="text-lg font-bold text-white capitalize">{result.groupName}</h3>
              </div>
              {onRetestGroup && (
                <button
                  onClick={() => onRetestGroup(result.groupName)}
                  disabled={isTestRunning}
                  className="p-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-white text-xs transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Retest group"
                >
                  🔄
                </button>
              )}
            </div>

            {/* Success Rate */}
            <div className={`rounded-xl p-4 border mb-4 ${getSuccessRateBgColor(result.successRate)}`}>
              <div className="text-center">
                <div className={`text-3xl font-bold ${getSuccessRateColor(result.successRate)}`}>
                  {(result.successRate * 100).toFixed(1)}%
                </div>
                <div className="text-sm text-gray-300 mt-1">Success Rate</div>
              </div>
            </div>

            {/* Metrics */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-300">Average Response</span>
                <span className="text-sm font-medium text-white">
                  {result.averageResponseTime.toFixed(0)}ms
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-300">Servers Tested</span>
                <span className="text-sm font-medium text-white">
                  {result.servers.length}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-300">Successful</span>
                <span className="text-sm font-medium text-green-400">
                  {result.servers.filter(s => s.success).length}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-300">Failed</span>
                <span className="text-sm font-medium text-red-400">
                  {result.servers.filter(s => !s.success).length}
                </span>
              </div>
            </div>

            {/* Overall Status */}
            <div className="mt-4 pt-3 border-t border-white/10">
              <div className={`text-center text-sm font-medium ${
                result.overallSuccess ? 'text-green-400' : 'text-red-400'
              }`}>
                {result.overallSuccess ? '✅ Group Healthy' : '⚠️ Issues Detected'}
              </div>
            </div>

            {/* Individual Server Breakdown */}
            <div className="mt-4 pt-3 border-t border-white/10">
              <div className="text-xs text-gray-400 mb-2">Server Status</div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {result.servers.map((server) => (
                  <div
                    key={server.serverId}
                    className="flex justify-between items-center text-xs"
                  >
                    <span className="text-gray-300 truncate">{server.serverId}</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-gray-400">{server.responseTime}ms</span>
                      <span className={server.success ? 'text-green-400' : 'text-red-400'}>
                        {server.success ? '●' : '●'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Summary Statistics */}
      <div className="mt-6 pt-6 border-t border-white/10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white/5 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-white">
              {results.reduce((sum, r) => sum + r.servers.length, 0)}
            </div>
            <div className="text-sm text-gray-300">Total Servers Tested</div>
          </div>

          <div className="bg-white/5 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-green-400">
              {results.reduce((sum, r) => sum + r.servers.filter(s => s.success).length, 0)}
            </div>
            <div className="text-sm text-gray-300">Successful Tests</div>
          </div>

          <div className="bg-white/5 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-red-400">
              {results.reduce((sum, r) => sum + r.servers.filter(s => !s.success).length, 0)}
            </div>
            <div className="text-sm text-gray-300">Failed Tests</div>
          </div>

          <div className="bg-white/5 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-white">
              {results.length > 0 ? (
                (results.reduce((sum, r) => sum + r.averageResponseTime, 0) / results.length).toFixed(0)
              ) : '0'}ms
            </div>
            <div className="text-sm text-gray-300">Avg Response Time</div>
          </div>
        </div>
      </div>
    </div>
  )
}