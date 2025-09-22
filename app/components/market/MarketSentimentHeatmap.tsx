'use client'

import { useState, useEffect } from 'react'

interface SentimentData {
  overallSentiment: number
  marketCondition: string
  riskLevel: string
  timestamp: string
  indicators: {
    vix: { value: number; sentiment: number; trend: string }
    spy: { value: number; sentiment: number; trend: string }
    market: { sentiment: number; condition: string }
  }
}

interface MarketSentimentHeatmapProps {
  className?: string
}

export default function MarketSentimentHeatmap({ className = '' }: MarketSentimentHeatmapProps) {
  const [sentimentData, setSentimentData] = useState<SentimentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchSentimentData()
    const interval = setInterval(fetchSentimentData, 60000) // Update every minute

    return () => clearInterval(interval)
  }, [])

  const fetchSentimentData = async () => {
    try {
      const response = await fetch('/api/market/sentiment')
      if (!response.ok) throw new Error('Failed to fetch sentiment data')

      const data = await response.json()
      setSentimentData(data)
      setError(null)
    } catch (err) {
      console.error('Error fetching sentiment data:', err)
      setSentimentData(null)
      setError('Unable to load market sentiment - API unavailable')
    } finally {
      setLoading(false)
    }
  }

  const getSentimentColor = (sentiment: number): string => {
    if (sentiment >= 70) return '#10b981' // Strong positive (green)
    if (sentiment >= 50) return '#22c55e' // Positive (light green)
    if (sentiment >= 30) return '#f59e0b' // Neutral (amber)
    if (sentiment >= 10) return '#ef4444' // Negative (red)
    return '#dc2626' // Strong negative (dark red)
  }

  const getSentimentLabel = (sentiment: number): string => {
    if (sentiment >= 70) return 'Bullish'
    if (sentiment >= 50) return 'Positive'
    if (sentiment >= 30) return 'Neutral'
    if (sentiment >= 10) return 'Bearish'
    return 'Very Bearish'
  }

  if (loading) {
    return (
      <div className={`sentiment-heatmap ${className}`}>
        <div className="heatmap-header">
          <h3 className="heatmap-title">Market Sentiment</h3>
        </div>
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <div className="loading-text">Analyzing Market Sentiment...</div>
        </div>

        <style jsx>{`
          .sentiment-heatmap {
            background: rgba(17, 24, 39, 0.85);
            backdrop-filter: blur(15px);
            border-radius: 16px;
            border: 1px solid rgba(99, 102, 241, 0.3);
            padding: 1.5rem;
            color: rgba(255, 255, 255, 0.9);
            min-height: 300px;
          }

          .heatmap-header {
            margin-bottom: 1.5rem;
            text-align: center;
          }

          .heatmap-title {
            font-size: 1.25rem;
            font-weight: 600;
            color: rgba(255, 255, 255, 0.95);
            text-shadow: 0 0 10px rgba(99, 102, 241, 0.3);
          }

          .loading-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 200px;
            gap: 1rem;
          }

          .loading-spinner {
            width: 40px;
            height: 40px;
            border: 3px solid rgba(99, 102, 241, 0.3);
            border-top: 3px solid rgba(99, 102, 241, 0.8);
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }

          .loading-text {
            color: rgba(99, 102, 241, 0.9);
            font-size: 14px;
          }

          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    )
  }

  if (error || !sentimentData) {
    return (
      <div className={`sentiment-heatmap ${className}`}>
        <div className="heatmap-header">
          <h3 className="heatmap-title">Market Sentiment</h3>
        </div>
        <div className="error-container">
          <div className="error-icon">⚠️</div>
          <div className="error-text">{error || 'No sentiment data available'}</div>
        </div>

        <style jsx>{`
          .sentiment-heatmap {
            background: rgba(17, 24, 39, 0.85);
            backdrop-filter: blur(15px);
            border-radius: 16px;
            border: 1px solid rgba(99, 102, 241, 0.3);
            padding: 1.5rem;
            color: rgba(255, 255, 255, 0.9);
            min-height: 300px;
          }

          .heatmap-header {
            margin-bottom: 1.5rem;
            text-align: center;
          }

          .heatmap-title {
            font-size: 1.25rem;
            font-weight: 600;
            color: rgba(255, 255, 255, 0.95);
            text-shadow: 0 0 10px rgba(99, 102, 241, 0.3);
          }

          .error-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 200px;
            gap: 1rem;
          }

          .error-icon {
            font-size: 3rem;
          }

          .error-text {
            color: rgba(239, 68, 68, 0.9);
            font-size: 14px;
            text-align: center;
          }
        `}</style>
      </div>
    )
  }

  return (
    <div className={`sentiment-heatmap ${className}`}>
      <div className="heatmap-header">
        <h3 className="heatmap-title">Market Sentiment</h3>
        <div className="heatmap-subtitle">Real-time market sentiment analysis</div>
      </div>

      <div className="sentiment-overview">
        <div className="overall-sentiment">
          <div
            className="sentiment-circle"
            style={{
              background: `conic-gradient(${getSentimentColor(sentimentData.overallSentiment)} ${sentimentData.overallSentiment}%, rgba(75, 85, 99, 0.3) ${sentimentData.overallSentiment}%)`
            }}
          >
            <div className="sentiment-value">{sentimentData.overallSentiment}%</div>
          </div>
          <div className="sentiment-label">{getSentimentLabel(sentimentData.overallSentiment)}</div>
        </div>

        <div className="market-condition">
          <div className="condition-label">Market Condition</div>
          <div className="condition-value">{sentimentData.marketCondition}</div>
          <div className="risk-level">Risk Level: {sentimentData.riskLevel}</div>
        </div>
      </div>

      <div className="indicators-grid">
        <div className="indicator-card">
          <div className="indicator-header">
            <span className="indicator-icon">📈</span>
            <span className="indicator-name">VIX</span>
          </div>
          <div className="indicator-value">{sentimentData.indicators.vix.value.toFixed(2)}</div>
          <div
            className="indicator-bar"
            style={{
              background: `linear-gradient(90deg, ${getSentimentColor(sentimentData.indicators.vix.sentiment)} ${sentimentData.indicators.vix.sentiment}%, rgba(75, 85, 99, 0.3) ${sentimentData.indicators.vix.sentiment}%)`
            }}
          ></div>
          <div className="indicator-trend">{sentimentData.indicators.vix.trend}</div>
        </div>

        <div className="indicator-card">
          <div className="indicator-header">
            <span className="indicator-icon">📊</span>
            <span className="indicator-name">SPY</span>
          </div>
          <div className="indicator-value">${sentimentData.indicators.spy.value.toFixed(2)}</div>
          <div
            className="indicator-bar"
            style={{
              background: `linear-gradient(90deg, ${getSentimentColor(sentimentData.indicators.spy.sentiment)} ${sentimentData.indicators.spy.sentiment}%, rgba(75, 85, 99, 0.3) ${sentimentData.indicators.spy.sentiment}%)`
            }}
          ></div>
          <div className="indicator-trend">{sentimentData.indicators.spy.trend}</div>
        </div>
      </div>

      <style jsx>{`
        .sentiment-heatmap {
          background: rgba(17, 24, 39, 0.85);
          backdrop-filter: blur(15px);
          border-radius: 16px;
          border: 1px solid rgba(99, 102, 241, 0.3);
          padding: 1.5rem;
          color: rgba(255, 255, 255, 0.9);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }

        .heatmap-header {
          text-align: center;
          margin-bottom: 1.5rem;
        }

        .heatmap-title {
          font-size: 1.25rem;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.95);
          text-shadow: 0 0 10px rgba(99, 102, 241, 0.3);
          margin-bottom: 0.25rem;
        }

        .heatmap-subtitle {
          font-size: 0.8rem;
          color: rgba(156, 163, 175, 0.8);
        }

        .sentiment-overview {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1.5rem;
          gap: 1.5rem;
        }

        .overall-sentiment {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
        }

        .sentiment-circle {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }

        .sentiment-circle::before {
          content: '';
          position: absolute;
          inset: 6px;
          border-radius: 50%;
          background: rgba(17, 24, 39, 0.9);
        }

        .sentiment-value {
          position: relative;
          z-index: 1;
          font-size: 1rem;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.95);
        }

        .sentiment-label {
          font-size: 0.9rem;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.9);
        }

        .market-condition {
          flex: 1;
          text-align: right;
        }

        .condition-label {
          font-size: 0.75rem;
          color: rgba(156, 163, 175, 0.7);
          margin-bottom: 0.25rem;
        }

        .condition-value {
          font-size: 1.1rem;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.95);
          margin-bottom: 0.25rem;
        }

        .risk-level {
          font-size: 0.8rem;
          color: rgba(156, 163, 175, 0.8);
        }

        .indicators-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }

        .indicator-card {
          background: rgba(31, 41, 55, 0.6);
          border-radius: 8px;
          padding: 1rem;
          border: 1px solid rgba(99, 102, 241, 0.2);
        }

        .indicator-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.5rem;
        }

        .indicator-icon {
          font-size: 1rem;
        }

        .indicator-name {
          font-size: 0.9rem;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.9);
        }

        .indicator-value {
          font-size: 1.2rem;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.95);
          margin-bottom: 0.5rem;
        }

        .indicator-bar {
          height: 4px;
          border-radius: 2px;
          margin-bottom: 0.5rem;
        }

        .indicator-trend {
          font-size: 0.75rem;
          color: rgba(156, 163, 175, 0.8);
        }

        @media (max-width: 640px) {
          .sentiment-overview {
            flex-direction: column;
            text-align: center;
          }

          .market-condition {
            text-align: center;
          }

          .indicators-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}