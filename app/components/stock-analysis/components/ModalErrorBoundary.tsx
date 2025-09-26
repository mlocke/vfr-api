'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'

interface ModalErrorBoundaryProps {
  children: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  fallback?: ReactNode
}

interface ModalErrorBoundaryState {
  hasError: boolean
  error?: Error
  errorInfo?: ErrorInfo
  errorId: string
}

/**
 * Specialized error boundary for modal components with enhanced crash prevention
 * Designed to handle modal-specific rendering issues and data structure problems
 */
class ModalErrorBoundary extends Component<ModalErrorBoundaryProps, ModalErrorBoundaryState> {
  constructor(props: ModalErrorBoundaryProps) {
    super(props)

    this.state = {
      hasError: false,
      errorId: `modal-error-${Date.now()}`
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ModalErrorBoundaryState> {
    console.error('🚨 Modal Error Boundary Triggered:', error)

    return {
      hasError: true,
      error,
      errorId: `modal-error-${Date.now()}`
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('🔥 Modal Component Crash Details:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      errorBoundary: 'ModalErrorBoundary',
      timestamp: new Date().toISOString()
    })

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }

    this.setState({
      error,
      errorInfo
    })

    // Report to monitoring service in production
    if (process.env.NODE_ENV === 'production') {
      console.error('💥 PRODUCTION MODAL CRASH:', {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        errorId: this.state.errorId,
        userAgent: navigator.userAgent,
        url: window.location.href
      })
    }
  }

  handleRetry = () => {
    console.log('🔄 Modal Error Boundary: Attempting recovery...')

    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
      errorId: `modal-error-${Date.now()}`
    })
  }

  handleClose = () => {
    console.log('❌ Modal Error Boundary: Closing modal due to error')

    // Try to close the modal gracefully
    try {
      // Emit a custom event to close the modal
      window.dispatchEvent(new CustomEvent('closeModal'))
    } catch (closeError) {
      console.error('Failed to close modal:', closeError)
    }

    // Reset error state
    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
      errorId: `modal-error-${Date.now()}`
    })
  }

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default modal error UI
      return (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '2rem'
          }}
        >
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.95), rgba(185, 28, 28, 0.95))',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '2px solid rgba(239, 68, 68, 0.6)',
              borderRadius: '20px',
              padding: '2.5rem',
              maxWidth: '500px',
              width: '100%',
              textAlign: 'center',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.6)'
            }}
          >
            {/* Error Icon */}
            <div
              style={{
                fontSize: '4rem',
                marginBottom: '1.5rem',
                animation: 'pulse 2s infinite'
              }}
            >
              🚨
            </div>

            {/* Error Title */}
            <h2
              style={{
                fontSize: '1.8rem',
                fontWeight: '700',
                color: 'white',
                marginBottom: '1rem',
                textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)'
              }}
            >
              Analysis Dialog Error
            </h2>

            {/* Error Description */}
            <p
              style={{
                fontSize: '1rem',
                color: 'rgba(255, 255, 255, 0.9)',
                marginBottom: '2rem',
                lineHeight: '1.6'
              }}
            >
              The stock analysis dialog encountered an unexpected error and couldn't display properly.
            </p>

            {/* Debug Info (Development only) */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details
                style={{
                  marginBottom: '2rem',
                  padding: '1rem',
                  background: 'rgba(0, 0, 0, 0.3)',
                  borderRadius: '8px',
                  textAlign: 'left'
                }}
              >
                <summary
                  style={{
                    cursor: 'pointer',
                    fontWeight: '600',
                    marginBottom: '0.5rem',
                    color: 'white'
                  }}
                >
                  🔍 Debug Information
                </summary>
                <pre
                  style={{
                    fontSize: '0.8rem',
                    color: 'rgba(255, 255, 255, 0.8)',
                    whiteSpace: 'pre-wrap',
                    margin: 0,
                    overflow: 'auto',
                    maxHeight: '200px'
                  }}
                >
                  <strong>Error:</strong> {this.state.error.message}
                  {'\n\n'}
                  <strong>Error ID:</strong> {this.state.errorId}
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

            {/* Action Buttons */}
            <div
              style={{
                display: 'flex',
                gap: '1rem',
                justifyContent: 'center',
                flexWrap: 'wrap'
              }}
            >
              <button
                onClick={this.handleRetry}
                style={{
                  background: 'rgba(59, 130, 246, 0.8)',
                  border: '2px solid rgba(59, 130, 246, 0.6)',
                  borderRadius: '12px',
                  padding: '0.75rem 1.5rem',
                  color: 'white',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  backdropFilter: 'blur(10px)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(59, 130, 246, 0.9)'
                  e.currentTarget.style.transform = 'translateY(-2px)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(59, 130, 246, 0.8)'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
              >
                🔄 Retry
              </button>

              <button
                onClick={this.handleClose}
                style={{
                  background: 'rgba(156, 163, 175, 0.8)',
                  border: '2px solid rgba(156, 163, 175, 0.6)',
                  borderRadius: '12px',
                  padding: '0.75rem 1.5rem',
                  color: 'white',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  backdropFilter: 'blur(10px)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(156, 163, 175, 0.9)'
                  e.currentTarget.style.transform = 'translateY(-2px)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(156, 163, 175, 0.8)'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
              >
                ❌ Close
              </button>
            </div>

            {/* Additional Help */}
            <p
              style={{
                fontSize: '0.85rem',
                color: 'rgba(255, 255, 255, 0.7)',
                marginTop: '1.5rem',
                fontStyle: 'italic'
              }}
            >
              If this problem persists, try refreshing the page or running a new analysis.
            </p>
          </div>

          {/* CSS for animations */}
          <style jsx>{`
            @keyframes pulse {
              0%, 100% {
                opacity: 1;
                transform: scale(1);
              }
              50% {
                opacity: 0.8;
                transform: scale(1.05);
              }
            }
          `}</style>
        </div>
      )
    }

    return this.props.children
  }
}

export default ModalErrorBoundary