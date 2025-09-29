'use client'

import { useState, useEffect } from 'react'
import { MarketSentimentData, SectorSentiment } from '../../services/financial-data/MarketSentimentService'
import MarketExplanationModal from './MarketExplanationModal'

interface MarketSentimentHeatmapProps {
  className?: string
}

export default function MarketSentimentHeatmap({ className = '' }: MarketSentimentHeatmapProps) {
  const [sentimentData, setSentimentData] = useState<MarketSentimentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showExplanationModal, setShowExplanationModal] = useState(false)

  useEffect(() => {
    fetchSentimentData()
    const interval = setInterval(fetchSentimentData, 3600000) // Update every hour (was 60000)

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
      setError('Unable to load market sentiment')
    } finally {
      setLoading(false)
    }
  }

  const getSentimentColor = (value: number, isBackground = false): string => {
    const intensity = isBackground ? 0.1 : 1

    if (value <= 20) return `rgba(239, 68, 68, ${intensity})` // Red - Extreme Fear
    if (value <= 40) return `rgba(251, 146, 60, ${intensity})` // Orange - Fear
    if (value <= 60) return `rgba(156, 163, 175, ${intensity})` // Gray - Neutral
    if (value <= 80) return `rgba(34, 197, 94, ${intensity})` // Green - Greed
    return `rgba(16, 185, 129, ${intensity})` // Emerald - Extreme Greed
  }

  const getSentimentGlow = (value: number): string => {
    if (value <= 20) return '0 0 20px rgba(239, 68, 68, 0.5)'
    if (value <= 40) return '0 0 20px rgba(251, 146, 60, 0.5)'
    if (value <= 60) return '0 0 20px rgba(156, 163, 175, 0.5)'
    if (value <= 80) return '0 0 20px rgba(34, 197, 94, 0.5)'
    return '0 0 20px rgba(16, 185, 129, 0.5)'
  }

  const formatValue = (value: number | undefined): string => {
    if (value === undefined) return '--'
    return value.toFixed(1)
  }

  const formatPercentage = (value: number | undefined): string => {
    if (value === undefined) return '--'
    // Only show "Limited Data" for truly missing data, not 0% performance
    const sign = value > 0 ? '+' : ''
    return `${sign}${value.toFixed(2)}%`
  }

  const isLimitedData = (sector: SectorSentiment): boolean => {
    return sector.performance.day === 0 && sector.sentiment.confidence <= 0.1
  }

  const getCardOpacity = (sector: SectorSentiment): number => {
    return isLimitedData(sector) ? 0.7 : 1.0
  }

  if (loading) {
    return (
      <div className={`market-sentiment-heatmap ${className}`}>
        <div className="loading-container">
          <div className="cyber-loading">
            <div className="loading-text">Loading Market Sentiment...</div>
            <div className="loading-bar">
              <div className="loading-progress"></div>
            </div>
          </div>
        </div>

        <style jsx>{`
          .market-sentiment-heatmap {
            background: rgba(17, 24, 39, 0.8);
            backdrop-filter: blur(10px);
            border-radius: 12px;
            border: 1px solid rgba(99, 102, 241, 0.3);
            padding: 1.5rem;
            height: 400px;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .loading-container {
            text-align: center;
          }

          .cyber-loading {
            color: rgba(99, 102, 241, 0.9);
          }

          .loading-text {
            font-size: 14px;
            margin-bottom: 1rem;
            animation: pulse 2s infinite;
          }

          .loading-bar {
            width: 200px;
            height: 4px;
            background: rgba(99, 102, 241, 0.2);
            border-radius: 2px;
            overflow: hidden;
          }

          .loading-progress {
            height: 100%;
            background: linear-gradient(90deg,
              transparent,
              rgba(99, 102, 241, 0.8),
              transparent
            );
            animation: loading-sweep 2s infinite;
          }

          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }

          @keyframes loading-sweep {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(200px); }
          }
        `}</style>
      </div>
    )
  }

  if (error || !sentimentData) {
    return (
      <div className={`market-sentiment-heatmap ${className}`}>
        <div className="error-container">
          <div className="error-icon">⚠️</div>
          <div className="error-text">{error || 'No sentiment data available'}</div>
          <button
            onClick={fetchSentimentData}
            className="retry-button"
          >
            Retry
          </button>
        </div>

        <style jsx>{`
          .market-sentiment-heatmap {
            background: rgba(17, 24, 39, 0.8);
            backdrop-filter: blur(10px);
            border-radius: 12px;
            border: 1px solid rgba(239, 68, 68, 0.3);
            padding: 1.5rem;
            height: 400px;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .error-container {
            text-align: center;
            color: rgba(239, 68, 68, 0.9);
          }

          .error-icon {
            font-size: 2rem;
            margin-bottom: 0.5rem;
          }

          .error-text {
            font-size: 14px;
            margin-bottom: 1rem;
          }

          .retry-button {
            background: rgba(239, 68, 68, 0.2);
            border: 1px solid rgba(239, 68, 68, 0.4);
            color: rgba(239, 68, 68, 0.9);
            padding: 0.5rem 1rem;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s;
          }

          .retry-button:hover {
            background: rgba(239, 68, 68, 0.3);
            box-shadow: 0 0 10px rgba(239, 68, 68, 0.3);
          }
        `}</style>
      </div>
    )
  }

  return (
    <div className={`market-sentiment-heatmap ${className}`}>
      <div className="heatmap-header">
        <h3 className="heatmap-title">Live Market Sentiment</h3>
        <div className="sentiment-overview">
          <div
            className="overall-sentiment"
            style={{
              color: getSentimentColor(sentimentData.overall.value),
              textShadow: getSentimentGlow(sentimentData.overall.value)
            }}
          >
            {sentimentData.overall.value}
            <span className="sentiment-label">{sentimentData.overall.level.replace('-', ' ').toUpperCase()}</span>
          </div>
          <button
            className="explain-button"
            onClick={() => setShowExplanationModal(true)}
            title="Get plain-language explanation of current market conditions"
          >
            📊 Explain This
          </button>
        </div>
      </div>

      <div className="heatmap-grid">
        {/* VIX Fear Gauge */}
        <div
          className="sentiment-card vix-card"
          style={{
            background: getSentimentColor(100 - sentimentData.overall.value, true),
            borderColor: getSentimentColor(100 - sentimentData.overall.value),
            boxShadow: getSentimentGlow(100 - sentimentData.overall.value)
          }}
        >
          <div className="card-header">
            <span className="card-icon">📊</span>
            <span className="card-title">VIX</span>
          </div>
          <div className="card-value">{formatValue(sentimentData.vixLevel.current)}</div>
          <div className="card-subtitle">{sentimentData.vixLevel.interpretation}</div>
        </div>

        {/* Sector Sentiments */}
        {sentimentData.sectors.map((sector) => (
          <div
            key={sector.symbol}
            className={`sentiment-card sector-card ${isLimitedData(sector) ? 'limited-data' : ''}`}
            style={{
              background: getSentimentColor(sector.sentiment.value, true),
              borderColor: getSentimentColor(sector.sentiment.value),
              boxShadow: getSentimentGlow(sector.sentiment.value),
              opacity: getCardOpacity(sector)
            }}
            title={isLimitedData(sector) ? 'Limited data available due to API rate limits' : `${sector.name} sector sentiment`}
          >
            <div className="card-header">
              <span className="card-icon">
                {sector.symbol === 'XLK' ? '💻' :
                 sector.symbol === 'XLF' ? '🏦' :
                 sector.symbol === 'XLE' ? '⚡' :
                 sector.symbol === 'XLV' ? '🏥' : '🏭'}
              </span>
              <span className="card-title">{sector.symbol}</span>
              {isLimitedData(sector) && <span className="limited-indicator">⚠️</span>}
            </div>
            <div className="card-value">{formatPercentage(sector.performance.day)}</div>
            <div className="card-subtitle">{sector.name}</div>
          </div>
        ))}

        {/* Economic Indicators */}
        <div
          className="sentiment-card economic-card"
          style={{
            background: getSentimentColor(sentimentData.economicIndicators.yieldCurve.value, true),
            borderColor: getSentimentColor(sentimentData.economicIndicators.yieldCurve.value),
            boxShadow: getSentimentGlow(sentimentData.economicIndicators.yieldCurve.value)
          }}
        >
          <div className="card-header">
            <span className="card-icon">📈</span>
            <span className="card-title">YIELD</span>
          </div>
          <div className="card-value">
            {sentimentData.economicIndicators.yieldCurve.spread10Y2Y !== undefined
              ? formatPercentage(sentimentData.economicIndicators.yieldCurve.spread10Y2Y)
              : sentimentData.economicIndicators.yieldCurve.level.toUpperCase()
            }
          </div>
          <div className="card-subtitle">10Y-2Y Spread</div>
        </div>

        {/* Social Sentiment */}
        <div
          className="sentiment-card social-card"
          style={{
            background: getSentimentColor(sentimentData.overall.value, true),
            borderColor: getSentimentColor(sentimentData.overall.value),
            boxShadow: getSentimentGlow(sentimentData.overall.value)
          }}
        >
          <div className="card-header">
            <span className="card-icon">🌐</span>
            <span className="card-title">SOCIAL</span>
          </div>
          <div className="card-value">
            {sentimentData.socialSentiment.overallValue !== undefined
              ? `${sentimentData.socialSentiment.overallValue}%`
              : sentimentData.socialSentiment.sentiment.toUpperCase()
            }
          </div>
          <div className="card-subtitle">
            Trending: {sentimentData.socialSentiment.trending.join(', ')}
          </div>
        </div>
      </div>

      <div className="heatmap-footer">
        <div className="data-quality">
          Quality: {Math.round(sentimentData.dataQuality * 100)}%
          {sentimentData.dataQuality < 0.5 && <span className="quality-warning"> (Limited due to API constraints)</span>}
        </div>
        <div className="last-update">
          Updated: {new Date(sentimentData.lastUpdate).toLocaleTimeString()}
        </div>
      </div>

      {/* Market Explanation Modal */}
      <MarketExplanationModal
        isOpen={showExplanationModal}
        onClose={() => setShowExplanationModal(false)}
      />

      <style jsx>{`
        .market-sentiment-heatmap {
          background: rgba(17, 24, 39, 0.85);
          backdrop-filter: blur(15px);
          border-radius: 16px;
          border: 1px solid rgba(99, 102, 241, 0.3);
          padding: 1.5rem;
          color: rgba(255, 255, 255, 0.9);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }

        .heatmap-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid rgba(99, 102, 241, 0.2);
        }

        .heatmap-title {
          font-size: 1.25rem;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.95);
          text-shadow: 0 0 10px rgba(99, 102, 241, 0.3);
        }

        .sentiment-overview {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 0.75rem;
        }

        .overall-sentiment {
          font-size: 2rem;
          font-weight: 700;
          line-height: 1;
          animation: pulse-glow 3s infinite;
        }

        .sentiment-label {
          display: block;
          font-size: 0.75rem;
          font-weight: 500;
          opacity: 0.8;
          margin-top: 0.25rem;
        }

        .heatmap-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .sentiment-card {
          padding: 1rem;
          border-radius: 10px;
          border: 1px solid;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
          position: relative;
          overflow: hidden;
        }

        .sentiment-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.1),
            transparent
          );
          transition: left 0.5s;
        }

        .sentiment-card:hover::before {
          left: 100%;
        }

        .sentiment-card:hover {
          transform: translateY(-2px) scale(1.02);
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
        }

        .sentiment-card.limited-data {
          border-style: dashed;
          position: relative;
        }

        .sentiment-card.limited-data::after {
          content: '';
          position: absolute;
          top: 2px;
          right: 2px;
          width: 8px;
          height: 8px;
          background: rgba(251, 146, 60, 0.8);
          border-radius: 50%;
          animation: pulse-warning 2s infinite;
        }

        @keyframes pulse-warning {
          0%, 100% {
            opacity: 0.8;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.2);
          }
        }

        .card-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.75rem;
        }

        .card-icon {
          font-size: 1.2rem;
        }

        .card-title {
          font-size: 0.8rem;
          font-weight: 600;
          opacity: 0.9;
        }

        .limited-indicator {
          font-size: 0.6rem;
          opacity: 0.8;
          margin-left: auto;
        }

        .card-value {
          font-size: 1.5rem;
          font-weight: 700;
          line-height: 1;
          margin-bottom: 0.25rem;
        }

        .card-subtitle {
          font-size: 0.7rem;
          opacity: 0.7;
          line-height: 1.2;
        }

        .heatmap-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.75rem;
          opacity: 0.6;
          padding-top: 1rem;
          border-top: 1px solid rgba(99, 102, 241, 0.2);
        }

        .data-quality {
          color: rgba(34, 197, 94, 0.8);
        }

        .quality-warning {
          color: rgba(251, 146, 60, 0.9);
          font-size: 0.7rem;
        }

        .last-update {
          color: rgba(156, 163, 175, 0.8);
        }

        .explain-button {
          background: rgba(99, 102, 241, 0.15);
          border: 1px solid rgba(99, 102, 241, 0.4);
          color: rgba(99, 102, 241, 0.95);
          padding: 0.5rem 1rem;
          border-radius: 8px;
          font-size: 0.85rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          backdrop-filter: blur(10px);
          display: flex;
          align-items: center;
          gap: 0.25rem;
          white-space: nowrap;
          box-shadow: 0 2px 8px rgba(99, 102, 241, 0.1);
        }

        .explain-button:hover {
          background: rgba(99, 102, 241, 0.25);
          border-color: rgba(99, 102, 241, 0.6);
          color: rgba(255, 255, 255, 0.95);
          transform: translateY(-1px);
          box-shadow:
            0 4px 12px rgba(99, 102, 241, 0.2),
            0 0 20px rgba(99, 102, 241, 0.15);
        }

        .explain-button:active {
          transform: translateY(0);
          box-shadow: 0 2px 8px rgba(99, 102, 241, 0.15);
        }

        @keyframes pulse-glow {
          0%, 100% {
            text-shadow: 0 0 10px currentColor;
          }
          50% {
            text-shadow: 0 0 20px currentColor, 0 0 30px currentColor;
          }
        }

        @media (max-width: 640px) {
          .heatmap-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .heatmap-header {
            flex-direction: column;
            gap: 1rem;
            text-align: center;
          }

          .sentiment-overview {
            align-items: center;
          }

          .explain-button {
            font-size: 0.8rem;
            padding: 0.4rem 0.8rem;
          }
        }
      `}</style>
    </div>
  )
}