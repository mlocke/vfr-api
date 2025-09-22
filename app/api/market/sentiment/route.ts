/**
 * Market Sentiment API Route
 * Provides real-time market sentiment data from free sources
 */

import { NextRequest, NextResponse } from 'next/server'
import { MarketSentimentService } from '../../../services/financial-data/MarketSentimentService'
import ErrorHandler from '../../../services/error-handling/ErrorHandler'

const sentimentService = new MarketSentimentService()

export async function GET(request: NextRequest) {
  try {
    const sentimentData = await sentimentService.getMarketSentiment()

    return NextResponse.json(sentimentData, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=30',
        'Content-Type': 'application/json'
      }
    })

  } catch (error) {
    console.error('MarketSentimentAPI.GET error:', error)

    return NextResponse.json(
      {
        error: 'Failed to retrieve market sentiment data',
        message: 'Unable to fetch current market sentiment. Please try again later.',
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