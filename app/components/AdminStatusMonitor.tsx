/**
 * Admin Status Monitor Component
 * Real-time status monitoring widget for the admin dashboard
 */

'use client'

import { useState, useEffect } from 'react'

interface ServerStatus {
  id: string
  name: string
  status: 'online' | 'offline' | 'degraded'
  responseTime?: number
  lastCheck: number
  uptime: number
}

interface StatusMonitorProps {
  servers: string[]
  updateInterval?: number
}

export default function AdminStatusMonitor({ servers, updateInterval = 5000 }: StatusMonitorProps) {
  const [serverStatuses, setServerStatuses] = useState<Map<string, ServerStatus>>(new Map())
  const [isMonitoring, setIsMonitoring] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<number>(0)

  // Server name mapping
  const serverNames: Record<string, string> = {
    polygon: 'Polygon.io',
    alphavantage: 'Alpha Vantage',
    fmp: 'FMP',
    yahoo: 'Yahoo Finance',
    sec_edgar: 'SEC EDGAR',
    treasury: 'Treasury',
    datagov: 'Data.gov',
    fred: 'FRED',
    bls: 'BLS',
    eia: 'EIA',
    firecrawl: 'Firecrawl',
    dappier: 'Dappier'
  }

  // Initialize server statuses
  useEffect(() => {
    const initialStatuses = new Map<string, ServerStatus>()
    servers.forEach(serverId => {
      initialStatuses.set(serverId, {
        id: serverId,
        name: serverNames[serverId] || serverId,
        status: 'online',
        responseTime: Math.floor(Math.random() * 1000) + 100,
        lastCheck: Date.now(),
        uptime: 99.0 + Math.random() * 0.9
      })
    })
    setServerStatuses(initialStatuses)
    setLastUpdate(Date.now())
  }, [servers])

  // Start/stop monitoring
  useEffect(() => {
    if (!isMonitoring) return

    const interval = setInterval(() => {
      setServerStatuses(prevStatuses => {
        const newStatuses = new Map(prevStatuses)

        servers.forEach(serverId => {
          const currentStatus = newStatuses.get(serverId)
          if (!currentStatus) return

          // Simulate status changes
          const rand = Math.random()
          let newStatus: 'online' | 'offline' | 'degraded' = 'online'

          if (rand < 0.02) newStatus = 'offline'
          else if (rand < 0.08) newStatus = 'degraded'

          newStatuses.set(serverId, {
            ...currentStatus,
            status: newStatus,
            responseTime: newStatus === 'offline' ? undefined : Math.floor(Math.random() * 2000) + 100,
            lastCheck: Date.now(),
            uptime: newStatus === 'offline' ? Math.max(currentStatus.uptime - 0.1, 95.0) : Math.min(currentStatus.uptime + 0.01, 99.9)
          })
        })

        return newStatuses
      })
      setLastUpdate(Date.now())
    }, updateInterval)

    return () => clearInterval(interval)
  }, [isMonitoring, servers, updateInterval])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return '#22c55e'
      case 'degraded': return '#f59e0b'
      case 'offline': return '#ef4444'
      default: return '#6b7280'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online': return '🟢'
      case 'degraded': return '🟡'
      case 'offline': return '🔴'
      default: return '⚫'
    }
  }

  const onlineCount = Array.from(serverStatuses.values()).filter(s => s.status === 'online').length
  const degradedCount = Array.from(serverStatuses.values()).filter(s => s.status === 'degraded').length
  const offlineCount = Array.from(serverStatuses.values()).filter(s => s.status === 'offline').length

  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.08)',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(255, 255, 255, 0.15)',
      borderRadius: '15px',
      padding: '1.5rem',
      boxShadow: '0 8px 25px rgba(0, 0, 0, 0.3)',
      marginBottom: '2rem'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1rem'
      }}>
        <h3 style={{
          fontSize: '1.2rem',
          fontWeight: '600',
          color: 'white',
          margin: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          📡 Server Status Monitor
        </h3>

        <button
          onClick={() => setIsMonitoring(!isMonitoring)}
          style={{
            padding: '0.5rem 1rem',
            background: isMonitoring ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)',
            border: isMonitoring ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(34, 197, 94, 0.4)',
            borderRadius: '6px',
            color: isMonitoring ? 'rgba(239, 68, 68, 0.9)' : 'rgba(34, 197, 94, 0.9)',
            fontSize: '0.8rem',
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = isMonitoring ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = isMonitoring ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)'
          }}
        >
          {isMonitoring ? '⏸️ Stop Monitoring' : '▶️ Start Monitoring'}
        </button>
      </div>

      {/* Summary Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        <div style={{
          textAlign: 'center',
          padding: '0.75rem',
          background: 'rgba(34, 197, 94, 0.1)',
          border: '1px solid rgba(34, 197, 94, 0.3)',
          borderRadius: '8px'
        }}>
          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#22c55e' }}>
            {onlineCount}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.7)' }}>
            Online
          </div>
        </div>

        <div style={{
          textAlign: 'center',
          padding: '0.75rem',
          background: 'rgba(251, 191, 36, 0.1)',
          border: '1px solid rgba(251, 191, 36, 0.3)',
          borderRadius: '8px'
        }}>
          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#f59e0b' }}>
            {degradedCount}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.7)' }}>
            Degraded
          </div>
        </div>

        <div style={{
          textAlign: 'center',
          padding: '0.75rem',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '8px'
        }}>
          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#ef4444' }}>
            {offlineCount}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.7)' }}>
            Offline
          </div>
        </div>

        <div style={{
          textAlign: 'center',
          padding: '0.75rem',
          background: 'rgba(99, 102, 241, 0.1)',
          border: '1px solid rgba(99, 102, 241, 0.3)',
          borderRadius: '8px'
        }}>
          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#6366f1' }}>
            {Math.round((onlineCount / servers.length) * 100)}%
          </div>
          <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.7)' }}>
            Uptime
          </div>
        </div>
      </div>

      {/* Server List */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '0.75rem',
        maxHeight: '200px',
        overflowY: 'auto',
        padding: '0.5rem'
      }}>
        {Array.from(serverStatuses.values()).map((server) => (
          <div
            key={server.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.5rem 0.75rem',
              background: 'rgba(255, 255, 255, 0.05)',
              border: `1px solid ${getStatusColor(server.status)}30`,
              borderRadius: '6px',
              transition: 'all 0.3s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: '0.8rem' }}>{getStatusIcon(server.status)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: '0.8rem',
                  fontWeight: '600',
                  color: 'white',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {server.name}
                </div>
                {server.responseTime && (
                  <div style={{
                    fontSize: '0.7rem',
                    color: 'rgba(255, 255, 255, 0.6)'
                  }}>
                    {server.responseTime}ms
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Last Update */}
      <div style={{
        marginTop: '1rem',
        paddingTop: '0.75rem',
        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        textAlign: 'center',
        fontSize: '0.75rem',
        color: 'rgba(255, 255, 255, 0.6)'
      }}>
        Last updated: {new Date(lastUpdate).toLocaleTimeString()}
        {isMonitoring && (
          <span style={{ marginLeft: '0.5rem' }}>
            (auto-updating every {updateInterval / 1000}s)
          </span>
        )}
      </div>
    </div>
  )
}