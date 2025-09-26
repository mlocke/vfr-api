/**
 * SimplifiedDialogExample - Integration Example
 * Shows how to replace the crashing StockAnalysisDialog with the simplified version
 */

'use client'

import React, { useState } from 'react'
import { SimplifiedStockAnalysisDialog } from './SimplifiedStockAnalysisDialog'

// Example usage component
const SimplifiedDialogExample: React.FC = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [analysisData, setAnalysisData] = useState<any>(null)
  const [currentSymbol, setCurrentSymbol] = useState('')

  // Example function to load analysis data
  const loadAnalysisData = async (symbol: string) => {
    try {
      console.log(`Loading analysis for ${symbol}...`)

      // Try to load the latest analysis data
      const response = await fetch('/analysis-results/latest-analysis.json')
      if (response.ok) {
        const data = await response.json()
        setAnalysisData(data)
        setCurrentSymbol(symbol)
        setIsDialogOpen(true)
        console.log('✅ Analysis data loaded successfully')
      } else {
        console.warn('⚠️ Could not load latest analysis, using fallback')
        // Use minimal fallback data
        setAnalysisData({
          results: {
            topSelections: [{
              symbol: symbol,
              action: 'HOLD',
              confidence: 0.6,
              score: {
                overallScore: 0.65,
                factorScores: {
                  composite: 0.6,
                  technical_overall_score: 0.7,
                  momentum_composite: 0.65,
                  volatility_30d: 0.5,
                  sentiment_composite: 0.55
                },
                marketData: {
                  price: 100.00,
                  volume: 1000000,
                  sector: 'Technology',
                  exchange: 'NASDAQ'
                }
              },
              context: {
                marketCap: 50000000000,
                priceChange24h: 2.5
              },
              reasoning: {
                primaryFactors: ['Technical analysis', 'Market momentum'],
                opportunities: ['Strong technical indicators'],
                warnings: ['Market volatility risk']
              }
            }]
          }
        })
        setCurrentSymbol(symbol)
        setIsDialogOpen(true)
      }
    } catch (error) {
      console.error('❌ Error loading analysis:', error)

      // Even if everything fails, show a basic dialog
      setAnalysisData({
        results: {
          topSelections: [{
            symbol: symbol,
            action: 'HOLD',
            confidence: 0.5,
            score: { overallScore: 0.5, factorScores: {} },
            context: {},
            reasoning: { primaryFactors: [], opportunities: [], warnings: [] }
          }]
        }
      })
      setCurrentSymbol(symbol)
      setIsDialogOpen(true)
    }
  }

  // Handle action taken
  const handleActionTaken = (action: 'BUY' | 'SELL' | 'HOLD', symbol: string) => {
    console.log(`Action taken: ${action} for ${symbol}`)
    // Add your action handling logic here
    // e.g., save to portfolio, execute trade, etc.

    // Close dialog after action
    setIsDialogOpen(false)
  }

  // Handle dialog close
  const handleDialogClose = () => {
    console.log('Dialog closed')
    setIsDialogOpen(false)
  }

  return (
    <div style={{ padding: '20px' }}>
      <h2 style={{ color: 'white', marginBottom: '20px' }}>
        Simplified Stock Analysis Dialog Example
      </h2>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button
          onClick={() => loadAnalysisData('AAPL')}
          style={{
            padding: '10px 20px',
            background: 'rgba(0, 200, 83, 0.2)',
            border: '1px solid rgba(0, 200, 83, 0.4)',
            borderRadius: '8px',
            color: 'white',
            cursor: 'pointer'
          }}
        >
          Analyze AAPL
        </button>

        <button
          onClick={() => loadAnalysisData('TSLA')}
          style={{
            padding: '10px 20px',
            background: 'rgba(0, 200, 83, 0.2)',
            border: '1px solid rgba(0, 200, 83, 0.4)',
            borderRadius: '8px',
            color: 'white',
            cursor: 'pointer'
          }}
        >
          Analyze TSLA
        </button>

        <button
          onClick={() => loadAnalysisData('MSFT')}
          style={{
            padding: '10px 20px',
            background: 'rgba(0, 200, 83, 0.2)',
            border: '1px solid rgba(0, 200, 83, 0.4)',
            borderRadius: '8px',
            color: 'white',
            cursor: 'pointer'
          }}
        >
          Analyze MSFT
        </button>
      </div>

      <div style={{
        background: 'rgba(255, 255, 255, 0.05)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '8px',
        padding: '16px',
        color: 'rgba(255, 255, 255, 0.8)',
        fontSize: '14px',
        lineHeight: '1.5'
      }}>
        <h3 style={{ color: 'white', margin: '0 0 10px 0' }}>
          ✅ Crash-Resistant Features:
        </h3>
        <ul style={{ margin: '0', paddingLeft: '20px' }}>
          <li>Safe data extraction with fallbacks for all properties</li>
          <li>No complex animations or heavy UI components</li>
          <li>Comprehensive error handling and graceful degradation</li>
          <li>Simple static layout that won't break during rendering</li>
          <li>Minimal dependencies and no external component libraries</li>
          <li>Built-in fallback data when analysis fails to load</li>
          <li>Defensive programming patterns throughout</li>
        </ul>
      </div>

      {/* Simplified Analysis Dialog */}
      {analysisData && (
        <SimplifiedStockAnalysisDialog
          symbol={currentSymbol}
          analysisData={analysisData}
          isOpen={isDialogOpen}
          onClose={handleDialogClose}
          onActionTaken={handleActionTaken}
        />
      )}
    </div>
  )
}

export default SimplifiedDialogExample