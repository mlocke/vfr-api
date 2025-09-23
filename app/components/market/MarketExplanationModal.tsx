'use client'

import { useState, useEffect } from 'react'
import { MarketSentimentData } from '../../services/financial-data/MarketSentimentService'

interface MarketExplanationModalProps {
  isOpen: boolean
  onClose: () => void
}

interface MarketExplanation {
  summary: string
  details: {
    overallCondition: string
    vixExplanation: string
    sectorHighlights: string
    economicFactors: string
    recommendation: string
  }
  keyMetrics: {
    vix: { value: number; meaning: string }
    sentiment: { value: number; meaning: string }
    topSectors: Array<{ name: string; performance: string; meaning: string }>
    yieldSpread: { value: string; meaning: string }
  }
}

export default function MarketExplanationModal({ isOpen, onClose }: MarketExplanationModalProps) {
  const [explanation, setExplanation] = useState<MarketExplanation | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      generateExplanation()
    }
  }, [isOpen])

  // Add ESC key support and prevent body scroll
  useEffect(() => {
    if (isOpen) {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose()
        }
      }

      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'

      return () => {
        document.removeEventListener('keydown', handleEscape)
        document.body.style.overflow = 'unset'
      }
    }
  }, [isOpen, onClose])

  const generateExplanation = async () => {
    setLoading(true)
    setError(null)

    try {
      // First get the current sentiment data
      const sentimentResponse = await fetch('/api/market/sentiment')
      if (!sentimentResponse.ok) throw new Error('Failed to fetch sentiment data')

      const sentimentData: MarketSentimentData = await sentimentResponse.json()

      // Generate plain-language explanation
      const explanation = await createPlainLanguageExplanation(sentimentData)
      setExplanation(explanation)
    } catch (err) {
      console.error('Error generating market explanation:', err)
      setError('Unable to generate market explanation. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const createPlainLanguageExplanation = async (data: MarketSentimentData): Promise<MarketExplanation> => {
    // Generate human-readable explanation from market data
    const vixValue = data.vixLevel.current
    const sentimentValue = data.overall.value
    const sentimentLevel = data.overall.level

    // Overall market condition
    const getOverallCondition = (): string => {
      if (sentimentValue <= 20) return "Markets are in extreme fear territory - investors are very worried about potential losses."
      if (sentimentValue <= 40) return "Markets show signs of fear - there's noticeable concern among investors."
      if (sentimentValue <= 60) return "Markets are in neutral territory - sentiment is balanced between optimism and caution."
      if (sentimentValue <= 80) return "Markets show greed - investors are optimistic and taking on more risk."
      return "Markets are in extreme greed territory - investors may be overly confident, potentially ignoring risks."
    }

    // VIX explanation
    const getVixExplanation = (): string => {
      if (vixValue >= 30) return `The VIX at ${vixValue.toFixed(1)} indicates extreme market stress and high expected volatility.`
      if (vixValue >= 25) return `The VIX at ${vixValue.toFixed(1)} shows elevated uncertainty and above-normal volatility expectations.`
      if (vixValue >= 20) return `The VIX at ${vixValue.toFixed(1)} indicates moderate concern with some expected volatility.`
      if (vixValue >= 15) return `The VIX at ${vixValue.toFixed(1)} shows normal market conditions with low fear levels.`
      if (vixValue >= 12) return `The VIX at ${vixValue.toFixed(1)} indicates very calm markets with minimal expected volatility.`
      return `The VIX at ${vixValue.toFixed(1)} shows extremely low fear - markets may be overly complacent.`
    }

    // Sector analysis
    const getSectorHighlights = (): string => {
      const topPerformer = data.sectors.reduce((best, sector) =>
        (sector.performance.day > best.performance.day) ? sector : best
      )
      const worstPerformer = data.sectors.reduce((worst, sector) =>
        (sector.performance.day < worst.performance.day) ? sector : worst
      )

      const topPerformance = topPerformer.performance.day
      const worstPerformance = worstPerformer.performance.day

      if (Math.abs(topPerformance) < 0.5 && Math.abs(worstPerformance) < 0.5) {
        return "All sectors are trading relatively flat today with minimal sector rotation."
      }

      return `${topPerformer.name} leads with a ${topPerformance > 0 ? 'gain' : 'loss'} of ${Math.abs(topPerformance).toFixed(2)}%, while ${worstPerformer.name} shows ${worstPerformance > 0 ? 'gains' : 'weakness'} at ${worstPerformance.toFixed(2)}%.`
    }

    // Economic factors
    const getEconomicFactors = (): string => {
      const yieldData = data.economicIndicators.yieldCurve
      const spread = yieldData.spread10Y2Y

      let yieldExplanation = ""
      if (spread !== undefined) {
        if (spread < 0) {
          yieldExplanation = `The yield curve is inverted (${spread.toFixed(2)}%), which historically signals economic concerns.`
        } else if (spread < 1) {
          yieldExplanation = `The yield curve is relatively flat (${spread.toFixed(2)}%), suggesting economic uncertainty.`
        } else {
          yieldExplanation = `The yield curve shows a healthy spread (${spread.toFixed(2)}%), indicating normal economic expectations.`
        }
      } else {
        yieldExplanation = "Bond yield data suggests " + yieldData.level.replace('-', ' ') + " economic sentiment."
      }

      return yieldExplanation + ` Social sentiment from trending discussions is ${data.socialSentiment.sentiment}.`
    }

    // Investment recommendation
    const getRecommendation = (): string => {
      if (sentimentValue <= 25 && vixValue >= 25) {
        return "High fear environment - consider defensive positions and wait for better entry points."
      }
      if (sentimentValue >= 75 && vixValue <= 15) {
        return "High optimism - be cautious of overvaluation and consider taking some profits."
      }
      if (sentimentValue >= 40 && sentimentValue <= 60) {
        return "Balanced market conditions - good environment for measured investments and diversification."
      }
      if (sentimentValue > 60) {
        return "Positive sentiment - consider growth positions but maintain risk management."
      }
      return "Cautious environment - focus on quality investments and defensive strategies."
    }

    // Create top sectors array
    const topSectors = data.sectors
      .sort((a, b) => b.performance.day - a.performance.day)
      .slice(0, 3)
      .map(sector => ({
        name: sector.name,
        performance: `${sector.performance.day > 0 ? '+' : ''}${sector.performance.day.toFixed(2)}%`,
        meaning: sector.performance.day > 0 ? 'Outperforming' : 'Underperforming'
      }))

    // Generate main summary
    const summary = `Markets are ${sentimentLevel.replace('-', ' ')} today with a sentiment score of ${sentimentValue}/100. ` +
      `The VIX at ${vixValue.toFixed(1)} indicates ${vixValue >= 20 ? 'elevated' : 'low'} volatility expectations. ` +
      getSectorHighlights()

    return {
      summary,
      details: {
        overallCondition: getOverallCondition(),
        vixExplanation: getVixExplanation(),
        sectorHighlights: getSectorHighlights(),
        economicFactors: getEconomicFactors(),
        recommendation: getRecommendation()
      },
      keyMetrics: {
        vix: {
          value: vixValue,
          meaning: vixValue >= 20 ? 'High fear/volatility' : 'Low fear/calm markets'
        },
        sentiment: {
          value: sentimentValue,
          meaning: sentimentLevel.replace('-', ' ').charAt(0).toUpperCase() + sentimentLevel.replace('-', ' ').slice(1)
        },
        topSectors,
        yieldSpread: {
          value: data.economicIndicators.yieldCurve.spread10Y2Y !== undefined
            ? `${data.economicIndicators.yieldCurve.spread10Y2Y.toFixed(2)}%`
            : data.economicIndicators.yieldCurve.level,
          meaning: data.economicIndicators.yieldCurve.spread10Y2Y !== undefined && data.economicIndicators.yieldCurve.spread10Y2Y < 0
            ? 'Inverted (recession signal)'
            : 'Normal economic expectations'
        }
      }
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="market-explanation-overlay"
      onClick={onClose}
    >
      <div
        className="market-explanation-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="modal-title">📊 Market Conditions Explained</h2>
          <button
            className="close-button"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="modal-content">
          {loading && (
            <div className="loading-state">
              <div className="loading-spinner"></div>
              <p>Analyzing current market conditions...</p>
            </div>
          )}

          {error && (
            <div className="error-state">
              <div className="error-icon">⚠️</div>
              <p>{error}</p>
              <button
                className="retry-button"
                onClick={generateExplanation}
              >
                Try Again
              </button>
            </div>
          )}

          {explanation && !loading && (
            <div className="explanation-content">
              {/* Summary Section */}
              <div className="summary-section">
                <h3>📋 Quick Summary</h3>
                <p className="summary-text">{explanation.summary}</p>
              </div>

              {/* Key Metrics */}
              <div className="metrics-section">
                <h3>📈 Key Numbers</h3>
                <div className="metrics-grid">
                  <div className="metric-card">
                    <div className="metric-label">Market Sentiment</div>
                    <div className="metric-value">{explanation.keyMetrics.sentiment.value}/100</div>
                    <div className="metric-meaning">{explanation.keyMetrics.sentiment.meaning}</div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-label">VIX (Fear Gauge)</div>
                    <div className="metric-value">{explanation.keyMetrics.vix.value.toFixed(1)}</div>
                    <div className="metric-meaning">{explanation.keyMetrics.vix.meaning}</div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-label">Yield Spread</div>
                    <div className="metric-value">{explanation.keyMetrics.yieldSpread.value}</div>
                    <div className="metric-meaning">{explanation.keyMetrics.yieldSpread.meaning}</div>
                  </div>
                </div>
              </div>

              {/* Detailed Explanation */}
              <div className="details-section">
                <h3>🔍 What This Means</h3>
                <div className="detail-item">
                  <h4>Overall Market Condition</h4>
                  <p>{explanation.details.overallCondition}</p>
                </div>
                <div className="detail-item">
                  <h4>Volatility & Fear Level</h4>
                  <p>{explanation.details.vixExplanation}</p>
                </div>
                <div className="detail-item">
                  <h4>Sector Performance</h4>
                  <p>{explanation.details.sectorHighlights}</p>
                </div>
                <div className="detail-item">
                  <h4>Economic Backdrop</h4>
                  <p>{explanation.details.economicFactors}</p>
                </div>
              </div>

              {/* Top Sectors */}
              <div className="sectors-section">
                <h3>🏆 Today's Sector Leaders</h3>
                <div className="sectors-list">
                  {explanation.keyMetrics.topSectors.map((sector, index) => (
                    <div key={index} className="sector-item">
                      <span className="sector-name">{sector.name}</span>
                      <span className="sector-performance">{sector.performance}</span>
                      <span className="sector-status">{sector.meaning}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recommendation */}
              <div className="recommendation-section">
                <h3>💡 For Investors</h3>
                <div className="recommendation-card">
                  <p>{explanation.details.recommendation}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <p className="disclaimer">
            This analysis is for educational purposes only and should not be considered investment advice.
          </p>
        </div>
      </div>

      <style jsx>{`
        .market-explanation-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          justify-content: center;
          align-items: flex-start;
          z-index: 9999;
          backdrop-filter: blur(5px);
          animation: fadeIn 0.3s ease;
          padding: 20px;
          overflow-y: auto;
        }

        .market-explanation-modal {
          background: rgba(17, 24, 39, 0.95);
          backdrop-filter: blur(20px);
          border-radius: 16px;
          border: 1px solid rgba(99, 102, 241, 0.3);
          box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
          max-width: 800px;
          width: 100%;
          max-height: calc(100vh - 40px);
          display: flex;
          flex-direction: column;
          animation: scaleIn 0.3s ease;
          margin: 20px auto;
          position: relative;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.5rem;
          border-bottom: 1px solid rgba(99, 102, 241, 0.2);
          flex-shrink: 0;
        }

        .modal-title {
          font-size: 1.5rem;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.95);
          margin: 0;
          text-shadow: 0 0 10px rgba(99, 102, 241, 0.3);
        }

        .close-button {
          background: rgba(75, 85, 99, 0.3);
          border: 1px solid rgba(156, 163, 175, 0.3);
          color: rgba(255, 255, 255, 0.8);
          font-size: 1.5rem;
          cursor: pointer;
          padding: 0;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          font-weight: 300;
          line-height: 1;
        }

        .close-button:hover {
          background: rgba(239, 68, 68, 0.2);
          border-color: rgba(239, 68, 68, 0.5);
          color: rgba(239, 68, 68, 0.9);
          transform: scale(1.1);
          box-shadow: 0 0 10px rgba(239, 68, 68, 0.3);
        }

        .close-button:focus {
          outline: 2px solid rgba(99, 102, 241, 0.5);
          outline-offset: 2px;
        }

        .modal-content {
          padding: 1.5rem;
          color: rgba(255, 255, 255, 0.9);
          flex: 1;
          overflow-y: auto;
          min-height: 0;
        }

        .loading-state, .error-state {
          text-align: center;
          padding: 2rem;
        }

        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 3px solid rgba(99, 102, 241, 0.3);
          border-top: 3px solid rgba(99, 102, 241, 0.8);
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 1rem;
        }

        .error-icon {
          font-size: 2rem;
          margin-bottom: 1rem;
        }

        .retry-button {
          background: rgba(99, 102, 241, 0.2);
          border: 1px solid rgba(99, 102, 241, 0.4);
          color: rgba(99, 102, 241, 0.9);
          padding: 0.5rem 1rem;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
          margin-top: 1rem;
        }

        .retry-button:hover {
          background: rgba(99, 102, 241, 0.3);
          box-shadow: 0 0 10px rgba(99, 102, 241, 0.3);
        }

        .explanation-content {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .summary-section {
          background: rgba(99, 102, 241, 0.1);
          border: 1px solid rgba(99, 102, 241, 0.3);
          border-radius: 12px;
          padding: 1.5rem;
        }

        .summary-text {
          font-size: 1.1rem;
          line-height: 1.6;
          margin: 0.5rem 0 0 0;
        }

        .metrics-section h3,
        .details-section h3,
        .sectors-section h3,
        .recommendation-section h3 {
          color: rgba(255, 255, 255, 0.95);
          font-size: 1.2rem;
          font-weight: 600;
          margin-bottom: 1rem;
          text-shadow: 0 0 5px rgba(99, 102, 241, 0.3);
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
        }

        .metric-card {
          background: rgba(31, 41, 55, 0.8);
          border: 1px solid rgba(75, 85, 99, 0.5);
          border-radius: 10px;
          padding: 1rem;
          text-align: center;
        }

        .metric-label {
          font-size: 0.9rem;
          color: rgba(156, 163, 175, 0.8);
          margin-bottom: 0.5rem;
        }

        .metric-value {
          font-size: 1.5rem;
          font-weight: 700;
          color: rgba(99, 102, 241, 0.9);
          margin-bottom: 0.25rem;
        }

        .metric-meaning {
          font-size: 0.8rem;
          color: rgba(255, 255, 255, 0.7);
        }

        .detail-item {
          margin-bottom: 1rem;
        }

        .detail-item h4 {
          font-size: 1rem;
          font-weight: 600;
          color: rgba(34, 197, 94, 0.9);
          margin-bottom: 0.5rem;
        }

        .detail-item p {
          line-height: 1.5;
          margin: 0;
        }

        .sectors-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .sector-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: rgba(31, 41, 55, 0.6);
          border-radius: 8px;
          padding: 0.75rem 1rem;
        }

        .sector-name {
          font-weight: 600;
        }

        .sector-performance {
          font-weight: 700;
          color: rgba(34, 197, 94, 0.9);
        }

        .sector-status {
          font-size: 0.8rem;
          color: rgba(156, 163, 175, 0.8);
        }

        .recommendation-section {
          background: rgba(34, 197, 94, 0.1);
          border: 1px solid rgba(34, 197, 94, 0.3);
          border-radius: 12px;
          padding: 1.5rem;
        }

        .recommendation-card p {
          font-size: 1.1rem;
          line-height: 1.6;
          margin: 0;
          color: rgba(255, 255, 255, 0.9);
        }

        .modal-footer {
          padding: 1rem 1.5rem;
          border-top: 1px solid rgba(99, 102, 241, 0.2);
          text-align: center;
          flex-shrink: 0;
        }

        .disclaimer {
          font-size: 0.8rem;
          color: rgba(156, 163, 175, 0.7);
          margin: 0;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes scaleIn {
          from {
            transform: scale(0.9);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @media (max-width: 768px) {
          .market-explanation-overlay {
            padding: 10px;
            align-items: flex-start;
          }

          .market-explanation-modal {
            margin: 0;
            max-height: calc(100vh - 20px);
            width: calc(100% - 20px);
          }

          .modal-header {
            padding: 1rem;
          }

          .modal-title {
            font-size: 1.2rem;
          }

          .modal-content {
            padding: 1rem;
          }

          .metrics-grid {
            grid-template-columns: 1fr;
          }

          .sector-item {
            flex-direction: column;
            gap: 0.25rem;
            text-align: center;
          }

          .close-button {
            width: 32px;
            height: 32px;
            font-size: 1.2rem;
          }
        }
      `}</style>
    </div>
  )
}