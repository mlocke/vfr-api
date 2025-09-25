'use client'

import React from 'react'

interface ErrorDisplayProps {
  error: string
  onRetry: () => void
  onDismiss: () => void
  type?: 'validation' | 'api' | 'network' | 'timeout'
}

export const ErrorDisplay = ({ error, onRetry, onDismiss, type = 'api' }: ErrorDisplayProps) => {
  const getErrorIcon = () => {
    switch (type) {
      case 'validation': return '⚠️'
      case 'network': return '🔌'
      case 'timeout': return '⏱️'
      default: return '❌'
    }
  }

  const getErrorTitle = () => {
    switch (type) {
      case 'validation': return 'Input Error'
      case 'network': return 'Connection Error'
      case 'timeout': return 'Analysis Timeout'
      default: return 'Analysis Failed'
    }
  }

  const getErrorSuggestion = () => {
    switch (type) {
      case 'validation': return 'Please check your input and try again.'
      case 'network': return 'Please check your internet connection and try again.'
      case 'timeout': return 'The analysis took too long. Try with fewer symbols or try again later.'
      default: return 'Please try again or contact support if the problem persists.'
    }
  }

  return (
    <div className="analysis-error" style={{
      background: 'rgba(239, 68, 68, 0.1)',
      backdropFilter: 'blur(20px)',
      border: '2px solid rgba(239, 68, 68, 0.5)',
      borderRadius: '20px',
      padding: '2rem',
      textAlign: 'center',
      animation: 'fadeInUp 0.4s ease-out',
      marginTop: '2rem'
    }}>
      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>
        {getErrorIcon()}
      </div>

      <h3 style={{
        fontSize: '1.5rem',
        fontWeight: '600',
        color: 'rgba(239, 68, 68, 0.9)',
        marginBottom: '1rem'
      }}>
        {getErrorTitle()}
      </h3>

      <p style={{
        fontSize: '1.1rem',
        color: 'rgba(239, 68, 68, 0.8)',
        marginBottom: '0.5rem',
        lineHeight: '1.5'
      }}>
        {error}
      </p>

      <p style={{
        fontSize: '0.9rem',
        color: 'rgba(239, 68, 68, 0.6)',
        marginBottom: '2rem',
        fontStyle: 'italic'
      }}>
        {getErrorSuggestion()}
      </p>

      <div className="error-actions" style={{
        display: 'flex',
        gap: '1rem',
        justifyContent: 'center',
        flexWrap: 'wrap'
      }}>
        <button
          onClick={onRetry}
          style={{
            padding: '1rem 2rem',
            background: 'rgba(239, 68, 68, 0.2)',
            border: '2px solid rgba(239, 68, 68, 0.5)',
            borderRadius: '12px',
            color: 'rgba(239, 68, 68, 0.9)',
            fontSize: '1.1rem',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            backdropFilter: 'blur(10px)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.3)'
            e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.7)'
            e.currentTarget.style.transform = 'translateY(-2px)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'
            e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.5)'
            e.currentTarget.style.transform = 'translateY(0)'
          }}
        >
          🔄 Try Again
        </button>

        <button
          onClick={onDismiss}
          style={{
            padding: '1rem 2rem',
            background: 'rgba(100, 100, 100, 0.2)',
            border: '2px solid rgba(255, 255, 255, 0.3)',
            borderRadius: '12px',
            color: 'rgba(255, 255, 255, 0.8)',
            fontSize: '1.1rem',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            backdropFilter: 'blur(10px)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(100, 100, 100, 0.3)'
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.5)'
            e.currentTarget.style.transform = 'translateY(-2px)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(100, 100, 100, 0.2)'
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)'
            e.currentTarget.style.transform = 'translateY(0)'
          }}
        >
          ✕ Dismiss
        </button>
      </div>
    </div>
  )
}

export default ErrorDisplay