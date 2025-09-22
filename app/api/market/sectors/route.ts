/**
 * Market Sectors API Route
 * Provides sector performance data using MarketIndicesService
 */

import { NextRequest, NextResponse } from 'next/server'
import { MarketIndicesService } from '../../../services/financial-data/MarketIndicesService'
import ErrorHandler from '../../../services/error-handling/ErrorHandler'

const marketIndicesService = new MarketIndicesService()

export async function GET(request: NextRequest) {
  try {
    const marketData = await marketIndicesService.getAllIndices()

    // Transform sector data for the rotation wheel
    const sectors = [
      {
        symbol: 'XLK',
        name: 'Technology',
        performance: marketData.sectors.xlk?.changePercent || 0,
        volume: 25000000,
        marketCap: 180000000000,
        momentum: getMomentum(marketData.sectors.xlk?.changePercent || 0)
      },
      {
        symbol: 'XLF',
        name: 'Financials',
        performance: marketData.sectors.xlf?.changePercent || 0,
        volume: 18000000,
        marketCap: 140000000000,
        momentum: getMomentum(marketData.sectors.xlf?.changePercent || 0)
      },
      {
        symbol: 'XLV',
        name: 'Healthcare',
        performance: marketData.sectors.xlv?.changePercent || 0,
        volume: 12000000,
        marketCap: 160000000000,
        momentum: getMomentum(marketData.sectors.xlv?.changePercent || 0)
      },
      {
        symbol: 'XLE',
        name: 'Energy',
        performance: marketData.sectors.xle?.changePercent || 0,
        volume: 22000000,
        marketCap: 95000000000,
        momentum: getMomentum(marketData.sectors.xle?.changePercent || 0)
      },
      {
        symbol: 'XLI',
        name: 'Industrials',
        performance: marketData.sectors.xli?.changePercent || 0,
        volume: 15000000,
        marketCap: 130000000000,
        momentum: getMomentum(marketData.sectors.xli?.changePercent || 0)
      },
      {
        symbol: 'XLC',
        name: 'Communication',
        performance: marketData.sectors.xlc?.changePercent || 0,
        volume: 14000000,
        marketCap: 120000000000,
        momentum: getMomentum(marketData.sectors.xlc?.changePercent || 0)
      },
      {
        symbol: 'XLY',
        name: 'Consumer Discr.',
        performance: marketData.sectors.xly?.changePercent || 0,
        volume: 16000000,
        marketCap: 110000000000,
        momentum: getMomentum(marketData.sectors.xly?.changePercent || 0)
      },
      {
        symbol: 'XLP',
        name: 'Consumer Staples',
        performance: marketData.sectors.xlp?.changePercent || 0,
        volume: 11000000,
        marketCap: 90000000000,
        momentum: getMomentum(marketData.sectors.xlp?.changePercent || 0)
      }
    ]

    return NextResponse.json(
      {
        sectors,
        timestamp: new Date().toISOString(),
        dataQuality: marketData.dataQuality,
        source: 'Market Indices Service'
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, max-age=120, stale-while-revalidate=60', // 2-minute cache
          'Content-Type': 'application/json'
        }
      }
    )

  } catch (error) {
    console.error('MarketSectorsAPI.GET error:', error)

    return NextResponse.json(
      {
        error: 'Failed to retrieve sector data',
        message: 'Unable to fetch current sector performance. Please try again later.',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

function getMomentum(performance: number): 'strong-up' | 'up' | 'neutral' | 'down' | 'strong-down' {
  if (performance >= 2) return 'strong-up'
  if (performance >= 0.5) return 'up'
  if (performance >= -0.5) return 'neutral'
  if (performance >= -2) return 'down'
  return 'strong-down'
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