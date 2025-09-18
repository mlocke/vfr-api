/**
 * Test Controls Component
 * Glassmorphism-styled controls for managing data source tests
 * Includes batch testing, group testing, and test configuration options
 */

interface TestControlsProps {
  selectedCount: number
  isTestRunning: boolean
  onSelectAll: () => void
  onClearSelection: () => void
  onTestSelected: (testType?: string) => void
  onTestGroup: (groupType: string) => void
  onClearResults: () => void
  lastTestRun?: number
}

export function TestControls({
  selectedCount,
  isTestRunning,
  onSelectAll,
  onClearSelection,
  onTestSelected,
  onTestGroup,
  onClearResults,
  lastTestRun
}: TestControlsProps) {
  const testTypes = [
    { value: 'health', label: 'Health Check', icon: '❤️', description: 'Basic data source health' },
    { value: 'connection', label: 'Connection', icon: '🔌', description: 'Network connectivity' },
    { value: 'data_fetch', label: 'Data Fetch', icon: '📊', description: 'Data retrieval test' },
    { value: 'rate_limit', label: 'Rate Limit', icon: '⏱️', description: 'Rate limiting behavior' }
  ]

  const groupTypes = [
    { value: 'commercial', label: 'Commercial', icon: '🏢', color: 'purple' },
    { value: 'government', label: 'Government', icon: '🏛️', color: 'blue' },
    { value: 'free', label: 'Free', icon: '🆓', color: 'green' },
    { value: 'all', label: 'All Data Sources', icon: '🌐', color: 'indigo' }
  ]

  const getGroupButtonColor = (color: string) => {
    const colors = {
      purple: 'bg-purple-600/80 hover:bg-purple-600 border-purple-400/50 shadow-purple-500/25',
      blue: 'bg-blue-600/80 hover:bg-blue-600 border-blue-400/50 shadow-blue-500/25',
      green: 'bg-green-600/80 hover:bg-green-600 border-green-400/50 shadow-green-500/25',
      indigo: 'bg-indigo-600/80 hover:bg-indigo-600 border-indigo-400/50 shadow-indigo-500/25'
    }
    return colors[color as keyof typeof colors] || colors.blue
  }

  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-white">🧪 Test Controls</h3>
        {lastTestRun && (
          <div className="text-sm text-gray-300">
            Last test: {new Date(lastTestRun).toLocaleTimeString()}
          </div>
        )}
      </div>

      {/* Selection Controls */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-gray-300">Data Source Selection</span>
          <span className="text-sm text-blue-400 font-medium">
            {selectedCount} data source{selectedCount !== 1 ? 's' : ''} selected
          </span>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onSelectAll}
            className="flex-1 px-4 py-3 bg-blue-600/80 hover:bg-blue-600 border border-blue-400/50 text-white rounded-lg text-sm font-medium transition-all duration-200 shadow-lg hover:shadow-blue-500/25"
          >
            📋 Select All
          </button>
          <button
            onClick={onClearSelection}
            className="flex-1 px-4 py-3 bg-gray-600/80 hover:bg-gray-600 border border-gray-400/50 text-white rounded-lg text-sm font-medium transition-all duration-200"
          >
            🗑️ Clear Selection
          </button>
        </div>
      </div>

      {/* Test Type Selection */}
      <div className="mb-6">
        <div className="text-sm font-medium text-gray-300 mb-3">Test Types</div>
        <div className="grid grid-cols-2 gap-3">
          {testTypes.map((testType) => (
            <button
              key={testType.value}
              onClick={() => onTestSelected(testType.value)}
              disabled={selectedCount === 0 || isTestRunning}
              className={`
                p-3 rounded-lg border text-left transition-all duration-200
                ${selectedCount === 0 || isTestRunning
                  ? 'bg-gray-600/30 border-gray-500/30 text-gray-500 cursor-not-allowed'
                  : 'bg-white/10 border-white/20 text-white hover:bg-white/20 hover:border-white/30'
                }
              `}
            >
              <div className="flex items-center space-x-2 mb-1">
                <span>{testType.icon}</span>
                <span className="text-sm font-medium">{testType.label}</span>
              </div>
              <div className="text-xs text-gray-400">{testType.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Batch Test Button */}
      <div className="mb-6">
        <button
          onClick={() => onTestSelected('health')}
          disabled={selectedCount === 0 || isTestRunning}
          className={`
            w-full px-6 py-4 rounded-xl text-lg font-bold border transition-all duration-200
            ${selectedCount === 0 || isTestRunning
              ? 'bg-gray-600/30 border-gray-500/30 text-gray-500 cursor-not-allowed'
              : 'bg-green-600/80 hover:bg-green-600 border-green-400/50 text-white shadow-lg hover:shadow-green-500/25'
            }
          `}
        >
          {isTestRunning ? (
            <div className="flex items-center justify-center space-x-3">
              <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Running Tests...</span>
            </div>
          ) : (
            <div className="flex items-center justify-center space-x-2">
              <span>🚀</span>
              <span>Test Selected Data Sources ({selectedCount})</span>
            </div>
          )}
        </button>
      </div>

      {/* Group Testing */}
      <div className="mb-6">
        <div className="text-sm font-medium text-gray-300 mb-3">Group Testing</div>
        <div className="grid grid-cols-2 gap-3">
          {groupTypes.map((group) => (
            <button
              key={group.value}
              onClick={() => onTestGroup(group.value)}
              disabled={isTestRunning}
              className={`
                px-4 py-3 rounded-lg text-sm font-medium border transition-all duration-200
                ${isTestRunning
                  ? 'bg-gray-600/30 border-gray-500/30 text-gray-500 cursor-not-allowed'
                  : `${getGroupButtonColor(group.color)} text-white shadow-lg`
                }
              `}
            >
              <div className="flex items-center justify-center space-x-2">
                <span>{group.icon}</span>
                <span>{group.label}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Utility Controls */}
      <div className="pt-4 border-t border-white/10">
        <div className="text-sm font-medium text-gray-300 mb-3">Utilities</div>
        <div className="flex gap-3">
          <button
            onClick={onClearResults}
            className="flex-1 px-4 py-2 bg-red-600/80 hover:bg-red-600 border border-red-400/50 text-white rounded-lg text-sm font-medium transition-all duration-200 shadow-lg hover:shadow-red-500/25"
          >
            🗑️ Clear Results
          </button>
        </div>
      </div>

      {/* Test Status Indicator */}
      {isTestRunning && (
        <div className="mt-4 p-4 bg-blue-600/20 border border-blue-400/30 rounded-lg">
          <div className="flex items-center space-x-3">
            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-blue-300 text-sm font-medium">
              Tests in progress... Please wait for completion.
            </span>
          </div>
        </div>
      )}
    </div>
  )
}