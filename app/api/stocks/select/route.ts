/**
 * Simplified Stock Selection API - KISS principles applied
 * Replaces the 836-line over-engineered route with simple, direct functionality
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { SimpleMCPClient, SimpleStockData, SimpleCompanyInfo } from '../../../services/mcp/SimpleMCPClient'

// Request validation - supports both test format and production format
const RequestSchema = z.object({
  mode: z.enum(['single', 'sector', 'multiple']),
  symbols: z.array(z.string()).optional(),
  sector: z.string().optional(),
  limit: z.number().min(1).max(50).default(10),
  config: z.object({
    symbol: z.string().optional(),
    preferredDataSources: z.array(z.string()).optional(),
    timeout: z.number().optional()
  }).optional()
})

// Simple response format
interface SimpleStockResponse {
  success: boolean
  data?: {
    stocks: SimpleStockData[]
    metadata: {
      mode: string
      count: number
      timestamp: number
      sources: string[]
    }
  }
  error?: string
}

/**
 * Main POST endpoint - simplified from 836 lines to ~100 lines
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Parse and validate request
    const body = await request.json()
    const { mode, symbols, sector, limit, config } = RequestSchema.parse(body)

    let stocks: SimpleStockData[] = []
    const sources = new Set<string>()

    // Handle test format where symbol is in config
    const symbolToUse = config?.symbol || symbols?.[0]
    const preferredSources = config?.preferredDataSources || []

    // Handle different selection modes
    switch (mode) {
      case 'single':
        if (!symbolToUse) {
          return NextResponse.json({
            success: false,
            error: 'Symbol required for single mode (in symbols array or config.symbol)'
          }, { status: 400 })
        }

        // Check if preferred data sources are disabled (for testing server toggle)
        if (preferredSources.length > 0) {
          const { serverConfigManager } = await import('../../../services/admin/ServerConfigManager')
          for (const sourceId of preferredSources) {
            const isEnabled = serverConfigManager.isServerEnabled(sourceId)
            if (!isEnabled) {
              return NextResponse.json({
                success: false,
                error: `Preferred data source '${sourceId}' is currently disabled`,
                disabledSources: [sourceId]
              }, { status: 400 })
            }
          }
        }

        const stockData = await SimpleMCPClient.getStockPrice(symbolToUse)
        if (stockData) {
          stocks = [stockData]
          sources.add(stockData.source)
        }
        break

      case 'sector':
        if (!sector) {
          return NextResponse.json({
            success: false,
            error: 'Sector required for sector mode'
          }, { status: 400 })
        }

        stocks = await SimpleMCPClient.getStocksBySector(sector, limit)
        stocks.forEach(stock => sources.add(stock.source))
        break

      case 'multiple':
        if (!symbols?.length) {
          return NextResponse.json({
            success: false,
            error: 'Symbols required for multiple mode'
          }, { status: 400 })
        }

        // Get multiple stocks in parallel
        const promises = symbols.slice(0, limit).map(symbol =>
          SimpleMCPClient.getStockPrice(symbol)
        )

        const results = await Promise.all(promises)
        stocks = results.filter(Boolean) as SimpleStockData[]
        stocks.forEach(stock => sources.add(stock.source))
        break

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid mode'
        }, { status: 400 })
    }

    // Return simple response
    const response: SimpleStockResponse = {
      success: true,
      data: {
        stocks,
        metadata: {
          mode,
          count: stocks.length,
          timestamp: Date.now(),
          sources: Array.from(sources)
        }
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Stock selection error:', error)

    return NextResponse.json({
      success: false,
      error: error instanceof z.ZodError
        ? 'Invalid request format'
        : 'Internal server error'
    }, { status: 500 })
  }
}

/**
 * GET endpoint for health check
 */
export async function GET(): Promise<NextResponse> {
  try {
    const health = await SimpleMCPClient.healthCheck()

    return NextResponse.json({
      success: true,
      data: {
        status: 'healthy',
        services: health,
        timestamp: Date.now()
      }
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Health check failed'
    }, { status: 500 })
  }
}