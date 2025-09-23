/**
 * Market Sectors API Route
 * Provides real sector performance data using sector ETFs
 */

import { NextRequest, NextResponse } from 'next/server'
import { SectorDataService } from '../../../services/financial-data/SectorDataService'
import ErrorHandler from '../../../services/error-handling/ErrorHandler'

export async function GET(request: NextRequest) {
  try {
    const sectorService = new SectorDataService()
    const sectorData = await sectorService.getSectorData()

    return NextResponse.json(
      sectorData,
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

    // Return empty data with 200 status to avoid frontend errors
    return NextResponse.json(
      {
        sectors: [],
        timestamp: new Date().toISOString(),
        dataQuality: 'unavailable',
        source: 'None - All APIs failed',
        apiStatus: {
          polygon: false,
          alphaVantage: false,
          yahooFinance: false,
          fmp: false
        },
        errors: ['All data sources are currently unavailable']
      },
      { status: 200 }
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