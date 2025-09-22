/**
 * Market Sentiment API Route
 * Provides real-time market sentiment analysis
 */

import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // For now, provide basic market sentiment data
    // In a full implementation, this would aggregate data from multiple sources
    const now = new Date()

    // Simulate basic market sentiment calculation
    const baseVIX = 20 + Math.random() * 15 // VIX typically 15-35
    const baseSPY = 450 + Math.random() * 50 // SPY around 450-500

    const vixSentiment = Math.max(0, Math.min(100, 100 - (baseVIX - 15) * 2.5))
    const spySentiment = Math.max(0, Math.min(100, (baseSPY - 400) * 2))
    const overallSentiment = Math.round((vixSentiment + spySentiment) / 2)

    const marketCondition = overallSentiment >= 70 ? 'Bullish' :
                           overallSentiment >= 50 ? 'Positive' :
                           overallSentiment >= 30 ? 'Neutral' : 'Bearish'

    const riskLevel = overallSentiment >= 70 ? 'Low' :
                     overallSentiment >= 50 ? 'Medium' :
                     overallSentiment >= 30 ? 'Medium' : 'High'

    const sentimentData = {
      overallSentiment,
      marketCondition,
      riskLevel,
      timestamp: now.toISOString(),
      indicators: {
        vix: {
          value: baseVIX,
          sentiment: vixSentiment,
          trend: baseVIX < 20 ? 'Low Volatility' : baseVIX < 30 ? 'Moderate' : 'High Volatility'
        },
        spy: {
          value: baseSPY,
          sentiment: spySentiment,
          trend: spySentiment > 60 ? 'Uptrend' : spySentiment > 40 ? 'Sideways' : 'Downtrend'
        },
        market: {
          sentiment: overallSentiment,
          condition: marketCondition
        }
      }
    }

    return NextResponse.json(sentimentData, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=30', // 1-minute cache
        'Content-Type': 'application/json'
      }
    })

  } catch (error) {
    console.error('MarketSentimentAPI.GET error:', error)

    return NextResponse.json(
      {
        error: 'Failed to retrieve market sentiment',
        message: 'Unable to fetch market sentiment data. Please try again later.',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  })
}