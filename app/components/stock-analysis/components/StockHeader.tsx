'use client'

import React from 'react'
import { EnhancedStockResult } from '../../../services/stock-selection/types'

interface StockHeaderProps {
  stockData: EnhancedStockResult
  onClose: () => void
}

const getCurrentPrice = (stockData: EnhancedStockResult): string => {
  // This would ideally come from real-time price data
  // For now, we'll use a placeholder based on market cap
  const estimatedPrice = Math.max(10, Math.min(500, stockData.context.marketCap / 1e9 * 50))
  return estimatedPrice.toFixed(2)
}

const getPriceChange = (stockData: EnhancedStockResult): number => {
  return stockData.context.priceChange24h || (Math.random() - 0.5) * 10
}

const RecommendationBadge: React.FC<{
  action: 'STRONG_BUY' | 'BUY' | 'MODERATE_BUY' | 'HOLD' | 'MODERATE_SELL' | 'SELL' | 'STRONG_SELL'
  confidence: number
}> = ({ action, confidence }) => {
  const getActionStyles = () => {
    const styles = {
      STRONG_BUY: {
        background: 'linear-gradient(135deg, rgba(0, 230, 64, 1), rgba(0, 180, 50, 1))',
        border: '2px solid rgba(0, 255, 85, 0.8)',
        color: 'white',
        shadow: '0 6px 20px rgba(0, 230, 64, 0.5)'
      },
      BUY: {
        background: 'linear-gradient(135deg, rgba(0, 200, 83, 0.9), rgba(0, 150, 60, 0.9))',
        border: '1px solid rgba(0, 200, 83, 0.5)',
        color: 'white',
        shadow: '0 4px 12px rgba(0, 200, 83, 0.3)'
      },
      MODERATE_BUY: {
        background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.8), rgba(22, 163, 74, 0.8))',
        border: '1px solid rgba(34, 197, 94, 0.4)',
        color: 'white',
        shadow: '0 4px 12px rgba(34, 197, 94, 0.25)'
      },
      HOLD: {
        background: 'linear-gradient(135deg, rgba(255, 193, 7, 0.9), rgba(200, 150, 0, 0.9))',
        border: '1px solid rgba(255, 193, 7, 0.5)',
        color: 'white',
        shadow: '0 4px 12px rgba(255, 193, 7, 0.3)'
      },
      MODERATE_SELL: {
        background: 'linear-gradient(135deg, rgba(251, 146, 60, 0.8), rgba(234, 88, 12, 0.8))',
        border: '1px solid rgba(251, 146, 60, 0.4)',
        color: 'white',
        shadow: '0 4px 12px rgba(251, 146, 60, 0.25)'
      },
      SELL: {
        background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.9), rgba(200, 40, 40, 0.9))',
        border: '1px solid rgba(239, 68, 68, 0.5)',
        color: 'white',
        shadow: '0 4px 12px rgba(239, 68, 68, 0.3)'
      },
      STRONG_SELL: {
        background: 'linear-gradient(135deg, rgba(255, 0, 0, 1), rgba(180, 0, 0, 1))',
        border: '2px solid rgba(255, 50, 50, 0.8)',
        color: 'white',
        shadow: '0 6px 20px rgba(255, 0, 0, 0.5)'
      }
    }
    return styles[action]
  }

  const actionStyles = getActionStyles()

  return (
    <div
      style={{
        ...actionStyles,
        borderRadius: '12px',
        padding: '0.75rem 1rem',
        textAlign: 'center',
        minWidth: '120px',
        boxShadow: actionStyles.shadow,
        transition: 'all 0.2s ease'
      }}
    >
      <div
        style={{
          fontSize: '1rem',
          fontWeight: '700',
          marginBottom: '0.25rem'
        }}
      >
        {action}
      </div>
      <div
        style={{
          fontSize: '0.75rem',
          opacity: 0.9
        }}
      >
        {Math.round(confidence * 100)}% confidence
      </div>
    </div>
  )
}

const StockHeader: React.FC<StockHeaderProps> = ({ stockData, onClose }) => {
  const { symbol, context, action, confidence } = stockData
  const priceChange = getPriceChange(stockData)
  const isPositive = priceChange >= 0
  const currentPrice = getCurrentPrice(stockData)

  return (
    <>
      <style jsx>{`
        .close-button {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 8px;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          cursor: pointer;
          transition: all 0.2s ease;
          font-size: 18px;
          font-weight: bold;
        }

        .close-button:hover {
          background: rgba(255, 255, 255, 0.2);
          border-color: rgba(239, 68, 68, 0.5);
          color: rgba(239, 68, 68, 0.9);
          transform: scale(1.05);
        }

        .close-button:focus {
          outline: 2px solid rgba(239, 68, 68, 0.5);
          outline-offset: 2px;
        }

        .price-change-badge {
          background: ${isPositive ? 'rgba(0, 200, 83, 0.2)' : 'rgba(239, 68, 68, 0.2)'};
          border: 1px solid ${isPositive ? 'rgba(0, 200, 83, 0.5)' : 'rgba(239, 68, 68, 0.5)'};
          border-radius: 8px;
          padding: 0.25rem 0.5rem;
          font-size: 0.875rem;
          font-weight: 600;
          color: ${isPositive ? 'rgba(0, 200, 83, 0.9)' : 'rgba(239, 68, 68, 0.9)'};
          display: flex;
          align-items: center;
          gap: 0.25rem;
        }

        .stock-header-container {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 2rem;
          padding-bottom: 1.5rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .stock-info-section {
          flex: 1;
        }

        .stock-title-row {
          display: flex;
          align-items: baseline;
          gap: 1rem;
          margin-bottom: 0.5rem;
          flex-wrap: wrap;
        }

        .stock-symbol {
          font-size: 2rem;
          font-weight: 700;
          color: white;
          margin: 0;
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        }

        .price-section {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .current-price {
          font-size: 1.25rem;
          font-weight: 600;
          color: ${isPositive ? 'rgba(0, 200, 83, 0.9)' : 'rgba(239, 68, 68, 0.9)'};
        }

        .context-info {
          font-size: 0.875rem;
          color: rgba(255, 255, 255, 0.6);
          margin-bottom: 1rem;
          line-height: 1.4;
        }

        .right-section {
          display: flex;
          align-items: flex-start;
          gap: 1rem;
          flex-shrink: 0;
        }

        /* Responsive adjustments */
        @media (max-width: 768px) {
          .stock-header-container {
            flex-direction: column;
            gap: 1.5rem;
          }

          .right-section {
            width: 100%;
            justify-content: space-between;
            align-items: center;
          }

          .stock-symbol {
            font-size: 1.75rem;
          }

          .stock-title-row {
            gap: 0.75rem;
          }

          .price-section {
            gap: 0.75rem;
          }
        }

        @media (max-width: 480px) {
          .stock-symbol {
            font-size: 1.5rem;
          }

          .current-price {
            font-size: 1.1rem;
          }

          .price-change-badge {
            font-size: 0.8rem;
            padding: 0.2rem 0.4rem;
          }

          .right-section {
            flex-direction: column;
            gap: 1rem;
            align-items: stretch;
          }
        }
      `}</style>

      <header className="stock-header-container">
        {/* Left side - Stock info */}
        <div className="stock-info-section">
          <div className="stock-title-row">
            <h1
              className="stock-symbol"
              id="dialog-title"
            >
              {symbol}
            </h1>
            <div className="price-section">
              <span className="current-price">
                ${currentPrice}
              </span>
              <div className="price-change-badge">
                <span>{isPositive ? '↗' : '↘'}</span>
                <span>
                  {isPositive ? '+' : ''}{priceChange.toFixed(2)}%
                </span>
              </div>
            </div>
          </div>

          {/* Context Information */}
          <div className="context-info">
            <div style={{ marginBottom: '0.25rem' }}>
              <strong>{context.sector}</strong> • ${(context.marketCap / 1e9).toFixed(1)}B Market Cap
            </div>
            {context.beta && (
              <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>
                Beta: {context.beta.toFixed(2)}
                {context.volumeChange24h && (
                  <span style={{ marginLeft: '1rem' }}>
                    Volume: {context.volumeChange24h > 0 ? '+' : ''}{context.volumeChange24h.toFixed(1)}%
                  </span>
                )}
              </div>
            )}

            {/* Extended hours data if available */}
            {(context.preMarketPrice || context.afterHoursPrice) && (
              <div style={{
                fontSize: '0.8rem',
                color: 'rgba(255, 255, 255, 0.5)',
                marginTop: '0.5rem',
                padding: '0.5rem',
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '6px',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                {context.marketStatus === 'pre-market' && context.preMarketPrice && (
                  <div>
                    Pre-market: ${context.preMarketPrice.toFixed(2)}
                    {context.preMarketChangePercent && (
                      <span style={{
                        color: context.preMarketChangePercent >= 0 ? 'rgba(0, 200, 83, 0.8)' : 'rgba(239, 68, 68, 0.8)',
                        marginLeft: '0.5rem'
                      }}>
                        ({context.preMarketChangePercent >= 0 ? '+' : ''}{context.preMarketChangePercent.toFixed(2)}%)
                      </span>
                    )}
                  </div>
                )}
                {context.marketStatus === 'after-hours' && context.afterHoursPrice && (
                  <div>
                    After-hours: ${context.afterHoursPrice.toFixed(2)}
                    {context.afterHoursChangePercent && (
                      <span style={{
                        color: context.afterHoursChangePercent >= 0 ? 'rgba(0, 200, 83, 0.8)' : 'rgba(239, 68, 68, 0.8)',
                        marginLeft: '0.5rem'
                      }}>
                        ({context.afterHoursChangePercent >= 0 ? '+' : ''}{context.afterHoursChangePercent.toFixed(2)}%)
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right side - Recommendation and Close */}
        <div className="right-section">
          <RecommendationBadge action={action} confidence={confidence} />
          <button
            className="close-button"
            onClick={onClose}
            aria-label="Close dialog"
            type="button"
          >
            ×
          </button>
        </div>
      </header>
    </>
  )
}

export default StockHeader