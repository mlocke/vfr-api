/**
 * StockAnalysisDialog - Interactive Stock Analysis Modal
 * Displays comprehensive analysis data from the backend
 * Enhanced with integrated child components and error boundaries
 */

'use client'

import React, { useEffect, useState } from 'react'
import ErrorBoundary from './components/ErrorBoundary'
import { ScoreVisualization } from './components/ScoreVisualization'
import { QuickInsights } from './components/QuickInsights'
import { RisksOpportunities } from './components/RisksOpportunities'
import { DialogFooter } from './components/DialogFooter'
import {
  transformToDialogStockData,
  transformToScoreVisualizationProps,
  transformToRisksOpportunitiesProps,
  transformToDialogFooterProps,
  validateStockData,
  createFallbackStockData
} from './utils/dataTransformers'

interface DetailedStockResult {
  symbol: string
  score: {
    symbol: string
    overallScore: number
    factorScores: {
      composite: number
      technical_overall_score: number
      quality_composite: number
      momentum_composite: number
      value_composite: number
      volatility_30d: number
      sentiment_composite: number
      vwap_deviation_score: number
      vwap_trading_signals: number
      macroeconomic_sector_impact: number
      macroeconomic_composite: number
    }
    dataQuality: {
      overall: number
      metrics: {
        freshness: number
        completeness: number
        accuracy: number
        sourceReputation: number
        latency: number
      }
      timestamp: number
      source: string
    }
    timestamp: number
    marketData: {
      price: number
      volume: number
      marketCap: number
      sector: string
      exchange: string
    }
    algorithmMetrics: {
      quality: {
        score: number
      }
    }
  }
  weight: number
  action: 'BUY' | 'SELL' | 'HOLD'
  confidence: number
  context: {
    sector: string
    marketCap: number
    priceChange24h?: number
    volumeChange24h?: number
    beta?: number
  }
  reasoning: {
    primaryFactors: string[]
    warnings?: string[]
    opportunities?: string[]
  }
  dataQuality: {
    overall: {
      overall: number
      metrics: {
        freshness: number
        completeness: number
        accuracy: number
        sourceReputation: number
        latency: number
      }
      timestamp: number
      source: string
    }
    sourceBreakdown?: {
      stockPrice?: string
      companyInfo?: string
      marketData?: string
      fundamentalRatios?: string
      analystRatings?: string
      priceTargets?: string
      vwapAnalysis?: string
      extendedHoursData?: string
    }
    lastUpdated: number
  }
}

// Analysis Services Interface
interface AnalysisServices {
  [key: string]: {
    enabled: boolean
    status: string
    description: string
    components: {
      [key: string]: any
    }
    utilizationInResults: string
    weightInCompositeScore?: string
  }
}

interface StockAnalysisDialogProps {
  symbol: string
  stockData: DetailedStockResult
  analysisServices?: AnalysisServices
  isOpen: boolean
  onClose: () => void
  onActionTaken?: (action: 'BUY' | 'SELL' | 'HOLD', symbol: string) => void
}

export const StockAnalysisDialog: React.FC<StockAnalysisDialogProps> = React.memo(({
  symbol,
  stockData,
  analysisServices,
  isOpen,
  onClose,
  onActionTaken
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'scores' | 'analysis' | 'services' | 'technical'>('overview')
  const [expandedInsights, setExpandedInsights] = useState<Set<string>>(new Set())
  const [risksOpportunitiesExpanded, setRisksOpportunitiesExpanded] = useState(false)

  // Validate and transform data with performance optimization
  const validatedStockData = React.useMemo(() => {
    if (validateStockData(stockData)) {
      return stockData
    } else {
      console.warn('Invalid stock data provided, using fallback')
      return createFallbackStockData(symbol)
    }
  }, [stockData, symbol])

  // Transform data for child components
  const dialogStockData = React.useMemo(() =>
    transformToDialogStockData(validatedStockData), [validatedStockData])
  const scoreVisualizationProps = React.useMemo(() =>
    transformToScoreVisualizationProps(validatedStockData), [validatedStockData])
  const risksOpportunitiesProps = React.useMemo(() =>
    transformToRisksOpportunitiesProps(validatedStockData), [validatedStockData])
  const dialogFooterProps = React.useMemo(() =>
    transformToDialogFooterProps(validatedStockData, onActionTaken, onClose), [validatedStockData, onActionTaken, onClose])

  // Handle insight expansion
  const handleInsightToggle = (insightId: string) => {
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

  // Add component mounted tracking
  React.useEffect(() => {
    console.log('🚀 StockAnalysisDialog MOUNTED for symbol:', symbol)
    console.log('🎯 Mounted with isOpen:', isOpen)

    return () => {
      console.log('💥 StockAnalysisDialog UNMOUNTING for symbol:', symbol)
    }
  }, [])

  // Add comprehensive logging to track component lifecycle
  console.log('💭 StockAnalysisDialog render start')
  console.log('📋 Props received:', {
    symbol,
    stockDataSymbol: stockData?.symbol,
    hasStockData: !!stockData,
    isOpen,
    hasAnalysisServices: !!analysisServices
  })
  console.log('📊 Full stockData:', JSON.stringify(stockData, null, 2))
  console.log('🔍 isOpen value type:', typeof isOpen, 'value:', isOpen)

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const handleActionClick = (action: 'BUY' | 'SELL' | 'HOLD') => {
    if (onActionTaken) {
      onActionTaken(action, symbol)
    }
  }

  // Helper functions for data formatting
  const formatScore = (score: number) => Math.round(score * 100)
  const formatCurrency = (value: number) => {
    if (value >= 1e12) return `$${(value / 1e12).toFixed(1)}T`
    if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`
    if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`
    if (value <= 0) return '$0.00'
    return `$${value.toFixed(2)}`
  }
  const formatPercent = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(2)}%`
  const formatNumber = (value: number) => value.toLocaleString()

  // Prevent body scroll when dialog is open
  useEffect(() => {
    console.log('🎯 useEffect for body scroll - isOpen:', isOpen)
    if (isOpen) {
      console.log('✅ Setting body overflow to hidden')
      document.body.style.overflow = 'hidden'

      // Check if dialog is actually in DOM
      const domCheckTimeout = setTimeout(() => {
        const dialogElements = document.querySelectorAll('[class*="dialog-backdrop"], [style*="backdrop"], [style*="z-index: 10000"]')
        console.log('🔍 DOM check - dialog elements found:', dialogElements.length)
        dialogElements.forEach((el, index) => {
          console.log(`  Dialog element ${index}:`, el.className, el.tagName)
        })

        // Check for our specific dialog
        const stockDialogs = document.querySelectorAll('[style*="zIndex: 10000"], [style*="z-index: 10000"]')
        console.log('📊 Stock dialog elements found:', stockDialogs.length)

        // Log body overflow state
        console.log('📋 Body overflow style:', document.body.style.overflow)
      }, 50)

      return () => {
        console.log('🔄 Cleaning up - restoring body overflow')
        clearTimeout(domCheckTimeout)
        document.body.style.overflow = ''
      }
    }
  }, [isOpen])

  // Add defensive effect to ensure cleanup on unmount
  useEffect(() => {
    return () => {
      // Ensure body scroll is restored on component unmount
      document.body.style.overflow = ''
      console.log('🧹 Dialog unmounted - body scroll restored')
    }
  }, [])

  // Don't render if not open
  if (!isOpen) {
    console.log('❌ StockAnalysisDialog NOT rendering - isOpen is false')
    console.log('🔍 isOpen value:', isOpen, 'type:', typeof isOpen)
    return null
  }

  console.log('✅ StockAnalysisDialog WILL render - isOpen is true')
  console.log('🎬 About to render dialog with symbol:', symbol)

  console.log('🎬 StockAnalysisDialog about to return JSX')
  console.log('🔍 Final render check:', {
    isOpen,
    symbol,
    stockDataExists: !!stockData,
    stockDataSymbol: stockData?.symbol
  })

  return (
    <>
      {/* CSS Animations */}
      <style jsx>{`
        @keyframes dialogFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes dialogSlideIn {
          from { opacity: 0; transform: scale(0.95) translateY(20px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .dialog-backdrop { animation: dialogFadeIn 0.3s ease-out; }
        .dialog-container { animation: dialogSlideIn 0.3s ease-out; }
      `}</style>

      {/* Dialog Backdrop */}
      <div
        onClick={handleBackdropClick}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '1rem'
        }}
        className="dialog-backdrop"
      >
        {/* Main Dialog Container */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="dialog-container"
          style={{
            background: 'linear-gradient(135deg, rgba(17, 24, 39, 0.98), rgba(31, 41, 55, 0.98))',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '2px solid rgba(0, 200, 83, 0.4)',
            borderRadius: '20px',
            padding: '0',
            maxWidth: '1100px',
            width: '100%',
            maxHeight: '95vh',
            overflowY: 'auto',
            overflowX: 'hidden',
            boxShadow: `
              0 25px 60px rgba(0, 0, 0, 0.6),
              0 0 30px rgba(0, 200, 83, 0.2),
              inset 0 1px 0 rgba(255, 255, 255, 0.1)
            `,
            position: 'relative'
          }}
        >
          {/* Header */}
          <div style={{
            padding: '2rem 2rem 1rem 2rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start'
          }}>
            <div>
              <h2 style={{
                fontSize: '2rem',
                fontWeight: '700',
                color: 'white',
                margin: '0 0 0.5rem 0',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                📊 {validatedStockData.symbol} Analysis
              </h2>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                fontSize: '1rem',
                color: 'rgba(255, 255, 255, 0.7)',
                flexWrap: 'wrap'
              }}>
                <span>{validatedStockData.score.marketData.sector}</span>
                <span>•</span>
                <span>${formatCurrency(validatedStockData.score.marketData.price)} Current Price</span>
                <span>•</span>
                <span>{formatNumber(validatedStockData.score.marketData.volume)} Volume</span>
                {validatedStockData.context.priceChange24h !== undefined && (
                  <>
                    <span>•</span>
                    <span style={{
                      color: validatedStockData.context.priceChange24h > 0 ? 'rgba(0, 200, 83, 0.9)' : 'rgba(239, 68, 68, 0.9)'
                    }}>
                      {formatPercent(validatedStockData.context.priceChange24h)}
                    </span>
                  </>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '2px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '50%',
                width: '48px',
                height: '48px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                fontSize: '1.5rem'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'
                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.5)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'
                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)'
              }}
            >
              ✕
            </button>
          </div>

          {/* Recommendation Badge */}
          <div style={{ padding: '0 2rem 1rem 2rem' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.75rem',
              background: validatedStockData.action === 'BUY' ? 'rgba(0, 200, 83, 0.15)' :
                         validatedStockData.action === 'SELL' ? 'rgba(239, 68, 68, 0.15)' :
                         'rgba(255, 193, 7, 0.15)',
              border: `2px solid ${validatedStockData.action === 'BUY' ? 'rgba(0, 200, 83, 0.4)' :
                                  validatedStockData.action === 'SELL' ? 'rgba(239, 68, 68, 0.4)' :
                                  'rgba(255, 193, 7, 0.4)'}`,
              borderRadius: '15px',
              padding: '1rem 1.5rem'
            }}>
              <div style={{
                fontSize: '2rem'
              }}>
                {validatedStockData.action === 'BUY' ? '🚀' : validatedStockData.action === 'SELL' ? '📉' : '⏸️'}
              </div>
              <div>
                <div style={{
                  fontSize: '1.3rem',
                  fontWeight: '700',
                  color: validatedStockData.action === 'BUY' ? 'rgba(0, 200, 83, 0.9)' :
                         validatedStockData.action === 'SELL' ? 'rgba(239, 68, 68, 0.9)' :
                         'rgba(255, 193, 7, 0.9)'
                }}>
                  {validatedStockData.action} Recommendation
                </div>
                <div style={{
                  fontSize: '1rem',
                  color: 'rgba(255, 255, 255, 0.7)'
                }}>
                  {formatScore(validatedStockData.confidence)}% Confidence • Overall Score: {formatScore(validatedStockData.score.overallScore)}/100
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div style={{ padding: '0 2rem 1rem 2rem' }}>
            <div style={{
              display: 'flex',
              gap: '0.5rem',
              overflowX: 'auto',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              paddingBottom: '1rem'
            }}>
              {[
                { key: 'overview', label: '📊 Overview', icon: '📊' },
                { key: 'scores', label: '🎯 Scores', icon: '🎯' },
                { key: 'analysis', label: '🔍 Analysis', icon: '🔍' },
                { key: 'technical', label: '📈 Technical', icon: '📈' },
                { key: 'services', label: '⚙️ Services', icon: '⚙️' }
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: activeTab === tab.key ?
                      'linear-gradient(135deg, rgba(0, 200, 83, 0.2), rgba(0, 150, 60, 0.2))' :
                      'rgba(255, 255, 255, 0.05)',
                    border: `2px solid ${activeTab === tab.key ? 'rgba(0, 200, 83, 0.5)' : 'rgba(255, 255, 255, 0.1)'}`,
                    borderRadius: '12px',
                    color: activeTab === tab.key ? 'rgba(0, 200, 83, 0.9)' : 'rgba(255, 255, 255, 0.7)',
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                  onMouseEnter={(e) => {
                    if (activeTab !== tab.key) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (activeTab !== tab.key) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
                    }
                  }}
                >
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.icon}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div style={{ padding: '1rem 2rem 2rem 2rem' }}>
            {activeTab === 'overview' && (
              <div>
                <h3 style={{
                  fontSize: '1.3rem',
                  fontWeight: '600',
                  color: 'white',
                  marginBottom: '1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  📊 Analysis Overview
                </h3>

                {/* Quick Insights Component */}
                <ErrorBoundary componentName="QuickInsights">
                  <QuickInsights
                    stockData={dialogStockData}
                    expandedInsights={expandedInsights}
                    onToggle={handleInsightToggle}
                  />
                </ErrorBoundary>

                {/* Risks & Opportunities Component */}
                <ErrorBoundary componentName="RisksOpportunities">
                  <RisksOpportunities
                    risks={risksOpportunitiesProps.risks}
                    opportunities={risksOpportunitiesProps.opportunities}
                    isExpanded={risksOpportunitiesExpanded}
                    onToggle={() => setRisksOpportunitiesExpanded(!risksOpportunitiesExpanded)}
                  />
                </ErrorBoundary>

                {/* Market Overview Card */}
                <div style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  marginBottom: '2rem'
                }}>
                  <h4 style={{
                    fontSize: '1.1rem',
                    fontWeight: '600',
                    color: 'white',
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    💰 Market Summary
                  </h4>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '0.75rem',
                    fontSize: '0.9rem',
                    color: 'rgba(255, 255, 255, 0.8)'
                  }}>
                    <div><strong>Price:</strong> {formatCurrency(validatedStockData.score.marketData.price)}</div>
                    <div><strong>Volume:</strong> {formatNumber(validatedStockData.score.marketData.volume)}</div>
                    <div><strong>Sector:</strong> {validatedStockData.score.marketData.sector}</div>
                    <div><strong>Exchange:</strong> {validatedStockData.score.marketData.exchange}</div>
                    <div><strong>Market Cap:</strong> {formatCurrency(validatedStockData.context.marketCap)}</div>
                    <div><strong>Overall Score:</strong> {formatScore(validatedStockData.score.overallScore)}/100</div>
                  </div>
                </div>

                {/* Components are rendered above this */}
              </div>
            )}

            {activeTab === 'scores' && (
              <div>
                <h3 style={{
                  fontSize: '1.3rem',
                  fontWeight: '600',
                  color: 'white',
                  marginBottom: '1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  🎯 Detailed Score Breakdown
                </h3>

                {/* Score Visualization Component */}
                <ErrorBoundary componentName="ScoreVisualization">
                  <ScoreVisualization
                    scores={scoreVisualizationProps.scores}
                    symbol={scoreVisualizationProps.symbol}
                  />
                </ErrorBoundary>

                {/* The ScoreVisualization component is now displayed above */}
                <div style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  textAlign: 'center'
                }}>
                  <p style={{
                    fontSize: '0.9rem',
                    color: 'rgba(255, 255, 255, 0.7)',
                    margin: 0,
                    lineHeight: '1.5'
                  }}>
                    The detailed score visualization above shows the comprehensive analysis
                    of {validatedStockData.symbol} across all key investment factors.
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'analysis' && (
              <div>
                <h3 style={{
                  fontSize: '1.3rem',
                  fontWeight: '600',
                  color: 'white',
                  marginBottom: '1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  🔍 Detailed Analysis
                </h3>

                {/* Primary Factors */}
                <div style={{
                  background: 'rgba(0, 200, 83, 0.1)',
                  border: '1px solid rgba(0, 200, 83, 0.3)',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  marginBottom: '1.5rem'
                }}>
                  <h4 style={{
                    fontSize: '1.1rem',
                    fontWeight: '600',
                    color: 'rgba(0, 200, 83, 0.9)',
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    📈 Key Analysis Points
                  </h4>
                  <ul style={{
                    margin: 0,
                    paddingLeft: '1.5rem',
                    color: 'rgba(255, 255, 255, 0.9)',
                    lineHeight: '1.6'
                  }}>
                    {stockData.reasoning.primaryFactors.map((factor, index) => (
                      <li key={index} style={{ marginBottom: '0.5rem' }}>
                        {factor.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Data Quality */}
                <div style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  marginBottom: '1.5rem'
                }}>
                  <h4 style={{
                    fontSize: '1.1rem',
                    fontWeight: '600',
                    color: 'white',
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    🔍 Data Quality Metrics
                  </h4>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '1rem',
                    fontSize: '0.9rem',
                    color: 'rgba(255, 255, 255, 0.8)'
                  }}>
                    <div>
                      <strong>Overall Quality:</strong> {formatScore(stockData.dataQuality.overall.overall)}/100
                    </div>
                    <div>
                      <strong>Freshness:</strong> {formatScore(stockData.dataQuality.overall.metrics.freshness)}/100
                    </div>
                    <div>
                      <strong>Completeness:</strong> {formatScore(stockData.dataQuality.overall.metrics.completeness)}/100
                    </div>
                    <div>
                      <strong>Accuracy:</strong> {formatScore(stockData.dataQuality.overall.metrics.accuracy)}/100
                    </div>
                    <div>
                      <strong>Source Reputation:</strong> {formatScore(stockData.dataQuality.overall.metrics.sourceReputation)}/100
                    </div>
                    <div>
                      <strong>Source:</strong> {stockData.dataQuality.overall.source}
                    </div>
                  </div>
                </div>

                {/* Data Sources */}
                {stockData.dataQuality.sourceBreakdown && (
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    padding: '1.5rem'
                  }}>
                    <h4 style={{
                      fontSize: '1.1rem',
                      fontWeight: '600',
                      color: 'white',
                      marginBottom: '1rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      🔗 Data Sources
                    </h4>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: '1rem',
                      fontSize: '0.9rem',
                      color: 'rgba(255, 255, 255, 0.8)'
                    }}>
                      {Object.entries(stockData.dataQuality.sourceBreakdown).map(([key, source]) => (
                        <div key={key}>
                          <strong>{key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:</strong>{' '}
                          <span style={{
                            color: source === 'available' ? 'rgba(0, 200, 83, 0.9)' :
                                   source === 'unavailable' ? 'rgba(239, 68, 68, 0.9)' :
                                   'rgba(255, 193, 7, 0.9)'
                          }}>
                            {source}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'technical' && (
              <div>
                <h3 style={{
                  fontSize: '1.3rem',
                  fontWeight: '600',
                  color: 'white',
                  marginBottom: '1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  📊 Technical Analysis
                </h3>

                {/* Technical Scores */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                  gap: '1rem',
                  marginBottom: '1.5rem'
                }}>
                  {/* Technical Overall */}
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    padding: '1.5rem'
                  }}>
                    <h4 style={{
                      fontSize: '1.1rem',
                      fontWeight: '600',
                      color: 'white',
                      marginBottom: '1rem'
                    }}>
                      📈 Technical Score
                    </h4>
                    <div style={{
                      fontSize: '1.8rem',
                      fontWeight: '700',
                      color: 'rgba(0, 200, 83, 0.9)',
                      marginBottom: '0.5rem'
                    }}>
                      {formatScore(stockData.score.factorScores.technical_overall_score)}/100
                    </div>
                    <div style={{
                      width: '100%',
                      height: '8px',
                      background: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: '4px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${stockData.score.factorScores.technical_overall_score * 100}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, rgba(0, 200, 83, 0.8), rgba(0, 200, 83, 1))',
                        borderRadius: '4px',
                        transition: 'width 0.6s ease'
                      }} />
                    </div>
                  </div>

                  {/* VWAP Analysis */}
                  <div style={{
                    background: 'rgba(255, 193, 7, 0.1)',
                    border: '1px solid rgba(255, 193, 7, 0.3)',
                    borderRadius: '12px',
                    padding: '1.5rem'
                  }}>
                    <h4 style={{
                      fontSize: '1.1rem',
                      fontWeight: '600',
                      color: 'rgba(255, 193, 7, 0.9)',
                      marginBottom: '1rem'
                    }}>
                      📊 VWAP Analysis
                    </h4>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '0.5rem',
                      fontSize: '0.9rem',
                      color: 'rgba(255, 255, 255, 0.8)'
                    }}>
                      <div>
                        <strong>Deviation:</strong> {formatScore(stockData.score.factorScores.vwap_deviation_score)}
                      </div>
                      <div>
                        <strong>Signals:</strong> {formatScore(stockData.score.factorScores.vwap_trading_signals)}
                      </div>
                    </div>
                  </div>

                  {/* Momentum */}
                  <div style={{
                    background: 'rgba(0, 200, 83, 0.1)',
                    border: '1px solid rgba(0, 200, 83, 0.3)',
                    borderRadius: '12px',
                    padding: '1.5rem'
                  }}>
                    <h4 style={{
                      fontSize: '1.1rem',
                      fontWeight: '600',
                      color: 'rgba(0, 200, 83, 0.9)',
                      marginBottom: '1rem'
                    }}>
                      🚀 Momentum
                    </h4>
                    <div style={{
                      fontSize: '1.8rem',
                      fontWeight: '700',
                      color: 'white',
                      marginBottom: '0.5rem'
                    }}>
                      {formatScore(stockData.score.factorScores.momentum_composite)}/100
                    </div>
                    <div style={{
                      fontSize: '0.9rem',
                      color: 'rgba(255, 255, 255, 0.7)'
                    }}>
                      Price momentum analysis
                    </div>
                  </div>

                  {/* Volatility */}
                  <div style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '12px',
                    padding: '1.5rem'
                  }}>
                    <h4 style={{
                      fontSize: '1.1rem',
                      fontWeight: '600',
                      color: 'rgba(239, 68, 68, 0.9)',
                      marginBottom: '1rem'
                    }}>
                      📉 Volatility (30D)
                    </h4>
                    <div style={{
                      fontSize: '1.8rem',
                      fontWeight: '700',
                      color: 'white',
                      marginBottom: '0.5rem'
                    }}>
                      {formatScore(stockData.score.factorScores.volatility_30d)}/100
                    </div>
                    <div style={{
                      fontSize: '0.9rem',
                      color: 'rgba(255, 255, 255, 0.7)'
                    }}>
                      30-day volatility measure
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'services' && analysisServices && (
              <div>
                <h3 style={{
                  fontSize: '1.3rem',
                  fontWeight: '600',
                  color: 'white',
                  marginBottom: '1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  ⚙️ Analysis Services
                </h3>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
                  gap: '1rem'
                }}>
                  {Object.entries(analysisServices).map(([serviceName, service]) => (
                    <div key={serviceName} style={{
                      background: service.enabled ? 'rgba(0, 200, 83, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                      border: `1px solid ${service.enabled ? 'rgba(0, 200, 83, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                      borderRadius: '12px',
                      padding: '1.5rem'
                    }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '1rem'
                      }}>
                        <h4 style={{
                          fontSize: '1.1rem',
                          fontWeight: '600',
                          color: service.enabled ? 'rgba(0, 200, 83, 0.9)' : 'rgba(239, 68, 68, 0.9)',
                          margin: 0,
                          textTransform: 'capitalize'
                        }}>
                          {serviceName.replace(/([A-Z])/g, ' $1')}
                        </h4>
                        <span style={{
                          padding: '0.25rem 0.5rem',
                          borderRadius: '6px',
                          fontSize: '0.7rem',
                          fontWeight: '600',
                          background: service.enabled ? 'rgba(0, 200, 83, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                          color: service.enabled ? 'rgba(0, 200, 83, 0.9)' : 'rgba(239, 68, 68, 0.9)'
                        }}>
                          {service.status.toUpperCase()}
                        </span>
                      </div>

                      <p style={{
                        fontSize: '0.85rem',
                        color: 'rgba(255, 255, 255, 0.7)',
                        marginBottom: '1rem',
                        lineHeight: '1.4'
                      }}>
                        {service.description}
                      </p>

                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '0.5rem',
                        fontSize: '0.8rem',
                        color: 'rgba(255, 255, 255, 0.6)',
                        marginBottom: '1rem'
                      }}>
                        <div>
                          <strong>Utilization:</strong> {service.utilizationInResults}
                        </div>
                        {service.weightInCompositeScore && (
                          <div>
                            <strong>Weight:</strong> {service.weightInCompositeScore}
                          </div>
                        )}
                      </div>

                      {/* Component Details */}
                      {Object.keys(service.components).length > 0 && (
                        <div style={{
                          background: 'rgba(255, 255, 255, 0.05)',
                          borderRadius: '8px',
                          padding: '1rem'
                        }}>
                          <h5 style={{
                            fontSize: '0.9rem',
                            fontWeight: '600',
                            color: 'rgba(255, 255, 255, 0.8)',
                            marginBottom: '0.5rem'
                          }}>
                            Components:
                          </h5>
                          <div style={{
                            fontSize: '0.75rem',
                            color: 'rgba(255, 255, 255, 0.6)',
                            lineHeight: '1.3'
                          }}>
                            {Object.entries(service.components).map(([key, value]) => (
                              <div key={key} style={{ marginBottom: '0.25rem' }}>
                                <strong>{key.replace(/([A-Z])/g, ' $1')}:</strong>{' '}
                                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Dialog Footer Component */}
          <ErrorBoundary componentName="DialogFooter">
            <DialogFooter
              lastUpdated={dialogFooterProps.lastUpdated}
              onAction={dialogFooterProps.onAction}
              symbol={dialogFooterProps.symbol}
              recommendation={dialogFooterProps.recommendation}
              onClose={dialogFooterProps.onClose}
            />
          </ErrorBoundary>
        </div>
      </div>
    </>
  )
})

export default StockAnalysisDialog