'use client'

import { useState } from 'react'
import Link from 'next/link'
import StockTicker from './components/StockTicker'
import SectorDropdown, { SectorOption } from './components/SectorDropdown'
import MarketSentimentHeatmap from './components/market/MarketSentimentHeatmap'
import EconomicCalendar from './components/market/EconomicCalendar'
import SectorRotationWheel from './components/market/SectorRotationWheel'

interface SymbolData {
  proName: string
  title: string
}

export default function Home() {
  const [currentSector, setCurrentSector] = useState<SectorOption | undefined>()
  const [symbols, setSymbols] = useState<SymbolData[]>([])
  const [loading, setLoading] = useState(false)
  const [showLogoModal, setShowLogoModal] = useState(false)

  const handleSectorChange = async (sector: SectorOption) => {
    console.log('🔄 Sector changed to:', sector.label, '(', sector.id, ')')
    setCurrentSector(sector)
    setLoading(true)
    
    try {
      const response = await fetch(`/api/stocks/by-sector?sector=${sector.id}`)
      const data = await response.json()
      
      console.log('📈 API Response:', data)
      
      if (data.success && data.symbols && Array.isArray(data.symbols)) {
        console.log('✅ Setting', data.symbols.length, 'symbols:', 
          data.symbols.map((s: any) => s.proName).join(', '))
        setSymbols(data.symbols)
      } else {
        console.error('❌ API error:', data.error)
      }
    } catch (error) {
      console.error('❌ Fetch error:', error)
      console.log('Using default symbols due to API error')
    } finally {
      setLoading(false)
    }
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

      {/* Sector Selection - Positioned below ticker with proper spacing */}
      <div 
        className="sector-selection-container" 
        style={{
          position: 'fixed',
          top: '65px',
          left: '20px',
          zIndex: 1100,
          backgroundColor: 'transparent'
        }}
      >
        <SectorDropdown 
          onSectorChange={handleSectorChange}
          loading={loading}
          currentSector={currentSector}
        />
      </div>

      {/* Stock Intelligence Button - Fixed position top right */}
      <div
        className="stock-intelligence-button-container"
        style={{
          position: 'fixed',
          top: '65px',
          right: '20px',
          zIndex: 1100,
          backgroundColor: 'transparent',
          width: 'auto',
          maxWidth: 'calc(100vw - 40px)',
          minWidth: '200px'
        }}
      >
        <Link
          href="/stock-intelligence"
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
            <span className="mr-2 text-lg">🧠</span>
            <span className="hidden sm:inline">&nbsp;Analyze Stocks & Options</span>
          </span>
          <span style={{
            fontSize: '12px',
            color: 'rgba(239, 68, 68, 0.6)',
            transition: 'transform 200ms cubic-bezier(0.4, 0, 0.2, 1)'
          }}>
            →
          </span>
        </Link>
      </div>

      {/* Admin Dashboard Button - Fixed position below Market Intelligence */}
      <div
        className="admin-button-container"
        style={{
          position: 'fixed',
          top: '125px',
          right: '20px',
          zIndex: 1100,
          backgroundColor: 'transparent',
          width: 'auto',
          maxWidth: 'calc(100vw - 40px)',
          minWidth: '200px'
        }}
      >
        <Link
          href="/admin"
          className="inline-flex items-center justify-between w-full"
          style={{
            padding: '10px 14px',
            minHeight: '44px',
            background: 'rgba(17, 24, 39, 0.85)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            border: '2px solid rgba(99, 102, 241, 0.6)',
            borderRadius: '10px',
            color: 'rgba(255, 255, 255, 0.95)',
            fontWeight: '500',
            fontSize: '13px',
            textDecoration: 'none',
            cursor: 'pointer',
            transition: 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: `
              0 3px 10px rgba(0, 0, 0, 0.4),
              0 0 0 0 rgba(99, 102, 241, 0.3),
              inset 0 1px 0 rgba(255, 255, 255, 0.1)
            `
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(31, 41, 55, 0.9)'
            e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.8)'
            e.currentTarget.style.boxShadow = `
              0 6px 20px rgba(0, 0, 0, 0.5),
              0 0 20px rgba(99, 102, 241, 0.4),
              0 0 40px rgba(99, 102, 241, 0.2),
              0 0 0 1px rgba(99, 102, 241, 0.3),
              inset 0 1px 0 rgba(255, 255, 255, 0.15)
            `
            e.currentTarget.style.transform = 'translateY(-1px)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(17, 24, 39, 0.85)'
            e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.6)'
            e.currentTarget.style.boxShadow = `
              0 3px 10px rgba(0, 0, 0, 0.4),
              0 0 0 0 rgba(99, 102, 241, 0.3),
              inset 0 1px 0 rgba(255, 255, 255, 0.1)
            `
            e.currentTarget.style.transform = 'translateY(0)'
          }}
        >
          <span className="flex items-center">
            <span className="mr-2 text-lg">🔧</span>
            <span className="hidden sm:inline">&nbsp;Real-Time Status</span>
          </span>
          <span style={{
            fontSize: '12px',
            color: 'rgba(99, 102, 241, 0.6)',
            transition: 'transform 200ms cubic-bezier(0.4, 0, 0.2, 1)'
          }}>
            →
          </span>
        </Link>
      </div>

      {/* Early Signal Detection Guide - Fixed position below Admin Dashboard */}
      <div
        className="early-signal-button-container"
        style={{
          position: 'fixed',
          top: '185px',
          right: '20px',
          zIndex: 1100,
          backgroundColor: 'transparent',
          width: 'auto',
          maxWidth: 'calc(100vw - 40px)',
          minWidth: '200px'
        }}
      >
        <Link
          href="/early-signal-detection"
          className="inline-flex items-center justify-between w-full"
          style={{
            padding: '10px 14px',
            minHeight: '44px',
            background: 'rgba(17, 24, 39, 0.85)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            border: '2px solid rgba(16, 185, 129, 0.6)',
            borderRadius: '10px',
            color: 'rgba(255, 255, 255, 0.95)',
            fontWeight: '500',
            fontSize: '13px',
            textDecoration: 'none',
            cursor: 'pointer',
            transition: 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: `
              0 3px 10px rgba(0, 0, 0, 0.4),
              0 0 0 0 rgba(16, 185, 129, 0.3),
              inset 0 1px 0 rgba(255, 255, 255, 0.1)
            `
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(31, 41, 55, 0.9)'
            e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.8)'
            e.currentTarget.style.boxShadow = `
              0 6px 20px rgba(0, 0, 0, 0.5),
              0 0 20px rgba(16, 185, 129, 0.4),
              0 0 40px rgba(16, 185, 129, 0.2),
              0 0 0 1px rgba(16, 185, 129, 0.3),
              inset 0 1px 0 rgba(255, 255, 255, 0.15)
            `
            e.currentTarget.style.transform = 'translateY(-1px)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(17, 24, 39, 0.85)'
            e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.6)'
            e.currentTarget.style.boxShadow = `
              0 3px 10px rgba(0, 0, 0, 0.4),
              0 0 0 0 rgba(16, 185, 129, 0.3),
              inset 0 1px 0 rgba(255, 255, 255, 0.1)
            `
            e.currentTarget.style.transform = 'translateY(0)'
          }}
        >
          <span className="flex items-center">
            <span className="mr-2 text-lg">🤖</span>
            <span className="hidden sm:inline">&nbsp;ML User Guide</span>
          </span>
          <span style={{
            fontSize: '12px',
            color: 'rgba(16, 185, 129, 0.6)',
            transition: 'transform 200ms cubic-bezier(0.4, 0, 0.2, 1)'
          }}>
            →
          </span>
        </Link>
      </div>

      {/* Stock Ticker Component */}
      <StockTicker symbols={symbols} />

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
              onClick={() => setShowLogoModal(true)}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            />
            <div className="logo-text-container">
              <div className="logo-text prominent-logo-text">Veritak Financial Research LLC</div>
              <div className="company-tagline">Select. Analyze. Decide.</div>
            </div>
          </div>
          <p className="tagline">Comprehensive Financial Analysis & Market Intelligence Platform</p>
        </header>

        <main className="hero">
          <div className="hero-content">
            <div className="hero-text">
              <h1 className="hero-title">Intelligent Market Analysis</h1>
              <p className="hero-subtitle">
                Harness the power of real-time data, advanced analytics, and machine
                learning to make informed investment decisions. Veritak's platform aggregates
                data from government sources, commercial APIs, and web intelligence to deliver 
                comprehensive financial research and market intelligence.
              </p>
              <Link href="/stock-intelligence" className="cta-button">
                <span>🧠</span>
                Analyze Stocks & Options
              </Link>
            </div>
            <div className="dashboard-preview">
              <div className="live-dashboard-container">
                {/* Market Sentiment Heatmap */}
                <div className="dashboard-section">
                  <MarketSentimentHeatmap />
                </div>

                {/* Dashboard Grid Layout */}
                <div className="dashboard-grid">
                  <div className="dashboard-left">
                    <EconomicCalendar />
                  </div>

                  <div className="dashboard-right">
                    <SectorRotationWheel />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>

        <section className="data-engines-section">
          <div className="data-engines-container">
            <div className="data-engines-header">
              <h2 className="data-engines-title">Powered by 14 Financial Data Sources</h2>
              <p className="data-engines-subtitle">
                Institutional-grade data sources across the entire financial ecosystem
              </p>
            </div>

            <div className="data-engines-grid">
              {/* Financial & Market Data Category */}
              <div className="data-category">
                <div className="category-header">
                  <span className="category-icon">📈</span>
                  <h3 className="category-title">Financial & Market Data</h3>
                  <span className="category-count">7 Sources</span>
                </div>
                <div className="data-sources-grid">
                  <div className="data-source-card premium">
                    <div className="source-icon">📊</div>
                    <div className="source-info">
                      <h4 className="source-name">Polygon.io</h4>
                      <p className="source-desc">Real-time market data</p>
                    </div>
                    <div className="source-status live"></div>
                  </div>
                  <div className="data-source-card premium">
                    <div className="source-icon">📈</div>
                    <div className="source-info">
                      <h4 className="source-name">Financial Modeling Prep</h4>
                      <p className="source-desc">Financial modeling & analysis</p>
                    </div>
                    <div className="source-status live"></div>
                  </div>
                  <div className="data-source-card free">
                    <div className="source-icon">💰</div>
                    <div className="source-info">
                      <h4 className="source-name">Yahoo Finance</h4>
                      <p className="source-desc">Comprehensive stock analysis</p>
                    </div>
                    <div className="source-status live"></div>
                  </div>
                  <div className="data-source-card government">
                    <div className="source-icon">🏛️</div>
                    <div className="source-info">
                      <h4 className="source-name">SEC EDGAR</h4>
                      <p className="source-desc">SEC filings & insider trading</p>
                    </div>
                    <div className="source-status live"></div>
                  </div>
                  <div className="data-source-card government">
                    <div className="source-icon">🏦</div>
                    <div className="source-info">
                      <h4 className="source-name">Treasury</h4>
                      <p className="source-desc">Treasury yields & federal debt</p>
                    </div>
                    <div className="source-status live"></div>
                  </div>
                  <div className="data-source-card premium">
                    <div className="source-icon">📊</div>
                    <div className="source-info">
                      <h4 className="source-name">EODHD</h4>
                      <p className="source-desc">100K req/day, fundamental ratios</p>
                    </div>
                    <div className="source-status live"></div>
                  </div>
                  <div className="data-source-card free">
                    <div className="source-icon">📈</div>
                    <div className="source-info">
                      <h4 className="source-name">TwelveData</h4>
                      <p className="source-desc">800 req/day technical data</p>
                    </div>
                    <div className="source-status live"></div>
                  </div>
                </div>
              </div>

              {/* Economic Data Category */}
              <div className="data-category">
                <div className="category-header">
                  <span className="category-icon">📊</span>
                  <h3 className="category-title">Economic Data</h3>
                  <span className="category-count">4 Sources</span>
                </div>
                <div className="data-sources-grid">
                  <div className="data-source-card government">
                    <div className="source-icon">🏦</div>
                    <div className="source-info">
                      <h4 className="source-name">FRED</h4>
                      <p className="source-desc">Federal Reserve (800K+ series)</p>
                    </div>
                    <div className="source-status live"></div>
                  </div>
                  <div className="data-source-card government">
                    <div className="source-icon">👥</div>
                    <div className="source-info">
                      <h4 className="source-name">BLS</h4>
                      <p className="source-desc">Employment & inflation data</p>
                    </div>
                    <div className="source-status live"></div>
                  </div>
                  <div className="data-source-card government">
                    <div className="source-icon">⚡</div>
                    <div className="source-info">
                      <h4 className="source-name">EIA</h4>
                      <p className="source-desc">Energy market intelligence</p>
                    </div>
                    <div className="source-status live"></div>
                  </div>
                </div>
              </div>

              {/* Intelligence & Web Data Category */}
              <div className="data-category">
                <div className="category-header">
                  <span className="category-icon">🧠</span>
                  <h3 className="category-title">Intelligence & Analytics</h3>
                  <span className="category-count">3 Sources</span>
                </div>
                <div className="data-sources-grid">
                  <div className="data-source-card premium">
                    <div className="source-icon">🔄</div>
                    <div className="source-info">
                      <h4 className="source-name">Enhanced Data Service</h4>
                      <p className="source-desc">Smart fallback switching</p>
                    </div>
                    <div className="source-status live"></div>
                  </div>
                  <div className="data-source-card premium">
                    <div className="source-icon">📊</div>
                    <div className="source-info">
                      <h4 className="source-name">Options Analysis</h4>
                      <p className="source-desc">Put/call ratios & sentiment</p>
                    </div>
                    <div className="source-status live"></div>
                  </div>
                  <div className="data-source-card premium">
                    <div className="source-icon">📈</div>
                    <div className="source-info">
                      <h4 className="source-name">Technical Indicators</h4>
                      <p className="source-desc">50+ indicators & patterns</p>
                    </div>
                    <div className="source-status live"></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="data-engines-stats">
              <div className="stat-item">
                <div className="stat-number">14</div>
                <div className="stat-label">Data Sources</div>
              </div>
              <div className="stat-item">
                <div className="stat-number">800K+</div>
                <div className="stat-label">Data Series</div>
              </div>
              <div className="stat-item">
                <div className="stat-number">83.8%</div>
                <div className="stat-label">Performance Gain</div>
              </div>
              <div className="stat-item">
                <div className="stat-number">80%</div>
                <div className="stat-label">Security Improvement</div>
              </div>
            </div>

            <p className="disclaimer">
              Our platform aggregates data exclusively from government agencies and
              licensed financial data providers. All analysis is provided for educational
              and informational purposes only and should not be considered as investment
              advice. Past performance does not guarantee future results.
            </p>
          </div>
        </section>

        <section id="features" className="features">
          <div className="features-container">
            <h2 className="features-title">Platform Capabilities</h2>
            <div className="features-grid">
              <div className="feature-card">
                <div className="feature-icon">📊</div>
                <h3 className="feature-title">50+ Technical Indicators & Pattern Recognition</h3>
                <p className="feature-description">
                  Real-time RSI, MACD, Bollinger Bands, Moving Averages, and momentum signals.
                  Automatic trend detection and chart pattern recognition through
                  SimpleTechnicalTestService.
                </p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">🤖</div>
                <h3 className="feature-title">Options Sentiment & Put/Call Analysis</h3>
                <p className="feature-description">
                  Real-time put/call volume ratios and options sentiment scoring.
                  Market volatility analysis through VIX integration and options
                  chain intelligence from Polygon.io.
                </p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">⚖️</div>
                <h3 className="feature-title">Dual-Source Fundamental Ratios</h3>
                <p className="feature-description">
                  15 key financial ratios from FMP + EODHD dual-source system.
                  P/E, P/B, ROE, ROA, debt ratios, margins with automatic quality
                  scoring and validation for enhanced reliability.
                </p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">🎯</div>
                <h3 className="feature-title">Portfolio Optimization</h3>
                <p className="feature-description">
                  Modern Portfolio Theory implementation with risk-adjusted returns.
                  Automated rebalancing alerts and position sizing recommendations.
                </p>
              </div>
            </div>
          </div>
        </section>

        <footer className="footer">
          <p>© 2025 Veritak Financial Research LLC | Educational & Informational Use Only</p>
          <p>✨ Transparency First • 🔒 Government Data Sources • 📚 Educational Focus</p>
          <p style={{marginTop: '1rem', fontSize: '0.85rem', opacity: 0.8}}>
            Veritak Financial Research LLC provides analysis tools for educational purposes. All investment
            decisions should be made in consultation with qualified financial advisors. Past
            performance does not guarantee future results.
          </p>
        </footer>
      </div>

      {/* Logo Modal */}
      {showLogoModal && (
        <div 
          className="logo-modal-overlay"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999,
            cursor: 'pointer',
            backdropFilter: 'blur(5px)',
            animation: 'fadeIn 0.3s ease'
          }}
          onClick={() => setShowLogoModal(false)}
        >
          <div 
            className="logo-modal-content"
            style={{
              position: 'relative',
              maxWidth: '95vw',
              maxHeight: '95vh',
              animation: 'scaleIn 0.3s ease'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <img 
              src="/assets/images/veritak_logo_trans.png"
              alt="Veritak Financial Research LLC" 
              style={{
                width: '100%',
                height: 'auto',
                maxWidth: '800px',
                filter: 'drop-shadow(0 8px 24px rgba(0, 200, 83, 0.4))'
              }}
            />
            <button
              style={{
                position: 'absolute',
                top: '-40px',
                right: '0',
                backgroundColor: 'transparent',
                border: 'none',
                color: 'white',
                fontSize: '32px',
                cursor: 'pointer',
                padding: '8px',
                lineHeight: '1',
                fontWeight: '300',
                transition: 'transform 0.2s ease'
              }}
              onClick={() => setShowLogoModal(false)}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.2)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              ×
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes scaleIn {
          from {
            transform: scale(0.8);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }

        .live-dashboard {
          margin-top: 2rem;
          padding: 2rem;
          background: rgba(17, 24, 39, 0.3);
          border-radius: 20px;
          border: 1px solid rgba(99, 102, 241, 0.2);
          backdrop-filter: blur(10px);
        }

        .dashboard-header {
          text-align: center;
          margin-bottom: 2rem;
        }

        .dashboard-title {
          font-size: 2rem;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.95);
          text-shadow: 0 0 20px rgba(99, 102, 241, 0.4);
          margin-bottom: 0.5rem;
          background: linear-gradient(135deg, #6366f1, #8b5cf6, #06b6d4);
          background-clip: text;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .dashboard-subtitle {
          font-size: 1.1rem;
          color: rgba(156, 163, 175, 0.8);
          font-weight: 400;
        }

        .dashboard-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5rem;
          margin-bottom: 2rem;
        }

        .dashboard-card {
          min-height: 400px;
          animation: fadeInUp 0.6s ease forwards;
        }

        .dashboard-card.full-width {
          grid-column: 1 / -1;
          min-height: 500px;
        }

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

        @media (max-width: 768px) {
          .dashboard-grid {
            grid-template-columns: 1fr;
            gap: 1rem;
          }

          .dashboard-card.full-width {
            grid-column: 1;
          }

          .live-dashboard {
            padding: 1rem;
            margin-top: 1rem;
          }

          .dashboard-title {
            font-size: 1.5rem;
          }

          .dashboard-subtitle {
            font-size: 1rem;
          }
        }
      `}</style>
    </>
  )
}