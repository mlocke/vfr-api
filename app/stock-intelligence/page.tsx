'use client'

import Link from 'next/link'

export default function StockIntelligencePage() {
  return (
    <>
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
              <div className="logo-text prominent-logo-text">Market Intelligence</div>
              <div className="company-tagline">Select. Analyze. Decide.</div>
            </div>
          </div>
          <p className="tagline">Advanced Financial Analysis & Real-time Market Intelligence</p>
        </header>

        <main className="hero">
          <div className="hero-content">
            <div className="hero-text">
              <h1 className="hero-title">Coming Soon</h1>
              <p className="hero-subtitle">
                Our advanced Market Intelligence platform is currently under development.
                This powerful tool will provide real-time market analysis, AI-powered stock
                selection, and comprehensive financial research capabilities powered by our
                proprietary MCP-native infrastructure.
              </p>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.75rem',
                background: 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: 'rgba(255, 255, 255, 0.9)',
                padding: '1rem 2rem',
                borderRadius: '50px',
                fontSize: '1.1rem',
                fontWeight: '600',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
              }}>
                <span>🚧</span>
                In Development
              </div>
            </div>
            <div className="dashboard-preview">
              <div className="dashboard-mockup">
                <div className="mockup-header">
                  <div className="mockup-dots">
                    <div className="dot"></div>
                    <div className="dot"></div>
                    <div className="dot"></div>
                  </div>
                  <div className="mockup-title">Market Intelligence Preview</div>
                </div>
                <div className="chart-container">
                  <div className="chart-line"></div>
                </div>
                <div className="metrics-grid">
                  <div className="metric-card">
                    <div className="metric-value">Real-time</div>
                    <div className="metric-label">Data Analysis</div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-value">AI-Powered</div>
                    <div className="metric-label">Stock Selection</div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-value">MCP-Native</div>
                    <div className="metric-label">Infrastructure</div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-value">Advanced</div>
                    <div className="metric-label">Analytics</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>

        <section className="trust-section">
          <div className="trust-container">
            <h2 className="trust-title">Upcoming Features</h2>
            <div className="data-sources">
              <div className="source-badge">🤖 AI Stock Selection</div>
              <div className="source-badge">📊 Real-time Analytics</div>
              <div className="source-badge">🔍 Market Intelligence</div>
              <div className="source-badge">⚡ Instant Insights</div>
              <div className="source-badge">🎯 Portfolio Analysis</div>
            </div>
            <p className="disclaimer">
              Our Market Intelligence platform will provide comprehensive market analysis
              and stock selection tools for educational and informational purposes only.
              All analysis will be provided for educational purposes and should not be
              considered as investment advice.
            </p>
          </div>
        </section>

        <section id="features" className="features">
          <div className="features-container">
            <h2 className="features-title">Platform Preview</h2>
            <div className="features-grid">
              <div className="feature-card">
                <div className="feature-icon">🧠</div>
                <h3 className="feature-title">AI-Powered Analysis</h3>
                <p className="feature-description">
                  Advanced machine learning algorithms will analyze market trends,
                  sentiment data, and technical indicators to provide intelligent
                  stock recommendations and market insights.
                </p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">⚡</div>
                <h3 className="feature-title">Real-time Processing</h3>
                <p className="feature-description">
                  Lightning-fast data processing with sub-100ms response times
                  for real-time market analysis and instant investment insights
                  powered by our MCP infrastructure.
                </p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">📈</div>
                <h3 className="feature-title">Comprehensive Analytics</h3>
                <p className="feature-description">
                  Multi-factor analysis combining technical indicators, fundamental
                  data, sentiment analysis, and market trends for complete
                  investment research and decision support.
                </p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">🎯</div>
                <h3 className="feature-title">Smart Selection</h3>
                <p className="feature-description">
                  Intelligent stock selection algorithms that analyze multiple
                  data sources and market factors to identify potential
                  investment opportunities across various sectors.
                </p>
              </div>
            </div>
          </div>
        </section>

        <footer className="footer">
          <p>© 2025 Veritak Financial Research LLC | Educational & Informational Use Only</p>
          <p>✨ Transparency First • 🔒 Government Data Sources • 📚 Educational Focus</p>
          <p style={{marginTop: '1rem', fontSize: '0.85rem', opacity: 0.8}}>
            Market Intelligence platform is currently in development. All analysis tools
            will be provided for educational purposes only and should not be considered as investment advice.
          </p>
        </footer>
      </div>
    </>
  )
}