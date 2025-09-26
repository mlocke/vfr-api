/**
 * DialogErrorState - Error state component for stock dialog
 * Displays user-friendly error messages with retry and dismiss options
 */

'use client'

import React from 'react'
import { DialogErrorStateProps } from '../types'

/**
 * Error type configurations
 */
const ERROR_CONFIGS = {
  network: {
    icon: '🌐',
    title: 'Network Error',
    color: 'rgba(239, 68, 68, 0.9)',
    canRetry: true
  },
  data: {
    icon: '📊',
    title: 'Data Unavailable',
    color: 'rgba(255, 193, 7, 0.9)',
    canRetry: true
  },
  timeout: {
    icon: '⏱️',
    title: 'Request Timeout',
    color: 'rgba(245, 158, 11, 0.9)',
    canRetry: true
  },
  validation: {
    icon: '❌',
    title: 'Invalid Request',
    color: 'rgba(239, 68, 68, 0.9)',
    canRetry: false
  }
}

/**
 * Get user-friendly error message
 */
function getFriendlyErrorMessage(error: string, type?: 'network' | 'data' | 'timeout' | 'validation'): string {
  // Network errors
  if (type === 'network' || error.toLowerCase().includes('network') || error.toLowerCase().includes('fetch')) {
    return 'Unable to connect to our servers. Please check your internet connection and try again.'
  }

  // Timeout errors
  if (type === 'timeout' || error.toLowerCase().includes('timeout')) {
    return 'The request took too long to complete. This might be due to high server load or network issues.'
  }

  // Data errors
  if (type === 'data' || error.toLowerCase().includes('data') || error.toLowerCase().includes('not found')) {
    return 'The requested stock data is temporarily unavailable. Our data providers might be updating their systems.'
  }

  // Validation errors
  if (type === 'validation' || error.toLowerCase().includes('invalid') || error.toLowerCase().includes('validation')) {
    return 'The stock symbol or request parameters are invalid. Please check and try again.'
  }

  // Rate limit errors
  if (error.toLowerCase().includes('rate limit') || error.toLowerCase().includes('429')) {
    return 'Too many requests have been made recently. Please wait a moment before trying again.'
  }

  // Server errors
  if (error.toLowerCase().includes('500') || error.toLowerCase().includes('server')) {
    return 'Our servers are experiencing temporary issues. Please try again in a few minutes.'
  }

  // Generic fallback
  return 'An unexpected error occurred while loading the stock analysis. Please try again.'
}

/**
 * Get suggested actions based on error type
 */
function getSuggestedActions(type?: 'network' | 'data' | 'timeout' | 'validation'): string[] {
  switch (type) {
    case 'network':
      return [
        'Check your internet connection',
        'Try refreshing the page',
        'Disable VPN if using one'
      ]
    case 'timeout':
      return [
        'Wait a moment and retry',
        'Check if the stock symbol is correct',
        'Try during off-peak hours'
      ]
    case 'data':
      return [
        'Verify the stock symbol exists',
        'Try a different stock',
        'Check if markets are open'
      ]
    case 'validation':
      return [
        'Check the stock symbol spelling',
        'Use valid stock ticker symbols',
        'Remove any special characters'
      ]
    default:
      return [
        'Wait a moment and retry',
        'Check your internet connection',
        'Contact support if issue persists'
      ]
  }
}

/**
 * DialogErrorState Component
 */
export const DialogErrorState: React.FC<DialogErrorStateProps> = ({
  error,
  symbol,
  onRetry,
  onDismiss,
  type = 'network'
}) => {
  const config = ERROR_CONFIGS[type]
  const friendlyMessage = getFriendlyErrorMessage(error, type)
  const suggestedActions = getSuggestedActions(type)

  return (
    <>
      {/* CSS Animations */}
      <style jsx>{`
        @keyframes error-shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
          20%, 40%, 60%, 80% { transform: translateX(4px); }
        }

        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes pulse-error {
          0% {
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4);
          }
          70% {
            box-shadow: 0 0 0 8px rgba(239, 68, 68, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
          }
        }

        .error-container {
          animation: fade-in-up 0.4s ease-out;
        }

        .error-icon {
          animation: error-shake 0.8s ease-in-out;
        }

        .retry-button:hover {
          animation: pulse-error 1.5s infinite;
        }
      `}</style>

      <div
        className="error-container"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '3rem 2rem',
          textAlign: 'center',
          background: 'rgba(239, 68, 68, 0.05)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          border: '2px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '15px',
          minHeight: '300px'
        }}
      >
        {/* Error Icon */}
        <div
          className="error-icon"
          style={{
            fontSize: '3rem',
            marginBottom: '1.5rem',
            filter: 'drop-shadow(0 4px 12px rgba(239, 68, 68, 0.3))'
          }}
        >
          {config.icon}
        </div>

        {/* Error Title */}
        <h3
          style={{
            fontSize: '1.5rem',
            fontWeight: '600',
            color: config.color,
            marginBottom: '0.75rem',
            textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
          }}
        >
          {config.title}
          {symbol && ` for ${symbol}`}
        </h3>

        {/* Friendly Error Message */}
        <p
          style={{
            fontSize: '1rem',
            color: 'rgba(255, 255, 255, 0.8)',
            marginBottom: '1.5rem',
            maxWidth: '450px',
            lineHeight: '1.6'
          }}
        >
          {friendlyMessage}
        </p>

        {/* Technical Error Details (Collapsible) */}
        <details
          style={{
            marginBottom: '2rem',
            maxWidth: '500px',
            width: '100%'
          }}
        >
          <summary
            style={{
              cursor: 'pointer',
              fontSize: '0.875rem',
              color: 'rgba(255, 255, 255, 0.6)',
              marginBottom: '0.5rem',
              padding: '0.5rem',
              borderRadius: '4px',
              transition: 'background 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
            }}
          >
            🔧 Technical Details
          </summary>
          <div
            style={{
              background: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              padding: '1rem',
              fontSize: '0.8rem',
              color: 'rgba(255, 255, 255, 0.7)',
              fontFamily: 'monospace',
              textAlign: 'left',
              wordBreak: 'break-word',
              marginTop: '0.5rem'
            }}
          >
            {error}
          </div>
        </details>

        {/* Suggested Actions */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            padding: '1.5rem',
            marginBottom: '2rem',
            maxWidth: '450px',
            width: '100%'
          }}
        >
          <h4
            style={{
              fontSize: '1rem',
              fontWeight: '600',
              color: 'white',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            💡 Suggested Actions
          </h4>
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              textAlign: 'left'
            }}
          >
            {suggestedActions.map((action, index) => (
              <li
                key={index}
                style={{
                  fontSize: '0.875rem',
                  color: 'rgba(255, 255, 255, 0.7)',
                  marginBottom: '0.5rem',
                  paddingLeft: '1.5rem',
                  position: 'relative',
                  lineHeight: '1.4'
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    left: '0',
                    color: 'rgba(255, 193, 7, 0.8)'
                  }}
                >
                  •
                </span>
                {action}
              </li>
            ))}
          </ul>
        </div>

        {/* Action Buttons */}
        <div
          style={{
            display: 'flex',
            gap: '1rem',
            flexWrap: 'wrap',
            justifyContent: 'center'
          }}
        >
          {/* Retry Button */}
          {config.canRetry && onRetry && (
            <button
              className="retry-button"
              onClick={onRetry}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1.5rem',
                background: 'linear-gradient(135deg, rgba(0, 200, 83, 0.9), rgba(0, 150, 60, 0.9))',
                border: 'none',
                borderRadius: '10px',
                color: 'white',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: '0 4px 15px rgba(0, 200, 83, 0.3)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 200, 83, 0.4)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 4px 15px rgba(0, 200, 83, 0.3)'
              }}
            >
              <span>🔄</span>
              Try Again
            </button>
          )}

          {/* Dismiss Button */}
          {onDismiss && (
            <button
              onClick={onDismiss}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1.5rem',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '2px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '10px',
                color: 'rgba(255, 255, 255, 0.8)',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                backdropFilter: 'blur(10px)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)'
                e.currentTarget.style.transform = 'translateY(-2px)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              <span>✕</span>
              Dismiss
            </button>
          )}
        </div>

        {/* Support Contact */}
        <div
          style={{
            marginTop: '2rem',
            fontSize: '0.8rem',
            color: 'rgba(255, 255, 255, 0.5)',
            maxWidth: '400px'
          }}
        >
          If this problem persists, please contact support with the technical details above.
        </div>
      </div>
    </>
  )
}

export default DialogErrorState