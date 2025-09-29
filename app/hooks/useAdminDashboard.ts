/**
 * Admin Dashboard Hook
 * Manages real-time API data source status updates and test execution state
 */

import { useState, useEffect, useCallback } from 'react'

export interface DataSourceStatus {
  id: string
  name: string
  status: 'online' | 'offline' | 'degraded'
  lastCheck: number
  responseTime?: number
  errorCount: number
  uptime: number
}

export interface AdminDashboardState {
  dataSources: DataSourceStatus[]
  isMonitoring: boolean
  lastUpdate: number
  globalStatus: 'healthy' | 'degraded' | 'critical'
}

export function useAdminDashboard() {
  const [state, setState] = useState<AdminDashboardState>({
    dataSources: [],
    isMonitoring: false,
    lastUpdate: 0,
    globalStatus: 'healthy'
  })

  // Initialize data source statuses
  useEffect(() => {
    const initialDataSources: DataSourceStatus[] = [
      { id: 'polygon', name: 'Polygon.io API', status: 'online', lastCheck: Date.now(), errorCount: 0, uptime: 99.8 },
      { id: 'fmp', name: 'Financial Modeling Prep API', status: 'online', lastCheck: Date.now(), errorCount: 0, uptime: 99.2 },
      { id: 'yahoo', name: 'Yahoo Finance API', status: 'online', lastCheck: Date.now(), errorCount: 0, uptime: 99.9 },
      { id: 'sec_edgar', name: 'SEC EDGAR API', status: 'online', lastCheck: Date.now(), errorCount: 0, uptime: 98.5 },
      { id: 'treasury', name: 'Treasury API', status: 'online', lastCheck: Date.now(), errorCount: 0, uptime: 99.7 },
      { id: 'datagov', name: 'Data.gov API', status: 'online', lastCheck: Date.now(), errorCount: 0, uptime: 98.8 },
      { id: 'fred', name: 'FRED API', status: 'online', lastCheck: Date.now(), errorCount: 0, uptime: 99.6 },
      { id: 'bls', name: 'BLS API', status: 'online', lastCheck: Date.now(), errorCount: 0, uptime: 99.1 },
      { id: 'eia', name: 'EIA API', status: 'online', lastCheck: Date.now(), errorCount: 0, uptime: 99.3 },
      { id: 'firecrawl', name: 'Firecrawl API', status: 'online', lastCheck: Date.now(), errorCount: 0, uptime: 98.9 },
      { id: 'dappier', name: 'Dappier API', status: 'online', lastCheck: Date.now(), errorCount: 0, uptime: 99.4 }
    ]

    setState(prev => ({
      ...prev,
      dataSources: initialDataSources,
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

  // Update data source status
  const updateDataSourceStatus = useCallback((dataSourceId: string, status: Partial<DataSourceStatus>) => {
    setState(prev => ({
      ...prev,
      dataSources: prev.dataSources.map(dataSource =>
        dataSource.id === dataSourceId
          ? { ...dataSource, ...status, lastCheck: Date.now() }
          : dataSource
      ),
      lastUpdate: Date.now()
    }))
  }, [])

  // Simulate real-time monitoring with periodic status updates
  useEffect(() => {
    if (!state.isMonitoring) return

    const interval = setInterval(() => {
      setState(prev => {
        const updatedDataSources = prev.dataSources.map(dataSource => {
          // Simulate occasional status changes (5% chance of degraded, 1% chance of offline)
          const rand = Math.random()
          let newStatus = dataSource.status

          if (rand < 0.01) {
            newStatus = 'offline'
          } else if (rand < 0.06) {
            newStatus = 'degraded'
          } else {
            newStatus = 'online'
          }

          return {
            ...dataSource,
            status: newStatus,
            lastCheck: Date.now(),
            responseTime: Math.floor(Math.random() * 2000) + 100,
            errorCount: newStatus === 'offline' ? dataSource.errorCount + 1 : dataSource.errorCount
          }
        })

        // Calculate global status
        const offlineCount = updatedDataSources.filter(s => s.status === 'offline').length
        const degradedCount = updatedDataSources.filter(s => s.status === 'degraded').length

        let globalStatus: 'healthy' | 'degraded' | 'critical' = 'healthy'
        if (offlineCount > 2) {
          globalStatus = 'critical'
        } else if (offlineCount > 0 || degradedCount > 3) {
          globalStatus = 'degraded'
        }

        return {
          ...prev,
          dataSources: updatedDataSources,
          lastUpdate: Date.now(),
          globalStatus
        }
      })
    }, 3000) // Update every 3 seconds

    return () => clearInterval(interval)
  }, [state.isMonitoring])

  // Test specific data sources
  const testDataSources = useCallback(async (dataSourceIds: string[]) => {
    console.log('🧪 Testing data sources:', dataSourceIds)

    // Mark data sources as being tested
    dataSourceIds.forEach(dataSourceId => {
      updateDataSourceStatus(dataSourceId, { status: 'degraded' })
    })

    // Simulate test execution
    for (const dataSourceId of dataSourceIds) {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 500))

      // Simulate test results (90% success rate)
      const success = Math.random() > 0.1
      updateDataSourceStatus(dataSourceId, {
        status: success ? 'online' : 'offline',
        responseTime: Math.floor(Math.random() * 3000) + 100,
        errorCount: success ? 0 : 1
      })
    }

    console.log('✅ Data source tests completed')
  }, [updateDataSourceStatus])

  return {
    ...state,
    startMonitoring,
    stopMonitoring,
    updateDataSourceStatus,
    testDataSources
  }
}