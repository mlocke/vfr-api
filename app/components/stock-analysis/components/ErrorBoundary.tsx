'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  componentName?: string
  fallbackComponent?: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
  errorInfo?: ErrorInfo
  retryCount: number
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private maxRetries = 3

  constructor(props: ErrorBoundaryProps) {
    super(props)

    this.state = {
      hasError: false,
      error: undefined,
      errorInfo: undefined,
      retryCount: 0
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error for debugging
    console.error(`Error in ${this.props.componentName || 'component'}:`, error, errorInfo)

    this.setState({
      error,
      errorInfo
    })

    // Report to monitoring service in production
    if (process.env.NODE_ENV === 'production') {
      // Could integrate with error reporting service here
      console.error('Production error caught by ErrorBoundary:', {
        component: this.props.componentName,
        error: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack
      })
    }
  }

  handleRetry = () => {
    if (this.state.retryCount < this.maxRetries) {
      this.setState({
        hasError: false,
        error: undefined,
        errorInfo: undefined,
        retryCount: this.state.retryCount + 1
      })
    }
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI provided
      if (this.props.fallbackComponent) {
        return this.props.fallbackComponent
      }

      // Default error fallback UI
      return (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '12px',
            padding: '1.5rem',
            margin: '1rem 0',
            textAlign: 'center'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              marginBottom: '1rem'
            }}
          >
            <span style={{ fontSize: '1.5rem' }}>⚠️</span>
            <h3
              style={{
                fontSize: '1.1rem',
                fontWeight: '600',
                color: 'rgba(239, 68, 68, 0.9)',
                margin: 0
              }}
            >
              Component Error
            </h3>
          </div>

          <p
            style={{
              fontSize: '0.9rem',
              color: 'rgba(255, 255, 255, 0.8)',
              marginBottom: '1rem',
              lineHeight: '1.4'
            }}
          >
            {this.props.componentName ?
              `There was an error loading the ${this.props.componentName} component.` :
              'There was an error loading this component.'
            }
          </p>

          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details
              style={{
                marginBottom: '1rem',
                padding: '0.75rem',
                background: 'rgba(0, 0, 0, 0.2)',
                borderRadius: '6px',
                fontSize: '0.8rem',
                color: 'rgba(255, 255, 255, 0.7)',
                textAlign: 'left'
              }}
            >
              <summary
                style={{
                  cursor: 'pointer',
                  fontWeight: '600',
                  marginBottom: '0.5rem'
                }}
              >
                Debug Information
              </summary>
              <pre
                style={{
                  whiteSpace: 'pre-wrap',
                  fontSize: '0.7rem',
                  margin: 0,
                  overflow: 'auto'
                }}
              >
                <strong>Error:</strong> {this.state.error.message}
                {'\n\n'}
                <strong>Stack:</strong> {this.state.error.stack}
                {this.state.errorInfo && (
                  <>
                    {'\n\n'}
                    <strong>Component Stack:</strong> {this.state.errorInfo.componentStack}
                  </>
                )}
              </pre>
            </details>
          )}

          <div
            style={{
              display: 'flex',
              gap: '0.75rem',
              justifyContent: 'center',
              flexWrap: 'wrap'
            }}
          >
            {this.state.retryCount < this.maxRetries && (
              <button
                onClick={this.handleRetry}
                style={{
                  background: 'rgba(59, 130, 246, 0.2)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  borderRadius: '8px',
                  padding: '0.5rem 1rem',
                  color: 'rgba(59, 130, 246, 0.9)',
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(59, 130, 246, 0.3)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)'
                }}
              >
                🔄 Retry ({this.maxRetries - this.state.retryCount} left)
              </button>
            )}

            <button
              onClick={() => {
                // Reset to clean state
                this.setState({
                  hasError: false,
                  error: undefined,
                  errorInfo: undefined,
                  retryCount: 0
                })
              }}
              style={{
                background: 'rgba(156, 163, 175, 0.2)',
                border: '1px solid rgba(156, 163, 175, 0.3)',
                borderRadius: '8px',
                padding: '0.5rem 1rem',
                color: 'rgba(156, 163, 175, 0.9)',
                fontSize: '0.85rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(156, 163, 175, 0.3)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(156, 163, 175, 0.2)'
              }}
            >
              🔄 Reset
            </button>
          </div>

          {this.state.retryCount >= this.maxRetries && (
            <p
              style={{
                fontSize: '0.8rem',
                color: 'rgba(255, 255, 255, 0.6)',
                marginTop: '1rem',
                fontStyle: 'italic'
              }}
            >
              Max retry attempts reached. Please refresh the page or contact support.
            </p>
          )}
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary