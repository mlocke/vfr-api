# Interactive Stock Dialog - Implementation Guide

**Created:** September 25, 2025, 5:50 PM
**Context:** Code templates and implementation examples for VFR Stock Analysis Dialog

## Quick Start Implementation

### 1. Core Dialog Component Template

```tsx
// /app/components/stock-analysis/InteractiveStockDialog.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { EnhancedStockResult } from '../../services/stock-selection/types'

interface StockDialogProps {
  symbol: string
  isOpen: boolean
  onClose: () => void
  onActionTaken?: (action: 'BUY' | 'SELL' | 'HOLD', symbol: string) => void
}

export const InteractiveStockDialog = ({
  symbol,
  isOpen,
  onClose,
  onActionTaken
}: StockDialogProps) => {
  const [stockData, setStockData] = useState<EnhancedStockResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedInsights, setExpandedInsights] = useState<Set<string>>(new Set())
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now())

  // Fetch dialog-specific data
  const fetchDialogData = useCallback(async () => {
    if (!symbol) return

    try {
      setLoading(true)
      const response = await fetch(`/api/stocks/dialog/${symbol}`)
      const result = await response.json()

      if (result.success) {
        setStockData(result.data)
        setLastUpdated(Date.now())
      }
    } catch (error) {
      console.error('Failed to fetch dialog data:', error)
    } finally {
      setLoading(false)
    }
  }, [symbol])

  useEffect(() => {
    if (isOpen && symbol) {
      fetchDialogData()
    }
  }, [isOpen, symbol, fetchDialogData])

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  // Toggle insight expansion
  const toggleInsight = (insightId: string) => {
    setExpandedInsights(prev => {
      const newSet = new Set(prev)
      if (newSet.has(insightId)) {
        newSet.delete(insightId)
      } else {
        newSet.add(insightId)
      }
      return newSet
    })
  }

  if (!isOpen) return null

  return (
    <div
      className="dialog-backdrop"
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        animation: 'fadeIn 0.2s ease-out'
      }}
    >
      <div
        className="dialog-container"
        style={{
          background: 'rgba(17, 24, 39, 0.95)',
          backdropFilter: 'blur(20px)',
          border: '2px solid rgba(239, 68, 68, 0.6)',
          borderRadius: '20px',
          padding: '2rem',
          maxWidth: '800px',
          width: 'calc(100% - 2rem)',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.4)',
          animation: 'slideIn 0.3s ease-out'
        }}
      >
        {loading ? (
          <DialogLoadingState />
        ) : stockData ? (
          <>
            <StockHeader stockData={stockData} onClose={onClose} />
            <ScoreVisualization scores={stockData.score} />
            <QuickInsights
              insights={generateInsights(stockData)}
              expandedInsights={expandedInsights}
              onToggle={toggleInsight}
            />
            <RisksOpportunities
              risks={stockData.reasoning.warnings || []}
              opportunities={stockData.reasoning.opportunities || []}
            />
            <DialogFooter
              lastUpdated={lastUpdated}
              onAction={onActionTaken}
              symbol={symbol}
              recommendation={stockData.action}
            />
          </>
        ) : (
          <DialogErrorState onRetry={fetchDialogData} />
        )}
      </div>
    </div>
  )
}

// CSS Animations
const dialogStyles = `
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: scale(0.9) translateY(20px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}
`
```

### 2. Stock Header Component

```tsx
// /app/components/stock-analysis/StockHeader.tsx
interface StockHeaderProps {
  stockData: EnhancedStockResult
  onClose: () => void
}

export const StockHeader = ({ stockData, onClose }: StockHeaderProps) => {
  const { symbol, context, action, confidence } = stockData
  const priceChange = context.priceChange24h || 0
  const isPositive = priceChange >= 0

  return (
    <div className="stock-header" style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: '2rem',
      paddingBottom: '1.5rem',
      borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
    }}>
      {/* Left side - Stock info */}
      <div>
        <div style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: '1rem',
          marginBottom: '0.5rem'
        }}>
          <h1 style={{
            fontSize: '2rem',
            fontWeight: '700',
            color: 'white',
            margin: 0
          }}>
            {symbol}
          </h1>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <span style={{
              fontSize: '1.25rem',
              fontWeight: '600',
              color: isPositive ? 'rgba(0, 200, 83, 0.9)' : 'rgba(239, 68, 68, 0.9)'
            }}>
              ${getCurrentPrice(stockData)}
            </span>
            <div style={{
              background: isPositive ? 'rgba(0, 200, 83, 0.2)' : 'rgba(239, 68, 68, 0.2)',
              border: `1px solid ${isPositive ? 'rgba(0, 200, 83, 0.5)' : 'rgba(239, 68, 68, 0.5)'}`,
              borderRadius: '8px',
              padding: '0.25rem 0.5rem',
              fontSize: '0.875rem',
              fontWeight: '600',
              color: isPositive ? 'rgba(0, 200, 83, 0.9)' : 'rgba(239, 68, 68, 0.9)'
            }}>
              {isPositive ? '+' : ''}{priceChange.toFixed(2)}%
            </div>
          </div>
        </div>

        {/* Sector and Market Cap */}
        <div style={{
          fontSize: '0.875rem',
          color: 'rgba(255, 255, 255, 0.6)',
          marginBottom: '1rem'
        }}>
          {context.sector} • ${(context.marketCap / 1e9).toFixed(1)}B Market Cap
        </div>
      </div>

      {/* Right side - Recommendation and Close */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '1rem'
      }}>
        <RecommendationBadge action={action} confidence={confidence} />
        <button
          onClick={onClose}
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '8px',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
          }}
        >
          ×
        </button>
      </div>
    </div>
  )
}

// Recommendation Badge Component
const RecommendationBadge = ({ action, confidence }: {
  action: 'BUY' | 'SELL' | 'HOLD'
  confidence: number
}) => {
  const getActionStyles = () => {
    const styles = {
      BUY: {
        background: 'linear-gradient(135deg, rgba(0, 200, 83, 0.9), rgba(0, 150, 60, 0.9))',
        border: '1px solid rgba(0, 200, 83, 0.5)',
        color: 'white'
      },
      SELL: {
        background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.9), rgba(200, 40, 40, 0.9))',
        border: '1px solid rgba(239, 68, 68, 0.5)',
        color: 'white'
      },
      HOLD: {
        background: 'linear-gradient(135deg, rgba(255, 193, 7, 0.9), rgba(200, 150, 0, 0.9))',
        border: '1px solid rgba(255, 193, 7, 0.5)',
        color: 'white'
      }
    }
    return styles[action]
  }

  const actionStyles = getActionStyles()

  return (
    <div style={{
      ...actionStyles,
      borderRadius: '12px',
      padding: '0.75rem 1rem',
      textAlign: 'center',
      minWidth: '120px'
    }}>
      <div style={{
        fontSize: '1rem',
        fontWeight: '700',
        marginBottom: '0.25rem'
      }}>
        {action}
      </div>
      <div style={{
        fontSize: '0.75rem',
        opacity: 0.9
      }}>
        {Math.round(confidence * 100)}% confidence
      </div>
    </div>
  )
}
```

### 3. Score Visualization Component

```tsx
// /app/components/stock-analysis/ScoreVisualization.tsx
interface ScoreVisualizationProps {
  scores: {
    overall: number
    technical: number
    fundamental: number
    sentiment: number
    // Additional scores based on your analysis engine
  }
}

export const ScoreVisualization = ({ scores }: ScoreVisualizationProps) => {
  const overallScore = Math.round(scores.overall * 100)

  const scoreCategories = [
    { label: 'Technical', value: scores.technical, color: 'rgba(0, 200, 83, 0.8)' },
    { label: 'Fundamental', value: scores.fundamental, color: 'rgba(59, 130, 246, 0.8)' },
    { label: 'Macro', value: 0.75, color: 'rgba(168, 85, 247, 0.8)' }, // Example value
    { label: 'Sentiment', value: scores.sentiment, color: 'rgba(245, 158, 11, 0.8)' },
    { label: 'Alternative', value: 0.65, color: 'rgba(239, 68, 68, 0.8)' } // Example value
  ]

  return (
    <div className="score-visualization" style={{
      background: 'rgba(255, 255, 255, 0.05)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '15px',
      padding: '2rem',
      marginBottom: '2rem'
    }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '200px 1fr',
        gap: '2rem',
        alignItems: 'center'
      }}>
        {/* Overall Score Circle */}
        <div style={{
          position: 'relative',
          width: '160px',
          height: '160px',
          margin: '0 auto'
        }}>
          <svg width="160" height="160" style={{ transform: 'rotate(-90deg)' }}>
            {/* Background circle */}
            <circle
              cx="80"
              cy="80"
              r="70"
              fill="none"
              stroke="rgba(255, 255, 255, 0.1)"
              strokeWidth="8"
            />
            {/* Progress circle */}
            <circle
              cx="80"
              cy="80"
              r="70"
              fill="none"
              stroke="rgba(0, 200, 83, 0.8)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 70}`}
              strokeDashoffset={`${2 * Math.PI * 70 * (1 - overallScore / 100)}`}
              style={{ transition: 'stroke-dashoffset 0.6s ease' }}
            />
          </svg>
          {/* Score text */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center'
          }}>
            <div style={{
              fontSize: '2rem',
              fontWeight: '700',
              color: 'white'
            }}>
              {overallScore}
            </div>
            <div style={{
              fontSize: '0.875rem',
              color: 'rgba(255, 255, 255, 0.6)'
            }}>
              /100
            </div>
          </div>
        </div>

        {/* Score Breakdown */}
        <div>
          <h3 style={{
            fontSize: '1.25rem',
            fontWeight: '600',
            color: 'white',
            marginBottom: '1rem'
          }}>
            Score Breakdown
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {scoreCategories.map(({ label, value, color }) => (
              <div key={label} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem'
              }}>
                <div style={{
                  width: '80px',
                  fontSize: '0.875rem',
                  color: 'rgba(255, 255, 255, 0.8)'
                }}>
                  {label}
                </div>
                <div style={{
                  flex: 1,
                  height: '8px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '4px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.round(value * 100)}%`,
                    background: color,
                    borderRadius: '4px',
                    transition: 'width 0.6s ease'
                  }} />
                </div>
                <div style={{
                  width: '40px',
                  textAlign: 'right',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  color: 'rgba(255, 255, 255, 0.9)'
                }}>
                  {Math.round(value * 100)}%
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
```

### 4. Quick Insights Component

```tsx
// /app/components/stock-analysis/QuickInsights.tsx
interface Insight {
  id: string
  title: string
  status: 'positive' | 'negative' | 'neutral'
  expandable: boolean
  icon: string
  details?: string[]
}

interface QuickInsightsProps {
  insights: Insight[]
  expandedInsights: Set<string>
  onToggle: (insightId: string) => void
}

export const QuickInsights = ({ insights, expandedInsights, onToggle }: QuickInsightsProps) => {
  const getStatusStyles = (status: 'positive' | 'negative' | 'neutral') => {
    const styles = {
      positive: {
        borderColor: 'rgba(0, 200, 83, 0.5)',
        iconColor: 'rgba(0, 200, 83, 0.9)',
        icon: '✓'
      },
      negative: {
        borderColor: 'rgba(239, 68, 68, 0.5)',
        iconColor: 'rgba(239, 68, 68, 0.9)',
        icon: '⚠'
      },
      neutral: {
        borderColor: 'rgba(255, 193, 7, 0.5)',
        iconColor: 'rgba(255, 193, 7, 0.9)',
        icon: 'i'
      }
    }
    return styles[status]
  }

  return (
    <div className="quick-insights" style={{
      marginBottom: '2rem'
    }}>
      <h3 style={{
        fontSize: '1.25rem',
        fontWeight: '600',
        color: 'white',
        marginBottom: '1rem'
      }}>
        Quick Insights
      </h3>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem'
      }}>
        {insights.map((insight) => {
          const statusStyles = getStatusStyles(insight.status)
          const isExpanded = expandedInsights.has(insight.id)

          return (
            <div
              key={insight.id}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: `1px solid ${statusStyles.borderColor}`,
                borderRadius: '12px',
                overflow: 'hidden',
                transition: 'all 0.2s ease'
              }}
            >
              {/* Insight Header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '1rem',
                  cursor: insight.expandable ? 'pointer' : 'default'
                }}
                onClick={() => insight.expandable && onToggle(insight.id)}
              >
                {/* Status Icon */}
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: statusStyles.iconColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  color: 'white'
                }}>
                  {statusStyles.icon}
                </div>

                {/* Title */}
                <div style={{
                  flex: 1,
                  fontSize: '0.95rem',
                  fontWeight: '500',
                  color: 'white'
                }}>
                  {insight.title}
                </div>

                {/* Expand Icon */}
                {insight.expandable && (
                  <div style={{
                    fontSize: '0.875rem',
                    color: 'rgba(255, 255, 255, 0.6)',
                    transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease'
                  }}>
                    ▼
                  </div>
                )}
              </div>

              {/* Expandable Details */}
              {insight.expandable && isExpanded && insight.details && (
                <div style={{
                  padding: '0 1rem 1rem 1rem',
                  borderTop: `1px solid ${statusStyles.borderColor}`,
                  animation: 'expandIn 0.2s ease'
                }}>
                  <ul style={{
                    margin: 0,
                    paddingLeft: '1.5rem',
                    fontSize: '0.875rem',
                    color: 'rgba(255, 255, 255, 0.8)',
                    lineHeight: '1.5'
                  }}>
                    {insight.details.map((detail, index) => (
                      <li key={index} style={{ marginBottom: '0.5rem' }}>
                        {detail}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Generate insights from stock data
export const generateInsights = (stockData: EnhancedStockResult): Insight[] => {
  const insights: Insight[] = []

  // Why This Recommendation
  insights.push({
    id: 'recommendation-reason',
    title: 'Why This Recommendation',
    status: 'neutral',
    expandable: true,
    icon: '💡',
    details: stockData.reasoning.primaryFactors
  })

  // Technical Analysis Insights
  if (stockData.score.technical > 0.7) {
    insights.push({
      id: 'technical-positive',
      title: 'Trading above key price levels',
      status: 'positive',
      expandable: false,
      icon: '📈'
    })
  }

  // Fundamental Insights
  if (stockData.score.fundamental > 0.6) {
    insights.push({
      id: 'fundamental-growth',
      title: 'Strong earnings growth momentum',
      status: 'positive',
      expandable: false,
      icon: '💰'
    })
  }

  // Sentiment Insights
  if (stockData.score.sentiment > 0.5) {
    insights.push({
      id: 'sentiment-positive',
      title: 'Positive analyst sentiment',
      status: 'positive',
      expandable: true,
      icon: '👍',
      details: [
        'Recent analyst upgrades detected',
        'Social media sentiment trending positive',
        'Institutional buying pressure observed'
      ]
    })
  }

  return insights
}

// CSS for expand animation
const expandStyles = `
@keyframes expandIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
`
```

### 5. Dialog Footer with Actions

```tsx
// /app/components/stock-analysis/DialogFooter.tsx
interface DialogFooterProps {
  lastUpdated: number
  onAction?: (action: 'BUY' | 'SELL' | 'HOLD', symbol: string) => void
  symbol: string
  recommendation: 'BUY' | 'SELL' | 'HOLD'
}

export const DialogFooter = ({
  lastUpdated,
  onAction,
  symbol,
  recommendation
}: DialogFooterProps) => {
  const formatTimeAgo = (timestamp: number) => {
    const minutes = Math.floor((Date.now() - timestamp) / 1000 / 60)
    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes} min ago`
    const hours = Math.floor(minutes / 60)
    return `${hours}h ${minutes % 60}m ago`
  }

  const handleActionClick = (action: 'BUY' | 'SELL' | 'HOLD') => {
    if (onAction) {
      onAction(action, symbol)
    }
  }

  return (
    <div className="dialog-footer" style={{
      paddingTop: '2rem',
      borderTop: '1px solid rgba(255, 255, 255, 0.1)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }}>
      {/* Last Updated */}
      <div style={{
        fontSize: '0.875rem',
        color: 'rgba(255, 255, 255, 0.6)'
      }}>
        Last updated: {formatTimeAgo(lastUpdated)}
      </div>

      {/* Action Buttons */}
      {onAction && (
        <div style={{
          display: 'flex',
          gap: '0.75rem'
        }}>
          <ActionButton
            action="BUY"
            isRecommended={recommendation === 'BUY'}
            onClick={() => handleActionClick('BUY')}
          />
          <ActionButton
            action="HOLD"
            isRecommended={recommendation === 'HOLD'}
            onClick={() => handleActionClick('HOLD')}
          />
          <ActionButton
            action="SELL"
            isRecommended={recommendation === 'SELL'}
            onClick={() => handleActionClick('SELL')}
          />
        </div>
      )}
    </div>
  )
}

// Action Button Component
const ActionButton = ({
  action,
  isRecommended,
  onClick
}: {
  action: 'BUY' | 'SELL' | 'HOLD'
  isRecommended: boolean
  onClick: () => void
}) => {
  const getActionStyles = () => {
    const baseStyles = {
      padding: '0.5rem 1rem',
      borderRadius: '8px',
      fontSize: '0.875rem',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      border: '1px solid transparent'
    }

    if (isRecommended) {
      const recommendedStyles = {
        BUY: {
          ...baseStyles,
          background: 'linear-gradient(135deg, rgba(0, 200, 83, 0.9), rgba(0, 150, 60, 0.9))',
          color: 'white',
          border: '1px solid rgba(0, 200, 83, 0.5)'
        },
        SELL: {
          ...baseStyles,
          background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.9), rgba(200, 40, 40, 0.9))',
          color: 'white',
          border: '1px solid rgba(239, 68, 68, 0.5)'
        },
        HOLD: {
          ...baseStyles,
          background: 'linear-gradient(135deg, rgba(255, 193, 7, 0.9), rgba(200, 150, 0, 0.9))',
          color: 'white',
          border: '1px solid rgba(255, 193, 7, 0.5)'
        }
      }
      return recommendedStyles[action]
    }

    return {
      ...baseStyles,
      background: 'rgba(255, 255, 255, 0.1)',
      color: 'rgba(255, 255, 255, 0.8)',
      border: '1px solid rgba(255, 255, 255, 0.2)'
    }
  }

  return (
    <button
      style={getActionStyles()}
      onClick={onClick}
      onMouseEnter={(e) => {
        if (!isRecommended) {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'
        }
      }}
      onMouseLeave={(e) => {
        if (!isRecommended) {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
        }
      }}
    >
      {action}
    </button>
  )
}
```

## Integration with Existing Results Display

### Modify existing results to show dialogs on click:

```tsx
// In your existing results component (/app/stock-intelligence/page.tsx)
const [dialogOpen, setDialogOpen] = useState<string | null>(null)

// Replace the existing stock result cards with clickable ones:
<div
  key={stock.symbol}
  style={{
    // ... existing styles ...
    cursor: 'pointer'
  }}
  onClick={() => setDialogOpen(stock.symbol)}
  // ... rest of existing card JSX
>

// Add dialog at the end of your component:
{dialogOpen && (
  <InteractiveStockDialog
    symbol={dialogOpen}
    isOpen={true}
    onClose={() => setDialogOpen(null)}
    onActionTaken={(action, symbol) => {
      console.log(`${action} action taken for ${symbol}`)
      // Handle action (could integrate with portfolio management)
    }}
  />
)}
```

This implementation guide provides production-ready code templates that integrate seamlessly with your existing VFR platform architecture while delivering the interactive stock dialog experience described in the user requirements.