/**
 * DialogHeader - Stock dialog header component with symbol, price, and controls
 * Displays stock symbol, current price, change, sector information, and recommendation badge
 */

'use client'

import React from 'react'
import { DialogHeaderProps } from '../types'
import { RecommendationBadge } from './RecommendationBadge'
import { formatMarketCap } from '../utils/formatters'

/**
 * Get current price from stock data with fallback logic
 */
function getCurrentPrice(stockData: DialogHeaderProps['stockData']): number {
  if (stockData.realtime?.price) {
    return stockData.realtime.price
  }
  if (stockData.context.currentPrice) {
    return stockData.context.currentPrice
  }
  // Fallback calculation if no direct price available
  return 100 // Default fallback - in real implementation would fetch from API
}

/**
 * DialogHeader Component
 */
export const DialogHeader: React.FC<DialogHeaderProps> = ({
  stockData,
  onClose,
  onRefresh
}) => {
  const priceChange = stockData.context.priceChange24h || 0
  const isPositive = priceChange >= 0
  const currentPrice = getCurrentPrice(stockData)

  // Get market status indicator
  const getMarketStatusColor = (status?: string) => {
    switch (status) {
      case 'market-hours':
        return 'rgba(0, 200, 83, 0.9)'
      case 'pre-market':
      case 'after-hours':
        return 'rgba(255, 193, 7, 0.9)'
      case 'closed':
        return 'rgba(156, 163, 175, 0.9)'
      default:
        return 'rgba(255, 255, 255, 0.6)'
    }
  }

  const getMarketStatusText = (status?: string) => {
    switch (status) {
      case 'market-hours':
        return 'Market Open'
      case 'pre-market':
        return 'Pre-Market'
      case 'after-hours':
        return 'After Hours'
      case 'closed':
        return 'Market Closed'
      default:
        return ''
    }
  }

  return (
    <div
      className="dialog-header"
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '2rem',
        paddingBottom: '1.5rem',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        position: 'relative'
      }}
    >
      {/* Left side - Stock information */}
      <div style={{ flex: 1, marginRight: '2rem' }}>
        {/* Symbol and Price Row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: '1rem',
            marginBottom: '0.75rem',
            flexWrap: 'wrap'
          }}
        >
          {/* Stock Symbol */}
          <h1
            id="dialog-title"
            style={{
              fontSize: 'clamp(1.5rem, 4vw, 2rem)',
              fontWeight: '700',
              color: 'white',
              margin: 0,
              letterSpacing: '0.5px'
            }}
          >
            {stockData.symbol}
          </h1>

          {/* Current Price */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span
              style={{
                fontSize: 'clamp(1rem, 3vw, 1.25rem)',
                fontWeight: '600',
                color: isPositive ? 'rgba(0, 200, 83, 0.9)' : 'rgba(239, 68, 68, 0.9)'
              }}
            >
              ${currentPrice.toFixed(2)}
            </span>

            {/* Price Change Badge */}
            {priceChange !== 0 && (
              <div
                style={{
                  background: isPositive ? 'rgba(0, 200, 83, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                  border: `1px solid ${
                    isPositive ? 'rgba(0, 200, 83, 0.5)' : 'rgba(239, 68, 68, 0.5)'
                  }`,
                  borderRadius: '8px',
                  padding: '0.25rem 0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  color: isPositive ? 'rgba(0, 200, 83, 0.9)' : 'rgba(239, 68, 68, 0.9)',
                  whiteSpace: 'nowrap'
                }}
              >
                {isPositive ? '+' : ''}{priceChange.toFixed(2)}%
              </div>
            )}
          </div>

          {/* Market Status */}
          {stockData.context.marketStatus && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.75rem',
                color: getMarketStatusColor(stockData.context.marketStatus),
                fontWeight: '500'
              }}
            >
              <div
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: getMarketStatusColor(stockData.context.marketStatus)
                }}
              />
              {getMarketStatusText(stockData.context.marketStatus)}
            </div>
          )}
        </div>

        {/* Sector and Market Cap Row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            fontSize: '0.875rem',
            color: 'rgba(255, 255, 255, 0.6)',
            marginBottom: '1rem',
            flexWrap: 'wrap'
          }}
        >
          <span>{stockData.context.sector}</span>
          <span>•</span>
          <span>{formatMarketCap(stockData.context.marketCap)} Market Cap</span>
          {stockData.context.beta && (
            <>
              <span>•</span>
              <span>Beta: {stockData.context.beta.toFixed(2)}</span>
            </>
          )}
        </div>

        {/* Extended Hours Information */}
        {(stockData.context.preMarketPrice || stockData.context.afterHoursPrice) && (
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              padding: '0.75rem',
              fontSize: '0.875rem',
              color: 'rgba(255, 255, 255, 0.8)'
            }}
          >
            {stockData.context.preMarketPrice && (
              <div style={{ marginBottom: '0.25rem' }}>
                <strong>Pre-Market:</strong> ${stockData.context.preMarketPrice.toFixed(2)}
                {stockData.context.preMarketChangePercent && (
                  <span
                    style={{
                      marginLeft: '0.5rem',
                      color: (stockData.context.preMarketChangePercent >= 0)
                        ? 'rgba(0, 200, 83, 0.9)'
                        : 'rgba(239, 68, 68, 0.9)'
                    }}
                  >
                    ({stockData.context.preMarketChangePercent >= 0 ? '+' : ''}{stockData.context.preMarketChangePercent.toFixed(2)}%)
                  </span>
                )}
              </div>
            )}
            {stockData.context.afterHoursPrice && (
              <div>
                <strong>After Hours:</strong> ${stockData.context.afterHoursPrice.toFixed(2)}
                {stockData.context.afterHoursChangePercent && (
                  <span
                    style={{
                      marginLeft: '0.5rem',
                      color: (stockData.context.afterHoursChangePercent >= 0)
                        ? 'rgba(0, 200, 83, 0.9)'
                        : 'rgba(239, 68, 68, 0.9)'
                    }}
                  >
                    ({stockData.context.afterHoursChangePercent >= 0 ? '+' : ''}{stockData.context.afterHoursChangePercent.toFixed(2)}%)
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right side - Recommendation and Controls */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '1rem',
          flexShrink: 0
        }}
      >
        {/* Recommendation Badge */}
        <RecommendationBadge
          action={stockData.action}
          confidence={stockData.confidence}
          size="large"
          showConfidence={true}
        />

        {/* Control Buttons */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {/* Refresh Button */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              title="Refresh data"
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'rgba(255, 255, 255, 0.8)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontSize: '14px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'
                e.currentTarget.style.borderColor = 'rgba(0, 200, 83, 0.5)'
                e.currentTarget.style.color = 'white'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
                e.currentTarget.style.color = 'rgba(255, 255, 255, 0.8)'
              }}
            >
              🔄
            </button>
          )}

          {/* Close Button */}
          <button
            onClick={onClose}
            title="Close dialog"
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '8px',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'rgba(255, 255, 255, 0.8)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontSize: '18px',
              fontWeight: 'bold'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'
              e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.5)'
              e.currentTarget.style.color = 'rgba(239, 68, 68, 0.9)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
              e.currentTarget.style.color = 'rgba(255, 255, 255, 0.8)'
            }}
          >
            ×
          </button>
        </div>
      </div>
    </div>
  )
}

export default DialogHeader