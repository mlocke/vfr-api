'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import SectorDropdown, { SectorOption } from '../components/SectorDropdown'
import StockAutocomplete from '../components/StockAutocomplete'
import AnalysisResults from '../components/admin/AnalysisResults'
import { AnalysisRequest, AnalysisResponse } from '../components/admin/AnalysisEngineTest'

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
    // Only clear results if the selection actually changed
    const symbolsChanged = JSON.stringify(symbols.sort()) !== JSON.stringify(selectedSymbols.sort())

    setSelectedSymbols(symbols)
    setSelectedSector(undefined)
    setAnalysisType(symbols.length > 0 ? 'tickers' : null)

    // Only clear previous results if symbols actually changed
    if (symbolsChanged) {
      setResults(null)
      setError(null)
    }
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
        // Remove frontend timeout to match admin dashboard behavior
        // Backend handles timeouts via config.timeout parameter
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Analysis failed' }))
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

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

            {/* Analysis Results - Using the working component from admin dashboard */}
            <AnalysisResults
              results={results}
              error={error}
              isRunning={isAnalyzing}
            />
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