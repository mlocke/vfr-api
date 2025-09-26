/**
 * SimplifiedStockAnalysisDialog - Crash-Resistant Stock Analysis Modal
 * Displays essential analysis data with minimal UI complexity and robust error handling
 * Designed to prevent crashes at 30% completion
 */

'use client'

import React from 'react'

// Safe data extraction utilities
const safeGet = (obj: any, path: string, fallback: any = null) => {
  try {
    return path.split('.').reduce((current, key) => {
      return current && typeof current === 'object' ? current[key] : fallback
    }, obj) ?? fallback
  } catch {
    return fallback
  }
}

const formatScore = (value: any): string => {
  try {
    const num = typeof value === 'number' ? value : parseFloat(value)
    if (isNaN(num)) return '0'
    return Math.round(num * 100).toString()
  } catch {
    return '0'
  }
}

const formatCurrency = (value: any): string => {
  try {
    const num = typeof value === 'number' ? value : parseFloat(value)
    if (isNaN(num) || num <= 0) return '$0.00'

    if (num >= 1e12) return `$${(num / 1e12).toFixed(1)}T`
    if (num >= 1e9) return `$${(num / 1e9).toFixed(1)}B`
    if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M`
    return `$${num.toFixed(2)}`
  } catch {
    return '$0.00'
  }
}

const formatPercent = (value: any): string => {
  try {
    const num = typeof value === 'number' ? value : parseFloat(value)
    if (isNaN(num)) return '0.00%'
    return `${num > 0 ? '+' : ''}${num.toFixed(2)}%`
  } catch {
    return '0.00%'
  }
}

const formatNumber = (value: any): string => {
  try {
    const num = typeof value === 'number' ? value : parseFloat(value)
    if (isNaN(num)) return '0'
    return num.toLocaleString()
  } catch {
    return '0'
  }
}

interface SimplifiedStockAnalysisDialogProps {
  symbol: string
  analysisData: any // Accept raw analysis data
  isOpen: boolean
  onClose: () => void
  onActionTaken?: (action: 'BUY' | 'SELL' | 'HOLD', symbol: string) => void
}

// Simple progress bar component
const SimpleProgressBar: React.FC<{
  value: number;
  color?: string;
  label?: string
}> = ({ value, color = '#00c853', label }) => {
  const percentage = Math.max(0, Math.min(100, value))

  return (
    <div style={{ marginBottom: '12px' }}>
      {label && (
        <div style={{
          fontSize: '14px',
          color: 'rgba(255, 255, 255, 0.8)',
          marginBottom: '6px',
          display: 'flex',
          justifyContent: 'space-between'
        }}>
          <span>{label}</span>
          <span>{percentage}%</span>
        </div>
      )}
      <div style={{
        width: '100%',
        height: '8px',
        background: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '4px',
        overflow: 'hidden'
      }}>
        <div style={{
          width: `${percentage}%`,
          height: '100%',
          background: color,
          borderRadius: '4px',
          transition: 'width 0.3s ease'
        }} />
      </div>
    </div>
  )
}

// Simple card component
const InfoCard: React.FC<{
  title: string
  children: React.ReactNode
  icon?: string
}> = ({ title, children, icon = '📊' }) => (
  <div style={{
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '16px'
  }}>
    <h4 style={{
      fontSize: '16px',
      fontWeight: '600',
      color: 'white',
      marginBottom: '12px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      margin: '0 0 12px 0'
    }}>
      <span>{icon}</span>
      {title}
    </h4>
    {children}
  </div>
)

export const SimplifiedStockAnalysisDialog: React.FC<SimplifiedStockAnalysisDialogProps> = ({
  symbol,
  analysisData,
  isOpen,
  onClose,
  onActionTaken
}) => {
  // Safe data extraction with fallbacks
  const stockData = React.useMemo(() => {
    try {
      const firstResult = safeGet(analysisData, 'results.topSelections.0', {})

      return {
        symbol: safeGet(firstResult, 'symbol', symbol) || symbol,
        action: safeGet(firstResult, 'action', 'HOLD'),
        confidence: safeGet(firstResult, 'confidence', 0.5),
        overallScore: safeGet(firstResult, 'score.overallScore', 0.5),

        // Factor scores with safe fallbacks
        factorScores: {
          composite: safeGet(firstResult, 'score.factorScores.composite', 0.5),
          technical: safeGet(firstResult, 'score.factorScores.technical_overall_score', 0.5),
          momentum: safeGet(firstResult, 'score.factorScores.momentum_composite', 0.5),
          volatility: safeGet(firstResult, 'score.factorScores.volatility_30d', 0.5),
          sentiment: safeGet(firstResult, 'score.factorScores.sentiment_composite', 0.5),
          vwap_deviation: safeGet(firstResult, 'score.factorScores.vwap_deviation_score', 0.5),
          vwap_signals: safeGet(firstResult, 'score.factorScores.vwap_trading_signals', 0.5)
        },

        // Market data with safe fallbacks
        marketData: {
          price: safeGet(firstResult, 'score.marketData.price', 0),
          volume: safeGet(firstResult, 'score.marketData.volume', 0),
          marketCap: safeGet(firstResult, 'context.marketCap', 0),
          sector: safeGet(firstResult, 'score.marketData.sector', 'Unknown') || safeGet(firstResult, 'context.sector', 'Unknown'),
          exchange: safeGet(firstResult, 'score.marketData.exchange', 'Unknown')
        },

        // Context data
        context: {
          priceChange24h: safeGet(firstResult, 'context.priceChange24h'),
          volumeChange24h: safeGet(firstResult, 'context.volumeChange24h'),
          beta: safeGet(firstResult, 'context.beta', 1)
        },

        // Reasoning with safe fallbacks
        reasoning: {
          primaryFactors: safeGet(firstResult, 'reasoning.primaryFactors', []),
          warnings: safeGet(firstResult, 'reasoning.warnings', []),
          opportunities: safeGet(firstResult, 'reasoning.opportunities', [])
        },

        // Data quality
        dataQuality: {
          overall: safeGet(firstResult, 'dataQuality.overall.overall', 0.8),
          freshness: safeGet(firstResult, 'dataQuality.overall.metrics.freshness', 0.8),
          completeness: safeGet(firstResult, 'dataQuality.overall.metrics.completeness', 0.8),
          accuracy: safeGet(firstResult, 'dataQuality.overall.metrics.accuracy', 0.8)
        }
      }
    } catch (error) {
      console.error('Error processing analysis data:', error)

      // Return safe fallback data
      return {
        symbol: symbol,
        action: 'HOLD' as const,
        confidence: 0.5,
        overallScore: 0.5,
        factorScores: {
          composite: 0.5,
          technical: 0.5,
          momentum: 0.5,
          volatility: 0.5,
          sentiment: 0.5,
          vwap_deviation: 0.5,
          vwap_signals: 0.5
        },
        marketData: {
          price: 0,
          volume: 0,
          marketCap: 0,
          sector: 'Unknown',
          exchange: 'Unknown'
        },
        context: {
          priceChange24h: undefined,
          volumeChange24h: undefined,
          beta: 1
        },
        reasoning: {
          primaryFactors: ['Analysis data processing'],
          warnings: ['Limited data available'],
          opportunities: ['Data refresh recommended']
        },
        dataQuality: {
          overall: 0.5,
          freshness: 0.5,
          completeness: 0.5,
          accuracy: 0.5
        }
      }
    }
  }, [analysisData, symbol])

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  // Handle action click
  const handleActionClick = (action: 'BUY' | 'SELL' | 'HOLD') => {
    if (onActionTaken) {
      onActionTaken(action, stockData.symbol)
    }
  }

  // Get recommendation color
  const getRecommendationColor = (action: string) => {
    switch (action) {
      case 'BUY': return '#00c853'
      case 'SELL': return '#ef4444'
      default: return '#ffc107'
    }
  }

  // Get recommendation icon
  const getRecommendationIcon = (action: string) => {
    switch (action) {
      case 'BUY': return '🚀'
      case 'SELL': return '📉'
      default: return '⏸️'
    }
  }

  // Don't render if not open
  if (!isOpen) {
    return null
  }

  return (
    <>
      {/* Simple backdrop */}
      <div
        onClick={handleBackdropClick}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '16px'
        }}
      >
        {/* Main dialog container */}
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            background: 'linear-gradient(135deg, rgba(17, 24, 39, 0.98), rgba(31, 41, 55, 0.98))',
            backdropFilter: 'blur(20px)',
            border: '2px solid rgba(0, 200, 83, 0.4)',
            borderRadius: '20px',
            padding: '0',
            maxWidth: '800px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.6)'
          }}
        >
          {/* Header */}
          <div style={{
            padding: '24px 24px 16px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start'
          }}>
            <div>
              <h2 style={{
                fontSize: '24px',
                fontWeight: '700',
                color: 'white',
                margin: '0 0 8px 0',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                📊 {stockData.symbol} Analysis
              </h2>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                fontSize: '14px',
                color: 'rgba(255, 255, 255, 0.7)',
                flexWrap: 'wrap'
              }}>
                <span>{stockData.marketData.sector}</span>
                <span>•</span>
                <span>{formatCurrency(stockData.marketData.price)} Current Price</span>
                <span>•</span>
                <span>{formatNumber(stockData.marketData.volume)} Volume</span>
                {stockData.context.priceChange24h !== undefined && (
                  <>
                    <span>•</span>
                    <span style={{
                      color: stockData.context.priceChange24h > 0 ? '#00c853' : '#ef4444'
                    }}>
                      {formatPercent(stockData.context.priceChange24h)}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Close button */}
            <button
              onClick={onClose}
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '2px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '50%',
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '18px',
                color: 'rgba(239, 68, 68, 0.9)'
              }}
            >
              ✕
            </button>
          </div>

          {/* Recommendation badge */}
          <div style={{ padding: '16px 24px' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '12px',
              background: `${getRecommendationColor(stockData.action)}15`,
              border: `2px solid ${getRecommendationColor(stockData.action)}40`,
              borderRadius: '12px',
              padding: '12px 16px'
            }}>
              <div style={{ fontSize: '24px' }}>
                {getRecommendationIcon(stockData.action)}
              </div>
              <div>
                <div style={{
                  fontSize: '18px',
                  fontWeight: '700',
                  color: getRecommendationColor(stockData.action)
                }}>
                  {stockData.action} Recommendation
                </div>
                <div style={{
                  fontSize: '14px',
                  color: 'rgba(255, 255, 255, 0.7)'
                }}>
                  {formatScore(stockData.confidence)}% Confidence • Overall Score: {formatScore(stockData.overallScore)}/100
                </div>
              </div>
            </div>
          </div>

          {/* Main content */}
          <div style={{ padding: '16px 24px 24px 24px' }}>

            {/* Overall Score */}
            <InfoCard title="Overall Analysis Score" icon="🎯">
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                marginBottom: '16px'
              }}>
                <div style={{
                  fontSize: '36px',
                  fontWeight: '700',
                  color: '#00c853',
                  minWidth: '80px'
                }}>
                  {formatScore(stockData.overallScore)}
                </div>
                <div style={{ flex: 1 }}>
                  <SimpleProgressBar
                    value={parseInt(formatScore(stockData.overallScore))}
                    color="#00c853"
                  />
                </div>
              </div>
            </InfoCard>

            {/* Score Breakdown */}
            <InfoCard title="Score Breakdown" icon="📈">
              <SimpleProgressBar
                value={parseInt(formatScore(stockData.factorScores.technical))}
                color="#00c853"
                label="Technical Analysis"
              />
              <SimpleProgressBar
                value={parseInt(formatScore(stockData.factorScores.momentum))}
                color="#3b82f6"
                label="Momentum"
              />
              <SimpleProgressBar
                value={parseInt(formatScore(stockData.factorScores.sentiment))}
                color="#f59e0b"
                label="Sentiment"
              />
              <SimpleProgressBar
                value={parseInt(formatScore(stockData.factorScores.volatility))}
                color="#ef4444"
                label="Volatility (30D)"
              />
            </InfoCard>

            {/* Market Data */}
            <InfoCard title="Market Summary" icon="💰">
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '12px',
                fontSize: '14px',
                color: 'rgba(255, 255, 255, 0.8)'
              }}>
                <div><strong>Price:</strong> {formatCurrency(stockData.marketData.price)}</div>
                <div><strong>Volume:</strong> {formatNumber(stockData.marketData.volume)}</div>
                <div><strong>Sector:</strong> {stockData.marketData.sector}</div>
                <div><strong>Exchange:</strong> {stockData.marketData.exchange}</div>
                <div><strong>Market Cap:</strong> {formatCurrency(stockData.marketData.marketCap)}</div>
                <div><strong>Beta:</strong> {stockData.context.beta}</div>
              </div>
            </InfoCard>

            {/* Key Factors */}
            {stockData.reasoning.primaryFactors.length > 0 && (
              <InfoCard title="Key Analysis Factors" icon="📋">
                <ul style={{
                  margin: 0,
                  paddingLeft: '20px',
                  color: 'rgba(255, 255, 255, 0.8)',
                  lineHeight: '1.6'
                }}>
                  {stockData.reasoning.primaryFactors.slice(0, 5).map((factor: string, index: number) => (
                    <li key={index} style={{ marginBottom: '4px' }}>
                      {factor.replace(/([A-Z])/g, ' $1').replace(/^./, (str: string) => str.toUpperCase())}
                    </li>
                  ))}
                </ul>
              </InfoCard>
            )}

            {/* Opportunities */}
            {stockData.reasoning.opportunities.length > 0 && (
              <InfoCard title="Opportunities" icon="🚀">
                <ul style={{
                  margin: 0,
                  paddingLeft: '20px',
                  color: 'rgba(0, 200, 83, 0.9)',
                  lineHeight: '1.6'
                }}>
                  {stockData.reasoning.opportunities.slice(0, 3).map((opportunity: string, index: number) => (
                    <li key={index} style={{ marginBottom: '4px' }}>
                      {opportunity}
                    </li>
                  ))}
                </ul>
              </InfoCard>
            )}

            {/* Warnings */}
            {stockData.reasoning.warnings.length > 0 && (
              <InfoCard title="Risk Factors" icon="⚠️">
                <ul style={{
                  margin: 0,
                  paddingLeft: '20px',
                  color: 'rgba(239, 68, 68, 0.9)',
                  lineHeight: '1.6'
                }}>
                  {stockData.reasoning.warnings.slice(0, 3).map((warning: string, index: number) => (
                    <li key={index} style={{ marginBottom: '4px' }}>
                      {warning}
                    </li>
                  ))}
                </ul>
              </InfoCard>
            )}

            {/* Data Quality */}
            <InfoCard title="Data Quality" icon="🔍">
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: '12px',
                fontSize: '14px',
                color: 'rgba(255, 255, 255, 0.8)'
              }}>
                <div>
                  <div><strong>Overall:</strong> {formatScore(stockData.dataQuality.overall)}/100</div>
                </div>
                <div>
                  <div><strong>Freshness:</strong> {formatScore(stockData.dataQuality.freshness)}/100</div>
                </div>
                <div>
                  <div><strong>Completeness:</strong> {formatScore(stockData.dataQuality.completeness)}/100</div>
                </div>
                <div>
                  <div><strong>Accuracy:</strong> {formatScore(stockData.dataQuality.accuracy)}/100</div>
                </div>
              </div>
            </InfoCard>
          </div>

          {/* Footer with action buttons */}
          <div style={{
            padding: '16px 24px',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap'
          }}>
            <div style={{
              fontSize: '12px',
              color: 'rgba(255, 255, 255, 0.5)'
            }}>
              Last updated: {new Date().toLocaleTimeString()}
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                onClick={() => handleActionClick('BUY')}
                style={{
                  background: 'rgba(0, 200, 83, 0.2)',
                  border: '1px solid rgba(0, 200, 83, 0.4)',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  color: 'rgba(0, 200, 83, 0.9)',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                BUY
              </button>
              <button
                onClick={() => handleActionClick('HOLD')}
                style={{
                  background: 'rgba(255, 193, 7, 0.2)',
                  border: '1px solid rgba(255, 193, 7, 0.4)',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  color: 'rgba(255, 193, 7, 0.9)',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                HOLD
              </button>
              <button
                onClick={() => handleActionClick('SELL')}
                style={{
                  background: 'rgba(239, 68, 68, 0.2)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  color: 'rgba(239, 68, 68, 0.9)',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                SELL
              </button>
              <button
                onClick={onClose}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  color: 'rgba(255, 255, 255, 0.7)',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default SimplifiedStockAnalysisDialog