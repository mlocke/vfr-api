'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import SectorDropdown, { SectorOption } from '../components/SectorDropdown'
import StockAutocomplete from '../components/StockAutocomplete'

// Simple types based on working admin implementation
interface AnalysisRequest {
  mode: 'single' | 'sector' | 'multiple'
  symbols?: string[]
  sector?: string
  limit?: number
}

interface AnalysisResponse {
  success: boolean
  data?: {
    stocks: Array<{
      symbol: string
      price: number
      compositeScore: number
      recommendation: 'BUY' | 'SELL' | 'HOLD'
      sector: string
    }>
    metadata: {
      mode: string
      count: number
      timestamp: number
      sources: string[]
      technicalAnalysisEnabled?: boolean
      fundamentalDataEnabled?: boolean
      analystDataEnabled?: boolean
      sentimentAnalysisEnabled?: boolean
      macroeconomicAnalysisEnabled?: boolean
      esgAnalysisEnabled?: boolean
      shortInterestAnalysisEnabled?: boolean
      extendedMarketDataEnabled?: boolean
      analysisInputServices?: Record<string, any>
    }
  }
  error?: string
}

export default function StockIntelligencePage() {
  // Simple state management - following admin pattern
  const [selectedSector, setSelectedSector] = useState<SectorOption | undefined>()
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>([])
  const [analysisType, setAnalysisType] = useState<'sector' | 'tickers' | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [results, setResults] = useState<AnalysisResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSectorChange = (sector: SectorOption) => {
    setSelectedSector(sector)
    setSelectedSymbols([])
    setAnalysisType('sector')
    // Clear previous results
    setResults(null)
    setError(null)
  }

  const handleSymbolSelectionChange = (symbols: string[]) => {
    setSelectedSymbols(symbols)
    setSelectedSector(undefined)
    setAnalysisType(symbols.length > 0 ? 'tickers' : null)
    // Clear previous results
    setResults(null)
    setError(null)
  }

  const handleRunAnalysis = async () => {
    if (!analysisType) return

    setIsAnalyzing(true)
    setError(null)
    setResults(null)

    try {
      // Build request using the SAME format as working admin
      let request: AnalysisRequest = { mode: 'single', limit: 10 }

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
            symbols: selectedSymbols,
            limit: 1
          }
        } else {
          request = {
            mode: 'multiple',
            symbols: selectedSymbols,
            limit: selectedSymbols.length
          }
        }
      }

      console.log('📊 Sending analysis request:', request)

      // Use the SAME working API endpoint as admin
      const response = await fetch('/api/stocks/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Analysis failed' }))
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      console.log('✅ Analysis response:', data)

      if (data.success) {
        setResults(data)
      } else {
        setError(data.error || 'Analysis failed')
      }

    } catch (error) {
      console.error('❌ Analysis failed:', error)
      setError(error instanceof Error ? error.message : 'Analysis failed. Please try again.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const isAnalysisReady = (analysisType === 'sector' && selectedSector) ||
                         (analysisType === 'tickers' && selectedSymbols.length > 0)

  const getAnalysisSummary = () => {
    if (analysisType === 'sector' && selectedSector) {
      return `Analyzing: ${selectedSector.label} Sector`
    }
    if (analysisType === 'tickers' && selectedSymbols.length > 0) {
      return `Analyzing: ${selectedSymbols.join(', ')}`
    }
    return ''
  }

  return (
    <>
      {/* Background Animation */}
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

      {/* Back to Home Button */}
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
              <div className="logo-text prominent-logo-text">Stock Intelligence</div>
              <div className="company-tagline">Select. Analyze. Decide.</div>
            </div>
          </div>
          <p className="tagline">Comprehensive Financial Analysis & Market Intelligence Platform</p>
        </header>

        {/* Analysis Section */}
        <section style={{ padding: '2rem 1rem', position: 'relative', zIndex: 2 }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

            {/* Header */}
            <div style={{
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
                🔍 Stock Intelligence
              </h2>
              <p style={{
                fontSize: '1.2rem',
                color: 'rgba(255, 255, 255, 0.8)',
                lineHeight: '1.6',
                maxWidth: '600px',
                margin: '0 auto'
              }}>
                Choose a sector or enter specific stock tickers for comprehensive market analysis
              </p>
            </div>

            {/* Input Grid */}
            <div style={{
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
                onClick={handleRunAnalysis}
                disabled={!isAnalysisReady || isAnalyzing}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '1rem',
                  background: isAnalyzing ?
                    'rgba(100, 100, 100, 0.3)' :
                    isAnalysisReady ?
                      'linear-gradient(135deg, rgba(0, 200, 83, 0.9), rgba(0, 102, 204, 0.9))' :
                      'rgba(100, 100, 100, 0.3)',
                  color: 'white',
                  padding: '1.5rem 3rem',
                  border: 'none',
                  borderRadius: '50px',
                  fontSize: '1.3rem',
                  fontWeight: '700',
                  cursor: (isAnalysisReady && !isAnalyzing) ? 'pointer' : 'not-allowed',
                  transition: 'all 0.3s ease',
                  boxShadow: (isAnalysisReady && !isAnalyzing) ?
                    '0 10px 30px rgba(0, 200, 83, 0.4)' :
                    '0 4px 15px rgba(0, 0, 0, 0.2)',
                  textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
                  backdropFilter: 'blur(10px)',
                  borderWidth: '2px',
                  borderStyle: 'solid',
                  borderColor: (isAnalysisReady && !isAnalyzing) ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.1)'
                }}
                onMouseEnter={(e) => {
                  if (isAnalysisReady && !isAnalyzing) {
                    e.currentTarget.style.transform = 'translateY(-3px) scale(1.02)'
                    e.currentTarget.style.boxShadow = '0 15px 40px rgba(0, 200, 83, 0.5)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (isAnalysisReady && !isAnalyzing) {
                    e.currentTarget.style.transform = 'translateY(0) scale(1)'
                    e.currentTarget.style.boxShadow = '0 10px 30px rgba(0, 200, 83, 0.4)'
                  }
                }}
              >
                <span style={{
                  fontSize: '1.5rem',
                  animation: isAnalyzing ? 'spin 2s linear infinite' : 'none'
                }}>
                  {isAnalyzing ? '⏳' : '🚀'}
                </span>
                {isAnalyzing ? 'Running Analysis...' : 'Run Deep Analysis'}
              </button>

              {isAnalyzing && (
                <div style={{
                  marginTop: '1rem',
                  padding: '1rem',
                  background: 'rgba(0, 200, 83, 0.1)',
                  border: '1px solid rgba(0, 200, 83, 0.3)',
                  borderRadius: '12px',
                  color: 'rgba(0, 200, 83, 0.9)',
                  fontSize: '1rem',
                  fontWeight: '600'
                }}>
                  {getAnalysisSummary()}
                </div>
              )}
            </div>

            {/* Error Display */}
            {error && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.1)',
                backdropFilter: 'blur(20px)',
                border: '2px solid rgba(239, 68, 68, 0.5)',
                borderRadius: '20px',
                padding: '2rem',
                textAlign: 'center',
                marginBottom: '2rem'
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
            {results && results.success && (
              <div style={{
                background: 'rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(20px)',
                border: '2px solid rgba(0, 200, 83, 0.3)',
                borderRadius: '20px',
                padding: '2rem',
                marginBottom: '2rem'
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
                    marginBottom: '0.5rem'
                  }}>
                    Found {results.data?.stocks.length || 0} recommendations
                  </p>
                </div>

                {/* Analysis Metadata */}
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
                    Analysis Details
                  </h3>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '1rem',
                    fontSize: '0.9rem',
                    color: 'rgba(255, 255, 255, 0.8)'
                  }}>
                    <div>
                      <strong>Mode:</strong> {results.data?.metadata.mode || 'N/A'}
                    </div>
                    <div>
                      <strong>Data Sources:</strong> {results.data?.metadata.sources?.join(', ') || 'N/A'}
                    </div>
                    <div>
                      <strong>Technical Analysis:</strong> {results.data?.metadata.technicalAnalysisEnabled ? '✅' : '❌'}
                    </div>
                    <div>
                      <strong>Sentiment Analysis:</strong> {results.data?.metadata.sentimentAnalysisEnabled ? '✅' : '❌'}
                    </div>
                    <div>
                      <strong>Fundamental Data:</strong> {results.data?.metadata.fundamentalDataEnabled ? '✅' : '❌'}
                    </div>
                    <div>
                      <strong>ESG Analysis:</strong> {results.data?.metadata.esgAnalysisEnabled ? '✅' : '❌'}
                    </div>
                  </div>
                </div>

                {/* Stock Results Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                  gap: '1.5rem'
                }}>
                  {(results.data?.stocks || []).map((stock, index) => (
                    <div
                      key={stock.symbol}
                      style={{
                        background: 'rgba(255, 255, 255, 0.08)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '15px',
                        padding: '1.5rem',
                        transition: 'all 0.3s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)'
                        e.currentTarget.style.borderColor = 'rgba(0, 200, 83, 0.4)'
                        e.currentTarget.style.transform = 'translateY(-2px)'
                        e.currentTarget.style.boxShadow = '0 8px 25px rgba(0, 200, 83, 0.15)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'
                        e.currentTarget.style.transform = 'translateY(0)'
                        e.currentTarget.style.boxShadow = 'none'
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
                            {stock.sector}
                          </p>
                        </div>
                        <div style={{
                          textAlign: 'right'
                        }}>
                          <div style={{
                            fontSize: '1.1rem',
                            fontWeight: '600',
                            color: stock.recommendation === 'BUY' ? 'rgba(0, 200, 83, 0.9)' :
                                   stock.recommendation === 'SELL' ? 'rgba(239, 68, 68, 0.9)' :
                                   'rgba(255, 193, 7, 0.9)'
                          }}>
                            {stock.recommendation}
                          </div>
                          <div style={{
                            fontSize: '0.9rem',
                            color: 'rgba(255, 255, 255, 0.7)'
                          }}>
                            Score: {stock.compositeScore}%
                          </div>
                        </div>
                      </div>

                      {/* Stock Details */}
                      <div style={{
                        fontSize: '0.9rem',
                        color: 'rgba(255, 255, 255, 0.8)',
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '0.5rem'
                      }}>
                        <div>
                          <strong>Price:</strong> ${stock.price.toFixed(2)}
                        </div>
                        <div>
                          <strong>Sector:</strong> {stock.sector}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* New Analysis Button */}
                <div style={{
                  textAlign: 'center',
                  marginTop: '2rem',
                  paddingTop: '1.5rem',
                  borderTop: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                  <button
                    onClick={() => {
                      setResults(null)
                      setError(null)
                      setSelectedSector(undefined)
                      setSelectedSymbols([])
                      setAnalysisType(null)
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
          </div>
        </section>

        <footer className="footer">
          <p>© 2025 Veritak Financial Research LLC | Educational & Informational Use Only</p>
          <p>✨ Transparency First • 🔒 Government Data Sources • 📚 Educational Focus</p>
          <p style={{marginTop: '1rem', fontSize: '0.85rem', opacity: 0.8}}>
            Stock Intelligence tools are provided for educational purposes only and should not be considered as investment advice.
          </p>
        </footer>
      </div>

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @media (max-width: 768px) {
          .main-container {
            margin-top: 80px !important;
          }

          div[style*="grid-template-columns: 1fr 1fr"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </>
  )
}