/**
 * Admin Dashboard Hook
 * Manages real-time server status updates and test execution state
 */

import { useState, useEffect, useCallback } from 'react'

export interface ServerStatus {
  id: string
  name: string
  status: 'online' | 'offline' | 'degraded'
  lastCheck: number
  responseTime?: number
  errorCount: number
  uptime: number
}

export interface AdminDashboardState {
  servers: ServerStatus[]
  isMonitoring: boolean
  lastUpdate: number
  globalStatus: 'healthy' | 'degraded' | 'critical'
}

export function useAdminDashboard() {
  const [state, setState] = useState<AdminDashboardState>({
    servers: [],
    isMonitoring: false,
    lastUpdate: 0,
    globalStatus: 'healthy'
  })

  // Initialize server statuses
  useEffect(() => {
    const initialServers: ServerStatus[] = [
      { id: 'polygon', name: 'Polygon.io MCP', status: 'online', lastCheck: Date.now(), errorCount: 0, uptime: 99.8 },
      { id: 'alphavantage', name: 'Alpha Vantage MCP', status: 'online', lastCheck: Date.now(), errorCount: 0, uptime: 99.5 },
      { id: 'fmp', name: 'Financial Modeling Prep', status: 'online', lastCheck: Date.now(), errorCount: 0, uptime: 99.2 },
      { id: 'yahoo', name: 'Yahoo Finance MCP', status: 'online', lastCheck: Date.now(), errorCount: 0, uptime: 99.9 },
      { id: 'sec_edgar', name: 'SEC EDGAR MCP', status: 'online', lastCheck: Date.now(), errorCount: 0, uptime: 98.5 },
      { id: 'treasury', name: 'Treasury MCP', status: 'online', lastCheck: Date.now(), errorCount: 0, uptime: 99.7 },
      { id: 'datagov', name: 'Data.gov MCP', status: 'online', lastCheck: Date.now(), errorCount: 0, uptime: 98.8 },
      { id: 'fred', name: 'FRED MCP', status: 'online', lastCheck: Date.now(), errorCount: 0, uptime: 99.6 },
      { id: 'bls', name: 'BLS MCP', status: 'online', lastCheck: Date.now(), errorCount: 0, uptime: 99.1 },
      { id: 'eia', name: 'EIA MCP', status: 'online', lastCheck: Date.now(), errorCount: 0, uptime: 99.3 },
      { id: 'firecrawl', name: 'Firecrawl MCP', status: 'online', lastCheck: Date.now(), errorCount: 0, uptime: 98.9 },
      { id: 'dappier', name: 'Dappier MCP', status: 'online', lastCheck: Date.now(), errorCount: 0, uptime: 99.4 }
    ]

    setState(prev => ({
      ...prev,
      servers: initialServers,
      lastUpdate: Date.now()
    }))
  }, [])

  // Start monitoring (simulated real-time updates)
  const startMonitoring = useCallback(() => {
    setState(prev => ({ ...prev, isMonitoring: true }))
  }, [])

  // Stop monitoring
  const stopMonitoring = useCallback(() => {
    setState(prev => ({ ...prev, isMonitoring: false }))
  }, [])

  // Update server status
  const updateServerStatus = useCallback((serverId: string, status: Partial<ServerStatus>) => {
    setState(prev => ({
      ...prev,
      servers: prev.servers.map(server =>
        server.id === serverId
          ? { ...server, ...status, lastCheck: Date.now() }
          : server
      ),
      lastUpdate: Date.now()
    }))
  }, [])

  // Simulate real-time monitoring with periodic status updates
  useEffect(() => {
    if (!state.isMonitoring) return

    const interval = setInterval(() => {
      setState(prev => {
        const updatedServers = prev.servers.map(server => {
          // Simulate occasional status changes (5% chance of degraded, 1% chance of offline)
          const rand = Math.random()
          let newStatus = server.status

          if (rand < 0.01) {
            newStatus = 'offline'
          } else if (rand < 0.06) {
            newStatus = 'degraded'
          } else {
            newStatus = 'online'
          }

          return {
            ...server,
            status: newStatus,
            lastCheck: Date.now(),
            responseTime: Math.floor(Math.random() * 2000) + 100,
            errorCount: newStatus === 'offline' ? server.errorCount + 1 : server.errorCount
          }
        })

        // Calculate global status
        const offlineCount = updatedServers.filter(s => s.status === 'offline').length
        const degradedCount = updatedServers.filter(s => s.status === 'degraded').length

        let globalStatus: 'healthy' | 'degraded' | 'critical' = 'healthy'
        if (offlineCount > 2) {
          globalStatus = 'critical'
        } else if (offlineCount > 0 || degradedCount > 3) {
          globalStatus = 'degraded'
        }

        return {
          ...prev,
          servers: updatedServers,
          lastUpdate: Date.now(),
          globalStatus
        }
      })
    }, 3000) // Update every 3 seconds like useStockSelection

    return () => clearInterval(interval)
  }, [state.isMonitoring])

  // Test specific servers
  const testServers = useCallback(async (serverIds: string[]) => {
    console.log('🧪 Testing servers:', serverIds)

    // Mark servers as being tested
    serverIds.forEach(serverId => {
      updateServerStatus(serverId, { status: 'degraded' })
    })

    // Simulate test execution
    for (const serverId of serverIds) {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 500))

      // Simulate test results (90% success rate)
      const success = Math.random() > 0.1
      updateServerStatus(serverId, {
        status: success ? 'online' : 'offline',
        responseTime: Math.floor(Math.random() * 3000) + 100,
        errorCount: success ? 0 : 1
      })
    }

    console.log('✅ Server tests completed')
  }, [updateServerStatus])

  return {
    ...state,
    startMonitoring,
    stopMonitoring,
    updateServerStatus,
    testServers
  }
}