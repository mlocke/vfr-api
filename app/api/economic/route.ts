/**
 * Economic Data API Endpoint
 * Provides access to government economic data via Data.gov integration
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { DataGovAPI } from '../../services/financial-data/DataGovAPI'

// Request validation schema
const RequestSchema = z.object({
  type: z.enum(['indicator', 'search', 'indicators_list']),
  symbol: z.string().optional(),
  query: z.string().optional(),
  tags: z.string().optional(),
  dataset: z.string().optional()
})

/**
 * GET endpoint for economic data
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const dataGovAPI = new DataGovAPI()

    // Health check endpoint
    const { searchParams } = new URL(request.url)

    if (searchParams.get('health') === 'true') {
      const isHealthy = await dataGovAPI.healthCheck()
      return NextResponse.json({
        success: true,
        data: {
          healthy: isHealthy,
          service: 'Data.gov API',
          timestamp: Date.now()
        }
      })
    }

    // Get list of available economic indicators
    if (searchParams.get('indicators') === 'true') {
      const indicators = await dataGovAPI.getEconomicIndicators()
      return NextResponse.json({
        success: true,
        data: {
          indicators,
          count: indicators.length,
          timestamp: Date.now()
        }
      })
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid request. Use ?health=true or ?indicators=true'
    }, { status: 400 })

  } catch (error) {
    console.error('Economic data GET error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 })
  }
}

/**
 * POST endpoint for economic data queries
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Parse and validate request
    const body = await request.json()
    const { type, symbol, query, tags, dataset } = RequestSchema.parse(body)

    const dataGovAPI = new DataGovAPI()

    switch (type) {
      case 'indicator': {
        if (!symbol) {
          return NextResponse.json({
            success: false,
            error: 'Symbol is required for indicator type'
          }, { status: 400 })
        }

        const [stockData, marketData, companyInfo] = await Promise.all([
          dataGovAPI.getStockPrice(symbol),
          dataGovAPI.getMarketData(symbol),
          dataGovAPI.getCompanyInfo(symbol)
        ])

        return NextResponse.json({
          success: true,
          data: {
            indicator: symbol,
            current: stockData,
            market: marketData,
            info: companyInfo,
            timestamp: Date.now()
          }
        })
      }

      case 'search': {
        if (!query) {
          return NextResponse.json({
            success: false,
            error: 'Query is required for search type'
          }, { status: 400 })
        }

        const results = await dataGovAPI.searchDatasets(query, tags)

        return NextResponse.json({
          success: true,
          data: {
            query,
            tags,
            results,
            count: results.length,
            timestamp: Date.now()
          }
        })
      }

      case 'indicators_list': {
        const indicators = await dataGovAPI.getEconomicIndicators()

        return NextResponse.json({
          success: true,
          data: {
            indicators,
            count: indicators.length,
            timestamp: Date.now()
          }
        })
      }

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid type'
        }, { status: 400 })
    }

  } catch (error) {
    console.error('Economic data POST error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request format',
        details: error.errors
      }, { status: 400 })
    }

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 })
  }
}

/**
 * OPTIONS endpoint for CORS
 */
export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}