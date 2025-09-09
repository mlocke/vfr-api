'use client'

import StockTicker from './components/StockTicker'

export default function Home() {
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

      {/* Stock Ticker Component */}
      <StockTicker />

      <div className="main-container">
        <header className="header">
          <div className="logo">
            <div className="logo-icon">📈</div>
            <div className="logo-text">Stock Picker</div>
          </div>
          <p className="tagline">Advanced Financial Analysis & Stock Prediction Platform</p>
        </header>

        <main className="hero">
          <div className="hero-content">
            <div className="hero-text">
              <h1 className="hero-title">Intelligent Market Analysis</h1>
              <p className="hero-subtitle">
                Harness the power of real-time data, advanced analytics, and machine
                learning to make informed investment decisions. Our platform aggregates
                data from government sources and market APIs to deliver comprehensive
                financial insights.
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
          <p>© 2025 Stock Picker Platform | Educational & Informational Use Only</p>
          <p>✨ Transparency First • 🔒 Government Data Sources • 📚 Educational Focus</p>
          <p style={{marginTop: '1rem', fontSize: '0.85rem', opacity: 0.8}}>
            This platform provides analysis tools for educational purposes. All investment
            decisions should be made in consultation with qualified financial advisors. Past
            performance does not guarantee future results.
          </p>
        </footer>
      </div>
    </>
  )
}