'use client'

import { useState } from 'react'
import Link from 'next/link'
import StockTicker from './components/StockTicker'
import SectorDropdown, { SectorOption } from './components/SectorDropdown'

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
            <span className="hidden sm:inline">&nbsp;Deep Analysis</span>
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
            <span className="hidden sm:inline">Admin</span>
            <span className="sm:hidden">Admin</span>
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
                Deep Analysis
              </Link>
            </div>
            <div className="dashboard-preview">
              <div className="dashboard-mockup">
                <div className="mockup-header">
                  <div className="mockup-dots">
                    <div className="dot"></div>
                    <div className="dot"></div>
                    <div className="dot"></div>
                  </div>
                  <div className="mockup-title">Live Market Dashboard</div>
                </div>
                <div className="chart-container">
                  <div className="chart-line"></div>
                </div>
                <div className="metrics-grid">
                  <div className="metric-card">
                    <div className="metric-value">+12.4%</div>
                    <div className="metric-label">Portfolio Growth</div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-value">89.2%</div>
                    <div className="metric-label">Prediction Accuracy</div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-value">$2.4M</div>
                    <div className="metric-label">Assets Analyzed</div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-value">Real-time</div>
                    <div className="metric-label">Data Feed</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>

        <section className="data-engines-section">
          <div className="data-engines-container">
            <div className="data-engines-header">
              <h2 className="data-engines-title">Powered by 12 Premium Data Engines</h2>
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
                      <h4 className="source-name">Polygon.io MCP</h4>
                      <p className="source-desc">Real-time market data</p>
                    </div>
                    <div className="source-status live"></div>
                  </div>
                  <div className="data-source-card premium">
                    <div className="source-icon">🤖</div>
                    <div className="source-info">
                      <h4 className="source-name">Alpha Vantage MCP</h4>
                      <p className="source-desc">AI-optimized intelligence</p>
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
                      <h4 className="source-name">Yahoo Finance MCP</h4>
                      <p className="source-desc">Comprehensive stock analysis</p>
                    </div>
                    <div className="source-status live"></div>
                  </div>
                  <div className="data-source-card government">
                    <div className="source-icon">🏛️</div>
                    <div className="source-info">
                      <h4 className="source-name">SEC EDGAR MCP</h4>
                      <p className="source-desc">SEC filings & insider trading</p>
                    </div>
                    <div className="source-status live"></div>
                  </div>
                  <div className="data-source-card government">
                    <div className="source-icon">🏦</div>
                    <div className="source-info">
                      <h4 className="source-name">Treasury MCP</h4>
                      <p className="source-desc">Treasury yields & federal debt</p>
                    </div>
                    <div className="source-status live"></div>
                  </div>
                  <div className="data-source-card government">
                    <div className="source-icon">📊</div>
                    <div className="source-info">
                      <h4 className="source-name">Data.gov MCP</h4>
                      <p className="source-desc">Government financial datasets</p>
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
                  <span className="category-count">3 Sources</span>
                </div>
                <div className="data-sources-grid">
                  <div className="data-source-card government">
                    <div className="source-icon">🏦</div>
                    <div className="source-info">
                      <h4 className="source-name">FRED MCP</h4>
                      <p className="source-desc">Federal Reserve (800K+ series)</p>
                    </div>
                    <div className="source-status live"></div>
                  </div>
                  <div className="data-source-card government">
                    <div className="source-icon">👥</div>
                    <div className="source-info">
                      <h4 className="source-name">BLS MCP</h4>
                      <p className="source-desc">Employment & inflation data</p>
                    </div>
                    <div className="source-status live"></div>
                  </div>
                  <div className="data-source-card government">
                    <div className="source-icon">⚡</div>
                    <div className="source-info">
                      <h4 className="source-name">EIA MCP</h4>
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
                  <h3 className="category-title">Intelligence & Web Data</h3>
                  <span className="category-count">2 Sources</span>
                </div>
                <div className="data-sources-grid">
                  <div className="data-source-card premium">
                    <div className="source-icon">🕷️</div>
                    <div className="source-info">
                      <h4 className="source-name">Firecrawl MCP</h4>
                      <p className="source-desc">Web scraping & sentiment</p>
                    </div>
                    <div className="source-status live"></div>
                  </div>
                  <div className="data-source-card premium">
                    <div className="source-icon">🌐</div>
                    <div className="source-info">
                      <h4 className="source-name">Dappier MCP</h4>
                      <p className="source-desc">Real-time web intelligence</p>
                    </div>
                    <div className="source-status live"></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="data-engines-stats">
              <div className="stat-item">
                <div className="stat-number">12</div>
                <div className="stat-label">Data Sources</div>
              </div>
              <div className="stat-item">
                <div className="stat-number">800K+</div>
                <div className="stat-label">Data Series</div>
              </div>
              <div className="stat-item">
                <div className="stat-number">Real-time</div>
                <div className="stat-label">Updates</div>
              </div>
              <div className="stat-item">
                <div className="stat-number">99.9%</div>
                <div className="stat-label">Uptime</div>
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
                <h3 className="feature-title">Technical Analysis</h3>
                <p className="feature-description">
                  Advanced charting with 20+ technical indicators including Moving
                  Averages, RSI, MACD, and Bollinger Bands. Real-time pattern
                  recognition and signal detection.
                </p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">🤖</div>
                <h3 className="feature-title">AI-Powered Analysis</h3>
                <p className="feature-description">
                  LSTM neural networks and ensemble methods provide price predictions
                  with confidence intervals. Sentiment analysis from news and social
                  media feeds.
                </p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">⚖️</div>
                <h3 className="feature-title">Fundamental Analysis</h3>
                <p className="feature-description">
                  Deep-dive into financial statements, ratios, and peer comparisons.
                  Automated screening based on value, growth, and quality metrics.
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
      `}</style>
    </>
  )
}