/**
 * Admin Dashboard Hook
 * Manages state and API interactions for the admin dashboard
 * Provides real-time updates and caching for server status and test results
 */

import { useState, useEffect, useCallback } from 'react'
import { ServerInfo, ServerTestResult, ServerGroupTestResult } from '../services/admin/ServerConfigManager'

interface AdminDashboardState {
  servers: ServerInfo[]
  selectedServers: Set<string>
  testResults: Map<string, ServerTestResult>
  groupTestResults: ServerGroupTestResult[]
  isLoading: boolean
  isRunningTests: boolean
  error: string | null
  lastUpdated: number | null
}

interface AdminDashboardActions {
  loadServers: (filters?: { type?: string; category?: string }) => Promise<void>
  selectServer: (serverId: string) => void
  deselectServer: (serverId: string) => void
  selectAllServers: () => void
  clearSelection: () => void
  testServer: (serverId: string, testType?: string) => Promise<void>
  testSelectedServers: (testType?: string) => Promise<void>
  testServerGroup: (groupType: string) => Promise<void>
  refreshServers: () => Promise<void>
  clearTestResults: () => void
}

export function useAdminDashboard(): AdminDashboardState & AdminDashboardActions {
  const [state, setState] = useState<AdminDashboardState>({
    servers: [],
    selectedServers: new Set(),
    testResults: new Map(),
    groupTestResults: [],
    isLoading: false,
    isRunningTests: false,
    error: null,
    lastUpdated: null
  })

  // Get authentication token
  const getAuthToken = useCallback(() => {
    return localStorage.getItem('accessToken')
  }, [])

  // API request helper with authentication
  const apiRequest = useCallback(async (endpoint: string, options: RequestInit = {}) => {
    const token = getAuthToken()
    if (!token) {
      throw new Error('Authentication token not found')
    }

    const response = await fetch(endpoint, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(errorData.error || `HTTP ${response.status}`)
    }

    return response.json()
  }, [getAuthToken])

  // Load servers with optional filters
  const loadServers = useCallback(async (filters?: { type?: string; category?: string }) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const queryParams = new URLSearchParams()
      if (filters?.type) queryParams.append('type', filters.type)
      if (filters?.category) queryParams.append('category', filters.category)

      const endpoint = `/api/admin/servers${queryParams.toString() ? `?${queryParams}` : ''}`
      const response = await apiRequest(endpoint)

      setState(prev => ({
        ...prev,
        servers: response.data.servers,
        isLoading: false,
        lastUpdated: Date.now()
      }))

    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to load servers',
        isLoading: false
      }))
    }
  }, [apiRequest])

  // Server selection management
  const selectServer = useCallback((serverId: string) => {
    setState(prev => ({
      ...prev,
      selectedServers: new Set([...prev.selectedServers, serverId])
    }))
  }, [])

  const deselectServer = useCallback((serverId: string) => {
    setState(prev => {
      const newSelected = new Set(prev.selectedServers)
      newSelected.delete(serverId)
      return { ...prev, selectedServers: newSelected }
    })
  }, [])

  const selectAllServers = useCallback(() => {
    setState(prev => ({
      ...prev,
      selectedServers: new Set(prev.servers.map(s => s.id))
    }))
  }, [])

  const clearSelection = useCallback(() => {
    setState(prev => ({
      ...prev,
      selectedServers: new Set()
    }))
  }, [])

  // Individual server testing
  const testServer = useCallback(async (serverId: string, testType = 'health') => {
    setState(prev => ({ ...prev, isRunningTests: true, error: null }))

    try {
      const response = await apiRequest(`/api/admin/servers/${serverId}/test`, {
        method: 'POST',
        body: JSON.stringify({ testType })
      })

      setState(prev => ({
        ...prev,
        testResults: new Map(prev.testResults.set(serverId, response.data)),
        isRunningTests: false
      }))

    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Server test failed',
        isRunningTests: false
      }))
    }
  }, [apiRequest])

  // Batch testing for selected servers
  const testSelectedServers = useCallback(async (testType = 'health') => {
    if (state.selectedServers.size === 0) {
      setState(prev => ({ ...prev, error: 'No servers selected for testing' }))
      return
    }

    setState(prev => ({ ...prev, isRunningTests: true, error: null }))

    try {
      const serverIds = Array.from(state.selectedServers)
      const response = await apiRequest('/api/admin/batch-test', {
        method: 'POST',
        body: JSON.stringify({ serverIds, testType })
      })

      // Update test results for all tested servers
      const newTestResults = new Map(state.testResults)
      response.data.results.forEach((result: ServerTestResult) => {
        newTestResults.set(result.serverId, result)
      })

      setState(prev => ({
        ...prev,
        testResults: newTestResults,
        isRunningTests: false
      }))

    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Batch test failed',
        isRunningTests: false
      }))
    }
  }, [state.selectedServers, state.testResults, apiRequest])

  // Group testing
  const testServerGroup = useCallback(async (groupType: string) => {
    setState(prev => ({ ...prev, isRunningTests: true, error: null }))

    try {
      const response = await apiRequest('/api/admin/test-groups', {
        method: 'POST',
        body: JSON.stringify({ groupType })
      })

      setState(prev => ({
        ...prev,
        groupTestResults: [
          ...prev.groupTestResults.filter(r => r.groupName !== groupType),
          response.data
        ],
        isRunningTests: false
      }))

    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Group test failed',
        isRunningTests: false
      }))
    }
  }, [apiRequest])

  // Refresh servers (reload with current filters)
  const refreshServers = useCallback(async () => {
    await loadServers()
  }, [loadServers])

  // Clear test results
  const clearTestResults = useCallback(() => {
    setState(prev => ({
      ...prev,
      testResults: new Map(),
      groupTestResults: []
    }))
  }, [])

  // Auto-refresh servers every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (!state.isLoading && !state.isRunningTests) {
        refreshServers()
      }
    }, 30000) // 30 seconds

    return () => clearInterval(interval)
  }, [state.isLoading, state.isRunningTests, refreshServers])

  // Initial load on mount
  useEffect(() => {
    loadServers()
  }, [loadServers])

  return {
    // State
    ...state,

    // Actions
    loadServers,
    selectServer,
    deselectServer,
    selectAllServers,
    clearSelection,
    testServer,
    testSelectedServers,
    testServerGroup,
    refreshServers,
    clearTestResults
  }
}

// Hook for real-time server health monitoring
export function useServerHealthMonitor(serverId: string, intervalMs = 10000) {
  const [healthStatus, setHealthStatus] = useState<{
    status: 'online' | 'offline' | 'degraded' | 'maintenance'
    responseTime?: number
    lastCheck: number
  } | null>(null)

  const { testServer } = useAdminDashboard()

  useEffect(() => {
    if (!serverId) return

    const checkHealth = async () => {
      try {
        await testServer(serverId, 'connection')
        setHealthStatus({
          status: 'online',
          lastCheck: Date.now()
        })
      } catch (error) {
        setHealthStatus({
          status: 'offline',
          lastCheck: Date.now()
        })
      }
    }

    // Initial check
    checkHealth()

    // Periodic checks
    const interval = setInterval(checkHealth, intervalMs)

    return () => clearInterval(interval)
  }, [serverId, intervalMs, testServer])

  return healthStatus
}

// Hook for aggregated dashboard statistics
export function useAdminDashboardStats() {
  const { servers, testResults, groupTestResults } = useAdminDashboard()

  const stats = {
    totalServers: servers.length,
    onlineServers: servers.filter(s => s.status === 'online').length,
    offlineServers: servers.filter(s => s.status === 'offline').length,
    degradedServers: servers.filter(s => s.status === 'degraded').length,

    serversByType: {
      commercial: servers.filter(s => s.type === 'commercial').length,
      government: servers.filter(s => s.type === 'government').length,
      free: servers.filter(s => s.type === 'free').length
    },

    serversByCategory: {
      stock_data: servers.filter(s => s.category === 'stock_data').length,
      economic_data: servers.filter(s => s.category === 'economic_data').length,
      web_intelligence: servers.filter(s => s.category === 'web_intelligence').length,
      filings: servers.filter(s => s.category === 'filings').length
    },

    testStats: {
      totalTests: testResults.size,
      passedTests: Array.from(testResults.values()).filter(r => r.success).length,
      failedTests: Array.from(testResults.values()).filter(r => !r.success).length,
      averageResponseTime: testResults.size > 0 ?
        Array.from(testResults.values()).reduce((sum, r) => sum + r.responseTime, 0) / testResults.size : 0
    },

    groupTestStats: groupTestResults.map(group => ({
      name: group.groupName,
      successRate: group.successRate,
      averageResponseTime: group.averageResponseTime,
      serverCount: group.servers.length
    }))
  }

  return stats
}