'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import SectorDropdown, { SectorOption } from '../components/SectorDropdown'
import StockAutocomplete from '../components/StockAutocomplete'
import { SelectionMode } from '../services/stock-selection/types'
import ErrorDisplay from '../components/analysis/ErrorDisplay'

// Type definitions for API communication
interface AnalysisRequest {
  scope: {
    mode: SelectionMode
    symbols?: string[]
    sector?: {
      id: string
      label: string
      description: string
      category: 'sector' | 'index' | 'etf'
    }
    maxResults?: number
  }
  options?: {
    useRealTimeData?: boolean
    includeSentiment?: boolean
    includeNews?: boolean
    timeout?: number
  }
}

interface StockResult {
  symbol: string
  score: {
    overall: number
    technical: number
    fundamental: number
    sentiment: number
  }
  weight: number
  action: 'BUY' | 'SELL' | 'HOLD'
  confidence: number
  context: {
    sector: string
    marketCap: number
    priceChange24h?: number
    volumeChange24h?: number
    beta?: number
  }
  reasoning: {
    primaryFactors: string[]
    warnings?: string[]
    opportunities?: string[]
  }
  dataQuality: {
    overall: {
      overall: number
      timestamp: number
      source: string
      metrics: {
        freshness: number
        completeness: number
        accuracy: number
        sourceReputation: number
        latency: number
      }
    }
    lastUpdated: number
  }
}

interface AnalysisResult {
  success: boolean
  requestId: string
  timestamp: number
  executionTime: number
  topSelections: StockResult[]
  metadata: {
    algorithmUsed: string
    dataSourcesUsed: string[]
    cacheHitRate: number
    analysisMode: string
    qualityScore: {
      overall: number
      timestamp: number
      source: string
      metrics: {
        freshness: number
        completeness: number
        accuracy: number
        sourceReputation: number
        latency: number
      }
    }
  }
  performance: {
    dataFetchTime: number
    analysisTime: number
    fusionTime: number
    cacheTime: number
  }
  warnings?: string[]
  errors?: string[]
  error?: string
  message?: string
}

// Frontend Analysis API Types
interface FrontendAnalysisRequest {
  mode: 'single' | 'sector' | 'multiple'
  sector?: {
    id: string
    label: string
    category: 'sector' | 'index' | 'etf'
  }
  symbols?: string[]
  options?: {
    useRealTimeData: boolean
    includeSentiment: boolean
    includeNews: boolean
    timeout: number
  }
}

interface FrontendAnalysisResponse {
  success: boolean
  data?: {
    analysisId: string
    filePath: string
    resultsCount: number
    processingTime: number
    metadata: {
      mode: string
      timestamp: number
      dataSourcesUsed: string[]
      analysisInputServices: Record<string, any>
    }
  }
  error?: string
}

export default function DeepAnalysisPage() {
  // Add CSS animations via style tag
  const animationStyles = `
    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes spin {
      from {
        transform: rotate(0deg);
      }
      to {
        transform: rotate(360deg);
      }
    }
  `
  const [selectedSector, setSelectedSector] = useState<SectorOption | undefined>()
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>([])
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [analysisType, setAnalysisType] = useState<'sector' | 'tickers' | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [errorType, setErrorType] = useState<'validation' | 'api' | 'network' | 'timeout'>('api')
  const [frontendAnalysisResult, setFrontendAnalysisResult] = useState<FrontendAnalysisResponse['data'] | null>(null)
  const [analysisStartTime, setAnalysisStartTime] = useState<number>(0)
  const [elapsedTime, setElapsedTime] = useState<number>(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const handleSectorChange = (sector: SectorOption) => {
    setSelectedSector(sector)
    setSelectedSymbols([])
    setAnalysisType('sector')
    setShowConfirmation(false)
  }

  const handleSymbolSelectionChange = (symbols: string[]) => {
    setSelectedSymbols(symbols)
    setSelectedSector(undefined)
    setAnalysisType(symbols.length > 0 ? 'tickers' : null)
    setShowConfirmation(false)
  }

  const handleRunAnalysis = () => {
    if ((analysisType === 'sector' && selectedSector) ||
        (analysisType === 'tickers' && selectedSymbols.length > 0)) {
      setShowConfirmation(true)
    }
  }

  const handleConfirm = async () => {
    setShowConfirmation(false)
    setIsAnalyzing(true)
    setError(null)
    setAnalysisResult(null)

    try {
      // Build request in the format expected by the API
      let request: any = {}

      if (analysisType === 'sector' && selectedSector) {
        request = {
          mode: 'sector',
          sector: selectedSector.id,
          limit: 20
        }
      } else if (analysisType === 'tickers' && selectedSymbols.length > 0) {
        if (selectedSymbols.length === 1) {
          request = {
            mode: 'single',
            symbols: selectedSymbols
          }
        } else {
          request = {
            mode: 'multiple',
            symbols: selectedSymbols,
            limit: Math.min(selectedSymbols.length, 10)
          }
        }
      }

      console.log('🚀 Sending analysis request:', request)

      // Call the API
      const response = await fetch('/api/stocks/select', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request)
      })

      if (!response.ok) {
        let errorData: any = {}
        let errorText = ''

        try {
          errorText = await response.text()
          errorData = JSON.parse(errorText)
        } catch (parseError) {
          console.error('❌ Failed to parse error response:', parseError)
          console.error('📄 Raw error response:', errorText)
          console.error('📊 Response status:', response.status)
          console.error('📋 Response headers:', Object.fromEntries(response.headers.entries()))
        }

        console.error('❌ API Error Details:', {
          status: response.status,
          statusText: response.statusText,
          errorData,
          rawText: errorText,
          headers: Object.fromEntries(response.headers.entries())
        })

        throw new Error(errorData.message || errorData.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      // Check if it's a streaming response
      const isStreaming = response.headers.get('X-Streaming') === 'true'

      if (isStreaming) {
        // Handle streaming response
        const reader = response.body?.getReader()
        const decoder = new TextDecoder()
        let partialResult: AnalysisResult | null = null

        if (reader) {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const chunk = decoder.decode(value, { stream: true })
            const lines = chunk.split('\n').filter(line => line.trim())

            for (const line of lines) {
              try {
                const data = JSON.parse(line)

                if (data.type === 'metadata') {
                  partialResult = data.data
                  setAnalysisResult(partialResult)
                } else if (data.type === 'selection' && partialResult) {
                  partialResult.topSelections.push(data.data)
                  setAnalysisResult({ ...partialResult })
                } else if (data.type === 'complete' && partialResult) {
                  setAnalysisResult({ ...partialResult })
                  break
                }
              } catch (parseError) {
                console.warn('Failed to parse streaming data:', parseError)
              }
            }
          }
        }
      } else {
        // Handle standard JSON response
        const result: AnalysisResult = await response.json()
        setAnalysisResult(result)
      }

      console.log('✅ Analysis completed successfully')

    } catch (error) {
      console.error('❌ Analysis failed:', error)
      setError(error instanceof Error ? error.message : 'Analysis failed. Please try again.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleCancel = () => {
    setShowConfirmation(false)
  }

  const getAnalysisSummary = () => {
    if (analysisType === 'sector' && selectedSector) {
      return `Analyzing: ${selectedSector.label} Sector`
    }
    if (analysisType === 'tickers' && selectedSymbols.length > 0) {
      return `Analyzing: ${selectedSymbols.join(', ')}`
    }
    return ''
  }

  const isAnalysisReady = (analysisType === 'sector' && selectedSector) ||
                         (analysisType === 'tickers' && selectedSymbols.length > 0)

  return (
    <>
      {/* CSS Animations */}
      <style dangerouslySetInnerHTML={{ __html: animationStyles }} />

      {/* Background Animation - Consistent with homepage */}
      <div className="bg-animation">
        <div className="particle"></div>
        <div className="particle"></div>
        <div className="particle"></div>
        <div className="particle"></div>
        <div className="particle"></div>
        <div className="particle"></div>
        <div className="particle"></div>
        <div className="particle"></div>
        <div className="particle"></div>
      </div>

      {/* Back to Home Button - Fixed position top left to mirror homepage button */}
      <div
        className="back-to-home-button-container"
        style={{
          position: 'fixed',
          top: '65px',
          left: '20px',
          zIndex: 1100,
          backgroundColor: 'transparent',
          width: 'auto',
          maxWidth: 'calc(100vw - 40px)',
          minWidth: '200px'
        }}
      >
        <Link
          href="/"
          className="inline-flex items-center justify-between w-full"
          style={{
            padding: '12px 16px',
            minHeight: '50px',
            background: 'rgba(17, 24, 39, 0.85)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            border: '2px solid rgba(239, 68, 68, 0.6)',
            borderRadius: '12px',
            color: 'rgba(255, 255, 255, 0.95)',
            fontWeight: '500',
            fontSize: '14px',
            textDecoration: 'none',
            cursor: 'pointer',
            transition: 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: `
              0 4px 12px rgba(0, 0, 0, 0.4),
              0 0 0 0 rgba(239, 68, 68, 0.3),
              inset 0 1px 0 rgba(255, 255, 255, 0.1)
            `
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(31, 41, 55, 0.9)'
            e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.8)'
            e.currentTarget.style.boxShadow = `
              0 8px 24px rgba(0, 0, 0, 0.5),
              0 0 25px rgba(239, 68, 68, 0.4),
              0 0 50px rgba(239, 68, 68, 0.2),
              0 0 0 1px rgba(239, 68, 68, 0.3),
              inset 0 1px 0 rgba(255, 255, 255, 0.15)
            `
            e.currentTarget.style.transform = 'translateY(-1px)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(17, 24, 39, 0.85)'
            e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.6)'
            e.currentTarget.style.boxShadow = `
              0 4px 12px rgba(0, 0, 0, 0.4),
              0 0 0 0 rgba(239, 68, 68, 0.3),
              inset 0 1px 0 rgba(255, 255, 255, 0.1)
            `
            e.currentTarget.style.transform = 'translateY(0)'
          }}
        >
          <span className="flex items-center">
            <span style={{
              fontSize: '12px',
              color: 'rgba(239, 68, 68, 0.6)',
              transition: 'transform 200ms cubic-bezier(0.4, 0, 0.2, 1)',
              marginRight: '8px'
            }}>
              ←
            </span>
            <span className="hidden sm:inline">Back to Home</span>
            <span className="sm:hidden">Home</span>
          </span>
        </Link>
      </div>

      <div className="main-container" style={{marginTop: '120px'}}>
        <header className="header">
          <div className="logo">
            <img
              src="/assets/images/veritak_logo.png"
              alt="Veritak Financial Research LLC"
              className="logo-image prominent-logo"
              style={{
                height: '120px',
                width: 'auto',
                marginRight: '20px',
                filter: 'drop-shadow(0 4px 12px rgba(0, 200, 83, 0.3))',
                cursor: 'pointer',
                transition: 'transform 0.2s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            />
            <div className="logo-text-container">
              <div className="logo-text prominent-logo-text">Deep Analysis</div>
              <div className="company-tagline">Select. Analyze. Decide.</div>
            </div>
          </div>
          <p className="tagline">Comprehensive Financial Analysis & Market Intelligence Platform</p>
        </header>

        {/* Input Section */}
        <section style={{ padding: '2rem 1rem', position: 'relative', zIndex: 2 }}>
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            {/* Input Section Header */}
            <div className="deep-analysis-header" style={{
              textAlign: 'center',
              marginBottom: '3rem',
              background: 'rgba(255, 255, 255, 0.05)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '20px',
              padding: '2rem',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)'
            }}>
              <h2 style={{
                fontSize: '2.5rem',
                fontWeight: '700',
                color: 'white',
                marginBottom: '1rem',
                textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
              }}>
                🔍 Start Your Analysis
              </h2>
              <p style={{
                fontSize: '1.2rem',
                color: 'rgba(255, 255, 255, 0.8)',
                lineHeight: '1.6',
                maxWidth: '600px',
                margin: '0 auto'
              }}>
                Choose a sector or enter specific stock tickers to begin comprehensive market analysis
              </p>
            </div>

            {/* Input Controls */}
            <div className="deep-analysis-input-grid" style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '2rem',
              marginBottom: '2rem',
              alignItems: 'start'
            }}>
              {/* Sector Selection */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '15px',
                padding: '2rem',
                transition: 'all 0.3s ease',
                boxShadow: analysisType === 'sector' ?
                  '0 10px 30px rgba(0, 200, 83, 0.3), 0 0 0 2px rgba(0, 200, 83, 0.5)' :
                  '0 4px 15px rgba(0, 0, 0, 0.2)'
              }}>
                <h3 style={{
                  fontSize: '1.3rem',
                  fontWeight: '600',
                  color: 'white',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  🏢 Select Sector
                </h3>
                <SectorDropdown
                  onSectorChange={handleSectorChange}
                  currentSector={selectedSector}
                />
              </div>

              {/* Stock Symbol Search */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '15px',
                padding: '2rem',
                transition: 'all 0.3s ease',
                boxShadow: analysisType === 'tickers' ?
                  '0 10px 30px rgba(0, 200, 83, 0.3), 0 0 0 2px rgba(0, 200, 83, 0.5)' :
                  '0 4px 15px rgba(0, 0, 0, 0.2)'
              }}>
                <h3 style={{
                  fontSize: '1.3rem',
                  fontWeight: '600',
                  color: 'white',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  📈 Search Stock Symbols
                </h3>
                <StockAutocomplete
                  onSelectionChange={handleSymbolSelectionChange}
                  placeholder="Search stocks by symbol or company name (e.g., AAPL, Apple Inc)"
                  maxSelections={10}
                />
                <p style={{
                  fontSize: '0.9rem',
                  color: 'rgba(255, 255, 255, 0.6)',
                  marginTop: '0.5rem',
                  fontStyle: 'italic'
                }}>
                  Search and select multiple stocks for comparative analysis
                </p>
              </div>
            </div>

            {/* Run Analysis Button */}
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <button
                className="deep-analysis-button"
                onClick={handleRunAnalysis}
                disabled={!isAnalysisReady}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '1rem',
                  background: isAnalysisReady ?
                    'linear-gradient(135deg, rgba(0, 200, 83, 0.9), rgba(0, 102, 204, 0.9))' :
                    'rgba(100, 100, 100, 0.3)',
                  color: 'white',
                  padding: '1.5rem 3rem',
                  border: 'none',
                  borderRadius: '50px',
                  fontSize: '1.3rem',
                  fontWeight: '700',
                  cursor: isAnalysisReady ? 'pointer' : 'not-allowed',
                  transition: 'all 0.3s ease',
                  boxShadow: isAnalysisReady ?
                    '0 10px 30px rgba(0, 200, 83, 0.4)' :
                    '0 4px 15px rgba(0, 0, 0, 0.2)',
                  textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
                  backdropFilter: 'blur(10px)',
                  borderWidth: '2px',
                  borderStyle: 'solid',
                  borderColor: isAnalysisReady ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.1)'
                }}
                onMouseEnter={(e) => {
                  if (isAnalysisReady) {
                    e.currentTarget.style.transform = 'translateY(-3px) scale(1.02)'
                    e.currentTarget.style.boxShadow = '0 15px 40px rgba(0, 200, 83, 0.5)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (isAnalysisReady) {
                    e.currentTarget.style.transform = 'translateY(0) scale(1)'
                    e.currentTarget.style.boxShadow = '0 10px 30px rgba(0, 200, 83, 0.4)'
                  }
                }}
              >
                <span style={{ fontSize: '1.5rem' }}>🚀</span>
                Run Deep Analysis
              </button>
            </div>

            {/* Confirmation Panel */}
            {showConfirmation && (
              <div className="deep-analysis-confirmation" style={{
                background: 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(20px)',
                border: '2px solid rgba(0, 200, 83, 0.5)',
                borderRadius: '20px',
                padding: '2rem',
                boxShadow: '0 20px 50px rgba(0, 200, 83, 0.3)',
                animation: 'fadeInUp 0.4s ease-out',
                marginTop: '2rem'
              }}>
                <h3 style={{
                  fontSize: '1.5rem',
                  fontWeight: '600',
                  color: 'white',
                  marginBottom: '1rem',
                  textAlign: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}>
                  ✅ Confirm Analysis
                </h3>

                <div style={{
                  background: 'rgba(0, 200, 83, 0.1)',
                  border: '1px solid rgba(0, 200, 83, 0.3)',
                  borderRadius: '10px',
                  padding: '1.5rem',
                  marginBottom: '1.5rem',
                  textAlign: 'center'
                }}>
                  <p style={{
                    fontSize: '1.2rem',
                    fontWeight: '600',
                    color: 'rgba(0, 200, 83, 0.9)',
                    margin: 0
                  }}>
                    {getAnalysisSummary()}
                  </p>
                </div>

                <div className="deep-analysis-confirmation-buttons" style={{
                  display: 'flex',
                  gap: '1rem',
                  justifyContent: 'center'
                }}>
                  <button
                    onClick={handleConfirm}
                    style={{
                      background: 'linear-gradient(135deg, rgba(0, 200, 83, 0.9), rgba(0, 150, 60, 0.9))',
                      color: 'white',
                      padding: '1rem 2rem',
                      border: 'none',
                      borderRadius: '10px',
                      fontSize: '1.1rem',
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
                    Confirm & Run
                  </button>

                  <button
                    onClick={handleCancel}
                    style={{
                      background: 'rgba(239, 68, 68, 0.1)',
                      color: 'rgba(239, 68, 68, 0.9)',
                      padding: '1rem 2rem',
                      border: '2px solid rgba(239, 68, 68, 0.3)',
                      borderRadius: '10px',
                      fontSize: '1.1rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      backdropFilter: 'blur(10px)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'
                      e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.5)'
                      e.currentTarget.style.transform = 'translateY(-2px)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'
                      e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)'
                      e.currentTarget.style.transform = 'translateY(0)'
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Loading State */}
            {isAnalyzing && (
              <div className="analysis-loading" style={{
                background: 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(20px)',
                border: '2px solid rgba(0, 200, 83, 0.5)',
                borderRadius: '20px',
                padding: '2rem',
                textAlign: 'center',
                animation: 'fadeInUp 0.4s ease-out',
                marginTop: '2rem'
              }}>
                <div style={{
                  fontSize: '3rem',
                  marginBottom: '1rem',
                  animation: 'spin 2s linear infinite'
                }}>
                  🔄
                </div>
                <h3 style={{
                  fontSize: '1.5rem',
                  fontWeight: '600',
                  color: 'white',
                  marginBottom: '0.5rem'
                }}>
                  Analyzing {analysisType === 'sector' ? selectedSector?.label : selectedSymbols.join(', ')}...
                </h3>
                <p style={{
                  fontSize: '1rem',
                  color: 'rgba(255, 255, 255, 0.7)',
                  margin: 0
                }}>
                  Processing market data and running advanced algorithms
                </p>
              </div>
            )}

            {/* Error State */}
            {error && (
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
                <div style={{
                  fontSize: '2rem',
                  marginBottom: '1rem'
                }}>
                  ❌
                </div>
                <h3 style={{
                  fontSize: '1.3rem',
                  fontWeight: '600',
                  color: 'rgba(239, 68, 68, 0.9)',
                  marginBottom: '0.5rem'
                }}>
                  Analysis Failed
                </h3>
                <p style={{
                  fontSize: '1rem',
                  color: 'rgba(239, 68, 68, 0.8)',
                  margin: 0
                }}>
                  {error}
                </p>
                <button
                  onClick={() => setError(null)}
                  style={{
                    marginTop: '1rem',
                    padding: '0.5rem 1rem',
                    background: 'rgba(239, 68, 68, 0.2)',
                    border: '1px solid rgba(239, 68, 68, 0.5)',
                    borderRadius: '8px',
                    color: 'rgba(239, 68, 68, 0.9)',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(239, 68, 68, 0.3)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'
                  }}
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Results Display */}
            {analysisResult && analysisResult.success && (
              <div className="analysis-results" style={{
                background: 'rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(20px)',
                border: '2px solid rgba(0, 200, 83, 0.3)',
                borderRadius: '20px',
                padding: '2rem',
                animation: 'fadeInUp 0.4s ease-out',
                marginTop: '2rem'
              }}>
                {/* Results Header */}
                <div style={{
                  textAlign: 'center',
                  marginBottom: '2rem',
                  paddingBottom: '1.5rem',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                  <h2 style={{
                    fontSize: '2rem',
                    fontWeight: '700',
                    color: 'white',
                    marginBottom: '0.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem'
                  }}>
                    📊 Analysis Complete
                  </h2>
                  <p style={{
                    fontSize: '1rem',
                    color: 'rgba(255, 255, 255, 0.7)',
                    margin: 0
                  }}>
                    Found {analysisResult.topSelections.length} recommendations in {analysisResult.executionTime}ms
                  </p>
                </div>

                {/* Metadata Panel */}
                <div style={{
                  background: 'rgba(0, 200, 83, 0.1)',
                  border: '1px solid rgba(0, 200, 83, 0.3)',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  marginBottom: '2rem'
                }}>
                  <h3 style={{
                    fontSize: '1.2rem',
                    fontWeight: '600',
                    color: 'rgba(0, 200, 83, 0.9)',
                    marginBottom: '1rem'
                  }}>
                    Analysis Metadata
                  </h3>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '1rem',
                    fontSize: '0.9rem',
                    color: 'rgba(255, 255, 255, 0.8)'
                  }}>
                    <div>
                      <strong>Algorithm:</strong> {analysisResult.metadata.algorithmUsed}
                    </div>
                    <div>
                      <strong>Data Sources:</strong> {analysisResult.metadata.dataSourcesUsed.join(', ')}
                    </div>
                    <div>
                      <strong>Cache Hit Rate:</strong> {Math.round(analysisResult.metadata.cacheHitRate * 100)}%
                    </div>
                    <div>
                      <strong>Quality Score:</strong> {Math.round(analysisResult.metadata.qualityScore.overall * 100)}%
                    </div>
                  </div>
                </div>

                {/* Stock Results Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
                  gap: '1.5rem'
                }}>
                  {analysisResult.topSelections.map((stock, index) => (
                    <div
                      key={stock.symbol}
                      style={{
                        background: 'rgba(255, 255, 255, 0.08)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '15px',
                        padding: '1.5rem',
                        transition: 'all 0.3s ease',
                        cursor: 'pointer'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)'
                        e.currentTarget.style.borderColor = 'rgba(0, 200, 83, 0.4)'
                        e.currentTarget.style.transform = 'translateY(-2px)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'
                        e.currentTarget.style.transform = 'translateY(0)'
                      }}
                    >
                      {/* Stock Header */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '1rem'
                      }}>
                        <div>
                          <h4 style={{
                            fontSize: '1.3rem',
                            fontWeight: '700',
                            color: 'white',
                            margin: 0
                          }}>
                            {stock.symbol}
                          </h4>
                          <p style={{
                            fontSize: '0.9rem',
                            color: 'rgba(255, 255, 255, 0.6)',
                            margin: 0
                          }}>
                            {stock.context.sector}
                          </p>
                        </div>
                        <div style={{
                          textAlign: 'right'
                        }}>
                          <div style={{
                            fontSize: '1.1rem',
                            fontWeight: '600',
                            color: stock.action === 'BUY' ? 'rgba(0, 200, 83, 0.9)' :
                                   stock.action === 'SELL' ? 'rgba(239, 68, 68, 0.9)' :
                                   'rgba(255, 193, 7, 0.9)'
                          }}>
                            {stock.action}
                          </div>
                          <div style={{
                            fontSize: '0.9rem',
                            color: 'rgba(255, 255, 255, 0.7)'
                          }}>
                            {Math.round(stock.confidence * 100)}% confidence
                          </div>
                        </div>
                      </div>

                      {/* Score Breakdown */}
                      <div style={{
                        marginBottom: '1rem'
                      }}>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '0.5rem'
                        }}>
                          <span style={{
                            fontSize: '0.9rem',
                            color: 'rgba(255, 255, 255, 0.8)'
                          }}>
                            Overall Score
                          </span>
                          <span style={{
                            fontSize: '1rem',
                            fontWeight: '600',
                            color: 'white'
                          }}>
                            {Math.round(stock.score.overall * 100)}%
                          </span>
                        </div>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          gap: '0.5rem',
                          fontSize: '0.8rem',
                          color: 'rgba(255, 255, 255, 0.6)'
                        }}>
                          <div>Technical: {Math.round(stock.score.technical * 100)}%</div>
                          <div>Fundamental: {Math.round(stock.score.fundamental * 100)}%</div>
                          <div>Sentiment: {Math.round(stock.score.sentiment * 100)}%</div>
                          <div>Weight: {Math.round(stock.weight * 100)}%</div>
                        </div>
                      </div>

                      {/* Primary Factors */}
                      {stock.reasoning.primaryFactors.length > 0 && (
                        <div style={{
                          marginBottom: '1rem'
                        }}>
                          <h5 style={{
                            fontSize: '0.9rem',
                            fontWeight: '600',
                            color: 'rgba(0, 200, 83, 0.9)',
                            marginBottom: '0.5rem',
                            margin: 0
                          }}>
                            Key Factors:
                          </h5>
                          <ul style={{
                            fontSize: '0.8rem',
                            color: 'rgba(255, 255, 255, 0.7)',
                            margin: '0.5rem 0 0 0',
                            paddingLeft: '1rem'
                          }}>
                            {stock.reasoning.primaryFactors.slice(0, 3).map((factor, i) => (
                              <li key={i} style={{ marginBottom: '0.2rem' }}>
                                {factor}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Context Info */}
                      <div style={{
                        fontSize: '0.8rem',
                        color: 'rgba(255, 255, 255, 0.5)',
                        paddingTop: '0.5rem',
                        borderTop: '1px solid rgba(255, 255, 255, 0.1)'
                      }}>
                        Market Cap: ${(stock.context.marketCap / 1e9).toFixed(1)}B
                        {stock.context.priceChange24h !== undefined && (
                          <span style={{ marginLeft: '1rem' }}>
                            24h: {stock.context.priceChange24h > 0 ? '+' : ''}{stock.context.priceChange24h.toFixed(2)}%
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Performance Metrics */}
                {analysisResult.performance && (
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    padding: '1.5rem',
                    marginTop: '2rem'
                  }}>
                    <h3 style={{
                      fontSize: '1.2rem',
                      fontWeight: '600',
                      color: 'white',
                      marginBottom: '1rem'
                    }}>
                      Performance Metrics
                    </h3>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                      gap: '1rem',
                      fontSize: '0.9rem',
                      color: 'rgba(255, 255, 255, 0.8)'
                    }}>
                      <div>
                        <strong>Data Fetch:</strong> {analysisResult.performance.dataFetchTime}ms
                      </div>
                      <div>
                        <strong>Analysis:</strong> {analysisResult.performance.analysisTime}ms
                      </div>
                      <div>
                        <strong>Fusion:</strong> {analysisResult.performance.fusionTime}ms
                      </div>
                      <div>
                        <strong>Cache:</strong> {analysisResult.performance.cacheTime}ms
                      </div>
                    </div>
                  </div>
                )}

                {/* New Analysis Button */}
                <div style={{
                  textAlign: 'center',
                  marginTop: '2rem',
                  paddingTop: '1.5rem',
                  borderTop: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                  <button
                    onClick={() => {
                      setAnalysisResult(null)
                      setError(null)
                      setSelectedSector(undefined)
                      setSelectedSymbols([])
                      setAnalysisType(null)
                      setShowConfirmation(false)
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      background: 'rgba(255, 255, 255, 0.1)',
                      backdropFilter: 'blur(10px)',
                      color: 'white',
                      padding: '1rem 2rem',
                      border: '2px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '12px',
                      fontSize: '1.1rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'
                      e.currentTarget.style.borderColor = 'rgba(0, 200, 83, 0.5)'
                      e.currentTarget.style.transform = 'translateY(-2px)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
                      e.currentTarget.style.transform = 'translateY(0)'
                    }}
                  >
                    <span>🔄</span>
                    Start New Analysis
                  </button>
                </div>
              </div>
            )}

            {/* Frontend Analysis Success State */}
            {frontendAnalysisResult && (
              <div className="analysis-success" style={{
                background: 'rgba(0, 200, 83, 0.1)',
                backdropFilter: 'blur(20px)',
                border: '2px solid rgba(0, 200, 83, 0.5)',
                borderRadius: '20px',
                padding: '2rem',
                textAlign: 'center',
                animation: 'fadeInUp 0.4s ease-out',
                marginTop: '2rem'
              }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>
                  ✅
                </div>

                <h3 style={{
                  fontSize: '1.5rem',
                  fontWeight: '600',
                  color: 'rgba(0, 200, 83, 0.9)',
                  marginBottom: '1rem'
                }}>
                  Analysis Complete!
                </h3>

                <div style={{
                  background: 'rgba(0, 200, 83, 0.1)',
                  border: '1px solid rgba(0, 200, 83, 0.3)',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  marginBottom: '2rem',
                  textAlign: 'left'
                }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '1rem',
                    fontSize: '0.9rem',
                    color: 'rgba(255, 255, 255, 0.8)'
                  }}>
                    <div>
                      <strong>Processing Time:</strong> {frontendAnalysisResult.processingTime}ms
                    </div>
                    <div>
                      <strong>Results Count:</strong> {frontendAnalysisResult.resultsCount} stocks
                    </div>
                    <div>
                      <strong>Analysis Mode:</strong> {frontendAnalysisResult.metadata.mode}
                    </div>
                    <div>
                      <strong>Data Sources:</strong> {frontendAnalysisResult.metadata.dataSourcesUsed.length} sources
                    </div>
                  </div>

                  <div style={{
                    marginTop: '1rem',
                    paddingTop: '1rem',
                    borderTop: '1px solid rgba(0, 200, 83, 0.3)'
                  }}>
                    <p style={{
                      margin: 0,
                      fontSize: '0.85rem',
                      color: 'rgba(255, 255, 255, 0.6)'
                    }}>
                      <strong>Analysis File:</strong> {frontendAnalysisResult.filePath}
                    </p>
                  </div>
                </div>

                <div className="success-actions" style={{
                  display: 'flex',
                  gap: '1rem',
                  justifyContent: 'center',
                  flexWrap: 'wrap'
                }}>
                  <a
                    href={`/analysis-results/${frontendAnalysisResult.filePath}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '1rem 2rem',
                      background: 'linear-gradient(135deg, rgba(0, 200, 83, 0.9), rgba(0, 150, 60, 0.9))',
                      color: 'white',
                      textDecoration: 'none',
                      borderRadius: '12px',
                      fontSize: '1.1rem',
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
                    <span>📊</span>
                    View Analysis Results
                  </a>

                  <button
                    onClick={() => {
                      setFrontendAnalysisResult(null)
                      setError(null)
                      setSelectedSector(undefined)
                      setSelectedSymbols([])
                      setAnalysisType(null)
                      setShowConfirmation(false)
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '1rem 2rem',
                      background: 'rgba(255, 255, 255, 0.1)',
                      backdropFilter: 'blur(10px)',
                      color: 'white',
                      border: '2px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '12px',
                      fontSize: '1.1rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'
                      e.currentTarget.style.borderColor = 'rgba(0, 200, 83, 0.5)'
                      e.currentTarget.style.transform = 'translateY(-2px)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
                      e.currentTarget.style.transform = 'translateY(0)'
                    }}
                  >
                    <span>🔄</span>
                    Start New Analysis
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        <footer className="footer">
          <p>© 2025 Veritak Financial Research LLC | Educational & Informational Use Only</p>
          <p>✨ Transparency First • 🔒 Government Data Sources • 📚 Educational Focus</p>
          <p style={{marginTop: '1rem', fontSize: '0.85rem', opacity: 0.8}}>
            Deep Analysis tools are provided for educational purposes only and should not be considered as investment advice.
          </p>
        </footer>
      </div>
    </>
  )
}