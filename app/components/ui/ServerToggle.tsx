'use client'

import { useState, useCallback, useEffect } from 'react'

interface ServerToggleProps {
  serverId: string
  serverName: string
  enabled: boolean
  status: 'online' | 'offline' | 'idle' | 'processing' | 'degraded' | 'maintenance'
  onToggle: (serverId: string, enabled: boolean) => Promise<void>
  disabled?: boolean
}

export default function ServerToggle({
  serverId,
  serverName,
  enabled,
  status,
  onToggle,
  disabled = false
}: ServerToggleProps) {
  const [isToggling, setIsToggling] = useState(false)
  const [localEnabled, setLocalEnabled] = useState(enabled)

  // Sync local state with prop changes from parent
  useEffect(() => {
    setLocalEnabled(enabled)
  }, [enabled])

  const getStatusText = (status: string, isEnabled: boolean): string => {
    if (!isEnabled) return 'Offline'

    switch (status) {
      case 'online': return 'Online'
      case 'offline': return 'Offline'
      case 'idle': return 'Idle'
      case 'processing': return 'Processing'
      case 'degraded': return 'Degraded'
      case 'maintenance': return 'Maintenance'
      default: return 'Unknown'
    }
  }

  const getStatusColor = (status: string, isEnabled: boolean): string => {
    if (!isEnabled) return 'rgba(239, 68, 68, 0.9)' // red for disabled

    switch (status) {
      case 'online': return 'rgba(34, 197, 94, 0.9)' // green
      case 'offline': return 'rgba(239, 68, 68, 0.9)' // red
      case 'idle': return 'rgba(251, 191, 36, 0.9)' // yellow
      case 'processing': return 'rgba(59, 130, 246, 0.9)' // blue
      case 'degraded': return 'rgba(245, 158, 11, 0.9)' // orange
      case 'maintenance': return 'rgba(156, 163, 175, 0.9)' // gray
      default: return 'rgba(156, 163, 175, 0.9)' // gray
    }
  }

  const handleToggle = useCallback(async () => {
    if (disabled || isToggling) return

    setIsToggling(true)
    const newEnabled = !enabled // Use enabled prop instead of localEnabled

    try {
      // Let parent handle optimistic updates, we just call the toggle function
      await onToggle(serverId, newEnabled)
    } catch (error) {
      console.error(`Failed to toggle server ${serverId}:`, error)
    } finally {
      setIsToggling(false)
    }
  }, [serverId, enabled, onToggle, disabled, isToggling])

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      justifyContent: 'flex-end',
      minWidth: '140px',
      height: '32px' // Fixed height for perfect alignment
    }}>
      {/* Status Text */}
      <div style={{
        fontSize: '0.8rem',
        fontWeight: '500',
        color: getStatusColor(status, localEnabled),
        minWidth: '70px',
        maxWidth: '70px',
        textAlign: 'right',
        transition: 'color 0.3s ease',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      }}>
        {getStatusText(status, localEnabled)}
      </div>

      {/* Toggle Switch */}
      <div
        role="switch"
        aria-checked={localEnabled}
        aria-label={`${localEnabled ? 'Disable' : 'Enable'} ${serverName}`}
        tabIndex={disabled ? -1 : 0}
        onClick={handleToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleToggle()
          }
        }}
        style={{
          position: 'relative',
          width: '44px',
          height: '24px',
          background: localEnabled
            ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.8), rgba(16, 185, 129, 0.8))'
            : 'rgba(107, 114, 128, 0.6)',
          borderRadius: '12px',
          cursor: disabled || isToggling ? 'not-allowed' : 'pointer',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          opacity: disabled ? 0.5 : 1,
          border: localEnabled
            ? '1px solid rgba(34, 197, 94, 0.4)'
            : '1px solid rgba(107, 114, 128, 0.4)',
          boxShadow: localEnabled
            ? '0 2px 8px rgba(34, 197, 94, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
            : '0 2px 8px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)'
        }}
        onMouseEnter={(e) => {
          if (!disabled && !isToggling) {
            e.currentTarget.style.transform = 'scale(1.05)'
            e.currentTarget.style.boxShadow = localEnabled
              ? '0 4px 12px rgba(34, 197, 94, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
              : '0 4px 12px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
          }
        }}
        onMouseLeave={(e) => {
          if (!disabled && !isToggling) {
            e.currentTarget.style.transform = 'scale(1)'
            e.currentTarget.style.boxShadow = localEnabled
              ? '0 2px 8px rgba(34, 197, 94, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
              : '0 2px 8px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
          }
        }}
      >
        {/* Toggle Circle */}
        <div style={{
          position: 'absolute',
          top: '2px',
          left: localEnabled ? '22px' : '2px',
          width: '20px',
          height: '20px',
          background: localEnabled
            ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(248, 250, 252, 0.9))'
            : 'linear-gradient(135deg, rgba(255, 255, 255, 0.8), rgba(241, 245, 249, 0.7))',
          borderRadius: '50%',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: localEnabled
            ? '0 2px 6px rgba(0, 0, 0, 0.2), 0 1px 3px rgba(0, 0, 0, 0.1)'
            : '0 2px 4px rgba(0, 0, 0, 0.15), 0 1px 2px rgba(0, 0, 0, 0.1)',
          transform: isToggling ? 'scale(0.9)' : 'scale(1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {/* Loading spinner when toggling */}
          {isToggling && (
            <div style={{
              width: '8px',
              height: '8px',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              borderTop: '1px solid rgba(99, 102, 241, 0.8)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite'
            }} />
          )}
        </div>
      </div>

      {/* Inline CSS for animation */}
      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}