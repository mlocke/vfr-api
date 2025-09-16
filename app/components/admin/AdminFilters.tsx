/**
 * Admin Filters Component
 * Glassmorphism-styled filter controls for the admin dashboard
 * Includes server type, category filters, and search functionality
 */

interface AdminFiltersProps {
  filters: {
    type: 'all' | 'commercial' | 'government' | 'free'
    category: 'all' | 'stock_data' | 'economic_data' | 'web_intelligence' | 'filings'
    search: string
  }
  onFiltersChange: (filters: any) => void
  serverCounts: {
    total: number
    commercial: number
    government: number
    free: number
    byCategory: Record<string, number>
  }
}

export function AdminFilters({
  filters,
  onFiltersChange,
  serverCounts
}: AdminFiltersProps) {
  const handleFilterChange = (key: string, value: string) => {
    onFiltersChange({ ...filters, [key]: value })
  }

  const typeOptions = [
    { value: 'all', label: `All Types (${serverCounts.total})`, icon: '🌐' },
    { value: 'commercial', label: `Commercial (${serverCounts.commercial})`, icon: '🏢' },
    { value: 'government', label: `Government (${serverCounts.government})`, icon: '🏛️' },
    { value: 'free', label: `Free (${serverCounts.free})`, icon: '🆓' }
  ]

  const categoryOptions = [
    { value: 'all', label: `All Categories (${serverCounts.total})`, icon: '📊' },
    { value: 'stock_data', label: `Stock Data (${serverCounts.byCategory.stock_data || 0})`, icon: '📈' },
    { value: 'economic_data', label: `Economic Data (${serverCounts.byCategory.economic_data || 0})`, icon: '🏛️' },
    { value: 'web_intelligence', label: `Web Intelligence (${serverCounts.byCategory.web_intelligence || 0})`, icon: '🌐' },
    { value: 'filings', label: `SEC Filings (${serverCounts.byCategory.filings || 0})`, icon: '📋' }
  ]

  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-6">
      <h3 className="text-lg font-bold text-white mb-4">🔍 Filter Servers</h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Search */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-300">Search Servers</label>
          <div className="relative">
            <input
              type="text"
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              placeholder="Search by name or ID..."
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 pl-10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400/50 transition-all duration-200"
            />
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
              🔍
            </div>
          </div>
        </div>

        {/* Server Type Filter */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-300">Server Type</label>
          <div className="relative">
            <select
              value={filters.type}
              onChange={(e) => handleFilterChange('type', e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400/50 transition-all duration-200 appearance-none cursor-pointer"
            >
              {typeOptions.map((option) => (
                <option key={option.value} value={option.value} className="bg-gray-800 text-white">
                  {option.icon} {option.label}
                </option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none">
              ▼
            </div>
          </div>
        </div>

        {/* Category Filter */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-300">Category</label>
          <div className="relative">
            <select
              value={filters.category}
              onChange={(e) => handleFilterChange('category', e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400/50 transition-all duration-200 appearance-none cursor-pointer"
            >
              {categoryOptions.map((option) => (
                <option key={option.value} value={option.value} className="bg-gray-800 text-white">
                  {option.icon} {option.label}
                </option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none">
              ▼
            </div>
          </div>
        </div>
      </div>

      {/* Quick Filter Buttons */}
      <div className="mt-6 space-y-3">
        <div className="text-sm font-medium text-gray-300">Quick Filters</div>

        {/* Type Quick Filters */}
        <div className="flex flex-wrap gap-2">
          {typeOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => handleFilterChange('type', option.value)}
              className={`
                px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 border
                ${filters.type === option.value
                  ? 'bg-blue-600/80 border-blue-400/50 text-white shadow-lg shadow-blue-500/25'
                  : 'bg-white/10 border-white/20 text-gray-300 hover:bg-white/20 hover:border-white/30'
                }
              `}
            >
              {option.icon} {option.label}
            </button>
          ))}
        </div>

        {/* Category Quick Filters */}
        <div className="flex flex-wrap gap-2">
          {categoryOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => handleFilterChange('category', option.value)}
              className={`
                px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 border
                ${filters.category === option.value
                  ? 'bg-purple-600/80 border-purple-400/50 text-white shadow-lg shadow-purple-500/25'
                  : 'bg-white/10 border-white/20 text-gray-300 hover:bg-white/20 hover:border-white/30'
                }
              `}
            >
              {option.icon} {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Clear Filters */}
      {(filters.type !== 'all' || filters.category !== 'all' || filters.search) && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <button
            onClick={() => onFiltersChange({ type: 'all', category: 'all', search: '' })}
            className="px-4 py-2 bg-gray-600/50 hover:bg-gray-600/70 border border-gray-400/30 text-gray-300 hover:text-white rounded-lg text-sm transition-all duration-200"
          >
            🗑️ Clear All Filters
          </button>
        </div>
      )}
    </div>
  )
}