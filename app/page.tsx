'use client'

import { useState } from 'react'
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
          right: '20px',
          zIndex: 1100,
          backgroundColor: 'transparent'
        }}
      >
        <div className="max-w-md mx-auto px-4">
          <SectorDropdown 
            onSectorChange={handleSectorChange}
            loading={loading}
            currentSector={currentSector}
          />
        </div>
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
              <a href="#features" className="cta-button">
                <span>🚀</span>
                Explore Platform
              </a>
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

        <section className="trust-section">
          <div className="trust-container">
            <h2 className="trust-title">Trusted Data Sources</h2>
            <div className="data-sources">
              <div className="source-badge">🏛️ SEC EDGAR</div>
              <div className="source-badge">🏦 Federal Reserve</div>
              <div className="source-badge">📈 Alpha Vantage</div>
              <div className="source-badge">📊 IEX Cloud</div>
              <div className="source-badge">📰 News APIs</div>
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