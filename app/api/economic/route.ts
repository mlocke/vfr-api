/**
 * Economic Data API Endpoint
 * Provides access to government economic data via BLS API integration
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { BLSAPI } from '../../services/financial-data/BLSAPI'

// Request validation schema
const RequestSchema = z.object({
  type: z.enum(['bls_indicator', 'bls_indicators', 'bls_tier1', 'bls_tier2', 'bls_multiple']),
  symbol: z.string().optional(),
  symbols: z.array(z.string()).optional(),
  startYear: z.number().optional(),
  endYear: z.number().optional()
})

/**
 * GET endpoint for economic data
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url)

    // Health check endpoint
    if (searchParams.get('health') === 'true') {
      const blsAPI = new BLSAPI()
      const blsHealthy = await blsAPI.healthCheck()

      return NextResponse.json({
        success: true,
        data: {
          healthy: blsHealthy,
          service: 'BLS API',
          timestamp: Date.now()
        }
      })
    }

    // BLS Tier 1 indicators
    if (searchParams.get('bls_tier1') === 'true') {
      const blsAPI = new BLSAPI()
      const indicators = blsAPI.getTier1Indicators()
      return NextResponse.json({
        success: true,
        data: {
          indicators,
          tier: 'Tier 1 - Core Economic Indicators',
          count: indicators.length,
          timestamp: Date.now()
        }
      })
    }

    // BLS Tier 2 indicators
    if (searchParams.get('bls_tier2') === 'true') {
      const blsAPI = new BLSAPI()
      const indicators = blsAPI.getTier2Indicators()
      return NextResponse.json({
        success: true,
        data: {
          indicators,
          tier: 'Tier 2 - Market Sentiment Indicators',
          count: indicators.length,
          timestamp: Date.now()
        }
      })
    }

    // All BLS indicators organized by tier
    if (searchParams.get('bls_indicators') === 'true') {
      const blsAPI = new BLSAPI()
      const indicatorsByTier = blsAPI.getIndicatorsByTier()
      return NextResponse.json({
        success: true,
        data: {
          ...indicatorsByTier,
          total: indicatorsByTier.tier1.length + indicatorsByTier.tier2.length,
          timestamp: Date.now()
        }
      })
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid request. Available endpoints: ?health=true, ?bls_tier1=true, ?bls_tier2=true, ?bls_indicators=true'
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
    const { type, symbol, symbols, startYear, endYear } = RequestSchema.parse(body)

    switch (type) {

      case 'bls_indicator': {
        if (!symbol) {
          return NextResponse.json({
            success: false,
            error: 'Symbol is required for BLS indicator type'
          }, { status: 400 })
        }

        const blsAPI = new BLSAPI()
        const [stockData, marketData, companyInfo, latestData] = await Promise.all([
          blsAPI.getStockPrice(symbol),
          blsAPI.getMarketData(symbol),
          blsAPI.getCompanyInfo(symbol),
          blsAPI.getLatestObservation(symbol)
        ])

        return NextResponse.json({
          success: true,
          data: {
            indicator: symbol,
            current: stockData,
            market: marketData,
            info: companyInfo,
            latest: latestData,
            source: 'bls',
            timestamp: Date.now()
          }
        })
      }

      case 'bls_multiple': {
        if (!symbols || symbols.length === 0) {
          return NextResponse.json({
            success: false,
            error: 'Symbols array is required for BLS multiple type'
          }, { status: 400 })
        }

        const blsAPI = new BLSAPI()
        const seriesData = await blsAPI.getMultipleSeries(symbols, startYear, endYear)

        const results: any = {}
        seriesData.forEach((data, seriesId) => {
          results[seriesId] = {
            seriesId,
            data,
            latestValue: data.length > 0 ? data[0].value : null,
            dataPoints: data.length
          }
        })

        return NextResponse.json({
          success: true,
          data: {
            series: results,
            requested: symbols,
            found: Array.from(seriesData.keys()),
            source: 'bls',
            timestamp: Date.now()
          }
        })
      }

      case 'bls_tier1': {
        const blsAPI = new BLSAPI()
        const tier1Indicators = blsAPI.getTier1Indicators()
        const seriesIds = tier1Indicators.map(indicator => indicator.symbol)
        const seriesData = await blsAPI.getMultipleSeries(seriesIds, startYear, endYear)

        const results = tier1Indicators.map(indicator => ({
          ...indicator,
          data: seriesData.get(indicator.symbol) || [],
          latestValue: seriesData.get(indicator.symbol)?.[0]?.value || null
        }))

        return NextResponse.json({
          success: true,
          data: {
            tier: 'Tier 1 - Core Economic Indicators',
            indicators: results,
            count: results.length,
            source: 'bls',
            timestamp: Date.now()
          }
        })
      }

      case 'bls_tier2': {
        const blsAPI = new BLSAPI()
        const tier2Indicators = blsAPI.getTier2Indicators()
        const seriesIds = tier2Indicators.map(indicator => indicator.symbol)
        const seriesData = await blsAPI.getMultipleSeries(seriesIds, startYear, endYear)

        const results = tier2Indicators.map(indicator => ({
          ...indicator,
          data: seriesData.get(indicator.symbol) || [],
          latestValue: seriesData.get(indicator.symbol)?.[0]?.value || null
        }))

        return NextResponse.json({
          success: true,
          data: {
            tier: 'Tier 2 - Market Sentiment Indicators',
            indicators: results,
            count: results.length,
            source: 'bls',
            timestamp: Date.now()
          }
        })
      }


      case 'bls_indicators': {
        const blsAPI = new BLSAPI()
        const indicatorsByTier = blsAPI.getIndicatorsByTier()

        return NextResponse.json({
          success: true,
          data: {
            ...indicatorsByTier,
            total: indicatorsByTier.tier1.length + indicatorsByTier.tier2.length,
            source: 'bls',
            timestamp: Date.now()
          }
        })
      }

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid type. Available types: bls_indicator, bls_multiple, bls_tier1, bls_tier2, bls_indicators'
        }, { status: 400 })
    }

  } catch (error) {
    console.error('Economic data POST error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request format',
        details: error.issues
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