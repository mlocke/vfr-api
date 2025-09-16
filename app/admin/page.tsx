'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAdminDashboard, useAdminDashboardStats } from '../hooks/useAdminDashboard'
import { ServerCard } from '../components/admin/ServerCard'
import { GroupTestResults } from '../components/admin/GroupTestResults'
import { AdminFilters } from '../components/admin/AdminFilters'
import { TestControls } from '../components/admin/TestControls'
import { serverConfigManager } from '../services/admin/ServerConfigManager'

export default function AdminDashboard() {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [filters, setFilters] = useState({
    type: 'all' as const,
    category: 'all' as const,
    search: ''
  })

  // Use the admin dashboard hook
  const {
    servers,
    selectedServers,
    testResults,
    groupTestResults,
    isLoading,
    isRunningTests,
    error,
    loadServers,
    selectServer,
    deselectServer,
    selectAllServers,
    clearSelection,
    testServer,
    testSelectedServers,
    testServerGroup,
    clearTestResults
  } = useAdminDashboard()

  // Get dashboard statistics
  const stats = useAdminDashboardStats()

  // Authentication check on mount
  useEffect(() => {
    checkAuthentication()
  }, [])

  // Load servers when filters change
  useEffect(() => {
    if (isAuthenticated) {
      loadServers(filters.type !== 'all' || filters.category !== 'all' ? {
        type: filters.type !== 'all' ? filters.type : undefined,
        category: filters.category !== 'all' ? filters.category : undefined
      } : undefined)
    }
  }, [isAuthenticated, filters.type, filters.category, loadServers])

  const checkAuthentication = async () => {
    try {
      const token = localStorage.getItem('accessToken')
      if (!token) {
        router.push('/login?redirect=/admin')
        return
      }

      const isAdmin = await serverConfigManager.validateAdminAccess(token)
      if (!isAdmin) {
        router.push('/?error=unauthorized')
        return
      }

      setIsAuthenticated(true)
      setInitialLoading(false)
    } catch (error) {
      console.error('Authentication check failed:', error)
      router.push('/login?redirect=/admin')
    }
  }

  // Filter servers based on search
  const filteredServers = servers.filter(server => {
    if (filters.search) {
      const search = filters.search.toLowerCase()
      return server.name.toLowerCase().includes(search) ||
             server.id.toLowerCase().includes(search) ||
             server.category.toLowerCase().includes(search) ||
             server.type.toLowerCase().includes(search)
    }
    return true
  })

  // Handle server selection
  const handleServerSelection = (serverId: string, selected: boolean) => {
    if (selected) {
      selectServer(serverId)
    } else {
      deselectServer(serverId)
    }
  }

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading admin dashboard...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null // Will redirect
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">🔧 MCP Server Admin Dashboard</h1>
          <p className="text-gray-300">Manage and test Market Data Protocol server integrations</p>

          {/* Stats Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
              <div className="text-2xl font-bold text-white">{stats.totalServers}</div>
              <div className="text-sm text-gray-300">Total Servers</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
              <div className="text-2xl font-bold text-green-400">{stats.onlineServers}</div>
              <div className="text-sm text-gray-300">Online</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
              <div className="text-2xl font-bold text-red-400">{stats.offlineServers}</div>
              <div className="text-sm text-gray-300">Offline</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-400">{selectedServers.size}</div>
              <div className="text-sm text-gray-300">Selected</div>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-600/20 border border-red-400/50 rounded-lg p-4 text-red-300">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Filters */}
        <AdminFilters
          filters={filters}
          onFiltersChange={setFilters}
          serverCounts={{
            total: stats.totalServers,
            commercial: stats.serversByType.commercial,
            government: stats.serversByType.government,
            free: stats.serversByType.free,
            byCategory: stats.serversByCategory
          }}
        />

        {/* Test Controls */}
        <TestControls
          selectedCount={selectedServers.size}
          isTestRunning={isRunningTests}
          onSelectAll={selectAllServers}
          onClearSelection={clearSelection}
          onTestSelected={testSelectedServers}
          onTestGroup={testServerGroup}
          onClearResults={clearTestResults}
          lastTestRun={stats.testStats.totalTests > 0 ? Date.now() : undefined}
        />

        {/* Group Test Results */}
        {groupTestResults.length > 0 && (
          <GroupTestResults
            results={groupTestResults}
            onRetestGroup={testServerGroup}
            isTestRunning={isRunningTests}
          />
        )}

        {/* Server Cards */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-white">
              MCP Servers ({filteredServers.length})
            </h2>
            {isLoading && (
              <div className="flex items-center space-x-2 text-blue-300">
                <div className="w-4 h-4 border-2 border-blue-300 border-t-transparent rounded-full animate-spin" />
                <span>Loading servers...</span>
              </div>
            )}
          </div>

          {filteredServers.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredServers.map((server) => (
                <ServerCard
                  key={server.id}
                  server={server}
                  isSelected={selectedServers.has(server.id)}
                  testResult={testResults.get(server.id)}
                  isTestRunning={isRunningTests}
                  onSelect={(selected) => handleServerSelection(server.id, selected)}
                  onTest={() => testServer(server.id)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🔍</div>
              <h3 className="text-xl font-bold text-white mb-2">No servers found</h3>
              <p className="text-gray-400">
                {filters.search || filters.type !== 'all' || filters.category !== 'all'
                  ? 'Try adjusting your filters to see more results.'
                  : 'No servers are currently configured.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}